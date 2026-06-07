-- Configurable volume multiplier. Auto-derived (volume) lifts are computed as a
-- percentage of their intensity parent; this was hard-coded at 87.5%. Store it
-- per program so it can be tuned. Range guard keeps it a sane fraction.
alter table programs add column if not exists volume_pct numeric(4,3) not null default 0.875
  check (volume_pct > 0 and volume_pct <= 1);
