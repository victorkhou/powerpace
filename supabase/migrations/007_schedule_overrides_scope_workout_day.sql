-- Harden schedule_overrides: the bare FK on workout_day_id let a row reference a
-- workout_day belonging to a different program. Tighten the RLS policy so both
-- USING and WITH CHECK additionally require the referenced workout_day to belong
-- to the same program as the override row.
drop policy if exists "own" on schedule_overrides;

create policy "own" on schedule_overrides for all using (
  exists (select 1 from programs where programs.id = schedule_overrides.program_id
    and programs.user_id = auth.uid())
  and exists (select 1 from workout_days wd
    where wd.id = schedule_overrides.workout_day_id
    and wd.program_id = schedule_overrides.program_id)
) with check (
  exists (select 1 from programs where programs.id = schedule_overrides.program_id
    and programs.user_id = auth.uid())
  and exists (select 1 from workout_days wd
    where wd.id = schedule_overrides.workout_day_id
    and wd.program_id = schedule_overrides.program_id)
);
