# CANNA Sprint — Backlog & Progress Log

Branch: `sprint/copilot-2026-10` (from `main` @ 154ca93). Started 2026-10-08.

## Ground rules for this sprint
- Production = `medical/main` @ 42bd42b. **Nothing on this branch is deployed.** Deploying needs owner approval.
- Migration 019 is NOT applied in production (verified: `public_doctors` → PGRST205). Any code reading `public_doctors` or relying on 019 must not ship before it is applied.
- No passwords typed into production; no real patient messages. QA runs against a **local Supabase stack** with seeded fake users.

## Backlog (priority order)

| # | Item | Status |
|---|---|---|
| 1 | Local QA stack: local Supabase + all migrations + seed (2 clinics, admin, 2 doctors, patients) | done |
| 2 | Re-verify critical fixes end-to-end locally (auto summary, email logging, cancel notify, reminders) | summary done; email/reminders pending |
| 3 | Copilot: history trim can orphan a tool_result → API 400 | done |
| 4 | Copilot: notification parity (assistant cancel → doctor; staff booking → "scheduled" not "request") | done |
| 5 | Copilot: navigation tool (allowlisted routes per role) + page context | done |
| 6 | Copilot: admin tools — clinic/integration status, invite doctor (confirm), reports summary | done |
| 7 | Copilot: doctor tools — generate/regenerate summary (confirm, professional review) | done |
| 8 | Copilot: patient tools — my documents, how to prepare | done |
| 9 | Copilot UI: reopened conversation shows history, nav buttons, retry, mobile | done |
| 10 | Copilot security tests: injection, unauthorized tool, cross-tenant, confirm bypass | done |
| 11 | Staff appointments page bypasses server rules/notifications (direct status writes) | todo |
| 12 | Admin "missing configuration" warnings (WhatsApp, payments, email) | todo |
| 13 | Demo videos (MP4) | todo |
| 14 | Reports: QA, integrations, demo guide, Hebrew summary | todo |

## Progress log
- 01:40 Branch created. Docker (Colima) installed. Local Supabase starting.
- 02:00 FOUND: claude-sonnet-4-20250514 retired (404) — every clinical AI feature dead in prod. Fixed (claude-sonnet-5-5), verified locally, ported to hotfix branch.
- 02:05 FOUND: Copilot 100% broken (invalid tool schemas). Fixed.
- 02:10 INCIDENT: Supabase CLI hit another local project (ai-pilot) on :54322 and applied CANNA migrations 001-010 into its dev DB. Repair script prepared + dry-run verified (rolled back); awaiting owner approval. Local CANNA stack moved to :553xx.
- 02:20 Automatic summary verified end-to-end locally (doctor ends consultation -> SOAP saved -> patient notified).
- 02:40 Copilot upgrade: navigation, clinic status/report, invite, summary drafts, docs; streaming UI; verified in browser (doctor + admin).
- 03:00 Security: 14 API attacks + RLS direct access + 3 chat injections + 7 scripted red-team checks — all blocked. Known P1: doctor PII readable by any signed-in user (needs doctor_private migration).
