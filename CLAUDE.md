# CLAUDE.md — הנחיות לפרויקט טלמדיסן

## מה זה הפרויקט

מערכת טלמדיסן (ייעוץ רפואי אונליין) ישראלית, שנמכרת כ-SaaS במנוי חודשי למרפאות עם מיתוג אישי (white-label).
המטרה: להיות הפלטפורמה הטובה ביותר בישראל — יותר טובה מ-HiDoc, ביקורופא, D-R.co.il.

## טכנולוגיות

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514) — 4 סוכנים: triage, summary, prescription draft, intake
- **Video:** LiveKit (שיחות וידאו)
- **תשלומים:** Tranzila (ישראלי) — עדיין לא מחובר
- **הודעות:** Infobip (WhatsApp), Resend (Email) — עדיין לא מחובר
- **Auth:** Supabase Auth עם @supabase/ssr (לא auth-helpers — הוא deprecated)
- **שפה:** עברית (RTL), הממשק כולו בעברית

## מבנה

```
telemed/
├── app/
│   ├── marketing/page.tsx     ← דף נחיתה שיווקי SSR (SEO)
│   ├── auth/                  ← login, register, forgot-password
│   ├── dashboard/
│   │   ├── patient/             ← dashboard, new-appointment, my-documents
│   │   ├── doctor/              ← dashboard, appointments (SOAP notes)
│   │   ├── admin/               ← dashboard
│   │   └── staff/               ← dashboard
│   ├── video-call/              ← שיחת וידאו עם waiting room
│   └── api/                     ← ai-triage, ai-summary, payments/webhook, auth/callback
├── lib/
│   ├── supabase/client.ts       ← Browser client (anon key only)
│   ├── supabase/server.ts       ← Server + service role
│   ├── ai/agents.ts             ← 4 AI agents
│   ├── validation/schemas.ts    ← Zod
│   └── utils/index.ts           ← cn, formatters, constants
├── components/
│   ├── ui/index.tsx             ← Button, Input, Card, Badge, etc.
│   └── layout/DashboardLayout.tsx
├── types/database.ts            ← TypeScript types
├── middleware.ts                ← Auth + role-based routing
└── supabase/
    ├── migrations/001_schema.sql + 002_rls.sql
    └── functions/               ← create-video-room, send-whatsapp
```

## מושגים חשובים

### Multi-tenant
כל טבלה יש בה `organization_id`. כל מרפאה = organization אחד. RLS מבטיח שמרפאה רואה רק את הנתונים שלה.
Helper functions: `get_my_org_id()`, `get_my_role()` — SECURITY DEFINER.

### users.id references auth.users(id)
זה קריטי. users.id הוא NOT auto-generated — הוא מקושר ל-auth.users. יש trigger `handle_new_user()` שיוצר פרופיל אוטומטית בהרשמה.

### Auth
- Middleware משתמש ב-`getUser()` (לא `getSession()`) — מאמת מול server.
- `@supabase/ssr` עם cookies, לא localStorage.
- Role routing: patient→/patient/dashboard, doctor→/doctor/dashboard, admin→/admin/dashboard

### AI Agents
4 סוכנים ב-`lib/ai/agents.ts`:
- `triageAgent` — מיון דחיפות (1-10) + המלצת התמחות
- `summaryAgent` — סיכום SOAP אחרי ייעוץ
- `prescriptionAgent` — טיוטת מרשם עם בדיקת אלרגיות
- `intakeAgent` — שאלון קליטה דינמי

כל שימוש ב-AI נשמר ב-`ai_conversations` (tokens, org_id) לצורך חיוב.
**חשוב: אין להדפיס מידע רפואי ל-console.log (HIPAA).**

### Appointment Flow
```
patient creates → pending → doctor confirms → doctor_confirmed
→ time selected → payment → paid → scheduled → ready
→ video starts → in_progress → video ends → completed
```

### Payment Flow (עדיין לא מחובר)
Tranzila (ישראלי). Webhook ב-`/api/payments/webhook`. יש `payment_idempotency_key` UNIQUE למניעת כפל חיוב.

## כללי אבטחה (חובה!)

1. **אין service role ב-frontend** — רק ב-server.ts ו-API routes
2. **אין secrets ב-NEXT_PUBLIC_** — רק URL + ANON_KEY
3. **CORS:** אין `*` — רשימת origins מוגדרת
4. **RLS:** מופעל על כל הטבלאות. אל תכבה.
5. **Input validation:** Zod על כל form input
6. **AI:** try/catch + timeout 30s + אין PHI ב-logs
7. **Storage:** medical-documents bucket = private, signed URLs only

## כללי UI/UX

- הכל ב**עברית** (RTL)
- `dir="rtl"` על root HTML
- הממשק נקי, מודרני, מינימליסטי
- Accessibility: labels, aria, keyboard navigation, focus-visible
- Mobile-first: responsive
- Tailwind CSS בלבד (אין CSS modules)
- Components ב-`components/ui/index.tsx` — שימוש חוזר

## מה כבר עובד (שלב 1 הושלם)

- [x] DB Schema מלא (9 טבלאות + triggers + indexes)
- [x] RLS על כל הטבלאות
- [x] Auth: login, register, forgot-password, callback
- [x] Middleware: role routing, session refresh
- [x] Patient: dashboard, new-appointment (5 steps), my-documents
- [x] Doctor: dashboard, appointments with SOAP notes
- [x] Admin: dashboard with KPIs
- [x] Staff: dashboard with search
- [x] Video: waiting room, hardware check, timer, disconnect
- [x] AI: triage + summary API routes
- [x] Landing page SSR + SEO (sitemap, robots, schema.org)
- [x] Payment webhook (structure, needs Tranzila credentials)
- [x] Edge functions: create-video-room, send-whatsapp
- [x] Security headers (CSP, HSTS, X-Frame-Options)

## מה חסר (שלב 2 — בנה את זה)

### עדיפות 1: תקן build
```bash
npm run build
```
תקן כל TypeScript error, import שבור, או type חסר.

### עדיפות 2: יומן רופא (Calendar UI)
- `app/dashboard/doctor/calendar/page.tsx`
- תצוגה שבועית/יומית של תורים
- הגדרת שעות פעילות (availability)
- הגדרת ימי חופשה
- Drag & drop לשינוי שעות (אופציונלי)
- שימוש ב-`date-fns` (כבר מותקן)

### עדיפות 3: Tranzila תשלומים
- iframe של Tranzila בדף תשלום
- payment wall לפני ייעוץ
- webhook validation עם signature
- חשבונית (Green Invoice API או iCount)

### עדיפות 4: Email notifications
- Resend integration (`RESEND_API_KEY`)
- תזכורת 24 שעות לפני תור
- תזכורת שעה לפני (עם קישור וידאו)
- אישור קביעת תור
- סיכום ייעוץ למטופל

### עדיפות 5: SEO + תוכן
- דפי התמחויות דינמיים (`/specialties/[slug]`)
- דף "הרופאים שלנו" (`/doctors`)
- בלוג רפואי (`/blog/[slug]`) — MDX או CMS

### עדיפות 6: Questionnaire Builder
- UI למנהל/רופא ליצירת שאלונים
- בונה שאלות: text, choice, scale, yes_no, image
- שאלות מותנות (conditional logic)
- UI למטופל למילוי שאלון (responsive)

### עדיפות 7: Admin מלא
- ניהול רופאים (CRUD + הזמנה באימייל)
- ניהול צוות שירות
- דוחות: הכנסות, תורים, AI usage (Recharts)
- הגדרות מרפאה: שעות, מחירים, מדיניות ביטול
- Audit log viewer
- מיתוג: שינוי לוגו + צבעים

### עדיפות 8: LiveKit מלא
- שילוב `@livekit/components-react` אמיתי (לא placeholder)
- Screen sharing
- In-call text chat
- הצגת מסמכי מטופל בזמן שיחה
- הקלטה (אופציונלי, עם הסכמה)

### עדיפות 9: Organization Onboarding
- Wizard להרשמת מרפאה חדשה
- בחירת תוכנית (free/basic/pro/enterprise)
- הגדרת מיתוג (לוגו, צבעים, subdomain)
- הזמנת רופאים
- Stripe subscription billing

## פקודות

```bash
npm run dev          # פיתוח
npm run build        # בדיקת build
npm run lint         # linting
npm run type-check   # TypeScript check
npm run db:types     # generate Supabase types
npm run db:push      # push migrations
```

## Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LIVEKIT_URL=

SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

## סגנון קוד

- TypeScript strict — אל תשתמש ב-`any` (אלא אם באמת אין ברירה)
- `'use client'` רק כשצריך (forms, state, effects)
- Server Components כברירת מחדל
- Zod validation על כל input מהמשתמש
- Error boundaries על כל page
- כל טקסט UI בעברית
- קבצי components קטנים ומפוקסים
- שימוש ב-cn() (clsx + tailwind-merge) לstyles
