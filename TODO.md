# משימות פתוחות

> עודכן 18.09.2026. רוב הפיצ'רים שהיו ברשימה הקודמת כבר בנויים בקוד —
> מה שנשאר חסום הוא בעיקר **credentials**, לא פיתוח.

## חסום — מחכה למפתחות/גישה (לא בעיית קוד)

- [ ] **Hostinger API Key** — לדבר עם אושרית: הוסטינגר → ניהול דומיין → תפריט צד → API →
      ליצור API Token חדש ולשלוח
- [ ] **Vercel env vars** — להוסיף ב-Vercel → Settings → Environment Variables:
  - `HOSTINGER_API_KEY` (מאושרית)
  - `VERCEL_DNS_TARGET` — ה-CNAME target האמיתי של הפרויקט
  - `TRANZILA_TERMINAL_NAME` + `TRANZILA_API_KEY` — הקוד מוכן, חסרים פרטי הטרמינל
  - `RESEND_API_KEY` — הקוד מוכן
  - `CRON_SECRET` — נדרש כדי ש-`/api/cron/reminders` יעבוד
- [ ] **Supabase Dashboard** — להפעיל את ספק ה-Google ב-Authentication → Providers
      (הקוד של הכפתור כבר קיים ב-`components/auth/GoogleButton.tsx`)

## Migrations שצריך להריץ ב-Supabase SQL Editor

- [x] ~~016, 018~~ — כבר הורצו (אומת מול ה-DB: `organization_integrations` קיים)
- [ ] **019_security_hardening.sql** — ⚠️ **דחוף, לפני כל לקוח אמיתי.**
      מתקן 5 חורים שכולם ניתנים לניצול מה-console של הדפדפן עם ה-anon key בלבד:
      הסלמת הרשאות בהרשמה, קידום עצמי ל-admin, קריאת תיקים רפואיים של מטופלים
      אחרים באותה מרפאה, חשיפת רופאים בין מרפאות, וכפל הזמנה לאותו מועד.
      **אחרי ההרצה:** לבדוק שהרשמה, קביעת תור ומסך הרופא עדיין עובדים.

## כבר בנוי (אל תבנה שוב)

- [x] Google Login — `components/auth/GoogleButton.tsx`
- [x] Tranzila — iframe ב-`/api/payments/create-session`, webhook עם אימות חתימה
- [x] Email — Resend ב-`lib/email/`, תזכורות 24h/1h ב-`/api/cron/reminders`
- [x] יומן רופא — `/dashboard/doctor/calendar` + `/availability`
- [x] Admin — users, billing, reports, audit-log, settings, templates, questionnaires
- [x] LiveKit אמיתי — screen sharing, chat, הקלטה (`app/video-call/page.tsx`)
- [x] ESLint — `npm run lint` עובד (Next 16 flat config), 0 errors

## פיתוח — מה שבאמת נשאר

- [ ] **בדיקת end-to-end על סביבת staging** — אף מסלול לא נבדק מול Tranzila/Resend אמיתיים
- [ ] **חשבוניות** — `lib/invoice/` קיים; לוודא חיבור ל-Green Invoice/iCount אמיתי
- [ ] **דף `/doctors` ריק** — מציג "רופאים יצטרפו בקרוב" עד שיהיו רופאים ב-DB
- [ ] **בלוג** — `lib/blog/posts.ts` הוא תוכן סטטי בקוד; לשקול CMS אם אושרית תרצה לערוך
- [ ] **להוציא PII של רופאים מטבלת users** — `license_number`, `id_number`, `phone`
      עדיין קריאים לכל משתמש מחובר על שורות של רופאים. RLS הוא row-level בלבד
      ו-column GRANTs לא עוזרים כי כולם אותו role (`authenticated`). הפתרון:
      טבלה נפרדת `doctor_private`. פירוט מלא ב-019.
- [ ] **73 אזהרות lint** — בעיקר `react-hooks/exhaustive-deps`; לא דחוף, לא שובר כלום
