# CANNA — Production Deployment Plan

Production today: `medical/main` @ `42bd42b` (Copilot route returns 404 there — it was never deployed).
Nothing below has been done; each step needs the owner.

## Step 1 — Critical fixes, no DB change (safe now)
Branch `hotfix/notifications-summaries` (= production + fixes: retired AI model, automatic summaries, email failure reporting, cancellation notifications, WhatsApp errors, doctor isolation in AI routes, SEO routes).
1. Push it to the branch Vercel deploys from (`medical` remote, `main`).
2. Smoke: `/api/health` 200 · `/robots.txt` 200 · sign in as a QA doctor, end a test consultation → summary appears within ~30 s.
Rollback: redeploy `42bd42b` in Vercel.

## Step 2 — Database (Supabase SQL editor)
1. Run `supabase/prechecks/019_021_precheck.sql` (read-only). Query 1 must return **0 rows**; if not, resolve each double booking (cancel or move one) before continuing. Query 2 must be `true`. Query 3 must return 0 rows.
2. Take a backup (Supabase → Database → Backups, or `pg_dump`).
3. Run `019_security_hardening.sql`, then `020_ai_agent_types.sql`, then `021_audit_status_trigger.sql` (each as a whole script; all three are re-runnable).
4. Smoke: register a test patient (lands as patient) · patient books · doctor sees only own patients.
Rollback for 019: restore the backup (policies + view + index); 020/021 are additive.

## Step 3 — Sprint build (Copilot + UX fixes)
Merge `sprint/copilot-2026-10` → `main`, deploy. Requires Step 2 (booking reads `public_doctors`).
Smoke as each role: Copilot panel visible on the right · ask "מתי התור הבא שלי?" / "מי המטופל הבא שלי?" / "תן לי את הדוח החודשי".

## Step 4 — Operations
- Create the demo mailboxes at @cannaforyou.net (or use real inboxes) and remove them from Resend → Suppressions.
- Resend → Webhooks: `https://app.cannaforyou.net/api/email/webhook`, events delivered/bounced/complained/suppressed; set `RESEND_WEBHOOK_SECRET` in Vercel.
- Clinic connects its own Green API instance (Admin → Integrations → WhatsApp), then asks the Copilot "האם ה-Green API שלנו מוגדר נכון?".

## Not in this plan (needs a decision)
- Doctor PII (email/phone/licence) readable by any signed-in user — needs a `doctor_private` table migration.
- Tranzila per-clinic terminal.
- `ops/ai-pilot-local-db-repair.sql` — local machine only, unrelated project; run only if you approve.
