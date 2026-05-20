import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { sendDoctorInvite, sendStaffInvite } from '@/lib/email'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  role: z.enum(['doctor', 'staff', 'admin'], { required_error: 'יש לבחור תפקיד' }),
  name: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 invites per hour per user
    const limit = rateLimit(`admin-invite:${user.id}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'חריגה ממגבלת הזמנות. נסה שוב מאוחר יותר.' }, { status: 429 })
    }

    // Verify admin role
    const { data: profile } = await supabase.from('users')
      .select('role, organization_id, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as unknown as { role: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const typedProfile = profile as unknown as {
      role: string
      organization_id: string
      first_name: string
      last_name: string
    }

    const body = await req.json()
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }

    const { email, role, name } = parsed.data
    const inviteeName = name || email.split('@')[0]
    const admin = createServiceRole()

    // Get org details
    const { data: org } = await admin.from('organizations')
      .select('name, settings')
      .eq('id', typedProfile.organization_id)
      .single()

    const orgName = (org as unknown as { name: string })?.name || 'מרפאה'
    const orgSettings = (org as unknown as { settings: Record<string, unknown> })?.settings || {}
    const inviterName = `${typedProfile.first_name} ${typedProfile.last_name}`

    // Create or reuse a secure invite token in the invitations table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invitationsTable = (admin as any).from('invitations')
    let inviteToken: string | undefined
    const { data: existingInv } = await invitationsTable
      .select('token')
      .eq('organization_id', typedProfile.organization_id)
      .eq('email', email.toLowerCase())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingInv) {
      inviteToken = (existingInv as { token: string }).token
    } else {
      const { data: newInv } = await invitationsTable
        .insert({
          organization_id: typedProfile.organization_id,
          email: email.toLowerCase(),
          role,
          invited_by: user.id,
          first_name: inviteeName.split(' ')[0] ?? null,
        })
        .select('token')
        .single()
      inviteToken = (newInv as { token: string } | null)?.token
    }

    // Send invite email based on role
    let result: { success: boolean; error?: string }

    if (role === 'doctor') {
      result = await sendDoctorInvite({
        doctorName: inviteeName,
        doctorEmail: email,
        organizationId: typedProfile.organization_id,
        organizationName: orgName,
        inviterName,
        inviterUserId: user.id,
        inviteToken,
        admin,
      })
    } else {
      result = await sendStaffInvite({
        name: inviteeName,
        email,
        role: role as 'staff' | 'admin',
        organizationId: typedProfile.organization_id,
        organizationName: orgName,
        inviterName,
        inviterUserId: user.id,
        inviteToken,
        admin,
      })
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'שליחת ההזמנה נכשלה' }, { status: 500 })
    }

    // Add to pending_invites in org settings
    const pendingInvites = (orgSettings.pending_invites as Array<{ name: string; email: string; role: string }>) || []
    const alreadyInvited = pendingInvites.some(inv => inv.email === email)
    if (!alreadyInvited) {
      pendingInvites.push({ name: inviteeName, email, role })
      await admin.from('organizations').update({
        settings: { ...orgSettings, pending_invites: pendingInvites },
      }).eq('id', typedProfile.organization_id)
    }

    // Audit log
    const roleLabels: Record<string, string> = { doctor: 'רופא', staff: 'צוות', admin: 'מנהל' }
    await admin.from('audit_logs').insert({
      organization_id: typedProfile.organization_id,
      user_id: user.id,
      action: 'user_invited',
      resource_type: 'user',
      description: `הזמנת ${roleLabels[role] || role}: ${inviteeName} (${email})`,
      metadata: { name: inviteeName, email, role },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin-invite]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
