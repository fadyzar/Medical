# CANNA — Client Demo Guide

Videos: `demo-videos/` (H.264 MP4, 1546×784, plays in any browser/player). Not committed to git.

**What the videos are:** real screen recordings of the actual application (fixed build) running against a local database with two **fictional** clinics and people (`*.canna.test` addresses). No real patient data. Recorded frame-by-frame at each action, so waiting time (e.g. the ~20 s while the AI writes a summary) is compressed. Passwords are masked; typed-text overlays were disabled.

**What they are not:** they are not recordings of production — production still runs the old build until the fixes are deployed.

| # | File | Length | Shows | Honest caveats |
|---|---|---|---|---|
| 1 | CANNA_01_patient_journey.mp4 | 1:26 | Landing → doctors → sign in → book (specialty, doctor, free slot, complaint, documents, confirm) → dashboard notification → "התורים שלי" | Registration screen not shown |
| 2 | CANNA_02_doctor_consultation.mp4 | 1:02 | Doctor sign-in → dashboard (new request) → weekly calendar → appointments → open consultation → **AI pre-visit brief** → SOAP notes → diagnosis | Video call itself not shown (needs two participants) |
| 3 | CANNA_03_automatic_ai_summary.mp4 | 0:47 | "סיים ייעוץ" → summary generated automatically → full SOAP summary on the doctor's side → patient signs in and sees "סיכום ייעוץ מד"ר נועה לוי" | Time between end and summary compressed |
| 4 | CANNA_04_clinic_admin.mp4 | 0:47 | Admin dashboard (KPIs, today, doctors, activity) → users → appointments → reports → integrations → audit log | Audit description shown in English in this take; fixed afterwards (migration 021) |
| 5 | CANNA_05_email_delivery.mp4 | 0:13 | Admin → Integrations → Email → "שלח בדיקה" → **provider accepted → delivered** with Resend ID | Real Resend round-trip to Resend's sandbox inbox `delivered@resend.dev`; inbox receipt itself not shown |
| 6 | CANNA_06_copilot_explains.mp4 | 0:24 | Copilot: "how do I connect WhatsApp?" → steps + clinic-specific status + "go to integrations" button → full screen → 30-day clinic summary | |
| 7 | CANNA_07_copilot_confirmed_action.mp4 | 0:21 | Patient asks the Copilot to cancel → it finds the right appointment → red confirmation card → confirm → cancelled; list shows "בוטל" | |
| 8 | CANNA_08_whatsapp_and_domain.mp4 | 0:42 | Per-clinic Green API setup guide → enter credentials (fake) → saved → test → **clear rejection reason** → clinic domain card | **WhatsApp delivery NOT verified** — no real clinic instance; fake credentials on purpose. "Activate domain" deliberately not clicked (real DNS). |

## Suggested order for Oshrit
3 (her main complaint) → 5 (her other complaint) → 1 → 2 → 4 → 8 → 6 → 7.

## What to tell her about each complaint
- **Summaries:** the cause was found (the AI model the system used was retired by the provider, plus three code faults). Fixed and shown working in Video 3. Live after deployment.
- **Emails:** the system sends; the demo inboxes on @cannaforyou.net do not exist, bounced, and are now blocked by the email provider. Real inboxes receive mail (Video 5). We will create the inboxes / unblock them. Also fixed: failures are now visible to the clinic.
- **WhatsApp:** each clinic connects its own Green API account; the setup is guided and errors are explained (Video 8). Needs her clinic's Green API instance to go live.

## Before sending
Do not send until the hotfix is deployed to production, or say clearly that the videos show the version about to go live.
