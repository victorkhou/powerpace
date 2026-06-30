import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

// Thin proxy to the Python coach sidecar. All AI logic (LangGraph/LangChain/
// LangSmith) lives there; this route just authenticates and forwards.
// The sidecar URL is server-side only — set COACH_SERVICE_URL in .env.local.
const COACH_URL = process.env.COACH_SERVICE_URL ?? 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user } = auth

  const { question, threadId } = await request.json()
  if (typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  // user_id comes from the authenticated session, never from the client body.
  // threadId (optional) selects a conversation for multi-turn memory; the
  // sidecar defaults it to user_id when absent.
  const res = await fetch(`${COACH_URL}/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      question,
      thread_id: typeof threadId === 'string' ? threadId : undefined,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Coach service error' }, { status: 502 })
  }

  return NextResponse.json(await res.json())
}
