'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/page-shell'
import { useCoachThread, type CoachMessage } from '@/hooks/use-coach-thread'
import { C, FONT } from '@/lib/theme'

// Starter prompts — these map onto the coach's actual tools (PRs, progression
// state, volume trend, program rules) so a first-time tap always works.
const SUGGESTIONS = [
  'What are my current PRs?',
  'Which lifts are closest to a deload?',
  'Is my volume trending up?',
  "What are this program's progression rules?",
]

export default function CoachPage() {
  const { threadId, messages, persist, resetThread } = useCoachThread()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // Text streamed so far for the in-flight answer (not yet persisted).
  const [streamed, setStreamed] = useState('')
  // What the coach is currently doing, e.g. "reading get_personal_record".
  const [status, setStatus] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the newest content in view as the conversation and stream grow.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streamed, status])

  async function send(question: string) {
    const trimmed = question.trim()
    if (!trimmed || sending || !threadId) return

    const withUser: CoachMessage[] = [...messages, { role: 'user', content: trimmed }]
    setInput('')
    persist(withUser)
    setSending(true)
    setStreamed('')
    setStatus('thinking')

    const fail = (content: string) => persist([...withUser, { role: 'coach', content, failed: true }])

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, threadId, stream: true }),
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        // Prefer the server's message — it names the URL it tried and the
        // underlying cause, which generic copy hid.
        const detail = (body as { error?: string }).error
        fail(
          detail ??
            (res.status === 503
              ? 'The coach is currently disabled.'
              : res.status === 502
                ? 'The coach service is unreachable. Is the sidecar running?'
                : 'Something went wrong.')
        )
        return
      }

      // Parse the SSE stream: newline-delimited "data: {json}\n\n" frames.
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''
      let finalAnswer: string | null = null
      let errorCode: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          let ev: { type: string; text?: string; name?: string; answer?: string; code?: string; reset?: boolean }
          try {
            ev = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (ev.type === 'tool') {
            // A tool call means text so far was a preamble, not the answer.
            if (ev.reset) { acc = ''; setStreamed('') }
            setStatus(`reading ${ev.name ?? 'data'}`)
          } else if (ev.type === 'token') {
            setStatus(null)
            acc += ev.text ?? ''
            setStreamed(acc)
          } else if (ev.type === 'revising') {
            // The groundedness guard rejected the answer — discard and re-stream.
            acc = ''
            setStreamed('')
            setStatus('checking answer against your data')
          } else if (ev.type === 'done') {
            finalAnswer = ev.answer ?? acc
          } else if (ev.type === 'error') {
            errorCode = ev.code ?? 'error'
          }
        }
      }

      if (errorCode) {
        fail(
          errorCode === 'step_budget_exceeded'
            ? "The coach couldn't converge on an answer. Try rephrasing."
            : 'Something went wrong.'
        )
        return
      }
      const answer = (finalAnswer ?? acc).trim()
      persist([...withUser, { role: 'coach', content: answer || '(empty response)' }])
    } catch {
      fail('Network error. Check your connection.')
    } finally {
      setSending(false)
      setStreamed('')
      setStatus(null)
    }
  }

  function startNewConversation() {
    setInput('')
    setStreamed('')
    setStatus(null)
    resetThread()
  }

  const bubbleBase = {
    maxWidth: '86%',
    padding: '9px 12px',
    borderRadius: 4,
    fontFamily: FONT.mono,
    fontSize: '0.73rem',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
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
              disabled={sending}
              style={{
                background: 'none',
                border: 'none',
                color: C.mutedDarker,
                fontFamily: FONT.mono,
                fontSize: '0.65rem',
                cursor: sending ? 'default' : 'pointer',
                padding: '4px 0',
              }}
            >
              new chat
            </button>
          )}
        </div>
      </PageHeader>

      <div style={{ padding: '14px 16px 0' }}>
        {messages.length === 0 && !sending ? (
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
                  ...bubbleBase,
                  backgroundColor: m.role === 'user' ? 'rgba(232,255,71,0.08)' : C.surface,
                  border: `1px solid ${m.failed ? C.danger : m.role === 'user' ? C.accentLift : C.border}`,
                  color: m.failed ? C.danger : C.text,
                }}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {/* In-flight answer: streamed text, or a status line before tokens arrive */}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div
              style={{
                ...bubbleBase,
                backgroundColor: C.surface,
                border: `1px solid ${C.border}`,
                color: streamed ? C.text : C.muted,
              }}
            >
              {streamed || `${status ?? 'thinking'}...`}
              {streamed && <span style={{ color: C.accentCombo }}>▌</span>}
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
