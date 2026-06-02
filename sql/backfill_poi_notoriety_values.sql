-- =========================================================
-- Waymark Codex
-- Backfill canonical POI notoriety values
-- =========================================================
--
-- Targeted migration helper for moving free-text notoriety values
-- onto the controlled 1-10 list used by the app.
--
-- Recommended order:
-- 1. Run create_poi_with_next_ref_code.sql
-- 2. Run edit_poi_management.sql
-- 3. Run this file

create or replace function public.normalize_poi_notoriety_tier(raw_value text)
returns text
language sql
immutable
as $$
  with extracted as (
    select substring(coalesce(raw_value, '') from '([0-9]+)') as value_text
  )
  select case
    when value_text ~ '^(10|[1-9])$' then value_text
    else null
  end
  from extracted
$$;

-- Normalize any already-convertible notoriety values across every campaign.
update public.pois
set notoriety_tier = public.normalize_poi_notoriety_tier(notoriety_tier)
where notoriety_tier is not null
  and public.normalize_poi_notoriety_tier(notoriety_tier) is not null
  and notoriety_tier is distinct from public.normalize_poi_notoriety_tier(notoriety_tier);

-- Audit any remaining legacy or missing notoriety values across all campaigns.
select
  campaign_id,
  notoriety_tier,
  count(*) as record_count
from public.pois
where notoriety_tier is null
   or notoriety_tier is distinct from public.normalize_poi_notoriety_tier(notoriety_tier)
group by campaign_id, notoriety_tier
order by campaign_id, notoriety_tier;
