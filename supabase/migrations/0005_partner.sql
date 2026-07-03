-- ============================================================
-- 0005: partner sharing (spec sections 9 + 17).
-- Progress is shared through a sanitizing function; journal text never
-- leaves the owner's account. Safe to re-run (idempotent).
-- ============================================================

-- Friends must not read entry rows directly: the row contains reflection and
-- intention text. All partner reads go through partner_progress() below, which
-- returns progress fields only (and honors the per-system visibility toggle).
drop policy if exists entries_select_friend on public.entries;

-- ---------- sanitized partner progress ----------
-- Returns one row per logged day: energy, system statuses (minus the systems
-- the owner chose to hide), and safe sleep/exercise booleans plus the wake
-- time (the campaign's accountability metric). No reflection, no intention,
-- no meals, no notes. Runs as definer; access is gated on are_friends().
create or replace function public.partner_progress(
  friend uuid,
  from_date date,
  to_date date
)
returns table (
  day date,
  energy int,
  statuses jsonb,
  exercise jsonb,
  sleep jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  hidden jsonb;
begin
  if auth.uid() is null or not public.are_friends(auth.uid(), friend) then
    return;
  end if;

  select coalesce(u.coaching_prefs->'sharing'->'hiddenSystems', '[]'::jsonb)
    into hidden
  from public.users u
  where u.id = friend;

  return query
  select
    e.date,
    e.energy_1_10,
    coalesce(
      (
        select jsonb_object_agg(t.k, t.v)
        from jsonb_each(e.system_statuses) as t(k, v)
        where not (hidden ? t.k)
      ),
      '{}'::jsonb
    ),
    jsonb_build_object(
      'warmup',  coalesce((e.module_logs->'exercise'->>'warmup')::boolean,  false),
      'session', coalesce((e.module_logs->'exercise'->>'session')::boolean, false),
      'ankle',   coalesce((e.module_logs->'exercise'->>'ankle')::boolean,   false)
    ),
    jsonb_build_object(
      'wake',         e.module_logs->'sleep'->>'wake',
      'windDown',     coalesce((e.module_logs->'sleep'->>'windDown')::boolean,     false),
      'morningLight', coalesce((e.module_logs->'sleep'->>'morningLight')::boolean, false)
    )
  from public.entries e
  where e.user_id = friend
    and e.date between from_date and to_date
  order by e.date;
end;
$$;

grant execute on function public.partner_progress(uuid, date, date) to authenticated;

-- ---------- friend linking by email ----------
-- Users cannot search each other's rows under RLS, so linking goes through a
-- definer function: look up by email, create a pending request, or accept a
-- reverse pending request if one exists.
create or replace function public.add_friend(friend_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid;
  reverse_id uuid;
begin
  if me is null then
    return jsonb_build_object('error', 'Not authenticated.');
  end if;

  select id into target from public.users
  where lower(email) = lower(trim(friend_email))
  limit 1;

  if target is null then
    return jsonb_build_object('error', 'No user with that email. They need to sign up first.');
  end if;
  if target = me then
    return jsonb_build_object('error', 'That is your own email.');
  end if;

  -- Already linked or already requested by me?
  if exists (
    select 1 from public.friendships f
    where f.user_id = me and f.friend_id = target
  ) then
    return jsonb_build_object('ok', true, 'status', 'already-requested');
  end if;

  -- If they already requested me, accept that instead of duplicating.
  select f.id into reverse_id from public.friendships f
  where f.user_id = target and f.friend_id = me;

  if reverse_id is not null then
    update public.friendships set status = 'accepted' where id = reverse_id;
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;

  insert into public.friendships (user_id, friend_id, status)
  values (me, target, 'pending');
  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;

grant execute on function public.add_friend(text) to authenticated;
