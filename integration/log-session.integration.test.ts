import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Integration test for the log_session RPC against a real Supabase instance.
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (CI secrets). Self-skips
// when absent so local/unit runs and forks are unaffected.
//
// Uses raw REST/admin calls rather than @supabase/supabase-js to avoid the
// Node-version WebSocket dependency of the client library.

const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const run = URL_ && KEY ? describe : describe.skip

function svc(path: string, init: RequestInit = {}) {
  return fetch(`${URL_}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: KEY!,
      Authorization: `Bearer ${KEY!}`,
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  })
}

async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await svc(`/rest/v1${path}`, init)
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${text}`)
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

run('log_session RPC (integration)', () => {
  let userId = ''
  let programId = ''
  let workoutDayId = ''
  let exerciseId = ''

  beforeAll(async () => {
    // 1. Create an auth user (handle_new_user trigger auto-creates its profile).
    const email = `inttest+${Date.now()}@example.com`
    const userRes = await svc('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'int-test-pw-123!', email_confirm: true }),
    })
    const userJson = await userRes.json()
    if (!userRes.ok) throw new Error(`create user failed: ${JSON.stringify(userJson)}`)
    userId = userJson.id

    // 2. Active Week-A program, a Friday workout day, one progressable squat
    //    exercise, and a working_weight to advance.
    const [program] = await rest<{ id: string }[]>('/programs', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        name: 'Integration Program',
        week_number: 1,
        week_type: 'A',
        friday_alt: 'A1',
        is_active: true,
      }),
    })
    programId = program.id

    const [day] = await rest<{ id: string }[]>('/workout_days', {
      method: 'POST',
      body: JSON.stringify({
        program_id: programId,
        day_of_week: 5, // Friday — exercises the friday_alt flip
        week_type: 'A',
        variant: 'A1',
        is_volume: false,
        name: 'Push Intensity',
        type: 'lift',
        tag: null,
      }),
    })
    workoutDayId = day.id

    const [ex] = await rest<{ id: string }[]>('/exercises', {
      method: 'POST',
      body: JSON.stringify({
        workout_day_id: workoutDayId,
        name: 'Back Squat',
        sets: 3,
        reps: 5,
        weight_key: 'squat',
        progression_type: 'linear',
        increment_lbs: 5,
        is_auto_volume: false,
        parent_key: null,
        is_run: false,
        sort_order: 0,
      }),
    })
    exerciseId = ex.id

    await rest('/working_weights', {
      method: 'POST',
      body: JSON.stringify({
        program_id: programId,
        key: 'squat',
        weight_lbs: 220,
        failures: 0,
        streak: 0,
        pr_lbs: 220,
      }),
    })
  }, 30_000)

  afterAll(async () => {
    // Deleting the auth user cascades to profile -> program -> all children.
    if (userId) await svc(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
  }, 30_000)

  it('atomically writes the session, advances the lift, records history, and flips friday_alt', async () => {
    const date = '2026-06-05' // a Friday
    const result = await rest<{ sessionId: string }>('/rpc/log_session', {
      method: 'POST',
      body: JSON.stringify({
        payload: {
          session: {
            program_id: programId,
            workout_day_id: workoutDayId,
            date,
            week_number: 1,
            week_type: 'A',
            friday_alt: 'A1',
            status: 'completed',
            notes: null,
            volume_lbs: 220 * 5 * 3,
            weight_snapshot: { squat: 220 },
            logged_at: new Date('2026-06-05T18:00:00Z').toISOString(),
          },
          sets: [
            { exercise_id: exerciseId, set_number: 1, completed: true, weight_lbs: 220, reps_target: 5, reps_actual: null },
            { exercise_id: exerciseId, set_number: 2, completed: true, weight_lbs: 220, reps_target: 5, reps_actual: null },
            { exercise_id: exerciseId, set_number: 3, completed: true, weight_lbs: 220, reps_target: 5, reps_actual: null },
          ],
          runLogs: [],
          weightUpdates: [{ key: 'squat', weight_lbs: 225, failures: 0, streak: 1, pr_lbs: 225 }],
          weightHistory: [{ weight_key: 'squat', weight_before: 220, weight_after: 225, change_reason: 'progression', failures_at_change: 0 }],
          newFridayAlt: 'A2',
        },
      }),
    })
    expect(result.sessionId).toBeTruthy()

    // Session row written.
    const sessions = await rest<Array<{ id: string; status: string; volume_lbs: number }>>(
      `/sessions?program_id=eq.${programId}&date=eq.${date}&select=id,status,volume_lbs`
    )
    expect(sessions).toHaveLength(1)
    expect(sessions[0].status).toBe('completed')

    // session_sets written.
    const sets = await rest<unknown[]>(`/session_sets?session_id=eq.${result.sessionId}&select=id`)
    expect(sets).toHaveLength(3)

    // working_weight advanced.
    const ww = await rest<Array<{ weight_lbs: number; streak: number }>>(
      `/working_weights?program_id=eq.${programId}&key=eq.squat&select=weight_lbs,streak`
    )
    expect(ww[0].weight_lbs).toBe(225)
    expect(ww[0].streak).toBe(1)

    // weight_history recorded.
    const hist = await rest<Array<{ weight_after: number; change_reason: string }>>(
      `/weight_history?session_id=eq.${result.sessionId}&select=weight_after,change_reason`
    )
    expect(hist).toHaveLength(1)
    expect(hist[0].weight_after).toBe(225)
    expect(hist[0].change_reason).toBe('progression')

    // friday_alt flipped A1 -> A2.
    const prog = await rest<Array<{ friday_alt: string }>>(`/programs?id=eq.${programId}&select=friday_alt`)
    expect(prog[0].friday_alt).toBe('A2')
  }, 30_000)

  it('is idempotent: re-logging the same date replaces children, not duplicates', async () => {
    const date = '2026-06-05'
    await rest('/rpc/log_session', {
      method: 'POST',
      body: JSON.stringify({
        payload: {
          session: {
            program_id: programId, workout_day_id: workoutDayId, date,
            week_number: 1, week_type: 'A', friday_alt: 'A1', status: 'completed',
            notes: null, volume_lbs: 0, weight_snapshot: { squat: 225 },
            logged_at: new Date('2026-06-05T19:00:00Z').toISOString(),
          },
          sets: [{ exercise_id: exerciseId, set_number: 1, completed: true, weight_lbs: 225, reps_target: 5, reps_actual: null }],
          runLogs: [], weightUpdates: [], weightHistory: [], newFridayAlt: null,
        },
      }),
    })
    // Still exactly one session for the date, and its sets were replaced (1, not 4).
    const sessions = await rest<unknown[]>(`/sessions?program_id=eq.${programId}&date=eq.${date}&select=id`)
    expect(sessions).toHaveLength(1)
    const sid = (sessions[0] as { id: string }).id
    const sets = await rest<unknown[]>(`/session_sets?session_id=eq.${sid}&select=id`)
    expect(sets).toHaveLength(1)
  }, 30_000)
})
