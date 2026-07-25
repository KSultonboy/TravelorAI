import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";
import { CONTACT, hasLegalEntity, legalLines } from "@/lib/legalEntity";

export const metadata: Metadata = {
  title: "Ommaviy oferta",
  description:
    "TravelorAI CRM platformasidan obuna asosida foydalanish bo'yicha ommaviy oferta — tariflar, to'lov tartibi va pul qaytarish shartlari.",
  alternates: { canonical: "/offer" },
};

/** Rekvizitlar to'ldirilmagan bo'lsa — soxta ma'lumot chiqarmaymiz, halol izoh beramiz. */
const requisites = hasLegalEntity()
  ? legalLines()
  : ["Ijrochining to'liq huquqiy rekvizitlari (nom, STIR, manzil, bank ma'lumotlari) yuridik shaxs ro'yxatdan o'tkazilgach ushbu bo'limda e'lon qilinadi."];

export default function OfferPage() {
  return (
    <LegalDoc
      title="Ommaviy oferta"
      updated="2026-yil iyul"
      intro="Ushbu hujjat TravelorAI platformasidan (keyingi o'rinlarda — Platforma) obuna asosida foydalanish bo'yicha ommaviy oferta hisoblanadi. Ro'yxatdan o'tish yoki to'lovni amalga oshirish orqali siz quyidagi shartlarni to'liq va so'zsiz qabul qilgan hisoblanasiz."
      sections={[
        {
          heading: "1. Umumiy qoidalar",
          body: [
            "Ushbu hujjat O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq ommaviy oferta bo'lib, Platforma xizmatlaridan foydalanish uchun shartnoma tuzish taklifidir.",
            "Oferta shartlari barcha Buyurtmachilar uchun bir xil. Ofertani qabul qilish (aksept) yozma shartnoma tuzish bilan teng kuchga ega.",
            "Oferta Platforma saytida (travelorai.com/offer) e'lon qilingan kundan boshlab amal qiladi va Ijrochi tomonidan bekor qilinmaguncha kuchda qoladi.",
          ],
        },
        {
          heading: "2. Atamalar",
          body: [
            "Ijrochi — Platformani ishlab chiqaruvchi va unga xizmat ko'rsatuvchi tomon (rekvizitlar 11-bandda).",
            "Buyurtmachi — Platformada ro'yxatdan o'tgan va obunani rasmiylashtirgan turizm sohasidagi yuridik shaxs yoki yakka tartibdagi tadbirkor (turagentlik).",
            "Platforma — TravelorAI CRM tizimi: mijozlar va so'rovlarni (lidlarni) boshqarish, turlar katalogi, takliflar, to'lovlar hisobi, hisobotlar va Telegram integratsiyasi.",
            "Obuna — tanlangan tarif bo'yicha Platformadan belgilangan muddatga foydalanish huquqi.",
            "Aksept — Buyurtmachi tomonidan oferta shartlarining qabul qilinishi: Platformada ro'yxatdan o'tish va/yoki obuna uchun to'lovni amalga oshirish.",
          ],
        },
        {
          heading: "3. Oferta predmeti",
          body: [
            "Ijrochi Buyurtmachiga Platformadan obuna asosida foydalanish huquqini (dasturiy ta'minotga oddiy, nomutanosib bo'lmagan litsenziya) beradi, Buyurtmachi esa tanlangan tarif bo'yicha to'lovni amalga oshiradi.",
            "Platforma internet orqali «xizmat ko'rinishida» (SaaS) taqdim etiladi. Dasturiy ta'minotning nusxasi Buyurtmachiga topshirilmaydi va mutlaq huquqlar Ijrochida qoladi.",
            "Ijrochi turoperator va turagentlik EMAS. Ijrochi turistik mahsulotni shakllantirmaydi va sotmaydi. Turistik xizmatlarni sotish, ular uchun javobgarlik va turoperatorlar bilan shartnomaviy munosabatlar to'liq Buyurtmachi zimmasida.",
          ],
        },
        {
          heading: "4. Aksept tartibi",
          body: [
            "Oferta quyidagi harakatlar orqali qabul qilingan hisoblanadi: Platformada ro'yxatdan o'tish va obuna uchun to'lovni amalga oshirish.",
            "Aksept lahzasidan boshlab Ijrochi va Buyurtmachi o'rtasida ushbu oferta shartlari bo'yicha shartnoma tuzilgan deb hisoblanadi.",
            "Buyurtmachi ofertani qabul qilish orqali o'zining ro'yxatdan o'tgan tadbirkorlik subyekti ekanini va Platformadan tadbirkorlik faoliyati doirasida foydalanishini tasdiqlaydi.",
          ],
        },
        {
          heading: "5. Tariflar va to'lov tartibi",
          body: [
            "Amaldagi tariflar va ularning narxlari travelorai.com/pricing sahifasida O'zbekiston so'mida e'lon qilinadi va ushbu ofertaning ajralmas qismi hisoblanadi.",
            "To'lov oldindan (avans) tartibida, tanlangan obuna muddati uchun to'liq amalga oshiriladi. Obuna standart muddati — 1 (bir) oy, agar boshqa muddat tanlanmagan bo'lsa.",
            "To'lov O'zbekiston Respublikasida ro'yxatdan o'tgan to'lov tizimlari (CLICK, Payme) yoki bank o'tkazmasi orqali qabul qilinadi. To'lov tizimlari xizmatlari uchun komissiya (agar mavjud bo'lsa) to'lov tizimi qoidalari bo'yicha belgilanadi.",
            "To'lov Ijrochi hisobiga tushgan lahzadan obuna avtomatik faollashadi va Platformada obuna muddati ko'rsatiladi.",
            "Obuna muddati tugagach va yangi to'lov amalga oshirilmasa, Platforma «faqat o'qish» rejimiga o'tadi: ma'lumotlar saqlanadi, lekin yangi yozuvlar kiritish cheklanadi. Ma'lumotlar obuna tugaganidan keyin kamida 6 (olti) oy saqlanadi.",
            "Ijrochi tariflarni o'zgartirish huquqiga ega. Narx o'zgarishi allaqachon to'langan obuna muddatiga taalluqli emas va saytda kamida 15 (o'n besh) kun oldin e'lon qilinadi.",
          ],
        },
        {
          heading: "6. Pul qaytarish (refund) shartlari",
          body: [
            "Xato yoki takroriy to'lov — Buyurtmachi murojaatidan so'ng to'liq miqdorda qaytariladi.",
            "Ijrochi aybi bilan Platforma uzluksiz 24 (yigirma to'rt) soatdan ortiq ishlamay qolsa — Buyurtmachi talabiga ko'ra ishlamagan kunlar uchun mutanosib summa qaytariladi yoki obuna muddati shu kunlarga uzaytiriladi.",
            "Obunaning allaqachon foydalanilgan davri uchun to'lov qaytarilmaydi. Buyurtmachi obunani muddatidan oldin bekor qilsa, joriy to'langan davr oxirigacha foydalanish huquqi saqlanadi.",
            "Pul qaytarish uchun ariza " + CONTACT.email + " yoki " + CONTACT.emailAlt + " manziliga yuboriladi. Arizada to'lov sanasi, summasi va usuli ko'rsatiladi.",
            "Ariza 3 (uch) ish kuni ichida ko'rib chiqiladi. Ijobiy qaror qabul qilinsa, summa 10 (o'n) ish kuni ichida to'lov amalga oshirilgan usulda qaytariladi.",
            "Buyurtmachi ushbu oferta shartlarini buzgani sababli obuna to'xtatilgan taqdimda to'lov qaytarilmaydi.",
          ],
        },
        {
          heading: "7. Tomonlarning huquq va majburiyatlari",
          body: [
            "Ijrochi majburiyatlari: Platformaning ishlashini ta'minlash; texnik nosozliklarni imkon qadar tez bartaraf etish; Buyurtmachi ma'lumotlarining maxfiyligini saqlash; rejalashtirilgan texnik ishlar haqida oldindan xabar berish.",
            "Ijrochi huquqlari: Platformani takomillashtirish va funksiyalarini yangilash; oferta shartlarini buzgan Buyurtmachiga xizmat ko'rsatishni to'xtatish; texnik profilaktika ishlarini olib borish (odatda 4 soatdan ko'p emas).",
            "Buyurtmachi majburiyatlari: to'lovni o'z vaqtida amalga oshirish; hisobga kirish ma'lumotlarini maxfiy saqlash; Platformaga faqat qonuniy yo'l bilan olingan ma'lumotlarni kiritish; o'z mijozlaridan shaxsiy ma'lumotlarni qayta ishlash uchun kerakli roziliklarni olish.",
            "Buyurtmachi huquqlari: tanlangan tarif doirasidagi barcha funksiyalardan foydalanish; ma'lumotlarini eksport qilish; texnik ko'mak olish; tarifni istalgan vaqtda o'zgartirish.",
            "Buyurtmachiga taqiqlanadi: Platformaga teskari injiniring qilish, nusxalash, uchinchi shaxslarga qayta sotish yoki hisobni boshqa tashkilot bilan bo'lishish; Platforma orqali qonunga xilof faoliyat yuritish.",
          ],
        },
        {
          heading: "8. Javobgarlik va cheklovlar",
          body: [
            "Ijrochi Buyurtmachi va uning mijozlari o'rtasidagi bitimlar, turistik xizmat sifati, sayohatning bekor qilinishi yoki o'zgarishi uchun javobgar emas. Platforma faqat ish jarayonini boshqarish vositasi hisoblanadi.",
            "Ijrochining javobgarligi har qanday holatda oxirgi 1 (bir) oy uchun to'langan obuna summasidan oshmaydi.",
            "Ijrochi Buyurtmachining bilvosita zararlari (yo'qotilgan foyda, obro'ga zarar) uchun javobgar emas.",
            "Buyurtmachi Platformaga kiritgan ma'lumotlarning to'g'riligi va qonuniyligi uchun to'liq javobgardir.",
            "Fors-major holatlari (tabiiy ofat, elektr va internet uzilishlari, davlat organlari qarorlari, uchinchi tomon xizmatlarining ishlamay qolishi) yuz berganda tomonlar javobgarlikdan ozod qilinadi.",
          ],
        },
        {
          heading: "9. Shaxsiy ma'lumotlar va maxfiylik",
          body: [
            "Shaxsiy ma'lumotlarni qayta ishlash tartibi travelorai.com/privacy sahifasidagi Maxfiylik siyosati bilan tartibga solinadi.",
            "Buyurtmachi Platformaga o'z mijozlarining ma'lumotlarini kiritganda, ushbu ma'lumotlarga nisbatan qayta ishlashning tashkilotchisi (mas'ul shaxs) Buyurtmachi hisoblanadi. Ijrochi esa Buyurtmachi topshirig'i bo'yicha ma'lumotlarni saqlaydi va qayta ishlaydi.",
            "Ijrochi Buyurtmachi ma'lumotlarini uchinchi shaxslarga sotmaydi va reklama maqsadida uzatmaydi.",
            "Buyurtmachi ma'lumotlari himoyalangan serverlarda saqlanadi va muntazam zaxira nusxalanadi.",
          ],
        },
        {
          heading: "10. Oferta muddati, o'zgarishlar va nizolar",
          body: [
            "Oferta saytda e'lon qilingan kundan kuchga kiradi va muddatsiz amal qiladi.",
            "Ijrochi oferta shartlarini bir tomonlama o'zgartirish huquqiga ega. O'zgarishlar saytda e'lon qilingan kundan kuchga kiradi. Buyurtmachi o'zgarishlardan keyin Platformadan foydalanishni davom ettirsa, yangi shartlarni qabul qilgan hisoblanadi.",
            "Nizolar avvalo muzokaralar yo'li bilan hal qilinadi. Kelishuvga erishilmasa, nizo O'zbekiston Respublikasi qonunchiligiga muvofiq tegishli sudda ko'rib chiqiladi.",
            "Har qanday savol yoki murojaat uchun: " + CONTACT.phone + " · " + CONTACT.email + " · " + CONTACT.emailAlt + " · " + CONTACT.telegram,
          ],
        },
        {
          heading: "11. Ijrochi rekvizitlari",
          body: requisites,
        },
      ]}
    />
  );
}
