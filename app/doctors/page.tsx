import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceRole } from '@/lib/supabase/server'
import { SPECIALTIES, formatPrice } from '@/lib/utils'

// ── Metadata ─────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.co.il'

export const metadata: Metadata = {
  title: 'הרופאים שלנו — רופאים מומחים לייעוץ אונליין',
  description: 'מצא רופא מומחה לייעוץ אונליין בוידאו. רופאים בכל ההתמחויות — רפואה כללית, עור, אורתופדיה, קרדיולוגיה ועוד. קבע תור עכשיו.',
  keywords: ['רופאים אונליין', 'רופא מומחה', 'ייעוץ רפואי', 'טלמדיסן', 'רופא וידאו'],
  openGraph: {
    title: 'הרופאים שלנו — טלמדיסן',
    description: 'מצא רופא מומחה לייעוץ אונליין בוידאו. כל ההתמחויות. קבע תור היום.',
    type: 'website',
    locale: 'he_IL',
    url: `${BASE_URL}/doctors`,
  },
  alternates: { canonical: `${BASE_URL}/doctors` },
}

// ── Helper ───────────────────────────────────────────

function getSpecialtyLabel(id: string): string {
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

// ── Page Component (SSR) ─────────────────────────────

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

  // Count doctors per specialty
  const specialtyCounts: Record<string, number> = {}
  for (const doc of typedDoctors) {
    for (const s of doc.specialties || []) {
      specialtyCounts[s] = (specialtyCounts[s] || 0) + 1
    }
  }

  // Schema.org JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: 'טלמדיסן',
    description: 'פלטפורמת ייעוץ רפואי אונליין עם רופאים מומחים',
    url: `${BASE_URL}/doctors`,
    areaServed: { '@type': 'Country', name: 'Israel' },
    medicalSpecialty: 'Telemedicine',
    availableService: {
      '@type': 'MedicalProcedure',
      name: 'ייעוץ רפואי בוידאו',
      procedureType: 'http://schema.org/NoninvasiveProcedure',
    },
    ...(typedDoctors.length > 0 && {
      employee: typedDoctors.slice(0, 20).map(doc => ({
        '@type': 'Physician',
        name: `ד"ר ${doc.first_name} ${doc.last_name}`,
        ...(doc.specialties?.[0] && { medicalSpecialty: doc.specialties[0] }),
        ...(doc.average_rating && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: doc.average_rating.toFixed(1),
            reviewCount: doc.total_ratings,
          },
        }),
      })),
    }),
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-blue-600">טלמדיסן</Link>
          <div className="flex items-center gap-4">
            <Link href="/specialties" className="text-sm text-gray-600 hover:text-gray-900">התמחויות</Link>
            <Link href="/doctors" className="text-sm text-blue-600 font-medium">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">התחברות</Link>
            <Link href="/auth/register" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            הרופאים שלנו
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            רופאים מומחים בכל ההתמחויות, זמינים לייעוץ אונליין בשיחת וידאו. בחר רופא וקבע תור היום.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
            <span>👨‍⚕️ {typedDoctors.length} רופאים</span>
            <span>📋 {Object.keys(specialtyCounts).length} התמחויות</span>
            <span>⭐ דירוגים אמיתיים</span>
          </div>
        </div>
      </section>

      {/* Specialty Filter */}
      <section className="py-6 px-4 border-b bg-white sticky top-16 z-40">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2">
            {SPECIALTIES.filter(s => specialtyCounts[s.id]).map(s => (
              <Link key={s.id} href={`/specialties/${s.id}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors">
                {s.label} ({specialtyCounts[s.id]})
              </Link>
            ))}
            {Object.keys(specialtyCounts).length === 0 && (
              <div className="text-gray-400 text-sm">כל ההתמחויות זמינות</div>
            )}
          </div>
        </div>
      </section>

      {/* Doctors Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {typedDoctors.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">👨‍⚕️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">רופאים יצטרפו בקרוב</h2>
              <p className="text-gray-500 mb-6">אנחנו בתהליך גיוס רופאים מומחים. הירשם ונעדכן אותך.</p>
              <Link href="/auth/register" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors inline-block">
                הירשם לעדכונים
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {typedDoctors.map(doc => (
                <article key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
                  {/* Header with avatar */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-700 shrink-0">
                        {doc.first_name.charAt(0)}{doc.last_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/doctors/${doc.id}`} className="hover:text-blue-600 transition-colors">
                          <h2 className="font-bold text-xl">ד&quot;ר {doc.first_name} {doc.last_name}</h2>
                        </Link>
                        {doc.specialties && doc.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {doc.specialties.map(s => (
                              <Link key={s} href={`/specialties/${s}`}
                                className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium hover:bg-blue-100 transition-colors">
                                {getSpecialtyLabel(s)}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {doc.bio && (
                    <div className="px-6 pb-4">
                      <p className="text-sm text-gray-600 line-clamp-3">{doc.bio}</p>
                    </div>
                  )}

                  {/* Languages */}
                  {doc.languages && doc.languages.length > 0 && (
                    <div className="px-6 pb-4">
                      <p className="text-xs text-gray-400">🌐 {doc.languages.join(', ')}</p>
                    </div>
                  )}

                  {/* Footer with rating & price */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      {doc.average_rating ? (
                        <span className="text-sm font-medium text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg">
                          ⭐ {doc.average_rating.toFixed(1)} ({doc.total_ratings} דירוגים)
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">חדש בפלטפורמה</span>
                      )}
                    </div>
                    <div className="text-left">
                      {doc.consultation_price ? (
                        <span className="text-lg font-bold text-green-700">{formatPrice(doc.consultation_price)}</span>
                      ) : (
                        <span className="text-sm text-gray-400">מחיר לפי הסדר</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">מוכן להתחיל?</h2>
          <p className="text-xl text-blue-100 mb-8">הירשם בחינם וקבע תור עם רופא מומחה — תוך דקות.</p>
          <Link href="/auth/register" className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-50 transition-colors inline-block">
            הרשמה חינם — קבע תור עכשיו
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h5 className="font-bold text-white mb-3">טלמדיסן</h5>
            <p>פלטפורמת ייעוץ רפואי אונליין מתקדמת</p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">התמחויות</h5>
            {SPECIALTIES.slice(0, 5).map(s => (
              <p key={s.id}><Link href={`/specialties/${s.id}`} className="hover:text-white">{s.label}</Link></p>
            ))}
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">קישורים</h5>
            <p><Link href="/doctors" className="hover:text-white">הרופאים שלנו</Link></p>
            <p><Link href="/blog" className="hover:text-white">בלוג</Link></p>
            <p><Link href="/auth/register" className="hover:text-white">הרשמה</Link></p>
            <p><Link href="/auth/login" className="hover:text-white">התחברות</Link></p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-3">משפטי</h5>
            <p><Link href="/terms" className="hover:text-white">תנאי שימוש</Link></p>
            <p><Link href="/privacy" className="hover:text-white">מדיניות פרטיות</Link></p>
            <p><Link href="/accessibility" className="hover:text-white">נגישות</Link></p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-center text-xs">
          &copy; {new Date().getFullYear()} טלמדיסן. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
