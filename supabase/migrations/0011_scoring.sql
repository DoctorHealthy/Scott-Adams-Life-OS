-- ============================================================
-- 0011: accountability scoring (R6). Day and week grades are COMPUTED in code,
-- never stored; the durable record is this ledger of consequences (fines,
-- runs, locks, rewards) plus fund payouts. Per the doc's reality: the app
-- cannot move money or block apps, so fines and runs are obligations the owner
-- marks done, and a lock is a state the app declares and reports. The partner
-- reads a sanitized slice for verification. Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  date         date not null,   -- the judged local date (day rows) or the Monday (week rows)
  source       text not null check (source in ('day','week','escalation','manual')),
  kind         text not null check (kind in ('fine','run','lock','reward','payout')),
  amount_eur   numeric(8,2),    -- fine / reward / payout; null for run + lock
  distance_km  numeric(5,1),    -- run rows; null otherwise
  label        text not null,
  status       text not null default 'pending' check (status in ('pending','done','waived')),
  release_rule text check (release_rule in ('green','green3')), -- lock rows only
  resolved_on  date,
  created_at   timestamptz not null default now()
);
create index if not exists ledger_user_date_idx on public.ledger(user_id, date desc);
create index if not exists ledger_user_status_idx on public.ledger(user_id, status);

alter table public.ledger enable row level security;

drop policy if exists ledger_all_own on public.ledger;
create policy ledger_all_own on public.ledger
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The partner sees only what they need to verify: the consequence line, its
-- date, kind, amount/distance, and whether it is done. Labels here are
-- system-generated (never the owner's private words), so they are safe to
-- expose. Same sanitizing-function pattern as partner_progress / partner_commitments.
create or replace function public.partner_ledger(friend uuid)
returns table (
  date date,
  source text,
  kind text,
  amount_eur numeric,
  distance_km numeric,
  label text,
  status text
)
language sql stable security definer set search_path = public as $$
  select l.date, l.source, l.kind, l.amount_eur, l.distance_km, l.label, l.status
  from public.ledger l
  where l.user_id = friend
    and public.are_friends(auth.uid(), friend)
  order by l.date desc, l.created_at desc
  limit 60;
$$;

grant execute on function public.partner_ledger(uuid) to authenticated;
