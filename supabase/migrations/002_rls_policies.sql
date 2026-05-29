-- Enable RLS on all tables
alter table profiles enable row level security;
alter table programs enable row level security;
alter table workout_days enable row level security;
alter table exercises enable row level security;
alter table working_weights enable row level security;
alter table sessions enable row level security;
alter table session_sets enable row level security;
alter table run_logs enable row level security;
alter table weight_history enable row level security;

-- profiles: own rows only
create policy "profiles_own" on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- programs: own rows only
create policy "programs_own" on programs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_days: via program ownership
create policy "workout_days_own" on workout_days for all
  using (
    exists (
      select 1 from programs
      where programs.id = workout_days.program_id
        and programs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from programs
      where programs.id = workout_days.program_id
        and programs.user_id = auth.uid()
    )
  );

-- exercises: via workout_day → program ownership
create policy "exercises_own" on exercises for all
  using (
    exists (
      select 1 from workout_days wd
      join programs p on p.id = wd.program_id
      where wd.id = exercises.workout_day_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workout_days wd
      join programs p on p.id = wd.program_id
      where wd.id = exercises.workout_day_id
        and p.user_id = auth.uid()
    )
  );

-- working_weights: via program ownership
create policy "working_weights_own" on working_weights for all
  using (
    exists (
      select 1 from programs
      where programs.id = working_weights.program_id
        and programs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from programs
      where programs.id = working_weights.program_id
        and programs.user_id = auth.uid()
    )
  );

-- sessions: via program ownership
create policy "sessions_own" on sessions for all
  using (
    exists (
      select 1 from programs
      where programs.id = sessions.program_id
        and programs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from programs
      where programs.id = sessions.program_id
        and programs.user_id = auth.uid()
    )
  );

-- session_sets: via session → program ownership
create policy "session_sets_own" on session_sets for all
  using (
    exists (
      select 1 from sessions s
      join programs p on p.id = s.program_id
      where s.id = session_sets.session_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sessions s
      join programs p on p.id = s.program_id
      where s.id = session_sets.session_id
        and p.user_id = auth.uid()
    )
  );

-- run_logs: via session → program ownership
create policy "run_logs_own" on run_logs for all
  using (
    exists (
      select 1 from sessions s
      join programs p on p.id = s.program_id
      where s.id = run_logs.session_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sessions s
      join programs p on p.id = s.program_id
      where s.id = run_logs.session_id
        and p.user_id = auth.uid()
    )
  );

-- weight_history: via program ownership
create policy "weight_history_own" on weight_history for all
  using (
    exists (
      select 1 from programs
      where programs.id = weight_history.program_id
        and programs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from programs
      where programs.id = weight_history.program_id
        and programs.user_id = auth.uid()
    )
  );

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
