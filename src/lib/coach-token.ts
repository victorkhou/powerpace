import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Short-lived bearer tokens that let the BROWSER call the coach sidecar
 * directly, without ever holding the shared secret.
 *
 * Why this exists: Amplify's SSR Lambda kills requests at ~30s, but a
 * multi-tool coach turn can take ~50s. Proxying through the Lambda therefore
 * cannot work for real questions. The browser must talk to Cloud Run directly —
 * which means the browser needs a credential, and COACH_SHARED_SECRET is not a
 * candidate (shipping it would let anyone impersonate any user_id against a
 * service that bypasses RLS).
 *
 * Instead the Amplify route, which knows the authenticated session, mints a
 * token scoped to ONE user id and a few minutes of validity. The sidecar
 * verifies the signature with the same secret. A leaked token grants only that
 * user's own data, briefly.
 *
 * Format: base64url(payload) + "." + base64url(hmac-sha256(payload))
 * Payload: "<user_id>:<expires_at_unix_seconds>"
 */

const TOKEN_TTL_SECONDS = 300 // 5 minutes — long enough to start a turn, short enough to limit reuse

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payload).digest())
}

/** Mint a token authorizing `userId` to call the sidecar for a few minutes. */
export function mintCoachToken(userId: string, secret: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TOKEN_TTL_SECONDS
  const payload = `${userId}:${exp}`
  return `${b64url(Buffer.from(payload, 'utf8'))}.${sign(payload, secret)}`
}

/**
 * Verify a token and return its user id, or null if invalid/expired/tampered.
 * Exported for tests; the sidecar has its own Python implementation of the
 * same scheme (see agent/app/tokens.py) — keep them in sync.
 */
export function verifyCoachToken(
  token: string,
  secret: string,
  now = Date.now()
): { userId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sig] = parts

  let payload: string
  try {
    payload = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  } catch {
    return null
  }

  const expected = sign(payload, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const sep = payload.lastIndexOf(':')
  if (sep <= 0) return null
  const userId = payload.slice(0, sep)
  const exp = Number(payload.slice(sep + 1))
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null
  if (!userId) return null

  return { userId }
}
