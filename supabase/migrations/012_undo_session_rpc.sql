-- Atomic session undo — the mirror image of log_session (010). Previously the
-- route hand-sequenced ~15 writes (per-key weight restore loop, three child
-- deletes, status flip, friday_alt reversal); a failure midway left weights
-- rolled back while the session still read 'completed'. One transaction fixes
-- both the atomicity hole and the round-trip count. SECURITY INVOKER (default)
-- keeps RLS in force; ownership is verified by the route before calling.
--
-- payload shape:
-- { sessionId: uuid }
--
-- Returns { ok: true } or raises. The friday_alt reversal mirrors the advance
-- in log_session: only a Friday week-A log advanced it, so only that case
-- reverses it (A1 <-> A2).
create or replace function undo_session(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_session_id uuid := (payload->>'sessionId')::uuid;
  v_program_id uuid;
  v_snapshot jsonb;
  v_week_type text;
  v_date date;
begin
  select program_id, weight_snapshot, week_type, date
    into v_program_id, v_snapshot, v_week_type, v_date
  from sessions where id = v_session_id;

  if v_program_id is null then
    raise exception 'session not found';
  end if;

  -- Restore working weights from the snapshot in a single statement.
  if v_snapshot is not null then
    update working_weights w set
      weight_lbs = (e.value)::numeric,
      updated_at = now()
    from jsonb_each_text(v_snapshot) e
    where w.program_id = v_program_id and w.key = e.key;
  end if;

  delete from session_sets where session_id = v_session_id;
  delete from run_logs where session_id = v_session_id;
  delete from weight_history where session_id = v_session_id;

  update sessions set status = 'undone', rpe = null where id = v_session_id;

  -- Reverse the friday_alt advance that log_session performed for a Friday
  -- week-A session (dow 5). Tuesday week-A doesn't advance, so no reversal.
  if v_week_type = 'A' and extract(dow from v_date) = 5 then
    update programs
      set friday_alt = case friday_alt when 'A1' then 'A2' else 'A1' end
      where id = v_program_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
