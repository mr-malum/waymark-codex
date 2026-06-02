-- =========================================================
-- Waymark Codex
-- Owner-only campaign copy helper for generated-map testing
-- =========================================================
--
-- Run this in Supabase SQL Editor after hex_mapper_import_bridge.sql.
-- This creates a separate test campaign owned by the caller and copies
-- records without copying assets/storage files. Image/map asset links are
-- intentionally left empty in the copy.

create or replace function public.slugify_campaign_name(raw_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(trim(coalesce(raw_name, 'campaign'))), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'campaign'
  );
$$;

create or replace function public.copy_campaign_for_testing(
  source_campaign_id uuid,
  copied_campaign_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_campaign public.campaigns;
  new_campaign_id uuid;
  base_slug text;
  candidate_slug text;
  suffix integer := 2;
  source_region public.regions;
  source_hex public.hexes;
  source_group public.poi_groups;
  source_poi public.pois;
  source_npc public.npcs;
  source_map public.maps;
  source_entry public.dm_journal;
  copied_name text;
  new_id uuid;
  copied_source_id uuid;
  actor_user_id uuid;
begin
  select *
    into source_campaign
  from public.campaigns
  where id = source_campaign_id;

  if source_campaign.id is null then
    raise exception 'source campaign not found';
  end if;

  actor_user_id := coalesce(auth.uid(), source_campaign.owner_user_id);

  if actor_user_id is null then
    raise exception 'not authorized';
  end if;

  if auth.uid() is not null and not public.has_campaign_role(
    source_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only campaign owners can copy campaigns';
  end if;

  copied_name := coalesce(nullif(trim(copied_campaign_name), ''), source_campaign.name || ' Test Copy');
  base_slug := public.slugify_campaign_name(copied_name);
  candidate_slug := base_slug;

  while exists (
    select 1
    from public.campaigns
    where slug = candidate_slug
  ) loop
    candidate_slug := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.campaigns (
    name,
    slug,
    owner_user_id,
    main_map_width,
    main_map_height,
    map_mode,
    generated_map_config
  )
  values (
    copied_name,
    candidate_slug,
    actor_user_id,
    source_campaign.main_map_width,
    source_campaign.main_map_height,
    'static',
    '{}'::jsonb
  )
  returning id into new_campaign_id;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (new_campaign_id, actor_user_id, 'owner'::public.campaign_role)
  on conflict on constraint campaign_members_pkey
  do update set role = excluded.role;

  create temporary table if not exists campaign_copy_id_map (
    record_type text not null,
    old_id uuid not null,
    new_id uuid not null,
    primary key (record_type, old_id)
  ) on commit drop;

  delete from campaign_copy_id_map;

  for source_region in
    select * from public.regions where campaign_id = source_campaign_id order by created_at, ref_code
  loop
    insert into public.regions (
      campaign_id,
      ref_code,
      name,
      lore,
      region_type,
      border_color,
      created_by
    )
    values (
      new_campaign_id,
      source_region.ref_code,
      source_region.name,
      source_region.lore,
      coalesce(source_region.region_type, 'geographic'),
      case
        when source_region.ref_code = 'REG-0000'
          and coalesce(source_region.region_type, 'geographic') = 'geographic'
          then 'none'
        when source_region.border_color = 'none'
          then 'none'
        when source_region.border_color ~ '^#[0-9a-fA-F]{6}$'
          then lower(source_region.border_color)
        when lower(coalesce(source_region.border_color, '')) = 'red'
          then '#ff2d2d'
        when lower(coalesce(source_region.border_color, '')) = 'blue'
          then '#1f7cff'
        when lower(coalesce(source_region.border_color, '')) = 'yellow'
          then '#ffe600'
        when lower(coalesce(source_region.border_color, '')) = 'green'
          then '#39ff14'
        when lower(coalesce(source_region.border_color, '')) = 'orange'
          then '#ff8a00'
        when lower(coalesce(source_region.border_color, '')) = 'purple'
          then '#bf4dff'
        when lower(coalesce(source_region.border_color, '')) = 'black'
          then '#070707'
        when lower(coalesce(source_region.border_color, '')) = 'white'
          then '#ffffff'
        when lower(coalesce(source_region.border_color, '')) = 'brown'
          then '#d9782d'
        else '#ffd84d'
      end,
      actor_user_id
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('region', source_region.id, new_id);
  end loop;

  for source_hex in
    select * from public.hexes where campaign_id = source_campaign_id order by ref_code
  loop
    insert into public.hexes (
      campaign_id,
      ref_code,
      terrain,
      map_xy,
      region_id,
      geographic_region_id,
      political_region_id,
      base_terrain,
      terrain_features,
      elevation,
      created_by
    )
    values (
      new_campaign_id,
      source_hex.ref_code,
      source_hex.terrain,
      source_hex.map_xy,
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'region' and m.old_id = source_hex.region_id),
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'region' and m.old_id = source_hex.geographic_region_id),
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'region' and m.old_id = source_hex.political_region_id),
      source_hex.base_terrain,
      coalesce(source_hex.terrain_features, '[]'::jsonb),
      source_hex.elevation,
      actor_user_id
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('hex', source_hex.id, new_id);
  end loop;

  for source_group in
    select * from public.poi_groups where campaign_id = source_campaign_id order by created_at, slug
  loop
    insert into public.poi_groups (
      campaign_id,
      slug,
      name,
      group_type,
      population,
      lore,
      created_by
    )
    values (
      new_campaign_id,
      source_group.slug,
      source_group.name,
      source_group.group_type,
      source_group.population,
      source_group.lore,
      actor_user_id
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('poi_group', source_group.id, new_id);
  end loop;

  for source_poi in
    select * from public.pois where campaign_id = source_campaign_id order by created_at, ref_code
  loop
    insert into public.pois (
      campaign_id,
      ref_code,
      poi_group_id,
      name,
      hex_id,
      poi_type,
      notoriety_tier,
      population,
      lore,
      visibility,
      created_by
    )
    values (
      new_campaign_id,
      source_poi.ref_code,
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'poi_group' and m.old_id = source_poi.poi_group_id),
      source_poi.name,
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'hex' and m.old_id = source_poi.hex_id),
      source_poi.poi_type,
      source_poi.notoriety_tier,
      source_poi.population,
      source_poi.lore,
      source_poi.visibility,
      actor_user_id
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('poi', source_poi.id, new_id);
  end loop;

  for source_npc in
    select * from public.npcs where campaign_id = source_campaign_id order by created_at, ref_code
  loop
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
      new_campaign_id,
      source_npc.ref_code,
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'poi' and m.old_id = source_npc.home_poi_id),
      source_npc.title,
      source_npc.name,
      source_npc.organization,
      source_npc.race,
      source_npc.occupation,
      source_npc.lore,
      source_npc.visibility,
      actor_user_id
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('npc', source_npc.id, new_id);
  end loop;

  for source_map in
    select * from public.maps where campaign_id = source_campaign_id order by sort_order nulls last, created_at, ref_code
  loop
    insert into public.maps (
      campaign_id,
      ref_code,
      name,
      map_type,
      sort_order,
      lore,
      region_owner_id,
      poi_group_owner_id,
      poi_owner_id,
      hex_owner_id,
      created_by
    )
    values (
      new_campaign_id,
      source_map.ref_code,
      source_map.name,
      source_map.map_type,
      source_map.sort_order,
      source_map.lore,
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'region' and m.old_id = source_map.region_owner_id),
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'poi_group' and m.old_id = source_map.poi_group_owner_id),
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'poi' and m.old_id = source_map.poi_owner_id),
      (select m.new_id from campaign_copy_id_map m where m.record_type = 'hex' and m.old_id = source_map.hex_owner_id),
      actor_user_id
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('map', source_map.id, new_id);
  end loop;

  for source_entry in
    select * from public.dm_journal where campaign_id = source_campaign_id order by occurred_at nulls last, created_at, ref_code
  loop
    copied_source_id := case source_entry.source_type
      when 'campaign' then new_campaign_id
      when 'region' then (select m.new_id from campaign_copy_id_map m where m.record_type = 'region' and m.old_id = source_entry.source_id)
      when 'hex' then (select m.new_id from campaign_copy_id_map m where m.record_type = 'hex' and m.old_id = source_entry.source_id)
      when 'poi_group' then (select m.new_id from campaign_copy_id_map m where m.record_type = 'poi_group' and m.old_id = source_entry.source_id)
      when 'poi' then (select m.new_id from campaign_copy_id_map m where m.record_type = 'poi' and m.old_id = source_entry.source_id)
      when 'npc' then (select m.new_id from campaign_copy_id_map m where m.record_type = 'npc' and m.old_id = source_entry.source_id)
      when 'map' then (select m.new_id from campaign_copy_id_map m where m.record_type = 'map' and m.old_id = source_entry.source_id)
      else null
    end;

    insert into public.dm_journal (
      campaign_id,
      ref_code,
      entry_title,
      entry_body,
      entry_type,
      source_type,
      source_id,
      occurred_at,
      created_by_user_id,
      session_id,
      visibility
    )
    values (
      new_campaign_id,
      source_entry.ref_code,
      source_entry.entry_title,
      source_entry.entry_body,
      source_entry.entry_type,
      source_entry.source_type,
      copied_source_id,
      source_entry.occurred_at,
      actor_user_id,
      source_entry.session_id,
      source_entry.visibility
    )
    returning id into new_id;

    insert into campaign_copy_id_map values ('dm_journal', source_entry.id, new_id);
  end loop;

  return new_campaign_id;
end;
$$;

grant execute on function public.copy_campaign_for_testing(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
