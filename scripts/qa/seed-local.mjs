// Seeds a LOCAL Supabase stack with fake QA data: two clinics, admins, doctors,
// staff and patients, plus appointments in every interesting state.
//
//   SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=... node scripts/qa/seed-local.mjs
//
// Refuses to run against anything that is not localhost. All people are fictional;
// emails use the reserved .test TLD so nothing can ever be delivered.
import { createClient } from '@supabase/supabase-js'
import { QA_PASSWORD } from './qa-config.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Refusing to seed non-local URL: ${url}`)


const db = createClient(url, key, { auth: { persistSession: false } })

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const WEEK = [0, 1, 2, 3, 4].map(day => ({ day, start: '08:00', end: '20:00' }))

const PEOPLE = [
  { email: 'admin.a@canna.test',   first: 'מיכל',  last: 'אברהם', role: 'admin',   org: ORG_A, phone: '0500000001' },
  { email: 'staff.a@canna.test',   first: 'רונית', last: 'שושן',  role: 'staff',   org: ORG_A, phone: '0500000002' },
  { email: 'doctor.a1@canna.test', first: 'נועה',  last: 'לוי',   role: 'doctor',  org: ORG_A, phone: '0500000003',
    doctor: { specialties: ['general'], price: null, bio: 'רופאת משפחה, 12 שנות ניסיון.', license: 'QA-1001' } },
  { email: 'doctor.a2@canna.test', first: 'איתן',  last: 'כהן',   role: 'doctor',  org: ORG_A, phone: '0500000004',
    doctor: { specialties: ['dermatology'], price: 250, bio: 'רופא עור.', license: 'QA-1002' } },
  { email: 'patient.a@canna.test', first: 'דנה',   last: 'מזרחי', role: 'patient', org: ORG_A, phone: '0500000005' },
  { email: 'patient.a2@canna.test',first: 'יוסי',  last: 'פרץ',   role: 'patient', org: ORG_A, phone: '0500000006' },
  { email: 'admin.b@canna.test',   first: 'אורי',  last: 'גבאי',  role: 'admin',   org: ORG_B, phone: '0500000007' },
  { email: 'doctor.b1@canna.test', first: 'שירה',  last: 'בן דוד', role: 'doctor', org: ORG_B, phone: '0500000008',
    doctor: { specialties: ['cardiology'], price: null, bio: 'קרדיולוגית.', license: 'QA-2001' } },
  { email: 'patient.b@canna.test', first: 'עמית',  last: 'רוזן',  role: 'patient', org: ORG_B, phone: '0500000009' },
]

async function must(promise, what) {
  const { data, error } = await promise
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

async function main() {
  await must(db.from('organizations').upsert([
    { id: ORG_A, name: 'מרפאת שקד (QA)', subdomain: 'shaked-qa', slug: 'shaked-qa', primary_color: '#0d9488', plan: 'pro', subscription_status: 'active', contact_email: 'clinic.a@canna.test' },
    { id: ORG_B, name: 'מרפאת אורן (QA)', subdomain: 'oren-qa', slug: 'oren-qa', primary_color: '#2563eb', plan: 'basic', subscription_status: 'active', contact_email: 'clinic.b@canna.test' },
  ]), 'organizations')

  const ids = {}
  const { data: existing } = await db.auth.admin.listUsers({ perPage: 200 })
  for (const p of PEOPLE) {
    let user = existing.users.find(u => u.email === p.email)
    if (!user) {
      const created = await must(db.auth.admin.createUser({
        email: p.email, password: QA_PASSWORD, email_confirm: true,
        user_metadata: { first_name: p.first, last_name: p.last },
      }), `create ${p.email}`)
      user = created.user
    }
    ids[p.email] = user.id
    // Signup always creates a patient (migration 019); elevate here as an invite would.
    await must(db.from('users').update({
      role: p.role, organization_id: p.org, first_name: p.first, last_name: p.last, phone: p.phone, is_active: true,
      ...(p.doctor ? {
        specialties: p.doctor.specialties, consultation_price: p.doctor.price, bio: p.doctor.bio,
        license_number: p.doctor.license, availability: WEEK, languages: ['he', 'en'], accepts_video: true,
      } : {}),
    }).eq('id', user.id), `profile ${p.email}`)
  }

  // Appointments, relative to now so the data always looks current.
  const at = (days, hour) => {
    const d = new Date(); d.setUTCDate(d.getUTCDate() + days); d.setUTCHours(hour - 3, 0, 0, 0) // Israel = UTC+3
    return d.toISOString()
  }
  const A1 = ids['doctor.a1@canna.test'], A2 = ids['doctor.a2@canna.test'], B1 = ids['doctor.b1@canna.test']
  const PA = ids['patient.a@canna.test'], PA2 = ids['patient.a2@canna.test'], PB = ids['patient.b@canna.test']

  // Re-runnable: clear rows that reference the QA appointments first.
  for (const t of ['notifications', 'ai_conversations', 'documents', 'questionnaire_responses', 'audit_logs']) {
    await must(db.from(t).delete().in('organization_id', [ORG_A, ORG_B]), `clear ${t}`)
  }
  await must(db.from('appointments').delete().in('organization_id', [ORG_A, ORG_B]), 'clear appointments')
  await must(db.from('appointments').insert([
    { organization_id: ORG_A, patient_id: PA, doctor_id: A1, status: 'scheduled', scheduled_at: at(1, 10), duration_minutes: 30,
      chief_complaint: 'כאבי ראש חוזרים', complaint_description: 'כאבי ראש בשעות הבוקר כבר שבועיים', appointment_type: 'video', urgency_level: 'routine' },
    { organization_id: ORG_A, patient_id: PA, doctor_id: A1, status: 'in_progress', scheduled_at: at(0, 9), duration_minutes: 30,
      chief_complaint: 'שיעול ממושך', complaint_description: 'שיעול יבש 10 ימים, ללא חום', appointment_type: 'video', urgency_level: 'routine',
      subjective_notes: 'שיעול יבש 10 ימים, ללא חום, ללא קוצר נשימה. לא מעשן.', objective_notes: 'נראה טוב, מדבר במשפטים מלאים.',
      assessment: 'חשד לשיעול פוסט-ויראלי', plan: 'מנוחה, שתייה מרובה, מעקב בעוד שבועיים אם אין שיפור' },
    { organization_id: ORG_A, patient_id: PA2, doctor_id: A1, status: 'pending', scheduled_at: at(2, 14), duration_minutes: 30,
      chief_complaint: 'פריחה בידיים', appointment_type: 'video', urgency_level: 'routine' },
    { organization_id: ORG_A, patient_id: PA2, doctor_id: A2, status: 'scheduled', scheduled_at: at(1, 12), duration_minutes: 30,
      chief_complaint: 'שומה שהשתנתה', appointment_type: 'video', urgency_level: 'routine', payment_amount: 250 },
    { organization_id: ORG_B, patient_id: PB, doctor_id: B1, status: 'scheduled', scheduled_at: at(1, 11), duration_minutes: 30,
      chief_complaint: 'דפיקות לב (מטופל מרפאה B)', appointment_type: 'video', urgency_level: 'routine' },
  ]), 'appointments')

  console.log(JSON.stringify({ ok: true, orgs: [ORG_A, ORG_B], users: Object.keys(ids) }, null, 1))
}

main().catch(e => { console.error(e.message); process.exit(1) })
