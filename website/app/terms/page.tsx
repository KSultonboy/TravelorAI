import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Foydalanish shartlari",
  description: "TravelorAI platformasidan foydalanish shartlari va qoidalari.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Foydalanish shartlari"
      updated="2026-yil iyun"
      intro="TravelorAI platformasidan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz. Iltimos, ularni diqqat bilan o'qing."
      sections={[
        { heading: "1. Xizmat haqida", body: [
          "TravelorAI — foydalanuvchilarni tasdiqlangan turagentliklari bilan bog'lovchi va AI yordamida sayohat rejasini tuzuvchi platforma. Biz turagentligi emasmiz; turlar tegishli agentliklar tomonidan taqdim etiladi.",
        ]},
        { heading: "2. Hisob", body: [
          "Bitta email bilan faqat bir marta ro'yxatdan o'tish mumkin. Hisob ma'lumotlaringiz maxfiyligini saqlash sizning zimmangizda.",
        ]},
        { heading: "3. Bron va to'lov", body: [
          "Bron so'rovi tegishli agentligiga yuboriladi. Yakuniy narx, to'lov va bekor qilish shartlari agentligi siyosatiga bog'liq. TravelorAI bron uchun shaffof narx breakdownini ko'rsatadi.",
        ]},
        { heading: "4. Foydalanuvchi majburiyatlari", body: [
          "Platformadan qonuniy maqsadlarda foydalaning. Soxta ma'lumot kiritish, boshqalar huquqlarini buzish yoki tizimga zarar yetkazish taqiqlanadi.",
        ]},
        { heading: "5. Javobgarlik", body: [
          "TravelorAI agentliklar ko'rsatadigan xizmat sifati uchun bevosita javobgar emas, ammo tasdiqlangan hamkorlar va shaffof reyting tizimi orqali sifatni ta'minlashga harakat qiladi.",
        ]},
        { heading: "6. O'zgarishlar", body: [
          "Biz ushbu shartlarni yangilashimiz mumkin. Muhim o'zgarishlar haqida foydalanuvchilarni xabardor qilamiz.",
        ]},
      ]}
    />
  );
}
