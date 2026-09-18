import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const schema = z.object({ doctorId: z.string().uuid('מזהה רופא לא תקין') })

/**
 * POST /api/patient/join-clinic
 *
 * Marketplace booking: a patient picks a doctor from another clinic, so their
 * profile has to move to that clinic before the appointment insert (RLS requires
 * appointments.organization_id = get_my_org_id()).
 *
 * This used to be a direct `users.update({ organization_id })` from the browser,
 * which only worked because the users_update_own policy had no WITH CHECK — the
 * same hole that let anyone set their own role to admin. Migration 019 closes it,
 * so the move happens here instead, with the target org derived from the doctor
 * rather than taken from the caller.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = rateLimit(`join-clinic:${user.id}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' }, { status: 429 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
    }

    const admin = createServiceRole()

    // Only a patient may be reassigned this way — never a doctor, staff or admin,
    // who would otherwise be moved out of the clinic that employs them.
    const { data: profile } = await admin
      .from('users').select('role, organization_id').eq('id', user.id).single()
    const me = profile as { role: string; organization_id: string | null } | null
    if (!me) return NextResponse.json({ error: 'פרופיל לא נמצא' }, { status: 404 })
    if (me.role !== 'patient') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Derive the org from the doctor, so the caller cannot name its own target.
    const { data: doc } = await admin
      .from('users')
      .select('organization_id')
      .eq('id', parsed.data.doctorId)
      .eq('role', 'doctor')
      .eq('is_active', true)
      .maybeSingle()

    const orgId = (doc as { organization_id: string | null } | null)?.organization_id
    if (!orgId) return NextResponse.json({ error: 'הרופא לא נמצא' }, { status: 404 })

    if (me.organization_id !== orgId) {
      const { error } = await admin.from('users').update({ organization_id: orgId }).eq('id', user.id)
      if (error) {
        console.error('[join-clinic] update failed', error.message)
        return NextResponse.json({ error: 'שגיאה בשיוך למרפאה' }, { status: 500 })
      }
    }

    return NextResponse.json({ organizationId: orgId })
  } catch (err) {
    console.error('[join-clinic]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
