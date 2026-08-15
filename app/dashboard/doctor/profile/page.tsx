'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, Badge, PageLoading, Textarea } from '@/components/ui'
import { cn, getInitials, SPECIALTIES, formatPrice } from '@/lib/utils'
import { uploadAvatar } from '@/lib/supabase/storage'
import { doctorProfileSchema } from '@/lib/validation/schemas'
import { toast } from 'sonner'
import type { User } from '@/types/database'

// ── Tag input for languages ──────────────────────────

function TagInput({ label, tags, onChange, placeholder }: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const value = input.trim()
    if (value && !tags.includes(value)) {
      onChange([...tags, value])
    }
    setInput('')
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
        />
        <Button variant="outline" size="sm" type="button" onClick={addTag} disabled={!input.trim()}>
          הוסף
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-sm">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
                className="hover:text-red-600 text-teal-400 font-bold mr-0.5"
                aria-label={`הסר ${tag}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────

export default function DoctorProfilePage() {
  const router = useRouter()
  const supabase = getClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form state
  const [bio, setBio] = useState('')
  const [consultationPrice, setConsultationPrice] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [licenseNumber, setLicenseNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [acceptsVideo, setAcceptsVideo] = useState(true)
  const [acceptsClinic, setAcceptsClinic] = useState(false)

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Reviews
  const [reviews, setReviews] = useState<Array<{
    patient_name: string
    rating: number
    feedback: string
    date: string
  }>>([])

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data: prof } = await supabase.from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (prof) {
          const p = prof as unknown as User
          if (p.role !== 'doctor') { router.push('/dashboard'); return }
          setProfile(p)

          setBio(p.bio || '')
          setConsultationPrice(p.consultation_price?.toString() || '')
          setSelectedSpecialties(p.specialties || [])
          setLanguages(p.languages || [])
          setLicenseNumber(p.license_number || '')
          setPhone(p.phone || '')
          setAvatarUrl(p.avatar_url)
          setAcceptsVideo(p.accepts_video !== false)
          setAcceptsClinic(!!p.accepts_clinic)

          // Load recent reviews
          const { data: appointments } = await supabase.from('appointments')
            .select('patient_rating, patient_feedback, completed_at, patient:patient_id(first_name, last_name)')
            .eq('doctor_id', user.id)
            .not('patient_rating', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(10)

          if (appointments) {
            const mapped = appointments.map((a: Record<string, unknown>) => {
              const patient = a.patient as { first_name: string; last_name: string } | null
              return {
                patient_name: patient ? `${patient.first_name} ${patient.last_name?.charAt(0)}.` : 'מטופל',
                rating: a.patient_rating as number,
                feedback: (a.patient_feedback as string) || '',
                date: a.completed_at as string,
              }
            })
            setReviews(mapped)
          }
        }
      } catch {
        // Prevents infinite loading on network error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, supabase])

  // ── Avatar upload ────────────────────────────────────

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingAvatar(true)
    setErrors(prev => { const n = { ...prev }; delete n.avatar; return n })

    const { publicUrl, error: uploadErr } = await uploadAvatar(supabase, file, {
      orgId: profile.organization_id,
      userId: profile.id,
      oldAvatarUrl: profile.avatar_url,
    })

    if (uploadErr || !publicUrl) {
      setErrors(prev => ({ ...prev, avatar: uploadErr || 'שגיאה בהעלאת התמונה' }))
      toast.error('שגיאה בהעלאת התמונה')
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const { error: updateError } = await supabase.from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (updateError) {
      setErrors(prev => ({ ...prev, avatar: 'שגיאה בהעלאת התמונה' }))
      toast.error('שגיאה בהעלאת התמונה')
    } else {
      setAvatarUrl(publicUrl)
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
    }

    setUploadingAvatar(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Save ─────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile) return

    const result = doctorProfileSchema.safeParse({
      bio: bio || undefined,
      consultation_price: consultationPrice || undefined,
      license_number: licenseNumber || undefined,
      phone: phone || undefined,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(e => {
        const key = e.path[0] as string
        fieldErrors[key === 'consultation_price' ? 'price' : key] = e.message
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const { error } = await supabase.from('users').update({
        bio: bio.trim() || null,
        consultation_price: consultationPrice ? Number(consultationPrice) : null,
        specialties: selectedSpecialties.length > 0 ? selectedSpecialties : null,
        languages,
        license_number: licenseNumber.trim() || null,
        phone: phone.trim() || null,
        accepts_video: acceptsVideo,
        accepts_clinic: acceptsClinic,
      }).eq('id', profile.id)

      if (error) {
        toast.error('שגיאה בשמירת הפרופיל')
      } else {
        setProfile(prev => prev ? {
          ...prev,
          bio: bio.trim() || null,
          consultation_price: consultationPrice ? Number(consultationPrice) : null,
          specialties: selectedSpecialties.length > 0 ? selectedSpecialties : null,
          languages,
          license_number: licenseNumber.trim() || null,
          phone: phone.trim() || null,
        } : null)
        toast.success('הפרופיל נשמר בהצלחה')
      }
    } catch {
      toast.error('שגיאה בשמירת הפרופיל')
    }

    setSaving(false)
  }

  if (loading) return <PageLoading />
  if (!profile) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <h2 className="text-2xl font-bold">הפרופיל שלי</h2>

      {/* ── Avatar + basic info ───────────────────────────── */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="תמונת פרופיל"
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 border-2 border-slate-200">
                  {getInitials(profile.first_name, profile.last_name)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                aria-label="שנה תמונת פרופיל"
              >
                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                  {uploadingAvatar ? 'מעלה...' : 'שנה תמונה'}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">ד&quot;ר {profile.first_name} {profile.last_name}</p>
              <p className="text-sm text-slate-500">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {profile.average_rating ? (
                  <Badge variant="success">
                    {profile.average_rating.toFixed(1)} ({profile.total_ratings} דירוגים)
                  </Badge>
                ) : (
                  <Badge variant="info">חדש בפלטפורמה</Badge>
                )}
                <Badge>{profile.total_appointments} תורים</Badge>
              </div>
            </div>
          </div>
          {errors.avatar && (
            <p className="text-sm text-red-600 mt-2" role="alert">{errors.avatar}</p>
          )}
          <p className="text-xs text-slate-400 mt-3">PNG, JPG או WebP, עד 2MB</p>
        </CardContent>
      </Card>

      {/* ── Consultation types ────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">סוגי ייעוץ זמינים</h3>
          <p className="text-sm text-slate-500 mt-0.5">קבע אילו סוגי ייעוץ אתה מציע למטופלים</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            {
              key: 'video' as const,
              label: 'ייעוץ בוידאו אונליין',
              desc: 'מטופלים יכולים להתחבר מהבית דרך שיחת וידאו',
              icon: '📹',
              value: acceptsVideo,
              onChange: setAcceptsVideo,
            },
            {
              key: 'clinic' as const,
              label: 'ביקור במרפאה',
              desc: 'מטופלים יכולים להגיע לביקור פיזי',
              icon: '🏥',
              value: acceptsClinic,
              onChange: setAcceptsClinic,
            },
          ]).map(opt => (
            <div
              key={opt.key}
              className={cn(
                'flex items-center justify-between gap-4 rounded-xl border-2 p-4 transition-all cursor-pointer',
                opt.value ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'
              )}
              onClick={() => opt.onChange(!opt.value)}
              role="checkbox"
              aria-checked={opt.value}
              tabIndex={0}
              onKeyDown={e => e.key === ' ' && opt.onChange(!opt.value)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{opt.icon}</span>
                <div>
                  <p className={cn('font-semibold text-sm', opt.value ? 'text-teal-800' : 'text-slate-700')}>{opt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </div>
              </div>
              <div className={cn(
                'w-12 h-6 rounded-full relative transition-colors shrink-0',
                opt.value ? 'bg-teal-500' : 'bg-slate-200'
              )}>
                <div className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  opt.value ? 'translate-x-1' : 'translate-x-7'
                )} />
              </div>
            </div>
          ))}
          {!acceptsVideo && !acceptsClinic && (
            <p className="text-xs text-red-500 mt-1">יש לבחור לפחות סוג ייעוץ אחד</p>
          )}
        </CardContent>
      </Card>

      {/* ── Professional info ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">פרטים מקצועיים</h3>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            label="אודות / ביוגרפיה"
            placeholder="ספר על הניסיון שלך, ההתמחות והגישה הטיפולית..."
            value={bio}
            onChange={e => setBio(e.target.value)}
            className="min-h-[120px]"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="מחיר ייעוץ (בש&quot;ח)"
              type="number"
              min="0"
              step="10"
              placeholder="350"
              value={consultationPrice}
              onChange={e => { setConsultationPrice(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.price; return n }) }}
              error={errors.price}
            />
            <Input
              label="מספר רישיון"
              placeholder="מספר רישיון רפואי"
              value={licenseNumber}
              onChange={e => setLicenseNumber(e.target.value)}
            />
          </div>

          <Input
            label="טלפון"
            type="tel"
            placeholder="0521234567"
            value={phone}
            onChange={e => { setPhone(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.phone; return n }) }}
            error={errors.phone}
          />
        </CardContent>
      </Card>

      {/* ── Specialties ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">התמחויות</h3>
            <span className="text-sm text-slate-500">{selectedSpecialties.length} נבחרו</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map(s => {
              const isSelected = selectedSpecialties.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSpecialties(prev =>
                      isSelected
                        ? prev.filter(id => id !== s.id)
                        : [...prev, s.id]
                    )
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Languages ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h3 className="font-bold text-lg">שפות</h3>
        </CardHeader>
        <CardContent>
          <TagInput
            label=""
            tags={languages}
            onChange={setLanguages}
            placeholder="לדוגמה: עברית, אנגלית, רוסית..."
          />
        </CardContent>
      </Card>

      {/* ── Ratings & Reviews ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">דירוגים וביקורות</h3>
            {profile.average_rating && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-yellow-600">{profile.average_rating.toFixed(1)}</span>
                <div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} className={cn(
                        'text-lg',
                        star <= Math.round(profile.average_rating || 0) ? 'text-yellow-400' : 'text-slate-200'
                      )}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{profile.total_ratings} דירוגים</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">אין עדיין ביקורות</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, i) => (
                <div key={i} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{review.patient_name}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className={cn(
                            'text-sm',
                            star <= review.rating ? 'text-yellow-400' : 'text-slate-200'
                          )}>
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} size="lg">
          שמור שינויים
        </Button>
      </div>
    </div>
  )
}
