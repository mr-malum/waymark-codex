const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');

// Exercise production drawing code with local, synthetic campaign data. No backend access.
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/generated-map-renderer.js'), 'utf8');
const assets = Object.fromEntries(fs.readdirSync(path.join(root, 'hex-mapper/assets/features'))
  .filter(file => file.endsWith('.svg'))
  .map(file => [file, fs.readFileSync(path.join(root, 'hex-mapper/assets/features', file), 'utf8')]));
const exposed = `window.mapTest = { renderer, buildHexModel, rebuildHexIndexes, bumpOverlayRevision,
  parseFeatureSvg, renderTerrain, updateTouchMapCache, getVisibleHexes, getSubhexDetailTile,
  getSubhexesForBounds, getSubhexDetailTileBounds, getSubhexMetrics, markTerrainHexesDirty,
  getFeatureArtImageEntry, getFeatureImageSupersample, getTouchRouteCommands,
  drawGeneratedMapExportRaster, hasInitialMapLoadingWork, resetTouchMapCache,
  setLoading, beginInitialMapLoadingVeil, checkInitialMapLoadingVeil, drawTouchMapCacheSlice,
  renderSubhexTileTerrain, renderSubhexDetailTileLayer,
  queueSubhexFeatureArtWarmupForHexes, getSubhexDetailTileState, deleteSubhexDetailTile,
  getSubhexSeededFeatures, renderSubhexFarmlandOverlay, getSubhexFeatureStack, getSubhexWaterDabColor,
  getFeatureArtImage, drawFeatureArtImage, getSubhexFeatureArtBox, getSubhexFeatureImageUsage,
  getFeatureImageCacheKey, getHexesForBounds, startSubhexDetailPrecache,
  markFeatureImageUsageDirty, getDefaultVisibleOverlays, shouldUseTouchMapRenderer,
  releaseMapCanvas, invalidateAllSubhexDetailTiles, renderCanvasDrawablePaths,
  drawCanvasPolygon, renderFarmlandOverlayForHex, clipToMapHexArea, renderEdgeBleedForHex,
  renderFeatureLayer, renderCanvasMistOverlays, getSubhexFeatureTileScale, getSubhexRouteProjectionEntries };
  window.generatedMapRenderer = {`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.MAP_TEST_BROWSER ? { executablePath: process.env.MAP_TEST_BROWSER } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<style>body{margin:0}canvas{width:1200px;height:800px}</style><canvas id="output" width="2400" height="1600"></canvas>');
    await page.evaluate(() => {
      window.getActiveCampaign = () => ({ id: 'test', map_mode: 'generated' });
      window.isGeneratedMapCampaign = () => true;
      window.getGeneratedMapConfig = () => ({});
      window.parseMapHexId = text => { const [x, y] = text.split(':').map(Number); return { x, y }; };
      window.db = { raw: { pois: [], regions: [], politicalRegions: [], hexes: [] } };
      window.testCols = 50;
      window.getGeneratedMapDimensions = () => {
        const radius = 42, cols = window.testCols, rows = cols, hexHeight = Math.sqrt(3) * radius;
        return { cols, rows, radius, hexHeight, width: Math.ceil(60 + 3 * radius + (cols - 1) * radius * 1.5), height: Math.ceil(60 + (rows + 0.5 + (cols - 1) % 2 * 0.5) * hexHeight) };
      };
    });
    const instrumented = source
      .replace('function getSubhexSeededFeatures(subhex) {', 'function getSubhexSeededFeatures(subhex) { if (window.subhexWork) window.subhexWork.seededCalls++;')
      .replace('function renderSubhexTileTerrain(ctx, bounds, subhexes, terrainScale = TERRAIN_CACHE_SCALE) {', 'function renderSubhexTileTerrain(ctx, bounds, subhexes, terrainScale = TERRAIN_CACHE_SCALE) { if (window.subhexWork) window.subhexWork.terrainBuilds++;');
    await page.addScriptTag({ content: instrumented.replace('window.generatedMapRenderer = {', exposed) });
    await page.evaluate(assets => {
      const t = mapTest, r = t.renderer;
      // Keep unrelated UI/background schedulers out of this raster regression test.
      window.testViewport = { width: 1200, height: 800, scale: 2 };
      r.root = { hidden: true, classList: document.createElement('div').classList, getBoundingClientRect: () => testViewport };
      r.loadingVeil = document.createElement('div');
      r.canvas = document.getElementById('output');
      r.ctx = r.canvas.getContext('2d');
      r.initialMapLoadingActive = true;
      r.featureAssetsLoaded = r.routeIconAssetsLoaded = r.poiIconAssetsLoaded = true;
      r.drawing.visibleOverlays = t.getDefaultVisibleOverlays();
      Object.entries(assets).forEach(([file, svg]) => r.featureAssets.set(file, t.parseFeatureSvg(svg)));
      window.setupMap = cols => {
        t.resetTouchMapCache();
        window.testCols = cols;
        Object.assign(r.view, getGeneratedMapDimensions(), { zoom: 0.5, panX: 80, panY: 80 });
        const biomes = [['grassland', ['forest', 'ridges']], ['rock', ['mountains', 'woods']], ['desert', ['sand', 'cactus_scrub']], ['wetland', ['marsh', 'woods']], ['sea', ['waves', 'kelp']], ['plains', ['woods', 'shrub']], ['snow', ['ice', 'mountains']], ['barrens', ['cliffs', 'forest']]];
        r.hexes = [];
        for (let x = 0; x < cols; x++) for (let y = 0; y < cols; y++) {
          const [Base_Terrain, Terrain_Features] = biomes[(Math.floor(x / 5) + Math.floor(y / 5)) % biomes.length];
          r.hexes.push(t.buildHexModel({ Hex_ID: `${x}:${y}`, Map_XY: `${x}:${y}`, Base_Terrain, Terrain_Features, Elevation: (x + y) % 4 }));
        }
        t.rebuildHexIndexes();
        r.hexesByCoord = new Map(r.hexes.map(hex => [`${hex.x}:${hex.y}`, hex]));
        r.mapOverlays = [];
        for (let x = 2; x < cols - 2; x += 3) for (let y = 2; y < cols - 2; y++) {
          r.mapOverlays.push({ __uuid: `route-${x}-${y}`, Overlay_Type: ['road', 'river', 'path'][x % 5 % 3], From_Hex_ID_Ref: `${x}:${y}`, To_Hex_ID_Ref: `${x}:${y+1}`, Is_Major_Route: y % 3 === 0 });
          if (y % 4 === 0) r.mapOverlays.push({ __uuid: `farm-${x}-${y}`, Overlay_Type: 'farmland', Hex_ID_Ref: `${x}:${y}` });
          if (y % 7 === 0) r.mapOverlays.push({ __uuid: `mist-${x}-${y}`, Overlay_Type: 'mist', Hex_ID_Ref: `${x}:${y}` });
        }
        t.bumpOverlayRevision();
        r.cacheDirty = r.routeCacheDirty = r.featureCacheDirty = r.overlayCacheDirty = true;
      };
      window.draw = () => t.renderTerrain(testViewport, t.getVisibleHexes());
      window.memory = () => {
        const bytes = canvas => canvas ? canvas.width * canvas.height * 4 : 0;
        return {
          parentBytes: [...r.touchMapCache.tiles.values()].reduce((sum, tile) => sum + Object.values(tile.layers).reduce((n, canvas) => n + bytes(canvas), 0), 0),
          spriteBytes: [...r.featureImages.values()].reduce((n, entry) => n + bytes(entry.image), 0),
          legacyBytes: [r.cacheCanvas, r.routeCacheCanvas, r.featureCacheCanvas, r.overlayCacheCanvas].reduce((n, canvas) => n + bytes(canvas), 0),
          subhexBytes: [...r.subhexDetailTileCache.values()].reduce((n, tile) => n + bytes(tile.terrainCanvas) + bytes(tile.featureCanvas), 0),
          builds: r.touchMapCache.builds,
          sprites: r.featureImages.size,
          pending: r.touchMapCache.pending || r.touchMapCache.featureDirtyHexIds.size > 0 || r.featureImageQueue.length > 0 || r.featureImageActiveLoads > 0 || r.cacheDirty || r.routeCacheDirty || r.featureCacheDirty || r.overlayCacheDirty
        };
      };
      setupMap(50);
    }, assets);

    async function settle() {
      for (let i = 0; i < 600; i++) {
        const status = await page.evaluate(() => { draw(); return memory(); });
        if (!status.pending) return status;
        await page.waitForTimeout(16);
      }
      throw new Error('Raster cache did not settle');
    }
    const joins = await page.evaluate(() => {
      const t = mapTest, r = t.renderer, cache = r.touchMapCache;
      const originalView = { ...r.view }, originalVisible = cache.visible;
      const output = document.createElement('canvas'); output.width = output.height = 80;
      const ctx = output.getContext('2d'), results = [];
      // Flat opaque and translucent tiles isolate join coverage from terrain artwork.
      for (const dpr of [1, 1.25, 2, 2.625]) for (const zoom of [0.16, 0.37, 0.85, 2]) for (const alpha of [1, 0.5]) {
        Object.assign(r.view, { zoom, panX: 512 - 20.3 / zoom, panY: 512 - 19.7 / zoom });
        cache.visible = [];
        const scale = [0.125, 0.25, 0.5, 0.75, 1, 1.5].find(value => value >= Math.min(1.5, zoom * Math.min(2, dpr)));
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512 * scale + 2;
          const tileCtx = canvas.getContext('2d'); tileCtx.fillStyle = `rgba(120,80,40,${alpha})`; tileCtx.fillRect(0, 0, canvas.width, canvas.height);
          cache.visible.push({ x, y, scale, bounds: { left: x * 512, top: y * 512 }, layers: { terrain: canvas } });
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 80, 80);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        t.drawTouchMapCacheSlice(ctx, r.cacheCanvas, 1);
        const data = ctx.getImageData(Math.round(20.3 * dpr) - 3, Math.round(19.7 * dpr) - 3, 6, 6).data;
        const alphas = [...data].filter((_, i) => i % 4 === 3);
        results.push({ dpr, zoom, alpha, min: Math.min(...alphas), max: Math.max(...alphas) });
      }
      Object.assign(r.view, originalView); cache.visible = originalVisible;
      return results;
    });
    for (const join of joins) {
      assert(join.min >= Math.round(join.alpha * 255) - 1 && join.max <= Math.round(join.alpha * 255) + 1,
        `tile join has a gap or doubled opacity: ${JSON.stringify(join)}`);
    }
    const loadingStart = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      t.beginInitialMapLoadingVeil(); draw();
      r.initialMapLoadingStartedAt = performance.now() - 1000;
      window.clearTimeout(r.initialMapLoadingTimer); t.checkInitialMapLoadingVeil();
      t.setLoading(false);
      window.clearTimeout(r.initialMapLoadingTimer);
      return { hidden: r.loadingVeil.hidden, pending: r.touchMapCache.pending };
    });
    assert(loadingStart.pending && !loadingStart.hidden, 'veil disappeared during partial tile loading');
    const started = Date.now();
    const initial = await settle();
    const initialLoadMs = Date.now() - started;
    await page.waitForTimeout(32);
    assert.equal(await page.evaluate(() => mapTest.hasInitialMapLoadingWork()), false, 'initial veil cannot finish');
    const lateFeatures = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      r.touchMapCache.featureDirtyHexIds.add('8:8');
      t.checkInitialMapLoadingVeil();
      window.clearTimeout(r.initialMapLoadingTimer);
      return { work: t.hasInitialMapLoadingWork(), hidden: r.loadingVeil.hidden };
    });
    assert(lateFeatures.work && !lateFeatures.hidden, 'veil ignored decoded features waiting for their final tile redraw');
    await settle();
    await page.waitForTimeout(32);
    assert.equal(await page.evaluate(() => {
      mapTest.checkInitialMapLoadingVeil(); return mapTest.renderer.loadingVeil.hidden;
    }), true, 'veil did not close after the completed frame');
    assert.equal(initial.legacyBytes, 0, 'touch renderer allocated full-map canvases');
    assert(initial.parentBytes <= 96 * 1024 * 1024);
    assert(initial.spriteBytes < 32 * 1024 * 1024);
    const pans = await page.evaluate(() => {
      const r = mapTest.renderer, before = r.touchMapCache.builds, times = [];
      for (let i = 0; i < 30; i++) {
        r.view.panX = 80 + i % 2 * 20;
        const start = performance.now(); draw(); times.push(performance.now() - start);
      }
      return { builds: r.touchMapCache.builds - before, meanMs: times.reduce((a,b)=>a+b,0)/times.length, maxMs: Math.max(...times) };
    });
    assert.equal(pans.builds, 0, 'pan rebuilt already cached map tiles');
    assert.equal(await page.evaluate(() => mapTest.renderer.loadingVeil.hidden), true, 'warm panning brought back the veil');
    const featureBefore = await page.evaluate(() => {
      const tile = mapTest.renderer.touchMapCache.visible.find(tile => tile.x === 1 && tile.y === 1);
      mapTest.renderer.touchMapCache.featureDirtyHexIds.add('8:8');
      return tile.layers.features.toDataURL();
    });
    await settle();
    const featureAfter = await page.evaluate(() => mapTest.renderer.touchMapCache.visible.find(tile => tile.x === 1 && tile.y === 1).layers.features.toDataURL());
    assert.equal(featureAfter, featureBefore, 'feature image completion darkened or duplicated existing artwork');

    const originalFill = await page.evaluate(() => {
      const t = mapTest, hex = t.renderer.hexesById.get('8:8'), old = hex.fill;
      hex.fill = '#ff00ff'; t.markTerrainHexesDirty([hex], 0); return old;
    });
    await settle();
    const paintedPixel = await page.evaluate(() => {
      const r = mapTest.renderer, hex = r.hexesById.get('8:8');
      const tile = r.touchMapCache.visible.find(tile => tile.x === 1 && tile.y === 1);
      return [...tile.layers.terrain.getContext('2d').getImageData(1 + (hex.center.x - tile.bounds.left) * tile.scale, 1 + (hex.center.y - tile.bounds.top) * tile.scale, 1, 1).data];
    });
    assert.deepEqual(paintedPixel, [255, 0, 255, 255], 'terrain edit was not applied to its cached tile');
    await page.evaluate(fill => {
      const t = mapTest, hex = t.renderer.hexesById.get('8:8'); hex.fill = fill; t.markTerrainHexesDirty([hex], 0);
    }, originalFill);
    await settle();

    const comparison = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      const tile = r.touchMapCache.visible.find(tile => tile.x === 1 && tile.y === 1);
      const reference = document.createElement('canvas');
      reference.width = reference.height = 512 * tile.scale + 2;
      const ctx = reference.getContext('2d');
      const differences = {};
      const errors = {};
      for (const layer of ['terrain', 'routes', 'features', 'overlays']) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, reference.width, reference.height);
        ctx.setTransform(tile.scale, 0, 0, tile.scale, 1 - tile.bounds.left * tile.scale, 1 - tile.bounds.top * tile.scale);
        if (layer === 'terrain') {
          ctx.save(); t.clipToMapHexArea(ctx);
          r.hexes.forEach(hex => t.drawCanvasPolygon(ctx, hex.points, hex.fill, 1, 1 / tile.scale)); ctx.restore();
        }
        if (layer === 'routes') { r.hexes.forEach(hex => t.renderFarmlandOverlayForHex(ctx, hex)); t.renderCanvasDrawablePaths(ctx); }
        if (layer === 'features') {
          ctx.save(); t.clipToMapHexArea(ctx); r.hexes.forEach(hex => t.renderEdgeBleedForHex(ctx, hex)); t.renderFeatureLayer(ctx, r.hexes); ctx.restore();
        }
        if (layer === 'overlays') t.renderCanvasMistOverlays(ctx);
        const expected = ctx.getImageData(0, 0, reference.width, reference.height).data;
        const actual = tile.layers[layer].getContext('2d').getImageData(0, 0, reference.width, reference.height).data;
        let mismatches = 0, maxAlpha = 0, maxPremultiplied = 0, totalError = 0;
        for (let i = 0; i < expected.length; i += 4) {
          maxAlpha = Math.max(maxAlpha, Math.abs(expected[i+3] - actual[i+3]));
          for (let c = 0; c < 3; c++) {
            const error = Math.abs(expected[i+c] * expected[i+3] / 255 - actual[i+c] * actual[i+3] / 255);
            maxPremultiplied = Math.max(maxPremultiplied, error); totalError += error;
          }
          if (Math.abs(expected[i+3] - actual[i+3]) > 2 || (expected[i+3] > 20 && [0,1,2].some(c => Math.abs(expected[i+c] - actual[i+c]) > 2))) mismatches++;
        }
        differences[layer] = mismatches;
        errors[layer] = { maxAlpha, maxPremultiplied, mean: totalError / expected.length };
      }
      const pixels = r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data;
      let nonblank = 0; for (let i=3;i<pixels.length;i+=4) if(pixels[i]) nonblank++;
      return { nonblank, commands: t.getTouchRouteCommands().length, differences, errors };
    });
    assert(comparison.nonblank > 1000000, 'map raster is blank');
    assert(comparison.commands > 100, 'dense overlay fixture did not render routes');
    for (const [layer, error] of Object.entries(comparison.errors)) {
      // Chromium can antialias a local clip slightly differently from the full-map clip.
      assert(error.mean < 0.1 && error.maxPremultiplied < 8, `${layer} differs from full-map drawing: ${JSON.stringify(error)}`);
    }
    await settle();
    await page.screenshot({ path: path.join(os.tmpdir(), 'map-memory-tablet.png') });
    const ordinaryZoomIn = await page.evaluate(() => {
      const r = mapTest.renderer;
      r.view.zoom = 0.85; draw();
      return { pending: r.touchMapCache.pending, hidden: r.loadingVeil.hidden, active: r.initialMapLoadingActive };
    });
    assert(ordinaryZoomIn.pending && ordinaryZoomIn.hidden && !ordinaryZoomIn.active,
      'ordinary zoom-in showed the loading veil while higher-resolution tiles built');
    await settle();
    const ordinaryZoomOut = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      for (const [key, tile] of r.touchMapCache.tiles) {
        if (tile.scale === r.touchMapCache.visible[0].scale) continue;
        Object.values(tile.layers).forEach(t.releaseMapCanvas); r.touchMapCache.tiles.delete(key);
      }
      r.view.zoom = 0.5; draw();
      return { pending: r.touchMapCache.pending, hidden: r.loadingVeil.hidden, active: r.initialMapLoadingActive };
    });
    assert(ordinaryZoomOut.pending && ordinaryZoomOut.hidden && !ordinaryZoomOut.active,
      `ordinary overland zoom-out should build without a veil: ${JSON.stringify(ordinaryZoomOut)}`);
    await settle();
    await page.evaluate(() => setupMap(100));
    const large = await settle();
    assert(large.parentBytes <= 96 * 1024 * 1024, 'cache grew with campaign dimensions');
    assert.equal(large.legacyBytes, 0);
    for (const [panX, panY] of [[1800, 1800], [3600, 3200], [80, 80]]) {
      await page.evaluate(([panX, panY]) => Object.assign(mapTest.renderer.view, { panX, panY }), [panX, panY]);
      const travelled = await settle();
      assert(travelled.parentBytes <= 96 * 1024 * 1024, 'travel exceeded the tile memory budget');
    }
    const subhex = await page.evaluate(async () => {
      const t = mapTest, r = t.renderer;
      t.invalidateAllSubhexDetailTiles();
      r.initialMapLoadingActive = true;
      for (const [key, entry] of r.featureImages) {
        if (entry.cacheVariant !== 'subhex') continue;
        t.releaseMapCanvas(entry.image); r.featureImages.delete(key);
      }
      window.subhexWork = { seededCalls: 0, terrainBuilds: 0 };
      r.view.zoom = 2;
      const visible = t.getVisibleHexes();
      r.subhexVisibleHexIds = new Set(visible.map(hex => hex.id));
      const start = performance.now();
      t.queueSubhexFeatureArtWarmupForHexes(visible);
      const prepared = visible.map(hex => r.subhexDetailTileCache.get(hex.id));
      const preparationCalls = subhexWork.seededCalls;
      const warmupAllocatedCanvas = prepared.some(tile => tile.terrainCanvas || tile.featureCanvas);
      visible.forEach(hex => t.getSubhexDetailTile(hex, { allowBuild: true }));
      const preparationReused = prepared.every((tile, index) => r.subhexDetailTileCache.get(visible[index].id) === tile)
        && subhexWork.seededCalls === preparationCalls;
      const terrain = visible.map(hex => t.getSubhexDetailTile(hex, { allowBuild: false })?.terrainCanvas);
      for (let i = 0; i < 300 && (r.featureImageQueue.length || r.featureImageActiveLoads); i++) await new Promise(resolve => setTimeout(resolve, 16));
      visible.forEach(hex => t.getSubhexDetailTile(hex, { allowBuild: true }));
      const retained = visible.filter(hex => t.getSubhexDetailTile(hex, { allowBuild: false })?.featureReady).length;
      const tiles = visible.map(hex => t.getSubhexDetailTile(hex, { allowBuild: false }));
      for (let i=0;i<10;i++) visible.forEach(hex => t.getSubhexDetailTile(hex, { allowBuild: true }));
      const reused = visible.every((hex, index) => t.getSubhexDetailTile(hex, { allowBuild: false }) === tiles[index]);
      const terrainRetained = visible.every((hex, index) => t.getSubhexDetailTile(hex, { allowBuild: false })?.terrainCanvas === terrain[index]);
      r.initialMapLoadingActive = false;
      const plansReleased = [...r.subhexDetailTileCache.values()].every(tile => !tile.featurePlan && !tile.subhexes);
      return { visible: visible.length, retained, reused, terrainRetained, preparationCalls, warmupAllocatedCanvas,
        preparationReused, plansReleased, work: { ...subhexWork }, scale: t.getSubhexFeatureTileScale(), durationMs: performance.now() - start, ...memory() };
    });
    assert(subhex.subhexBytes < 64 * 1024 * 1024);
    assert.equal(subhex.retained, subhex.visible, 'visible subhex tiles evicted one another');
    assert.equal(subhex.reused, true, 'subhex tiles rebuilt without data changes');
    assert.equal(subhex.terrainRetained, true, 'feature completion discarded finished terrain');
    assert.equal(subhex.work.terrainBuilds, subhex.visible, 'terrain was drawn more than once per tile');
    assert.equal(subhex.work.seededCalls, subhex.preparationCalls, 'readiness or rendering repeated feature placement');
    assert(subhex.preparationReused && subhex.plansReleased && !subhex.warmupAllocatedCanvas,
      'warmup did not reuse/release bounded placement data independently of canvas allocation');
    const featurePixels = await page.evaluate(() => {
      const t = mapTest, r = t.renderer, mismatches = [];
      let compared = 0;
      for (const hex of t.getVisibleHexes()) {
        const tile = t.getSubhexDetailTile(hex, { allowBuild: false });
        const reference = document.createElement('canvas');
        reference.width = tile.featureCanvas.width; reference.height = tile.featureCanvas.height;
        const ctx = reference.getContext('2d'), bounds = tile.bounds, scale = tile.featureScale;
        ctx.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);
        ctx.save(); t.clipToMapHexArea(ctx, t.getHexesForBounds(bounds));
        // Original uncached drawing path, including farms and feature order.
        t.getSubhexesForBounds(bounds, [hex]).forEach(subhex => {
          const seeded = t.getSubhexSeededFeatures(subhex), metrics = t.getSubhexMetrics();
          t.renderSubhexFarmlandOverlay(ctx, subhex, metrics, seeded);
          const stack = t.getSubhexFeatureStack(subhex, seeded);
          stack.forEach((item, index) => {
            const image = t.getFeatureArtImage(item.file, item.tint, t.getSubhexFeatureImageUsage(subhex));
            if (image) t.drawFeatureArtImage(ctx, image, t.getSubhexFeatureArtBox(subhex, metrics, index, stack.length), item.opacity);
          });
        });
        ctx.restore();
        if (reference.toDataURL() !== tile.featureCanvas.toDataURL()) mismatches.push(hex.id);
        t.releaseMapCanvas(reference); compared++;
      }
      return { compared, mismatches };
    });
    assert.deepEqual(featurePixels.mismatches, [], 'cached feature placement changed the drawing');
    const waterTint = await page.evaluate(() => ({
      plains: mapTest.getSubhexWaterDabColor('plains'),
      desert: mapTest.getSubhexWaterDabColor('desert'),
      water: mapTest.getSubhexWaterDabColor('inland_water')
    }));
    assert.notEqual(waterTint.plains, waterTint.desert, 'water brush tint ignored the terrain beneath it');
    assert.notEqual(waterTint.plains, waterTint.water, 'water brush tint did not adapt to water terrain');
    const completion = await page.evaluate(async () => {
      const t = mapTest, r = t.renderer, hex = r.hexesById.get('5:5');
      r.initialMapLoadingActive = true;
      t.deleteSubhexDetailTile(hex.id);
      const prepared = t.getSubhexDetailTileState(hex);
      const dependency = prepared.featurePlan.images[0];
      const cacheKey = t.getFeatureImageCacheKey(dependency.file, dependency.tint, 'subhex');
      t.releaseMapCanvas(r.featureImages.get(cacheKey)?.image); r.featureImages.delete(cacheKey);
      const tile = t.getSubhexDetailTile(hex, { allowBuild: true });
      const terrain = tile.terrainCanvas, wasWaiting = !tile.featureReady;
      r.initialMapLoadingActive = false;
      for (let i = 0; i < 300 && !tile.featureReady; i++) await new Promise(resolve => setTimeout(resolve, 16));
      return { wasWaiting, ready: tile.featureReady, retained: r.subhexDetailTileCache.get(hex.id) === tile && tile.terrainCanvas === terrain,
        planReleased: tile.featurePlan === null };
    });
    assert(completion.wasWaiting && completion.ready && completion.retained && completion.planReleased,
      `image completion did not schedule an in-place feature build: ${JSON.stringify(completion)}`);
    const evictedCompletion = await page.evaluate(() => {
      const t = mapTest, r = t.renderer, hex = r.hexesById.get('20:20');
      // Leave one cache slot for this offscreen preparation before explicitly evicting it.
      t.deleteSubhexDetailTile(t.getVisibleHexes()[0].id);
      t.queueSubhexFeatureArtWarmupForHexes([hex]);
      const images = r.subhexDetailTileCache.get(hex.id).featurePlan.images;
      t.deleteSubhexDetailTile(hex.id);
      const seeded = subhexWork.seededCalls;
      images.forEach(item => t.markFeatureImageUsageDirty(t.getFeatureImageCacheKey(item.file, item.tint, 'subhex')));
      return !r.subhexDetailTileCache.has(hex.id) && subhexWork.seededCalls === seeded;
    });
    assert(evictedCompletion, 'image completion recreated an evicted/offscreen tile');
    const editInvalidation = await page.evaluate(() => {
      const t = mapTest, r = t.renderer, hex = r.hexesById.get('5:5'), neighbor = r.hexesById.get('6:5');
      const old = t.getSubhexDetailTile(hex, { allowBuild: false });
      const oldNeighbor = t.getSubhexDetailTile(neighbor, { allowBuild: false });
      const previousFeatures = hex.features;
      hex.features = ['cliffs']; t.markTerrainHexesDirty([hex]);
      const released = !old.terrainCanvas.width && !old.featureCanvas.width && !oldNeighbor.terrainCanvas.width;
      const changed = t.getSubhexDetailTile(hex, { allowBuild: true });
      const rebuilt = changed !== old && changed.key !== old.key;
      hex.features = previousFeatures; t.markTerrainHexesDirty([hex]);
      const restored = t.getSubhexDetailTile(hex, { allowBuild: true });
      return { released, rebuilt, restored: restored.key === old.key && restored !== old };
    });
    assert(editInvalidation.released && editInvalidation.rebuilt && editInvalidation.restored,
      'terrain/feature edits or their restoration reused stale detail');
    const subhexEdges = await page.evaluate(() => {
      const r = mapTest.renderer;
      const tile = [...r.subhexDetailTileCache.values()].find(tile => tile.bounds.left > 100 && tile.bounds.top > 100);
      const canvas = tile.terrainCanvas;
      const pixels = canvas.getContext('2d').getImageData(4, 4, canvas.width - 8, canvas.height - 8).data;
      let min = 255;
      for (let i = 3; i < pixels.length; i += 4) min = Math.min(min, pixels[i]);
      return { min, opacity: tile.terrainOpacity };
    });
    assert(subhexEdges.min >= 250, `subhex terrain has transparent internal edges: ${JSON.stringify(subhexEdges)}`);
    assert.equal(subhexEdges.opacity, 0.82, 'subhex terrain lost its intended layer opacity');
    const subhexRoutes = await page.evaluate(() => {
      const start = performance.now();
      const entries = mapTest.getSubhexRouteProjectionEntries(mapTest.getVisibleHexes());
      return { entries: entries.length, buildMs: performance.now() - start };
    });
    await settle();
    const subhexPan = await page.evaluate(() => {
      const r = mapTest.renderer, before = r.touchMapCache.builds, times = [];
      for (let i = 0; i < 20; i++) {
        r.view.panX = 80 + i % 2 * 5;
        const start = performance.now(); draw(); times.push(performance.now() - start);
      }
      return { builds: r.touchMapCache.builds - before, meanMs: times.reduce((a,b)=>a+b,0)/times.length };
    });
    assert.equal(subhexPan.builds, 0);
    const routeCullingMatches = await page.evaluate(() => {
      const r = mapTest.renderer;
      draw(); const culled = r.canvas.toDataURL();
      const entries = mapTest.getSubhexRouteProjectionEntries();
      const bounds = entries.map(entry => entry.bounds);
      entries.forEach(entry => { entry.bounds = null; });
      draw(); const full = r.canvas.toDataURL();
      entries.forEach((entry, index) => { entry.bounds = bounds[index]; });
      return culled === full;
    });
    assert(routeCullingMatches, 'route culling changed visible subhex paths');
    await page.screenshot({ path: path.join(os.tmpdir(), 'map-memory-subhex.png') });
    const zoomOut = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      // Simulate the overview tiles having been evicted during detail exploration.
      for (const [key, tile] of r.touchMapCache.tiles) {
        if (tile.scale === 1.5) continue;
        Object.values(tile.layers).forEach(t.releaseMapCanvas); r.touchMapCache.tiles.delete(key);
      }
      r.view.zoom = 0.5; draw();
      return { pending: r.touchMapCache.pending, hidden: r.loadingVeil.hidden, active: r.initialMapLoadingActive };
    });
    assert(zoomOut.pending && zoomOut.active && !zoomOut.hidden, 'uncached overview rebuild was not covered by the veil');
    await settle();
    await page.waitForTimeout(32);
    assert.equal(await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      window.clearTimeout(r.initialMapLoadingTimer);
      r.initialMapLoadingStartedAt = performance.now() - 1000;
      t.checkInitialMapLoadingVeil(); return r.loadingVeil.hidden;
    }), true, 'overview rebuild left the veil stuck');
    const exports = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      r.exportingMap = true;
      const exportScale = t.getFeatureImageSupersample();
      r.exportingMap = false;
      return { exportScale, touchScale: t.getFeatureImageSupersample() };
    });
    assert.equal(exports.exportScale, 3, 'touch quality reduction leaked into export');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const r = mapTest.renderer;
      mapTest.invalidateAllSubhexDetailTiles();
      testViewport.width = 390; testViewport.height = 844;
      r.canvas.width = 780; r.canvas.height = 1688;
      r.canvas.style.width = '390px'; r.canvas.style.height = '844px';
      setupMap(50);
    });
    const phone = await settle();
    assert(phone.parentBytes < 96 * 1024 * 1024);
    await page.screenshot({ path: path.join(os.tmpdir(), 'map-memory-phone.png') });
    await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      setupMap(12);
      r.touchMapRenderer = false;
      r.initialMapLoadingActive = false;
      [r.cacheCanvas, r.routeCacheCanvas, r.featureCacheCanvas, r.overlayCacheCanvas].forEach(canvas => { canvas.width = 300; canvas.height = 150; });
      r.cacheCtx = r.cacheCanvas.getContext('2d');
      r.routeCacheCtx = r.routeCacheCanvas.getContext('2d');
      r.featureCacheCtx = r.featureCacheCanvas.getContext('2d');
      r.overlayCacheCtx = r.overlayCacheCanvas.getContext('2d');
    });
    const desktop = await settle();
    assert(desktop.legacyBytes > 0 && desktop.parentBytes === 0, 'desktop stopped using its existing cache path');
    const desktopDetail = await page.evaluate(async () => {
      const t = mapTest, r = t.renderer, hex = r.hexesById.get('5:5');
      r.initialMapLoadingActive = false;
      r.view.animatingZoom = true;
      const tile = t.getSubhexDetailTile(hex, { allowBuild: true }), terrain = tile.terrainCanvas;
      for (let i = 0; i < 300 && (r.featureImageQueue.length || r.featureImageActiveLoads); i++) await new Promise(resolve => setTimeout(resolve, 16));
      const completed = t.getSubhexDetailTile(hex, { allowBuild: true });
      r.view.animatingZoom = false;
      return { ready: completed.featureReady, retained: completed === tile && completed.terrainCanvas === terrain,
        scale: completed.featureScale, pixels: completed.featureCanvas?.width * completed.featureCanvas?.height };
    });
    assert(desktopDetail.ready && desktopDetail.retained && desktopDetail.pixels > 0,
      `desktop detail failed to complete in place: ${JSON.stringify(desktopDetail)}`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ joinCases: joins.length, loadingStart, lateFeatures, ordinaryZoomIn, ordinaryZoomOut, zoomOut, subhexEdges, initialLoadMs, initial, pans, comparison, large, subhex, featurePixels, completion, evictedCompletion, editInvalidation, subhexRoutes, subhexPan, exports, phone, desktop, desktopDetail }, null, 2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
