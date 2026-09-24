const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Reuse the established synthetic map/bootstrap, stopping before its regression cases.
let bootstrap = fs.readFileSync(path.join(__dirname, 'generated-map-renderer-memory.cjs'), 'utf8');
bootstrap = bootstrap.slice(0, bootstrap.indexOf('    const joins ='));
bootstrap = bootstrap.replace("path.join(root, 'js/generated-map-renderer.js')",
  "(process.env.MAP_PERF_SOURCE || path.join(root, 'js/generated-map-renderer.js'))");
bootstrap = bootstrap.replace('window.mapTest = { renderer,', `window.mapTest = {
  getSubhexOrganicSettlementPlan, getSavedSubhexSettlementRaster, getSubhexEditorCellKey,
  invalidateSubhexDetailForHex, getSubhexEditorRouteDescriptors, renderSavedSubhexSettlementLayer,
  getSavedSubhexSettlements, getRendererCacheMemory, renderSubhexEditorCanvas,
  buildSubhexFeaturePlan, renderSubhexTileFeatures, isPointBlockedBySubhexWater,
  clipSubhexSettlementAwayFromWater, ensureSubhexEditorWaterDabDrafts,
  getSubhexEditorContextWaterDabs, renderer,`);
const checks = String.raw`
    await page.evaluate(value => {window.testBaselineSource=value;},Boolean(process.env.MAP_PERF_SOURCE));
    const result = await page.evaluate(() => {
      const t = mapTest, r = t.renderer;
      r.touchMapRenderer = false;
      r.mapOverlays = [];
      for(let y=17;y<23;y++) r.mapOverlays.push({
        __uuid:'benchmark-road-'+y,Overlay_Type:'road',From_Hex_ID_Ref:'20:'+y,To_Hex_ID_Ref:'20:'+(y+1)
      });
      for(let x=18;x<22;x++) r.mapOverlays.push({
        __uuid:'benchmark-path-'+x,Overlay_Type:'path',From_Hex_ID_Ref:x+':20',To_Hex_ID_Ref:(x+1)+':20'
      });
      t.bumpOverlayRevision();
      const metrics = t.getSubhexMetrics();
      const center = r.hexesById.get('20:20').center;
      const settlement = {
        version: 2, id: 'benchmark-city', seed: 'dense-city', style: 'city',
        density: 95, densityJitter: 65, roadDensity: 100, roadStructure: 55,
        points: [[-110,-65],[50,-90],[110,-25],[70,80],[-90,65]].map(([x,y]) => ({x:center.x+x,y:center.y+y}))
      };
      r.subhexWalls = Array.from({length:80}, (_,i) => ({
        __uuid:'wall-'+i, Style:'wall', Points:[
          {x:center.x-150+i*4,y:center.y-95},{x:center.x-147+i*4,y:center.y-80}
        ]
      }));
      const bounds = {left:center.x-120,right:center.x+120,top:center.y-110,bottom:center.y+100};
      const cells = t.getSubhexesForBounds(bounds);
      cells.forEach(cell => {
        cell.owner.subhexSnapshot ||= {cells:{},anchors:{}};
        cell.owner.subhexSnapshot.cells[t.getSubhexEditorCellKey(cell)] = {
          base:'plains',features:[],elevation:0,settlement
        };
      });
      const timings = [];
      let plan;
      for(let i=0;i<4;i++) {
        r.subhexSettlementPlanCache = new Map();
        const start = performance.now();
        plan = t.getSubhexOrganicSettlementPlan(settlement,metrics,{editor:true});
        timings.push(performance.now()-start);
      }
      const layout = JSON.stringify({buildings:plan.buildings,lanes:plan.lanes,groundPatches:plan.groundPatches});
      const start = performance.now();
      const raster = t.getSavedSubhexSettlementRaster(settlement,metrics);
      const coldRasterMs = performance.now()-start;
      const pixels = raster.canvas.toDataURL();
      const warmStart = performance.now();
      for(let i=0;i<1000;i++) {
        if(t.getSavedSubhexSettlementRaster(settlement,metrics)!==raster) throw new Error('warm cache rebuilt');
      }
      const warm1000Ms = performance.now()-warmStart;
      const outside = r.hexesById.get('1:1');
      t.invalidateSubhexDetailForHex(outside.id);
      const retainedAfterRemoteEdit = t.getSavedSubhexSettlementRaster(settlement,metrics) === raster;
      t.invalidateSubhexDetailForHex('20:20');
      const changed = t.getSavedSubhexSettlementRaster(settlement,metrics);
      if(changed===raster) throw new Error('local terrain edit failed to invalidate raster');
      const unchangedPixels = changed.canvas.toDataURL() === pixels;
      const alpha = changed.canvas.getContext('2d').getImageData(0,0,changed.canvas.width,changed.canvas.height).data;
      const nonblank = alpha.some((v,i)=>i%4===3 && v>0);
      r.drawing.subhexEditorHexId = '20:20';
      r.subhexEditorCanvas = document.createElement('canvas');
      r.subhexEditorCtx = r.subhexEditorCanvas.getContext('2d');
      r.subhexEditorStage = {getBoundingClientRect:()=>({width:400,height:300})};
      r.subhexEditorLayout = {transform:{scale:1,offsetX:200-center.x,offsetY:150-center.y}};
      const hex = r.hexesById.get('20:20');
      const savedWater = hex.subhexSnapshot.water_dabs;
      hex.subhexSnapshot.water_dabs = [{id:'saved-water',x:center.x,y:center.y,r:12}];
      r.drawing.subhexEditorWaterDabDrafts = null;
      const savedWaterRetained = t.ensureSubhexEditorWaterDabDrafts().some(dab => dab.id==='saved-water');
      const neighborCell = cells.find(cell => cell.owner?.id && cell.owner.id !== hex.id);
      const neighborWater = neighborCell?.owner?.subhexSnapshot?.water_dabs;
      if(neighborCell) neighborCell.owner.subhexSnapshot.water_dabs = [
        {id:'neighbor-water',x:neighborCell.center.x,y:neighborCell.center.y,r:12}
      ];
      const neighborWaterVisible = !neighborCell || t.getSubhexEditorContextWaterDabs(cells,hex)
        .some(dab => dab.id==='neighbor-water');
      hex.subhexSnapshot.water_dabs = savedWater;
      if(neighborCell) neighborCell.owner.subhexSnapshot.water_dabs = neighborWater;
      r.drawing.subhexEditorWaterDabDrafts = null;
      t.renderSubhexEditorCanvas(hex,cells,[],metrics);
      const editorPixels = r.subhexEditorCanvas.toDataURL();
      let editorClears = 0;
      const clear = r.subhexEditorCtx.clearRect.bind(r.subhexEditorCtx);
      r.subhexEditorCtx.clearRect = (...args) => {editorClears++; clear(...args);};
      const editorStart = performance.now();
      for(let i=0;i<100;i++) t.renderSubhexEditorCanvas(hex,cells,[],metrics);
      const warmEditor100Ms = performance.now()-editorStart;
      if(r.subhexEditorCanvas.toDataURL()!==editorPixels) throw new Error('warm editor pixels changed');
      r.subhexEditorVisualRevision++;
      t.renderSubhexEditorCanvas(hex,cells,[],metrics);
      if(!editorClears) throw new Error('changed editor failed to redraw');
      const warmEditorRedraws = editorClears-1;
      r.drawing.subhexEditorWaterDabDrafts = Array.from({length:9},(_,index)=>( {
        id:'water-stroke-test-'+index.toString(36),x:center.x-64+index*16,y:center.y+12,r:18
      }));
      r.subhexEditorVisualRevision++;
      r.subhexSettlementPlanCache = new Map();
      const waterPlan = t.getSubhexOrganicSettlementPlan(settlement,metrics,{editor:true});
      const waterAvoided = !waterPlan.buildings.some(building => t.isPointBlockedBySubhexWater(
        building, waterPlan.waterDabs, Math.hypot(building.width,building.height)*0.5
      ));
      const waterfrontFollowed = waterPlan.lanes.some(lane => lane.waterfront && lane.points.length>=3);
      const waterMaskCanvas = document.createElement('canvas');
      waterMaskCanvas.width = waterMaskCanvas.height = 100;
      const waterMaskCtx = waterMaskCanvas.getContext('2d');
      waterMaskCtx.save();
      t.clipSubhexSettlementAwayFromWater(waterMaskCtx,[
        {x:44,y:50,r:22},{x:56,y:50,r:22}
      ],{left:0,top:0,right:100,bottom:100});
      waterMaskCtx.fillStyle = '#000';
      waterMaskCtx.fillRect(0,0,100,100);
      waterMaskCtx.restore();
      const waterMaskAlpha = (x,y) => waterMaskCtx.getImageData(x,y,1,1).data[3];
      const waterMaskUnion = waterMaskAlpha(50,50) === 0
        && waterMaskAlpha(35,50) === 0 && waterMaskAlpha(5,5) === 255;
      r.drawing.subhexEditorWaterDabDrafts = null;
      r.subhexEditorVisualRevision++;
      r.subhexSettlementPlanCache = new Map();
      let legacyRendered = true;
      if(!window.testBaselineSource) {
        const cell = cells.find(cell => Math.hypot(cell.center.x-center.x,cell.center.y-center.y)>65);
        cell.owner.subhexSnapshot.cells[t.getSubhexEditorCellKey(cell)].settlement = {
          version:1,style:'village',density:100,seed:'legacy',dabs:[{x:0,y:0,r:1,paint:true}]
        };
        const legacyPlan = t.buildSubhexFeaturePlan([cell],metrics);
        if(legacyPlan.settlements?.length!==1) throw new Error('legacy painting lost from feature cache');
        const canvas = document.createElement('canvas'); canvas.width=canvas.height=100;
        t.renderSubhexTileFeatures(canvas.getContext('2d'),{
          left:cell.center.x-12,right:cell.center.x+12,top:cell.center.y-12,bottom:cell.center.y+12
        },{...legacyPlan,commands:[]},4);
        legacyRendered = canvas.getContext('2d').getImageData(0,0,100,100).data.some((v,i)=>i%4===3&&v>0);
        if(!legacyRendered) throw new Error('legacy painting rendered blank');
      }
      return {timings,coldRasterMs,warm1000Ms,retainedAfterRemoteEdit,unchangedPixels,nonblank,
        warmEditor100Ms,warmEditorRedraws,editorPixels,legacyRendered,waterAvoided,waterMaskUnion,
        savedWaterRetained,neighborWaterVisible,waterfrontFollowed,
        buildings:plan.buildings.length, lanes:plan.lanes.length,layout,pixels,
        memory:t.getRendererCacheMemory()};
    });
    assert(result.nonblank && result.unchangedPixels);
    assert(result.waterAvoided,'settlement buildings overlapped painted water');
    assert(result.waterMaskUnion,'overlapping water dabs exposed settlement texture');
    assert(result.savedWaterRetained,'starting a water edit discarded saved water');
    assert(result.neighborWaterVisible,'neighboring saved water was absent from the editor composition');
    assert(result.waterfrontFollowed,'long settlement water failed to generate a waterfront lane');
    if(!process.env.MAP_PERF_SOURCE) {
      assert(result.retainedAfterRemoteEdit,'unrelated edit rebuilt a settlement raster');
      assert.equal(result.warmEditorRedraws,0,'unchanged editor repainted');
    }
    assert.deepEqual(errors, []);
    const output = process.env.MAP_PERF_OUTPUT;
    if(output) fs.writeFileSync(output,JSON.stringify(result));
    if(process.env.MAP_PERF_COMPARE) {
      const before = JSON.parse(fs.readFileSync(process.env.MAP_PERF_COMPARE,'utf8'));
      assert.equal(result.layout,before.layout,'settlement geometry changed');
      assert.equal(result.pixels,before.pixels,'settlement pixels changed');
      if(before.editorPixels) assert.equal(result.editorPixels,before.editorPixels,'editor pixels changed');
      assert(result.retainedAfterRemoteEdit,'unrelated edit rebuilt a settlement raster');
    }
    delete result.layout; delete result.pixels; delete result.editorPixels;
    console.log(JSON.stringify(result,null,2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
const runner = new Module(__filename, module);
runner.filename = __filename;
runner.paths = module.paths;
runner._compile(bootstrap + checks, __filename);
