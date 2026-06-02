-- =========================================================
-- Waymark Codex
-- Change username with case-insensitive uniqueness + cooldown
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing User Settings > Change Username.

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create unique index if not exists idx_profiles_username_lower_unique
  on public.profiles (lower(username::text));

drop function if exists public.change_username(text);

create or replace function public.change_username(new_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_username text;
  current_profile public.profiles;
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  cleaned_username := trim(new_username);

  if cleaned_username is null or cleaned_username = '' then
    raise exception 'Username is required.';
  end if;

  if cleaned_username !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$' then
    raise exception 'Username must be 3–32 characters and use letters, numbers, underscores, or hyphens.';
  end if;

  select *
    into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Profile not found.';
  end if;

  if current_profile.username = cleaned_username then
    raise exception 'That is already your username.';
  end if;

  if current_profile.username_changed_at is not null
    and current_profile.username_changed_at > now() - interval '24 hours' then
    raise exception 'Username can only be changed once every 24 hours.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id <> auth.uid()
      and lower(p.username::text) = lower(cleaned_username)
  ) then
    raise exception 'That username is already taken.';
  end if;

  update public.profiles
  set username = cleaned_username,
      username_changed_at = now()
  where id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

grant execute on function public.change_username(text) to authenticated;
