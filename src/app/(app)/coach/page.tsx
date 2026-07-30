'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/page-shell'
import { useCoachThread } from '@/hooks/use-coach-thread'
import { C, FONT } from '@/lib/theme'

type Message = {
  role: 'user' | 'coach'
  content: string
  /** Set when the request failed, so the bubble renders as an error. */
  failed?: boolean
}

// Starter prompts — these map onto the coach's actual tools (PRs, progression
// state, volume trend, program rules) so a first-time tap always works.
const SUGGESTIONS = [
  'What are my current PRs?',
  'Which lifts are closest to a deload?',
  'Is my volume trending up?',
  "What are this program's progression rules?",
]

export default function CoachPage() {
  const { threadId, resetThread } = useCoachThread()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  async function send(question: string) {
    const trimmed = question.trim()
    if (!trimmed || sending || !threadId) return

    setInput('')
    setMessages((m) => [...m, { role: 'user', content: trimmed }])
    setSending(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, threadId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg =
          res.status === 504
            ? 'The coach took too long to respond. Try again.'
            : res.status === 502
              ? 'The coach service is unreachable. Is the sidecar running?'
              : (body as { error?: string }).error ?? 'Something went wrong.'
        setMessages((m) => [...m, { role: 'coach', content: msg, failed: true }])
        return
      }
      const data = (await res.json()) as { answer?: string }
      setMessages((m) => [
        ...m,
        { role: 'coach', content: data.answer ?? '(empty response)' },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'coach', content: 'Network error. Check your connection.', failed: true },
      ])
    } finally {
      setSending(false)
    }
  }

  function startNewConversation() {
    setMessages([])
    setInput('')
    resetThread()
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, paddingBottom: 132 }}>
      <PageHeader title="COACH" accent={C.accentCombo}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: '0.65rem', color: C.muted }}>
            asks your training data — answers are tool-grounded
          </span>
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              style={{
                background: 'none',
                border: 'none',
                color: C.mutedDarker,
                fontFamily: FONT.mono,
                fontSize: '0.65rem',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              new chat
            </button>
          )}
        </div>
      </PageHeader>

      <div style={{ padding: '14px 16px 0' }}>
        {messages.length === 0 ? (
          <div style={{ paddingTop: 28 }}>
            <p style={{ fontFamily: FONT.mono, fontSize: '0.7rem', color: C.mutedDark, textAlign: 'center', marginBottom: 18 }}>
              Ask about your lifts, progress, or program.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={!threadId}
                  style={{
                    textAlign: 'left',
                    padding: '11px 13px',
                    backgroundColor: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.text,
                    fontFamily: FONT.mono,
                    fontSize: '0.72rem',
                    cursor: threadId ? 'pointer' : 'default',
                    minHeight: 44,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  maxWidth: '86%',
                  padding: '9px 12px',
                  borderRadius: 4,
                  backgroundColor: m.role === 'user' ? 'rgba(232,255,71,0.08)' : C.surface,
                  border: `1px solid ${
                    m.failed ? C.danger : m.role === 'user' ? C.accentLift : C.border
                  }`,
                  color: m.failed ? C.danger : C.text,
                  fontFamily: FONT.mono,
                  fontSize: '0.73rem',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 4,
                backgroundColor: C.surface,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontFamily: FONT.mono,
                fontSize: '0.73rem',
              }}
            >
              thinking...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Composer — sits above the bottom nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 56,
          left: 0,
          right: 0,
          backgroundColor: C.bg,
          borderTop: `1px solid ${C.border}`,
          padding: '10px 16px',
          display: 'flex',
          gap: 8,
          zIndex: 20,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder={threadId ? 'ask your coach...' : 'loading...'}
          disabled={!threadId || sending}
          style={{
            flex: 1,
            height: 44,
            padding: '0 12px',
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.text,
            fontFamily: FONT.mono,
            fontSize: '0.75rem',
            outline: 'none',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!threadId || sending || !input.trim()}
          style={{
            flex: '0 0 auto',
            minWidth: 64,
            height: 44,
            backgroundColor: input.trim() && !sending ? C.accentCombo : C.border,
            border: 'none',
            borderRadius: 4,
            color: input.trim() && !sending ? '#000' : C.mutedDarker,
            fontFamily: FONT.mono,
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: input.trim() && !sending ? 'pointer' : 'default',
          }}
        >
          {sending ? '...' : 'ask'}
        </button>
      </div>
    </div>
  )
}
