import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createServiceRole } from '@/lib/supabase/server'
import { SPECIALTIES, formatPrice } from '@/lib/utils'
import { Breadcrumb } from '@/components/ui'

// ── Types ──────────────────────────────────────────────

type DoctorData = {
  id: string; first_name: string; last_name: string
  specialties: string[] | null; bio: string | null
  consultation_price: number | null; average_rating: number | null
  total_ratings: number; avatar_url: string | null
  languages: string[]; license_number: string | null
  total_appointments: number
}

type ReviewData = {
  patient_rating: number
  patient_feedback: string | null
  completed_at: string
  patient: { first_name: string; last_name: string } | null
}

// ── Helpers ────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cannaforyou.net'

function getSpecialtyLabel(id: string): string {
  return SPECIALTIES.find(s => s.id === id)?.label || id
}

// ── Metadata ───────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceRole()

  const { data } = await supabase.from('users')
    .select('first_name, last_name, specialties, bio, consultation_price, average_rating')
    .eq('id', id)
    .eq('role', 'doctor')
    .eq('is_active', true)
    .single()

  if (!data) {
    return { title: 'רופא לא נמצא' }
  }

  const doc = data as unknown as DoctorData
  const name = `ד"ר ${doc.first_name} ${doc.last_name}`
  const specialtyLabels = (doc.specialties || []).map(getSpecialtyLabel).join(', ')
  const description = doc.bio
    ? doc.bio.slice(0, 160)
    : `${name} — ${specialtyLabels || 'רופא'} | ייעוץ אונליין בוידאו בCANNA`

  return {
    title: `${name} — ייעוץ רפואי אונליין`,
    description,
    keywords: [name, ...specialtyLabels.split(', '), 'רופא אונליין', 'ייעוץ רפואי', 'CANNA'],
    openGraph: {
      title: `${name} — CANNA`,
      description,
      type: 'profile',
      locale: 'he_IL',
      url: `${BASE_URL}/doctors/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} — CANNA`,
      description,
    },
    alternates: { canonical: `${BASE_URL}/doctors/${id}` },
  }
}

// ── Page Component (SSR) ───────────────────────────────

export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRole()

  const { data } = await supabase.from('users')
    .select('id, first_name, last_name, specialties, bio, consultation_price, average_rating, total_ratings, avatar_url, languages, license_number, total_appointments')
    .eq('id', id)
    .eq('role', 'doctor')
    .eq('is_active', true)
    .single()

  if (!data) notFound()

  const doc = data as unknown as DoctorData

  // Fetch reviews
  const { data: reviewsData } = await supabase.from('appointments')
    .select('patient_rating, patient_feedback, completed_at, patient:patient_id(first_name, last_name)')
    .eq('doctor_id', id)
    .not('patient_rating', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20)

  const reviews = ((reviewsData || []) as unknown as ReviewData[]).map(r => ({
    name: r.patient ? `${r.patient.first_name} ${r.patient.last_name?.charAt(0)}.` : 'מטופל',
    rating: r.patient_rating,
    feedback: r.patient_feedback || '',
    date: r.completed_at,
  }))

  const specialtyLabels = (doc.specialties || []).map(getSpecialtyLabel)

  // Schema.org JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: `ד"ר ${doc.first_name} ${doc.last_name}`,
    url: `${BASE_URL}/doctors/${doc.id}`,
    ...(doc.bio && { description: doc.bio }),
    ...(doc.specialties?.[0] && { medicalSpecialty: doc.specialties[0] }),
    ...(doc.languages?.length > 0 && { knowsLanguage: doc.languages }),
    availableService: {
      '@type': 'MedicalProcedure',
      name: 'ייעוץ רפואי בוידאו',
      procedureType: 'http://schema.org/NoninvasiveProcedure',
    },
    ...(doc.average_rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: doc.average_rating.toFixed(1),
        reviewCount: doc.total_ratings,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(reviews.length > 0 && {
      review: reviews.slice(0, 10).filter(r => r.feedback).map(r => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: r.rating },
        ...(r.feedback && { reviewBody: r.feedback }),
        author: { '@type': 'Person', name: r.name },
        datePublished: r.date?.split('T')[0],
      })),
    }),
  }

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black text-teal-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/canna-mark.png" alt="" className="w-9 h-9 object-contain" />CANNA
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/specialties" className="text-sm text-slate-600 hover:text-slate-900">התמחויות</Link>
            <Link href="/doctors" className="text-sm text-slate-600 hover:text-slate-900">הרופאים שלנו</Link>
            <Link href="/blog" className="text-sm text-slate-600 hover:text-slate-900">בלוג</Link>
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">התחברות</Link>
            <Link href="/auth/register" className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">הרשמה חינם</Link>
          </div>
        </div>
      </nav>

      {/* Doctor Profile */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <Breadcrumb items={[
          { label: 'דף הבית', href: '/' },
          { label: 'הרופאים שלנו', href: '/doctors' },
          { label: `ד"ר ${doc.first_name} ${doc.last_name}` },
        ]} />
        {/* Header Card */}
        <div className="bg-gradient-to-l from-teal-50 to-white rounded-2xl border border-slate-100 p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="shrink-0">
              {doc.avatar_url ? (
                <Image
                  src={doc.avatar_url}
                  alt={`תמונת פרופיל של ד"ר ${doc.first_name} ${doc.last_name}`}
                  width={112}
                  height={112}
                  className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-teal-100 flex items-center justify-center text-4xl font-bold text-teal-700 border-4 border-white shadow-lg">
                  {doc.first_name.charAt(0)}{doc.last_name.charAt(0)}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-black text-slate-900 mb-2">
                ד&quot;ר {doc.first_name} {doc.last_name}
              </h1>

              {specialtyLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {specialtyLabels.map(label => (
                    <span key={label} className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                      {label}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {doc.average_rating && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400 text-lg">★</span>
                    <span className="font-bold text-slate-900">{doc.average_rating.toFixed(1)}</span>
                    <span>({doc.total_ratings} דירוגים)</span>
                  </span>
                )}
                {doc.languages?.length > 0 && (
                  <span>🌐 {doc.languages.join(', ')}</span>
                )}
                {doc.license_number && (
                  <span>📋 רישיון: {doc.license_number}</span>
                )}
              </div>
            </div>

            {/* Price + CTA */}
            <div className="shrink-0 text-center sm:text-left">
              {doc.consultation_price ? (
                <div className="mb-3">
                  <span className="text-3xl font-black text-green-700">{formatPrice(doc.consultation_price)}</span>
                  <span className="text-sm text-slate-400 block">לייעוץ</span>
                </div>
              ) : (
                <div className="mb-3">
                  <span className="text-sm text-slate-400">מחיר לפי הסדר</span>
                </div>
              )}
              <Link
                href={`/dashboard/patient/new-appointment?doctor=${doc.id}`}
                className="inline-block bg-teal-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors text-center"
              >
                קבע תור עכשיו
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bio */}
            {doc.bio && (
              <section>
                <h2 className="text-xl font-bold text-slate-900 mb-3">אודות הרופא</h2>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">{doc.bio}</p>
              </section>
            )}

            {/* Reviews */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                ביקורות מטופלים
                {doc.total_ratings > 0 && (
                  <span className="text-sm font-normal text-slate-500 mr-2">({doc.total_ratings})</span>
                )}
              </h2>

              {reviews.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl">
                  <p className="text-slate-400 text-lg mb-1">⭐</p>
                  <p className="text-slate-500 text-sm">אין עדיין ביקורות</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{review.name}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={star <= review.rating ? 'text-yellow-400' : 'text-slate-200'}>
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(review.date).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                      {review.feedback && (
                        <p className="text-sm text-slate-600">{review.feedback}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Quick Info Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 sticky top-20">
              <h3 className="font-bold text-slate-900">פרטים</h3>

              {specialtyLabels.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">התמחויות</p>
                  <p className="text-sm font-medium">{specialtyLabels.join(', ')}</p>
                </div>
              )}

              {doc.languages?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">שפות</p>
                  <p className="text-sm font-medium">{doc.languages.join(', ')}</p>
                </div>
              )}

              {doc.consultation_price && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">מחיר ייעוץ</p>
                  <p className="text-sm font-bold text-green-700">{formatPrice(doc.consultation_price)}</p>
                </div>
              )}

              {doc.total_appointments > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">ייעוצים שבוצעו</p>
                  <p className="text-sm font-medium">{doc.total_appointments.toLocaleString()}</p>
                </div>
              )}

              <Link
                href={`/dashboard/patient/new-appointment?doctor=${doc.id}`}
                className="block w-full bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors text-center"
              >
                קבע תור עכשיו
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* CTA */}
      <section className="py-16 px-4 bg-teal-600 text-white mt-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">מוכן להתחיל?</h2>
          <p className="text-xl text-teal-100 mb-8">
            הירשם בחינם וקבע תור עם ד&quot;ר {doc.first_name} {doc.last_name} — תוך דקות.
          </p>
          <Link href="/auth/register" className="bg-white text-teal-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-teal-50 transition-colors inline-block">
            הרשמה חינם — קבע תור עכשיו
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h5 className="font-bold text-white mb-3">CANNA</h5>
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
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-slate-800 text-center text-xs">
          &copy; {new Date().getFullYear()} CANNA. כל הזכויות שמורות.
        </div>
      </footer>
    </div>
  )
}
