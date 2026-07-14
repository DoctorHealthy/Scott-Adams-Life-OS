-- ============================================================
-- 0008: Telegram inbox cursor for the two-way bot (Sleep Campaign 2.0).
-- The reminder cron is the single consumer of the bot's getUpdates feed;
-- this single-row table stores the last processed update id so messages
-- are handled exactly once. Service-role access only (no policies).
-- Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.telegram_state (
  id             int primary key default 1 check (id = 1),
  last_update_id bigint not null default 0,
  updated_at     timestamptz not null default now()
);

insert into public.telegram_state (id) values (1)
on conflict (id) do nothing;

alter table public.telegram_state enable row level security;
-- No policies on purpose: only the service key (cron) touches this table.
