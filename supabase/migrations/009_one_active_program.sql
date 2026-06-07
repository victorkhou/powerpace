-- Enforce at most one active program per user. The read paths assumed this
-- (.single() on is_active=true) but nothing guaranteed it, so a stray second
-- active row would turn every page into a 500.
-- Defensive de-dup first: if any user somehow has >1 active program, keep the
-- most recently created and deactivate the rest.
update programs p set is_active = false
where is_active
  and exists (
    select 1 from programs q
    where q.user_id = p.user_id and q.is_active
      and (q.created_at > p.created_at or (q.created_at = p.created_at and q.id > p.id))
  );

create unique index if not exists programs_one_active_per_user
  on programs (user_id) where is_active;
