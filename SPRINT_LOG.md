# CANNA Sprint — Backlog & Progress Log

Branch: `sprint/copilot-2026-10` (from `main` @ 154ca93). Started 2026-10-08.

## Ground rules for this sprint
- Production = `medical/main` @ 42bd42b. **Nothing on this branch is deployed.** Deploying needs owner approval.
- Migration 019 is NOT applied in production (verified: `public_doctors` → PGRST205). Any code reading `public_doctors` or relying on 019 must not ship before it is applied.
- No passwords typed into production; no real patient messages. QA runs against a **local Supabase stack** with seeded fake users.

## Backlog (priority order)

| # | Item | Status |
|---|---|---|
| 1 | Local QA stack: local Supabase + all migrations + seed (2 clinics, admin, 2 doctors, patients) | in progress |
| 2 | Re-verify critical fixes end-to-end locally (auto summary, email logging, cancel notify, reminders) | todo |
| 3 | Copilot: history trim can orphan a tool_result → API 400 | todo |
| 4 | Copilot: notification parity (assistant cancel → doctor; staff booking → "scheduled" not "request") | todo |
| 5 | Copilot: navigation tool (allowlisted routes per role) + page context | todo |
| 6 | Copilot: admin tools — clinic/integration status, invite doctor (confirm), reports summary | todo |
| 7 | Copilot: doctor tools — generate/regenerate summary (confirm, professional review) | todo |
| 8 | Copilot: patient tools — my documents, how to prepare | todo |
| 9 | Copilot UI: reopened conversation shows history, nav buttons, retry, mobile | todo |
| 10 | Copilot security tests: injection, unauthorized tool, cross-tenant, confirm bypass | todo |
| 11 | Staff appointments page bypasses server rules/notifications (direct status writes) | todo |
| 12 | Admin "missing configuration" warnings (WhatsApp, payments, email) | todo |
| 13 | Demo videos (MP4) | todo |
| 14 | Reports: QA, integrations, demo guide, Hebrew summary | todo |

## Progress log
- 01:40 Branch created. Docker (Colima) installed. Local Supabase starting.
