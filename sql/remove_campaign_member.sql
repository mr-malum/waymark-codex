-- =========================================================
-- Waymark Codex
-- Remove a member from a campaign
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing member removal.
-- Only campaign owners can remove members, and owners cannot be removed here.

create or replace function public.remove_campaign_member(
  target_campaign_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role public.campaign_role;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'not authorized';
  end if;

  select role
    into target_role
  from public.campaign_members
  where campaign_id = target_campaign_id
    and user_id = target_user_id;

  if target_role is null then
    raise exception 'member not found';
  end if;

  if target_role = 'owner' then
    raise exception 'campaign owners cannot be removed here';
  end if;

  delete from public.campaign_members
  where campaign_id = target_campaign_id
    and user_id = target_user_id;
end;
$$;

grant execute on function public.remove_campaign_member(uuid, uuid)
  to authenticated;
