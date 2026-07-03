-- ============================================================
-- 0006: let a user hide specific goals from their partner, enforced in the DB
-- (not just the UI). Mirrors the per-system visibility toggle.
-- Safe to re-run (idempotent).
-- ============================================================

-- A friend may read a goal only if linked AND the goal is not in the owner's
-- hidden-goal list (coaching_prefs.sharing.hiddenGoals, an array of goal ids).
drop policy if exists goals_select_friend on public.goals;
create policy goals_select_friend on public.goals
  for select using (
    public.are_friends(auth.uid(), user_id)
    and not (
      coalesce(
        (select u.coaching_prefs->'sharing'->'hiddenGoals'
           from public.users u where u.id = goals.user_id),
        '[]'::jsonb
      ) ? goals.id::text
    )
  );
