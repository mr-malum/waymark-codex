# Mobile / Tablet Renderer: Memory And Cache Fix

## Evidence

- The previous mobile path still allocated four full-world canvases at scale 1.5. A default 50x50 map needs roughly 424 MiB of RGBA backing storage for those canvases alone, before browser/GPU copies, images, DOM, or subhex tiles.
- Mobile feature bitmaps were 768x666 per tint (about 1.95 MiB each); subhex variants were larger despite being drawn much smaller.
- The fixed 72-tile subhex cache could evict visible tiles: the 1200x800 test viewport at zoom 2 includes 90 parent tiles.
- Subhex tile image dependencies previously identified each detail's owner, even when that detail was drawn into a neighboring tile. Some tiles consequently stayed incomplete after image loading finished.

## Current Changes

- Phones/tablets use fixed world-coordinate tiles with a 96 MiB parent pixel-storage budget. Finished tiles persist across pans. Traveling to uncached territory builds the new tiles; old ones are evicted when the budget requires it.
- Four separate tile layers preserve terrain, routes, elevation/features, and mist ordering. Route geometry is recorded from the existing path builders and reused. Resolution depends on zoom and viewport capacity, not pan position.
- Initial loading waits for visible tiles and their feature image queue. Tile work is spread across frames, and feature image completion yields between batches.
- Mobile parent artwork uses 256x222 bitmaps; subhex artwork uses 192x167. Desktop and PNG export retain their existing supersampling.
- Subhex keeps visible tiles resident, sizes detail to its 64 MiB budget, releases discarded canvas storage, uses spatial lookups, and tracks images against every consuming tile.
- Off-screen subhex route paths are skipped using cached bounds. The dense 100x100 fixture has over 2,000 route paths; previously every pan parsed and drew all of them.
- UI responsive logic and zoom steps are unchanged. Device capability selects the renderer, independently of UI width.

## Immediate Priorities After Lag Stabilization

1. POI marker clustering

   - Bubble or combine related adjacent POI markers when they are too close to read individually.
   - Preserve useful category/icon information in the combined marker and make the grouped count or contents discoverable.

2. Map Tools Archive placement

   - Move the `Archive` section up one level from `Surveyor` so it sits alongside `Surveyor` and `Cartographer`.

3. Archive export controls

   Expand the Archive export feature with player-facing map controls:

   - `Notoriety Tier Threshold`: display only map icons at or above the selected threshold, hiding obscure POIs from printed player maps.
   - Toggle hex coordinate/number labels.
   - Toggle the various region border layers.
   - Add the relevant options currently available under the main map's `Map View` section, keeping export settings separate from live map visibility.

4. Subhex detail editing

   Keep the first editing pass staged and parent-owned:

   - Convert the current prototype toward an in-map editor state.
   - Center the selected parent hex with left-pane-aware framing and use a strong veil.
   - Allow edits only to owned subhexes.
   - Add staged terrain and feature painting.
   - Add deterministic/generated and manual POI subhex anchors.
   - Show locked route boundary portals while preserving parent route continuity.
   - Consider internal route adjustment points only after terrain, features, and POI anchors are stable; boundary anchors remain locked.
   - Use the planned hybrid persistence model: parent hex remains authoritative, with later nullable subhex snapshots and local POI/route anchor data.

## Verification

`tests/generated-map-renderer-memory.cjs` uses installed Playwright and a local Chromium/Edge executable. It loads the real production renderer and SVG assets with synthetic data; it does not contact Supabase or mutate campaign records.

Run with Node and Playwright available through `NODE_PATH`. Set `MAP_TEST_BROWSER` to a local Chromium/Edge executable when Playwright's bundled browser is unavailable.

Verified scenarios include dense 50x50 and 100x100 campaigns, initial readiness, warm pan reuse, tile invalidation without accumulated artwork, terrain edits, rendered layer comparisons, travel within the memory budget, all 90 visible subhex tiles retained and reused, phone viewport, desktop cache path, and export supersampling isolation.

Representative browser results: parent tiles about 45.5 MiB on both map sizes; initial feature images about 7.6 MiB; zero parent tile builds across 30 warm pan frames; 90/90 subhex tiles ready and reused, about 32.6 MiB. Figures are pixel-storage estimates, not total browser process memory or Android speed predictions.

Skipping off-screen subhex routes reduced the synthetic raster pan measurement from about 6 ms to 0.75 ms on this host. This excludes DOM/SVG/UI work and is not an Android frame-rate claim.

`GeneratedMapRendererPerf.memory()` now reports cache byte estimates, tile counts/builds, and image queue counts for diagnostics.

## Still Needs Device Verification

- User confirmed the heavier Testing Grounds campaign now loads on the tablet and performs much better. Overland/subhex transitions still have some delay.
- Latest loading-veil and seam fixes still need verification on the actual Lenovo P11 Gen 2 and phone.
- Full dense-campaign DOM/SVG/POI performance and Android GPU/process memory. The automated harness isolates raster/cache behavior and does not reproduce the complete live campaign UI.
- Manual Cartographer Apply/Undo and end-to-end PNG download in the real application.

Do not respond to another crash by restoring full-map touch canvases, suppressing features, or clearing the tile cache on every pan. Capture cache diagnostics and inspect the remaining workload first.

## Loading Veil And Tile Joins Follow-Up

- Keep the veil locked while initial loading is active. Readiness now includes feature-image invalidations waiting for a tile redraw, plus dirty visible tiles, not just the last frame's pending flag.
- Reuse the veil only when crossing from subhex back to overland requires uncached tiles. The initial broader zoom-change trigger interrupted ordinary zoom-ins; it has been narrowed. Ordinary overland zooming and warm panning keep the veil hidden. Evicted overview tiles can still require rebuilding within the existing memory budget.
- Composite parent tiles at shared device-pixel boundaries, adjusting source sampling into their existing gutters. Do not overlap translucent layers to hide seams, since that doubles their opacity.
- Seal touch terrain polygon edges within the map outline. Subhex touch terrain applies its 0.82 opacity at tile composition instead of separately antialiasing translucent adjoining polygons. Sample the exact rendered bounds rather than stretching rounded-up canvas dimensions.
- Browser regression reproduced the old square seams (opaque join pixels dropped to alpha 201). All 32 join cases now pass across four pixel densities, four zoom levels, and opaque/translucent layers. Loading tests cover partial tiles, late feature completion, overview rebuild, eventual veil dismissal, and no veil during warm pans or ordinary overland zoom-in/zoom-out with uncached tiles.
- Subhex internal terrain coverage is at least 251/255 in the tested tile; its intended layer opacity is retained. Browser screenshots inspected for overland and subhex. Existing cache-budget, route/layer, desktop, and export-quality checks still pass.

## Subhex Feature Completion Optimization

- Subhex image completion no longer deletes the finished terrain tile. It queues only the pending feature canvas through the existing frame-budgeted scheduler.
- Preparation stores deterministic feature/farmland draw commands and unique image dependencies inside the existing bounded tile cache. Warmup, readiness checks, and drawing share that preparation. Readiness no longer regenerates every subhex's features on each image completion.
- Warmup can prepare a tile without allocating a canvas. Once terrain is drawn, its temporary subhex geometry is released; once features are drawn, their temporary commands/dependencies are released. Late image callbacks skip complete or evicted tiles.
- Terrain/feature edits and neighboring invalidation still discard affected tiles through the existing helpers. Image quality, cache budgets, route ordering, and the 2 ms tablet preparation budget are unchanged.
- Instrumented 90-tile cold-feature fixture: feature-seeding calls fell from 103,072 to 11,702; terrain draws from 180 to 90. Baseline took about 817 ms on this host; optimized runs about 189-253 ms. These are synthetic raster/load timings, not actual tablet or full UI timings. Finished subhex canvas memory remained 34,171,524 bytes.
- Regression checks pass for warmup reuse without canvas allocation, original terrain identity retained through image completion, automatic scheduled completion, evicted-tile callbacks, temporary data release, edits/restoration, and desktop subhex completion. All 90 feature canvases match the original uncached feature/farmland drawing pixel-for-pixel.
- Still requires Lenovo verification of first subhex entry, revisiting cached detail, and panning into new detail areas. No claim yet about the actual device speedup.
