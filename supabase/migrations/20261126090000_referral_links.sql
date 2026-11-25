-- NYE game: referral links for the share bonus (299 zl per person after 5 referred players).
-- Paste this whole file into the Supabase SQL editor and click Run. You can run it again safely.
-- Do not put keys in this file. The app uses only the anon key.
--
-- A shared link carries an opaque token (?ref=<token>), not the discount code.
-- So a shared link does not give other people a code that staff can redeem.
-- A referred device counts once per referrer, also when it plays many rounds.
-- The device that earned the code does not count for its own code.

-- ---------------------------------------------------------------- tables

-- One referral token per discount code.
create table if not exists public.referral_links (
  token text primary key check (token ~ '^[2-9A-HJ-NP-Z]{10}$'),
  code text not null unique references public.codes (code),
  created_at timestamptz not null default now()
);

alter table public.referral_links enable row level security;
revoke all on public.referral_links from public, anon, authenticated;

-- ---------------------------------------------------------------- private helpers

-- Count distinct referred devices. A device that finishes a round and also claims a code counts once.
create or replace function syl_private.referral_count(p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct r.device_id)::integer from public.referrals r where r.referrer_code = p_code
$$;

-- A random 10-character token. Null after 20 failed attempts.
create or replace function syl_private.new_referral_token()
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
    for i in 0..9 loop
      v_token := v_token || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1);
    end loop;
    if not exists (select 1 from public.referral_links l where l.token = v_token) then
      return v_token;
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function syl_private.referral_count(text) from public, anon, authenticated;
revoke all on function syl_private.new_referral_token() from public, anon, authenticated;

-- ---------------------------------------------------------------- player RPCs (anon)

-- The owner of a code gets its referral token and the progress to the share bonus.
-- The code is the proof of ownership. An unknown code returns null.
create or replace function public.referral_status(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.codes;
  v_token text;
begin
  select * into v_row from public.codes c where c.code = syl_private.normalize_code(p_code);
  if not found then
    return null;
  end if;
  select l.token into v_token from public.referral_links l where l.code = v_row.code;
  if v_token is null then
    insert into public.referral_links (token, code)
    values (syl_private.new_referral_token(), v_row.code)
    on conflict do nothing;
    select l.token into v_token from public.referral_links l where l.code = v_row.code;
  end if;
  return jsonb_build_object(
    'token', v_token,
    'referral_progress', least(syl_private.referral_count(v_row.code), syl_private.referral_needed()),
    'referral_needed', syl_private.referral_needed(),
    'discount_percent', syl_private.discount_percent(v_row.kind)
  );
end;
$$;

-- A referred player finished a round. Returns true when the device counts for the referrer.
create or replace function public.record_referral_finish(p_token text, p_device_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code public.codes;
begin
  if char_length(coalesce(p_device_id, '')) not between 1 and syl_private.device_id_max_length() then
    return false;
  end if;
  select c.* into v_code
  from public.referral_links l
  join public.codes c on c.code = l.code
  where l.token = upper(trim(coalesce(p_token, '')));
  if not found or v_code.device_id = p_device_id then
    return false;
  end if;
  if exists (
    select 1 from public.referrals r
    where r.referrer_code = v_code.code and r.device_id = p_device_id
  ) then
    return false;
  end if;
  insert into public.referrals (referrer_code, device_id, nickname_key)
  values (v_code.code, p_device_id, '')
  on conflict do nothing;
  if syl_private.referral_count(v_code.code) >= syl_private.referral_needed() then
    update public.codes c set kind = 'share' where c.code = v_code.code;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------- function grants

revoke all on function public.referral_status(text) from public, anon, authenticated;
revoke all on function public.record_referral_finish(text, text) from public, anon, authenticated;

grant execute on function public.referral_status(text) to anon, authenticated;
grant execute on function public.record_referral_finish(text, text) to anon, authenticated;
