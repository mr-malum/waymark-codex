-- =========================================================
-- Waymark Codex
-- Campaign main map asset support
-- =========================================================
--
-- Run this in Supabase SQL Editor before linking campaign main maps.
-- Main map uploads should use paths like:
--   {campaign_id}/campaign/main-map/image

alter table public.campaigns
  add column if not exists main_map_asset_id uuid references public.assets(id) on delete set null,
  add column if not exists main_map_width integer not null default 6417,
  add column if not exists main_map_height integer not null default 7575;

create or replace function public.attach_campaign_main_map_asset(
  target_campaign_id uuid,
  asset_bucket text,
  asset_path text,
  asset_mime_type text,
  map_width integer default 6417,
  map_height integer default 7575
)
returns public.assets
language plpgsql
security definer
set search_path = public
as $$
declare
  created_asset public.assets;
  existing_asset_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if asset_bucket <> 'campaign-assets' then
    raise exception 'unsupported asset bucket';
  end if;

  if asset_path is null or asset_path = '' then
    raise exception 'asset path is required';
  end if;

  if split_part(asset_path, '/', 1) <> target_campaign_id::text then
    raise exception 'asset path must begin with the campaign id';
  end if;

  if asset_mime_type not in ('image/png', 'image/jpeg', 'image/webp') then
    raise exception 'campaign map must be PNG, JPG, or WebP';
  end if;

  select c.main_map_asset_id
    into existing_asset_id
  from public.campaigns c
  where c.id = target_campaign_id;

  if existing_asset_id is not null then
    update public.assets
    set storage_bucket = asset_bucket,
        storage_path = asset_path,
        mime_type = asset_mime_type
    where campaign_id = target_campaign_id
      and id = existing_asset_id
    returning * into created_asset;
  else
    insert into public.assets (
      campaign_id,
      storage_bucket,
      storage_path,
      mime_type
    )
    values (
      target_campaign_id,
      asset_bucket,
      asset_path,
      asset_mime_type
    )
    returning * into created_asset;
  end if;

  update public.campaigns
  set main_map_asset_id = created_asset.id,
      main_map_width = coalesce(nullif(map_width, 0), 6417),
      main_map_height = coalesce(nullif(map_height, 0), 7575),
      updated_at = now()
  where id = target_campaign_id;

  return created_asset;
end;
$$;

grant execute on function public.attach_campaign_main_map_asset(
  uuid,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;
