import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

// Thin proxy to the Python coach sidecar. All AI logic (LangGraph/LangChain/
// LangSmith) lives there; this route just authenticates and forwards.
//
// COACH_SERVICE_URL is server-side only and has NO default on purpose: the
// sidecar is a separate deployment, so an unset value means "not configured"
// rather than "try localhost". Defaulting to localhost made a hosted deploy
// report `unreachable at http://localhost:8000` — technically true (the
// serverless container has no sidecar) but it read like a networking bug.
const COACH_URL = process.env.COACH_SERVICE_URL ?? ''
// Shared secret the sidecar requires (must match COACH_SHARED_SECRET there).
const COACH_SECRET = process.env.COACH_SHARED_SECRET ?? ''
// Cap how long we wait on the sidecar so a hung turn can't pin a connection.
// 110s, just under the sidecar's own 120s Cloud Run request timeout: a scaled-
// to-zero cold start costs ~10s on top of a normal 20-30s turn, and a
// multi-tool question can add more. At 60s those legitimately-slow turns were
// killed client-side while the sidecar was still working.
const COACH_TIMEOUT_MS = 110_000

/**
 * Availability probe. Lets the page render a clear "not configured" state up
 * front instead of looking functional until the first question fails.
 * Deliberately does NOT expose COACH_URL — that's server-side detail.
 */
export async function GET() {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  return NextResponse.json({ configured: Boolean(COACH_URL) })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error
  const { user } = auth

  // Fail fast and legibly when the sidecar isn't wired up for this environment.
  if (!COACH_URL) {
    return NextResponse.json(
      {
        error:
          'Coach is not configured for this environment. Deploy the sidecar (agent/) and set COACH_SERVICE_URL + COACH_SHARED_SECRET.',
        code: 'not_configured',
      },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const { question, threadId, stream } = (body ?? {}) as {
    question?: unknown
    threadId?: unknown
    stream?: unknown
  }
  if (typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }
  // stream:true proxies the sidecar's SSE endpoint straight through to the
  // client; otherwise fall back to the buffered JSON response.
  const wantsStream = stream === true

  // user_id comes from the authenticated session, never from the client body.
  // threadId (optional) selects a conversation for multi-turn memory; the
  // sidecar defaults it to user_id when absent.
  let res: Response
  try {
    res = await fetch(`${COACH_URL}/coach${wantsStream ? '/stream' : ''}`, {
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
    // Timeout or connection failure reaching the sidecar. Include the URL we
    // actually tried and the underlying cause — "unreachable" alone sent us
    // hunting a healthy sidecar when the real problem was an IPv6 resolution
    // mismatch (localhost -> ::1) and, separately, a stale client bundle.
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    const cause = (err as { cause?: { code?: string } })?.cause?.code
    console.error('coach proxy failed', { url: COACH_URL, cause, err })
    return NextResponse.json(
      {
        error: timedOut
          ? `Coach timed out after ${COACH_TIMEOUT_MS / 1000}s (${COACH_URL})`
          : `Coach unreachable at ${COACH_URL}${cause ? ` (${cause})` : ''}`,
      },
      { status: timedOut ? 504 : 502 },
    )
  }

  if (!res.ok) {
    // Forward the sidecar's status so failures are diagnosable (401/422/503/500)
    // rather than collapsing everything to an opaque 502.
    return NextResponse.json({ error: 'Coach service error' }, { status: res.status })
  }

  if (wantsStream) {
    // Pipe the SSE body through unbuffered. No transformation — the sidecar's
    // event contract is the client's contract.
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  return NextResponse.json(await res.json())
}
