import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceRole } from '@/lib/supabase/server'
import { SPECIALTIES, formatPrice } from '@/lib/utils'
import DoctorsHeroCarousel from './DoctorsHeroCarousel'

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
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(v) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
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
    medicalSpecialty: 'Telemedicine',
  }

  /* Gradient palette for avatars — cycles by index */
  const AVATAR_GRADIENTS = [
    ['#3b82f6','#6366f1'],['#10b981','#0891b2'],['#8b5cf6','#ec4899'],
    ['#f59e0b','#ef4444'],['#06b6d4','#3b82f6'],['#84cc16','#10b981'],
  ]

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Nav ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between h-16 px-4"
        style={{
          background: 'rgba(7,9,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
        dir="rtl"
      >
        <Link href="/" className="text-xl font-black text-white tracking-tight">CANNA</Link>
        <div className="flex items-center gap-5">
          <Link href="/specialties" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">התמחויות</Link>
          <Link href="/doctors" className="text-sm font-semibold text-blue-400 hidden sm:block">הרופאים שלנו</Link>
          <Link href="/for-clinics" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">למרפאות</Link>
          <Link href="/auth/login" className="text-sm text-slate-400 hover:text-white transition-colors">התחברות</Link>
          <Link
            href="/auth/register"
            className="text-sm font-bold text-white px-5 py-2 rounded-lg transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
          >
            הרשמה חינם
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <DoctorsHeroCarousel />

      {/* ── Light mode starts here ── */}

      {/* Stats strip */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-5 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {[
            { v: typedDoctors.length > 0 ? `${typedDoctors.length}+` : '50+', l: 'רופאים פעילים' },
            { v: `${Object.keys(specialtyCounts).length > 0 ? Object.keys(specialtyCounts).length : '15'}+`, l: 'התמחויות' },
            { v: '4.9 / 5', l: 'דירוג ממוצע' },
            { v: '< 24 שעות', l: 'עד לתור ראשון' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-black">{s.v}</p>
              <p className="text-blue-100 text-xs mt-0.5 font-medium">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust row */}
      <div className="bg-blue-50 border-b border-blue-100 py-3 px-4 overflow-x-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-8 whitespace-nowrap text-sm font-semibold text-blue-700">
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
      <div id="doctors-grid" className="sticky top-16 z-40 bg-white border-b border-gray-100 shadow-sm py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs font-bold text-gray-400 self-center ml-2 uppercase tracking-widest">סנן:</span>
            {SPECIALTIES.filter(s => specialtyCounts[s.id]).map(s => (
              <Link key={s.id} href={`/specialties/${s.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-gray-600 bg-gray-100 border border-transparent hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all">
                {s.label}
                <span className="text-xs text-gray-400 font-normal">({specialtyCounts[s.id]})</span>
              </Link>
            ))}
            {Object.keys(specialtyCounts).length === 0 && (
              <span className="text-sm text-gray-400">כל ההתמחויות</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Doctors Grid ── */}
      <section className="py-16 px-4" style={{ background: '#f8fafc' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-3">הכר את הרופאים שלנו</h2>
            <p className="text-gray-500 text-lg">מומחים מאומתים, דירוגים אמיתיים — בחר את המתאים לך</p>
          </div>

          {typedDoctors.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="text-7xl mb-5">👨‍⚕️</div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">רופאים יצטרפו בקרוב</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">אנחנו בתהליך גיוס מומחים. הירשם ונעדכן אותך.</p>
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
                הירשם לעדכונים
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {typedDoctors.map((doc, idx) => {
                const [from, to] = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                return (
                  <article key={doc.id}
                    className="group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-100"
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
                          <Link href={`/doctors/${doc.id}`} className="group-hover:text-blue-600 transition-colors">
                            <h3 className="font-black text-lg text-gray-900 leading-tight">
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
                                <span className="text-xs text-gray-400 self-center">+{doc.specialties.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bio */}
                      {doc.bio && (
                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-4">{doc.bio}</p>
                      )}

                      {/* Languages */}
                      {doc.languages && doc.languages.length > 0 && (
                        <p className="text-xs text-gray-400 mb-4">
                          🌐 <span className="font-medium text-gray-500">שפות:</span> {doc.languages.join(' · ')}
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
                            <span className="text-sm font-bold text-gray-700">{doc.average_rating.toFixed(1)}</span>
                            <span className="text-xs text-gray-400">({doc.total_ratings})</span>
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
            <span className="text-xs font-black tracking-widest uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-full">תהליך פשוט</span>
            <h2 className="text-4xl font-black text-gray-900 mt-4 mb-3">מבחירת רופא ועד לייעוץ — 4 צעדים</h2>
            <p className="text-gray-500 text-lg">ניהול מלא, דיגיטלי ומהיר</p>
          </div>
          <div className="relative grid md:grid-cols-4 gap-8">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 right-8 left-8 h-0.5 bg-gradient-to-l from-indigo-200 via-blue-200 to-indigo-200" style={{ zIndex: 0 }} />
            {[
              { n: '01', icon: '🔍', title: 'בחר רופא', desc: 'חפש לפי התמחות, דירוג, מחיר. קרא ביקורות ואישורי רישיון.' },
              { n: '02', icon: '📅', title: 'קבע מועד', desc: 'בחר שעה מתוך הסלוטים הפנויים. אישור תוך דקות.' },
              { n: '03', icon: '💻', title: 'שיחת וידאו', desc: 'התחבר מהבית, ללא המתנה. וידאו HD מוצפן.' },
              { n: '04', icon: '📋', title: 'מרשם + סיכום', desc: 'AI מסכם SOAP. מרשם דיגיטלי ישירות לנייד.' },
            ].map((step, i) => (
              <div key={i} className="relative z-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-blue-100 flex items-center justify-center text-2xl shadow-md mb-4 relative">
                  {step.icon}
                  <span className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full text-xs font-black text-white flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
                    {step.n}
                  </span>
                </div>
                <h3 className="font-black text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-4" style={{ background: '#f8fafc' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-black tracking-widest uppercase text-green-700 bg-green-50 px-4 py-2 rounded-full">ביקורות אמיתיות</span>
            <h2 className="text-4xl font-black text-gray-900 mt-4 mb-2">מה אומרים המטופלים שלנו</h2>
            <p className="text-gray-500">רק מטופלים שסיימו ייעוץ יכולים לדרג</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'שרה מ.', spec: 'ייעוץ עור ומין', text: 'הרופאה הסבירה בסבלנות ועזרה מאוד. קיבלתי מרשם תוך 20 דקות, חיסכתי יום שלם של המתנה בקופת חולים.', stars: 5, from: '#3b82f6', to: '#6366f1' },
              { name: 'דוד ק.', spec: 'ייעוץ קרדיולוגי', text: 'שירות מקצועי לחלוטין. הרופא עיין בבדיקות שלי, הסביר את הממצאים ונתן המלצות ברורות. מומלץ בחום.', stars: 5, from: '#10b981', to: '#0891b2' },
              { name: 'נועה ל.', spec: 'רפואה כללית', text: 'ממש נוח מהבית, אפסתי שעתיים נסיעה. הרופא ידע בדיוק מה לעשות. אפליקציה מהירה ופשוטה.', stars: 5, from: '#8b5cf6', to: '#ec4899' },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-5"
                  style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }} />
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.stars)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed mb-5 text-sm">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.spec}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 relative overflow-hidden"
        style={{
          background: [
            'radial-gradient(ellipse 60% 70% at 30% 50%, rgba(99,102,241,0.25) 0%, transparent 60%)',
            'radial-gradient(ellipse 50% 60% at 80% 30%, rgba(59,130,246,0.2) 0%, transparent 60%)',
            'linear-gradient(160deg, #07090f 0%, #0d1225 100%)',
          ].join(', '),
        }}
      >
        <div className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.025,
            backgroundImage: ['linear-gradient(rgba(255,255,255,1) 1px, transparent 1px)', 'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)'].join(', '),
            backgroundSize: '64px 64px',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 mb-6 rounded-full border px-5 py-2 text-sm font-bold"
            style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            רופאים זמינים עכשיו
          </div>
          <h2 className="font-black text-white mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1 }}>
            מוכן לקבל<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, #60a5fa, #818cf8)' }}>
              ייעוץ מקצועי?
            </span>
          </h2>
          <p className="text-lg mb-10" style={{ color: '#94a3b8' }}>
            הירשם בחינם וקבע תור עם רופא מומחה — תוך דקות, מכל מקום.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 text-white font-black px-9 py-4 rounded-2xl text-lg transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', boxShadow: '0 8px 32px rgba(59,130,246,0.4)' }}>
              הרשמה חינם — קבע תור עכשיו
            </Link>
            <Link href="/auth/login"
              className="inline-flex items-center gap-2 font-bold px-9 py-4 rounded-2xl text-lg transition-all hover:scale-105"
              style={{ border: '1.5px solid rgba(255,255,255,0.2)', color: '#e2e8f0', background: 'rgba(255,255,255,0.06)' }}>
              כבר רשום? התחבר
            </Link>
          </div>
          <p className="text-sm" style={{ color: '#475569' }}>
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
            <span style={{ color: '#475569' }}>נבנה ב NFD — Next Flow Digital</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
