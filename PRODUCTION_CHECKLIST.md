# ✅ צ'ק-ליסט פרודקשן — Telemedicine Platform v2

## 1. אבטחה (קריטי)

### Supabase
- [x] RLS מופעל על כל 9 הטבלאות — `002_rls.sql`
- [x] אין service role ב-frontend — `lib/supabase/client.ts` uses `ANON_KEY` only
- [x] Storage buckets private — `medical-documents` set to private
- [x] Tokens: uses `@supabase/ssr` cookie-based, NOT localStorage

### Environment Variables
- [x] `SUPABASE_SERVICE_ROLE_KEY` — server only (`lib/supabase/server.ts`)
- [x] `ANTHROPIC_API_KEY` — server only (`lib/ai/agents.ts`)
- [x] `LIVEKIT_API_SECRET` — server only (edge function)
- [x] `TRANZILA_SECRET` — server only (webhook route)
- [x] Frontend: only `NEXT_PUBLIC_*` vars exposed

## 2. Video Security
- [x] `create-video-room`: validates `Authorization` header
- [x] Checks `doctor_id` / `patient_id` match on appointment
- [x] Does NOT allow join by roomId alone
- [x] CORS: proper origin validation (no `*`)

## 3. AI (HIPAA-style safety)
- [x] No PHI in console.log — only `err.message`
- [x] No `console.log` of medical data
- [x] Timeout: 30 seconds (`lib/ai/agents.ts`)
- [x] try/catch on all AI calls
- [x] AI usage tracked in `ai_conversations` table

## 4. SEO
- [x] metadata in `layout.tsx` — title, description, OpenGraph
- [x] `/sitemap.xml` — auto-generated with specialties
- [x] `/robots.txt` — blocks dashboard pages, allows marketing
- [x] Schema.org structured data (MedicalClinic)
- [x] SSR marketing page for crawlability

## 5. נגישות (Accessibility)
- [x] labels on all inputs — `Input`, `Textarea`, `Select` components
- [x] `dir="rtl"` on root HTML
- [x] aria-label on buttons — video controls, close, upload
- [x] aria-invalid on form errors
- [x] role="alert" on error messages
- [x] role="status" on timer
- [x] focus-visible styling in CSS
- [x] Keyboard navigation: standard HTML forms + buttons

## 6. ביצועים
- [x] Next.js 15 with SSR for marketing
- [x] Client components only where needed (`'use client'`)
- [x] No large JS bundles on marketing page
- [ ] Lighthouse > 90 — verify after deploy
- [ ] images with next/image — implement when images added
- [ ] lazy loading for video — LiveKit handles this

## 7. Auth Flow
- [x] signup → `register/page.tsx`
- [x] login → `login/page.tsx` with validation
- [x] logout → in DashboardLayout header
- [x] session refresh → middleware with `@supabase/ssr`
- [x] redirect by role → middleware `roleHome()`
- [x] password reset → `forgot-password/page.tsx`
- [x] auth callback → `api/auth/callback/route.ts`
- [x] `getUser()` not `getSession()` — secure validation

## 8. Payments
- [x] webhook validates signature (placeholder) — `api/payments/webhook/route.ts`
- [x] double payment protection via `payment_idempotency_key` UNIQUE
- [x] status transitions tracked — `status_history` jsonb
- [ ] Tranzila integration — requires terminal credentials

## 9. Monitoring
- [ ] Sentry — add `@sentry/nextjs` + DSN
- [x] Supabase logs — built-in
- [x] Vercel logs — automatic on deploy
- [ ] Uptime monitor — setup after deploy

## 10. Deployment Sanity
- [x] migrations runnable — `001_schema.sql` + `002_rls.sql`
- [x] no test data in migrations
- [x] no `console.log` of sensitive data
- [x] no TODO in production code
- [x] strict TypeScript types — `tsconfig.json` strict: true

---

## מבנה תיקיות סופי

```
telemed/
├── package.json
├── next.config.js         # Security headers, CSP
├── middleware.ts           # Auth + role routing
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── .env.example
├── .gitignore
│
├── app/
│   ├── layout.tsx          # Root: RTL, SEO, Schema.org
│   ├── globals.css
│   ├── loading.tsx
│   ├── error.tsx
│   ├── global-error.tsx
│   ├── sitemap.ts
│   ├── robots.ts
│   │
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   └── page.tsx        # Landing page SSR
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   │
│   ├── (dashboard)/
│   │   ├── patient/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── new-appointment/page.tsx
│   │   │   └── my-documents/page.tsx
│   │   ├── doctor/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   └── appointments/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   └── dashboard/page.tsx
│   │   └── staff/
│   │       ├── layout.tsx
│   │       └── dashboard/page.tsx
│   │
│   ├── video/[id]/page.tsx
│   │
│   └── api/
│       ├── health/route.ts
│       ├── ai-triage/route.ts
│       ├── ai-summary/route.ts
│       ├── auth/callback/route.ts
│       └── payments/webhook/route.ts
│
├── lib/
│   ├── supabase/client.ts    # Browser (anon key only)
│   ├── supabase/server.ts    # Server + service role
│   ├── ai/agents.ts          # 4 AI agents
│   ├── validation/schemas.ts # Zod schemas
│   └── utils/index.ts        # cn, formatters, constants
│
├── components/
│   ├── ui/index.tsx           # Button, Input, Card, Badge...
│   └── layout/DashboardLayout.tsx
│
├── types/
│   └── database.ts            # Full TypeScript types
│
└── supabase/
    ├── migrations/
    │   ├── 001_schema.sql     # All tables + triggers
    │   └── 002_rls.sql        # All policies + helpers
    └── functions/
        ├── create-video-room/index.ts
        └── send-whatsapp/index.ts
```
