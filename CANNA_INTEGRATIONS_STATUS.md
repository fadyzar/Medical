# CANNA — Integrations Status

Date: 2026-10-08. Production: https://app.cannaforyou.net (build `42bd42b`).
Evidence levels: **Verified in production** · **Verified locally** (local Supabase + local build, fake data) · **Code-reviewed only** · **Not verified**.

| Integration | Owner model | Status | Evidence |
|---|---|---|---|
| Email (Resend) | CANNA-managed | **WORKING — but demo inboxes are blocked** | see §1 |
| AI (Anthropic) | CANNA-managed | **BROKEN in production → fixed, awaiting deploy** | see §2 |
| WhatsApp (Green API) | Per clinic | **READY — CLINIC CONFIGURATION REQUIRED** | see §3 |
| Video (LiveKit) | CANNA-managed | Not verified (needs two live participants) | §4 |
| Payments (Tranzila) | Per clinic (by design) | **Not wired per clinic** — out of sprint scope | §5 |
| Invoices (Green Invoice) | CANNA-managed | Code-reviewed only | §6 |
| Domains (Hostinger DNS + Vercel) | CANNA automation | UI verified locally; provisioning not exercised | §7 |
| Reminder cron (Vercel) | CANNA-managed | **Running in production** | §1 |

## 1. Email — Resend

**Provider-side facts (queried from the Resend API with the project's key, 2026-10-08):**
- Sending domain `cannaforyou.net`: **verified** (region ap-northeast-1). DKIM/SPF/MX records on `send.cannaforyou.net` are public and correct.
- Test sends to Resend's sandbox (`delivered@resend.dev`) from both `notifications@` and `noreply@cannaforyou.net`: **accepted → delivered**.
- Last 100 emails sent by production (Oct 1–7): reminders, booking confirmations, doctor requests, payment confirmations, summaries.
  - **78 suppressed** — all to the demo accounts `pa***@`, `do***@`, `sv***@cannaforyou.net`.
  - Delivered to real Gmail inboxes (e.g. staff invitations, "Confirm your signup").
- The reminder cron **is running** in production (24h / 1h reminders every 30 min), so `CRON_SECRET` is set and the plan supports the schedule.

**Diagnosis of "emails don't arrive":** the system sends; the demo mailboxes at `@cannaforyou.net` do not accept mail (domain MX is Hostinger), they bounced once, and Resend now suppresses every message to them. Anyone testing with those accounts will never receive email.

**Code defects found and fixed (not yet deployed):** email reported as sent even when Resend rejected it; reminder failures never retried; cancellations sent nothing; manual summary email reported success unconditionally.

**Added:** delivery tracking — Resend webhook (`/api/email/webhook`, signature-verified) updates each notification to delivered / bounced / suppressed; the admin "send test email" now shows the real outcome.

**Action for the owner:**
1. Create real mailboxes for the demo addresses in Hostinger (or point demo accounts at real inboxes), then remove them from Resend → Suppressions.
2. Resend → Webhooks → add `https://app.cannaforyou.net/api/email/webhook` (events: delivered, bounced, complained, suppressed) and set `RESEND_WEBHOOK_SECRET` in Vercel.
3. Note: the Resend account also sends for other products (mgbit.io, Momentic) — their bounces affect shared reputation.

## 2. AI — Anthropic

- `claude-sonnet-4-20250514` is **retired**: the API returns `404 not_found_error`. In production **every** clinical AI feature fails: automatic and manual summaries, triage, prescription drafts, intake, AI documents, pre-visit briefs.
- Fixed: one model constant (`lib/ai/models.ts`), clinical calls on `claude-sonnet-5-5`, thinking-aware parsing, refusal handling. **Verified locally:** summary generated (266 in / 573 out tokens), brief generated, usage recorded.
- AI usage for briefs/documents was never recorded (DB CHECK constraint) → migration 020.
- The CANNA Copilot uses `claude-opus-5` (served). Verified locally.

## 3. WhatsApp — Green API (per clinic)

- Credentials live in `organization_integrations` (admin-only RLS); read server-side only, per organization. **Verified:** an anonymous REST read returns no rows; the Copilot's status tool reports only "configured / not configured".
- Admin UI: setup guide, Instance ID + masked token, test send. **Verified locally** with deliberately fake credentials: Green API rejects (401) and the UI now explains why (previously "internal error").
- Notifications use the clinic's own instance; if unconfigured, the event is skipped and email + in-app still go out.
- **No authorized real Green API instance or test phone was available → real WhatsApp delivery NOT verified.**
- Verdict: **READY — CLINIC CONFIGURATION REQUIRED.**

## 4. Video — LiveKit
Token route requires an authenticated participant of the appointment. Ending a call triggers `/api/appointments/complete` → automatic summary (verified via the doctor's "end consultation", which uses the same route). A two-party live call was not tested.

## 5. Payments — Tranzila
`/api/payments/create-session` uses a single global `TRANZILA_TERMINAL_NAME` env var and falls back to the terminal name `'demo'`; the clinic's own Tranzila supplier saved in Integrations is **not used**. This contradicts the per-clinic design. Not changed (payments runtime out of scope without approval). No real payments executed.

## 6. Invoices — Green Invoice
Called from the payment webhook after a successful payment. Not exercised (no payments).

## 7. Domains
Subdomain request card (Admin → Settings) verified visually locally. "Activate domain" calls the real Hostinger DNS API and was deliberately **not** clicked during QA.
