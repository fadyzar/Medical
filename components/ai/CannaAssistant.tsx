'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { ConfirmationCard, type ConfirmationCardData } from '@/components/ai/ConfirmationCard'

type CardState = 'pending' | 'working' | 'confirmed' | 'cancelled' | 'failed'
type NavAction = { type: 'navigate'; label: string; href: string }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  card?: ConfirmationCardData
  cardState?: CardState
  actions?: NavAction[]
  /** The user text to resend when this is an error bubble. */
  retry?: string
}

type ConversationSummary = { id: string; title: string; updatedAt: string; messageCount: number }

type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'done'; conversationId: string; reply: string; confirmation: ConfirmationCardData | null; actions: NavAction[] }
  | { type: 'error'; error: string }

const SUGGESTIONS: Record<string, string[]> = {
  patient: ['מתי התור הבא שלי?', 'אני רוצה לקבוע תור', 'איך מתכוננים לשיחת וידאו?', 'אילו מסמכים העליתי?'],
  doctor: ['מה יש לי היום?', 'מי המטופל הבא שלי?', 'מצא מועד פנוי בשבוע הבא', 'איך עובד סיכום ה-AI?'],
  staff: ['מה היומן של היום?', 'אילו תורים ממתינים לאישור?', 'חפש מטופל', 'האם יש בעיות בהגדרות המרפאה?'],
  admin: ['מה מצב המרפאה?', 'איך מחברים WhatsApp?', 'תן לי סיכום של החודש', 'הזמן רופא חדש'],
}

/** Page-aware first suggestion: what people usually want on the page they are on. */
const PAGE_HINTS: Array<{ match: string; text: string }> = [
  { match: '/dashboard/admin/integrations', text: 'האם האינטגרציות מוגדרות כמו שצריך?' },
  { match: '/dashboard/admin/users', text: 'איך מזמינים רופא חדש?' },
  { match: '/dashboard/admin/reports', text: 'תן לי סיכום של 30 הימים האחרונים' },
  { match: '/dashboard/doctor/calendar', text: 'מה יש לי מחר?' },
  { match: '/dashboard/doctor/appointments', text: 'איזה תורים מחכים לאישור שלי?' },
  { match: '/dashboard/patient/my-documents', text: 'אילו מסמכים כדאי להעלות לפני ייעוץ?' },
  { match: '/dashboard/patient/new-appointment', text: 'עזור לי לבחור רופא' },
]

function uid() { return Math.random().toString(36).slice(2) }

/** The CANNA mark, used as the assistant's identity everywhere it appears. */
function CannaMark({ size = 28 }: { size?: number }) {
  return (
    <Image src="/canna-mark.png" alt="" width={size} height={size} className="rounded-lg object-contain" priority />
  )
}

/** Markdown for assistant replies. No raw HTML; links stay inside the app. */
function Reply({ text }: { text: string }) {
  return (
    <ReactMarkdown
      skipHtml
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ps-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ps-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        a: ({ children, href }) => (href?.startsWith('/')
          ? <a href={href} className="text-teal-700 underline">{children}</a>
          : <span>{children}</span>),
        code: ({ children }) => <code className="px-1 rounded bg-slate-200 text-[13px]">{children}</code>,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

export function CannaAssistant({ role }: { role: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [history, setHistory] = useState<ConversationSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  const base = SUGGESTIONS[role] ?? SUGGESTIONS.patient
  const hint = PAGE_HINTS.find(h => pathname?.startsWith(h.match))?.text
  const suggestions = hint ? [hint, ...base.filter(s => s !== hint)].slice(0, 4) : base

  // Keep the newest message in view as the conversation grows.
  // Instant, not smooth: a smooth scroll started before a long reply finishes
  // rendering stops short of the bottom (and of the confirmation card).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    const id = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
    return () => cancelAnimationFrame(id)
  }, [messages, busy, status])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const close = useCallback(() => {
    setOpen(false)
    setHistoryOpen(false)
    // Return focus to where the user was.
    requestAnimationFrame(() => launcherRef.current?.focus())
  }, [])

  // Escape closes the panel, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/assistant')
      if (!res.ok) return
      const data = await res.json() as { conversations: ConversationSummary[] }
      setHistory(data.conversations || [])
    } catch { /* the panel just stays empty */ }
  }, [])


  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setInput('')
    setBusy(true)
    setStatus('חושב…')
    setMessages(prev => [...prev, { id: uid(), role: 'user', text: trimmed }])

    const fail = (error: string) => setMessages(prev => [...prev, { id: uid(), role: 'assistant', text: error, retry: trimmed }])

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId, page: pathname }),
      })

      // Errors before the stream starts come back as plain JSON.
      if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('ndjson')) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        fail(data.error || 'משהו השתבש. נסה שוב.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false
      while (!finished) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line) continue
          const event = JSON.parse(line) as StreamEvent
          if (event.type === 'status') setStatus(event.text)
          else if (event.type === 'error') { fail(event.error); finished = true }
          else if (event.type === 'done') {
            setConversationId(event.conversationId)
            setMessages(prev => [...prev, {
              id: uid(),
              role: 'assistant',
              text: event.reply,
              card: event.confirmation ?? undefined,
              cardState: event.confirmation ? 'pending' : undefined,
              actions: event.actions?.length ? event.actions : undefined,
            }])
            finished = true
          }
        }
      }
      if (!finished) fail('החיבור נקטע לפני שהתקבלה תשובה. נסה שוב.')
    } catch {
      fail('שגיאת רשת. בדוק את החיבור ונסה שוב.')
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }, [busy, conversationId, pathname])

  const resolveCard = useCallback(async (messageId: string, actionId: string, decision: 'confirm' | 'cancel') => {
    if (!conversationId) return
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, cardState: 'working' } : m))

    try {
      const res = await fetch('/api/ai/assistant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, actionId, decision }),
      })
      const data = await res.json() as { ok?: boolean; message?: string; error?: string }

      const nextState: CardState = !res.ok ? 'failed' : decision === 'cancel' ? 'cancelled' : 'confirmed'
      setMessages(prev => [
        ...prev.map(m => m.id === messageId ? { ...m, cardState: nextState } : m),
        { id: uid(), role: 'assistant' as const, text: data.message || data.error || '' },
      ])
      // A confirmed change should be visible on the page behind the panel.
      if (res.ok && decision === 'confirm') router.refresh()
    } catch {
      setMessages(prev => [
        ...prev.map(m => m.id === messageId ? { ...m, cardState: 'failed' as CardState } : m),
        { id: uid(), role: 'assistant' as const, text: 'שגיאת רשת. הפעולה לא בוצעה.' },
      ])
    }
  }, [conversationId, router])

  const startNew = () => {
    setMessages([])
    setConversationId(null)
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  const openConversation = async (id: string) => {
    setConversationId(id)
    setMessages([])
    setHistoryOpen(false)
    setLoadingThread(true)
    try {
      const res = await fetch(`/api/ai/assistant?id=${id}`)
      if (res.ok) {
        const data = await res.json() as { messages: Array<{ role: 'user' | 'assistant'; text: string }> }
        setMessages(data.messages.map(m => ({ id: uid(), role: m.role, text: m.text })))
      }
    } catch { /* the thread still continues on the server */ } finally {
      setLoadingThread(false)
    }
  }

  const go = (href: string) => {
    router.push(href)
    // On a phone the panel covers the page — get out of the way.
    if (window.innerWidth < 768) setOpen(false)
  }

  // ── Floating entry point ───────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        ref={launcherRef}
        onClick={() => { setOpen(true); loadHistory() }}
        aria-label="פתח את העוזר החכם של CANNA"
        className="fixed bottom-6 left-[5.5rem] z-40 flex items-center gap-2.5 ps-3 pe-4 py-2.5 rounded-full bg-white border border-slate-200 shadow-lg hover:shadow-xl hover:border-teal-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      >
        <CannaMark size={26} />
        <span className="text-sm font-semibold text-slate-800">עוזר חכם</span>
      </button>
    )
  }

  // ── Panel: side sheet on desktop (expandable), full screen on mobile ──────
  return (
    <div
      className={cn(
        // Above the global accessibility button (z 9998), which otherwise covers the composer.
        'fixed z-[10000] flex flex-col bg-white',
        expanded
          ? 'inset-0'
          : 'inset-0 md:inset-auto md:bottom-4 md:left-4 md:top-4 md:w-[440px] md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl md:overflow-hidden',
      )}
      role="dialog"
      aria-modal={expanded}
      aria-label="העוזר החכם של CANNA"
    >
      {/* Header */}
      <header className="shrink-0 border-b bg-white/95 backdrop-blur">
        <div className={cn('px-4 py-3 flex items-center gap-2', expanded && 'max-w-3xl mx-auto w-full')}>
          <CannaMark size={30} />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 leading-tight">העוזר החכם של CANNA</h2>
            <p className="text-xs text-slate-500 leading-tight truncate">שאל שאלה, או בקש ממני לבצע פעולה</p>
          </div>

          <button
            onClick={() => setHistoryOpen(v => !v)}
            aria-label="היסטוריית שיחות"
            aria-expanded={historyOpen}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'הקטן חלון' : 'הגדל למסך מלא'}
            className="hidden md:inline-flex p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {expanded ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
          </button>
          <button
            onClick={startNew}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            שיחה חדשה
          </button>
          <button
            onClick={close}
            aria-label="סגור"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {historyOpen && (
          <div className="border-t bg-slate-50">
            <div className={cn('px-4 py-3', expanded && 'max-w-3xl mx-auto')}>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">עדיין אין שיחות קודמות.</p>
              ) : (
                <ul className="space-y-1 max-h-56 overflow-y-auto">
                  {history.map(c => (
                    <li key={c.id}>
                      <button
                        onClick={() => openConversation(c.id)}
                        className={cn(
                          'w-full text-right px-3 py-2 rounded-lg text-sm hover:bg-white transition-colors flex items-center justify-between gap-2',
                          c.id === conversationId ? 'bg-white font-semibold text-teal-700' : 'text-slate-700',
                        )}
                      >
                        <span className="truncate">{c.title}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {new Date(c.updatedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" aria-live="polite">
        <div className={cn('px-4 py-5 space-y-4', expanded && 'max-w-3xl mx-auto')}>
          {messages.length === 0 && !loadingThread && (
            <div className="text-center py-8">
              <div className="inline-flex mb-4"><CannaMark size={52} /></div>
              <h3 className="text-lg font-bold text-slate-900">במה אפשר לעזור?</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6 px-4">
                אני מכיר את המערכת, יכול להסביר כל מסך ולבצע עבורך פעולות — תמיד באישורך.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3.5 py-2 rounded-full border border-slate-200 text-sm text-slate-700 hover:border-teal-300 hover:bg-teal-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingThread && <p className="text-center text-sm text-slate-400 py-8">טוען את השיחה…</p>}

          {messages.map(m => (
            <div key={m.id} className={cn('flex gap-2.5', m.role === 'user' && 'justify-end')}>
              {m.role === 'assistant' && <div className="shrink-0 mt-0.5"><CannaMark size={26} /></div>}
              <div className={cn('max-w-[88%] space-y-2.5 min-w-0', m.role === 'user' && 'max-w-[80%]')}>
                {m.text && (
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
                      m.role === 'user'
                        ? 'bg-teal-600 text-white rounded-se-md whitespace-pre-wrap'
                        : m.retry
                          ? 'bg-red-50 text-red-800 border border-red-100 rounded-ss-md'
                          : 'bg-slate-100 text-slate-800 rounded-ss-md',
                    )}
                  >
                    {m.role === 'assistant' ? <Reply text={m.text} /> : m.text}
                  </div>
                )}
                {m.retry && (
                  <button
                    onClick={() => send(m.retry!)}
                    disabled={busy}
                    className="text-xs font-semibold text-teal-700 hover:underline disabled:opacity-40"
                  >
                    נסה שוב
                  </button>
                )}
                {m.actions && (
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map(a => (
                      <button
                        key={a.href}
                        onClick={() => go(a.href)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-teal-200 text-sm font-semibold text-teal-700 hover:bg-teal-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                        עבור ל{a.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.card && (
                  <ConfirmationCard
                    card={m.card}
                    state={m.cardState ?? 'pending'}
                    onConfirm={() => resolveCard(m.id, m.card!.actionId, 'confirm')}
                    onCancel={() => resolveCard(m.id, m.card!.actionId, 'cancel')}
                  />
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-2.5">
              <div className="shrink-0 mt-0.5"><CannaMark size={26} /></div>
              <div className="bg-slate-100 rounded-2xl rounded-ss-md px-4 py-2.5 flex items-center gap-2.5" role="status">
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </span>
                {status && <span className="text-xs text-slate-500">{status}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t bg-white">
        <div className={cn('px-4 py-3', expanded && 'max-w-3xl mx-auto')}>
          <form onSubmit={e => { e.preventDefault(); send(input) }} className="flex items-end gap-2">
            <label htmlFor="canna-assistant-input" className="sr-only">ההודעה שלך</label>
            <textarea
              id="canna-assistant-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                // Enter sends; Shift+Enter is a newline.
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
              }}
              rows={1}
              maxLength={4000}
              placeholder="כתוב הודעה…"
              disabled={busy}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="שלח"
              className="shrink-0 w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <p className="text-[11px] text-slate-400 mt-1.5 text-center">
            העוזר אינו מספק ייעוץ רפואי. פעולות שמשנות נתונים תמיד מבקשות את אישורך.
          </p>
        </div>
      </div>
    </div>
  )
}
