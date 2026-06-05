-- =========================================================
-- Waymark Codex
-- Testing Grounds audit-log cleanup
-- =========================================================
--
-- Purpose:
-- Remove existing campaign audit-log rows for the Testing Grounds campaign.
--
-- Campaign:
-- 5d5ec4a1-5fd1-48d5-a027-0544ead71aba
--
-- Run this in Supabase SQL Editor when you want to clear the current
-- Testing Grounds audit-log backlog.

select count(*) as audit_rows_before_cleanup
from public.campaign_audit_log
where campaign_id = '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid;

delete from public.campaign_audit_log
where campaign_id = '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid;

select count(*) as audit_rows_after_cleanup
from public.campaign_audit_log
where campaign_id = '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid;
