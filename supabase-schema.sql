-- ============================================================
-- Ledger — Supabase schema
-- Run this in your Supabase project: SQL Editor -> New query -> paste -> Run
-- ============================================================

create table if not exists public.months (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  month_key   text not null,                 -- e.g. '2026-06'
  salary      numeric default 0,
  budgets     jsonb  default '{}'::jsonb,     -- { total: 60000, rent: 18000, ... }
  expenses    jsonb  default '[]'::jsonb,     -- [{ id, name, amount, category, date }]
  updated_at  timestamptz default now(),
  unique (user_id, month_key)
);

-- Row Level Security: each user can only see and edit their own rows.
alter table public.months enable row level security;

create policy "own rows - select" on public.months
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.months
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.months
  for update using (auth.uid() = user_id);
create policy "own rows - delete" on public.months
  for delete using (auth.uid() = user_id);

-- Per-user settings (categories, default budgets, currency, theme default, etc.)
-- Stored as a single JSON blob per user for flexibility.
create table if not exists public.settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table public.settings enable row level security;

create policy "own settings - select" on public.settings
  for select using (auth.uid() = user_id);
create policy "own settings - insert" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "own settings - update" on public.settings
  for update using (auth.uid() = user_id);
create policy "own settings - delete" on public.settings
  for delete using (auth.uid() = user_id);
