async function syncManagerCommission(db, source) {
  if (!source?.id) return null;
  const previous = await db.financeTransaction.findUnique({ where: { commissionSourceId: source.id } });
  if (source.direction !== 'income' || source.status !== 'paid' || !source.bookingId) {
    if (previous && previous.status !== 'cancelled') {
      return db.financeTransaction.update({ where: { id: previous.id }, data: { status: 'cancelled', paidAt: null } });
    }
    return null;
  }

  const booking = await db.tourBooking.findFirst({
    where: { id: source.bookingId, agencyId: source.agencyId },
    select: { assignedMemberId: true, assignedMember: { select: { name: true, commissionRule: true } } },
  });
  const rule = booking?.assignedMember?.commissionRule;
  if (!booking?.assignedMemberId || !rule?.active || rule.currency !== source.currency) return null;
  const amount = Math.max(0, Math.round(source.amount * Number(rule.percent || 0) / 100) + Number(rule.fixedAmount || 0));
  if (!amount) return null;
  const data = {
    agencyId: source.agencyId,
    bookingId: source.bookingId,
    managerMemberId: booking.assignedMemberId,
    commissionSourceId: source.id,
    direction: 'expense', status: 'planned', category: 'Menejer komissiyasi', amount,
    currency: source.currency, counterparty: booking.assignedMember.name,
    dueAt: source.paidAt || new Date(), note: `${rule.percent}% + ${rule.fixedAmount} ${rule.currency}`,
    createdByAccountId: source.createdByAccountId,
  };
  if (previous) return db.financeTransaction.update({ where: { id: previous.id }, data });
  return db.financeTransaction.create({ data });
}

function supplierBalances(suppliers, transactions, currency) {
  return suppliers.filter((supplier) => supplier.currency === currency).map((supplier) => {
    const rows = transactions.filter((row) => row.supplierId === supplier.id && row.direction === 'expense' && row.status !== 'cancelled');
    const paid = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0);
    const payable = rows.filter((row) => row.status === 'planned').reduce((sum, row) => sum + row.amount, 0);
    return { ...supplier, paid, payable, total: paid + payable, overdue: rows.filter((row) => row.status === 'planned' && row.dueAt && row.dueAt < new Date()).reduce((sum, row) => sum + row.amount, 0) };
  });
}

function commissionSummary(team, transactions, currency) {
  return team.map((member) => {
    const rows = transactions.filter((row) => row.managerMemberId === member.id && row.commissionSourceId && row.currency === currency && row.status !== 'cancelled');
    return {
      memberId: member.id, name: member.name, role: member.role, rule: member.commissionRule,
      accrued: rows.reduce((sum, row) => sum + row.amount, 0),
      paid: rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amount, 0),
      payable: rows.filter((row) => row.status === 'planned').reduce((sum, row) => sum + row.amount, 0),
    };
  });
}

function paymentCalendar(transactions) {
  return transactions
    .filter((row) => row.status === 'planned' && row.dueAt)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .map((row) => ({ id: row.id, dueAt: row.dueAt, direction: row.direction, amount: row.amount, currency: row.currency, category: row.category, counterparty: row.counterparty, supplierId: row.supplierId, businessDocumentId: row.businessDocumentId }));
}

module.exports = { syncManagerCommission, supplierBalances, commissionSummary, paymentCalendar };
