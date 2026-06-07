-- Per-date workout overrides: lets a user swap which workout_day shows on a
-- specific calendar date without mutating the recurring template. A swap of two
-- dates is modeled as two override rows. Resolving back to a date's natural
-- workout deletes its override.
create table schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  date date not null,
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(program_id, date)
);

create index schedule_overrides_program_date_idx on schedule_overrides(program_id, date);

alter table schedule_overrides enable row level security;

create policy "own" on schedule_overrides for all using (
  exists (select 1 from programs where programs.id = schedule_overrides.program_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from programs where programs.id = schedule_overrides.program_id
    and programs.user_id = auth.uid())
);
