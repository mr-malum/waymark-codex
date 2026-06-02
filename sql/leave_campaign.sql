-- =========================================================
-- Waymark Codex
-- Leave campaign
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing Leave Campaign.
-- Members can remove themselves unless they are the campaign owner.

create or replace function public.leave_campaign(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.campaign_role;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select role
    into current_role
  from public.campaign_members
  where campaign_id = target_campaign_id
    and user_id = auth.uid();

  if current_role is null then
    raise exception 'not a campaign member';
  end if;

  if current_role = 'owner' then
    raise exception 'Campaign owners cannot leave their own campaign.';
  end if;

  delete from public.campaign_members
  where campaign_id = target_campaign_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_campaign(uuid)
  to authenticated;
