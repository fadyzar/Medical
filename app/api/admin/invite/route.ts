import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { resolveCaller } from '@/lib/services/appointments'
import { inviteMember } from '@/lib/services/invitations'
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

    const parsed = inviteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'נתונים לא תקינים' }, { status: 400 })
    }

    const caller = await resolveCaller(user.id)
    if (!caller || caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // The real request origin, so invite links work on any domain (Vercel, custom, localhost).
    const result = await inviteMember({ caller, ...parsed.data, baseUrl: req.nextUrl.origin })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ success: true, ...result.data })
  } catch (err) {
    console.error('[admin-invite]', err instanceof Error ? err.message : 'error')
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 })
  }
}
