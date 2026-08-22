# Instagram Direct — productionda qolgan sozlamalar

Kod, OAuth, webhook, token refresh, CRM lid va javob oqimi tayyor. Secretlarni Git yoki chatga yubormang; production containerning mavjud `/app/.env` fayliga bevosita qo‘ying.

```env
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_VERIFY_TOKEN=
INSTAGRAM_TOKEN_ENCRYPTION_KEY=
```

- `INSTAGRAM_APP_ID` va `INSTAGRAM_APP_SECRET`: Meta App Dashboard’dan.
- `INSTAGRAM_VERIFY_TOKEN`: uzun tasodifiy qiymat; Meta Webhooks sozlamasida aynan shu qiymat yoziladi.
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: `openssl rand -base64 32` natijasi. Bu kalitni yo‘qotmang yoki o‘zboshimchalik bilan almashtirmang.

Meta Dashboard’da:

1. OAuth redirect URI: `https://travelorai.com/api/v1/instagram/callback`
2. Webhook callback URL: `https://travelorai.com/api/v1/instagram/webhook`
3. Verify token: `.env` dagi `INSTAGRAM_VERIFY_TOKEN`
4. Instagram webhook field: `messages`

Deploy jarayoni `npx prisma generate && npx prisma migrate deploy` bajarishi kerak. So‘ng agentlik kabineti → Sozlamalar → Ulanishlar → Instagram Direct orqali professional akkaunt ulanadi.
