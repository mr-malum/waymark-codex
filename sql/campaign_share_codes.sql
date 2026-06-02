-- =========================================================
-- Waymark Codex
-- Campaign share codes
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing share-code generation.
-- Codes are shown once to owners; only SHA-256 hashes are stored.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.campaign_join_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code_hash text not null unique,
  role_to_grant public.campaign_role not null default 'editor'::public.campaign_role,
  max_uses integer not null default 1 check (max_uses between 1 and 10),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.campaign_join_codes enable row level security;

create or replace function public.normalize_campaign_share_code(raw_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.generate_campaign_share_code(
  target_campaign_id uuid,
  role_to_grant public.campaign_role default 'editor'::public.campaign_role,
  max_uses integer default 1,
  expires_in_hours integer default 168
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_code text;
  formatted_code text;
  normalized_code text;
  hashed_code text;
  effective_role public.campaign_role := coalesce(role_to_grant, 'editor'::public.campaign_role);
  effective_max_uses integer := least(greatest(coalesce(max_uses, 1), 1), 10);
  effective_expires_in_hours integer := least(greatest(coalesce(expires_in_hours, 168), 1), 720);
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if effective_role::text not in ('editor', 'viewer') then
    raise exception 'share codes can only grant editor or viewer access';
  end if;

  if not public.has_campaign_role(
    target_campaign_id,
    array['owner', 'superuser']::public.campaign_role[]
  ) then
    raise exception 'not authorized';
  end if;

  loop
    raw_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 12));
    formatted_code := substr(raw_code, 1, 4) || '-' || substr(raw_code, 5, 4) || '-' || substr(raw_code, 9, 4);
    normalized_code := public.normalize_campaign_share_code(formatted_code);
    hashed_code := encode(extensions.digest(normalized_code, 'sha256'), 'hex');

    begin
      insert into public.campaign_join_codes (
        campaign_id,
        code_hash,
        role_to_grant,
        max_uses,
        expires_at,
        created_by_user_id
      )
      values (
        target_campaign_id,
        hashed_code,
        effective_role,
        effective_max_uses,
        now() + make_interval(hours => effective_expires_in_hours),
        auth.uid()
      );

      return formatted_code;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.redeem_campaign_share_code(raw_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := public.normalize_campaign_share_code(raw_code);
  hashed_code text;
  join_code public.campaign_join_codes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if normalized_code = '' then
    raise exception 'share code is required';
  end if;

  hashed_code := encode(extensions.digest(normalized_code, 'sha256'), 'hex');

  select *
    into join_code
  from public.campaign_join_codes
  where code_hash = hashed_code
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  for update;

  if join_code.id is null then
    raise exception 'share code is invalid or expired';
  end if;

  insert into public.campaign_members (
    campaign_id,
    user_id,
    role
  )
  values (
    join_code.campaign_id,
    auth.uid(),
    join_code.role_to_grant
  )
  on conflict (campaign_id, user_id)
  do nothing;

  update public.campaign_join_codes
  set use_count = use_count + 1
  where id = join_code.id;

  return join_code.campaign_id;
end;
$$;

grant execute on function public.normalize_campaign_share_code(text)
  to authenticated;

grant execute on function public.generate_campaign_share_code(uuid, public.campaign_role, integer, integer)
  to authenticated;

grant execute on function public.redeem_campaign_share_code(text)
  to authenticated;

notify pgrst, 'reload schema';
