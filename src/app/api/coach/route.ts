import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

// Thin proxy to the Python coach sidecar. All AI logic (LangGraph/LangChain/
// LangSmith) lives there; this route just authenticates and forwards.
// The sidecar URL is server-side only — set COACH_SERVICE_URL in .env.local.
const COACH_URL = process.env.COACH_SERVICE_URL ?? 'http://localhost:8000'
// Shared secret the sidecar requires (must match COACH_SHARED_SECRET there).
const COACH_SECRET = process.env.COACH_SHARED_SECRET ?? ''
// Cap how long we wait on the sidecar so a hung turn can't pin a connection.
const COACH_TIMEOUT_MS = 60_000

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { question, threadId } = (body ?? {}) as { question?: unknown; threadId?: unknown }
  if (typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  // user_id comes from the authenticated session, never from the client body.
  // threadId (optional) selects a conversation for multi-turn memory; the
  // sidecar defaults it to user_id when absent.
  let res: Response
  try {
    res = await fetch(`${COACH_URL}/coach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(COACH_SECRET ? { 'x-coach-secret': COACH_SECRET } : {}),
      },
      body: JSON.stringify({
        user_id: user.id,
        question,
        thread_id: typeof threadId === 'string' ? threadId : undefined,
      }),
      signal: AbortSignal.timeout(COACH_TIMEOUT_MS),
    })
  } catch (err) {
    // Timeout or connection failure reaching the sidecar.
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return NextResponse.json(
      { error: timedOut ? 'Coach timed out' : 'Coach service unreachable' },
      { status: timedOut ? 504 : 502 },
    )
  }

  if (!res.ok) {
    // Forward the sidecar's status so failures are diagnosable (401/422/503/500)
    // rather than collapsing everything to an opaque 502.
    return NextResponse.json({ error: 'Coach service error' }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
