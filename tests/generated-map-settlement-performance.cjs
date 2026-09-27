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
  registerSubhexEditorRouteKeyAliases, getSubhexEditorRouteDraftPoints,
  buildSubhexEditorSnapshot,
  getSavedSubhexSettlements, getRendererCacheMemory, renderSubhexEditorCanvas,
  renderSubhexPreview, exportSubhexPng,
  buildSubhexFeaturePlan, renderSubhexTileFeatures, isPointBlockedBySubhexWater,
  buildSubhexSettlementWaterfrontLanes,
  buildSubhexSettlementBridgeLanes,
  drawSubhexSettlementBridgePaths,
  splitSubhexSettlementLanesAtRivers,
  clipSubhexSettlementAwayFromWater, ensureSubhexEditorWaterDabDrafts,
  getSubhexEditorContextWaterDabs, renderer,`);
bootstrap = bootstrap.replace('errors.push(error.message)', 'errors.push(error.stack || error.message)');
const checks = String.raw`
    await page.evaluate(value => {window.testBaselineSource=value;},Boolean(process.env.MAP_PERF_SOURCE));
    const result = await page.evaluate(async () => {
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
      const waterCacheHex = r.hexesById.get('20:20');
      const originalWaterCacheDabs = waterCacheHex.subhexSnapshot.water_dabs;
      waterCacheHex.subhexSnapshot.water_dabs = [
        {id:'water-cache-regression-0',x:center.x-18,y:center.y,r:16},
        {id:'water-cache-regression-1',x:center.x,y:center.y,r:16},
        {id:'water-cache-regression-2',x:center.x+18,y:center.y,r:16}
      ];
      const waterChangedRaster = t.getSavedSubhexSettlementRaster(settlement,metrics);
      const waterChangedRasterRebuilt = waterChangedRaster !== changed;
      waterCacheHex.subhexSnapshot.water_dabs = originalWaterCacheDabs;
      t.invalidateSubhexDetailForHex(waterCacheHex.id);
      r.drawing.subhexEditorHexId = '20:20';
      r.subhexEditorCanvas = document.createElement('canvas');
      r.subhexEditorCtx = r.subhexEditorCanvas.getContext('2d');
      r.subhexEditorStage = {getBoundingClientRect:()=>({width:400,height:300})};
      r.subhexEditorLayout = {transform:{scale:1,offsetX:200-center.x,offsetY:150-center.y}};
      const hex = r.hexesById.get('20:20');
      const routeEntry = {
        type:'road',stroke:'#654321',width:4,
        path:'M '+(center.x-180)+' '+center.y+' L '+(center.x+180)+' '+center.y
      };
      const routeBefore = t.getSubhexEditorRouteDescriptors(hex,[routeEntry])[0];
      const routeAfter = t.getSubhexEditorRouteDescriptors(hex,[{
        type:'path',stroke:'#222',width:2,
        path:'M '+center.x+' '+(center.y-180)+' L '+center.x+' '+(center.y+180)
      },routeEntry]).find(route => route.entry === routeEntry);
      const stableRouteKey = routeBefore?.key === routeAfter?.key;
      const originalRouteAnchors = hex.subhexSnapshot.anchors;
      const legacyRouteKey = 'route:'+hex.id+':0:'+routeBefore.legacyHash;
      const legacyRoutePoints = [
        {x:center.x-30,y:center.y-18,position:0.4},
        {x:center.x+30,y:center.y+18,position:0.6}
      ];
      hex.subhexSnapshot.anchors = {...originalRouteAnchors,[legacyRouteKey]:{points:legacyRoutePoints}};
      t.registerSubhexEditorRouteKeyAliases(hex,[routeBefore]);
      const legacyRouteRecovered = t.getSubhexEditorRouteDraftPoints(routeBefore.key,hex,true).length === 2;
      const migratedRouteAnchors = t.buildSubhexEditorSnapshot(hex,[]).anchors;
      const legacyRouteMigrated = Boolean(migratedRouteAnchors[routeBefore.key])
        && !migratedRouteAnchors[legacyRouteKey];
      hex.subhexSnapshot.anchors = originalRouteAnchors;
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
      const waterfrontAccessed = waterPlan.lanes.some(lane => lane.waterAccess && lane.points.length>=3);
      const riverPoints = Array.from({length:15},(_,index)=>({
        x:center.x-105+index*15,
        y:center.y+Math.sin(index/3)*18
      }));
      let riverfrontFollowed = false;
      for(let seedIndex=0;seedIndex<20 && !riverfrontFollowed;seedIndex++) {
        riverfrontFollowed = t.buildSubhexSettlementWaterfrontLanes(
          {...settlement,seed:'riverfront-'+seedIndex},[],metrics,[{
            points:riverPoints,type:'river',routeId:'test-river',width:18
          }]
        ).some(lane => lane.waterSourceType==='river' && lane.points.length>=3);
      }
      const tightPaintedDabs = Array.from({length:41},(_,index)=>({
        id:'water-stroke-tight-'+index.toString(36),
        x:center.x-100+index*5,
        y:center.y+Math.sin(index/5)*10,
        r:8
      }));
      let tightPaintedFollowed = false;
      for(let seedIndex=0;seedIndex<20 && !tightPaintedFollowed;seedIndex++) {
        tightPaintedFollowed = t.buildSubhexSettlementWaterfrontLanes(
          {...settlement,seed:'painted-front-'+seedIndex},tightPaintedDabs,metrics,[]
        ).some(lane => lane.waterSourceType==='painted' && lane.points.length>=3);
      }
      const bridgeSeedLane = plan.lanes.find(lane => !lane.waterfront && lane.points.length >= 3);
      const bridgeSeedIndex = Math.floor(bridgeSeedLane.points.length / 2);
      const bridgeSeedPoint = bridgeSeedLane.points[bridgeSeedIndex];
      const bridgePreviousPoint = bridgeSeedLane.points[Math.max(0, bridgeSeedIndex - 1)];
      const bridgeAngle = Math.atan2(
        bridgeSeedPoint.y - bridgePreviousPoint.y,
        bridgeSeedPoint.x - bridgePreviousPoint.x
      ) + Math.PI / 2;
      r.drawing.subhexEditorWaterDabDrafts = Array.from({length:7},(_,index)=>( {
        id:'bridge-water-'+index.toString(36),
        x:bridgeSeedPoint.x+Math.cos(bridgeAngle)*(index-3)*6,
        y:bridgeSeedPoint.y+Math.sin(bridgeAngle)*(index-3)*6,
        r:10
      }));
      r.subhexSettlementPlanCache = new Map();
      const bridgePlan = t.getSubhexOrganicSettlementPlan(settlement,metrics,{editor:true});
      const bridgeCount = bridgePlan.lanes.filter(lane => lane.bridge && lane.points.length>=3).length;
      const guaranteedBridgeCount = t.buildSubhexSettlementBridgeLanes(
        {...settlement,style:'village',roadDensity:0,seed:'guaranteed-bridge'},
        [{points:[
          {x:center.x-metrics.radius*1.2,y:center.y},{x:center.x-metrics.radius*0.6,y:center.y},
          {x:center.x,y:center.y},{x:center.x+metrics.radius*0.6,y:center.y},
          {x:center.x+metrics.radius*1.2,y:center.y}
        ],type:'brown'}],
        [{id:'guaranteed-water',x:center.x,y:center.y,r:metrics.radius*0.35}],metrics
      ).length;
      const riverBridgeSettlement = {
        ...settlement,style:'city',roadDensity:0,seed:'guaranteed-river-bridge',
        points:[{x:10,y:10},{x:90,y:10},{x:90,y:90},{x:10,y:90}]
      };
      const guaranteedRiverBridges = t.buildSubhexSettlementBridgeLanes(
        riverBridgeSettlement,
        [{points:[{x:15,y:50},{x:35,y:50},{x:50,y:50},{x:65,y:50},{x:85,y:50}],type:'brown'}],
        [],metrics,[{points:[{x:47,y:15},{x:47,y:85}],type:'river',routeId:'river-test',width:8}]
      );
      const guaranteedRiverBridgeCount = guaranteedRiverBridges
        .filter(lane=>lane.waterSourceType==='river').length;
      const splitRiverApproaches = t.splitSubhexSettlementLanesAtRivers(
        [{points:[{x:15,y:50},{x:35,y:50},{x:50,y:50},{x:65,y:50},{x:85,y:50}],type:'brown'}],
        [{points:[{x:47,y:15},{x:47,y:85}],type:'river',routeId:'river-test',width:8}],metrics
      );
      const riverLaneStoppedAtBanks = splitRiverApproaches.length === 2
        && splitRiverApproaches.every(lane=>lane.riverApproach && lane.points.length>=2);
      const riverBridgeCanvas = document.createElement('canvas');
      riverBridgeCanvas.width = riverBridgeCanvas.height = 100;
      const riverBridgeCtx = riverBridgeCanvas.getContext('2d');
      riverBridgeCtx.strokeStyle = '#2d93b8';
      riverBridgeCtx.lineWidth = 8;
      riverBridgeCtx.beginPath(); riverBridgeCtx.moveTo(47,15); riverBridgeCtx.lineTo(47,85); riverBridgeCtx.stroke();
      const riverBeforeBridge = riverBridgeCanvas.toDataURL();
      t.drawSubhexSettlementBridgePaths(riverBridgeCtx,riverBridgeSettlement,metrics,{lanes:guaranteedRiverBridges},{riverOnly:true});
      const riverBridgeAboveWater = riverBridgeCanvas.toDataURL() !== riverBeforeBridge;
      const continuedBridgeLanes = t.buildSubhexSettlementBridgeLanes(
        {...riverBridgeSettlement,seed:'continued-bridge-route'},
        [
          {points:[{x:20,y:40},{x:30,y:40},{x:40,y:40},{x:57,y:40},{x:80,y:40}],type:'brown'},
          {points:[{x:20,y:70},{x:35,y:70},{x:50,y:70},{x:80,y:70}],type:'brown'}
        ],
        [{id:'continued-water',x:30,y:40,r:8}],metrics,
        [{points:[{x:52,y:15},{x:52,y:85}],type:'river',routeId:'continued-river',width:8}]
      );
      const bridgeRouteContinuesAcrossRiver = continuedBridgeLanes.some(lane => (
        lane.waterSourceType==='painted' && lane.sourceLaneIndex===0
      )) && continuedBridgeLanes.some(lane => (
        lane.waterSourceType==='river' && lane.sourceLaneIndex===0
      ));
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
      r.root.hidden = false;
      const originalRequestAnimationFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0;
      let exportDownloadTriggered = false;
      HTMLAnchorElement.prototype.click = () => { exportDownloadTriggered = true; };
      const subhexExport = await t.exportSubhexPng('20:20', {
        scale: 4, grid: true, labels: true, pois: true
      });
      window.requestAnimationFrame = originalRequestAnimationFrame;
      r.root.hidden = true;
      const subhexExportValid = exportDownloadTriggered
        && subhexExport.width === 2880 && subhexExport.height === 2560;
      return {timings,coldRasterMs,warm1000Ms,retainedAfterRemoteEdit,unchangedPixels,nonblank,
        warmEditor100Ms,warmEditorRedraws,editorPixels,legacyRendered,waterAvoided,waterMaskUnion,
        savedWaterRetained,neighborWaterVisible,waterfrontFollowed,waterfrontAccessed,riverfrontFollowed,
        tightPaintedFollowed,bridgeCount,guaranteedBridgeCount,guaranteedRiverBridgeCount,
        riverBridgeAboveWater,riverLaneStoppedAtBanks,bridgeRouteContinuesAcrossRiver,
        waterChangedRasterRebuilt,
        subhexExportValid,stableRouteKey,legacyRouteRecovered,legacyRouteMigrated,
        buildings:plan.buildings.length, lanes:plan.lanes.length,layout,pixels,
        memory:t.getRendererCacheMemory()};
    });
    assert(result.nonblank && result.unchangedPixels);
    assert(result.waterAvoided,'settlement buildings overlapped painted water');
    assert(result.waterMaskUnion,'overlapping water dabs exposed settlement texture');
    assert(result.savedWaterRetained,'starting a water edit discarded saved water');
    assert(result.neighborWaterVisible,'neighboring saved water was absent from the editor composition');
    assert(result.waterfrontFollowed,'long settlement water failed to generate a waterfront lane');
    assert(result.waterfrontAccessed,'waterfront lane was not connected to the settlement street network');
    assert(result.riverfrontFollowed,'drawn river produced no eligible waterfront lane');
    assert(result.tightPaintedFollowed,'closely spaced painted water produced no waterfront lane');
    assert(result.bridgeCount > 0,'dense city water produced no occasional bridge crossing');
    assert(result.guaranteedBridgeCount > 0,'eligible settlement water crossing produced no guaranteed bridge');
    assert(result.guaranteedRiverBridgeCount > 0,'eligible anchored river crossing produced no guaranteed bridge');
    assert(result.riverBridgeAboveWater,'anchored river rendered above its settlement bridge');
    assert(result.riverLaneStoppedAtBanks,'ordinary settlement lane did not stop at anchored river banks');
    assert(result.bridgeRouteContinuesAcrossRiver,'painted-water bridge route did not remain a bridge at the anchored river');
    assert(result.waterChangedRasterRebuilt,'painted water change reused a stale settlement raster');
    assert(result.subhexExportValid,'saved subhex PNG export did not complete at the expected size');
    assert(result.stableRouteKey,'route anchor key changed when unrelated routes were reordered');
    assert(result.legacyRouteRecovered,'legacy saved route anchors were not recovered');
    assert(result.legacyRouteMigrated,'legacy route anchors were not migrated on apply');
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
