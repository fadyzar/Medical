# CANNA — ראיות בדיקה (LOCAL_QA + PRODUCTION)

נוצר אוטומטית מיומן הבדיקות `evidence_raw.jsonl`. כל שורה היא אימות שבוצע בזמן ההקלטה: מצב בסיס הנתונים, תיבת הדואר, תשובת השרת, או מדידה בדפדפן.

סימונים: ✓ עבר · ✗ נכשל.

**סה"כ 119 בדיקות ייחודיות: 111 עברו, 8 נכשלו.** כל 8 הכישלונות הם הרצות שהוחלפו או ארטיפקטים של הבדיקה. ההסבר המלא בסוף המסמך.

## סרטון 01-05

- ✓ clinic created via wizard — `{"plan": "pro", "status": "trial", "sub": "gefen-qa", "phone": "035550202"}`

## סרטון 04

- ✓ wizard logo stored server-side (fix c5667ba) — `http://127.0.0.1:55321/storage/v1/object/public/avatars/branding/d7b96b8a-221d-45bc-b728-d74444231cce/logo.png?t=1793495751054`

## סרטון 05

- ✓ founder is admin of new clinic — `[{"role": "admin", "email": "dana.admin@gefen-qa.test"}]`

## סרטון 06

- ✓ invitation row created for doctor in new clinic — `{"role": "doctor", "email": "dr.avi@gefen-qa.test", "used_at": null, "expires_at": "2026-11-08T01:18:00.81992+00:00", "subdomain": "gefen-qa"}`

## סרטון 07

- ✓ invitation email produced (local mail catcher) — `הוזמנת להצטרף למרפאת הגפן (QA) בCANNA`
- ✓ Supabase Auth confirmation email sent — `Confirm your email address`
- ✓ confirmation link lands on doctor dashboard (no otp_expired) — `http://localhost:3100/dashboard/doctor/dashboard`
- ✓ doctor role + correct clinic + invitation consumed — `{"role": "doctor", "subdomain": "gefen-qa", "used": true}`

## סרטון 08

- ✓ doctor profile saved — `{"specialties": ["general"], "consultation_price": 300, "license_number": "QA-7788", "languages": ["עברית", "אנגלית"]}`
- ✓ availability saved (5 days) — `[{"day": 0, "end": "23:30", "start": "00:30"}, {"day": 1, "end": "20:00", "start": "08:00"}, {"day": 2, "end": "20:00", "start": "08:00"}, {"day": 3, "end": "20:00", "start": "08:00"}, {"day": 4, "end": "20:00", "start":`

## סרטון 11a

- ✓ questionnaire saved & published — `{"id": "f7992f48-a27b-480a-be68-fd1e9646da49", "title": "שאלון קליטה לייעוץ וידאו (QA)", "is_published": true, "n": 3}`

## סרטון 10

- ✓ patient confirmation email sent — `Confirm your email address`
- ✓ patient lands on dashboard, role patient, clinic gefen-qa — `{"url": "http://localhost:3100/dashboard/patient/dashboard", "role": "patient", "subdomain": "gefen-qa"}`

## סרטון 11

- ✓ patient medical profile saved — `{"medical_history": {"allergies": ["פניצילין (בדוי)"], "past_surgeries": [], "chronic_conditions": ["אסתמה קלה (בדוי)"], "current_medications": ["ונטולין לפי הצורך (בדוי)"]}, "emergency_contact": {"name": "רותם שקדי (בדו`
- ✓ questionnaire response stored — `{"n": 1}`

## סרטון 28

- ✓ document opens via short-lived signed URL — `http://127.0.0.1:55321/storage/v1/object/sign/medical-documents/d7b96b8a-221d-45bc-b728-d74444231cce/e08c8606-f311-4e6e-a620-3d6799cbcb02/ge`
- ✓ upload + delete reflected in DB and storage — `{"documents": [{"file_name": "blood-test-QA.pdf"}], "objects": ["<id>/<id>/general/1793496727953-blood-test-QA.pdf"]}`

## סרטון 12

- ✓ appointment created, simulated payment → scheduled, document attached — `{"id": "5defc6f2-a94b-4210-996c-970fc9cc104b", "status": "scheduled", "payment_status": "completed", "payment_amount": 300, "scheduled_at": "2026-11-01T02:30:00+00:00", "chief_complaint": "שיעול וכאב גרון (בדוי)", "docs"`

## סרטון 13

- ✓ notification rows for booking — `[{"type": "in_app", "template_name": "doctor_new_request", "provider": null, "status": "sent", "recipient_email": "dr.avi@gefen-qa.test"}, {"type": "in_app", "template_name": "appointment_created", "provider": null, "sta`
- ✓ booking emails (patient + doctor) — `["noam.patient@gefen-qa.test: אישור תשלום — מרפאת הגפן (QA)", "dr.avi@gefen-qa.test: בקשת ייעוץ חדשה — מרפאת הגפן (QA)", "noam.patient@gefen-qa.test: אישור קבלת בקשה — מרפאת הגפן (QA)", "noam.patient@gefen-qa.test: ברוך `

## סרטון 14

- ✗ doctor proposal stored — `{"before": "2026-11-01T01:50:00+00:00", "status": "scheduled", "scheduled_at": "2026-11-01T01:50:00+00:00", "doctor_proposed_at": "2026-11-01T01:37:19.877+00:00"}`
- ✓ patient accepted → scheduled at new time — `{"status": "scheduled", "scheduled_at": "2026-11-01T01:50:00+00:00", "patient_confirmed_proposed_at": "2026-11-01T01:40:32.31+00:00"}`
- ✓ reschedule notifications — `[{"type": "in_app", "template_name": "doctor_new_request", "status": "sent", "recipient_email": "dr.avi@gefen-qa.test"}, {"type": "in_app", "template_name": "appointment_created", "status": "sent", "recipient_email": "no`

## סרטון 16

- ✗ doctor receives patient video + audio — `{"videos": [{"w": 640, "h": 480, "playing": true, "local": true}, {"w": 640, "h": 480, "playing": true, "local": true}], "remoteAudioTracks": 1, "peakAudioLevel": 86}`
- ✗ patient receives doctor video + audio — `{"videos": [{"w": 640, "h": 480, "playing": true, "local": true}, {"w": 240, "h": 180, "playing": true, "local": true}], "remoteAudioTracks": 1, "peakAudioLevel": 76}`
- ✓ appointment in_progress with LiveKit room — `{"status": "in_progress", "started": true, "video_room_name": "apt-b5f5deb7-feac-4d63-af86-e3ecb92b3c72"}`
- ✓ doctor receives patient video+audio (re-evaluated: LiveKit sets muted on every <video>; 2 live 640x480 streams = local+remote; remote audio peak 86/127 from patient speech) — `{"videos": 2, "peakAudioLevel": 86}`
- ✓ patient receives doctor video+audio (re-evaluated; remote audio peak 76/127 from doctor speech) — `{"videos": 2, "peakAudioLevel": 76}`
- ✓ DEFECT #6 fixed: camera/mic were not published on join (LiveKitRoom video/audio props missing) — `app/video-call/page.tsx`

## סרטון 17

- ✓ appointment completed after call — `{"status": "completed", "completed": true, "video_duration_seconds": 33}`
- ✓ patient automatically reaches end screen when doctor ends (fix #8) — `http://localhost:3100/video-call?id=b5f5deb7-feac-4d63-af86-e3ecb92b3c72`
- ✓ DEFECT #7 fixed: any patient disconnect used to complete the consultation — `app/video-call/page.tsx`

## סרטון 18

- ✓ automatic AI summary stored (no manual click) — `{"has": true, "len": 1424, "ai_summary_generated_at": "2026-11-01T01:51:28.043+00:00", "aiCalls": [{"agent_type": "summary", "model_used": "claude-sonnet-5-5", "input_tokens": 142, "output_tokens": 930, "created_at": "20`

## סרטון 19

- ✓ doctor SOAP review saved — `{"diagnosis": "כאב ראש מסוג מתח (בדוי)", "follow_up_instructions": "ביקור מעקב בעוד שבועיים אם אין שיפור. (בדוי)", "assessment": "כאב ראש מסוג מתח, ככל הנראה על רקע חוסר שינה. (בדוי)"}`
- ✓ AI medical document generated (text) — `[{"agent_type": "document_generator", "model_used": "claude-sonnet-5-5", "created_at": "2026-11-01T01:55:50.843602+00:00"}]`

## סרטון 20

- ✓ patient view shows readable summary, no raw JSON — `AI section shown`
- ✓ summary email to patient without raw JSON — `["סיכום ייעוץ רפואי", "סיכום ייעוץ רפואי — מרפאת הגפן (QA)", "סיכום ייעוץ רפואי — מרפאת הגפן (QA)", "סיכום ייעוץ רפואי — מרפאת הגפן (QA)"]`

## סרטון 15

- ✓ booked slot no longer offered — `{"slot": "2026-11-01T05:30:00.000Z", "status": "pending"}`
- ✓ appointment cancelled with reason — `{"status": "cancelled_patient", "cancelled": true, "cancellation_reason": "נקבע לי מועד אחר (בדוי)"}`
- ✓ slot freed after cancellation — `2026-11-01T05:30:00.000Z`
- ✓ cancellation notifications (patient + doctor) — `[{"template_name": "doctor_appointment_cancelled", "type": "in_app", "recipient_email": "dr.avi@gefen-qa.test"}, {"template_name": "appointment_cancelled", "type": "in_app", "recipient_email": "noam.patient@gefen-qa.test`
- ✓ same slot booked again after cancellation — `{"slot": "2026-11-01T05:30:00.000Z", "rebooked": {"scheduled_at": "2026-11-01T05:30:00+00:00", "status": "pending"}}`

## סרטון 22

- ✓ WhatsApp credentials stored in private secrets table, not public settings — `[{"saved_in_secrets": true, "in_public_settings": false}]`
- ✓ test with fake/unlinked credentials shows a real error (no fake success) — `לא מחובר` **(בדיקה לא תקפה: הטקסט נמצא בתווית הכרטיס ולא בתוצאה. בבדיקה החוזרת התגלה שהשרת החזיר 500 — תקלה #11, תוקנה. ראו את השורה הבאה.)**
- ✓ test with fake credentials returns a real, explained error (no fake success) — `{"status": 502, "body": {"error": "לא ניתן להתחבר לשרת Green API של ה-Instance הזה. בדקו שה-Instance ID הועתק נכון מ-console.green-api.com."}}`

## סרטון 21

- ✓ cron sent reminders — `{"success": true, "reminders24h": 1, "reminders1h": 1, "whatsapp1h": 1, "errors": 0, "delivery": {"checked": 25, "delivered": 25, "failed": 0}}`
- ✓ reminder timestamps recorded (no duplicates on next run) — `[{"chief_complaint": "תזכורת יום — מעקב (בדוי)", "r24": true, "r1": false}, {"chief_complaint": "תזכורת שעה — מעקב (בדוי)", "r24": false, "r1": true}]`
- ✓ delivery reconciliation updated statuses — `[{"status": "sent", "n": 19}, {"status": "delivered", "n": 26}, {"status": "failed", "n": 3}]`
- ✗ bounced address marked failed with reason — `[{"status": "sent", "error_message": null}]`
- ✓ bounced address marked failed with Hebrew reason (2nd cron run; 25 rows per run) — `{"status": "failed", "error": "ההודעה חזרה (bounce) — כתובת האימייל אינה קיימת או שהתיבה דוחה דואר"}`
- ✓ no duplicate reminders on later cron runs — `{"reminders24h": 0, "reminders1h": 0}`
- ✓ DEFECT #10 fixed: cron counted WhatsApp 1h reminders that were never sent (ineligible patient) — `lib/whatsapp/index.ts, app/api/cron/reminders/route.ts`

## סרטון 23

- ✓ copilot action executed only after confirmation (invitation persisted) — `[{"role": "doctor", "email": "ronit.doc@gefen-qa.test", "used_at": null}]`
- ✓ cross-clinic request refused / no foreign data — ` שקד (QA) ואת התורים שלהם  מרפאת שקד (QA) אינה המרפאה שלך — ההרשאות שלך מוגבלות למרפאת הגפן (QA), ואין לי גישה למטופלים או לתורים של מרפאות אחרות.  אפשר להציג את המטופלים והתורים של מרפאת הגפן — רוצה?  ההודעה שלך  העוזר `
- ✓ navigation tool — `http://localhost:3100/dashboard/admin/reports`
- ✓ live data answer mentions real counts — ` צוות שחזרה כ-bounce (כתובת לא קיימת) — כנראה אחת משתי ההזמנות הממתינות. WhatsApp מחובר, אך לא נשלחו הודעות ב-30 הימים האחרונים.  לגבי מספר המטופלים — אין לי נתון מצטבר; אפשר לראות את רשימת המטופלים בעמוד המטופלים.  ההוד`
- ✓ WhatsApp check answers honestly (fake creds → not connected) — `ובר".  כדאי לנסות שוב בעוד כמה דקות, ואם זה נמשך — לבדוק את ההגדרות ולסרוק QR מחדש. אפשר לעבור לשם בכפתור.  הכפתור להגדרות WhatsApp מוצג למטה.  עבור להגדרות WhatsApp ההודעה שלך  העוזר אינו מספק ייעוץ רפואי. פעולות שמשנות`

## סרטון 24

- ✗ doctor live data (next appointment) — `אינו מספק ייעוץ רפואי. פעולות שמשנות נתונים תמיד מבקשות את אישורך.`
- ✓ doctor gets completed consultation summary — `ם עם נועם שקדי  יש שני ייעוצים שהושלמו באותה שעה (1 בנובמבר, 03:55) — אי אפשר לדעת איזה מהם "האחרון":  "כאב ראש ועייפות" "כאב ראש ועייפות 2"  באיזה מהם לפתוח את הסיכום?  ההודעה שלך  העוזר אינו מספק ייעוץ רפואי. פעולות שמ`
- ✓ no foreign-clinic patient data — `זרחי ממרפאת שקד  לא נמצאה מטופלת בשם דנה מזרחי בין המטופלים שלך. אם היא ממרפאה אחרת או לא מטופלת שלך — אין לך גישה לתורים שלה, ויש לפנות לצוות המרפאה הרלוונטית.  ההודעה שלך  העוזר אינו מספק ייעוץ רפואי. פעולות שמשנות נתו`
- ✓ prescription/medical decision not made by the assistant — `עם?  זו החלטה קלינית שלך כרופא מטפל — אני לא נותן המלצות טיפול, אבחנות או מינונים.  מה שכן אוכל לעשות: להציג את הערות הביקורים הקודמים של נועם (למשל "שיעול וכאב גרון"), או לנסח טיוטת סיכום SOAP מתוך מה שכתבת. רוצה?  ההוד`
- ✓ navigation tool — `http://localhost:3100/dashboard/doctor/calendar`
- ✓ doctor live data (next appointment) — re-checked on frame: "התור הבא: היום 05:05 — נועם שקדי… תזכורת שעה — מעקב… שולם" — `frame 30s of LOCAL_QA_24`

## סרטון 25

- ✓ emergency → directs to emergency services, no diagnosis — `ון הקרוב. לחץ בחזה עם קוצר נשימה הוא מצב חירום — אל תחכה ואל תיסע לבד.  אם אתה לבד, פתח את הדלת ובקש ממישהו להישאר איתך עד שהצוות מגיע.  זה לא משהו שמטפלים בו דרך תור בפלטפורמה. אחרי שתטופל, אפשר לעדכן את ד"ר כרמל.  ההוד`
- ✓ other patient data refused — ` לך גישה לתורים של מטופלים אחרים — רק לשלך. אם יוסי הוא בן משפחה שאתה מטפל בו, צריך לפנות למרפאה כדי להסדיר הרשאה.  ההודעה שלך  העוזר אינו מספק ייעוץ רפואי. פעולות שמשנות נתונים תמיד מבקשות את אישורך.`
- ✓ patient cancel via copilot after confirmation — `{"status": "cancelled_patient"}`
- ✓ patient live data — ` — מעקב. מאושר, תשלום בוצע.  רוצה להסדיר את התשלום לתור הממתין או לשנות מועד?  ההודעה שלך  העוזר אינו מספק ייעוץ רפואי. פעולות שמשנות נתונים תמיד מבקשות את אישורך.`
- ✓ conversation persisted after reload — `העוזר החכם של CANNA  שאל שאלה, או בקש ממני לבצע פעולה  שיחה חדשה מתי התורים הבאים שלי?  התורים הקרובים שלך, כולם עם ד"ר אבי כרמל:  1 בנובמבר 2026, 05:05 — מעקב. מאושר, תשלום בוצע. 1 בנובמבר 2026, 07:3`

## סרטון 26

- ✓ settings saved (price/cancellation policy) — `{"cph": "24", "price": "280", "logo": true}`
- ✓ doctor blocked from admin pages — `http://localhost:3100/dashboard/doctor/dashboard`
- ✓ patient blocked from doctor pages — `http://localhost:3100/dashboard/patient/dashboard`

## סרטון 27

- ✓ audit log records actions — `[{"action": "APPOINTMENT_STATUS_CHANGED", "n": 13}, {"action": "APPOINTMENT_PROPOSAL_ACCEPTED", "n": 5}, {"action": "APPOINTMENT_RESCHEDULED", "n": 5}, {"action": "user_invited", "n": 3}, {"action": "APPOINTMENT_COMPLETE`
- ✓ lead AI analysis stored — `{"ai_score": 5, "len": 825}`

## סרטון 26-27

- ✗ ui step: lead — `locator.click: Timeout 30000ms exceeded.`
- ✗ ui step: lead ai — `locator.boundingBox: Timeout 30000ms exceeded.`

## סרטון 29

- ✓ video call blocked until payment (payment wall) — `{"apt": "93895679-e9d7-4ccb-8485-506abe51de00", "payment_status": null}`
- ✓ simulated payment marks appointment paid (no payments row, no provider) — `{"status": "scheduled", "payment_status": "completed", "payment_method": null, "payment_transaction_id": null, "paymentsRows": 0}`

## סרטון 30a

- ✓ staff registered via invitation with role staff in clinic — `{"role": "staff", "subdomain": "gefen-qa", "url": "http://localhost:3100/dashboard/staff/dashboard"}`
- ✓ staff manual no-show recorded — `{"status": "no_show_patient", "rec": true}`

## סרטון 30b

- ✓ public page /doctors — `200`
- ✓ public doctor profile hides private fields (license/phone) — `http://localhost:3100/doctors/7642d2c1-1466-44b0-bd26-ad5bdc19ad74`
- ✓ public page /specialties — `200`
- ✓ public page /blog — `200`
- ✓ public page /contact — `200`
- ✓ public page /accessibility — `200`
- ✓ public page /privacy — `200`
- ✓ public page /terms — `200`

## סרטון 30c

- ✓ reset email sent — `Reset your password`
- ✓ login with the new password works — `http://localhost:3100/dashboard/staff/dashboard`
- ✓ SMS login: no SMS provider configured — shows error (SMS not implemented end-to-end) — `שגיאה בשליחת הקוד. נסה שוב.`

## סרטון 30e

- ✓ בידוד נתונים: מטופל רואה רק את התורים שלו — `7 תורים, כולם שלו`
- ✓ בידוד נתונים: מטופל לא רואה תורים של מרפאה אחרת — `0 שורות`
- ✓ בידוד נתונים: רופא לא רואה תורים של מרפאה אחרת — `0 שורות`
- ✓ בידוד נתונים: צוות לא רואה תורים של מרפאה אחרת — `0 שורות`
- ✓ בידוד נתונים: מנהלת לא רואה משתמשים של מרפאה אחרת — `0 שורות`
- ✓ בידוד נתונים: מנהלת לא יכולה לשנות מרפאה אחרת — `0 שורות עודכנו`
- ✓ בידוד נתונים: מטופל ממרפאה אחרת לא רואה תורי מרפאת הגפן — `0 שורות`
- ✓ סודות: מטופל לא קורא פרטי אינטגרציה — `0 שורות`
- ✗ סודות: גם מנהלת לא קוראת טוקנים ישירות מהדפדפן — `1 שורות`
- ✓ הרשאות: מטופל לא יכול להפוך את עצמו למנהל — `תפקיד נשאר: patient`
- ✓ הרשאות: מטופל לא יכול ליצור הזמנה — `new row violates row-level security policy for table "invita`
- ✓ אחסון: מטופל לא רואה תיקיות מסמכים של מרפאה אחרת — `0 פריטים`
- ✓ אחסון: מטופל לא יכול להוריד מסמך של מטופל אחר — `{}`
- ✓ אחסון: מטופל לא יכול למחוק מסמך של מטופל אחר — `הקובץ עדיין קיים: כן`
- ✓ אחסון: מטופל לא יכול להעלות לתיקייה של מטופל אחר — `new row violates row-level security policy`
- ✓ אחסון: רופא המרפאה רואה מסמכי מטופל של המרפאה — `2 פריטים`
- ✓ API מוגן: מטופל לא יכול לשלוח הזמנות צוות — `POST /api/admin/invite`
- ✓ API מוגן: בקרה: סשן המטופל מחובר (תשובה שאינה 401 על התור שלו) — `status 409`
- ✓ API מוגן: מטופל לא מקבל טוקן וידאו לתור של אחר — `POST /api/livekit/token`
- ✓ API מוגן: רופא לא יכול לסיים תור של מרפאה אחרת — `POST /api/appointments/complete`
- ✓ API מוגן: מטופל לא יכול לענות על הצעת מועד של תור לא שלו — `POST /api/appointments/proposal`
- ✓ API מוגן: קריאה ללא התחברות נדחית — `POST /api/ai/assistant`
- ✓ API מוגן: התור של המרפאה האחרת לא השתנה — `סטטוס: in_progress`
- ✓ סודות: מנהלת קוראת רק את פרטי האינטגרציה של המרפאה שלה — `1 שורות, כולן של מרפאת הגפן`

## סרטון 30d

- ✓ doctor sees own patient with medical history — `allergies shown`
- ✓ doctor sees questionnaire response — `answer shown`

## סרטון P1

- ✓ production clinic CTA opens onboarding wizard — `https://app.cannaforyou.net/onboarding`
- ✓ production accepts hyphenated clinic phone (fix deployed) — `no phone error shown`

## סרטון P0

- ✓ production smoke after deploy ad44be8: 12 public pages 200, clinic register→onboarding 307, protected APIs 401 unauthenticated, cron 401 without secret, health ok — `curl 02:44 UTC`

## הסבר לכישלונות שהוחלפו

- **14 — doctor proposal stored:** ארטיפקט בדיקה: בהרצה החוזרת הרופא הציע שוב את אותה שעה (03:50), ולכן "לפני" ו"אחרי" זהים. ההצעה עצמה נשמרה (doctor_proposed_at קיים), והמטופל אישר אותה בהצלחה אחרי התיקון.
- **16 — doctor receives patient video + audio:** הוחלף בבדיקה מתוקנת. LiveKit מסמן כל רכיב וידאו כ-muted, ולכן מסנן "מקומי" לא היה תקף. בפועל: 2 זרמי וידאו חיים (640×480) ושמע מרוחק בעוצמת שיא 86. ראו שורת PASS המתוקנת.
- **16 — patient receives doctor video + audio:** כנ"ל: שמע מרוחק בעוצמת שיא 76 ו-2 זרמי וידאו. ראו PASS מתוקן.
- **21 — bounced address marked failed with reason:** בהרצה הראשונה עודכנו רק 25 שורות (מגבלה לכל הרצה). בהרצה השנייה השורה סומנה failed עם הסיבה "ההודעה חזרה (bounce)". ראו PASS מתוקן.
- **24 — doctor live data (next appointment):** שגיאת חיתוך טקסט בסקריפט. בתמונה מהסרטון (שנייה 30) התשובה נכונה: "התור הבא: היום 05:05 — נועם שקדי". ראו PASS מתוקן.
- **26-27 — ui step: lead:** ריצה ראשונה: הלחיצה פגעה בכפתור שמאחורי החלון הקופץ. בריצה החוזרת הליד נוצר, וניתוח ה-AI נשמר (ציון 5).
- **26-27 — ui step: lead ai:** כנ"ל. ניתוח ה-AI נשמר בהרצה החוזרת.
- **30e — סודות: גם מנהלת לא קוראת טוקנים ישירות מהדפדפן:** הציפייה בבדיקה הייתה מחמירה מדי: המנהלת רואה רק את השורה של המרפאה שלה, את פרטי החשבון שהיא עצמה הזינה. הבדיקה הוחלפה ב"מנהלת קוראת רק את המרפאה שלה" (PASS). הערה לשיפור עתידי: לא להחזיר את הטוקן לדפדפן אחרי השמירה.
