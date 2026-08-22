const { prisma } = require('../config/database');
const { success, error } = require('../utils/response');
const { ensureApprovedAgency } = require('./agency.controller');
const wa = require('../services/whatsapp.service');
const { assignNextMember, markFirstResponse } = require('../services/crmAutomation.service');

async function getWhatsApp(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res); if (!agency) return;
    return success(res, { configured: wa.isConfigured(), connected: !!(agency.whatsappActive && agency.whatsappToken), displayPhone: agency.whatsappDisplayPhone || null, phoneNumberId: agency.whatsappPhoneNumberId || null, wabaId: agency.whatsappWabaId || null, welcome: agency.whatsappWelcome || '' });
  } catch (err) { return error(res, err.message, 500); }
}

async function connect(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res); if (!agency) return;
    const token = String(req.body?.token || '').trim();
    const phoneNumberId = String(req.body?.phoneNumberId || '').trim();
    const wabaId = String(req.body?.wabaId || '').trim();
    if (!token || !/^\d{5,30}$/.test(phoneNumberId) || !/^\d{5,30}$/.test(wabaId)) return error(res, 'Token, Phone Number ID va WABA ID ni to‘liq kiriting', 400);
    const phone = await wa.verifyConnection(token, phoneNumberId);
    await wa.subscribeApp(token, wabaId);
    const updated = await prisma.tourAgency.update({ where: { id: agency.id }, data: { whatsappToken: wa.encryptToken(token), whatsappPhoneNumberId: phoneNumberId, whatsappWabaId: wabaId, whatsappDisplayPhone: phone.display_phone_number || null, whatsappActive: true } });
    return success(res, { connected: true, displayPhone: updated.whatsappDisplayPhone });
  } catch (err) { return error(res, err.message, 400); }
}

async function disconnect(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res); if (!agency) return;
    await prisma.tourAgency.update({ where: { id: agency.id }, data: { whatsappActive: false, whatsappToken: null, whatsappPhoneNumberId: null, whatsappWabaId: null, whatsappDisplayPhone: null } });
    return success(res, { connected: false });
  } catch (err) { return error(res, err.message, 400); }
}

async function setWelcome(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res); if (!agency) return;
    const text = String(req.body?.text || '').trim().slice(0, 1000);
    await prisma.tourAgency.update({ where: { id: agency.id }, data: { whatsappWelcome: text || null } });
    return success(res, { welcome: text });
  } catch (err) { return error(res, err.message, 400); }
}

async function templates(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res); if (!agency) return;
    if (!agency.whatsappActive || !agency.whatsappToken || !agency.whatsappWabaId) return error(res, 'WhatsApp ulanmagan', 400);
    const data = await wa.listTemplates(wa.decryptToken(agency.whatsappToken), agency.whatsappWabaId);
    return success(res, { templates: data.data || [] });
  } catch (err) { return error(res, err.message, 400); }
}

async function sendReply(agency, booking, text, templateName, language) {
  if (!agency.whatsappActive || !agency.whatsappToken || !agency.whatsappPhoneNumberId || !booking.whatsappWaId) throw new Error('WhatsApp ulanmagan yoki lid WhatsApp’dan kelmagan');
  const token = wa.decryptToken(agency.whatsappToken);
  const lastInbound = await prisma.telegramMessage.findFirst({ where: { agencyId: agency.id, bookingId: booking.id, channel: 'whatsapp', direction: 'in' }, orderBy: { createdAt: 'desc' } });
  const insideWindow = lastInbound && Date.now() - new Date(lastInbound.createdAt).getTime() <= 24 * 60 * 60 * 1000;
  if (!insideWindow && !templateName) throw new Error('WhatsApp 24 soatlik oynasi yopilgan. Tasdiqlangan shablon xabarini tanlang.');
  return templateName
    ? wa.sendTemplate(token, agency.whatsappPhoneNumberId, booking.whatsappWaId, templateName, language)
    : wa.sendText(token, agency.whatsappPhoneNumberId, booking.whatsappWaId, text);
}

async function send(req, res) {
  try {
    const agency = await ensureApprovedAgency(req, res); if (!agency) return;
    const booking = await prisma.tourBooking.findFirst({ where: { id: String(req.body?.bookingId || ''), agencyId: agency.id } });
    if (!booking) return error(res, 'Lid topilmadi', 404);
    const text = String(req.body?.text || '').trim(); const templateName = String(req.body?.templateName || '').trim();
    if (!text && !templateName) return error(res, 'Xabar yoki shablon tanlang', 400);
    const sent = await sendReply(agency, booking, text, templateName, req.body?.language);
    const externalId = sent.messages?.[0]?.id || null;
    const message = await prisma.telegramMessage.create({ data: { agencyId: agency.id, bookingId: booking.id, channel: 'whatsapp', direction: 'out', text: templateName ? `[Shablon] ${templateName}` : text, fromName: 'Agent', externalId, recipientId: booking.whatsappWaId, status: 'sent' } });
    await markFirstResponse(booking.id);
    return success(res, { message });
  } catch (err) { return error(res, err.message, 400); }
}

function webhookVerify(req, res) {
  const challenge = wa.verifyChallenge(req.query || {});
  return challenge === null ? res.status(403).send('forbidden') : res.status(200).send(challenge);
}

function messageText(message) {
  if (message.type === 'text') return message.text?.body || '';
  if (message.type === 'button') return message.button?.text || '[Tugma]';
  if (message.type === 'interactive') return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '[Interaktiv xabar]';
  return `[${message.type || 'media'} fayl]`;
}

async function handleIncoming(agency, value) {
  const contactNames = new Map((value.contacts || []).map((c) => [String(c.wa_id), c.profile?.name || 'WhatsApp mijoz']));
  for (const incoming of value.messages || []) {
    const waId = String(incoming.from || ''); const externalId = String(incoming.id || '');
    if (!waId || !externalId) continue;
    if (await prisma.telegramMessage.findUnique({ where: { externalId } })) continue;
    let booking = await prisma.tourBooking.findFirst({ where: { agencyId: agency.id, whatsappWaId: waId } });
    const isNew = !booking;
    if (!booking) {
      const member = await assignNextMember(agency.id);
      booking = await prisma.tourBooking.create({ data: { agencyId: agency.id, customerName: contactNames.get(waId) || 'WhatsApp mijoz', customerPhone: waId, leadWhatsapp: waId, whatsappWaId: waId, message: messageText(incoming), travelers: 1, currency: 'USD', source: 'whatsapp', utmSource: 'whatsapp', utmMedium: 'cloud_api', status: 'pending', pipelineStage: 'new', assignedMemberId: member?.id || null, branchId: member?.branchId || null } });
    }
    await prisma.telegramMessage.create({ data: { agencyId: agency.id, bookingId: booking.id, channel: 'whatsapp', direction: 'in', text: messageText(incoming), fromName: contactNames.get(waId) || waId, externalId, senderId: waId, recipientId: agency.whatsappPhoneNumberId, status: 'received', metadata: { type: incoming.type, timestamp: incoming.timestamp } } });
    if (isNew && agency.whatsappWelcome) {
      try {
        const sent = await wa.sendText(wa.decryptToken(agency.whatsappToken), agency.whatsappPhoneNumberId, waId, agency.whatsappWelcome);
        await prisma.telegramMessage.create({ data: { agencyId: agency.id, bookingId: booking.id, channel: 'whatsapp', direction: 'out', text: agency.whatsappWelcome, fromName: 'Avto', externalId: sent.messages?.[0]?.id || null, recipientId: waId, status: 'sent' } });
      } catch { /* lid saqlanadi */ }
    }
  }
  for (const status of value.statuses || []) {
    await prisma.telegramMessage.updateMany({ where: { externalId: String(status.id || '') }, data: { status: status.status || null, metadata: { timestamp: status.timestamp, errors: status.errors || null } } });
  }
}

async function webhook(req, res) {
  try {
    if (!wa.verifySignature(req.rawBody, req.get('x-hub-signature-256'))) return res.status(403).json({ ok: false });
    for (const entry of req.body?.entry || []) for (const change of entry.changes || []) {
      const value = change.value || {}; const phoneNumberId = String(value.metadata?.phone_number_id || '');
      const agency = await prisma.tourAgency.findFirst({ where: { whatsappActive: true, whatsappPhoneNumberId: phoneNumberId, whatsappToken: { not: null } } });
      if (agency) await handleIncoming(agency, value);
    }
    return res.status(200).json({ ok: true });
  } catch { return res.status(200).json({ ok: true }); }
}

module.exports = { connect, disconnect, getWhatsApp, send, sendReply, setWelcome, templates, webhook, webhookVerify };
