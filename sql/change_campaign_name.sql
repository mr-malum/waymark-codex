-- =========================================================
-- Campaign Codex
-- Change campaign name
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing campaign renaming.
-- Only campaign owners can rename a campaign.

alter table public.campaigns
  add column if not exists name_changed_at timestamptz;

drop function if exists public.change_campaign_name(uuid, text);

create or replace function public.change_campaign_name(
  target_campaign_id uuid,
  new_name text,
  rate_limit_hours integer default 24
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := nullif(trim(new_name), '');
  current_name text;
  last_changed_at timestamptz;
  effective_rate_limit_hours integer := greatest(coalesce(rate_limit_hours, 24), 24);
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if normalized_name is null then
    raise exception 'campaign name is required';
  end if;

  if char_length(normalized_name) > 80 then
    raise exception 'campaign name must be 80 characters or fewer';
  end if;

  if not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'not authorized';
  end if;

  select name, name_changed_at
    into current_name, last_changed_at
  from public.campaigns
  where id = target_campaign_id;

  if current_name is null then
    raise exception 'campaign not found';
  end if;

  if normalized_name = current_name then
    return normalized_name;
  end if;

  if last_changed_at is not null
    and last_changed_at > now() - make_interval(hours => effective_rate_limit_hours)
  then
    raise exception 'campaign name can only be changed once every % hours', effective_rate_limit_hours;
  end if;

  update public.campaigns
  set
    name = normalized_name,
    name_changed_at = now()
  where id = target_campaign_id;

  if not found then
    raise exception 'campaign not found';
  end if;

  return normalized_name;
end;
$$;

grant execute on function public.change_campaign_name(uuid, text, integer)
  to authenticated;

notify pgrst, 'reload schema';
