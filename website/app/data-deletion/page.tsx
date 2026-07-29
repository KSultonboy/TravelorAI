import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { CONTACT } from "@/lib/legalEntity";

export const metadata: Metadata = {
  title: "Ma'lumotlarni o'chirish",
  description:
    "TravelorAI hisobingizni va biriktirilgan Instagram ma'lumotlarini qanday o'chirish mumkin — bosqichma-bosqich yo'riqnoma.",
  alternates: { canonical: "/data-deletion" },
};

const MAIL = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Ma'lumotlarni o'chirish so'rovi")}`;

/** Meta (Instagram/Facebook) App Review «User Data Deletion» talabi shu sahifaga
 *  ishora qiladi, Google Play esa backenddagi /account-deletion sahifasiga.
 *  Ikkalasi ham bir xil mexanizmni tasvirlaydi. Meta va Google tekshiruvchilari
 *  o'zbekcha o'qimaydi — shuning uchun oxirida inglizcha bo'lim bor
 *  (backenddagi /account-deletion sahifasi ham inglizcha, bir xil uslub). */
export default function DataDeletionPage() {
  return (
    <LegalDoc
      title="Ma'lumotlarni o'chirish"
      updated="2026-yil iyul"
      intro="Siz istalgan vaqtda TravelorAI'dagi hisobingizni va u bilan bog'liq barcha ma'lumotlarni o'chirishingiz mumkin. Quyida qaysi ma'lumot saqlanishi, uni qanday o'chirish va o'chirishdan keyin nima bo'lishi tushuntirilgan."
      sections={[
        {
          heading: "1. Sayohatchilar uchun — mobil ilova hisobi",
          body: [
            "Ilovada: Profil → Sozlamalar → «Hisobni o'chirish» bandini tanlang.",
            "Parolingizni kiriting (Google orqali kirgan bo'lsangiz — tasdiqlash avtomatik bo'ladi).",
            "Email manzilingizga tasdiqlash kodi keladi. Kodni kiritganingizdan so'ng hisob darhol o'chiriladi.",
            "O'chiriladigan ma'lumotlar: ism, email, telefon, parol, sayohat rejalari, wishlist, sharhlar va bron tarixi.",
          ],
        },
        {
          heading: "2. Agentliklar uchun — Instagram ulanishini uzish",
          body: [
            "Agentlik o'z Instagram biznes akkauntini CRM'ga ulaganda biz quyidagilarni olamiz va saqlaymiz: Instagram akkaunt identifikatori va foydalanuvchi nomi, kirish tokeni, hamda o'sha akkauntga kelgan to'g'ridan-to'g'ri xabarlar matni va yuboruvchining Instagram nomi. Bu xabarlar CRM'da lid sifatida ko'rinadi.",
            "Biz Instagram parolingizni, obunachilar ro'yxatingizni, postlaringiz statistikasini va boshqa shaxsiy profil ma'lumotlarini olmaymiz.",
            "Uzish uchun: Agentlik portali → Sozlamalar → Ulanishlar → Instagram → «Ulanishni uzish».",
            "Uzganingizda kirish tokeni darhol o'chiriladi va biz sizning Instagram akkauntingizga boshqa kira olmaymiz. Instagram orqali kelgan xabarlar va lidlarni ham o'chirishni istasangiz — quyidagi 3-bandga qarang yoki har bir lidni CRM'dan qo'lda o'chiring.",
            "Ulanishni istalgan vaqtda Instagram tomonidan ham uzishingiz mumkin: Instagram → Sozlamalar → Veb-saytlar va ilovalar ruxsatlari.",
          ],
        },
        {
          heading: "3. To'liq o'chirishni so'rash (barcha foydalanuvchilar uchun)",
          body: [
            <>
              Agar ilovaga kira olmasangiz yoki barcha ma'lumotlarni bir yo'la o'chirishni istasangiz,{" "}
              <a href={MAIL}>{CONTACT.email}</a> manziliga «Ma'lumotlarni o'chirish so'rovi» mavzusi bilan
              xat yuboring.
            </>,
            "Xatda hisobingiz bog'langan email manzilini yoki telefon raqamini ko'rsating — bu shaxsingizni tasdiqlash uchun kerak. Boshqa hech qanday parol yoki karta ma'lumotini yubormang.",
            "So'rovni 30 kun ichida bajaramiz va natijani o'sha email manzilingizga yozamiz.",
          ],
        },
        {
          heading: "4. O'chirishdan keyin nima qoladi",
          body: [
            "Hisobingiz va shaxsiy ma'lumotlaringiz butunlay o'chiriladi va tiklab bo'lmaydi.",
            "Istisno: O'zbekiston Respublikasi qonunchiligi talab qiladigan buxgalteriya va soliq hujjatlari — ya'ni to'lov fakti (summa, sana, hujjat raqami) — qonunda belgilangan saqlash muddati tugagunga qadar saqlanadi. Bu hujjatlarda sizning sayohat rejalaringiz, xabarlaringiz yoki aloqa ma'lumotlaringiz bo'lmaydi.",
            <>
              Qaysi ma'lumotlar to'planishi haqida to'liq ma'lumot —{" "}
              <a href="/privacy">maxfiylik siyosati</a> sahifasida.
            </>,
          ],
        },
        {
          heading: "English — how to delete your data",
          body: [
            "Travelers (mobile app): open Profile → Settings → Delete account, enter your password, then enter the confirmation code sent to your email. Your account, trips, wishlist, reviews and booking history are deleted immediately.",
            "Travel agencies (Instagram connection): when an agency connects its Instagram business account we store the Instagram account ID, username, access token, and the text of direct messages sent to that account together with the sender's Instagram name — these appear as leads in the CRM. We never receive your Instagram password, follower list or profile analytics. To disconnect, go to Agency portal → Settings → Connections → Instagram → Disconnect; the access token is deleted immediately. You can also revoke access from Instagram → Settings → Apps and websites.",
            <>
              Any user can request full deletion by emailing <a href={MAIL}>{CONTACT.email}</a> with the
              subject &quot;Data deletion request&quot;, stating the email address or phone number linked
              to the account. We complete such requests within 30 days and confirm by email.
            </>,
            "Exception: accounting and tax records required by the law of the Republic of Uzbekistan (payment amount, date and document number) are retained for the statutory retention period. They contain no trip data, messages or contact details.",
          ],
        },
      ]}
    />
  );
}
