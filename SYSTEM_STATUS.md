# מצב המערכת — Telemed SaaS Platform
> עדכון אחרון: אפריל 2026

---

## 🏗️ ארכיטקטורה כללית

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 16)                   │
│  Patient │ Doctor │ Admin │ Staff │ Marketing │ Onboarding  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│                   API ROUTES (21 routes)                     │
│  AI │ Video │ Payments │ Email │ Auth │ Admin │ Cron        │
└──────┬───────┬───────────┬────────────────────────────────┘
       │       │           │
┌──────▼──┐  ┌─▼──────┐  ┌▼────────────────────────────────┐
│Supabase │  │LiveKit │  │    Third-party Services          │
│ Postgres│  │ Video  │  │ Anthropic │ Tranzila │ Stripe    │
│  Auth   │  │        │  │ Resend    │ Infobip  │ GreenInv. │
│ Storage │  │        │  └─────────────────────────────────┘
│   RLS   │  │        │
└─────────┘  └────────┘
```

---

## ✅ מה קיים במערכת

### 📦 שרתים ותשתית
| שירות | סטטוס | הערות |
|-------|--------|-------|
| **Supabase (PostgreSQL)** | ✅ פעיל | `igkffvtzjkwpjxmldlzh.supabase.co` |
| **Supabase Auth** | ✅ פעיל | Email confirmation מופעל |
| **Supabase Storage** | ✅ פעיל | Buckets: avatars, logos, medical-documents, org-assets |
| **Supabase RLS** | ✅ פעיל | 13 migrations, multi-tenant isolation |
| **Next.js 16 (Vercel-ready)** | ✅ מקומי | localhost:3000 |
| **LiveKit Video** | ⚠️ קוד מוכן | חסרים API keys אמיתיים |
| **Anthropic Claude** | ✅ פעיל | claude-sonnet-4-20250514, API key מוגדר |

---

### 🗄️ מסד נתונים — טבלאות
| טבלה | תיאור |
|------|-------|
| `organizations` | מרפאות — multi-tenant root |
| `users` | מטופלים, רופאים, צוות, מנהלים |
| `appointments` | תורים עם 14 statuses |
| `documents` | מסמכים רפואיים |
| `questionnaires` | שאלונים דינמיים |
| `questionnaire_responses` | תשובות מטופלים |
| `notifications` | log של כל ההודעות שנשלחו |
| `ai_conversations` | log של כל קריאות AI |
| `audit_logs` | HIPAA audit trail |
| `payments` | עסקאות תשלום |
| `leads` | ניהול לידים |

---

### 🤖 שכבת AI — מה קיים

#### Agents (`lib/ai/agents.ts`)
| Agent | תפקיד | Model | מוכן? |
|-------|-------|-------|-------|
| `triageAgent` | מיון דחיפות 1-10 + המלצת התמחות | claude-sonnet | ✅ |
| `summaryAgent` | סיכום SOAP אחרי ייעוץ | claude-sonnet | ✅ |
| `prescriptionAgent` | טיוטת מרשם + בדיקת אלרגיות | claude-sonnet | ✅ |
| `intakeAgent` | שאלון קליטה דינמי | claude-sonnet | ✅ |

#### Orchestrator (`lib/ai/orchestrator.ts`)
| פונקציה | תיאור | גישה |
|---------|-------|------|
| `orchestrate()` | dispatcher מרכזי עם RBAC | כולם |
| `runTriageAgent()` | triage עם context | patient, staff, admin |
| `runBriefAgent()` | בריף לפני ביקור | doctor, admin |
| `runSummaryAgent()` | סיכום אחרי ביקור | doctor, admin |
| `runLeadAnalysisAgent()` | ניתוח איכות ליד | staff, admin |
| `detectIntent()` | זיהוי intent מטקסט חופשי | כולם |
| Red flag detection | זיהוי חירום רפואי | אוטומטי |

#### RBAC לסוכני AI
```
triage     → patient, staff, admin
brief      → doctor, admin
summary    → doctor, admin  
prescription → doctor, admin
intake     → patient, staff, admin
document   → doctor, admin
lead_analysis → staff, admin
```

---

### 💳 תשלומים — מה קיים

| מרכיב | תיאור | סטטוס |
|-------|-------|--------|
| **Tranzila iframe** | תשלום חד-פעמי עבור ייעוץ | ⚠️ קוד מוכן, חסר `TRANZILA_TERMINAL_NAME` |
| **Tranzila webhook** | קבלת אישור תשלום | ⚠️ קוד מוכן, חסרת credentials |
| **Idempotency key** | מניעת כפל חיוב | ✅ |
| **Green Invoice** | יצירת קבלה (חשבוניות) | ⚠️ קוד מוכן, חסר API keys |
| **Stripe Checkout** | תשלום subscription מרפאה | ⚠️ קוד מוכן, חסרת price IDs |
| **Stripe Portal** | ניהול מנוי ע"י מרפאה | ⚠️ קוד מוכן |
| **Stripe Webhook** | עדכון סטטוס מנוי | ⚠️ קוד מוכן |
| **Refund API** | החזר כספי | ✅ קוד מוכן |

---

### 📧 התראות — מה קיים

| ערוץ | ספק | מה נשלח | סטטוס |
|------|-----|---------|--------|
| **Email** | Resend | אישור תור, תזכורת 24h, תזכורת 1h, סיכום ביקור | ⚠️ חסר `RESEND_API_KEY` |
| **WhatsApp** | Infobip | אישור תור, תזכורת 1h + קישור וידאו, אישור תשלום | ⚠️ חסר Infobip keys |
| **Cron** | `/api/cron/reminders` | מריץ reminder 24h + 1h אוטומטית | ⚠️ חסר `CRON_SECRET` + job scheduler |

---

### 🎥 וידאו — מה קיים

| מרכיב | סטטוס |
|-------|--------|
| LiveKit token generation | ✅ קוד מוכן |
| Waiting room + hardware check | ✅ |
| Video call UI (components-react) | ✅ |
| Screen sharing | ✅ |
| In-call chat | ✅ |
| Recording + consent dialog | ✅ קוד מוכן |
| Patient documents panel during call | ✅ |
| Connection quality indicator | ✅ |
| **LiveKit API keys** | ❌ חסרים `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` |

---

### 🏥 זרימת תור (Appointment Flow)

```
patient creates → [pending]
  ↓ doctor sees + schedules
[scheduled]
  ↓ patient pays
[payment_pending] → [paid] → [scheduled] → [ready]
  ↓ video starts
[in_progress]
  ↓ video ends
[completed]
  → AI summary generated
  → Invoice created
  → Summary email sent
```

**statuses מלאים:** draft, pending, doctor_confirmed, time_selected, payment_pending, paid, scheduled, ready, in_progress, completed, cancelled_patient, cancelled_doctor, no_show_patient, no_show_doctor

---

### 📱 דפים לפי תפקיד

#### מטופל (7 דפים)
- dashboard, appointments, new-appointment, questionnaire, payment, profile, my-documents

#### רופא (7 דפים)
- dashboard, appointments (SOAP notes), calendar, availability, patients, questionnaires, profile

#### מנהל (11 דפים)
- dashboard, appointments, users, leads, billing, settings, audit-log, reports, integrations, templates, questionnaires

#### צוות (3 דפים)
- dashboard, appointments, leads

#### ציבורי (12 דפים)
- marketing, doctors, specialties, blog, onboarding, auth (login/register/forgot/reset), privacy, terms

---

## ❌ מה חסר — לפי עדיפות

### 🔴 עדיפות 1: Custom Domain לכל מרפאה
**הבעיה:** כל מרפאה צריכה להיות נגישה ב-`clinic-name.telemed.co.il` או דומיין משלה.
**מה חסר:**
- `middleware.ts` לא מנתב לפי subdomain
- אין UI להוספת custom domain
- אין DNS verification flow
- אין Vercel domain API integration (או Nginx / Cloudflare Workers)

**מה צריך לבנות:**
```
1. middleware.ts → זיהוי subdomain מה-Host header
2. DB: organizations.custom_domain + organizations.subdomain (כבר יש)
3. API route: /api/admin/domain → הוסף/אמת domain
4. Admin UI: הגדרת domain + הוראות DNS
5. SSL: Vercel Domains API / Let's Encrypt
```

---

### 🔴 עדיפות 2: Environment Variables — Services לא מחוברים
```env
# חסרים לחלוטין:
TRANZILA_TERMINAL_NAME=
TRANZILA_API_KEY=

RESEND_API_KEY=

INFOBIP_API_KEY=
INFOBIP_BASE_URL=
INFOBIP_WHATSAPP_NUMBER=

GREEN_INVOICE_API_KEY=
GREEN_INVOICE_API_SECRET=

LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=

STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=
STRIPE_PRICE_PRO=
STRIPE_PRICE_ENTERPRISE=

CRON_SECRET=
```

---

### 🟡 עדיפות 3: Subdomain Routing Middleware

**הקובץ הנוכחי (`middleware.ts`) עושה:**
- Auth check + role routing
- Session refresh

**מה צריך להוסיף:**
```typescript
// זיהוי org לפי subdomain
const host = req.headers.get('host') // e.g. "harofeh.telemed.co.il"
const subdomain = host.split('.')[0]  // "harofeh"

// שליפת org_id לפי subdomain
// העברה כ-header לכל ה-routes
```

---

### 🟡 עדיפות 4: Stripe Subscription Flow מלא

**מה חסר:**
- Price IDs אמיתיים ב-`lib/config/plans.ts`
- UI לשדרוג/שינוי תוכנית מתוך billing page
- Webhook מטפל ב-`subscription.deleted` → השבתת org
- Trial expiry enforcement בממשק

---

### 🟡 עדיפות 5: Cron Jobs / Task Scheduler

**מה חסר:**
- הגדרת Cron job ב-Vercel/Supabase שיקרא ל-`/api/cron/reminders` כל שעה
- `CRON_SECRET` env var
- Retry mechanism לשליחת emails שנכשלו

---

### 🟢 עדיפות 6: שיפורי UX קיים

| פיצ'ר | מצב |
|-------|-----|
| Patient email confirmation → profile completion | ⚠️ חלקי (callback מוכן) |
| Doctor — license number update after registration | ⚠️ יש profile page |
| WhatsApp opt-in UI | ❌ חסר |
| Notification preferences per patient | ❌ חסר |
| Payment receipt download | ✅ (invoice_url) |
| Multi-language support | ❌ עברית בלבד |

---

## 📋 Environment Variables — מצב מלא

| Variable | מצב | נדרש ל |
|----------|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ מוגדר | DB connection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ מוגדר | DB client |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ מוגדר | Server operations |
| `DATABASE_PASSWORD` | ✅ מוגדר | CLI migrations |
| `NEXT_PUBLIC_APP_URL` | ✅ מוגדר | localhost:3000 |
| `ANTHROPIC_API_KEY` | ✅ מוגדר | AI agents |
| `LIVEKIT_API_KEY` | ❌ placeholder | Video calls |
| `LIVEKIT_API_SECRET` | ❌ placeholder | Video calls |
| `NEXT_PUBLIC_LIVEKIT_URL` | ❌ placeholder | Video calls |
| `TRANZILA_TERMINAL_NAME` | ❌ חסר | תשלומי מטופלים |
| `TRANZILA_API_KEY` | ❌ חסר | תשלומי מטופלים |
| `RESEND_API_KEY` | ❌ חסר | Email notifications |
| `GREEN_INVOICE_API_KEY` | ❌ חסר | חשבוניות |
| `GREEN_INVOICE_API_SECRET` | ❌ חסר | חשבוניות |
| `INFOBIP_API_KEY` | ❌ חסר | WhatsApp |
| `INFOBIP_BASE_URL` | ❌ חסר | WhatsApp |
| `INFOBIP_WHATSAPP_NUMBER` | ❌ חסר | WhatsApp |
| `STRIPE_SECRET_KEY` | ❌ חסר | Subscription billing |
| `STRIPE_WEBHOOK_SECRET` | ❌ חסר | Subscription billing |
| `CRON_SECRET` | ❌ חסר | Automated reminders |

---

## 🗺️ מפת פיתוח — השלבים הבאים

### שלב א: חיבור שירותים (לא קוד, רק keys)
1. LiveKit account → `LIVEKIT_API_KEY` + `SECRET` + `URL`
2. Resend account → `RESEND_API_KEY`
3. Infobip account → WhatsApp keys
4. Tranzila terminal → `TERMINAL_NAME` + `API_KEY`
5. Green Invoice → API keys
6. Stripe → keys + create products/prices

### שלב ב: Custom Domain / Subdomain Routing
1. עדכון `middleware.ts` לנתב לפי subdomain
2. Admin UI להגדרת domain
3. DNS instructions UI
4. Vercel domains API (או CloudFlare)

### שלב ג: Cron + Automation
1. הגדרת Cron ב-Vercel (`vercel.json`)
2. `CRON_SECRET` env var
3. Automated reminder testing

### שלב ד: Stripe Subscription Flow
1. יצירת Products + Prices ב-Stripe dashboard
2. עדכון price IDs ב-`lib/config/plans.ts`
3. Upgrade/downgrade UI
4. Webhook enforcement

### שלב ה: Production Deploy
1. Domain + SSL
2. Supabase production project (או scale up)
3. Environment variables בVercel
4. Monitoring + error tracking (Sentry)

---

## 📊 סיכום סטטיסטי

| קטגוריה | מספר | שורות קוד |
|---------|------|-----------|
| API Routes | 21 | ~2,200 |
| Pages | 41 | ~8,000 |
| Lib/Utils files | 14 | ~3,200 |
| SQL Migrations | 13 | ~935 |
| Components | ~20 | ~1,500 |
| **סה"כ** | **~100 קבצים** | **~15,000+** |

**אחוז מוכנות: ~75%**
- קוד: 90% מוכן
- שירותים מחוברים: 35% (Supabase + Anthropic בלבד)
- Production-ready: 0% (חסר deployment + domain)
