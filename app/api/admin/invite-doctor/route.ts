import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendDoctorInvite } from '@/lib/email'
import { z } from 'zod'

const inviteSchema = z.object({
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת אימייל לא תקינה'),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase.from('users')
      .select('role, organization_id, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const typedProfile = profile as unknown as { role: string; organization_id: string; first_name: string; last_name: string }
    const body = await req.json()
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }

    const { name, email } = parsed.data
    const admin = createServiceRole()

    // Get org name
    const { data: org } = await admin.from('organizations')
      .select('name, settings')
      .eq('id', typedProfile.organization_id)
      .single()

    const orgName = (org as unknown as { name: string })?.name || 'מרפאה'
    const orgSettings = (org as unknown as { settings: Record<string, unknown> })?.settings || {}

    // Send invite email
    const result = await sendDoctorInvite({
      doctorName: name,
      doctorEmail: email,
      organizationId: typedProfile.organization_id,
      organizationName: orgName,
      inviterName: `${typedProfile.first_name} ${typedProfile.last_name}`,
      inviterUserId: user.id,
      admin,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'שליחת ההזמנה נכשלה' }, { status: 500 })
    }

    // Add to pending_invites in org settings
    const pendingInvites = (orgSettings.pending_invites as Array<{ name: string; email: string }>) || []
    const alreadyInvited = pendingInvites.some(inv => inv.email === email)
    if (!alreadyInvited) {
      pendingInvites.push({ name, email })
      await admin.from('organizations').update({
        settings: { ...orgSettings, pending_invites: pendingInvites },
      }).eq('id', typedProfile.organization_id)
    }

    // Audit log
    await admin.from('audit_logs').insert({
      organization_id: typedProfile.organization_id,
      user_id: user.id,
      action: 'user_invited',
      resource_type: 'user',
      description: `הזמנת רופא: ${name} (${email})`,
      metadata: { doctor_name: name, doctor_email: email },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[invite-doctor]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
