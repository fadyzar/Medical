# CANNA — Production Acceptance Report

Production app: **https://app.cannaforyou.net**. Supabase project `igkffvtzjkwpjxmldlzh`.
QA clinic: **מרפאת QA הדגמה**, id `c0f2bda2-…`, subdomain `qa-demo`. QA inbox: Gmail aliases `fadyzarka978+canna-*`.
Status as of 12 Oct 2026. Every row in §1 was checked against production, not against a local copy.

## 1. Production tests executed

| # | Test | Result | Evidence |
|---|---|---|---|
| P1 | Sprint release `56f1cca` deployed through the existing Vercel project | PASS | GitHub/Vercel status `success` |
| P2 | Fix `f4e2f11` (invitation first name) deployed | PASS | Vercel status `success` |
| P3 | Migrations 019, 020, 021, 022, 023, 024 applied after prechecks and backups | PASS | target ref checked on every run; 105 appointments and 29 users unchanged |
| P4 | Schema contains every object from migrations 001–024 | PASS | the only gap is `invitations_token_idx`, which is redundant with the unique `token` key |
| P5 | Every public table has RLS enabled | PASS | `tables_without_rls = 0` |
| P6 | `users_select_doctors` removed; doctor rows no longer readable by patients | PASS | policy list on production |
| P7 | No integration credentials left in `organizations.settings` | PASS | `secret_keys_in_settings = 0` |
| P8 | Invitations readable only by the clinic admin; no client writes | PASS | the only policy is `invitations_admin_select` (SELECT) |
| P9 | Public pages, `/api/health`, robots, sitemap, OG image | PASS | HTTP 200; health `supabase: ok` |
| P10 | 13 protected API routes without a session | PASS | all 401 |
| P11 | Copilot route deployed | PASS | 401 without a session (404 before the release) |
| P12 | Anonymous key against 10 tables (users, organizations, integrations, appointments, invitations, …) | PASS | all return `[]` |
| P13 | `public_doctors` exposes display columns only; no doctor email or phone in public HTML | PASS | column list; HTML scan |
| P14 | Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | PASS | response headers |
| P15 | Reminder cron protected and running | PASS | 401 without the secret; real reminder sends recorded on 7–8 Oct |
| P16 | Clinic onboarding: organization created | PASS | Pro plan, trial status, nothing charged; branding colours stored; video 01 |
| P17 | Founder becomes clinic **admin** (019 ignores the role in signup metadata) | PASS | `users.role = admin` |
| P18 | Onboarding writes audit entries | PASS | `ORGANIZATION_CREATED`, `user_invited` |
| P19 | Clinic subdomain provisioned | PASS | DNS CNAME to Vercel; `https://qa-demo.cannaforyou.net` returns 200. The stored `domain_status` stays `vercel_added` until the admin domain card re-checks it |
| P20 | Welcome email | PASS | Resend status `delivered` to `+canna-admin` |
| P21 | Doctor invitation email | PASS | Resend `delivered`; found in Gmail; branded with the clinic name; inviter נועה בדיקה |
| P22 | Invitation link is valid and bound to the QA clinic | PASS | token → מרפאת QA הדגמה, role doctor, unused, expires 17 Oct |
| P23 | Invitation page shows the correct clinic and role, with the email address locked | PASS | video 01 |
| P24 | Invalid invitation token | PASS | "הזמנה לא נמצאה" page; video 00 |
| P25 | Resend sending domain `cannaforyou.net` | PASS | verified |
| P26 | AI model used for summaries exists for the production key | PASS | `claude-sonnet-5-5` 200; the old `claude-sonnet-4-20250514` 404 |
| P27 | Email to a real inbox | PASS | Resend `delivered` 19/19 to Gmail recipients in the last 100 sends |
| P28 | Email to a missing mailbox is reported as failed, not "sent" | PASS | demo admin test email → "bounce — the address does not exist"; video 03 |
| P29 | WhatsApp credentials of מרפאת שלום restored (migration 025) | PASS | backup `pre-025-20261011`; fields 10/50 characters as before 023; integrations page shows "מחובר" |
| P30 | WhatsApp reaches Green API with the clinic's credentials | PASS | after fixes `f91b873`/`c74a95d` Green API answers; state: credentials valid, WhatsApp account **not linked** (QR); video 04 |
| P32 | Scheduled delivery reconciliation (cron, no webhook) | PASS | run at 20:00 UTC on 11 Oct settled every recent email: 2 `delivered` (Gmail), 4 `failed` with the reason (missing demo mailboxes) |
| P33 | Admin sees the clinic's pending invitations (migration 024) | PASS | users page lists "הזמנות ממתינות (3)" for the demo admin; video 05 |
| P34 | Admin Copilot confirmed action: invite a doctor | PASS | confirmation card → "בוצע"; invitation row bound to the clinic; audit `user_invited`; email arrived in the Gmail inbox of `+canna-doctor2`; video 06 |
| P35 | Admin Copilot refuses another clinic's data and a mass deletion | PASS | answers that it has no access to the other clinic and that deleting all appointments is not allowed; video 06 |
| P31 | Admin Copilot in production: Hebrew, live clinic data, live integration checks, navigation buttons, conversation stored | PASS | demo admin of מרפאת שלום; `ai_conversations` row (`claude-opus-5`); video 04 |

## 2. Video library

Folder `/Users/fadyzarka/Desktop/OSHIASHURI/demo-videos/`. **production/** = recorded on app.cannaforyou.net. **qa-local/** = recorded on a local copy of the system with fictional data; demonstration only, not production evidence. Phone numbers are masked on screen; no passwords or real medical data appear.

| Agreed functionality | Production video | QA video (labeled) |
|---|---|---|
| Public site, clinic signup, patient registration page | `production/CANNA_PROD_00_public_entry.mp4` (0:06) | — |
| Clinic registration and activation, doctor invitation email | `production/CANNA_PROD_01_clinic_onboarding.mp4` (0:57) | — |
| Doctor registration, clinic assignment, availability | **missing**: QA doctor not registered | — |
| Email delivery and bounce reporting | `production/CANNA_PROD_03_email_delivery_truth.mp4` (0:08) | `qa-local/QA_LOCAL_05_email_delivery.mp4` |
| WhatsApp integration status (credentials valid, account not linked) | `production/CANNA_PROD_04_admin_copilot_whatsapp.mp4` (0:19) | `qa-local/QA_LOCAL_08_whatsapp_and_domain.mp4` |
| Clinic administration: dashboard, appointments, users, reports, activity log, templates, settings, domain | `production/CANNA_PROD_05_clinic_admin_tour.mp4` (0:23) | `qa-local/QA_LOCAL_04_clinic_admin.mp4` |
| Copilot (admin): live data, confirmed action, invitation email received, refusals | `production/CANNA_PROD_04…`, `production/CANNA_PROD_06_copilot_action_invite_email.mp4` (0:21) | `qa-local/QA_LOCAL_07…`, `qa-local/QA_LOCAL_09_copilot_admin.mp4` |
| Patient registration, booking, cancellation, rescheduling | **missing** | `qa-local/QA_LOCAL_01_patient_journey.mp4` |
| Consultation and video call | **missing** | `qa-local/QA_LOCAL_02_doctor_consultation.mp4` |
| Automatic AI summary after completion | **missing (critical)** | `qa-local/QA_LOCAL_03_automatic_ai_summary.mp4` |
| Copilot (doctor, patient) | **missing** | `qa-local/QA_LOCAL_10_copilot_doctor.mp4`, `qa-local/QA_LOCAL_11_copilot_patient.mp4`, `qa-local/QA_LOCAL_06_copilot_explains.mp4` |

## 3. Oshrit's complaints: root causes

| Complaint | Root cause (verified in production) | Fix | State |
|---|---|---|---|
| Automatic AI summary does not work | All 24 summary calls (29 Sep – 5 Oct) failed with `404 not_found_error: model claude-sonnet-4-20250514`: Anthropic retired the model. The failure was recorded as complete, so it looked like it ran. 0 of 34 completed consultations have a summary | sprint release moved to `claude-sonnet-5-5` (available, P26) and calls the summary directly from completion through `after()` | fix deployed; **end-to-end run in production still needs a doctor session** |
| Emails do not arrive | The demo accounts use `patient-demo@`, `doctor-demo@`, `admin-demo@`, `svitlana-qa@cannaforyou.net`. Those mailboxes do not exist at Hostinger: the first emails bounced and Resend has suppressed every one since (300+). The app showed them as "sent" because no delivery webhook is configured. Real inboxes receive 100% | the cron now asks Resend for the outcome of every "sent" email (`01c5a5b`), so the clinic sees delivered / bounced / suppressed | code done; **owner**: create the four mailboxes (or forwarders) at Hostinger and remove them from Resend's suppression list |
| WhatsApp does not work | Three faults in a row: (1) before the release the running build read credentials from `organizations.settings`, where they were empty after 018 moved them; (2) migration 023 then replaced the stored credentials with that empty copy; (3) every Green API call went to `api.green-api.com`, which no longer answers. "Not configured" leaves no record, so nothing showed in the database | 025 restored the credentials (023 fixed so it can't happen again); calls go to the instance's own host `NNNN.api.greenapi.com` | code done; **owner**: the Green API instance is not linked to a WhatsApp account; scan the QR in console.green-api.com with the clinic phone |

Note: in the demo clinic (Free plan) `whatsapp_notifications` is off, so the 1-hour WhatsApp reminder is skipped there; event messages (booking, cancellation, summary) are sent.

## 3b. Defects found in production, fixed and deployed

| Defect | Fix | Deployed | Re-verified in production |
|---|---|---|---|
| Doctor rows, including email, readable by every signed-in user | migration 022 | applied | yes (P6) |
| Clinic integration credentials readable by every clinic member | migration 023 (older value kept under `_previous`) | applied | yes (P7) |
| Invitations policy missing in production, so the admin's "pending invitations" list was empty. The policy in 015 was also too broad | migration 024 | applied | policy yes (P8); the admin screen still needs a QA-admin session |
| Invitation page did not pre-fill the invited first name | `f4e2f11` | yes | yes: after the deploy the page shows "רון" pre-filled |
| Hotfix build failed (SDK pin); production stayed on the old build | the sprint superseded it | yes | yes (P1) |
| 023 replaced working WhatsApp credentials with a blank copy | migration 025 + 023 ignores blank blocks | applied | yes (P29) |
| Emails accepted by Resend but never delivered stayed "sent" | cron delivery reconciliation `01c5a5b` | yes | test panel yes (P28); cron run pending |
| Green API host no longer answers | `f91b873`, `c74a95d` | yes | yes (P30) |

## 4. Not yet verified in production

| Workflow | Status | What it needs |
|---|---|---|
| Doctor completes registration, gets role and clinic membership, sets availability | BLOCKED | **owner**: type the doctor's password once |
| Patient registration through the clinic link | BLOCKED | **owner**: type the patient's password once |
| QA admin dashboard, settings, users, pending invitations, domain card | BLOCKED | **owner**: sign in as `+canna-admin`. The browser is currently signed in as a different clinic's admin |
| Duplicate and expired invitations; cross-clinic denial | NOT TESTED | QA admin session |
| Booking, every status, Israel time, double-booking, cancel/reschedule, notifications | NOT TESTED | QA patient and doctor |
| Consultation → automatic AI summary → patient view → email | NOT TESTED | QA doctor and patient |
| Copilot for patient, doctor and admin (Hebrew, data, navigation, confirmed action, audit) | NOT TESTED | QA sessions |
| Video call (LiveKit, two participants) | NOT TESTED | two QA sessions |
| WhatsApp send to a phone | BLOCKED (owner) | link the WhatsApp account to the instance (QR); then one test message to an authorized number |
| Resend delivery webhook | BLOCKED (owner) | create the webhook in Resend and set `RESEND_WEBHOOK_SECRET` in Vercel |
| Payments / invoices (Tranzila) | BLOCKED (external) | the clinic's terminal; out of the current build |
| Demo mailboxes at `cannaforyou.net` | BLOCKED (owner) | create the mailboxes or forwarders at Hostinger; remove the suppressions in Resend |
| Production videos 02, 05–10 | NOT RECORDED | the workflows above |

## 5. Local-only evidence (not production)
`npm test` 46/46 · `tsc` clean · clean release build 114/114 · Copilot red-team 7/7 · local videos 01–11 · access matrix for 022/023/024 run on a database restored from the production backup.
