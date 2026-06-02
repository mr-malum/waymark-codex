-- =========================================================
-- Waymark Codex
-- Creator-aware record deletion
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing the Delete button.
-- It adds creator tracking to world records and exposes one secure delete RPC.

alter table public.regions
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.hexes
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.poi_groups
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.pois
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.maps
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.npcs
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_regions_campaign_created_by
  on public.regions (campaign_id, created_by);

create index if not exists idx_hexes_campaign_created_by
  on public.hexes (campaign_id, created_by);

create index if not exists idx_poi_groups_campaign_created_by
  on public.poi_groups (campaign_id, created_by);

create index if not exists idx_pois_campaign_created_by
  on public.pois (campaign_id, created_by);

create index if not exists idx_maps_campaign_created_by
  on public.maps (campaign_id, created_by);

create index if not exists idx_npcs_campaign_created_by
  on public.npcs (campaign_id, created_by);

drop function if exists public.create_npc_with_next_ref_code(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  public.content_visibility
);

create or replace function public.create_npc_with_next_ref_code(
  target_campaign_id uuid,
  npc_name text,
  npc_title text default null,
  npc_organization text default null,
  npc_race text default null,
  npc_occupation text default null,
  npc_lore text default null,
  npc_home_poi_id uuid default null,
  npc_visibility public.content_visibility default 'shared'
)
returns public.npcs
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  next_ref_code text;
  created_record public.npcs;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  select coalesce(max(substring(ref_code from '^NPC-([0-9]+)$')::integer), 0) + 1
    into next_number
  from public.npcs
  where campaign_id = target_campaign_id
    and ref_code ~ '^NPC-[0-9]+$';

  next_ref_code := 'NPC-' || lpad(next_number::text, 4, '0');

  insert into public.npcs (
    campaign_id,
    ref_code,
    home_poi_id,
    title,
    name,
    organization,
    race,
    occupation,
    lore,
    visibility,
    created_by
  )
  values (
    target_campaign_id,
    next_ref_code,
    npc_home_poi_id,
    npc_title,
    npc_name,
    npc_organization,
    npc_race,
    npc_occupation,
    npc_lore,
    npc_visibility,
    auth.uid()
  )
  returning * into created_record;

  return created_record;
end;
$$;

grant execute on function public.create_npc_with_next_ref_code(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  public.content_visibility
) to authenticated;

create or replace function public.delete_campaign_record(
  target_campaign_id uuid,
  target_record_type text,
  target_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
  is_region_admin boolean;
  is_creator boolean := false;
  deleted_region_type text;
  deleted_region_ref text;
  default_geographic_region_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  )
  into is_owner;

  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  )
  into is_region_admin;

  if target_record_type = 'region' and not is_region_admin then
    raise exception 'You do not have permission to delete this record.';
  end if;

  if not is_owner then
    case target_record_type
      when 'region' then
        is_creator := is_region_admin;

      when 'hex' then
        select exists (
          select 1 from public.hexes
          where campaign_id = target_campaign_id
            and id = target_record_id
            and created_by = auth.uid()
        ) into is_creator;

      when 'poi_group' then
        select exists (
          select 1 from public.poi_groups
          where campaign_id = target_campaign_id
            and id = target_record_id
            and created_by = auth.uid()
        ) into is_creator;

      when 'poi' then
        select exists (
          select 1 from public.pois
          where campaign_id = target_campaign_id
            and id = target_record_id
            and created_by = auth.uid()
        ) into is_creator;

      when 'npc' then
        select exists (
          select 1 from public.npcs
          where campaign_id = target_campaign_id
            and id = target_record_id
            and created_by = auth.uid()
        ) into is_creator;

      else
        raise exception 'unsupported record type';
    end case;

    if not is_creator then
      raise exception 'You do not have permission to delete this record.';
    end if;
  end if;

  case target_record_type
    when 'region' then
      select region_type, ref_code
        into deleted_region_type, deleted_region_ref
      from public.regions
      where campaign_id = target_campaign_id
        and id = target_record_id;

      if deleted_region_ref = 'REG-0000' then
        raise exception 'The default region cannot be deleted.';
      end if;

      if deleted_region_type = 'geographic' then
        select id into default_geographic_region_id
        from public.regions
        where campaign_id = target_campaign_id
          and region_type = 'geographic'
          and ref_code = 'REG-0000'
        limit 1;

        if default_geographic_region_id is null then
          raise exception 'Default geographic region REG-0000 not found.';
        end if;

        update public.hexes
        set region_id = default_geographic_region_id,
            geographic_region_id = default_geographic_region_id,
            updated_at = now()
        where campaign_id = target_campaign_id
          and (region_id = target_record_id or geographic_region_id = target_record_id);
      elsif deleted_region_type = 'political' then
        update public.hexes
        set political_region_id = null,
            updated_at = now()
        where campaign_id = target_campaign_id
          and political_region_id = target_record_id;
      end if;

      delete from public.regions
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'hex' then
      delete from public.hexes
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'poi_group' then
      delete from public.poi_groups
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'poi' then
      delete from public.pois
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'npc' then
      delete from public.npcs
      where campaign_id = target_campaign_id
        and id = target_record_id;

    else
      raise exception 'unsupported record type';
  end case;
end;
$$;

grant execute on function public.delete_campaign_record(uuid, text, uuid)
  to authenticated;
