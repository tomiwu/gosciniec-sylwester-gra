-- Anti-cheat rounds: start_round, issue_round_score, staff replay, and verified scores.
-- Paste after 20261126090000_referrals_and_nick_owner.sql, or use the combined
-- file in supabase/sql/paste_referrals_and_anticheat.sql. Safe to run again.
-- Do not put keys in this file. The app uses only the anon key.
--
-- Max score 3210 = maxPossibleScore() in src/config.ts:
--   fastest spawn interval = 600 ms / (1 + 1.25) = 266.67 ms
--   max spawns in 42 s = floor(42000 / 266.67) + 1 = 158
--   158 * 20 (clock item) + 50 slack = 3210.
-- Min wall time 20000 ms: a honest round is about 25 s, minus 5 s slack.
-- Max age 180000 ms (3 minutes) from start_round to submit.
-- Rate limits: 20 rounds per hour and 60 rounds per day per device.
-- Replay of the seed plus the input log is not done in SQL. Staff verify
-- runs the TypeScript replay (src/game/replay.ts). Human-likeness flags
-- do not reject a score.

-- ---------------------------------------------------------------- rules

create or replace function syl_private.min_wall_ms() returns integer language sql immutable as $$ select 20000 $$;
create or replace function syl_private.max_round_age_ms() returns integer language sql immutable as $$ select 180000 $$;
create or replace function syl_private.rounds_per_hour() returns integer language sql immutable as $$ select 20 $$;
create or replace function syl_private.rounds_per_day() returns integer language sql immutable as $$ select 60 $$;
create or replace function syl_private.log_max_bytes() returns integer language sql immutable as $$ select 16384 $$;

-- Staff may use a staff Auth user, or the service role from the private Kody panel.
create or replace function syl_private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'service_role'
      or exists (select 1 from public.staff s where s.user_id = auth.uid())
$$;

-- ---------------------------------------------------------------- tables

alter table public.scores
  add column if not exists verified boolean not null default true;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  token text not null unique,
  seed bigint not null,
  started_at timestamptz not null default now(),
  used_at timestamptz,
  score integer,
  wall_ms integer,
  nickname text,
  summary jsonb,
  flags text[] not null default '{}',
  replay_ok boolean,
  verified_at timestamptz
);

create index if not exists rounds_device_started_idx
  on public.rounds (device_id, started_at desc);

create table if not exists public.round_logs (
  round_id uuid primary key references public.rounds (id) on delete cascade,
  input_log text not null check (char_length(input_log) <= 16384),
  created_at timestamptz not null default now()
);

alter table public.rounds enable row level security;
alter table public.round_logs enable row level security;

revoke all on public.rounds, public.round_logs from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers

create or replace function syl_private.new_round_token()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_token text;
begin
  for attempt in 1..20 loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_token := '';
    for i in 0..15 loop
      v_token := v_token || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1);
    end loop;
    if not exists (select 1 from public.rounds r where r.token = v_token) then
      return v_token;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function syl_private.summary_matches(p_summary jsonb, p_score integer)
returns boolean
language plpgsql
immutable
as $$
declare
  v_glass integer;
  v_star integer;
  v_clock integer;
  v_hits integer;
begin
  if p_summary is null then
    return false;
  end if;
  begin
    v_glass := (p_summary ->> 'glass')::integer;
    v_star := (p_summary ->> 'star')::integer;
    v_clock := (p_summary ->> 'clock')::integer;
    v_hits := (p_summary ->> 'hits')::integer;
  exception when others then
    return false;
  end;
  if v_glass is null or v_star is null or v_clock is null or v_hits is null then
    return false;
  end if;
  if v_glass < 0 or v_star < 0 or v_clock < 0 or v_hits < 0 then
    return false;
  end if;
  if v_glass + v_star + v_clock + v_hits > 158 then
    return false;
  end if;
  return v_glass * 10 + v_star * 15 + v_clock * 20 = p_score;
end;
$$;

revoke all on function syl_private.new_round_token() from public, anon, authenticated;
revoke all on function syl_private.summary_matches(jsonb, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------- player RPCs

create or replace function public.start_round(p_device_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_id uuid;
  v_seed bigint;
  v_hour integer;
  v_day integer;
begin
  if char_length(coalesce(p_device_id, '')) not between 1 and syl_private.device_id_max_length() then
    return jsonb_build_object('error', 'device');
  end if;
  select count(*)::integer into v_hour
    from public.rounds r
    where r.device_id = p_device_id
      and r.started_at > now() - interval '1 hour';
  select count(*)::integer into v_day
    from public.rounds r
    where r.device_id = p_device_id
      and r.started_at > now() - interval '1 day';
  if v_hour >= syl_private.rounds_per_hour() or v_day >= syl_private.rounds_per_day() then
    return jsonb_build_object('error', 'limit');
  end if;
  v_token := syl_private.new_round_token();
  if v_token is null then
    return jsonb_build_object('error', 'token');
  end if;
  v_seed := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint;
  insert into public.rounds (device_id, token, seed)
  values (p_device_id, v_token, v_seed)
  returning id into v_id;
  return jsonb_build_object('round_id', v_id, 'token', v_token, 'seed', v_seed);
end;
$$;

-- Legacy submit: still issues a code, but the row is not verified for the prize board.
create or replace function public.issue_code(
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
  v_owner text;
  v_code text;
  v_new text;
begin
  if v_error is not null then
    return syl_private.submit_result(false, v_error);
  end if;

  insert into public.scores as s (nickname_key, nickname, score, device_id, verified)
  values (v_key, v_nickname, p_score, p_device_id, false)
  on conflict (nickname_key) do update
    set score = greatest(s.score, excluded.score), updated_at = now()
    where s.device_id = excluded.device_id;

  select s.device_id into v_owner from public.scores s where s.nickname_key = v_key;
  if v_owner is distinct from p_device_id then
    return syl_private.submit_result(false, 'nickname_taken');
  end if;

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

create or replace function public.issue_round_score(
  p_nickname text,
  p_score integer,
  p_device_id text,
  p_round_id uuid,
  p_token text,
  p_summary jsonb,
  p_input_log text,
  p_wall_ms integer default null,
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
  v_round public.rounds;
  v_owner text;
  v_code text;
  v_new text;
  v_age_ms integer;
begin
  if v_error is not null then
    return syl_private.submit_result(false, v_error);
  end if;
  select * into v_round from public.rounds r where r.id = p_round_id for update;
  if not found or v_round.token is distinct from upper(trim(coalesce(p_token, '')))
     or v_round.device_id is distinct from p_device_id then
    return syl_private.submit_result(false, 'round');
  end if;
  if v_round.used_at is not null then
    return syl_private.submit_result(false, 'used');
  end if;
  v_age_ms := (extract(epoch from (now() - v_round.started_at)) * 1000)::integer;
  if v_age_ms < syl_private.min_wall_ms() then
    return syl_private.submit_result(false, 'too_short');
  end if;
  if v_age_ms > syl_private.max_round_age_ms() then
    return syl_private.submit_result(false, 'expired');
  end if;
  if not syl_private.summary_matches(p_summary, p_score) then
    return syl_private.submit_result(false, 'summary');
  end if;
  if p_score > 0 and char_length(coalesce(p_input_log, '')) < 2 then
    return syl_private.submit_result(false, 'log');
  end if;
  if char_length(coalesce(p_input_log, '')) > syl_private.log_max_bytes() then
    return syl_private.submit_result(false, 'log');
  end if;

  insert into public.round_logs (round_id, input_log)
  values (v_round.id, coalesce(p_input_log, ''))
  on conflict (round_id) do update set input_log = excluded.input_log;

  update public.rounds r
    set used_at = now(),
        score = p_score,
        wall_ms = coalesce(p_wall_ms, v_age_ms),
        nickname = v_nickname,
        summary = p_summary
    where r.id = v_round.id;

  insert into public.scores as s (nickname_key, nickname, score, device_id, verified)
  values (v_key, v_nickname, p_score, p_device_id, true)
  on conflict (nickname_key) do update
    set score = greatest(s.score, excluded.score),
        verified = true,
        updated_at = now()
    where s.device_id = excluded.device_id;

  select s.device_id into v_owner from public.scores s where s.nickname_key = v_key;
  if v_owner is distinct from p_device_id then
    return syl_private.submit_result(false, 'nickname_taken');
  end if;

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

create or replace function public.leaderboard(p_limit integer default 20)
returns table(nickname text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.nickname, s.score
  from public.scores s
  where not s.hidden and s.verified
  order by s.score desc, s.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

-- ---------------------------------------------------------------- staff RPCs

create or replace function public.list_top_rounds(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform syl_private.require_staff();
  return coalesce((
    select jsonb_agg(row_to_json(x))
    from (
      select r.id, r.nickname, r.score, r.wall_ms, r.started_at, r.flags, r.replay_ok, r.summary
      from public.rounds r
      where r.used_at is not null
      order by r.score desc, r.started_at asc
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_round_log(p_round_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  perform syl_private.require_staff();
  select r.seed, r.score, l.input_log
    into v_row
  from public.rounds r
  join public.round_logs l on l.round_id = r.id
  where r.id = p_round_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'seed', v_row.seed,
    'score', v_row.score,
    'input_log', v_row.input_log
  );
end;
$$;

create or replace function public.confirm_replay(
  p_round_id uuid,
  p_ok boolean,
  p_flags text[] default '{}'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform syl_private.require_staff();
  update public.rounds r
    set replay_ok = p_ok,
        flags = coalesce(p_flags, '{}'),
        verified_at = now()
    where r.id = p_round_id;
  return found;
end;
$$;

-- ---------------------------------------------------------------- grants

revoke all on function public.start_round(text) from public, anon, authenticated;
revoke all on function public.issue_round_score(text, integer, text, uuid, text, jsonb, text, integer, text) from public, anon, authenticated;
revoke all on function public.list_top_rounds(integer) from public, anon, authenticated;
revoke all on function public.get_round_log(uuid) from public, anon, authenticated;
revoke all on function public.confirm_replay(uuid, boolean, text[]) from public, anon, authenticated;

grant execute on function public.start_round(text) to anon, authenticated;
grant execute on function public.issue_round_score(text, integer, text, uuid, text, jsonb, text, integer, text) to anon, authenticated;
grant execute on function public.list_top_rounds(integer) to authenticated;
grant execute on function public.get_round_log(uuid) to authenticated;
grant execute on function public.confirm_replay(uuid, boolean, text[]) to authenticated;
