'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, Spinner } from '@/components/ui'
import type { User, Appointment, Document } from '@/types/database'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  TrackToggle,
  Chat,
  useTracks,
  useChat,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track, RoomEvent, ConnectionQuality, ConnectionState } from 'livekit-client'

type VideoState = 'checking' | 'payment_required' | 'waiting' | 'connecting' | 'connected' | 'disconnected' | 'error'

export default function VideoCallPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const router = useRouter()
  const supabase = getClient()

  const [state, setState] = useState<VideoState>('checking')
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<User | null>(null)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [token, setToken] = useState('')
  const [roomName, setRoomName] = useState('')
  const [hasCamera, setHasCamera] = useState(false)
  const [hasMic, setHasMic] = useState(false)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  const previewStreamRef = React.useRef<MediaStream | null>(null)
  previewStreamRef.current = previewStream

  useEffect(() => {
    if (!id) { setError('חסר מזהה תור'); setState('error'); return }
    init(id)
    return () => {
      previewStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [id])

  const init = async (appointmentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const [{ data: prof }, { data: apt }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('appointments')
          .select('*, patient:patient_id(first_name, last_name), doctor:doctor_id(first_name, last_name)')
          .eq('id', appointmentId).single(),
      ])

      if (!apt) { setError('תור לא נמצא'); setState('error'); return }
      const typedApt = apt as unknown as Appointment
      setProfile(prof as unknown as User)
      setAppointment(typedApt)

      // Payment wall — doctors bypass, patients must pay
      const isDoctor = (prof as unknown as User)?.role === 'doctor'
      if (!isDoctor && typedApt.payment_amount && typedApt.payment_amount > 0 && typedApt.payment_status !== 'completed') {
        setState('payment_required')
        return
      }

      // Hardware check
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setHasCamera(true)
        setHasMic(true)
        setPreviewStream(stream)
        setState('waiting')
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          setHasMic(true)
          setPreviewStream(stream)
          setState('waiting')
        } catch {
          setError('לא ניתן לגשת למצלמה/מיקרופון')
          setState('error')
        }
      }
    } catch {
      setError('שגיאה בטעינת פרטי השיחה')
      setState('error')
    }
  }

  const joinCall = async () => {
    if (!id) return
    setState('connecting')

    // Stop preview stream before LiveKit takes over
    previewStream?.getTracks().forEach(t => t.stop())
    setPreviewStream(null)

    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'שגיאה בקבלת טוקן')
      }

      const { token: tkn, room } = await res.json()
      setToken(tkn)
      setRoomName(room)
      setState('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהתחברות')
      setState('error')
    }
  }

  const [aiSummary, setAiSummary]       = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [rating, setRating]             = useState(0)
  const [rated, setRated]               = useState(false)

  const handleDisconnected = useCallback(async () => {
    if (!id) return

    // Mark appointment completed + trigger AI summary (background)
    try {
      await fetch('/api/appointments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id }),
      })
    } catch { /* non-critical */ }

    setState('disconnected')

    // Doctor: poll for AI summary
    if (profile?.role === 'doctor') {
      setSummaryLoading(true)
      const deadline = Date.now() + 45_000 // 45s timeout
      const poll = setInterval(async () => {
        try {
          const { data } = await supabase
            .from('appointments')
            .select('ai_summary')
            .eq('id', id)
            .single()
          if (data?.ai_summary) {
            setAiSummary(data.ai_summary as string)
            setSummaryLoading(false)
            clearInterval(poll)
          } else if (Date.now() > deadline) {
            setSummaryLoading(false)
            clearInterval(poll)
          }
        } catch { clearInterval(poll); setSummaryLoading(false) }
      }, 3000)
    }
  }, [id, profile?.role, supabase])

  const submitRating = async (stars: number) => {
    if (!id || rated) return
    setRating(stars)
    try {
      await fetch('/api/appointments/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, rating: stars }),
      })
      setRated(true)
    } catch { /* non-critical */ }
  }

  const handleConnected = useCallback(async () => {
    if (!id) return
    try {
      await supabase.from('appointments').update({
        status: 'in_progress',
        video_started_at: new Date().toISOString(),
      }).eq('id', id)
    } catch {
      // Non-critical — video session continues regardless
    }
  }, [id, supabase])

  const otherParty = appointment
    ? profile?.role === 'doctor'
      ? `${appointment.patient?.first_name} ${appointment.patient?.last_name}`
      : `ד"ר ${appointment.doctor?.first_name} ${appointment.doctor?.last_name}`
    : ''

  // Connected state with LiveKit room
  if (state === 'connected' && token && livekitUrl) {
    return (
      <div className="min-h-screen bg-slate-900" dir="rtl">
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={token}
          connect={true}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={(err) => { setError(err.message); setState('error') }}
          data-lk-theme="default"
          style={{ height: '100vh' }}
        >
          <ActiveRoom
            appointmentId={id!}
            otherParty={otherParty}
            complaint={appointment?.chief_complaint || ''}
            patientId={appointment?.patient_id || ''}
            roomName={roomName}
            supabase={supabase}
            onLeave={handleDisconnected}
            profile={profile}
            router={router}
          />
        </LiveKitRoom>
      </div>
    )
  }

  // All other states
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col" dir="rtl">
      <header className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold">{otherParty || 'שיחת וידאו'}</h1>
          <p className="text-slate-400 text-xs">{appointment?.chief_complaint}</p>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {state === 'checking' && (
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p>בודק חומרה...</p>
          </div>
        )}

        {state === 'payment_required' && (
          <Card className="max-w-md w-full bg-slate-800 border-slate-700">
            <CardContent className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <svg className="w-10 h-10 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
              </div>
              <h2 className="text-xl font-bold">נדרש תשלום</h2>
              <p className="text-slate-400">יש לבצע תשלום לפני הצטרפות לשיחת הווידאו</p>
              <Button onClick={() => router.push(`/dashboard/patient/payment?id=${id}`)} size="lg" className="w-full">
                עבור לתשלום
              </Button>
              <Button
                onClick={() => { setState('checking'); if (id) init(id) }}
                variant="outline"
                className="w-full border-slate-600 text-white"
              >
                כבר שילמתי — נסה שוב
              </Button>
              <Button onClick={() => router.push('/dashboard/patient/dashboard')} variant="outline" className="w-full border-slate-600 text-slate-400 text-sm">
                חזור לדשבורד
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'waiting' && (
          <Card className="max-w-md w-full bg-slate-800 border-slate-700">
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-xl font-bold">חדר המתנה</h2>
              <p className="text-slate-400">בדיקת חומרה — לחצו ״הצטרף לשיחה״ כשתהיו מוכנים</p>

              {/* Preview */}
              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
                {previewStream && hasCamera ? (
                  <video
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(el) => { if (el && previewStream) el.srcObject = previewStream }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <svg className="w-10 h-10 text-slate-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3l2-3h6l2 3h3a2 2 0 012 2v9.34" /><path d="M14.12 14.12A3 3 0 009.88 9.88" /></svg>
                      <p>אין מצלמה זמינה</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Hardware status */}
              <div className="flex justify-center gap-4 text-sm">
                <span className={hasCamera ? 'text-green-400' : 'text-red-400'}>
                  {hasCamera ? '✓ מצלמה תקינה' : '✗ אין מצלמה'}
                </span>
                <span className={hasMic ? 'text-green-400' : 'text-red-400'}>
                  {hasMic ? '✓ מיקרופון תקין' : '✗ אין מיקרופון'}
                </span>
              </div>

              {!livekitUrl && (
                <p className="text-yellow-400 text-xs">שגיאת תצורה: כתובת LiveKit לא הוגדרה</p>
              )}

              <Button
                onClick={joinCall}
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!hasMic || !livekitUrl}
              >
                הצטרף לשיחה
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'connecting' && (
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p>מתחבר לשיחה...</p>
          </div>
        )}

        {state === 'disconnected' && profile?.role === 'doctor' && (
          /* ── Doctor post-call screen ── */
          <div className="max-w-lg w-full space-y-4">
            {/* Header */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">הייעוץ הסתיים</h2>
                  <p className="text-slate-400 text-sm">עם {otherParty} — {appointment?.chief_complaint}</p>
                </div>
              </CardContent>
            </Card>

            {/* AI Summary */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  <p className="text-sm font-semibold text-blue-300">סיכום AI</p>
                </div>

                {summaryLoading && (
                  <div className="flex items-center gap-3 py-3 text-slate-400">
                    <Spinner size="sm" />
                    <span className="text-sm">מייצר סיכום אוטומטי...</span>
                  </div>
                )}

                {aiSummary && !summaryLoading && (
                  <div className="bg-slate-900 rounded-xl p-4 text-sm text-slate-200 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {aiSummary}
                  </div>
                )}

                {!summaryLoading && !aiSummary && (
                  <p className="text-sm text-slate-500">הסיכום לא נוצר אוטומטית — ניתן לייצר ידנית מדף התורים.</p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={() => router.push(`/dashboard/doctor/appointments?id=${id}`)}
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <svg className="w-4 h-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                השלם רשימות SOAP ושלח למטופל
              </Button>
              <Button
                onClick={() => router.push('/dashboard/doctor/dashboard')}
                variant="outline"
                className="w-full border-slate-600 text-white hover:bg-slate-700"
              >
                חזור לדשבורד
              </Button>
            </div>
          </div>
        )}

        {state === 'disconnected' && profile?.role !== 'doctor' && (
          /* ── Patient post-call screen ── */
          <div className="max-w-lg w-full space-y-4">
            {/* Header */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 className="text-xl font-bold text-white">הייעוץ הסתיים</h2>
                <p className="text-slate-400 text-sm">תודה שהשתמשת בשירותנו</p>
              </CardContent>
            </Card>

            {/* Summary coming */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">סיכום הייעוץ בדרך</p>
                  <p className="text-xs text-slate-400 mt-0.5">הרופא יכין סיכום ותשלח אליך הודעה. תוכל לראות אותו גם ב״המסמכים שלי״.</p>
                </div>
              </CardContent>
            </Card>

            {/* Rating */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5 text-center space-y-3">
                {!rated ? (
                  <>
                    <p className="text-sm font-semibold text-white">איך היה הייעוץ עם {otherParty}?</p>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => submitRating(star)}
                          className="text-3xl transition-transform hover:scale-110 active:scale-95"
                          aria-label={`${star} כוכבים`}
                        >
                          {star <= rating ? '⭐' : '☆'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">הדירוג עוזר לשפר את השירות</p>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <p className="text-sm font-medium">תודה על הדירוג!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => router.push('/dashboard/patient/new-appointment')}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                קבע תור המשך
              </Button>
              <Button
                onClick={() => router.push('/dashboard/patient/dashboard')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                לדשבורד
              </Button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <Card className="max-w-md w-full bg-slate-800 border-slate-700">
            <CardContent className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <svg className="w-10 h-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              </div>
              <h2 className="text-xl font-bold">שגיאה</h2>
              <p className="text-slate-400">{error}</p>
              <Button onClick={() => router.back()} variant="outline" className="border-slate-600 text-white">
                חזור
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

// ─── Active Room Component ─────────────────────────────────────────────────

interface ActiveRoomProps {
  appointmentId: string
  otherParty: string
  complaint: string
  patientId: string
  roomName: string
  supabase: ReturnType<typeof getClient>
  onLeave: () => void
  profile: User | null
  router: ReturnType<typeof useRouter>
}

function ActiveRoom({ appointmentId, otherParty, complaint, patientId, roomName, supabase, onLeave, profile, router }: ActiveRoomProps) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  const [elapsed, setElapsed] = useState(0)
  const [screenSharing, setScreenSharing] = useState(false)

  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const { chatMessages } = useChat()
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const unreadCount = chatOpen ? 0 : chatMessages.length - lastSeenCount

  // Documents state (doctor only)
  const [docsOpen, setDocsOpen] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  // Recording state (doctor only)
  const [recording, setRecording] = useState(false)
  const [egressId, setEgressId] = useState<string | null>(null)
  const [showConsentDialog, setShowConsentDialog] = useState(false)

  // Reconnection state
  const [reconnecting, setReconnecting] = useState(false)

  // Participant wait timeout
  const [waitTimeout, setWaitTimeout] = useState(false)

  const isDoctor = profile?.role === 'doctor'

  // Timer
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  // Participant wait timeout: show message after 10 minutes
  useEffect(() => {
    if (remoteParticipants.length > 0) {
      setWaitTimeout(false)
      return
    }
    const timeout = setTimeout(() => {
      if (remoteParticipants.length === 0) setWaitTimeout(true)
    }, 10 * 60 * 1000) // 10 minutes
    return () => clearTimeout(timeout)
  }, [remoteParticipants.length])

  // Auto-reconnect: listen for connection state changes
  useEffect(() => {
    const handleReconnecting = () => setReconnecting(true)
    const handleReconnected = () => setReconnecting(false)

    room.on(RoomEvent.Reconnecting, handleReconnecting)
    room.on(RoomEvent.Reconnected, handleReconnected)

    return () => {
      room.off(RoomEvent.Reconnecting, handleReconnecting)
      room.off(RoomEvent.Reconnected, handleReconnected)
    }
  }, [room])

  // Track screen share state
  useEffect(() => {
    const isSharing = localParticipant.isScreenShareEnabled
    setScreenSharing(isSharing)
  }, [localParticipant.isScreenShareEnabled])

  // Update last seen count when chat opens
  useEffect(() => {
    if (chatOpen) setLastSeenCount(chatMessages.length)
  }, [chatOpen, chatMessages.length])

  // Close documents panel when chat opens and vice versa
  const toggleChat = () => {
    setChatOpen(prev => {
      if (!prev) setDocsOpen(false)
      return !prev
    })
  }

  const toggleDocs = async () => {
    const willOpen = !docsOpen
    setDocsOpen(willOpen)
    if (willOpen) {
      setChatOpen(false)
      if (documents.length === 0) await loadDocuments()
    }
  }

  const loadDocuments = async () => {
    if (!patientId) return
    setDocsLoading(true)
    try {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      setDocuments((data || []) as unknown as Document[])
    } catch {
      // Silently fail — documents panel will show empty
    } finally {
      setDocsLoading(false)
    }
  }

  const openDocument = async (storagePath: string) => {
    try {
      const { data } = await supabase.storage
        .from('medical-documents')
        .createSignedUrl(storagePath, 300)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch {
      // Silently fail — user can retry
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const handleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!screenSharing)
    } catch {
      // User cancelled screen share picker
    }
  }

  const handleStartRecording = async () => {
    try {
      const res = await fetch('/api/livekit/recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, appointmentId, consentGiven: true }),
      })
      if (!res.ok) return
      const { egressId: eid } = await res.json()
      setEgressId(eid)
      setRecording(true)
      setShowConsentDialog(false)
    } catch {
      // Recording failed silently
    }
  }

  const handleStopRecording = async () => {
    if (!egressId) return
    try {
      await fetch('/api/livekit/recording', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egressId, appointmentId }),
      })
    } catch {
      // Stop failed silently
    }
    setRecording(false)
    setEgressId(null)
  }

  const handleDisconnect = async () => {
    if (recording) await handleStopRecording()
    const duration = elapsed

    // Save chat messages to audit_logs before disconnecting
    if (chatMessages.length > 0) {
      try {
        const serialized = chatMessages.map(msg => ({
          id: msg.id,
          timestamp: msg.timestamp,
          message: msg.message,
          from: msg.from?.identity || 'unknown',
          name: msg.from?.name || msg.from?.identity || 'unknown',
        }))
        await supabase.from('audit_logs').insert({
          user_id: profile?.id || null,
          action: 'VIDEO_CHAT_SAVED',
          resource_type: 'appointment',
          resource_id: appointmentId,
          metadata: {
            message_count: chatMessages.length,
            messages: serialized,
            saved_at: new Date().toISOString(),
          },
        })
      } catch {
        // Non-critical — chat save failure shouldn't block disconnect
      }
    }

    room.disconnect()
    try {
      await supabase.from('appointments').update({
        video_ended_at: new Date().toISOString(),
        video_duration_seconds: duration,
      }).eq('id', appointmentId)
    } catch {
      // Non-critical — video already ended
    }
    onLeave()
  }

  const getFileIcon = (fileType: string) => {
    const cls = 'w-5 h-5'
    if (fileType.startsWith('image/')) return <svg className={`${cls} text-purple-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
    if (fileType === 'application/pdf') return <svg className={`${cls} text-red-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    if (fileType.includes('word') || fileType.includes('document')) return <svg className={`${cls} text-blue-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
    return <svg className={`${cls} text-slate-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white" dir="rtl">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between z-10 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-sm">{otherParty || 'שיחת וידאו'}</h1>
          <span className="text-slate-400 text-xs hidden sm:inline">{complaint}</span>
        </div>
        <div className="flex items-center gap-3">
          {recording && (
            <span className="flex items-center gap-1.5 bg-red-600/90 px-2.5 py-1 rounded-md text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              מוקלט
            </span>
          )}
          <RoomConnectionIndicator />
          <span className="bg-red-600/90 px-2.5 py-1 rounded-md text-xs font-mono animate-pulse">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-slate-400">
            {remoteParticipants.length + 1} משתתפים
          </span>
        </div>
      </header>

      {/* Video Grid + Side Panels */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Main video area */}
        <div className="flex-1 relative">
          <RoomAudioRenderer />
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>

          {/* Reconnecting overlay */}
          {reconnecting && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="bg-yellow-900/90 backdrop-blur-sm rounded-xl px-6 py-4 text-center border border-yellow-600/50">
                <Spinner size="md" className="mx-auto mb-2" />
                <p className="text-yellow-200 text-sm font-medium">מתחבר מחדש...</p>
                <p className="text-yellow-300/70 text-xs mt-1">בודק את החיבור לרשת</p>
              </div>
            </div>
          )}

          {/* Participant overlay info */}
          {remoteParticipants.length === 0 && !reconnecting && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl px-6 py-4 text-center max-w-sm">
                <Spinner size="md" className="mx-auto mb-2" />
                <p className="text-slate-300 text-sm">ממתין ל{otherParty || 'משתתף נוסף'}...</p>
                {waitTimeout && (
                  <div className="mt-3 text-yellow-400 text-xs space-y-1">
                    <p className="font-medium">ההמתנה ארכה יותר מ-10 דקות</p>
                    <p className="text-yellow-400/70">ייתכן שהמשתתף האחר עדיין לא הצטרף. ניתן להמשיך להמתין או לסיים את השיחה.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Chat Side Panel */}
        {chatOpen && (
          <div className="w-80 max-sm:absolute max-sm:inset-0 max-sm:w-full bg-slate-800 border-r border-slate-700/50 flex flex-col z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <h3 className="font-bold text-sm">צ&apos;אט</h3>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-hidden [&_.lk-chat]:h-full [&_.lk-chat]:bg-transparent [&_.lk-chat-messages]:text-white [&_.lk-chat-form-input]:bg-slate-700 [&_.lk-chat-form-input]:text-white [&_.lk-chat-form-input]:border-slate-600 [&_.lk-chat-form-button]:bg-blue-600">
              <Chat style={{ height: '100%' }} />
            </div>
          </div>
        )}

        {/* Documents Side Panel (doctor only) */}
        {docsOpen && isDoctor && (
          <div className="w-80 max-sm:absolute max-sm:inset-0 max-sm:w-full bg-slate-800 border-r border-slate-700/50 flex flex-col z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <h3 className="font-bold text-sm">מסמכי מטופל</h3>
              <button onClick={() => setDocsOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                  <p className="text-sm">אין מסמכים למטופל זה</p>
                </div>
              ) : (
                documents.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => openDocument(doc.storage_path)}
                    className="w-full text-right bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0">{getFileIcon(doc.file_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{doc.file_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {doc.category && (
                            <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">{doc.category}</span>
                          )}
                          <span className="text-xs text-slate-400">
                            {new Date(doc.created_at).toLocaleDateString('he-IL')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Consent Dialog for Recording */}
      {showConsentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-slate-700 text-center space-y-4">
            <div className="flex justify-center">
              <svg className="w-10 h-10 text-red-400" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>
            </div>
            <h3 className="text-lg font-bold">הקלטת שיחה</h3>
            <p className="text-slate-300 text-sm">
              השיחה תוקלט לצורכי תיעוד רפואי. יש לוודא שכל המשתתפים מסכימים להקלטה.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleStartRecording}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                התחל הקלטה
              </Button>
              <Button
                onClick={() => setShowConsentDialog(false)}
                variant="outline"
                className="flex-1 border-slate-600 text-white"
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-800/80 backdrop-blur-sm border-t border-slate-700/50 px-4 py-3">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {/* Mic Toggle */}
          <TrackToggle
            source={Track.Source.Microphone}
            className="lk-button flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-slate-700 hover:bg-slate-600 text-white"
          />

          {/* Camera Toggle */}
          <TrackToggle
            source={Track.Source.Camera}
            className="lk-button flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-slate-700 hover:bg-slate-600 text-white"
          />

          {/* Screen Share */}
          <button
            onClick={handleScreenShare}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              screenSharing
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title={screenSharing ? 'הפסק שיתוף מסך' : 'שתף מסך'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            <span className="hidden sm:inline">{screenSharing ? 'הפסק שיתוף' : 'שתף מסך'}</span>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={toggleChat}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              chatOpen
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title="צ'אט"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            <span className="hidden sm:inline">צ&apos;אט</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Documents (doctor only) */}
          {isDoctor && (
            <button
              onClick={toggleDocs}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                docsOpen
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
              title="מסמכי מטופל"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <span className="hidden sm:inline">מסמכים</span>
            </button>
          )}

          {/* Recording (doctor only) */}
          {isDoctor && (
            <button
              onClick={recording ? handleStopRecording : () => setShowConsentDialog(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                recording
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
              title={recording ? 'הפסק הקלטה' : 'הקלט שיחה'}
            >
              {recording
                ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>
              }
              <span className="hidden sm:inline">{recording ? 'הפסק הקלטה' : 'הקלטה'}</span>
            </button>
          )}

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            <span className="hidden sm:inline">סיים שיחה</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Connection Quality Indicator Component ──────────────────────────────

function RoomConnectionIndicator() {
  const room = useRoomContext()
  const [quality, setQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown)

  useEffect(() => {
    const handleQualityChanged = (q: ConnectionQuality) => setQuality(q)
    room.localParticipant.on(RoomEvent.ConnectionQualityChanged, handleQualityChanged)
    return () => {
      room.localParticipant.off(RoomEvent.ConnectionQualityChanged, handleQualityChanged)
    }
  }, [room])

  const qualityConfig: Record<ConnectionQuality, { label: string; color: string; bars: number }> = {
    [ConnectionQuality.Excellent]: { label: 'מצוין', color: 'text-green-400', bars: 3 },
    [ConnectionQuality.Good]: { label: 'טוב', color: 'text-green-400', bars: 3 },
    [ConnectionQuality.Poor]: { label: 'חלש', color: 'text-yellow-400', bars: 2 },
    [ConnectionQuality.Lost]: { label: 'מנותק', color: 'text-red-400', bars: 0 },
    [ConnectionQuality.Unknown]: { label: 'מתחבר', color: 'text-slate-400', bars: 1 },
  }

  const cfg = qualityConfig[quality]

  return (
    <div className={`flex items-center gap-1.5 ${cfg.color}`} title={`איכות חיבור: ${cfg.label}`}>
      <div className="flex items-end gap-0.5 h-3.5">
        {[1, 2, 3].map(bar => (
          <div
            key={bar}
            className={`w-1 rounded-full transition-all ${
              bar <= cfg.bars ? 'bg-current' : 'bg-slate-600'
            }`}
            style={{ height: `${(bar / 3) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-xs hidden sm:inline">{cfg.label}</span>
    </div>
  )
}
