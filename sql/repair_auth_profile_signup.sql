-- =========================================================
-- Waymark Codex
-- Repair auth signup -> public.profiles bridge
-- =========================================================
--
-- Run this in Supabase SQL Editor if signup reports:
-- "Database error saving new user"

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set username = 'user_' || replace(left(id::text, 8), '-', '')
where username is null
   or trim(username) = '';

alter table public.profiles
  alter column username set not null;

create unique index if not exists idx_profiles_username_lower_unique
  on public.profiles (lower(username::text));

create unique index if not exists idx_profiles_email_lower_unique
  on public.profiles (lower(email::text))
  where email is not null;

create or replace function public.normalize_campaign_username(raw_username text, fallback_user_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  cleaned text := trim(coalesce(raw_username, ''));
begin
  if cleaned !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$' then
    cleaned := 'user_' || replace(left(fallback_user_id::text, 8), '-', '');
  end if;

  return cleaned;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  final_username text;
  suffix text := replace(left(new.id::text, 8), '-', '');
begin
  requested_username := public.normalize_campaign_username(
    coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    new.id
  );

  final_username := requested_username;

  if exists (
    select 1
    from public.profiles p
    where lower(p.username::text) = lower(final_username)
      and p.id <> new.id
  ) then
    final_username := left(requested_username, greatest(3, 31 - length(suffix))) || '_' || suffix;
  end if;

  insert into public.profiles (
    id,
    username,
    email,
    created_at,
    updated_at
  )
  values (
    new.id,
    final_username,
    lower(new.email),
    now(),
    now()
  )
  on conflict (id) do update
  set username = excluded.username,
      email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.resolve_login_email_by_username(target_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where lower(p.username::text) = lower(trim(target_username))
  limit 1;
$$;

grant execute on function public.resolve_login_email_by_username(text) to anon, authenticated;
grant execute on function public.normalize_campaign_username(text, uuid) to authenticated;
