-- Schema for the NYE game leaderboard and referral codes.
-- Run this in the Supabase SQL editor after Tomasz creates the project.
-- Do not put keys in this file.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  nickname text not null check (char_length(nickname) between 1 and 16),
  score integer not null check (score >= 0 and score <= 5000),
  code text not null unique,
  device_id text not null,
  referral_code text,
  discount_percent integer not null default 10 check (discount_percent in (0, 10, 20)),
  created_at timestamptz not null default now()
);

create index if not exists scores_score_idx on public.scores (score desc, created_at asc);
create index if not exists scores_code_idx on public.scores (code);
create index if not exists scores_device_idx on public.scores (device_id);

-- One finished round per device and nickname, for referral counting.
create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer_code text not null,
  nickname text not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (referrer_code, device_id, nickname)
);

alter table public.scores enable row level security;
alter table public.referrals enable row level security;

-- Anon clients may insert and may read the top scores. They must not update or delete.
create policy scores_insert_anon on public.scores
  for insert to anon with check (true);

create policy scores_select_anon on public.scores
  for select to anon using (true);

create policy referrals_insert_anon on public.referrals
  for insert to anon with check (true);

create policy referrals_select_anon on public.referrals
  for select to anon using (true);

-- Tighten later with a check trigger for max score and unique codes if needed.
