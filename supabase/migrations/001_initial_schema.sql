-- profiles: 1-1 extension of auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bodyweight numeric(5,1) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- programs
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  total_weeks int not null default 12,
  current_week int not null default 1,
  deload_week int not null default 9,
  started_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- workout_days
create table if not exists workout_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  name text not null,
  type text not null check (type in ('lift', 'run', 'combo', 'rest')),
  tag text,
  sort_order int not null default 0
);

-- exercises
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  name text not null,
  sets int not null default 1,
  reps int not null default 5,
  weight_key text,
  progression_type text not null check (progression_type in ('linear', 'fixed', 'auto', 'run')),
  increment_lbs numeric(4,1),
  is_primary_lift boolean not null default false,
  is_run boolean not null default false,
  note text,
  sort_order int not null default 0
);

-- working_weights
create table if not exists working_weights (
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

-- sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  workout_day_id uuid not null references workout_days(id),
  date date not null,
  week int not null,
  status text not null check (status in ('completed', 'partial', 'skipped', 'undone')),
  notes text,
  volume_lbs numeric(10,1),
  weight_snapshot jsonb,
  logged_at timestamptz not null default now(),
  unique(program_id, date)
);

-- session_sets
create table if not exists session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_number int not null,
  completed boolean not null default false,
  weight_lbs numeric(6,1),
  reps_target int not null,
  reps_actual int
);

-- run_logs
create table if not exists run_logs (
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

-- weight_history (append-only)
create table if not exists weight_history (
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

-- auto-update updated_at on profiles
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger working_weights_updated_at
  before update on working_weights
  for each row execute function update_updated_at();
