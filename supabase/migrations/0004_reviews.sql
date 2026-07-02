-- ============================================================
-- 0004: reviews table. Weekly and monthly reviews are computed in code
-- (stats snapshot) and narrated by the coach; we store both so a review is
-- keepable and so the next period can measure movement against it.
-- Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  kind         text not null check (kind in ('weekly','monthly')),
  period_start date not null,
  period_end   date not null,
  stats        jsonb not null default '{}'::jsonb,  -- code-computed snapshot
  narration    text  not null default '',           -- the coach's text
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, kind, period_end)
);
create index if not exists reviews_user_kind_idx
  on public.reviews(user_id, kind, period_end desc);

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- Reviews are private to the owner (they can quote reflections/notes). The
-- partner view computes its own shared progress from entries, not from here.
alter table public.reviews enable row level security;

drop policy if exists reviews_all_own on public.reviews;
create policy reviews_all_own on public.reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
