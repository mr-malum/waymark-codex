-- =========================================================
-- Waymark Codex
-- Owner-only generated campaign copy helper for testing
-- =========================================================
--
-- Run this in Supabase SQL Editor after:
-- - sql/copy_campaign_for_testing.sql
-- - sql/generated_map_overlay_management.sql
--
-- This keeps the copied campaign in generated mode, preserves the source
-- generated_map_config, and copies generated map overlays by remapping the
-- source hex UUIDs onto the copied campaign's hex UUIDs.
--
-- Example:
-- select public.copy_generated_campaign_for_testing(
--   '83de6e77-e967-4df2-aa57-b9e9024d84e1',
--   'Kadesh Hex Polish Test'
-- );

create or replace function public.copy_generated_campaign_for_testing(
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
  source_overlay public.generated_map_overlays;
begin
  select *
    into source_campaign
  from public.campaigns
  where id = source_campaign_id;

  if source_campaign.id is null then
    raise exception 'source campaign not found';
  end if;

  if coalesce(source_campaign.map_mode, 'static') <> 'generated' then
    raise exception 'source campaign is not a generated campaign';
  end if;

  new_campaign_id := public.copy_campaign_for_testing(
    source_campaign_id,
    copied_campaign_name
  );

  update public.campaigns
  set map_mode = 'generated',
      generated_map_config = coalesce(source_campaign.generated_map_config, '{}'::jsonb),
      updated_at = now()
  where id = new_campaign_id;

  for source_overlay in
    select *
    from public.generated_map_overlays
    where campaign_id = source_campaign_id
    order by created_at, id
  loop
    insert into public.generated_map_overlays (
      campaign_id,
      overlay_type,
      from_hex_id,
      to_hex_id,
      hex_id,
      edge,
      style,
      is_major_route,
      route_name,
      created_by
    )
    values (
      new_campaign_id,
      source_overlay.overlay_type,
      (
        select copied_hex.id
        from public.hexes source_hex
        join public.hexes copied_hex
          on copied_hex.campaign_id = new_campaign_id
         and copied_hex.ref_code = source_hex.ref_code
        where source_hex.id = source_overlay.from_hex_id
      ),
      (
        select copied_hex.id
        from public.hexes source_hex
        join public.hexes copied_hex
          on copied_hex.campaign_id = new_campaign_id
         and copied_hex.ref_code = source_hex.ref_code
        where source_hex.id = source_overlay.to_hex_id
      ),
      (
        select copied_hex.id
        from public.hexes source_hex
        join public.hexes copied_hex
          on copied_hex.campaign_id = new_campaign_id
         and copied_hex.ref_code = source_hex.ref_code
        where source_hex.id = source_overlay.hex_id
      ),
      source_overlay.edge,
      source_overlay.style,
      source_overlay.is_major_route,
      source_overlay.route_name,
      source_overlay.created_by
    );
  end loop;

  return new_campaign_id;
end;
$$;

grant execute on function public.copy_generated_campaign_for_testing(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
