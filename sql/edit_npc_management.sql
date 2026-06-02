-- =========================================================
-- Waymark Codex
-- NPC edit management
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing NPC Edit.

drop function if exists public.update_npc_record(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
);

create or replace function public.update_npc_record(
  target_campaign_id uuid,
  target_npc_id uuid,
  npc_name text,
  npc_title text default null,
  npc_organization text default null,
  npc_race text default null,
  npc_occupation text default null,
  npc_home_poi_id uuid default null,
  npc_lore text default null
)
returns public.npcs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_record public.npcs;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if nullif(trim(npc_name), '') is null then
    raise exception 'NPC name is required.';
  end if;

  if nullif(trim(npc_race), '') is null then
    raise exception 'NPC race is required.';
  end if;

  if nullif(trim(npc_occupation), '') is null then
    raise exception 'NPC occupation is required.';
  end if;

  if npc_home_poi_id is null then
    raise exception 'NPC home is required.';
  end if;

  if not exists (
    select 1
    from public.npcs n
    where n.campaign_id = target_campaign_id
      and n.id = target_npc_id
  ) then
    raise exception 'NPC not found.';
  end if;

  if not exists (
    select 1
    from public.pois p
    where p.campaign_id = target_campaign_id
      and p.id = npc_home_poi_id
  ) then
    raise exception 'Selected home POI does not belong to this campaign.';
  end if;

  update public.npcs
  set name = trim(npc_name),
      title = nullif(trim(npc_title), ''),
      organization = nullif(trim(npc_organization), ''),
      race = trim(npc_race),
      occupation = trim(npc_occupation),
      home_poi_id = npc_home_poi_id,
      lore = nullif(trim(npc_lore), ''),
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_npc_id
  returning * into updated_record;

  return updated_record;
end;
$$;

grant execute on function public.update_npc_record(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) to authenticated;
