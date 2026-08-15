'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Card, CardHeader, CardContent, Badge, PageLoading, Textarea, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Organization } from '@/types/database'

// ── Types ──────────────────────────────────────────────

type TemplateChannel = 'whatsapp' | 'email' | 'sms'
type TemplateEvent =
  | 'appointment_confirmation'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h'
  | 'appointment_cancellation'
  | 'appointment_no_show'
  | 'post_visit_summary'
  | 'follow_up'
  | 'payment_confirmation'
  | 'payment_failed'
  | 'lead_welcome'

type Template = {
  event: TemplateEvent
  channel: TemplateChannel
  subject?: string   // email only
  body: string
  enabled: boolean
}

type TemplateMap = Record<string, Template>

// ── Template definitions ───────────────────────────────

const EVENTS: { key: TemplateEvent; label: string; description: string; icon: string }[] = [
  { key: 'appointment_confirmation', label: 'אישור קביעת תור', description: 'נשלח מיד עם קביעת תור', icon: '✅' },
  { key: 'appointment_reminder_24h', label: 'תזכורת 24 שעות', description: 'נשלח יום לפני הייעוץ', icon: '🔔' },
  { key: 'appointment_reminder_1h', label: 'תזכורת שעה לפני', description: 'נשלח עם קישור הוידאו', icon: '⏰' },
  { key: 'appointment_cancellation', label: 'ביטול תור', description: 'נשלח עם ביטול תור', icon: '❌' },
  { key: 'appointment_no_show', label: 'לא הגיע לתור', description: 'נשלח למטופל שלא הגיע', icon: '👻' },
  { key: 'post_visit_summary', label: 'סיכום אחרי ביקור', description: 'נשלח עם סיכום AI', icon: '📋' },
  { key: 'follow_up', label: 'מעקב לאחר ביקור', description: 'נשלח כמה ימים אחרי הביקור', icon: '🔄' },
  { key: 'payment_confirmation', label: 'אישור תשלום', description: 'נשלח עם אישור תשלום', icon: '💳' },
  { key: 'payment_failed', label: 'תשלום נכשל', description: 'נשלח כשתשלום נכשל', icon: '⚠️' },
  { key: 'lead_welcome', label: 'קבלת ליד', description: 'נשלח לליד חדש שפנה', icon: '👋' },
]

const CHANNELS: { key: TemplateChannel; label: string; color: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'email',    label: 'אימייל',   color: 'bg-teal-100 text-teal-700 border-teal-200' },
]

const VARIABLES: { key: string; description: string }[] = [
  { key: '{{patient_name}}',    description: 'שם המטופל' },
  { key: '{{doctor_name}}',     description: 'שם הרופא' },
  { key: '{{clinic_name}}',     description: 'שם המרפאה' },
  { key: '{{appointment_date}}',description: 'תאריך התור' },
  { key: '{{appointment_time}}',description: 'שעת התור' },
  { key: '{{video_link}}',      description: 'קישור לשיחת הוידאו' },
  { key: '{{summary}}',         description: 'סיכום הביקור' },
  { key: '{{amount}}',          description: 'סכום התשלום' },
  { key: '{{invoice_url}}',     description: 'קישור לחשבונית' },
]

const DEFAULT_TEMPLATES: Record<TemplateEvent, Partial<Record<TemplateChannel, Partial<Template>>>> = {
  appointment_confirmation: {
    whatsapp: { body: 'שלום {{patient_name}} 👋\n\nתורך אצל {{doctor_name}} אושר!\n📅 {{appointment_date}} בשעה {{appointment_time}}\n🏥 {{clinic_name}}\n\nנשלח לך קישור לשיחת הוידאו שעה לפני הייעוץ.' },
    email: { subject: 'אישור תור — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nתורך אצל ד"ר {{doctor_name}} אושר בהצלחה.\n\nפרטי הייעוץ:\n📅 תאריך: {{appointment_date}}\n🕐 שעה: {{appointment_time}}\n👨‍⚕️ רופא: {{doctor_name}}\n\nנשלח לך קישור לשיחת הוידאו שעה לפני הייעוץ.\n\nבברכה,\nצוות {{clinic_name}}' },
  },
  appointment_reminder_24h: {
    whatsapp: { body: 'תזכורת: מחר יש לך תור 🗓️\n\nשלום {{patient_name}},\nמחר {{appointment_date}} בשעה {{appointment_time}} יש לך ייעוץ עם {{doctor_name}}.\n\nנשלח לך קישור לשיחת הוידאו שעה לפני.' },
    email: { subject: 'תזכורת: תור מחר — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nתזכורת: מחר יש לך תור.\n\n📅 {{appointment_date}} | 🕐 {{appointment_time}}\n👨‍⚕️ {{doctor_name}}\n\nנשלח קישור שעה לפני.\n\nבברכה,\n{{clinic_name}}' },
  },
  appointment_reminder_1h: {
    whatsapp: { body: 'הייעוץ שלך בעוד שעה! ⏰\n\nשלום {{patient_name}},\nהייעוץ עם {{doctor_name}} מתחיל בעוד שעה.\n\n🔗 קישור לשיחה: {{video_link}}\n\nנא להצטרף דקות ספורות לפני.' },
    email: { subject: 'הייעוץ שלך בעוד שעה — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nהייעוץ עם ד"ר {{doctor_name}} מתחיל בעוד שעה.\n\n🔗 קישור לשיחת הוידאו:\n{{video_link}}\n\nנא להצטרף דקות ספורות לפני כדי לבדוק מצלמה ומיקרופון.\n\nבברכה,\n{{clinic_name}}' },
  },
  appointment_cancellation: {
    whatsapp: { body: 'שלום {{patient_name}},\n\nהתורך לתאריך {{appointment_date}} עם {{doctor_name}} בוטל.\n\nליצירת תור חדש ניתן לפנות אלינו.\n\n{{clinic_name}}' },
    email: { subject: 'ביטול תור — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nלידיעתך, התורך ל-{{appointment_date}} עם ד"ר {{doctor_name}} בוטל.\n\nלקביעת תור חדש ניתן לפנות אלינו.\n\nבברכה,\n{{clinic_name}}' },
  },
  appointment_no_show: {
    whatsapp: { body: 'שלום {{patient_name}},\n\nשמנו לב שלא הגעת לתורך היום.\n\nנשמח לעזור לך לקבוע תור חדש. צור קשר עם {{clinic_name}}.' },
    email: { subject: 'לא הגעת לתור — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nלא הגעת לתורך שנקבע ל-{{appointment_date}}.\n\nנשמח לעזור לך לקבוע תור חדש בזמן המתאים לך.\n\nבברכה,\n{{clinic_name}}' },
  },
  post_visit_summary: {
    whatsapp: { body: 'סיכום הביקור שלך 📋\n\nשלום {{patient_name}},\n\nמצורף סיכום הביקור שלך עם {{doctor_name}}:\n\n{{summary}}\n\nלשאלות — צור קשר עם {{clinic_name}}.' },
    email: { subject: 'סיכום ביקור — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nמצורף סיכום הביקור שלך עם ד"ר {{doctor_name}}:\n\n{{summary}}\n\nלשאלות נוספות, נשמח לעמוד לרשותך.\n\nבברכה,\nצוות {{clinic_name}}' },
  },
  follow_up: {
    whatsapp: { body: 'שלום {{patient_name}} 👋\n\nמקווים שאתה/את מרגיש/ה טוב אחרי הביקור עם {{doctor_name}}.\n\nאם יש שאלות או אם הסימפטומים לא השתפרו — אנחנו כאן! {{clinic_name}}' },
    email: { subject: 'מעקב לאחר ביקורך — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nמקווים שאתה/את מרגיש/ה טוב לאחר הביקור עם ד"ר {{doctor_name}}.\n\nאם יש שאלות נוספות, נשמח לעמוד לרשותך.\n\nבברכה,\nצוות {{clinic_name}}' },
  },
  payment_confirmation: {
    whatsapp: { body: 'אישור תשלום ✅\n\nשלום {{patient_name}},\nהתשלום בסך {{amount}} התקבל בהצלחה.\n\n🧾 חשבונית: {{invoice_url}}\n\nתודה! {{clinic_name}}' },
    email: { subject: 'אישור תשלום — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nהתשלום בסך {{amount}} התקבל בהצלחה.\n\nלחשבונית: {{invoice_url}}\n\nתודה רבה,\n{{clinic_name}}' },
  },
  payment_failed: {
    whatsapp: { body: 'שימו לב: התשלום לא הצליח ⚠️\n\nשלום {{patient_name}},\nהתשלום לא הצליח. אנא נסה שוב או צור קשר עם {{clinic_name}}.' },
    email: { subject: 'שגיאה בתשלום — נדרשת פעולה', body: 'שלום {{patient_name}},\n\nלצערנו התשלום לא הצליח לעיבוד.\n\nאנא נסה שנית או פנה אלינו.\n\nבברכה,\n{{clinic_name}}' },
  },
  lead_welcome: {
    whatsapp: { body: 'שלום {{patient_name}} 👋\n\nקיבלנו את פנייתך.\n\nנציג {{clinic_name}} יחזור אליך בהקדם.\n\nבברכה,\nצוות {{clinic_name}}' },
    email: { subject: 'קיבלנו את פנייתך — {{clinic_name}}', body: 'שלום {{patient_name}},\n\nתודה שפנית ל-{{clinic_name}}!\n\nנציג יחזור אליך בהקדם.\n\nבברכה,\nצוות {{clinic_name}}' },
  },
}

function getTemplateKey(event: TemplateEvent, channel: TemplateChannel) {
  return `${event}__${channel}`
}

// ── Component ──────────────────────────────────────────

export default function AdminTemplatesPage() {
  const supabase = getClient()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgId, setOrgId] = useState('')
  const [templates, setTemplates] = useState<TemplateMap>({})
  const [activeEvent, setActiveEvent] = useState<TemplateEvent>(EVENTS[0].key)
  const [activeChannel, setActiveChannel] = useState<TemplateChannel>('whatsapp')
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.organization_id)

      const { data } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
      if (!data) return
      const organization = data as unknown as Organization
      setOrg(organization)

      const storedTemplates = (organization.settings as Record<string, unknown>)?.message_templates as TemplateMap || {}

      // Merge with defaults
      const merged: TemplateMap = {}
      EVENTS.forEach(ev => {
        CHANNELS.forEach(ch => {
          const k = getTemplateKey(ev.key, ch.key)
          const defaults = DEFAULT_TEMPLATES[ev.key]?.[ch.key]
          if (storedTemplates[k]) {
            merged[k] = storedTemplates[k]
          } else if (defaults) {
            merged[k] = {
              event: ev.key,
              channel: ch.key,
              subject: (defaults as Template).subject || '',
              body: (defaults as Template).body || '',
              enabled: true,
            }
          }
        })
      })
      setTemplates(merged)
    } catch {
      toast.error('שגיאה בטעינת התבניות')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  async function handleSave() {
    if (!org) return
    setSaving(true)
    try {
      const { error } = await supabase.from('organizations').update({
        settings: {
          ...org.settings,
          message_templates: templates,
        },
      }).eq('id', orgId)

      if (error) throw error
      toast.success('תבניות הודעות נשמרו בהצלחה')
    } catch {
      toast.error('שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  function updateTemplate(event: TemplateEvent, channel: TemplateChannel, field: keyof Template, value: string | boolean) {
    const k = getTemplateKey(event, channel)
    setTemplates(prev => ({
      ...prev,
      [k]: {
        event,
        channel,
        subject: prev[k]?.subject || '',
        body: prev[k]?.body || '',
        enabled: prev[k]?.enabled ?? true,
        [field]: value,
      },
    }))
  }

  function resetToDefault(event: TemplateEvent, channel: TemplateChannel) {
    const defaults = DEFAULT_TEMPLATES[event]?.[channel]
    if (!defaults) return
    const k = getTemplateKey(event, channel)
    setTemplates(prev => ({
      ...prev,
      [k]: {
        event,
        channel,
        subject: (defaults as Template).subject || '',
        body: (defaults as Template).body || '',
        enabled: true,
      },
    }))
  }

  function insertVariable(variable: string) {
    const k = getTemplateKey(activeEvent, activeChannel)
    const current = templates[k]?.body || ''
    updateTemplate(activeEvent, activeChannel, 'body', current + variable)
  }

  if (loading) return <PageLoading />

  const activeKey = getTemplateKey(activeEvent, activeChannel)
  const activeTemplate = templates[activeKey]
  const activeEventInfo = EVENTS.find(e => e.key === activeEvent)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">תבניות הודעות</h2>
          <p className="text-sm text-slate-500 mt-1">הגדר את ההודעות שנשלחות אוטומטית למטופלים</p>
        </div>
        <Button onClick={handleSave} loading={saving}>שמור הכל</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events list */}
        <div className="space-y-1">
          {EVENTS.map(ev => {
            const waKey = getTemplateKey(ev.key, 'whatsapp')
            const emKey = getTemplateKey(ev.key, 'email')
            const hasWA = templates[waKey]?.enabled
            const hasEmail = templates[emKey]?.enabled

            return (
              <button
                key={ev.key}
                onClick={() => setActiveEvent(ev.key)}
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-right transition-all',
                  activeEvent === ev.key
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-teal-200 hover:bg-teal-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ev.icon}</span>
                      <p className="font-medium text-sm truncate">{ev.label}</p>
                    </div>
                    <p className={cn('text-xs mt-0.5 truncate', activeEvent === ev.key ? 'text-teal-100' : 'text-slate-400')}>
                      {ev.description}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {hasWA && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', activeEvent === ev.key ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700')}>WA</span>
                    )}
                    {hasEmail && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', activeEvent === ev.key ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700')}>Email</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Template editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Channel tabs */}
          <div className="flex gap-2">
            {CHANNELS.map(ch => (
              <button
                key={ch.key}
                onClick={() => setActiveChannel(ch.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                  activeChannel === ch.key ? ch.color + ' shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Editor card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{activeEventInfo?.icon} {activeEventInfo?.label}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{activeEventInfo?.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeTemplate?.enabled ?? true}
                      onChange={e => updateTemplate(activeEvent, activeChannel, 'enabled', e.target.checked)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>פעיל</span>
                  </label>
                  <button
                    onClick={() => resetToDefault(activeEvent, activeChannel)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    אפס לברירת מחדל
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeChannel === 'email' && (
                <Input
                  label="נושא האימייל"
                  value={activeTemplate?.subject || ''}
                  onChange={e => updateTemplate(activeEvent, activeChannel, 'subject', e.target.value)}
                  placeholder="נושא ההודעה..."
                />
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  תוכן ההודעה
                </label>
                <textarea
                  value={activeTemplate?.body || ''}
                  onChange={e => updateTemplate(activeEvent, activeChannel, 'body', e.target.value)}
                  rows={activeChannel === 'email' ? 10 : 7}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none resize-y"
                  placeholder="תוכן ההודעה..."
                />
              </div>

              {/* Variables helper */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">הוסף משתנה דינמי:</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      title={v.description}
                      className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-teal-100 hover:text-teal-700 transition-colors font-mono"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {activeTemplate?.body && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">תצוגה מקדימה (עם נתוני דוגמה):</p>
                  <div className={cn(
                    'rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed',
                    activeChannel === 'whatsapp'
                      ? 'bg-[#dcf8c6] text-slate-800 max-w-sm mr-auto border border-green-200'
                      : 'bg-slate-50 border border-slate-200 text-slate-700'
                  )}>
                    {activeTemplate.body
                      .replace(/{{patient_name}}/g, 'ישראל ישראלי')
                      .replace(/{{doctor_name}}/g, 'ד"ר כהן')
                      .replace(/{{clinic_name}}/g, org?.name || 'המרפאה שלנו')
                      .replace(/{{appointment_date}}/g, '15/04/2026')
                      .replace(/{{appointment_time}}/g, '10:00')
                      .replace(/{{video_link}}/g, 'https://cannaforyou.net/video-call/...')
                      .replace(/{{amount}}/g, '₪350')
                      .replace(/{{summary}}/g, 'אבחנה: שגרת בדיקה. תוכנית: לחזור בעוד 3 חודשים.')
                      .replace(/{{invoice_url}}/g, 'https://...')
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
