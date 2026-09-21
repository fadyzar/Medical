'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ConfirmationCard, type ConfirmationCardData } from '@/components/ai/ConfirmationCard'

type CardState = 'pending' | 'working' | 'confirmed' | 'cancelled' | 'failed'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  card?: ConfirmationCardData
  cardState?: CardState
}

type ConversationSummary = { id: string; title: string; updatedAt: string; messageCount: number }

const SUGGESTIONS: Record<string, string[]> = {
  patient: ['מתי התור הבא שלי?', 'אני רוצה לקבוע תור', 'איך עובדת שיחת הווידאו?'],
  doctor: ['מה יש לי היום?', 'מי המטופל הבא שלי?', 'מצא מועד פנוי בשבוע הבא'],
  staff: ['מה היומן של היום?', 'חפש מטופל', 'אילו תורים ממתינים לאישור?'],
  admin: ['מה היומן של היום?', 'חפש מטופל', 'אילו תורים ממתינים לאישור?'],
}

function uid() { return Math.random().toString(36).slice(2) }

/** The CANNA mark, used as the assistant's identity everywhere it appears. */
function CannaMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/canna-mark.png"
      alt="CANNA"
      width={size}
      height={size}
      className="rounded-lg object-contain"
      priority
    />
  )
}

export function CannaAssistant({ role }: { role: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [history, setHistory] = useState<ConversationSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = SUGGESTIONS[role] ?? SUGGESTIONS.patient

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Escape closes the panel, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/assistant')
      if (!res.ok) return
      const data = await res.json() as { conversations: ConversationSummary[] }
      setHistory(data.conversations || [])
    } catch { /* the panel just stays empty */ }
  }, [])

  useEffect(() => { if (open) loadHistory() }, [open, loadHistory])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setInput('')
    setBusy(true)
    setMessages(prev => [...prev, { id: uid(), role: 'user', text: trimmed }])

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId }),
      })
      const data = await res.json() as {
        conversationId?: string; reply?: string; confirmation?: ConfirmationCardData | null; error?: string
      }

      if (!res.ok) {
        setMessages(prev => [...prev, { id: uid(), role: 'assistant', text: data.error || 'משהו השתבש. נסה שוב.' }])
        return
      }

      if (data.conversationId) setConversationId(data.conversationId)
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant',
        text: data.reply || '',
        card: data.confirmation ?? undefined,
        cardState: data.confirmation ? 'pending' : undefined,
      }])
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', text: 'שגיאת רשת. בדוק את החיבור ונסה שוב.' }])
    } finally {
      setBusy(false)
    }
  }, [busy, conversationId])

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
    } catch {
      setMessages(prev => [
        ...prev.map(m => m.id === messageId ? { ...m, cardState: 'failed' as CardState } : m),
        { id: uid(), role: 'assistant' as const, text: 'שגיאת רשת. הפעולה לא בוצעה.' },
      ])
    }
  }, [conversationId])

  const startNew = () => {
    setMessages([])
    setConversationId(null)
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  const openConversation = async (id: string) => {
    // Reopening shows a fresh panel bound to the existing thread — the server
    // still holds the full transcript and keeps answering in context.
    setConversationId(id)
    setMessages([])
    setHistoryOpen(false)
  }

  // ── Floating entry point ───────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="פתח את העוזר החכם של CANNA"
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2.5 ps-3 pe-4 py-2.5 rounded-full bg-white border border-slate-200 shadow-lg hover:shadow-xl hover:border-teal-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      >
        <CannaMark size={26} />
        <span className="text-sm font-semibold text-slate-800">עוזר חכם</span>
      </button>
    )
  }

  // ── Full-screen chat ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="העוזר החכם של CANNA">
      {/* Header */}
      <header className="shrink-0 border-b bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <CannaMark size={32} />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 leading-tight">העוזר החכם של CANNA</h2>
            <p className="text-xs text-slate-500 leading-tight">שאל כל שאלה, או בקש ממני לבצע פעולה</p>
          </div>

          <button
            onClick={() => setHistoryOpen(v => !v)}
            aria-label="היסטוריית שיחות"
            aria-expanded={historyOpen}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button
            onClick={startNew}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors"
          >
            שיחה חדשה
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="סגור"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {historyOpen && (
          <div className="border-t bg-slate-50">
            <div className="max-w-3xl mx-auto px-4 py-3">
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">עדיין אין שיחות קודמות.</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {history.map(c => (
                    <li key={c.id}>
                      <button
                        onClick={() => openConversation(c.id)}
                        className={cn(
                          'w-full text-right px-3 py-2 rounded-lg text-sm hover:bg-white transition-colors',
                          c.id === conversationId ? 'bg-white font-semibold text-teal-700' : 'text-slate-700',
                        )}
                      >
                        {c.title}
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div className="inline-flex mb-4"><CannaMark size={56} /></div>
              <h3 className="text-lg font-bold text-slate-900">במה אפשר לעזור?</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                אני יכול להסביר איך המערכת עובדת, ולבצע עבורך פעולות אמיתיות.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3.5 py-2 rounded-full border border-slate-200 text-sm text-slate-700 hover:border-teal-300 hover:bg-teal-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'justify-end')}>
              {m.role === 'assistant' && <div className="shrink-0 mt-0.5"><CannaMark size={28} /></div>}
              <div className={cn('max-w-[85%] space-y-2.5', m.role === 'user' && 'max-w-[80%]')}>
                {m.text && (
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
                      m.role === 'user'
                        ? 'bg-teal-600 text-white rounded-se-md'
                        : 'bg-slate-100 text-slate-800 rounded-ss-md',
                    )}
                  >
                    {m.text}
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
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5"><CannaMark size={28} /></div>
              <div className="bg-slate-100 rounded-2xl rounded-ss-md px-4 py-3 flex gap-1.5" aria-label="מקליד">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            className="flex items-end gap-2"
          >
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
              placeholder="כתוב הודעה…"
              disabled={busy}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="שלח"
              className="shrink-0 w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              <svg className="w-4.5 h-4.5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
