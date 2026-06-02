-- =========================================================
-- Waymark Codex
-- Delete specific campaigns by exact id
-- =========================================================
--
-- Use this only when you want to completely remove whole campaigns.
-- This is meant for manual Supabase SQL Editor use.
--
-- Step 1:
-- Run the preview select below first.
-- Confirm the returned rows are the exact campaigns you want gone.
--
-- Step 2:
-- Copy the ids you want to delete into the delete statement below.
--
-- Notes:
-- - "Test" is intentionally previewed by name only; verify the id carefully.
-- - Deleting from public.campaigns is intended to remove the campaign record
--   and any dependent rows that cascade from it.
-- - Do not use this for broad cleanup by partial name.

select
  id,
  name,
  map_mode,
  created_at,
  updated_at
from public.campaigns
where name in ('Kadesh Legacy', 'Test')
order by created_at;

-- After confirming the ids above, replace the sample UUIDs below and run:
--
-- delete from public.campaigns
-- where id in (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222'
-- );
