-- =========================================================
-- Waymark Codex
-- Remove old 300:300-style legacy hex rows from generated campaigns
-- =========================================================
--
-- Use this after a generated campaign has both:
-- - normalized generated hexes (00:00 through current grid bounds)
-- - leftover legacy row:column hexes (300:300 style)
--
-- This script:
-- 1. previews legacy-vs-generated hex counts
-- 2. remaps POIs / hex-owned maps / hex DM journal entries off legacy hex ids
-- 3. previews any remaining record references to legacy hexes
-- 4. deletes only the legacy-format hex rows for the target campaigns
--
-- Target campaigns in this saved version:
-- - 5d5ec4a1-5fd1-48d5-a027-0544ead71aba
-- - 83de6e77-e967-4df2-aa57-b9e9024d84e1

-- ---------------------------------------------------------
-- Preview current state before remap/delete
-- ---------------------------------------------------------
with target_campaigns as (
  select unnest(array[
    '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid,
    '83de6e77-e967-4df2-aa57-b9e9024d84e1'::uuid
  ]) as campaign_id
)
select
  c.id,
  c.name,
  count(*) filter (
    where h.ref_code ~ '^[0-9]{3,}:[0-9]{3,}$'
      and split_part(h.ref_code, ':', 1)::integer >= 300
      and split_part(h.ref_code, ':', 2)::integer >= 300
  ) as legacy_hexes_300_style,
  count(*) filter (
    where h.ref_code ~ '^[0-9]{2}:[0-9]{2}$'
  ) as normalized_hexes_00_style,
  count(*) as total_hexes
from target_campaigns tc
join public.campaigns c on c.id = tc.campaign_id
left join public.hexes h on h.campaign_id = c.id
group by c.id, c.name
order by c.name;

-- ---------------------------------------------------------
-- Remap dependent records off legacy hex ids
-- ---------------------------------------------------------
select
  c.id,
  c.name,
  public.remap_legacy_kadesh_hex_refs(c.id) as remap_summary
from public.campaigns c
where c.id in (
  '5d5ec4a1-5fd1-48d5-a027-0544ead71aba',
  '83de6e77-e967-4df2-aa57-b9e9024d84e1'
)
order by c.name;

-- ---------------------------------------------------------
-- Preview any remaining references to legacy hex ids
-- ---------------------------------------------------------
with legacy_hexes as (
  select
    h.id,
    h.campaign_id,
    h.ref_code
  from public.hexes h
  where h.campaign_id in (
    '5d5ec4a1-5fd1-48d5-a027-0544ead71aba',
    '83de6e77-e967-4df2-aa57-b9e9024d84e1'
  )
    and h.ref_code ~ '^[0-9]{3,}:[0-9]{3,}$'
    and split_part(h.ref_code, ':', 1)::integer >= 300
    and split_part(h.ref_code, ':', 2)::integer >= 300
)
select 'pois' as record_type, lh.campaign_id, lh.ref_code, count(*) as linked_rows
from legacy_hexes lh
join public.pois p on p.hex_id = lh.id
group by lh.campaign_id, lh.ref_code

union all

select 'maps' as record_type, lh.campaign_id, lh.ref_code, count(*) as linked_rows
from legacy_hexes lh
join public.maps m on m.hex_owner_id = lh.id
group by lh.campaign_id, lh.ref_code

union all

select 'dm_journal' as record_type, lh.campaign_id, lh.ref_code, count(*) as linked_rows
from legacy_hexes lh
join public.dm_journal j
  on j.source_type = 'hex'
 and j.source_id = lh.id
group by lh.campaign_id, lh.ref_code

order by campaign_id, record_type, ref_code;

-- ---------------------------------------------------------
-- Delete leftover legacy hex rows
-- ---------------------------------------------------------
-- Run this delete block after confirming the preview above is empty
-- or only shows references you intentionally accept deleting.
--
-- delete from public.hexes
-- where campaign_id in (
--   '5d5ec4a1-5fd1-48d5-a027-0544ead71aba',
--   '83de6e77-e967-4df2-aa57-b9e9024d84e1'
-- )
--   and ref_code ~ '^[0-9]{3,}:[0-9]{3,}$'
--   and split_part(ref_code, ':', 1)::integer >= 300
--   and split_part(ref_code, ':', 2)::integer >= 300;

-- ---------------------------------------------------------
-- Final verification
-- ---------------------------------------------------------
with target_campaigns as (
  select unnest(array[
    '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid,
    '83de6e77-e967-4df2-aa57-b9e9024d84e1'::uuid
  ]) as campaign_id
)
select
  c.id,
  c.name,
  count(*) filter (
    where h.ref_code ~ '^[0-9]{3,}:[0-9]{3,}$'
      and split_part(h.ref_code, ':', 1)::integer >= 300
      and split_part(h.ref_code, ':', 2)::integer >= 300
  ) as legacy_hexes_300_style_remaining,
  count(*) filter (
    where h.ref_code ~ '^[0-9]{2}:[0-9]{2}$'
  ) as normalized_hexes_00_style,
  count(*) as total_hexes
from target_campaigns tc
join public.campaigns c on c.id = tc.campaign_id
left join public.hexes h on h.campaign_id = c.id
group by c.id, c.name
order by c.name;
