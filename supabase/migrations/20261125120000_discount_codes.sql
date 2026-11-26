-- NYE game: scores, discount codes, referrals, redemptions, staff, and RPC functions.
-- Run once in the Supabase SQL editor, or with `supabase db push`.
-- Do not put keys in this file. The app uses only the anon key. Never use the service role key in the app.
-- The rules match src/config.ts and src/backend/mock.ts. src/backend/sql.test.ts checks the constants.

-- Private helpers. PostgREST does not expose this schema, and anon has no access.
create schema if not exists syl_private;
revoke all on schema syl_private from public, anon, authenticated;

-- ---------------------------------------------------------------- tables

-- Best score per nickname (case-insensitive). The leaderboard shows nickname and score only.
create table public.scores (
  nickname_key text primary key,
  nickname text not null check (char_length(nickname) between 1 and 16),
  score integer not null check (score >= 0),
  device_id text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scores_board_idx on public.scores (score desc, created_at asc) where not hidden;

-- One code per nickname. kind 'base' = 10 % (333 zl per person), 'share' = share bonus (299 zl per person).
create table public.codes (
  code text primary key check (code ~ '^SYL-[2-9A-HJ-NP-Z]{4}$'),
  nickname_key text not null unique references public.scores (nickname_key),
  nickname text not null,
  device_id text not null,
  score integer not null,
  kind text not null default 'base' check (kind in ('base', 'share')),
  earned_at timestamptz not null default now()
);

create index codes_earned_idx on public.codes (earned_at desc);

-- One row per referred finished player (device id + nickname). A repeat does not count twice.
create table public.referrals (
  referrer_code text not null references public.codes (code),
  device_id text not null,
  nickname_key text not null,
  created_at timestamptz not null default now(),
  primary key (referrer_code, device_id, nickname_key)
);

-- One redeem per code. The code covers one whole booking. The note is optional; do not store a guest name.
create table public.redemptions (
  code text primary key references public.codes (code),
  used_at timestamptz not null default now(),
  used_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 200)
);

-- Staff Auth users. Add a row by hand for each staff user (see README).
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------- row level security

-- RLS is on and there are no policies, so anon and authenticated cannot read or change any table directly.
-- All access goes through the functions below.
alter table public.scores enable row level security;
alter table public.codes enable row level security;
alter table public.referrals enable row level security;
alter table public.redemptions enable row level security;
alter table public.staff enable row level security;

revoke all on public.scores, public.codes, public.referrals, public.redemptions, public.staff
  from public, anon, authenticated;

-- ---------------------------------------------------------------- rules (keep in sync with src/config.ts)

create function syl_private.max_score() returns integer language sql immutable as $$ select 3210 $$;
create function syl_private.discount_score() returns integer language sql immutable as $$ select 200 $$;
create function syl_private.referral_needed() returns integer language sql immutable as $$ select 5 $$;
create function syl_private.nickname_max_length() returns integer language sql immutable as $$ select 16 $$;
create function syl_private.device_id_max_length() returns integer language sql immutable as $$ select 100 $$;
-- Valid until 31 December 2026, 23:59:59 Europe/Warsaw. Expired from this instant.
create function syl_private.code_expires_at() returns timestamptz language sql immutable as $$ select timestamptz '2027-01-01 00:00:00 Europe/Warsaw' $$;
create function syl_private.discount_percent(p_kind text) returns integer language sql immutable as $$ select case when p_kind = 'share' then 20 else 10 end $$;
create function syl_private.price_per_person(p_kind text) returns integer language sql immutable as $$ select case when p_kind = 'share' then 299 else 333 end $$;

-- ---------------------------------------------------------------- helpers

create function syl_private.clean_nickname(p_nickname text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_nickname, ''), '^\s+|\s+$', '', 'g')
$$;

create function syl_private.normalize_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(btrim(coalesce(p_code, '')))
$$;

create function syl_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid())
$$;

create function syl_private.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not syl_private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create function syl_private.input_error(p_nickname text, p_score integer, p_device_id text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(p_nickname) not between 1 and syl_private.nickname_max_length()
     or p_nickname ~ '\s{2,}' then
    return 'nickname';
  end if;
  if p_score is null or p_score < 0 or p_score > syl_private.max_score() then
    return 'score';
  end if;
  if char_length(coalesce(p_device_id, '')) not between 1 and syl_private.device_id_max_length() then
    return 'device';
  end if;
  return null;
end;
$$;

create function syl_private.submit_result(p_accepted boolean, p_reason text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'accepted', p_accepted,
    'reason', p_reason,
    'code', '',
    'discount_percent', 0,
    'referral_progress', 0,
    'referral_needed', syl_private.referral_needed()
  )
$$;

create function syl_private.referral_count(p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.referrals r where r.referrer_code = p_code
$$;

create function syl_private.code_result(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'accepted', true,
    'reason', null,
    'code', c.code,
    'discount_percent', syl_private.discount_percent(c.kind),
    'referral_progress', syl_private.referral_count(c.code),
    'referral_needed', syl_private.referral_needed()
  )
  from public.codes c
  where c.code = p_code
$$;

-- A random SYL-XXXX code. The suffix is free and is not a slice of the nickname. Null after 20 failed attempts.
create function syl_private.new_code(p_nickname text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_clean text := regexp_replace(upper(p_nickname), '[^A-Z0-9]', '', 'g');
  v_bytes bytea;
  v_suffix text;
  v_code text;
begin
  for attempt in 1..20 loop
    -- Bytes 0..3 of a v4 UUID are strong random bytes.
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_suffix := '';
    for i in 0..3 loop
      v_suffix := v_suffix || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1);
    end loop;
    v_code := 'SYL-' || v_suffix;
    if position(v_suffix in v_clean) = 0
       and not exists (select 1 from public.codes c where c.code = v_code) then
      return v_code;
    end if;
  end loop;
  return null;
end;
$$;

-- Count a finished referred player. Self-referral (same nickname or same device) does not count.
create function syl_private.count_referral(p_referral_code text, p_nickname_key text, p_device_id text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ref public.codes;
begin
  if p_referral_code is null then
    return;
  end if;
  select * into v_ref from public.codes c where c.code = syl_private.normalize_code(p_referral_code);
  if not found or v_ref.nickname_key = p_nickname_key or v_ref.device_id = p_device_id then
    return;
  end if;
  insert into public.referrals (referrer_code, device_id, nickname_key)
  values (v_ref.code, p_device_id, p_nickname_key)
  on conflict do nothing;
  if syl_private.referral_count(v_ref.code) >= syl_private.referral_needed() then
    update public.codes c set kind = 'share' where c.code = v_ref.code;
  end if;
end;
$$;

-- Staff view of one code: nickname, discount, date earned, status.
create function syl_private.code_check(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := syl_private.normalize_code(p_code);
  v_row public.codes;
  v_used_at timestamptz;
  v_status text;
begin
  select * into v_row from public.codes c where c.code = v_code;
  if not found then
    return jsonb_build_object(
      'code', v_code, 'status', 'unknown', 'nickname', null, 'kind', null,
      'discount_percent', 0, 'price_per_person', null, 'earned_at', null, 'used_at', null
    );
  end if;
  select d.used_at into v_used_at from public.redemptions d where d.code = v_code;
  v_status := case
    when v_used_at is not null then 'already_used'
    when now() >= syl_private.code_expires_at() then 'expired'
    else 'valid'
  end;
  return jsonb_build_object(
    'code', v_row.code,
    'status', v_status,
    'nickname', v_row.nickname,
    'kind', v_row.kind,
    'discount_percent', syl_private.discount_percent(v_row.kind),
    'price_per_person', syl_private.price_per_person(v_row.kind),
    'earned_at', v_row.earned_at,
    'used_at', v_used_at
  );
end;
$$;

revoke all on all functions in schema syl_private from public, anon, authenticated;

-- ---------------------------------------------------------------- player RPCs (anon)

-- Store the best score and give one unique code per nickname when the score reaches the limit.
-- A repeat submit for the same nickname returns the existing code.
create function public.issue_code(
  p_nickname text,
  p_score integer,
  p_device_id text,
  p_referral_code text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nickname text := syl_private.clean_nickname(p_nickname);
  v_key text := lower(syl_private.clean_nickname(p_nickname));
  v_error text := syl_private.input_error(v_nickname, p_score, p_device_id);
  v_code text;
  v_new text;
begin
  if v_error is not null then
    return syl_private.submit_result(false, v_error);
  end if;

  insert into public.scores as s (nickname_key, nickname, score, device_id)
  values (v_key, v_nickname, p_score, p_device_id)
  on conflict (nickname_key) do update
    set score = greatest(s.score, excluded.score), updated_at = now();

  perform syl_private.count_referral(p_referral_code, v_key, p_device_id);

  select c.code into v_code from public.codes c where c.nickname_key = v_key;
  if v_code is not null then
    return syl_private.code_result(v_code);
  end if;
  if p_score < syl_private.discount_score() then
    return syl_private.submit_result(true, null);
  end if;
  if now() >= syl_private.code_expires_at() then
    return syl_private.submit_result(false, 'expired');
  end if;

  v_new := syl_private.new_code(v_nickname);
  if v_new is null then
    return syl_private.submit_result(false, 'code');
  end if;
  -- A parallel submit for the same nickname wins the race: return its code.
  insert into public.codes (code, nickname_key, nickname, device_id, score)
  values (v_new, v_key, v_nickname, p_device_id, p_score)
  on conflict do nothing;
  select c.code into v_code from public.codes c where c.nickname_key = v_key;
  if v_code is null then
    return syl_private.submit_result(false, 'code');
  end if;
  return syl_private.code_result(v_code);
end;
$$;

-- Public leaderboard: nickname and score only. No codes and no staff status.
create function public.leaderboard(p_limit integer default 20)
returns table (nickname text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.nickname, s.score
  from public.scores s
  where not s.hidden
  order by s.score desc, s.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 0), 100)
$$;

-- ---------------------------------------------------------------- staff RPCs (authenticated staff only)

create function public.check_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform syl_private.require_staff();
  return syl_private.code_check(p_code);
end;
$$;

-- One successful redeem per code. Unknown, expired and used codes are not redeemed.
create function public.redeem_code(p_code text, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := syl_private.normalize_code(p_code);
  v_check jsonb;
begin
  perform syl_private.require_staff();
  perform 1 from public.codes c where c.code = v_code for update;
  v_check := syl_private.code_check(v_code);
  if v_check ->> 'status' <> 'valid' then
    return jsonb_build_object('ok', false, 'check', v_check);
  end if;
  insert into public.redemptions (code, used_by, note)
  values (v_code, auth.uid(), left(p_note, 200));
  return jsonb_build_object('ok', true, 'check', syl_private.code_check(v_code));
end;
$$;

create function public.list_codes(p_limit integer default 50, p_offset integer default 0)
returns table (
  code text,
  nickname text,
  score integer,
  kind text,
  referrals integer,
  earned_at timestamptz,
  used_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform syl_private.require_staff();
  return query
    select c.code, c.nickname, c.score, c.kind, syl_private.referral_count(c.code), c.earned_at, d.used_at
    from public.codes c
    left join public.redemptions d on d.code = c.code
    order by c.earned_at desc, c.code
    limit least(greatest(coalesce(p_limit, 50), 0), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform syl_private.require_staff();
  return jsonb_build_object(
    'players', (select count(*) from public.scores),
    'codes', (select count(*) from public.codes),
    'share_codes', (select count(*) from public.codes c where c.kind = 'share'),
    'redeemed', (select count(*) from public.redemptions)
  );
end;
$$;

-- Hide a nickname from the public leaderboard (moderation).
create function public.hide_nickname(p_nickname text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform syl_private.require_staff();
  update public.scores s set hidden = true
  where s.nickname_key = lower(syl_private.clean_nickname(p_nickname));
  return found;
end;
$$;

-- ---------------------------------------------------------------- function grants

-- Supabase grants execute to public, anon and authenticated by default. Remove that first.
revoke all on function public.issue_code(text, integer, text, text) from public, anon, authenticated;
revoke all on function public.leaderboard(integer) from public, anon, authenticated;
revoke all on function public.check_code(text) from public, anon, authenticated;
revoke all on function public.redeem_code(text, text) from public, anon, authenticated;
revoke all on function public.list_codes(integer, integer) from public, anon, authenticated;
revoke all on function public.dashboard_stats() from public, anon, authenticated;
revoke all on function public.hide_nickname(text) from public, anon, authenticated;

grant execute on function public.issue_code(text, integer, text, text) to anon, authenticated;
grant execute on function public.leaderboard(integer) to anon, authenticated;
grant execute on function public.check_code(text) to authenticated;
grant execute on function public.redeem_code(text, text) to authenticated;
grant execute on function public.list_codes(integer, integer) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.hide_nickname(text) to authenticated;
