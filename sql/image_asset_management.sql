-- =========================================================
-- Waymark Codex
-- Record image upload / attachment management
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing image uploads.
-- This expects the private storage bucket to be named: campaign-assets
-- New uploads should use paths beginning with the campaign UUID:
--   {campaign_id}/records/{record_type}/{record_ref}/image
--   {campaign_id}/maps/{map_ref}/file

create or replace function public.can_edit_storage_object(storage_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  path_campaign_id uuid;
begin
  begin
    path_campaign_id := split_part(storage_object_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  return public.can_edit_campaign(path_campaign_id);
end;
$$;

grant execute on function public.can_edit_storage_object(text)
  to authenticated;

drop policy if exists "campaign_assets_select_editor" on storage.objects;
create policy "campaign_assets_select_editor"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'campaign-assets'
  and public.can_edit_storage_object(name)
);

drop policy if exists "campaign_assets_insert_editor" on storage.objects;
create policy "campaign_assets_insert_editor"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'campaign-assets'
  and public.can_edit_storage_object(name)
);

drop policy if exists "campaign_assets_update_editor" on storage.objects;
create policy "campaign_assets_update_editor"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'campaign-assets'
  and public.can_edit_storage_object(name)
)
with check (
  bucket_id = 'campaign-assets'
  and public.can_edit_storage_object(name)
);

drop function if exists public.attach_record_image_asset(
  uuid,
  text,
  uuid,
  text,
  text,
  text
);

create or replace function public.attach_record_image_asset(
  target_campaign_id uuid,
  target_record_type text,
  target_record_id uuid,
  asset_bucket text,
  asset_path text,
  asset_mime_type text
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
    raise exception 'unsupported image type';
  end if;

  case target_record_type
    when 'region' then
      select r.image_asset_id
        into existing_asset_id
      from public.regions r
      where r.campaign_id = target_campaign_id
        and r.id = target_record_id;

      if not exists (
        select 1 from public.regions
        where campaign_id = target_campaign_id
          and id = target_record_id
      ) then raise exception 'region not found'; end if;

    when 'poi' then
      select p.image_asset_id
        into existing_asset_id
      from public.pois p
      where p.campaign_id = target_campaign_id
        and p.id = target_record_id;

      if not exists (
        select 1 from public.pois
        where campaign_id = target_campaign_id
          and id = target_record_id
      ) then raise exception 'poi not found'; end if;

    when 'poi_group' then
      select pg.image_asset_id
        into existing_asset_id
      from public.poi_groups pg
      where pg.campaign_id = target_campaign_id
        and pg.id = target_record_id;

      if not exists (
        select 1 from public.poi_groups
        where campaign_id = target_campaign_id
          and id = target_record_id
      ) then raise exception 'grouped poi not found'; end if;

    when 'npc' then
      select n.image_asset_id
        into existing_asset_id
      from public.npcs n
      where n.campaign_id = target_campaign_id
        and n.id = target_record_id;

      if not exists (
        select 1 from public.npcs
        where campaign_id = target_campaign_id
          and id = target_record_id
      ) then raise exception 'npc not found'; end if;

    when 'map' then
      select m.image_asset_id
        into existing_asset_id
      from public.maps m
      where m.campaign_id = target_campaign_id
        and m.id = target_record_id;

      if not exists (
        select 1 from public.maps
        where campaign_id = target_campaign_id
          and id = target_record_id
      ) then raise exception 'map not found'; end if;

    else
      raise exception 'unsupported record type';
  end case;

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

  case target_record_type
    when 'region' then
      update public.regions
      set image_asset_id = created_asset.id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'poi' then
      update public.pois
      set image_asset_id = created_asset.id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'poi_group' then
      update public.poi_groups
      set image_asset_id = created_asset.id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'npc' then
      update public.npcs
      set image_asset_id = created_asset.id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and id = target_record_id;

    when 'map' then
      update public.maps
      set image_asset_id = created_asset.id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and id = target_record_id;
  end case;

  return created_asset;
end;
$$;

grant execute on function public.attach_record_image_asset(
  uuid,
  text,
  uuid,
  text,
  text,
  text
) to authenticated;
