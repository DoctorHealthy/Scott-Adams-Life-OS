-- ============================================================
-- 0003: goals table (MASTER-BUILD-SPEC section 14) + RLS,
-- plus a one-time migration of the goals that lived in
-- users.coaching_prefs->'goals'. Safe to re-run (idempotent).
-- Apply via the Supabase SQL editor, or `supabase db push`.
-- ============================================================

create table if not exists public.goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  title            text not null,
  why              text not null default '',
  target_year      int  not null,
  target_quarter   int  not null check (target_quarter between 1 and 4),
  progress_type    text not null default 'manual' check (progress_type in ('manual','auto')),
  linked_system_id uuid references public.systems(id) on delete set null,
  manual_progress  int  not null default 0 check (manual_progress between 0 and 100),
  milestones       jsonb not null default '[]'::jsonb,
  notes            text not null default '',
  status           text not null default 'active' check (status in ('active','done','dropped')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists goals_user_year_idx on public.goals(user_id, target_year);

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------- row level security ----------
alter table public.goals enable row level security;

drop policy if exists goals_all_own on public.goals;
create policy goals_all_own on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- linked friends can read goal progress (partner view, spec section 9)
drop policy if exists goals_select_friend on public.goals;
create policy goals_select_friend on public.goals
  for select using (public.are_friends(auth.uid(), user_id));

-- ---------- one-time data migration from coaching_prefs ----------
-- Old shape: coaching_prefs->'goals' = [{ id, title, why, quarter, year,
-- link ('manual'|'sleep_wake'|'training_sessions'|'diet_protein'),
-- manualProgress, notes, milestones }]. The link enum maps to the user's
-- system of the matching domain.
insert into public.goals
  (id, user_id, title, why, target_year, target_quarter,
   progress_type, linked_system_id, manual_progress, milestones, notes, status)
select
  coalesce(nullif(g->>'id','')::uuid, gen_random_uuid()),
  u.id,
  coalesce(g->>'title', 'Untitled'),
  coalesce(g->>'why', ''),
  coalesce(nullif(g->>'year','')::int, extract(year from now())::int),
  least(4, greatest(1, coalesce(nullif(g->>'quarter','')::int, 1))),
  case when coalesce(g->>'link','manual') = 'manual' then 'manual' else 'auto' end,
  case coalesce(g->>'link','manual')
    when 'sleep_wake' then
      (select s.id from public.systems s
        where s.user_id = u.id and s.domain = 'Sleep' order by s.sort_order limit 1)
    when 'training_sessions' then
      (select s.id from public.systems s
        where s.user_id = u.id and s.domain = 'Exercise' order by s.sort_order limit 1)
    when 'diet_protein' then
      (select s.id from public.systems s
        where s.user_id = u.id and s.domain = 'Diet' order by s.sort_order limit 1)
    else null
  end,
  least(100, greatest(0, coalesce(nullif(g->>'manualProgress','')::int, 0))),
  coalesce(g->'milestones', '[]'::jsonb),
  coalesce(g->>'notes', ''),
  'active'
from public.users u,
     jsonb_array_elements(coalesce(u.coaching_prefs->'goals', '[]'::jsonb)) g
on conflict (id) do nothing;

-- Remove the old jsonb copy so there is a single source of truth.
update public.users
  set coaching_prefs = coaching_prefs - 'goals'
  where coaching_prefs ? 'goals';
