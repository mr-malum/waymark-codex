# SQL Guide

This folder is meant to live in the repo.

The goal is to keep schema changes, RPCs, repair scripts, and admin helpers versioned alongside the app code, while making it obvious which files are safe to run repeatedly and which ones need extra care.

## Categories

### Safe / repeatable app setup and management

These are the normal "live repo" SQL files. They define or update app behavior and are generally the first place to look when frontend work depends on backend RPCs, permissions, or schema support.

- `campaign_audit_log.sql`
- `campaign_main_map.sql`
- `campaign_share_codes.sql`
- `change_campaign_name.sql`
- `change_username.sql`
- `create_poi_with_next_ref_code.sql`
- `delete_record_permissions.sql`
- `dm_journal_management.sql`
- `edit_npc_management.sql`
- `edit_poi_management.sql`
- `edit_region_management.sql`
- `generated_hex_terrain_management.sql`
- `generated_map_overlay_management.sql`
- `hex_mapper_import_bridge.sql`
- `image_asset_management.sql`
- `leave_campaign.sql`
- `map_management.sql`
- `remove_campaign_member.sql`
- `superuser_role.sql`

### Testing and copy helpers

These are useful, intentional utilities, but they are not general production setup files. Use them when explicitly needed for local/test campaign workflows.

- `copy_campaign_for_testing.sql`
- `copy_generated_campaign_for_testing.sql`
- `verify_generated_campaign_migration.sql`

### One-time repair / diagnosis / cleanup

Keep these in repo because they document real operational fixes, but treat them as targeted scripts rather than normal setup.

- `backfill_profile_emails.sql`
- `case_insensitive_member_lookup.sql`
- `diagnose_auth_signup_triggers.sql`
- `diagnose_profiles_signup_blockers.sql`
- `fix_login_email_function_ambiguity.sql`
- `fix_member_function_ambiguity.sql`
- `merge_duplicate_unclaimed_region.sql`
- `remap_legacy_kadesh_hex_refs.sql`
- `remove_mist_feature_from_generated_hexes.sql`
- `repair_auth_profile_signup.sql`

### Destructive / bulk-reset utilities

These belong in repo too, but they should be treated like power tools. Do not run them casually, and call them out clearly in handoffs and reviews.

- `generated_map_nuke_management.sql`

## Generated Map SQL Order

When generated map support is the feature being worked on, the usual base order is:

1. `hex_mapper_import_bridge.sql`
2. `generated_map_overlay_management.sql`
3. `generated_hex_terrain_management.sql`

Optional follow-up files depend on the task:

- `copy_generated_campaign_for_testing.sql` for generated campaign copies
- `generated_map_nuke_management.sql` for bulk clear/reset utilities
- `remove_mist_feature_from_generated_hexes.sql` for the older mist-feature cleanup
- `verify_generated_campaign_migration.sql` for spot-checking a migrated campaign

## Practical Repo Rule

Good to keep here:

- repeatable schema/RPC files
- policies and permissions
- import/export helpers
- repair scripts with clear purpose
- testing utilities that the team intentionally uses

Do not keep here:

- secrets, passwords, or private tokens
- personal scratch SQL with unclear purpose
- throwaway dumps or machine-specific exports

## Naming Guidance

When adding new SQL files, prefer naming that makes the risk obvious:

- `*_management.sql` for repeatable app behavior / RPC support
- `copy_*` or `verify_*` for testing helpers
- `fix_*`, `repair_*`, `backfill_*`, `diagnose_*`, `remap_*` for targeted one-time work
- `nuke_*`, `clear_*`, or similarly explicit names for destructive utilities
