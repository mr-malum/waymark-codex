-- =========================================================
-- Waymark Codex
-- Legacy Kadesh hex reference remap
-- =========================================================
--
-- Run this after importing Kadesh_canonical.json into the copied campaign.
-- It moves records attached to old row:column Kadesh hexes (300:300 style)
-- onto generated canonical X:Y hexes (0:0 style).

create or replace function public.remap_legacy_kadesh_hex_refs(
  target_campaign_id uuid,
  legacy_origin_x integer default 300,
  legacy_origin_y integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_hex public.hexes;
  generated_hex_id uuid;
  old_x integer;
  old_y integer;
  new_ref text;
  poi_count integer := 0;
  map_count integer := 0;
  journal_count integer := 0;
  legacy_hex_count integer := 0;
  matched_hex_count integer := 0;
  changed_count integer := 0;
begin
  if auth.uid() is not null and not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only campaign owners can remap Kadesh hex references';
  end if;

  for legacy_hex in
    select *
    from public.hexes
    where campaign_id = target_campaign_id
      and base_terrain is null
      and ref_code ~ '^[0-9]+:[0-9]+$'
    order by ref_code
  loop
    old_x := split_part(legacy_hex.ref_code, ':', 1)::integer;
    old_y := split_part(legacy_hex.ref_code, ':', 2)::integer;

    -- Hex Mapper's legacy import treats old Hex_ID as row:column (Y:X),
    -- then subtracts the minimum legacy coordinate to produce canonical X:Y.
    new_ref := (old_y - legacy_origin_y)::text || ':' || (old_x - legacy_origin_x)::text;

    select id
      into generated_hex_id
    from public.hexes
    where campaign_id = target_campaign_id
      and ref_code = new_ref
      and base_terrain is not null
    limit 1;

    legacy_hex_count := legacy_hex_count + 1;

    if generated_hex_id is null then
      continue;
    end if;

    matched_hex_count := matched_hex_count + 1;

    update public.pois
    set hex_id = generated_hex_id,
        updated_at = now()
    where campaign_id = target_campaign_id
      and hex_id = legacy_hex.id;

    get diagnostics changed_count = row_count;
    poi_count := poi_count + changed_count;

    update public.maps
    set hex_owner_id = generated_hex_id,
        updated_at = now()
    where campaign_id = target_campaign_id
      and hex_owner_id = legacy_hex.id;

    get diagnostics changed_count = row_count;
    map_count := map_count + changed_count;

    update public.dm_journal
    set source_id = generated_hex_id
    where campaign_id = target_campaign_id
      and source_type = 'hex'
      and source_id = legacy_hex.id;

    get diagnostics changed_count = row_count;
    journal_count := journal_count + changed_count;
  end loop;

  return jsonb_build_object(
    'legacyHexesChecked', legacy_hex_count,
    'legacyHexesMatched', matched_hex_count,
    'poisRemapped', poi_count,
    'hexMapsRemapped', map_count,
    'hexJournalEntriesRemapped', journal_count
  );
end;
$$;

grant execute on function public.remap_legacy_kadesh_hex_refs(uuid, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
