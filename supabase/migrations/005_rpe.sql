alter table sessions add column rpe smallint check (rpe is null or rpe between 1 and 10);
create index sessions_rpe_idx on sessions(program_id, rpe) where rpe is not null;
