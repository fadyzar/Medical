# משימות פתוחות

## דחוף — נדרש לפני פרודקשן

- [ ] **Hostinger API Key** — לדבר עם אושרית: להיכנס להוסטינגר → ניהול דומיין → תפריט צד → API → ליצור API Token חדש ולשלוח
- [ ] **הרצת Migration 016** בסופאבייס SQL Editor:
  ```sql
  ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS domain_status text NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS domain_error text,
    ADD COLUMN IF NOT EXISTS domain_last_checked_at timestamptz;
  ```
- [ ] **Vercel env vars** — להוסיף ב-Vercel → Settings → Environment Variables:
  - `HOSTINGER_API_KEY` (מאושרית)
  - `VERCEL_DNS_TARGET` — ה-CNAME target האמיתי של הפרויקט

## פיצ'רים הבאים

- [ ] **Google Login** — התחברות דרך גוגל (OAuth)
- [ ] **Tranzila** — תשלום אמיתי (עכשיו יש רק fake)
- [ ] **Email notifications** — תזכורות תורים, אישורים, סיכומים (Resend)
- [ ] **יומן רופא** — תצוגה שבועית, שעות פעילות, ימי חופשה
- [ ] **Admin מלא** — ניהול רופאים/צוות CRUD, דוחות הכנסות
- [ ] **LiveKit אמיתי** — screen sharing, in-call chat, הקלטה


