-- =========================================================
-- Waymark Codex
-- Case-insensitive campaign member lookup
-- =========================================================
--
-- Run this if adding a member by username still behaves case-sensitively.

create or replace function public.add_campaign_member_by_username(
  target_campaign_id uuid,
  target_username text,
  target_role public.campaign_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
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

  if target_role = 'owner' then
    raise exception 'owner role cannot be assigned here';
  end if;

  select p.id
    into target_user_id
  from public.profiles p
  where lower(p.username::text) = lower(trim(target_username))
  limit 1;

  if target_user_id is null then
    raise exception 'No user found with that username.';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (target_campaign_id, target_user_id, target_role)
  on conflict on constraint campaign_members_pkey
  do update set role = excluded.role;
end;
$$;

grant execute on function public.add_campaign_member_by_username(
  uuid,
  text,
  public.campaign_role
) to authenticated;
