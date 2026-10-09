# CANNA — Production Release & QA Report (2026-10-09)

Production: **https://app.cannaforyou.net** (Vercel project `nfd1/medical`, Supabase project `igkffvtzjkwpjxmldlzh`).
`cannaforyou.net` (apex) is a separate Hostinger site and was not touched.

## 1. Release log

| Step | Result | Evidence |
|---|---|---|
| Target verified before every DB call | PASS | runner refuses unless project ref = `igkffvtzjkwpjxmldlzh` and pooler user matches; every run printed `orgs: 7` |
| Read-only prechecks (019–021) | PASS | 0 double bookings · default org exists · 0 invalid `agent_type` · users 19 patients / 3 doctors / 7 admins |
| Backup | PASS | `backups/canna-prod-public-pre-019-20261009b.dump` (pg_dump 17, public schema, 204 KB). **Restore-verified** in a scratch DB: 105 appointments, 29 users, 7 orgs, 56 RLS policies |
| Hotfix `f22d95c` | Superseded | its Vercel build failed (SDK 0.39 lockfile vs `output_config`); production stayed on `42bd42b`. Every file it changed was checked against the sprint: all present or refactored |
| Clean release build | PASS | `npm ci` + `next build` in a detached worktree of the exact release commit: 114/114 pages, `@anthropic-ai/sdk` 0.127 |
| Tests | PASS | `npm test` 45/45 · `tsc --noEmit` clean |
| Migration 019 (security hardening) | PASS — applied | committed; `public_doctors` view (3 rows), `appointments_doctor_slot_unique` index; 105 appointments intact |
| Migration 020 (AI agent types) | PASS — applied | new `agent_type` check present |
| Migration 021 (audit status trigger) | PASS — applied | committed |
| Deploy sprint `56f1cca` to `medical/main` | PASS | GitHub status `success` "Deployment has completed" (Vercel, 12:22 UTC) |
| Migration 022 (doctor private fields) | **BLOCKED — needs your approval** | written, tested locally; the permission system stopped the production write because it is outside 019–021 |
| Migration 023 (integration secrets re-sweep) | **BLOCKED — needs your approval** | written, tested twice locally (idempotent, keeps replaced value in `_previous`) |
| Rollback | not needed | |

## 2. Production smoke (unauthenticated, 2026-10-09 ~12:30 UTC)

| Check | Result |
|---|---|
| `/` `/doctors` `/auth/login` `/auth/register` `/onboarding` `/robots.txt` `/sitemap.xml` `/opengraph-image` | 200 |
| `/api/health` | 200 `{"status":"healthy","checks":{"supabase":"ok","env":"ok"}}` |
| Copilot route `POST /api/ai/assistant` | 401 (was 404 before — the new build is live) |
| 13 protected API routes without a session (AI, appointments, admin, notifications, documents) | all 401 |
| Security headers | CSP, HSTS (2y, preload), X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy present |
| Anonymous Supabase key (public bundle) against 10 tables incl. `users`, `organizations`, `organization_integrations`, `appointments`, `ai_conversations`, `invitations` | all `[]` |
| `public_doctors` for anonymous | only display columns (name, avatar, specialties, price, rating, bio, languages, availability, `metadata` = vacations only) |
| Doctor emails / phones in public HTML (`/`, `/doctors`) | none |
| Invalid invitation token `/auth/invite/not-a-real-token-123` | "הזמנה לא נמצאה — הקישור אינו תקף" |

## 3. Acceptance matrix

| Item | Status | Evidence / what is missing |
|---|---|---|
| Controlled deployment | PASS | §1 |
| Migrations 019–021 | PASS | §1 |
| Doctor contact-info exposure | **FAIL until 022 is applied** | Any signed-in user can still read doctor rows in `users` (policy `users_select_doctors`). Production doctors currently have no phone/ID/licence stored, but email is exposed. Code no longer depends on that policy (patient screens use `public_doctors`). |
| Integration secrets readable by clinic members | **FAIL until 023 is applied** | מרפאת שלום has `integration_whatsapp/payment/invoice` in `organizations.settings` (written by the old UI). The new build no longer writes there. |
| Tenant isolation (anonymous) | PASS | §2 |
| Tenant isolation (signed-in, cross-clinic) | PASS locally / BLOCKED on prod | Copilot red-team 7/7 locally; needs a prod sign-in |
| Clinic onboarding (prod) | BLOCKED | Wizard is live (video PROD_00). Creating the QA clinic types a password on production — must be done by you |
| Doctor invitation (real email) | BLOCKED | needs an authorized QA inbox + signed-in QA admin |
| Invitation: invalid token | PASS | §2 + video PROD_00 |
| Invitation: expired / duplicate / cross-clinic | PASS locally / BLOCKED on prod | `inviteMember` reuses live tokens, rejects existing staff (409), 403 for non-admins |
| Patient invitation | Defined | Patient "invitation" = the clinic's registration link `/auth/register?org=<clinic id>` + `join-clinic`; 019 honours the org id and always assigns `patient` |
| Booking, states, Israel time, double-booking | PASS locally / prod index PASS | `appointments_doctor_slot_unique` live on prod; flow needs a prod sign-in |
| Consultation → automatic AI summary | PASS locally / BLOCKED on prod | video CANNA_03 (local) |
| Copilot (3 roles, right panel) | PASS locally / route live on prod | videos CANNA_09–11 (local); prod needs sign-in |
| Resend: domain | PASS | `cannaforyou.net` verified |
| Resend: delivery | PASS for real inboxes | last 100 sends: 9 delivered @gmail.com, 6 @usemomentic.com, 3 @resend.dev, 1 bounced |
| Resend: suppression | **BLOCKED (owner)** | 79 of last 100 sends **suppressed** — all to the non-existent demo inboxes @cannaforyou.net. Create the mailboxes, then remove them in Resend → Suppressions |
| Resend: webhook | **BLOCKED (owner)** | no webhook registered in Resend; `RESEND_WEBHOOK_SECRET` not set. Endpoint ready: `https://app.cannaforyou.net/api/email/webhook` |
| Green API | **CONFIGURATION REQUIRED** | no clinic instance exists; per-clinic setup + live check (`check_whatsapp_connection`) ready |
| LiveKit | Not re-tested | two-participant call not tested |
| Payments / invoices | Not connected | Tranzila per-clinic terminal not configured; no charges made |
| Production videos (10) | **1 of 10** | `demo-videos/production/CANNA_PROD_00_public_entry.mp4` (public pages). The other nine need signed-in QA accounts on production |

## 4. What I need from you to finish

1. **Approve 022 + 023 on production** (both re-runnable, backup exists). Then I run them and re-verify.
2. **An authorized QA inbox** (e.g. a Gmail with `+` aliases) for clinic admin / doctor / patient.
3. **Sign in / create the QA accounts yourself in Chrome** on app.cannaforyou.net (I may not type passwords on production). Once you are signed in, I drive and record the rest.
4. **Resend**: create the webhook (events delivered/bounced/complained/suppressed) and put its secret in Vercel as `RESEND_WEBHOOK_SECRET`; clear the demo-inbox suppressions.
5. **Green API**: a clinic instance, if WhatsApp should be shown live.

Rollback reference: redeploy `42bd42b` in Vercel; DB restore from `backups/canna-prod-public-pre-019-20261009b.dump`.
