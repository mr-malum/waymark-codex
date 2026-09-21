-- Generated hex terrain editing bridge.
-- Run after hex_mapper_import_bridge.sql and generated_map_overlay_management.sql.

alter table public.hexes
add column if not exists subhex_snapshot jsonb;

drop function if exists public.update_generated_hex_terrain(uuid, text, text, jsonb, integer);

create or replace function public.update_generated_hex_terrain(
  target_campaign_id uuid,
  target_hex_ref text,
  target_base_terrain text,
  target_terrain_features jsonb default '[]'::jsonb,
  target_elevation integer default null,
  target_subhex_snapshot jsonb default null,
  replace_subhex_snapshot boolean default false
)
returns public.hexes
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_base text := lower(trim(coalesce(target_base_terrain, '')));
  normalized_features jsonb := coalesce(target_terrain_features, '[]'::jsonb);
  updated_hex public.hexes;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if normalized_base not in (
    'deep_sea',
    'sea',
    'coastal_water',
    'inland_water',
    'beach',
    'plains',
    'grassland',
    'lush_grassland',
    'wetland',
    'jungle_floor',
    'desert',
    'deep_desert',
    'barrens',
    'bleak_barrens',
    'snow',
    'rock',
    'wastes'
  ) then
    raise exception 'unsupported base terrain';
  end if;

  if jsonb_typeof(normalized_features) <> 'array' then
    raise exception 'terrain features must be a JSON array';
  end if;

  if replace_subhex_snapshot
     and target_subhex_snapshot is not null
     and jsonb_typeof(target_subhex_snapshot) <> 'object' then
    raise exception 'subhex snapshot must be a JSON object';
  end if;

  normalized_features := (
    select coalesce(jsonb_agg(distinct lower(trim(value)) order by lower(trim(value))), '[]'::jsonb)
    from jsonb_array_elements_text(normalized_features)
    where nullif(trim(value), '') is not null
      and lower(trim(value)) not in ('snowcap', 'mist')
  );

  if jsonb_array_length(normalized_features) > 3 then
    raise exception 'terrain features are limited to 3 per hex';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(normalized_features) feature(value)
    where value not in (
      'woods',
      'forest',
      'jungle',
      'shrub',
      'cactus_scrub',
      'marsh',
      'kelp',
      'ridges',
      'mountains',
      'snowcapped_mountains',
      'cliffs',
      'lone_mountain',
      'volcano',
      'reef',
      'shoals',
      'water_rocks',
      'rapids',
      'falls',
      'whirlpool',
      'farmland',
      'sand',
      'waves',
      'ice'
    )
  ) then
    raise exception 'unsupported terrain feature';
  end if;

  if (normalized_features ? 'woods') and (normalized_features ? 'forest') then
    raise exception 'woods and forest cannot both be selected';
  end if;

  if (
    case when normalized_features ? 'mountains' then 1 else 0 end +
    case when normalized_features ? 'snowcapped_mountains' then 1 else 0 end +
    case when normalized_features ? 'lone_mountain' then 1 else 0 end +
    case when normalized_features ? 'volcano' then 1 else 0 end
  ) > 1 then
    raise exception 'mountain feature variants cannot be combined';
  end if;

  update public.hexes
  set base_terrain = normalized_base,
      terrain_features = normalized_features,
      elevation = target_elevation,
      terrain = public.format_hex_mapper_terrain(normalized_base, normalized_features),
      subhex_snapshot = case
        when replace_subhex_snapshot then target_subhex_snapshot
        else subhex_snapshot
      end,
      updated_at = now()
  where campaign_id = target_campaign_id
    and ref_code = target_hex_ref
    and base_terrain is not null
  returning * into updated_hex;

  if updated_hex.id is null then
    raise exception 'Generated hex not found.';
  end if;

  return updated_hex;
end;
$$;

grant execute on function public.update_generated_hex_terrain(uuid, text, text, jsonb, integer, jsonb, boolean)
to authenticated;
