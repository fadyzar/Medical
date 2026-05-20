import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'

/**
 * POST /api/auth/invite-accept
 * Called after a user registers via an invite link.
 * Validates the token, updates their profile with correct role + org, marks invite used.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json() as { token: string }
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const admin = createServiceRole()

  // Validate token — invitations not in generated types yet, cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitationsTable = (admin as any).from('invitations')
  const { data: invite } = await invitationsTable
    .select('id, organization_id, email, role, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  type Invite = {
    id: string
    organization_id: string
    email: string
    role: string
    expires_at: string
    used_at: string | null
  }
  const inv = invite as Invite | null

  if (!inv) return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 })
  if (inv.used_at) return NextResponse.json({ error: 'הזמנה כבר נוצלה' }, { status: 409 })
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: 'הזמנה פגה' }, { status: 410 })

  // Email must match (prevent token theft)
  if (inv.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'האימייל אינו תואם להזמנה' }, { status: 403 })
  }

  // Update user profile: set role + organization
  type UserRole = 'patient' | 'doctor' | 'staff' | 'admin'
  const { error: updateErr } = await admin
    .from('users')
    .update({
      role: inv.role as UserRole,
      organization_id: inv.organization_id,
    })
    .eq('id', user.id)

  if (updateErr) {
    console.error('[invite-accept] profile update error', updateErr)
    return NextResponse.json({ error: 'שגיאה בעדכון פרופיל' }, { status: 500 })
  }

  // Mark invite as used
  await invitationsTable
    .update({ used_at: new Date().toISOString() })
    .eq('id', inv.id)

  // Audit log
  await admin.from('audit_logs').insert({
    organization_id: inv.organization_id,
    user_id: user.id,
    action: 'invite_accepted',
    resource_type: 'user',
    description: `השלמת הרשמה מהזמנה — role: ${inv.role}`,
    metadata: { invite_id: inv.id, role: inv.role },
  }) // non-critical, ignore error

  return NextResponse.json({ ok: true, role: inv.role, organization_id: inv.organization_id })
}
