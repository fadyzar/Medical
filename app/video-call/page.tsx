'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Track, RoomEvent, ConnectionQuality } from 'livekit-client'

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

  useEffect(() => {
    if (!id) { setError('חסר מזהה תור'); setState('error'); return }
    init(id)
    return () => {
      previewStream?.getTracks().forEach(t => t.stop())
    }
  }, [id])

  const init = async (appointmentId: string) => {
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

    // Payment wall
    if (typedApt.payment_amount && typedApt.payment_amount > 0 && typedApt.payment_status !== 'completed') {
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

  const handleDisconnected = useCallback(async () => {
    if (!id) return
    await supabase.from('appointments').update({
      video_ended_at: new Date().toISOString(),
    }).eq('id', id)
    setState('disconnected')
  }, [id, supabase])

  const handleConnected = useCallback(async () => {
    if (!id) return
    await supabase.from('appointments').update({
      status: 'in_progress',
      video_started_at: new Date().toISOString(),
    }).eq('id', id)
  }, [id, supabase])

  const otherParty = appointment
    ? profile?.role === 'doctor'
      ? `${appointment.patient?.first_name} ${appointment.patient?.last_name}`
      : `ד"ר ${appointment.doctor?.first_name} ${appointment.doctor?.last_name}`
    : ''

  // Connected state with LiveKit room
  if (state === 'connected' && token && livekitUrl) {
    return (
      <div className="min-h-screen bg-gray-900" dir="rtl">
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col" dir="rtl">
      <header className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold">{otherParty || 'שיחת וידאו'}</h1>
          <p className="text-gray-400 text-xs">{appointment?.chief_complaint}</p>
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
          <Card className="max-w-md w-full bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center space-y-4">
              <div className="text-4xl">💳</div>
              <h2 className="text-xl font-bold">נדרש תשלום</h2>
              <p className="text-gray-400">יש לבצע תשלום לפני הצטרפות לשיחת הווידאו</p>
              <Button onClick={() => router.push(`/dashboard/patient/payment?id=${id}`)} size="lg" className="w-full">
                עבור לתשלום
              </Button>
              <Button onClick={() => router.push('/dashboard/patient/dashboard')} variant="outline" className="w-full border-gray-600 text-white">
                חזור לדשבורד
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'waiting' && (
          <Card className="max-w-md w-full bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-xl font-bold">חדר המתנה</h2>
              <p className="text-gray-400">בדיקת חומרה — לחצו ״הצטרף לשיחה״ כשתהיו מוכנים</p>

              {/* Preview */}
              <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
                {previewStream && hasCamera ? (
                  <video
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(el) => { if (el && previewStream) el.srcObject = previewStream }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📷</div>
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

        {state === 'disconnected' && (
          <Card className="max-w-md w-full bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="text-xl font-bold">השיחה הסתיימה</h2>
              <p className="text-gray-400">תודה שהשתמשת בשירות הטלמדיסן שלנו</p>
              <Button
                onClick={() => router.push(
                  profile?.role === 'doctor' ? '/dashboard/doctor/dashboard' : '/dashboard/patient/dashboard'
                )}
                className="w-full"
              >
                חזור לדשבורד
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'error' && (
          <Card className="max-w-md w-full bg-gray-800 border-gray-700">
            <CardContent className="p-6 text-center space-y-4">
              <div className="text-4xl">❌</div>
              <h2 className="text-xl font-bold">שגיאה</h2>
              <p className="text-gray-400">{error}</p>
              <Button onClick={() => router.back()} variant="outline" className="border-gray-600 text-white">
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

  const isDoctor = profile?.role === 'doctor'

  // Timer
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

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
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    setDocuments((data || []) as unknown as Document[])
    setDocsLoading(false)
  }

  const openDocument = async (storagePath: string) => {
    const { data } = await supabase.storage
      .from('medical-documents')
      .createSignedUrl(storagePath, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
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
        body: JSON.stringify({ roomName, appointmentId }),
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
        body: JSON.stringify({ egressId }),
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
    room.disconnect()
    await supabase.from('appointments').update({
      video_ended_at: new Date().toISOString(),
      video_duration_seconds: duration,
    }).eq('id', appointmentId)
    onLeave()
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType === 'application/pdf') return '📄'
    if (fileType.includes('word') || fileType.includes('document')) return '📝'
    return '📎'
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white" dir="rtl">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between z-10 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-sm">{otherParty || 'שיחת וידאו'}</h1>
          <span className="text-gray-400 text-xs hidden sm:inline">{complaint}</span>
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
          <span className="text-xs text-gray-400">
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

          {/* Participant overlay info */}
          {remoteParticipants.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
                <Spinner size="md" className="mx-auto mb-2" />
                <p className="text-gray-300 text-sm">ממתין ל{otherParty || 'משתתף נוסף'}...</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Side Panel */}
        {chatOpen && (
          <div className="w-80 max-sm:absolute max-sm:inset-0 max-sm:w-full bg-gray-800 border-r border-gray-700/50 flex flex-col z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
              <h3 className="font-bold text-sm">צ&apos;אט</h3>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-hidden [&_.lk-chat]:h-full [&_.lk-chat]:bg-transparent [&_.lk-chat-messages]:text-white [&_.lk-chat-form-input]:bg-gray-700 [&_.lk-chat-form-input]:text-white [&_.lk-chat-form-input]:border-gray-600 [&_.lk-chat-form-button]:bg-blue-600">
              <Chat style={{ height: '100%' }} />
            </div>
          </div>
        )}

        {/* Documents Side Panel (doctor only) */}
        {docsOpen && isDoctor && (
          <div className="w-80 max-sm:absolute max-sm:inset-0 max-sm:w-full bg-gray-800 border-r border-gray-700/50 flex flex-col z-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
              <h3 className="font-bold text-sm">מסמכי מטופל</h3>
              <button onClick={() => setDocsOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-sm">אין מסמכים למטופל זה</p>
                </div>
              ) : (
                documents.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => openDocument(doc.storage_path)}
                    className="w-full text-right bg-gray-700/50 hover:bg-gray-700 rounded-lg p-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0">{getFileIcon(doc.file_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{doc.file_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {doc.category && (
                            <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">{doc.category}</span>
                          )}
                          <span className="text-xs text-gray-400">
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
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-gray-700 text-center space-y-4">
            <div className="text-4xl">⏺</div>
            <h3 className="text-lg font-bold">הקלטת שיחה</h3>
            <p className="text-gray-300 text-sm">
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
                className="flex-1 border-gray-600 text-white"
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-800/80 backdrop-blur-sm border-t border-gray-700/50 px-4 py-3">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {/* Mic Toggle */}
          <TrackToggle
            source={Track.Source.Microphone}
            className="lk-button flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-gray-700 hover:bg-gray-600 text-white"
          />

          {/* Camera Toggle */}
          <TrackToggle
            source={Track.Source.Camera}
            className="lk-button flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-gray-700 hover:bg-gray-600 text-white"
          />

          {/* Screen Share */}
          <button
            onClick={handleScreenShare}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              screenSharing
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={screenSharing ? 'הפסק שיתוף מסך' : 'שתף מסך'}
          >
            <span className="text-lg">{screenSharing ? '🖥️' : '💻'}</span>
            <span className="hidden sm:inline">{screenSharing ? 'הפסק שיתוף' : 'שתף מסך'}</span>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={toggleChat}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              chatOpen
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="צ'אט"
          >
            <span className="text-lg">💬</span>
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
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="מסמכי מטופל"
            >
              <span className="text-lg">📋</span>
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
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={recording ? 'הפסק הקלטה' : 'הקלט שיחה'}
            >
              <span className="text-lg">{recording ? '⏹' : '⏺'}</span>
              <span className="hidden sm:inline">{recording ? 'הפסק הקלטה' : 'הקלטה'}</span>
            </button>
          )}

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-all"
          >
            <span className="text-lg">📞</span>
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
    [ConnectionQuality.Unknown]: { label: 'מתחבר', color: 'text-gray-400', bars: 1 },
  }

  const cfg = qualityConfig[quality]

  return (
    <div className={`flex items-center gap-1.5 ${cfg.color}`} title={`איכות חיבור: ${cfg.label}`}>
      <div className="flex items-end gap-0.5 h-3.5">
        {[1, 2, 3].map(bar => (
          <div
            key={bar}
            className={`w-1 rounded-full transition-all ${
              bar <= cfg.bars ? 'bg-current' : 'bg-gray-600'
            }`}
            style={{ height: `${(bar / 3) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-xs hidden sm:inline">{cfg.label}</span>
    </div>
  )
}
