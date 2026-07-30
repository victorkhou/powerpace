'use client'

import { useCallback, useEffect, useState } from 'react'
import { localDateKey } from '@/lib/date'

const STORAGE_KEY = 'pp-coach-thread'
/** Cap stored history so localStorage can't grow without bound. */
const MAX_STORED_MESSAGES = 100

export type CoachMessage = {
  role: 'user' | 'coach'
  content: string
  /** Set when the request failed, so the bubble renders as an error. */
  failed?: boolean
}

type Stored = {
  date: string
  id: string
  messages: CoachMessage[]
}

function freshThread(date: string): Stored {
  return { date, id: `coach-${date}-${crypto.randomUUID()}`, messages: [] }
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Stored>
    if (typeof parsed?.date !== 'string' || typeof parsed?.id !== 'string') return null
    return {
      date: parsed.date,
      id: parsed.id,
      messages: Array.isArray(parsed.messages) ? (parsed.messages as CoachMessage[]) : [],
    }
  } catch {
    return null
  }
}

function write(s: Stored): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...s, messages: s.messages.slice(-MAX_STORED_MESSAGES) })
    )
  } catch {
    // Private mode / quota exceeded — degrade to in-memory only.
  }
}

/**
 * The coach conversation: a thread id AND its transcript, persisted in
 * localStorage and scoped to the local date.
 *
 * The sidecar keys its LangGraph checkpointer by thread_id, so reusing the id
 * continues the model's memory — but the model's memory lives server-side and
 * is lost on sidecar restart. Persisting the transcript here keeps the visible
 * conversation across reloads, and scoping both to the date matches the rest of
 * the app's date-bound state.
 *
 * threadId is null on the first render (no localStorage during SSR); callers
 * should not send until it resolves.
 */
export function useCoachThread() {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<CoachMessage[]>([])

  useEffect(() => {
    const today = localDateKey()
    const stored = read()
    if (stored && stored.date === today) {
      setThreadId(stored.id)
      setMessages(stored.messages)
      return
    }
    const fresh = freshThread(today)
    write(fresh)
    setThreadId(fresh.id)
    setMessages([])
  }, [])

  /** Replace the transcript and persist it against the current thread. */
  const persist = useCallback(
    (next: CoachMessage[]) => {
      setMessages(next)
      if (threadId) write({ date: localDateKey(), id: threadId, messages: next })
    },
    [threadId]
  )

  /** Start a new conversation: new id (fresh model memory) + empty transcript. */
  const resetThread = useCallback(() => {
    const fresh = freshThread(localDateKey())
    write(fresh)
    setThreadId(fresh.id)
    setMessages([])
  }, [])

  return { threadId, messages, persist, resetThread }
}
