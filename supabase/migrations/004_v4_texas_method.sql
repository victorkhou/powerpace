-- v4 Migration: Texas Method volume/intensity split
-- Drops program data and rebuilds with v4 schema. Auth (profiles) preserved.

drop table if exists weight_history cascade;
drop table if exists run_logs cascade;
drop table if exists session_sets cascade;
drop table if exists sessions cascade;
drop table if exists exercises cascade;
drop table if exists workout_days cascade;
drop table if exists working_weights cascade;
drop table if exists programs cascade;

-- programs (unchanged from v2 schema)
create table programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  week_number int not null default 1,
  week_type text not null default 'A' check (week_type in ('A', 'B')),
  friday_alt text not null default 'A1' check (friday_alt in ('A1', 'A2')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- workout_days (v4 adds is_volume)
create table workout_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  week_type text not null default 'both' check (week_type in ('A', 'B', 'both')),
  variant text check (variant in ('A1', 'A2') or variant is null),
  is_volume boolean not null default false,
  name text not null,
  type text not null check (type in ('lift', 'run', 'combo', 'rest')),
  tag text
);

-- exercises (v4 replaces is_primary_lift / is_primary with is_auto_volume + parent_key)
create table exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  name text not null,
  sets int not null default 1,
  reps int not null default 5,
  weight_key text,
  progression_type text not null check (progression_type in ('linear', 'auto', 'bodyweight', 'run')),
  increment_lbs numeric(4,1),
  is_auto_volume boolean not null default false,
  parent_key text,
  is_run boolean not null default false,
  sort_order int not null default 0
);

create table working_weights (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  key text not null,
  weight_lbs numeric(6,1) not null,
  failures int not null default 0,
  streak int not null default 0,
  pr_lbs numeric(6,1),
  updated_at timestamptz not null default now(),
  unique(program_id, key)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  workout_day_id uuid not null references workout_days(id),
  date date not null,
  week_number int not null default 1,
  week_type text not null default 'A' check (week_type in ('A', 'B')),
  friday_alt text,
  status text not null check (status in ('completed', 'partial', 'skipped', 'undone')),
  notes text,
  volume_lbs numeric(10,1),
  weight_snapshot jsonb,
  logged_at timestamptz not null default now(),
  unique(program_id, date)
);

create table session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_number int not null,
  completed boolean not null default false,
  weight_lbs numeric(6,1),
  reps_target int not null,
  reps_actual int
);

create table run_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  pace_actual text,
  pace_target text,
  duration_minutes numeric(5,1),
  rounds_completed int,
  rounds_target int,
  notes text
);

create table weight_history (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  weight_key text not null,
  weight_before numeric(6,1) not null,
  weight_after numeric(6,1) not null,
  change_reason text not null check (change_reason in ('progression', 'failure_hold', 'failure_reset', 'manual', 'deload')),
  failures_at_change int not null default 0,
  created_at timestamptz not null default now()
);

create trigger working_weights_updated_at
  before update on working_weights
  for each row execute function update_updated_at();

alter table programs enable row level security;
alter table workout_days enable row level security;
alter table exercises enable row level security;
alter table working_weights enable row level security;
alter table sessions enable row level security;
alter table session_sets enable row level security;
alter table run_logs enable row level security;
alter table weight_history enable row level security;

create policy "own" on programs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own" on workout_days for all using (
  exists (select 1 from programs where programs.id = workout_days.program_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from programs where programs.id = workout_days.program_id
    and programs.user_id = auth.uid())
);

create policy "own" on exercises for all using (
  exists (select 1 from workout_days join programs on programs.id = workout_days.program_id
    where workout_days.id = exercises.workout_day_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from workout_days join programs on programs.id = workout_days.program_id
    where workout_days.id = exercises.workout_day_id
    and programs.user_id = auth.uid())
);

create policy "own" on working_weights for all using (
  exists (select 1 from programs where programs.id = working_weights.program_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from programs where programs.id = working_weights.program_id
    and programs.user_id = auth.uid())
);

create policy "own" on sessions for all using (
  exists (select 1 from programs where programs.id = sessions.program_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from programs where programs.id = sessions.program_id
    and programs.user_id = auth.uid())
);

create policy "own" on session_sets for all using (
  exists (select 1 from sessions join programs on programs.id = sessions.program_id
    where sessions.id = session_sets.session_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from sessions join programs on programs.id = sessions.program_id
    where sessions.id = session_sets.session_id
    and programs.user_id = auth.uid())
);

create policy "own" on run_logs for all using (
  exists (select 1 from sessions join programs on programs.id = sessions.program_id
    where sessions.id = run_logs.session_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from sessions join programs on programs.id = sessions.program_id
    where sessions.id = run_logs.session_id
    and programs.user_id = auth.uid())
);

create policy "own" on weight_history for all using (
  exists (select 1 from programs where programs.id = weight_history.program_id
    and programs.user_id = auth.uid())
) with check (
  exists (select 1 from programs where programs.id = weight_history.program_id
    and programs.user_id = auth.uid())
);
