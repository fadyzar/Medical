# CANNA — Fixes and Verification

Sprint: 2026-10-08. Production: https://app.cannaforyou.net, running `medical/main` @ `42bd42b` (verified: routes added after it return 404 in production).

**Nothing below is deployed.** Every item is committed, unit/regression-tested, built, and — where marked — verified end-to-end on a local stack (local Supabase with all migrations 001–021 + a local production build + seeded fictional clinics). Deployment needs owner approval (see "Deployment plan").

| Branch | Base | Contents | Depends on DB migration? |
|---|---|---|---|
| `hotfix/notifications-summaries` | production `42bd42b` | P0/P1 fixes only (AI model, summaries, email, WhatsApp, isolation, SEO) | No (020/021 optional) |
| `sprint/copilot-2026-10` | local `main` | everything + CANNA Copilot + UX fixes | **Yes — 019** (booking reads `public_doctors`) |

Legend: **L** = verified locally in a real browser + DB · **T** = automated test · **B** = builds · **P** = observed in production

---

## P0 — Critical

### F0. Every clinical AI feature dead in production — retired model · **L T B**
`claude-sonnet-4-20250514` returns `404 not_found_error`. Summaries, triage, prescription drafts, intake, AI documents and pre-visit briefs all failed — the deepest reason Oshrit never saw an automatic summary. Reproduced locally (ending a consultation logged the 404).
Fix: `lib/ai/models.ts` (only place model ids live); clinical calls on `claude-sonnet-5-5` at effort `low`; temperature removed (rejected by that model); replies read by block type (`content[0]` is a thinking block); refusals handled; the orchestrator's 30 s timeout is actually applied now.
Verified: summary + brief generated, tokens recorded. Branches: both.

### F1. Automatic summaries could never run · **L T B**
- Video-call end posted `action:'summarize'` → schema accepts only `'summary'` → 400 every time.
- The request was an un-awaited fetch → frozen by Vercel after the response.
- Doctor's "סיים ייעוץ" button never requested a summary.
Fix: `lib/ai/summary.ts` shared function; `/api/appointments/complete` atomic claim + `after()`; doctor button routes through it; patient gets exactly one message (summary, or "consultation ended" if AI failed); duplicate prevention.
Verified: doctor ends consultation → SOAP summary saved → patient sees "סיכום ייעוץ מד"ר …". Video 3. Branches: both.

### F2. Email failures reported as success; reminders never retried · **T B** (+ provider evidence)
`notify()` set `email:true` regardless; `sendEmail` never throws so the cron's revert/retry was dead; manual summary email always "succeeded". Fixed. Branches: both.

### F3. "Emails don't arrive" — root cause found (operations) · **P**
Resend shows production sending normally (cron running), domain verified, real inboxes **delivered**, but **78/100 recent emails suppressed** — the demo mailboxes `pa***@ / do***@ / sv***@cannaforyou.net` bounced once and are blocked. Needs mailbox creation + suppression removal (owner action). See CANNA_INTEGRATIONS_STATUS.md §1.

### F4. CANNA Copilot 100% broken · **L T B**
Every request → "שגיאה בשירות ה-AI": tool schema had `null` inside an enum, 18 nullable params (API limit 16 for strict tools), and appointment types the DB rejects. Fixed. Sprint branch.

## P1 — High

| # | Defect | Fix | Evidence | Branch |
|---|---|---|---|---|
| F5 | Cancellation sent no notification | patient + assigned doctor notified (`notifyCancellation`), `cancelled_by` recorded | L T | both |
| F6 | WhatsApp summary gated on retired Infobip key | uses clinic's Green API | T | both |
| F7 | Doctor could get a colleague's patient's history/ID via AI brief & AI document | restricted to assigned doctor (matches RLS) | L T (red-team) | both |
| F8 | Notification trigger routes: any user could fire for any appointment | ownership checks | L (14 API attacks → 403) T | both |
| F9 | Copilot history trim could orphan a tool_result → conversation permanently 400 | trim at plain user turn | T | sprint |
| F10 | Copilot cancel/book: doctor not notified; staff booking told patient "request received" | shared `notifyCancellation` / `notifyBooking` | L T | sprint |
| F11 | Staff screen cancelled/rescheduled straight from the browser (no conflict check, no notification, no audit) | goes through server routes | T B | sprint |
| F12 | Green API 401 (empty body) shown as "שגיאה פנימית"; failed sends logged as JSON errors | clear Hebrew reason | L (Video 8) | both |
| F13 | AI briefs + generated documents never recorded for billing (CHECK constraint) | **migration 020** | L | both (file) |
| F14 | Audit trigger attributed server-side changes to the patient, in English | **migration 021** + completion audit with real actor | L | sprint (021 file on both) |
| F15 | robots.txt / sitemap.xml / OG image redirected to login (SEO, link previews) | public in middleware | P (reproduced) T | both |

## P2 — UX / quality (sprint branch)

- AI pre-visit brief rendered as raw markdown → formatted (shared `Markdown`, GFM tables). L
- Specialties/languages shown as raw codes (`general`, `he, en`) → Hebrew. L
- Doctor screen offered "create AI summary" while the automatic one was still being written (double billing) → waits and shows "סיכום AI בהכנה…". T
- Staff schedule form + admin 14-day chart used UTC dates (late-evening shifted a day). T
- Copilot: launcher hidden under the accessibility button; panel's send button covered; smooth-scroll stopped short; English narration ("I'll check the details"); answer truncated to last round; lists not refreshed after an action; gender guessed from name. All fixed. L
- Mobile: floating buttons covered the dashboard bottom navigation. Fixed (verified at 390 px before the fix; fix built, not re-screenshotted).
- PHI in browser console (AI brief) removed.
- Admin invite: if email fails the invitation still exists and the admin gets the link (was a dead error). L
- Admin email test now reports *delivered / suppressed / bounced*, not just "sent". L (real Resend round-trip, Video 5)
- New: Resend delivery webhook (`/api/email/webhook`, signature-verified).

## Checks (final run, sprint branch `5874b9c`)

| Check | Result |
|---|---|
| `npm test` | **43/43 pass** |
| `npx tsc --noEmit` | pass |
| `npm run lint` | 0 errors, 75 warnings (73 pre-existing) |
| `next build` | pass (114 pages) |
| Copilot red-team (`scripts/qa/assistant-redteam.mjs`, local) | **7/7 pass** |
| Hotfix branch (`f22d95c`): tests / tsc / build | 24/24 · pass · pass (112 pages) |

## Not fixed — documented

- **P1 privacy (known, in TODO):** any signed-in user can read every doctor's email/phone/license number via the `users` table (verified with a patient token). Needs the planned `doctor_private` table migration.
- **Payments:** per-clinic Tranzila supplier ignored; global env terminal with `'demo'` fallback. Out of scope without approval.
- Lint warnings (75, mostly hooks deps) — not behavioural.

## Deployment plan (needs owner approval)

1. **Now, production-safe:** deploy `hotfix/notifications-summaries` (push to the remote Vercel deploys from — `medical/main` matches production). No migration dependency. Then smoke: `/api/health`, robots.txt 200, doctor ends a test consultation → summary appears.
2. In Supabase SQL editor: run **019**, **020**, **021** (in order). Smoke: registration, booking, doctor screen.
3. Deploy `sprint/copilot-2026-10` (merge into main). Smoke: Copilot question as each role.
4. Ops: create the demo mailboxes / remove Resend suppressions; add Resend webhook + `RESEND_WEBHOOK_SECRET`.
