import { createServerSupabase, createServiceRole } from '@/lib/supabase/server'
import { AuthLayout } from '@/components/layout/AuthLayout'
import InviteForm from './InviteForm'
import AcceptInvite from './AcceptInvite'
import AcceptPatientInvite from './AcceptPatientInvite'
import { ilikeExact } from '@/lib/invitations/patient-core'
import Link from 'next/link'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const validToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)

  // Validate token server-side using service role (bypasses RLS)
  // invitations not in generated types yet → cast via any
  const admin = createServiceRole()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteRaw } = await (admin as any)
    .from('invitations')
    .select('id, email, role, first_name, expires_at, used_at, revoked_at, accepted_by, organization_id')
    .eq('token', validToken ? token : '00000000-0000-0000-0000-000000000000')
    .maybeSingle()

  type InviteRow = {
    id: string
    email: string
    role: string
    expires_at: string
    used_at: string | null
    revoked_at: string | null
    accepted_by: string | null
    organization_id: string
    first_name: string | null
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
          <p className="text-slate-600 mb-6">קישור ההזמנה לא תקף. ייתכן שפג תוקפו או שהוא שגוי.</p>
          <Link href="/auth/login" className="text-teal-600 font-semibold hover:underline text-sm">
            חזור לדף הכניסה
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Revoked ────────────────────────────────────────────
  if (invite.revoked_at) {
    return (
      <AuthLayout title="ההזמנה בוטלה" subtitle="הקישור אינו פעיל עוד">
        <div className="text-center py-6">
          <p className="text-slate-600 mb-6">המרפאה ביטלה את ההזמנה הזו. אם לדעתך מדובר בטעות, פנה/י למרפאה.</p>
          <Link href="/auth/login" className="text-teal-600 font-semibold hover:underline text-sm">חזרה לדף הכניסה</Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Accepted by the signed-in user (e.g. back from email confirmation) ──
  if (invite.used_at && user && invite.accepted_by === user.id) {
    return (
      <AuthLayout title="ההצטרפות הושלמה" subtitle="ברוך/ה הבא/ה">
        <div className="text-center py-6" data-testid="invite-result">
          <p className="text-slate-600 mb-6">החשבון שלך משויך עכשיו למרפאה.</p>
          <Link href={invite.role === 'patient' ? '/dashboard/patient/dashboard' : `/dashboard/${invite.role}/dashboard`} className="inline-flex justify-center rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700">
            מעבר לאזור האישי
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
          <p className="text-slate-600 mb-6">הזמנה זו כבר נוצלה. אם נתקלת בבעיה, פנה למנהל המרפאה.</p>
          <Link href="/auth/login" className="text-teal-600 font-semibold hover:underline text-sm">
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
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <p className="text-slate-600 mb-6">תוקף ההזמנה פג. בקש ממנהל המרפאה לשלוח הזמנה חדשה.</p>
          <Link href="/auth/login" className="text-teal-600 font-semibold hover:underline text-sm">
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
    patient: 'הזמנה להצטרף כמטופל/ת',
    admin:  'השלמת הרשמה כמנהל',
  }

  const ROLE_LABELS: Record<string, string> = { doctor: 'רופא', staff: 'איש צוות', admin: 'מנהל', patient: 'מטופל' }
  const isPatient = invite.role === 'patient'

  // ── Already has an account ─────────────────────────────
  // An invitee who registered earlier (e.g. the email confirmation link failed
  // or expired) signs in and completes the invitation here. invite-accept
  // re-validates token, email, expiry and single use on the server.
  if (user) {
    const matches = user.email?.toLowerCase() === invite.email.toLowerCase()
    return (
      <AuthLayout title={ROLE_TITLES[invite.role] ?? 'השלמת הרשמה'} subtitle={`הוזמנת להצטרף ל${orgName}`}>
        {matches && isPatient ? (
          <AcceptPatientInvite token={token} orgName={orgName} email={invite.email} />
        ) : matches ? (
          <AcceptInvite token={token} roleLabel={ROLE_LABELS[invite.role] ?? invite.role} orgName={orgName} email={invite.email} />
        ) : (
          <p className="text-sm text-slate-600 leading-relaxed">
            ההזמנה נשלחה לכתובת <span className="font-semibold" dir="ltr">{invite.email}</span>, אבל את/ה מחובר/ת בחשבון אחר.
            התנתק/י והתחבר/י עם הכתובת שאליה נשלחה ההזמנה.
          </p>
        )}
      </AuthLayout>
    )
  }

  // ── Patient with an existing account: sign in, then accept here ──────
  if (isPatient) {
    const { data: existing } = await admin.from('users').select('id').ilike('email', ilikeExact(invite.email)).maybeSingle()
    if (existing) {
      const loginHref = `/auth/login?redirect=${encodeURIComponent(`/auth/invite/${token}`)}`
      return (
        <AuthLayout title={ROLE_TITLES.patient} subtitle={`הוזמנת להצטרף ל${orgName}`}>
          <div className="w-full" data-testid="invite-existing-account">
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              כבר יש חשבון לכתובת <span className="font-semibold" dir="ltr">{invite.email}</span>.
              אין צורך להירשם שוב — התחבר/י עם הסיסמה הקיימת ותוכל/י לאשר את ההזמנה.
            </p>
            <Link href={loginHref} className="inline-flex w-full justify-center rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700">
              התחברות ואישור ההזמנה
            </Link>
          </div>
        </AuthLayout>
      )
    }
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
        firstName={invite.first_name}
      />
    </AuthLayout>
  )
}
