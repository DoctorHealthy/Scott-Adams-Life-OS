-- ============================================================
-- 0010: weekly commitments (R4). A commitment is 1-3 hard lines for a fixed
-- Monday-start week, judged by code from the logs: passed the moment the
-- target is met, failed when the week ends short. Failure can be exposed to
-- the linked partner (owner opt-in). Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.commitments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  week_start    date not null, -- the Monday of the committed week (user-local)
  kind          text not null check (kind in ('system_count','wake_hold')),
  system_id     uuid references public.systems(id) on delete cascade,
  target        int not null check (target between 1 and 21),
  tolerance_min int, -- wake_hold: minutes around the wake target (default 30)
  label         text not null,
  status        text not null default 'active' check (status in ('active','passed','failed')),
  judged_on     date,
  debrief       text,
  created_at    timestamptz not null default now()
);
create index if not exists commitments_user_week_idx
  on public.commitments(user_id, week_start desc);

alter table public.commitments enable row level security;

drop policy if exists commitments_all_own on public.commitments;
create policy commitments_all_own on public.commitments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No friend select policy: RLS cannot hide columns and the debrief is the
-- owner's own words. The partner reads commitments through this sanitizing
-- function instead (same pattern as partner_progress).
create or replace function public.partner_commitments(friend uuid)
returns table (
  week_start date,
  label text,
  target int,
  status text
)
language sql stable security definer set search_path = public as $$
  select c.week_start, c.label, c.target, c.status
  from public.commitments c
  where c.user_id = friend
    and public.are_friends(auth.uid(), friend)
  order by c.week_start desc, c.created_at
  limit 12;
$$;

grant execute on function public.partner_commitments(uuid) to authenticated;
