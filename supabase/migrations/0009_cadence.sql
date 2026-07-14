-- ============================================================
-- 0009: flexible tracking (R3). Systems get a cadence: daily (as before)
-- or weekly (judged over the week, no daily nagging). Weekly systems carry
-- a times-per-week target; counted systems (metric_type = 'number') carry a
-- unit for their +1 counter on Today. Safe to re-run (idempotent).
-- ============================================================

alter table public.systems
  add column if not exists cadence text not null default 'daily';

alter table public.systems
  add column if not exists target_per_week int;

alter table public.systems
  add column if not exists unit text;

-- Constraints added separately so re-runs stay clean.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'systems_cadence_check'
  ) then
    alter table public.systems
      add constraint systems_cadence_check check (cadence in ('daily','weekly'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'systems_target_per_week_check'
  ) then
    alter table public.systems
      add constraint systems_target_per_week_check
      check (target_per_week is null or target_per_week between 1 and 21);
  end if;
end $$;
