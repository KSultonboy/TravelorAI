# WhatsApp Cloud API — production sozlash

Kod deploy qilingandan keyin `/app/.env` ichiga faqat quyidagilar qo‘yiladi:

```env
WHATSAPP_APP_SECRET=Meta_App_Dashboard_dagi_App_Secret
WHATSAPP_VERIFY_TOKEN=uzun_tasodifiy_verify_token
META_GRAPH_VERSION=v23.0
```

`INSTAGRAM_TOKEN_ENCRYPTION_KEY` allaqachon mavjud va WhatsApp permanent access tokenini ham AES-256-GCM bilan shifrlaydi. Uni almashtirmang.

Meta Dashboard → WhatsApp → Configuration:

1. Callback URL: `https://travelorai.com/api/v1/whatsapp/webhook`
2. Verify token: `.env` dagi `WHATSAPP_VERIFY_TOKEN`
3. `messages` webhook fieldiga subscribe qiling.
4. CRM → WhatsApp bo‘limida System User permanent access token, Phone Number ID va WABA ID ni kiriting.
5. Ulanishda backend tokenni tekshiradi va WABA uchun `subscribed_apps` chaqiruvini o‘zi bajaradi.

24 soat ichida erkin matn yuboriladi. Oyna yopilganda CRM faqat Meta tasdiqlagan template xabarini yuboradi.
