-- Adds the two columns the /api/programs/settings route already writes but that
-- never existed in the schema. current_week mirrors the active week pointer
-- (kept distinct from week_number for forward-compat with multi-block plans);
-- deload_week is the week number on which a deload is scheduled (null = none).
alter table programs add column if not exists current_week int not null default 1
  check (current_week >= 1);
alter table programs add column if not exists deload_week int
  check (deload_week is null or deload_week >= 1);
