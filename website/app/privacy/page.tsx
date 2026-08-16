import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { CONTACT } from "@/lib/legalEntity";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description: "TravelorAI maxfiylik siyosati — biz qanday ma'lumot to'playmiz, qanday saqlaymiz va himoya qilamiz.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Maxfiylik siyosati"
      updated="2026-yil iyul"
      intro="TravelorAI sizning shaxsiy ma'lumotlaringiz xavfsizligini jiddiy qabul qiladi. Ushbu siyosat platformadan foydalanganingizda qanday ma'lumotlarni to'plashimiz, ulardan qanday foydalanishimiz va ularni qanday himoya qilishimizni tushuntiradi."
      sections={[
        { heading: "1. To'planadigan ma'lumotlar", body: [
          "Hisob ma'lumotlari: ism, email, telefon raqami va parol (shifrlangan holda saqlanadi).",
          "Foydalanish ma'lumotlari: tanlangan turlar, sayohat rejalari, wishlist va bron tarixi.",
          "Texnik ma'lumotlar: qurilma turi, ilova versiyasi va xatoliklar haqida texnik loglar.",
        ]},
        { heading: "2. Ma'lumotlardan foydalanish", body: [
          "Xizmatni taqdim etish, bronlarni rasmiylashtirish va sizga mos sayohat tavsiyalarini berish uchun.",
          "Xavfsizlik, firibgarlikning oldini olish va qonuniy talablarga rioya qilish uchun.",
          "Sizning roziligingiz bilan xizmat yangiliklari va takliflar yuborish uchun.",
        ]},
        { heading: "3. Ma'lumotlarni ulashish", body: [
          "Biz sizning ma'lumotlaringizni uchinchi shaxslarga sotmaymiz. Bron qilganingizda kerakli ma'lumotlar faqat tegishli tasdiqlangan turagentligiga uzatiladi.",
        ]},
        { heading: "4. To'lov ma'lumotlari", body: [
          "To'lovlar O'zbekiston Respublikasida litsenziyalangan to'lov tizimlari (CLICK, Payme) orqali amalga oshiriladi.",
          "Karta raqami, amal qilish muddati va CVV kodi kabi to'lov ma'lumotlari to'lov tizimining o'z himoyalangan sahifasida kiritiladi. Biz bu ma'lumotlarni ko'rmaymiz, olmaymiz va saqlamaymiz.",
          "Bizning tizimda faqat to'lov fakti saqlanadi: summa, sana, buyurtma raqami, tanlangan tarif va to'lov holati — bu buxgalteriya hisobi va obunani faollashtirish uchun zarur.",
          "Agentlik obunasi bo'yicha to'lov va pul qaytarish shartlari ommaviy ofertada (travelorai.com/offer) belgilangan.",
        ]},
        { heading: "5. Ma'lumotlar xavfsizligi", body: [
          "Parollar shifrlanadi, ulanishlar HTTPS orqali himoyalanadi va ma'lumotlarga kirish cheklangan.",
          "Ma'lumotlar himoyalangan serverlarda saqlanadi va muntazam zaxira nusxalanadi.",
        ]},
        { heading: "6. Sizning huquqlaringiz", body: [
          "Siz istalgan vaqtda ma'lumotlaringizni ko'rish, tahrirlash yoki hisobingizni butunlay o'chirish huquqiga egasiz.",
          "Buning uchun " + CONTACT.email + " manziliga murojaat qiling.",
        ]},
        { heading: "7. Aloqa", body: [
          "Maxfiylik bo'yicha savollaringiz bo'lsa: " + CONTACT.phone + " · " + CONTACT.email,
        ]},
      ]}
    />
  );
}
