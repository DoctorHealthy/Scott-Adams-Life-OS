-- ============================================================
-- 0007: reminders engine (spec section 17).
-- Custom reminders, channel endpoints (Telegram chat id, push
-- subscriptions), short-lived Telegram link codes, and a send log that
-- guarantees nothing is ever double-sent. Safe to re-run (idempotent).
-- The cron sender runs with the service key and bypasses RLS; RLS here
-- protects user-facing reads and writes.
-- ============================================================

-- ---------- custom reminders ----------
create table if not exists public.reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  label            text not null,
  time             text not null check (time ~ '^\d{2}:\d{2}$'), -- "HH:MM" local
  repeat           text not null default 'daily' check (repeat in ('daily','weekdays','once')),
  weekdays         jsonb not null default '[]'::jsonb, -- [0..6], 0 = Sunday, for repeat='weekdays'
  once_date        date,                               -- for repeat='once'
  channel          text not null default 'telegram' check (channel in ('telegram','push','both')),
  linked_system_id uuid references public.systems(id) on delete set null,
  linked_goal_id   uuid references public.goals(id) on delete set null,
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders(user_id);

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;
drop policy if exists reminders_all_own on public.reminders;
create policy reminders_all_own on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- channel endpoints ----------
create table if not exists public.user_channels (
  user_id          uuid primary key references public.users(id) on delete cascade,
  telegram_chat_id text,
  updated_at       timestamptz not null default now()
);

drop trigger if exists set_user_channels_updated_at on public.user_channels;
create trigger set_user_channels_updated_at before update on public.user_channels
  for each row execute function public.set_updated_at();

alter table public.user_channels enable row level security;
drop policy if exists user_channels_all_own on public.user_channels;
create policy user_channels_all_own on public.user_channels
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_all_own on public.push_subscriptions;
create policy push_subs_all_own on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- telegram link codes (short-lived, single use) ----------
create table if not exists public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.telegram_link_codes enable row level security;
drop policy if exists tg_codes_all_own on public.telegram_link_codes;
create policy tg_codes_all_own on public.telegram_link_codes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- send log: the double-send guard ----------
-- One row per (user, reminder key, local date). The sender INSERTs first with
-- ON CONFLICT DO NOTHING; only a successful insert triggers a send, so two
-- overlapping cron runs can never both send the same reminder.
create table if not exists public.reminder_sends (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.users(id) on delete cascade,
  key      text not null,   -- 'auto:light' | 'auto:winddown' | 'auto:dinner' | 'custom:<id>' | 'test'
  sent_on  date not null,   -- the user's local date
  sent_at  timestamptz not null default now(),
  unique (user_id, key, sent_on)
);

alter table public.reminder_sends enable row level security;
drop policy if exists reminder_sends_select_own on public.reminder_sends;
create policy reminder_sends_select_own on public.reminder_sends
  for select using (user_id = auth.uid());
