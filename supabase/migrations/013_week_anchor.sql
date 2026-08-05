-- Auto-advancing program week.
--
-- week_number / week_type were plain columns the user had to bump in Settings,
-- so a program created in June still read "week 1 / A" in August. Replace the
-- manual pointer with an ANCHOR — "on this Monday the program was week N of
-- type T" — and derive the current week from elapsed Monday-anchored weeks
-- (src/lib/week.ts). Correcting the week rewrites the anchor, so it keeps
-- advancing from the corrected point.
--
-- The old columns are KEPT, not dropped:
--   * sessions.week_number / week_type record what was true when each session
--     was logged, and must not change retroactively.
--   * programs.week_number / week_type are now a derived cache the server
--     refreshes, so any reader that hasn't been migrated still sees sane values
--     instead of a missing column.

alter table programs
  add column if not exists week_anchor_date date,
  add column if not exists week_anchor_number int check (week_anchor_number >= 1),
  add column if not exists week_anchor_type text
    check (week_anchor_type is null or week_anchor_type in ('A', 'B'));

-- Backfill: anchor each existing program to the Monday of the week it was
-- created, carrying its current week_number/week_type. For a program that was
-- never advanced this reconstructs the true week from the creation date; for one
-- the user had been bumping by hand it preserves the number they last set as of
-- creation week, which they can correct in Settings.
--
-- date_trunc('week', ...) is ISO (Monday-anchored), matching startOfWeekKey().
update programs
set week_anchor_date = (date_trunc('week', created_at))::date,
    week_anchor_number = coalesce(week_number, 1),
    week_anchor_type = coalesce(week_type, 'A')
where week_anchor_date is null;

-- New programs anchor to their creation week automatically.
alter table programs
  alter column week_anchor_date set default (date_trunc('week', now()))::date,
  alter column week_anchor_number set default 1,
  alter column week_anchor_type set default 'A';
