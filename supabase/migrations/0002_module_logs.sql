-- ============================================================
-- Per-day module logs (sleep, exercise) for the check-in.
-- One small jsonb column. Diet still uses the existing `meals` column.
-- Run once. Idempotent.
-- ============================================================

alter table public.entries
  add column if not exists module_logs jsonb not null default '{}'::jsonb;
