-- =========================================================
-- Waymark Codex
-- Region edit management
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing Region Edit.

alter table public.regions
  add column if not exists border_color text not null default '#ffd84d';

alter table public.regions
  drop constraint if exists regions_border_color_check;

update public.regions
set border_color = case border_color
  when 'red' then '#ff2d2d'
  when 'blue' then '#1f7cff'
  when 'yellow' then '#ffe600'
  when 'green' then '#39ff14'
  when 'orange' then '#ff8a00'
  when 'purple' then '#bf4dff'
  when 'black' then '#070707'
  when 'white' then '#ffffff'
  when 'brown' then '#d9782d'
  when 'gold' then '#ffd84d'
  when 'none' then 'none'
  else case
    when border_color ~ '^#[0-9a-fA-F]{6}$' then lower(border_color)
    else '#ffd84d'
  end
end;

alter table public.regions
  add constraint regions_border_color_check
  check (border_color = 'none' or border_color ~ '^#[0-9a-fA-F]{6}$');

update public.regions
set border_color = 'none'
where ref_code = 'REG-0000';

update public.regions
set name = 'Wilderness'
where ref_code = 'REG-0000'
  and region_type = 'geographic';

drop function if exists public.update_region_record(
  uuid,
  uuid,
  text
);

drop function if exists public.update_region_record(
  uuid,
  uuid,
  text,
  text
);

drop function if exists public.update_region_record(
  uuid,
  uuid,
  text,
  text,
  text
);

create or replace function public.create_region_with_next_ref_code(
  target_campaign_id uuid,
  region_name text,
  region_type_input text default 'geographic',
  region_border_color text default '#ffd84d',
  region_lore text default null
)
returns public.regions
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_region_type text := coalesce(nullif(lower(trim(region_type_input)), ''), 'geographic');
  normalized_border_color text := coalesce(nullif(lower(trim(region_border_color)), ''), '#ffd84d');
  next_number integer;
  next_ref_code text;
  created_record public.regions;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if nullif(trim(region_name), '') is null then
    raise exception 'Region name is required.';
  end if;

  if normalized_region_type not in ('geographic', 'political') then
    raise exception 'Invalid region type.';
  end if;

  if normalized_border_color <> 'none' and normalized_border_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Invalid border color.';
  end if;

  select coalesce(max(substring(ref_code from '^REG-([0-9]+)$')::integer), 0) + 1
    into next_number
  from public.regions
  where campaign_id = target_campaign_id
    and ref_code ~ '^REG-[0-9]+$';

  next_ref_code := 'REG-' || lpad(next_number::text, 4, '0');

  insert into public.regions (
    campaign_id,
    ref_code,
    name,
    lore,
    visibility,
    region_type,
    border_color,
    created_by
  )
  values (
    target_campaign_id,
    next_ref_code,
    trim(region_name),
    nullif(trim(region_lore), ''),
    'shared',
    normalized_region_type,
    case when normalized_region_type = 'geographic' and next_ref_code = 'REG-0000' then 'none' else normalized_border_color end,
    auth.uid()
  )
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.update_region_record(
  target_campaign_id uuid,
  target_region_id uuid,
  region_lore text default null,
  region_border_color text default null,
  new_region_type text default null
)
returns public.regions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_record public.regions;
  normalized_border_color text;
  normalized_region_type text;
  previous_region_type text;
  default_geographic_region_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  normalized_border_color := coalesce(nullif(lower(trim(region_border_color)), ''), '#ffd84d');
  normalized_region_type := coalesce(nullif(lower(trim(new_region_type)), ''), 'geographic');

  if normalized_border_color <> 'none' and normalized_border_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Invalid border color.';
  end if;

  if normalized_region_type not in ('geographic', 'political') then
    raise exception 'Invalid region type.';
  end if;

  select region_type into previous_region_type
  from public.regions
  where campaign_id = target_campaign_id
    and id = target_region_id
  limit 1;

  if previous_region_type is null then
    raise exception 'Region not found.';
  end if;

  update public.regions
  set lore = nullif(trim(region_lore), ''),
      region_type = case
        when ref_code = 'REG-0000' then 'geographic'
        else normalized_region_type
      end,
      border_color = case
        when ref_code = 'REG-0000' then 'none'
        else normalized_border_color
      end,
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_region_id
  returning * into updated_record;

  if updated_record.id is null then
    raise exception 'Region not found.';
  end if;

  if updated_record.ref_code <> 'REG-0000' and previous_region_type <> updated_record.region_type then
    if previous_region_type = 'geographic' and updated_record.region_type = 'political' then
      select id into default_geographic_region_id
      from public.regions
      where campaign_id = target_campaign_id
        and ref_code = 'REG-0000'
        and region_type = 'geographic'
      limit 1;

      if default_geographic_region_id is null then
        raise exception 'Default geographic region REG-0000 not found.';
      end if;

      update public.hexes
      set political_region_id = updated_record.id,
          geographic_region_id = default_geographic_region_id,
          region_id = default_geographic_region_id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and (geographic_region_id = updated_record.id or region_id = updated_record.id);
    elsif previous_region_type = 'political' and updated_record.region_type = 'geographic' then
      update public.hexes
      set geographic_region_id = updated_record.id,
          region_id = updated_record.id,
          political_region_id = null,
          updated_at = now()
      where campaign_id = target_campaign_id
        and political_region_id = updated_record.id;
    end if;
  end if;

  return updated_record;
end;
$$;

grant execute on function public.update_region_record(
  uuid,
  uuid,
  text,
  text,
  text
) to authenticated;

grant execute on function public.create_region_with_next_ref_code(
  uuid,
  text,
  text,
  text,
  text
) to authenticated;
