-- ============================================================
-- Scott Adams Life OS - core schema + row level security
-- Run once. Safe to re-run (idempotent).
-- Apply via the Supabase SQL editor, or `supabase db push`.
-- ============================================================

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- users (profile, 1:1 with auth.users) ----------
create table if not exists public.users (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text,
  email          text,
  age            int,
  height_cm      numeric,
  weight_kg      numeric,
  activity_level text,
  constraints    jsonb not null default '{}'::jsonb,
  coaching_prefs jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- systems (the editable systems engine) ----------
create table if not exists public.systems (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  name           text not null,
  domain         text,                          -- a Big Five domain or 'custom'
  rule           text,                          -- the behavior you repeat
  floor          text,                          -- worst-day version that still counts
  ceiling        text,                          -- full version when energy is high
  metric_type    text not null default 'binary',-- 'binary' | 'number' | 'scale_1_10'
  anchor         text,                          -- existing habit/time it attaches to
  schedule_block text,                          -- when it lands in the day
  active         boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists systems_user_idx on public.systems(user_id);

-- ---------- entries (the daily check-in) ----------
create table if not exists public.entries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  date                 date not null,
  energy_1_10          int check (energy_1_10 between 1 and 10),
  system_statuses      jsonb not null default '{}'::jsonb, -- { system_id: 'done'|'floor'|'skip' }
  meals                jsonb not null default '[]'::jsonb,
  one_line             text,
  reflection           text,
  tomorrow_next_action text,
  is_private           boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists entries_user_date_idx on public.entries(user_id, date desc);

-- ---------- friendships (shared progress link) ----------
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  friend_id  uuid not null references public.users(id) on delete cascade,
  status     text not null default 'pending',   -- 'pending' | 'accepted' | 'blocked'
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------- updated_at triggers ----------
drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_systems_updated_at on public.systems;
create trigger set_systems_updated_at before update on public.systems
  for each row execute function public.set_updated_at();

drop trigger if exists set_entries_updated_at on public.entries;
create trigger set_entries_updated_at before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------- auto-create a profile row on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- friendship helper (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = a and f.friend_id = b)
        or (f.user_id = b and f.friend_id = a))
  );
$$;

-- ============================================================
-- Row level security
-- ============================================================
alter table public.users       enable row level security;
alter table public.systems     enable row level security;
alter table public.entries     enable row level security;
alter table public.friendships enable row level security;

-- ----- users -----
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (id = auth.uid());

drop policy if exists users_select_friend on public.users;
create policy users_select_friend on public.users
  for select using (public.are_friends(auth.uid(), id));

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----- systems -----
drop policy if exists systems_all_own on public.systems;
create policy systems_all_own on public.systems
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists systems_select_friend on public.systems;
create policy systems_select_friend on public.systems
  for select using (public.are_friends(auth.uid(), user_id));

-- ----- entries -----
drop policy if exists entries_all_own on public.entries;
create policy entries_all_own on public.entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- friends can read only the non-private entries
drop policy if exists entries_select_friend on public.entries;
create policy entries_select_friend on public.entries
  for select using (public.are_friends(auth.uid(), user_id) and is_private = false);

-- ----- friendships -----
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert with check (user_id = auth.uid());

drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete using (user_id = auth.uid() or friend_id = auth.uid());
