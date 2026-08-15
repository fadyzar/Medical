import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceRole } from '@/lib/supabase/server'
import { SPECIALTIES, formatPrice } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

export const metadata: Metadata = {
  title: 'הרופאים שלנו — רופאים מומחים לייעוץ אונליין',
  description: 'מצא רופא מומחה לייעוץ אונליין בוידאו. כל ההתמחויות — רפואה כללית, עור, קרדיולוגיה ועוד. קבע תור היום.',
  keywords: ['רופאים אונליין', 'רופא מומחה', 'ייעוץ רפואי', 'CANNA'],
  openGraph: {
    title: 'הרופאים שלנו — CANNA',
    description: 'מצא רופא מומחה לייעוץ אונליין בוידאו. כל ההתמחויות. קבע תור היום.',
    type: 'website', locale: 'he_IL', url: `${BASE_URL}/doctors`,
  },
  alternates: { canonical: `${BASE_URL}/doctors` },
}

function getSpecialtyLabel(id: string) {
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

function Stars({ v }: { v: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(v) ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  )
}

export default async function DoctorsPage() {
  const supabase = createServiceRole()

  const { data: doctors } = await supabase.from('users')
    .select('id, first_name, last_name, specialties, bio, consultation_price, average_rating, total_ratings, avatar_url, languages')
    .eq('role', 'doctor')
    .eq('is_active', true)
    .order('average_rating', { ascending: false, nullsFirst: false })

  const typedDoctors = (doctors || []) as unknown as Array<{
    id: string; first_name: string; last_name: string
    specialties: string[] | null; bio: string | null
    consultation_price: number | null; average_rating: number | null
    total_ratings: number; avatar_url: string | null; languages: string[]
  }>

  const specialtyCounts: Record<string, number> = {}
  for (const doc of typedDoctors) {
    for (const s of doc.specialties || []) {
      specialtyCounts[s] = (specialtyCounts[s] || 0) + 1
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'MedicalClinic',
    name: 'CANNA', url: `${BASE_URL}/doctors`,
    areaServed: { '@type': 'Country', name: 'Israel' },
    medicalSpecialty: 'General',
  }

  /* CANNA teal avatar palette (predominantly teal, subtle variation) */
  const AVATAR_GRADIENTS = [
    ['#2FA9A2','#157F73'],['#14b8a6','#0d9488'],['#2FA9A2','#0891b2'],
    ['#48A28C','#157F73'],['#0d9488','#0e7490'],['#2FA9A2','#48A28C'],
  ]

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Nav ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between h-16 px-4 bg-white/85 backdrop-blur-md border-b border-slate-100"
        dir="rtl"
      >
        <Link href="/" className="flex items-center gap-2 text-xl font-black text-slate-900 tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/canna-mark.png" alt="" className="w-9 h-9 object-contain" />CANNA
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/specialties" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">התמחויות</Link>
          <Link href="/doctors" className="text-sm font-semibold text-teal-600 hidden sm:block">הרופאים שלנו</Link>
          <Link href="/for-clinics" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">למרפאות</Link>
          <Link href="/auth/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">התחברות</Link>
          <Link
            href="/auth/register"
            className="text-sm font-bold text-white px-5 py-2 rounded-lg transition-all hover:brightness-95"
            style={{ background: 'linear-gradient(135deg, #2FA9A2, #157F73)' }}
          >
            הרשמה חינם
          </Link>
        </div>
      </nav>

      {/* ── HERO — bright CANNA layout ── */}
      <section className="relative overflow-hidden bg-[#F7F9FA] border-b border-slate-100">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 w-96 h-96 rounded-full bg-teal-100/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-4 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold tracking-wide uppercase px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            רופאים מומחים מאומתים
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1]" style={{ color: '#18232F' }}>
            הרופא שלך <span className="text-teal-600">בשיחת וידאו</span>
          </h1>
          <p className="text-lg text-slate-500 mt-5 max-w-xl mx-auto leading-relaxed">
            בחר מומחה לפי התמחות, קבע תור וקבל ייעוץ בוידאו — עם מרשם דיגיטלי וסיכום AI אחרי כל פגישה.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <a href="#doctors-grid" className="inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-teal-600/25 hover:-translate-y-0.5">
              עיין ברופאים
            </a>
            <Link href="/specialties" className="inline-flex items-center justify-center border border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-semibold px-8 py-3.5 rounded-2xl transition-all">
              לפי התמחות
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 py-5 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {[
            { v: typedDoctors.length > 0 ? `${typedDoctors.length}` : '—', l: 'רופאים פעילים' },
            { v: Object.keys(specialtyCounts).length > 0 ? `${Object.keys(specialtyCounts).length}` : '—', l: 'התמחויות' },
            { v: 'וידאו HD', l: 'שיחות מוצפנות' },
            { v: 'AI', l: 'סיכום ומרשם' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-black">{s.v}</p>
              <p className="text-teal-100 text-xs mt-0.5 font-medium">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust row */}
      <div className="bg-teal-50 border-b border-teal-100 py-3 px-4 overflow-x-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-8 whitespace-nowrap text-sm font-semibold text-teal-700">
          {[
            { i: '🛡️', t: 'כל הרופאים אומתו ברישיון' },
            { i: '🔒', t: 'שיחות מוצפנות end-to-end' },
            { i: '📋', t: 'מרשמים ואישורים דיגיטליים' },
            { i: '💳', t: 'תשלום מאובטח' },
            { i: '🌐', t: 'ייעוץ מכל מקום בישראל' },
          ].map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">{b.i} {b.t}</span>
          ))}
        </div>
      </div>

      {/* ── Specialty filter ── */}
      <div id="doctors-grid" className="sticky top-16 z-40 bg-white border-b border-slate-100 shadow-sm py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs font-bold text-slate-400 self-center ml-2 uppercase tracking-widest">סנן:</span>
            {SPECIALTIES.filter(s => specialtyCounts[s.id]).map(s => (
              <Link key={s.id} href={`/specialties/${s.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-slate-600 bg-slate-100 border border-transparent hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-all">
                {s.label}
                <span className="text-xs text-slate-400 font-normal">({specialtyCounts[s.id]})</span>
              </Link>
            ))}
            {Object.keys(specialtyCounts).length === 0 && (
              <span className="text-sm text-slate-400">כל ההתמחויות</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Doctors Grid ── */}
      <section className="py-16 px-4" style={{ background: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-slate-900 mb-3">הכר את הרופאים שלנו</h2>
            <p className="text-slate-500 text-lg">מומחים מאומתים, דירוגים אמיתיים — בחר את המתאים לך</p>
          </div>

          {typedDoctors.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="text-7xl mb-5">👨‍⚕️</div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">רופאים יצטרפו בקרוב</h3>
              <p className="text-slate-500 mb-8 max-w-sm mx-auto">אנחנו בתהליך גיוס מומחים. הירשם ונעדכן אותך.</p>
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #2FA9A2, #157F73)' }}>
                הירשם לעדכונים
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {typedDoctors.map((doc, idx) => {
                const [from, to] = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                return (
                  <article key={doc.id}
                    className="group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-teal-100"
                  >
                    {/* Card top gradient bar */}
                    <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />

                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="relative shrink-0">
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg"
                            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                          >
                            {doc.first_name.charAt(0)}{doc.last_name.charAt(0)}
                          </div>
                          {doc.average_rating && doc.average_rating >= 4.8 && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white shadow"
                              style={{ border: `2px solid ${from}` }}>
                              <svg className="w-3 h-3" fill={from} viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link href={`/doctors/${doc.id}`} className="group-hover:text-teal-600 transition-colors">
                            <h3 className="font-black text-lg text-slate-900 leading-tight">
                              ד&quot;ר {doc.first_name} {doc.last_name}
                            </h3>
                          </Link>
                          {doc.specialties && doc.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {doc.specialties.slice(0, 2).map(s => (
                                <span key={s}
                                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                                  style={{ background: `${from}18`, color: from, border: `1px solid ${from}30` }}>
                                  {getSpecialtyLabel(s)}
                                </span>
                              ))}
                              {(doc.specialties.length > 2) && (
                                <span className="text-xs text-slate-400 self-center">+{doc.specialties.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bio */}
                      {doc.bio && (
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-4">{doc.bio}</p>
                      )}

                      {/* Languages */}
                      {doc.languages && doc.languages.length > 0 && (
                        <p className="text-xs text-slate-400 mb-4">
                          🌐 <span className="font-medium text-slate-500">שפות:</span> {doc.languages.join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 flex items-center justify-between"
                      style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                      <div>
                        {doc.average_rating ? (
                          <div className="flex items-center gap-1.5">
                            <Stars v={doc.average_rating} />
                            <span className="text-sm font-bold text-slate-700">{doc.average_rating.toFixed(1)}</span>
                            <span className="text-xs text-slate-400">({doc.total_ratings})</span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: `${from}15`, color: from }}>
                            חדש
                          </span>
                        )}
                        {doc.consultation_price && (
                          <p className="text-base font-black mt-0.5" style={{ color: '#059669' }}>
                            {formatPrice(doc.consultation_price)}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/patient/new-appointment?doctor=${doc.id}`}
                        className="text-sm font-bold text-white px-5 py-2.5 rounded-xl transition-all hover:scale-105 shadow-md"
                        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                      >
                        קבע תור
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-black tracking-widest uppercase text-teal-600 bg-teal-50 px-4 py-2 rounded-full">תהליך פשוט</span>
            <h2 className="text-4xl font-black text-slate-900 mt-4 mb-3">מבחירת רופא ועד לייעוץ — 4 צעדים</h2>
            <p className="text-slate-500 text-lg">ניהול מלא, דיגיטלי ומהיר</p>
          </div>
          <div className="relative grid md:grid-cols-4 gap-8">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 right-8 left-8 h-0.5 bg-gradient-to-l from-indigo-200 via-teal-200 to-indigo-200" style={{ zIndex: 0 }} />
            {[
              { n: '01', icon: '🔍', title: 'בחר רופא', desc: 'חפש לפי התמחות, דירוג, מחיר. קרא ביקורות ואישורי רישיון.' },
              { n: '02', icon: '📅', title: 'קבע מועד', desc: 'בחר שעה מתוך הסלוטים הפנויים. אישור תוך דקות.' },
              { n: '03', icon: '💻', title: 'שיחת וידאו', desc: 'התחבר מהבית, ללא המתנה. וידאו HD מוצפן.' },
              { n: '04', icon: '📋', title: 'מרשם + סיכום', desc: 'AI מסכם SOAP. מרשם דיגיטלי ישירות לנייד.' },
            ].map((step, i) => (
              <div key={i} className="relative z-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-teal-100 flex items-center justify-center text-2xl shadow-md mb-4 relative">
                  {step.icon}
                  <span className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full text-xs font-black text-white flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #2FA9A2, #157F73)' }}>
                    {step.n}
                  </span>
                </div>
                <h3 className="font-black text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA — bright ── */}
      <section className="py-20 px-4 relative overflow-hidden bg-[#F7F9FA]">
        <div aria-hidden className="pointer-events-none absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 rounded-full bg-teal-50 border border-teal-100 px-5 py-2 text-sm font-semibold text-teal-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
            רופאים זמינים עכשיו
          </div>
          <h2 className="font-black mb-4" style={{ color: '#18232F', fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.05 }}>
            מוכן לקבל <span className="text-teal-600">ייעוץ מקצועי?</span>
          </h2>
          <p className="text-lg text-slate-500 mb-9 max-w-xl mx-auto">
            הירשם בחינם וקבע תור עם רופא מומחה — תוך דקות, מכל מקום.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-9 py-4 rounded-2xl text-lg transition-all shadow-lg shadow-teal-600/25 hover:-translate-y-0.5">
              הרשמה חינם — קבע תור עכשיו
            </Link>
            <Link href="/auth/login"
              className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-semibold px-9 py-4 rounded-2xl text-lg transition-all">
              כבר רשום? התחבר
            </Link>
          </div>
          <p className="text-sm text-slate-400">
            ללא כרטיס אשראי · ביטול בכל עת · GDPR &amp; HIPAA compliant
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-14 px-4" style={{ background: '#020408', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm mb-10" style={{ color: '#64748b' }}>
            <div>
              <h5 className="font-black text-white text-lg mb-3">CANNA</h5>
              <p className="leading-relaxed">פלטפורמת ייעוץ רפואי אונליין — AI, וידאו, מרשמים דיגיטליים.</p>
            </div>
            <div>
              <h5 className="font-bold text-white mb-3">התמחויות</h5>
              <div className="space-y-1.5">
                {SPECIALTIES.slice(0, 5).map(s => (
                  <p key={s.id}><Link href={`/specialties/${s.id}`} className="hover:text-white transition-colors">{s.label}</Link></p>
                ))}
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-3">ניווט</h5>
              <div className="space-y-1.5">
                <p><Link href="/doctors" className="hover:text-white transition-colors">הרופאים שלנו</Link></p>
                <p><Link href="/for-clinics" className="hover:text-white transition-colors">למרפאות</Link></p>
                <p><Link href="/blog" className="hover:text-white transition-colors">בלוג</Link></p>
                <p><Link href="/auth/register" className="hover:text-white transition-colors">הרשמה</Link></p>
              </div>
            </div>
            <div>
              <h5 className="font-bold text-white mb-3">משפטי</h5>
              <div className="space-y-1.5">
                <p><Link href="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link></p>
                <p><Link href="/privacy" className="hover:text-white transition-colors">מדיניות פרטיות</Link></p>
                <p><Link href="/accessibility" className="hover:text-white transition-colors">נגישות</Link></p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#334155' }}>
            <span>&copy; {new Date().getFullYear()} CANNA. כל הזכויות שמורות.</span>
            <span style={{ color: '#475569' }}>CANNA For You — ייעוץ רפואי אונליין</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
