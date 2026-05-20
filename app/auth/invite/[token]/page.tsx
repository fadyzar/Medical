import { createServiceRole } from '@/lib/supabase/server'
import { AuthLayout } from '@/components/layout/AuthLayout'
import InviteForm from './InviteForm'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  // Validate token server-side using service role (bypasses RLS)
  // invitations not in generated types yet → cast via any
  const admin = createServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteRaw } = await (admin as any)
    .from('invitations')
    .select('id, email, role, expires_at, used_at, organization_id')
    .eq('token', token)
    .maybeSingle()

  type InviteRow = {
    id: string
    email: string
    role: string
    expires_at: string
    used_at: string | null
    organization_id: string
  }
  const invite = inviteRaw as InviteRow | null

  // ── Invalid token ──────────────────────────────────────
  if (!invite) {
    return (
      <AuthLayout title="הזמנה לא נמצאה" subtitle="הקישור אינו תקף">
        <div className="text-center py-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-gray-600 mb-6">קישור ההזמנה לא תקף. ייתכן שפג תוקפו או שהוא שגוי.</p>
          <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline text-sm">
            חזור לדף הכניסה
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Already used ───────────────────────────────────────
  if (invite.used_at) {
    return (
      <AuthLayout title="הזמנה כבר נוצלה" subtitle="הקישור כבר שומש">
        <div className="text-center py-6">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className="text-gray-600 mb-6">הזמנה זו כבר נוצלה. אם נתקלת בבעיה, פנה למנהל המרפאה.</p>
          <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline text-sm">
            כניסה לחשבון קיים
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Expired ────────────────────────────────────────────
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <AuthLayout title="הזמנה פגה" subtitle="תוקף הקישור פג">
        <div className="text-center py-6">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="text-gray-600 mb-6">תוקף ההזמנה פג. בקש ממנהל המרפאה לשלוח הזמנה חדשה.</p>
          <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline text-sm">
            חזור לדף הכניסה
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Get org name ───────────────────────────────────────
  const { data: orgRaw } = await admin
    .from('organizations')
    .select('name')
    .eq('id', invite.organization_id)
    .single()
  const orgName = (orgRaw as { name?: string } | null)?.name || 'המרפאה'

  const ROLE_TITLES: Record<string, string> = {
    doctor: 'השלמת הרשמה כרופא',
    staff:  'השלמת הרשמה כצוות',
    admin:  'השלמת הרשמה כמנהל',
  }

  return (
    <AuthLayout
      title={ROLE_TITLES[invite.role] ?? 'השלמת הרשמה'}
      subtitle={`הוזמנת להצטרף ל${orgName}`}
    >
      <InviteForm
        token={token}
        email={invite.email}
        role={invite.role}
        orgName={orgName}
      />
    </AuthLayout>
  )
}
