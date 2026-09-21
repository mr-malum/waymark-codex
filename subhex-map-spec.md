# Subhex Detail Spec

## Goal

Add a 1-mile subhex detail layer beneath the existing 6-mile generated map hexes.

Later UI note: add a short first-open blurb near the editor entry point, along the lines of "select an edit mode or click a hex for subhex editor."

Later map UI note: add a visible key/scale on the overworld map and map editor. The scale should indicate that parent hexes are 6 miles, then switch to 1-mile hexes when zoomed into subhex view or when using the subhex editor.

The subhex layer should do two different jobs:

1. regular map mode:
   - provide seamless close zoom detail
   - stay visually tied to the parent map
2. editor mode:
   - provide a deliberate staged editing workspace for one parent hex at a time

This document is the concrete v1 direction for subhex detail and subhex editor behavior.

## Core Principles

- Parent map hexes remain the primary world-scale records.
- Subhex detail remains subordinate to its parent hex.
- Subhex editing is staged, like Cartographer, not live-write like Surveyor.
- Untouched subhex detail can stay procedural.
- Once a parent hex has explicit subhex terrain/feature edits, those owned cells become stable saved detail for that parent.
- POIs and routes remain their own records. Their local subhex placement should not require creating one database row per subhex.
- No full `32 rows per parent hex` table is planned for v1.

## World Scale

- Parent hex: roughly 6 miles
- Subhex: roughly 1 mile
- Parent close zoom remains `1.25`
- Normal map mode may zoom to `2`
- Parent editor remains capped at `1.25`
- Subhex editing is a separate editor state, not just "zoom in farther"

## State Model

Each parent hex can be in one of three effective detail states.

### Generated

- No saved subhex terrain/feature detail for that parent
- Owned subhexes are procedurally generated from:
  - parent terrain/features/elevation
  - neighboring parent terrain/features/elevation
  - stable seeded generation
- This is the current read-only behavior

### Anchored

- Terrain/features are still procedurally generated
- POIs and/or route adjustments may have saved local detail placement
- This allows "move this POI within the parent hex" without materializing subhex terrain/features

### Materialized

- Owned subhex terrain/features are explicitly saved for that parent
- Those owned cells stop being regenerated from neighbors on every render
- Context/cutoff visual context may still be generated from neighboring parents
- Parent terrain/features become a summary of the materialized owned subhexes

## Coordinate Model

Use one continuous subhex world grid internally, not isolated per-parent mini-grids.

Each subhex should have:

- global render/pathing coordinates for the renderer
- a parent-ownership relationship
- a local parent-relative coordinate key for persistence, such as `"q:r"`

The parent boundary is an editing boundary. It is not the same thing as the global subhex layout.

## Ownership And Context

Subhex storage ownership is determined by subhex center point when that point lies inside a parent hex. If its center lies outside every parent but the cell overlaps the map, one of the parents with the greatest polygon overlap is chosen consistently as the storage owner. A cell with no overlap with any parent is outside the map and has no owner. Storage ownership does not limit which parent editor can modify a cell.

- stored subhex:
  - has one stable parent record, chosen by center or overlap as above
- editable subhex:
  - any portion of the cell overlaps the selected parent hex
- context subhex:
  - visible in the seamless world model but does not overlap the selected parent

### Editor Rule

V1 subhex editor should display and allow painting every cell that overlaps the selected parent, including a cell split evenly across a boundary. Both parent editors must refer to the same cell key and saved state.

## Database Direction

V1 should use a hybrid persistence model.

### On `public.hexes`

Add a nullable `jsonb` field:

```sql
alter table public.hexes
add column subhex_snapshot jsonb;
```

This stores parent-owned subhex terrain/feature detail when needed.

Recommended behavior:

- `null` means the parent is still fully procedural
- a non-null snapshot means the parent has explicit subhex detail state

### On POIs

POIs should remain POI records tied to their parent hex.

Later add an optional local subhex anchor field, likely `jsonb`, on the POI record rather than burying POI ownership inside the parent hex snapshot.

Example concept:

```json
{
  "mode": "subhex",
  "q": 2,
  "r": -1
}
```

### On Routes / Overlays

Routes should remain overlay records tied to parent-level overlays.

Later add optional route adjustment data on the overlay record rather than inventing subhex rows.

Edge continuity should be represented by locked boundary portals, not by hidden partial subhexes.

## `subhex_snapshot` Shape

V1 should prefer a sparse and versioned structure.

Example shape:

```json
{
  "version": 1,
  "mode": "materialized",
  "generator_version": 1,
  "cells": {
    "2:-1": {
      "base": "snow",
      "features": ["woods"],
      "elevation": 2
    },
    "1:0": {
      "base": "snow",
      "features": [],
      "elevation": 1
    }
  }
}
```

Notes:

- For a fully materialized parent, `cells` should store all owned editable cells for that parent, not just the last brush stroke.
- For a purely anchored parent, `subhex_snapshot` may stay `null` if terrain/features are still procedural.
- `generator_version` should exist from day one so future generation changes can be handled sanely.

## Procedural Consistency

Untouched subhexes are currently consistent because their detail is generated deterministically from:

- parent state
- neighboring parent state
- local subhex coordinates
- stable seeded hashes

That is sufficient for read-only or untouched detail.

Once terrain/features are edited, the parent must stop relying on live procedural detail for its owned cells. Otherwise future neighbor edits or generator changes would silently move the user's saved detail.

## POI Anchors

POIs remain tied to the parent hex as their world record.

Subhex editor may later move a POI locally within the parent hex.

Recommended rule:

- parent hex ownership of the POI does not change
- subhex anchor changes only the POI's local placement inside that parent

### Effective Anchor Rule

Every POI should always resolve to an effective subhex anchor, even when its parent hex is still fully generated.

Resolution order:

1. saved manual POI subhex anchor
2. otherwise a generated default POI anchor

### Generated Default Anchor

Generated default anchors should be center-biased and deterministic.

Recommended behavior:

- if a parent hex has one POI, place it on the central owned subhex
- if a parent hex has multiple POIs, spread them deterministically across nearby owned subhexes around the center
- generated anchor placement should be based on stable inputs such as parent hex id, POI id, and owned-cell layout
- generated anchor placement should not depend on procedural terrain/features, so parent repaint or generator tweaks do not randomly move unedited POIs

## POI Rendering Across Modes

POI rendering at parent-map zoom levels and POI rendering in subhex detail should be treated as separate presentation paths.

## Route, Wall, And POI Local Anchors

Subhex editor anchor mode should be grouped by overlay kind in the left pane:

- Roads
- Paths
- Rivers
- Walls

Each route kind should have:

- an edit control for existing local anchor adjustments
- an add-anchor control that inserts a new interior point onto the existing route span

Added route anchors should not be manually dropped from empty space. They should appear on the existing route and redistribute evenly along that route span. For example:

- one interior anchor bisects the route span
- two interior anchors trisect the route span
- three interior anchors quarter the route span

Route entry and exit points are locked portals. Local anchors can reshape the route between those portals, but should not move the portal itself.

Local route and POI anchors should remain inside the parent hex boundary. Dragging past the boundary should clamp the handle to the nearest point on the parent outline.

The route should also preserve a short locked tangent after each portal. Curves should begin after that straight-in/straight-out length, so routes do not hook immediately at the parent hex boundary.

Edited route spans should smooth through local anchors rather than making hard angled turns. A route anchor represents a point the route passes through; the renderer can use curve handles internally, but the user-facing handle should stay on the visible route.

For visual continuity, the editor should eventually show a small outside-the-parent continuation length for roads, paths, rivers, and walls. That makes it easier to align a route in one hex with the same route in the neighboring hex.

Walls are saved as `Hex_ID_Ref + Edge`, but rendered by the actual shared edge segment. In practice, this means walls behave like gridline features. Subhex wall editing should treat a wall segment as shared edge detail, visible from either adjacent parent where applicable, rather than as detail owned only by the hex that authored the overlay record.

POI anchors use the same local-anchor concept, but they move the POI presentation point within the parent hex. Moving a POI anchor should not change the POI's parent hex ownership.

### Parent View

At normal parent-map zoom stops, keep the existing parent-view POI layer behavior unchanged.

This protects the far-zoom and regular-view POI stability work that was already completed.

### Subhex View

At settled subhex zoom and in subhex editor:

- POIs should render at their effective subhex anchor
- parent-view POI rendering for that parent should be replaced by subhex-positioned POI rendering rather than drawing both at once
- this should be handled by a dedicated subhex POI projection/presentation path, not by weakening the existing parent-view POI layer

### Safety Rule

Subhex POI presentation should not be allowed to regress the stable POI behavior in:

- `0.16`
- `0.25`
- ordinary parent-map panning
- ordinary settled parent-map zoom stops

## Route Portals And Internal Route Editing

Partial/cutoff subhexes should not be required in the editor just to support route entry/exit.

Instead, parent-level route continuity should use locked edge portals.

A route endpoint in subhex editor should be represented as:

```json
{
  "edge": "NE",
  "t": 0.42
}
```

Where:

- `edge` is the parent hex edge
- `t` is the normalized position along that edge

This means:

- boundary entry/exit stays locked
- internal bends can later be adjusted
- route continuity does not depend on showing or editing partial boundary cells

## Parent Paint Interaction

Main parent-hex terrain/feature painting must remain allowed, even after a parent is materialized.

### Rule

Painting a materialized parent in the main editor should reseed that parent's owned subhex terrain/features from the newly painted parent baseline.
In the current editor, reseeding clears saved cell terrain/features, keeps saved anchors, and returns those cells to deterministic generation. The staged parent paint's Discard and Undo restore the prior saved cells; Apply persists the reseed.

It should not:

- repath routes
- move POI anchors
- alter boundary portal positions

This keeps parent editing powerful without making the subhex editor a one-way trap.

## Parent Summary Recompute

When a materialized parent's subhex terrain/features are applied, the parent hex row should be recomputed from the saved owned subhexes.

That means changes at subhex scale can roll back upward.

Example:

- if most owned subhexes become `snow`
- the parent hex should become `snow`

This upward summary should happen on `Apply`, not on every individual brush stroke.
The parent base terrain is the most common center-owned cell terrain (ties prefer the current parent terrain). Its features are the two most common compatible features on cells of that terrain, and elevation is the rounded average across center-owned cells.

## Subhex Editor Entry

V1 editor entry should support either or both:

- a top-level `Sub-Hex` mode alongside Surveyor and Cartographer
- an inspect-tooltip `Edit` action while already inside the editor

### Tooltip Rule

In editor mode, the inspect popup should show `Edit` in place of the normal `Details` action.

## Subhex Editor Layout

Opening subhex editor should:

- dim the main editor/map under a fairly opaque veil
- place the subhex editing surface above that veil
- show only the active parent hex's editable owned subhexes in the subhex workspace

The editor shell should reuse the main editor's interaction patterns where possible.

### Left Pane

Keep the lower left-pane control section:

- `No Tool`
- `Undo`
- `Redo`

Subhex editing should feel like a familiar editor mode, not a totally separate app.

### Bottom Panel

Current editor actions:

- `Apply Detail`
- `Reset Hex`
- `Rebuild From Surrounding`
- `Back` or close

Intended meanings:

- `Apply Detail`
  - save staged subhex detail for the active parent
- `Back` or close
  - discard the current staged session
- `Reset Hex`
  - discard unapplied terrain, anchor, and POI visibility changes; undo can restore them during the session
- `Rebuild From Surrounding`
  - immediately save a procedural terrain baseline from neighboring parents while preserving saved POI and route anchors and POI visibility

## Staging Model

Subhex editor must be staged.

Entering subhex editor should build a working copy from:

1. procedural baseline for that parent
2. saved `subhex_snapshot`, if present
3. saved POI anchor data, if present
4. saved route adjustment data, if present

### During Editing

- no live database writes for terrain, feature, anchor, or POI visibility drafts; Rebuild From Surrounding is an explicitly labeled immediate-save exception
- all terrain/feature edits remain local to the staged session
- undo/redo should operate within the staged subhex editor session

### On Apply

Apply should:

1. persist parent `subhex_snapshot`
2. persist POI anchor changes, if any
3. persist route adjustment changes, if any
4. recompute parent terrain/features summary from owned subhexes, when materialized
5. rerender the parent map

## V1 Scope

V1 should stay conservative.

### Include

- subhex editor entry
- staged editing shell
- owned subhex terrain editing
- owned subhex feature editing
- apply/cancel/reset/rebuild behavior
- parent summary recompute on apply

### Exclude From First Implementation

- full route-point editing UI
- POI dragging UI
- context/cutoff cell editing
- wilderness reveal systems
- player-facing subhex mechanics
- full site-map tooling

## Later Layers

After v1 terrain/features are stable, the next likely additions are:

1. POI anchors
2. locked route portals with internal route bend adjustments
3. richer subhex metadata and site-map links

### Settlement Painting

- A settlement brush should paint a stable, generated town footprint at subhex scale; it is illustrative rather than literal one-mile building placement.
- Generate clusters of building marks and internal lanes with minimal manual work. Roads and paths entering the footprint should connect naturally to the generated lanes.
- Keep existing roads and rivers visible and keep buildings off their corridors. Preserve the established road-over-river draw order; painting or erasing a settlement must not change route records.
- Town appearance should remain stable after saving and support later expansion or erasure.

### Shared Wall Anchors

- At parent-map scale, walls may still read as border features. In subhex editing, wall anchors can be dragged into either adjacent parent hex.
- Connect wall anchors with straight segments and sharp corners, unlike curved roads and rivers.
- Both adjacent parent editors should display and edit the same wall geometry.
- Tint route handles by overlay kind so road, path, river, and wall controls remain distinguishable at crossings and junctions.

### POI Visibility

- Visibility is saved per POI, not a global map toggle. An editor control can live on each POI handle.
- Hidden POIs remain visible but translucent in the subhex editor so they can be selected and shown again. Hide them only at subhex zoom in the normal map view; parent-scale POI markers remain unchanged.
- Keep map display visibility separate from the existing POI sharing-permission field. Hiding a marker must survive terrain rebuilds and must not hide its Codex record or remove its route anchor.

### River Junctions

- River confluences need a shared draggable junction handle like connected roads and paths. A river crossing a road is not a shared junction.
- Verify confluences with three visible branches, including the sharp V-shaped join in the current editor reference, remain connected after dragging and applying.
- One reported river hex still has a nearly meeting east-west river and north-south branch. Other river junctions and road-over-river crossings tested correctly; investigate whether this isolated case is disconnected generated route data before changing junction rendering.

## Open Questions

- Exact local owned-cell key set and ordering that best matches the template shape
- Whether POI anchors should be stored as separate columns or `jsonb`
- Whether route adjustments should live directly on overlay records or in a related adjustment table later
- Whether `Rebuild From Parent` should preserve all route adjustments, or only preserve them when the parent edges/route membership did not change
