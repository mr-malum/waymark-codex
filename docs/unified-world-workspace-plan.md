# Unified World Workspace Reformulation Plan

Status: Planned beta reformulation. The current application remains the stable production line until the stabilization checklist below is complete.

## Purpose

Campaign Codex began as a database-first Codex with a static map, then gained a parent hex editor, subhex editing, freeform water, settlement boundaries, route anchors, walls, and other spatial tools. Those capabilities work, but their navigation, save models, object identities, and rendering layers were added at different times and do not yet behave like one coherent application.

The reformulation will turn the product into a unified world-building workspace in which the map and Codex are two views of the same campaign data. It is a phased restructuring, not a rewrite. Existing production behavior and data remain usable throughout the transition.

## Product Goals

- Make the map the persistent desktop workspace instead of repeatedly replacing it with full-screen tools.
- Keep the Codex as a first-class experience through a quiet dock and an optional immersive book view.
- Let parent-map and subhex edits describe the same world objects at different levels of detail.
- Replace editor-specific tool silos with consistent layers, selections, drafts, and actions.
- Give every meaningful object one identity, regardless of where it is viewed or edited.
- Make zoom reveal appropriate detail without unexpectedly changing edit targets.
- Preserve visual quality while reducing repeated rendering and duplicate cached representations.
- Keep the current database and migrate additively, without risking live campaign data.

## Audience And Core Workflow

The primary desktop user is a world builder who moves repeatedly between broad geography, local detail, and written campaign material.

The intended workflow is:

1. Open a campaign into a persistent world workspace.
2. Pan and zoom from campaign scale to parent hexes and subhex detail.
3. Select terrain, features, routes, settlements, walls, water, or POIs directly on the map.
4. Edit the selected object in a consistent inspector or layer panel.
5. Open related Codex material in a dock without losing map position or selection.
6. Stage related map edits in one draft session, review them, then apply them together.
7. See the saved result consistently in parent view, detail view, Codex previews, and exports.

Mobile remains supported for viewing, Codex reading, inspection, and practical lightweight edits. Dense authoring controls may remain desktop-first where necessary.

## Experience Architecture

### Persistent Workspace

- The map remains mounted and visible as the primary spatial workspace.
- Opening the Codex does not discard map position, zoom, active layer, or selection.
- The Codex can appear as a resizable dock for ordinary reference and editing.
- A full immersive Codex/book view remains available when the user wants to focus on reading or writing.
- Back, close, return, view, and edit actions use a single navigation model rather than separate page-specific conventions.
- Workspace state survives movement between parent map, subhex focus, Codex records, and editors.

### Shared Workspace State

Introduce one explicit `WorkspaceState` contract that owns:

- active campaign and permissions;
- map camera, semantic zoom tier, and focused parent hex;
- selected object and selection source;
- open Codex record and dock/full-view state;
- active layer and active tool;
- current draft session and dirty state;
- visibility filters and inspection state;
- return target for temporary focused workflows.

Page-specific renderers should consume this state rather than independently opening, closing, and clearing one another.

### Semantic Zoom

Use hybrid semantic zoom:

- Zooming naturally reveals parent terrain, subhex terrain, refined feature coverage, settlements, local POIs, and other detail at appropriate thresholds.
- Merely zooming does not silently switch the active editing target.
- Editing a parent hex or entering subhex focus is an explicit action, clearly indicated in the interface.
- Selection persists when the selected object remains meaningful at the new zoom tier.
- Dense local objects aggregate or simplify at parent scale rather than disappearing arbitrarily.

### Layers And Tools

Replace Surveyor, Cartographer, and Subhex as separate mental models with a shared layer-oriented editor. Initial layers are:

- Terrain and elevation
- Features and vegetation
- Hydrology
- Routes
- Settlements and structures
- Walls and boundaries
- Regions and labels
- POIs

Every layer declares its visibility, editable object types, available tools, save behavior, parent/detail representation, and permission requirements through a `LayerDefinition` contract.

Selection drives available actions. Tool activation is mutually exclusive unless two modes are explicitly designed to cooperate. Terrain paint, freeform water, route anchors, wall anchors, and stamps must not remain accidentally active together.

## Unified Spatial Model

### One Object, Multiple Representations

Introduce a `SpatialObject` contract for map entities that need identity across views. It should carry:

- stable ID and campaign ownership;
- object kind and style;
- world geometry and affected parent hexes;
- parent-scale representation;
- detail-scale representation;
- optional linked Codex record;
- visibility and aggregation rules;
- revision/cache signature.

This does not require converting every existing row immediately. Adapters can expose current routes, walls, settlements, water, features, and POIs through the contract while storage is migrated incrementally.

### Parent And Subhex Detail

Parent and subhex maps are levels of detail for the same world, not independent overlay systems.

- Parent terrain provides the default material for its subhexes.
- Subhex edits refine or override that inherited material only where explicitly authored.
- Routes, walls, water, and settlements may cross parent-hex boundaries while retaining one identity.
- Changes made at detail scale update the simplified parent representation after Apply.
- Parent edits invalidate and regenerate only the affected detail/cache regions.
- Shared geometry helpers determine ownership, intersection, clipping, adjacency, and affected hexes consistently.

### Feature Refinement

Forests, scrub, marsh vegetation, and similar features support three states:

1. **Inherited**: current procedural behavior derived from parent terrain/features.
2. **Refined**: a manually painted subhex coverage mask replaces or reshapes inherited placement within an edited area.
3. **Local**: a small detail-only feature that does not need to affect the parent map.

Feature painting stores semantic coverage or brush geometry, not hundreds of individual tree objects. The renderer generates the detailed art from that mask.

- Unedited subhexes continue using current generated feature behavior.
- Refined coverage can coexist with terrain and compatible feature types under existing placement rules.
- At parent zoom, sufficient painted coverage condenses to the normal SVG feature icon or equivalent simplified symbol.
- Small local groves can remain visible only at detail scale.
- Parent icon derivation is automatic by default, with a manual force-on/force-off override for edge cases.
- Freeform walls or settlement boundaries clip feature art geometrically; a tiny overlap must not suppress the entire subhex feature.

### Hydrology

Parent rivers and freeform detail water become parts of one hydrology domain.

- Parent rivers provide authored long-distance flow and crossings.
- Detail water can widen, branch, pool, form ponds, or refine a parent river locally.
- Both use shared geometry for avoidance, clipping, coloring, terrain awareness, neighboring visibility, and exports.
- Water color derives from the underlying terrain/overlay context.
- Detail water remains visible from adjacent active subhex maps and Codex previews.
- Settlement ground, buildings, and generated lanes avoid painted water.
- Settlement lanes may follow water banks as canal or waterfront streets; ordinary lanes otherwise stop cleanly at shorelines.
- Automatically generated bridges are out of scope unless a dedicated crossing object is introduced later.

### Routes, Walls, And Anchors

- Parent routes and their subhex anchors edit one route identity.
- Route termini inside a parent hex have explicit endpoint anchors.
- Junctions are topological connections, not merely overlapping handles.
- Shared-edge anchors can be moved away from an edge and slide continuously around corners.
- Walls can span parent hexes and use shared junctions without creating duplicate or orphaned nodes.
- Tower, gate, and sluice are anchor stamps attached to wall nodes and retain their dimensions while dragged.
- Settlement boundaries and walls may snap adjacent to one another while remaining distinct objects.
- Deleting connected geometry removes unused junctions but preserves junctions still referenced elsewhere.

### Settlements And POIs

A multi-hex settlement is one settlement/place object with one principal POI and one boundary, not an accidental collection of unrelated child POIs.

- The principal place POI links the generated settlement and its Codex identity.
- Optional districts, landmarks, or sites may be related child POIs when they deserve their own records.
- Individual local sites can exist at subhex scale without producing noisy numbered badges at parent scale.
- POIs receive explicit visibility tiers such as campaign, regional, parent-hex, and detail-only.
- Dense detail POIs aggregate at parent zoom using meaningful grouping rather than forced stacking.
- Moving, hiding, or editing a POI updates parent map, detail map, and Codex immediately after save.
- Buildings that need names or records are POIs; ordinary generated buildings remain settlement art.

Only record-like places belong in the Codex. Routes, walls, feature masks, and water remain spatial objects unless the user explicitly links them to a Codex entry.

## Editing And Persistence

### Unified Draft Sessions

All authoring tools use a consistent draft model:

- Changes are staged visibly in a `MapDraftOperation` collection.
- Undo and redo operate across tools within the active session.
- Apply persists the complete coherent change set.
- Discard restores the last saved state.
- Closing or navigating away with dirty work produces one consistent warning.
- Immediate writes are reserved for clearly identified administrative actions, not ordinary spatial editing.

The UI must no longer mix silent immediate writes with staged edits merely because tools originated in different editors.

### Transactional Apply

Add a permission-safe backend operation such as `apply_campaign_map_draft` when the migration reaches persistence consolidation. It should:

- validate campaign membership and role server-side;
- apply related terrain, feature, water, route, wall, settlement, and POI geometry changes atomically where practical;
- return canonical updated records and revisions;
- reject stale/conflicting revisions instead of overwriting newer work;
- identify affected parent hexes for targeted cache invalidation.

Until that operation exists, adapters may call current RLS-safe RPCs but must present one draft/apply experience and handle partial failures explicitly.

### Cache And Rendering Strategy

- Cache saved semantic data, not only rendered pixels.
- Generate settlement and feature rasters once per object revision, zoom tier, and visual scale.
- Reuse offscreen rasters across parent map, detail editor, Codex preview, and export where fidelity permits.
- Keep transient handles, hover states, and selection overlays out of heavy raster caches.
- Invalidate by object revision and affected bounds rather than rebuilding the entire campaign.
- Keep active-edit previews lightweight; perform expensive regeneration on Apply or deliberate reroll.
- Avoid duplicate hidden render trees when the Codex dock is open.
- Preserve crisp vector composition for labels, walls, routes, POIs, and exported overlays.

## Codex Integration

- Codex records and map selections cross-link through stable IDs.
- Selecting a POI, settlement, region, or hex can open its record in the dock without losing map context.
- Selecting a Codex relationship can focus or highlight the corresponding map object.
- Hex pages display the same saved detail renderer used elsewhere, including adjacent cross-border content.
- The full Codex remains suitable for long-form reading and editing.
- List/search state, breadcrumbs, map camera, and current record survive transitions between dock and immersive view.
- Correct campaign-specific labels and text; no campaign name or content may leak into another campaign's Codex.

## Interfaces And Contracts

The beta should introduce these contracts incrementally:

- `WorkspaceState`: navigation, camera, selection, Codex, layer, tool, and draft state.
- `LayerDefinition`: visibility, tools, editable kinds, permissions, and representations.
- `SpatialObject`: stable identity, geometry, ownership, representations, linked record, and revision.
- `MapDraftOperation`: typed reversible change with affected IDs/bounds and persistence payload.
- `FeatureCoverage`: inherited/refined/local semantic feature masks and parent-summary policy.
- `VisibilityProfile`: zoom/detail visibility and aggregation rules for POIs and spatial objects.
- `apply_campaign_map_draft`: eventual transactional, RLS-safe persistence boundary.

Wire shapes should be versioned. Existing `subhex_snapshot`, overlay rows, campaign-global subhex walls, and POI fields remain readable during migration.

## Database And Schema Strategy

The reformulation will continue using the existing Supabase project unless a future requirement proves isolation necessary.

Before schema design:

1. Inspect the live schema read-only through the Supabase Dashboard or a schema-only dump.
2. Capture tables, columns, foreign keys, indexes, constraints, triggers, RPCs, RLS policies, and relevant views.
3. Save a sanitized schema baseline in project documentation; never include rows, passwords, sessions, service-role keys, or other secrets.
4. Map current storage ownership for hex terrain, `subhex_snapshot`, overlays, subhex walls, POIs, settlements, and generated caches.

Database rules:

- Never use or request a service-role key for ordinary development.
- Keep writes through existing RLS/RPC-safe paths.
- Make migrations additive and backward-compatible while stable and beta share the database.
- Version new geometry/snapshot formats and retain readers for stable records until migration is complete.
- Do not destructively backfill live campaigns.
- Restrict beta writes and migration fixtures to Testing Grounds.
- Do not open, edit, migrate, or test against Kadesh.
- User-run saved Supabase SQL remains the default migration path until a safer authenticated migration workflow is deliberately established.

## Delivery Phases

### Phase 0: Preserve Stable Release

- Finish the current subhex stabilization pass.
- Add saved-state subhex PNG export.
- Correct ordinary settlement lane interaction with painted water.
- Complete regression and performance testing.
- Merge the approved result into `main`.
- Create a long-lived `release/stable` branch and an annotated `stable-YYYY-MM-DD` tag at the exact release commit.

### Phase 1: Audit And Baselines

- Capture the database schema and current persistence ownership.
- Document every app section, major tool, object type, save model, and navigation transition.
- Create a data-flow map showing how Codex, parent map, subhex editor, previews, caches, and exports inform one another.
- Record baseline interaction and rendering performance using Testing Grounds hexes 17:12 and 18:13.

### Phase 2: Workspace State And Navigation

- Introduce `WorkspaceState` behind current behavior.
- Preserve camera, selections, filters, and return targets consistently.
- Add the Codex dock while retaining immersive Codex view.
- Consolidate back/close/view/edit navigation semantics.

### Phase 3: Layer-Oriented Editor

- Add the layer registry and common selection/inspection model.
- Present current tools through shared layer panels without changing their underlying persistence initially.
- Enforce mutually exclusive tools and consistent active-state feedback.
- Consolidate editor help, permissions, undo/redo, and dirty-state UI.

### Phase 4: Unified Draft Sessions

- Adapt terrain, features, hydrology, routes, walls, settlements, and POIs to typed draft operations.
- Add a unified Apply/Discard flow.
- Introduce transactional backend apply support when schema review is complete.
- Preserve existing RPC and RLS enforcement throughout migration.

### Phase 5: Spatial Identity And Visibility

- Introduce stable cross-view identities for routes, walls, settlements, water, features, and POIs.
- Add POI visibility profiles and parent-scale aggregation.
- Model multi-hex settlements as one place with optional related records.
- Remove duplicate per-page interpretations after all consumers use the shared contracts.

### Phase 6: Hydrology And Feature Refinement

- Unify parent rivers with detail-water refinements.
- Add inherited/refined/local feature coverage painting.
- Derive parent feature symbols from refined detail coverage.
- Use geometry clipping for water, settlement, wall, and feature interactions.

### Phase 7: Rendering And Persistence Consolidation

- Consolidate revisioned semantic caches and shared renderers.
- Migrate legacy snapshots and overlay representations only after compatibility readers are proven.
- Remove obsolete adapters and duplicate caches in measured steps.
- Re-run full performance and visual baselines before beta promotion.

## Current Stable Release Handoff

Before beta work begins, complete these current-release items:

### Settlement Lanes And Painted Water

- Ordinary generated settlement lanes must not remain visible beneath painted water.
- A seeded subset of suitable lanes may follow a water bank as canal or waterfront streets.
- Other generated lanes stop cleanly at the shoreline.
- Painted water from all relevant adjacent parent hexes participates in settlement generation and cache signatures.
- Results remain consistent in the editor, parent map, Codex preview, hard refresh, and export.

### Subhex PNG Export

- Make export available from both the subhex editor and Codex hex detail page.
- Export saved state only; never include unapplied editor drafts.
- Frame the selected parent hex prominently with enough neighboring context to show cross-border water, settlements, walls, routes, and POIs.
- Reuse a shared detail renderer rather than taking a browser screenshot.
- Include terrain, features, freeform water, settlements, routes, walls and stamps, POIs, grid, and subhex labels.
- Exclude editor handles, selections, hover effects, dimmed editing masks, and controls.
- Offer Standard, 2x, 3x, and 4x output.
- Offer toggles for grid, subhex labels, and POIs.
- Reuse existing asset loading, canvas-size limits, status reporting, PNG encoding, and error handling.
- Use `<campaign>-hex-<reference>-subhex-<scale>x.png` filenames.

### Stable Release Verification

- Test only in Testing Grounds, especially hexes 17:12 and 18:13.
- Verify parent map, subhex editor, Codex preview, hard refresh, and exported PNG agree.
- Verify adjacent cross-border details appear without editing neighboring records unintentionally.
- Check 1x through 4x exports for crispness and browser memory failures.
- Recheck pan, zoom, semantic detail transitions, Apply, undo/redo, POI updates, water editing, anchors, walls, and settlement performance.
- Run renderer syntax checks and focused browser checks without starting another local server.

## Release And Branch Strategy

- `main` remains the production-safe line.
- The completed current release is preserved by `release/stable` and an immutable annotated stable tag.
- Reformulation begins on the long-lived `beta/unified-workspace` branch.
- Beta changes are delivered in narrow, reviewable phases rather than one large rewrite.
- Stable receives only deliberate fixes while beta architecture is in progress.
- Beta merges into `main` only after data compatibility, migration, performance, and workflow acceptance criteria are met.

## Acceptance Criteria For Beta Promotion

- Map and Codex can be used together without losing spatial or navigation context.
- Parent and detail views show consistent representations of the same saved objects.
- Every editing layer follows the same draft/apply/discard expectations.
- Cross-border geometry retains one identity and edits correctly from either side.
- Refined features and hydrology summarize appropriately at parent scale.
- Detail-only POIs do not clutter the parent map.
- Existing campaigns load without destructive migration.
- RLS and role permissions remain enforced server-side.
- Testing Grounds performance is at least as good as the preserved stable release at equivalent visual quality.
- Kadesh remains untouched throughout development and validation.

## Explicit Non-Goals

- No full rewrite or new frontend framework solely for the reformulation.
- No second database by default.
- No destructive conversion of all existing records in one migration.
- No conversion of every spatial object into a Codex record.
- No automatic bridge generation in the first hydrology pass.
- No requirement that all detail-only features appear at parent scale.
- No removal of the immersive Codex/book experience.

