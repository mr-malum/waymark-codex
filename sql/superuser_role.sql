-- =========================================================
-- Waymark Codex
-- Superuser campaign role
-- =========================================================
--
-- Run this in Supabase SQL Editor.

alter type public.campaign_role add value if not exists 'superuser';

create or replace function public.can_edit_campaign(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser', 'editor')
  );
$$;

drop function if exists public.set_campaign_member_role(uuid, uuid, public.campaign_role);

create or replace function public.set_campaign_member_role(
  target_campaign_id uuid,
  target_user_id uuid,
  target_role public.campaign_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_role public.campaign_role;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  ) then
    raise exception 'not authorized';
  end if;

  if target_role::text = 'owner' then
    raise exception 'owner role cannot be assigned here';
  end if;

  select role
    into existing_role
  from public.campaign_members
  where campaign_id = target_campaign_id
    and user_id = target_user_id;

  if existing_role is null then
    raise exception 'member not found';
  end if;

  if existing_role::text = 'owner' then
    raise exception 'campaign owners cannot be changed here';
  end if;

  if existing_role::text = 'superuser' and not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only owners can change superusers';
  end if;

  if target_role::text = 'superuser' and not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only owners can assign superusers';
  end if;

  update public.campaign_members
  set role = target_role
  where campaign_id = target_campaign_id
    and user_id = target_user_id;
end;
$$;

grant execute on function public.set_campaign_member_role(uuid, uuid, public.campaign_role)
  to authenticated;

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

  if not exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  ) then
    raise exception 'not authorized';
  end if;

  if target_role::text = 'owner' then
    raise exception 'owner role cannot be assigned here';
  end if;

  if target_role::text = 'superuser' and not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only owners can assign superusers';
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

grant execute on function public.add_campaign_member_by_username(uuid, text, public.campaign_role)
  to authenticated;

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

  if not exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
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

  if target_role::text = 'owner' then
    raise exception 'campaign owners cannot be removed here';
  end if;

  if target_role::text = 'superuser' and not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only owners can remove superusers';
  end if;

  delete from public.campaign_members
  where campaign_id = target_campaign_id
    and user_id = target_user_id;
end;
$$;

grant execute on function public.remove_campaign_member(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';
