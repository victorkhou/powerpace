-- Atomic session log. The progression arithmetic stays in the (unit-tested)
-- TypeScript engine; this function performs ALL writes in one transaction so a
-- mid-sequence failure can never leave a half-logged session with some lifts
-- advanced and others not. SECURITY INVOKER (default) keeps RLS in force.
--
-- payload shape (all ids/values precomputed by the route):
-- {
--   session: { program_id, workout_day_id, date, week_number, week_type,
--              friday_alt, status, notes, volume_lbs, weight_snapshot, logged_at },
--   sets: [{ exercise_id, set_number, completed, weight_lbs, reps_target, reps_actual }],
--   runLogs: [{ exercise_id, pace_actual, pace_target }],
--   weightUpdates: [{ key, weight_lbs, failures, streak, pr_lbs }],
--   weightHistory: [{ weight_key, weight_before, weight_after, change_reason, failures_at_change }],
--   newFridayAlt: 'A1' | 'A2' | null   -- null = no flip
-- }
create or replace function log_session(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_program_id uuid := (payload->'session'->>'program_id')::uuid;
  v_session_id uuid;
  v_row jsonb;
begin
  -- Upsert the session by (program_id, date).
  insert into sessions (
    program_id, workout_day_id, date, week_number, week_type, friday_alt,
    status, notes, volume_lbs, weight_snapshot, rpe, logged_at
  )
  values (
    v_program_id,
    (payload->'session'->>'workout_day_id')::uuid,
    (payload->'session'->>'date')::date,
    (payload->'session'->>'week_number')::int,
    payload->'session'->>'week_type',
    payload->'session'->>'friday_alt',
    payload->'session'->>'status',
    payload->'session'->>'notes',
    (payload->'session'->>'volume_lbs')::numeric,
    payload->'session'->'weight_snapshot',
    null,
    (payload->'session'->>'logged_at')::timestamptz
  )
  on conflict (program_id, date) do update set
    workout_day_id = excluded.workout_day_id,
    week_number    = excluded.week_number,
    week_type      = excluded.week_type,
    friday_alt     = excluded.friday_alt,
    status         = excluded.status,
    notes          = excluded.notes,
    volume_lbs     = excluded.volume_lbs,
    weight_snapshot = excluded.weight_snapshot,
    rpe            = null,
    logged_at      = excluded.logged_at
  returning id into v_session_id;

  -- Replace any children from a prior log of this same row (idempotent re-log).
  delete from session_sets where session_id = v_session_id;
  delete from run_logs where session_id = v_session_id;
  delete from weight_history where session_id = v_session_id;

  insert into session_sets (session_id, exercise_id, set_number, completed, weight_lbs, reps_target, reps_actual)
  select v_session_id,
         (e->>'exercise_id')::uuid,
         (e->>'set_number')::int,
         (e->>'completed')::boolean,
         nullif(e->>'weight_lbs','')::numeric,
         (e->>'reps_target')::int,
         nullif(e->>'reps_actual','')::int
  from jsonb_array_elements(coalesce(payload->'sets','[]'::jsonb)) e;

  insert into run_logs (session_id, exercise_id, pace_actual, pace_target)
  select v_session_id,
         (e->>'exercise_id')::uuid,
         e->>'pace_actual',
         e->>'pace_target'
  from jsonb_array_elements(coalesce(payload->'runLogs','[]'::jsonb)) e;

  update working_weights w set
    weight_lbs = (e->>'weight_lbs')::numeric,
    failures   = (e->>'failures')::int,
    streak     = (e->>'streak')::int,
    pr_lbs     = (e->>'pr_lbs')::numeric,
    updated_at = now()
  from jsonb_array_elements(coalesce(payload->'weightUpdates','[]'::jsonb)) e
  where w.program_id = v_program_id and w.key = e->>'key';

  insert into weight_history (program_id, session_id, weight_key, weight_before, weight_after, change_reason, failures_at_change)
  select v_program_id,
         v_session_id,
         e->>'weight_key',
         (e->>'weight_before')::numeric,
         (e->>'weight_after')::numeric,
         e->>'change_reason',
         (e->>'failures_at_change')::int
  from jsonb_array_elements(coalesce(payload->'weightHistory','[]'::jsonb)) e;

  if payload->>'newFridayAlt' is not null then
    update programs set friday_alt = payload->>'newFridayAlt' where id = v_program_id;
  end if;

  v_row := jsonb_build_object('sessionId', v_session_id);
  return v_row;
end;
$$;
