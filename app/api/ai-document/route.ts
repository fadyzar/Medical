import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DOCUMENT_TYPES = {
  medical_letter: 'מכתב רפואי',
  referral: 'הפניה לרופא מומחה',
  sick_leave: 'אישור מחלה',
  prescription_summary: 'סיכום טיפול תרופתי',
  discharge_summary: 'סיכום ביקור / דיסצ׳ארג',
  follow_up_plan: 'תוכנית מעקב',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const admin = createServiceRole()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users')
      .select('role, organization_id, first_name, last_name, specialties, license_number')
      .eq('id', user.id).single()

    if (!profile || profile.role !== 'doctor') {
      return NextResponse.json({ error: 'רק רופאים יכולים ליצור מסמכים רפואיים' }, { status: 403 })
    }

    const body = await req.json()
    const { appointmentId, documentType = 'medical_letter' } = body

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId נדרש' }, { status: 400 })
    }

    // Fetch appointment + patient data
    const { data: apt, error: aptErr } = await admin
      .from('appointments')
      .select('*, patient:patient_id(id, first_name, last_name, date_of_birth, gender, medical_history, id_number, phone, email, insurance_info)')
      .eq('id', appointmentId)
      .eq('organization_id', (profile as unknown as { organization_id: string }).organization_id)
      .single()

    if (aptErr || !apt) {
      return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 })
    }

    const aptRecord = apt as unknown as Record<string, unknown>
    const patient = aptRecord.patient as Record<string, unknown>
    const medHistory = (patient?.medical_history || {}) as Record<string, unknown>
    const orgId = (profile as unknown as { organization_id: string }).organization_id

    // Fetch org for branding
    const { data: org } = await admin
      .from('organizations')
      .select('name, contact_phone, contact_email, logo_url')
      .eq('id', orgId)
      .single()

    const today = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
    const docLabel = DOCUMENT_TYPES[documentType as keyof typeof DOCUMENT_TYPES] || 'מסמך רפואי'

    const systemPrompt = `אתה רופא/ת ישראלי/ת עם ניסיון רב שכותב/ת מסמכים רפואיים רשמיים בעברית.
הסגנון צריך להיות: מקצועי, קצר, תמציתי, ברור ורשמי — בסגנון מסמכים רפואיים ישראליים אמיתיים.
כתוב תמיד בעברית תקינה.`

    const userPrompt = `צור ${docLabel} על בסיס הנתונים הבאים:

**פרטי הרופא:**
שם: ד"ר ${profile.first_name} ${profile.last_name}
התמחויות: ${(profile.specialties || []).join(', ')}
${profile.license_number ? `מספר רישיון: ${profile.license_number}` : ''}
מרפאה: ${org?.name || ''}

**פרטי המטופל:**
שם: ${patient?.first_name} ${patient?.last_name}
${patient?.date_of_birth ? `תאריך לידה: ${patient.date_of_birth}` : ''}
${patient?.id_number ? `ת.ז.: ${patient.id_number}` : ''}
${patient?.gender ? `מגדר: ${patient.gender}` : ''}

**מידע רפואי:**
תלונה עיקרית: ${aptRecord.chief_complaint}
${aptRecord.complaint_description ? `תיאור מורחב: ${aptRecord.complaint_description}` : ''}
${aptRecord.diagnosis ? `אבחנה: ${aptRecord.diagnosis}` : ''}
${aptRecord.assessment ? `הערכה קלינית: ${aptRecord.assessment}` : ''}
${aptRecord.plan ? `תוכנית טיפול: ${aptRecord.plan}` : ''}
${aptRecord.treatment_plan ? `מהלך הטיפול: ${aptRecord.treatment_plan}` : ''}
${aptRecord.follow_up_instructions ? `הוראות מעקב: ${aptRecord.follow_up_instructions}` : ''}
${aptRecord.ai_prescription_draft ? `המלצות תרופתיות: ${aptRecord.ai_prescription_draft}` : ''}

**היסטוריה רפואית רלוונטית:**
${(medHistory.allergies as string[] || []).length > 0 ? `אלרגיות: ${(medHistory.allergies as string[]).join(', ')}` : ''}
${(medHistory.chronic_conditions as string[] || []).length > 0 ? `מחלות כרוניות: ${(medHistory.chronic_conditions as string[]).join(', ')}` : ''}
${(medHistory.current_medications as string[] || []).length > 0 ? `תרופות נוכחיות: ${(medHistory.current_medications as string[]).join(', ')}` : ''}

**תאריך:** ${today}

כתוב ${docLabel} מקצועי, רשמי ומלא.
הכלל: פתיחה רשמית, גוף המסמך עם כל המידע הרלוונטי, חתימה וחותמת.
החזר רק את טקסט המסמך ללא הסברים נוספים.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const documentContent = response.content[0].type === 'text' ? response.content[0].text : ''

    // Save AI conversation for billing tracking
    await admin.from('ai_conversations').insert({
      organization_id: orgId,
      user_id: user.id,
      appointment_id: appointmentId,
      agent_type: 'document_generator',
      messages: [{ role: 'user', content: `Generate ${documentType}` }],
      result: { documentType, preview: documentContent.substring(0, 100) },
      is_complete: true,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      model_used: 'claude-sonnet-4-20250514',
    })

    // Save as document record
    const fileName = `${docLabel} — ${patient?.first_name} ${patient?.last_name} — ${today}.txt`
    const { data: docRecord } = await admin.from('documents').insert({
      organization_id: orgId,
      patient_id: aptRecord.patient_id as string,
      appointment_id: appointmentId,
      uploaded_by: user.id,
      file_name: fileName,
      file_type: 'text/plain',
      file_size_bytes: documentContent.length,
      storage_path: '',
      document_type: documentType,
      category: 'מסמך רפואי',
      tags: [docLabel],
      ocr_text: documentContent,
      is_verified: true,
    }).select().single()

    return NextResponse.json({
      success: true,
      document: documentContent,
      documentId: docRecord?.id || null,
      documentType,
      label: docLabel,
    })
  } catch (err) {
    console.error('[ai-document] error:', err)
    return NextResponse.json({ error: 'שגיאה ביצירת המסמך' }, { status: 500 })
  }
}
