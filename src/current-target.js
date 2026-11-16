import { EVENTS, LANDMARKS, MISSIONS, stripKeyHints, getMissionsForRole } from './config.js';
import { save, player, runtime, on } from './state.js';
import { getActiveMissionRunner, getLeafState } from './campaign-objectives.js';
import { getCurrentMapId } from './world.js';
import { getMissionMapId } from './missions.js';
import { MAP_DEFS } from './world-layout.js';
import { getMapLabels } from './map-image.js';
import { getRoutineTarget } from './daily-routine.js';

const RANGE_AREA = { x: 72, z: 0 };
const RESERVE_MAPS = new Set(['zaura', 'beit_hillel', 'kadita']);
const LEGACY_MAPS = new Set(['shivta', 'yoav', 'line']);
const ITEM_NAMES = { sandbag: 'שק חול', shell: 'פגז 155 מ"מ', kitbag: 'קיטבג', ammoCrate: 'ארגז תחמושת', crate: 'ארגז' };

let entities = null;
let cachedMarkers = null;
let cachedMarkerRole = '';
let cachedMarkerChapter = '';
let cachedMarkerMap = '';
let markerListenersBound = false;
let traveledMapId = null;
let lastObservedMapId = '';

function invalidateMarkers() {
  cachedMarkers = null;
}

function clearTraveledMap() {
  if (getCurrentMapId() === 'shivta') traveledMapId = null;
}

function ensureMarkerListeners() {
  if (markerListenersBound) return;
  markerListenersBound = true;
  for (const ev of [EVENTS.STATE_CHANGED, EVENTS.ROLE_CHANGED, EVENTS.ENLIST_COMPLETED, EVENTS.MISSION_COMPLETED, EVENTS.MISSION_UPDATED, EVENTS.CHAPTER_CHANGED || 'campaign:chapter_changed', EVENTS.OBJECTIVE_UPDATED || 'mission:objective_updated']) {
    on(ev, invalidateMarkers);
  }
  for (const ev of [EVENTS.ROLE_CHANGED, EVENTS.ENLIST_COMPLETED, EVENTS.CHAPTER_CHANGED || 'campaign:chapter_changed']) {
    on(ev, clearTraveledMap);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('map:loaded', (e) => {
      const nextId = typeof e?.detail === 'string' ? e.detail : e?.detail?.mapId;
      traveledMapId = nextId || getCurrentMapId();
      lastObservedMapId = traveledMapId;
      invalidateMarkers();
    });
  }
}

ensureMarkerListeners();

export function bindTargetEntities(api) {
  entities = api;
  ensureMarkerListeners();
  invalidateMarkers();
}

const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const make = (x, z, text, kind, missionId) => ({ x, z, text, kind, missionId });

function nearestPos(list, pred) {
  let best = null;
  for (const item of list || []) {
    if (!pred(item)) continue;
    const d = distXZ(player.pos, item.pos);
    if (!best || d < best.d) best = { pos: item.pos, d };
  }
  return best ? best.pos : null;
}

function centroidPos(list, pred) {
  const pts = (list || []).filter(pred);
  if (!pts.length) return null;
  let x = 0, z = 0;
  for (const p of pts) { x += p.pos.x; z += p.pos.z; }
  return { x: x / pts.length, z: z / pts.length };
}

function activeLeaf() {
  const runner = getActiveMissionRunner();
  if (!runner || runner.completed || save.completed[runner.mission?.id]) return null;
  const top = runner.states.find((s) => !s.done);
  return top ? { runner, leaf: getLeafState(top) || top } : null;
}

function inferPointMapId(x, z, missionMapId) {
  if (RESERVE_MAPS.has(missionMapId)) return missionMapId;
  if (z < -215) return 'line';
  if (z <= -128 && x < -40) return 'yoav';
  return 'shivta';
}

function travelGateTarget(currentMap, targetMap, t) {
  const b = MAP_DEFS[currentMap]?.bounds;
  if (!b) return t;
  const [minX, maxX, minZ, maxZ] = b;
  const goNorth = RESERVE_MAPS.has(targetMap) && !RESERVE_MAPS.has(currentMap);
  const gz = goNorth ? minZ + 8 : maxZ - 8;
  const gx = Math.max(minX + 8, Math.min(maxX - 8, (minX + maxX) * 0.5));
  return make(gx, gz, t.text, t.kind, t.missionId);
}

function carryTarget() {
  const type = player.carryingType;
  if (!type) return null;
  const camp = activeLeaf();
  if (camp?.leaf?.def?.type === 'carry') {
    const pts = camp.leaf.def.points || [];
    const pt = pts[1] || pts[0];
    if (pt) return make(pt.x, pt.z, `הנח ${ITEM_NAMES[type] || 'את הציוד'} — ${pt.label || 'היעד'}`, 'carry-drop', camp.runner.mission.id);
  }
  if (type === 'sandbag' && !save.completed.base) {
    const drop = nearestPos(entities?.sandbagDrops, (d) => d.id >= runtime.sandbagsPlaced);
    if (drop) return make(drop.x, drop.z, 'הנח שק חול בעמדה הירוקה', 'carry-drop', 'base');
  }
  if (type === 'shell' && !save.completed.doher_salvo && entities?.doherBreech?.pos) {
    const b = entities.doherBreech.pos;
    return make(b.x, b.z, 'טען פגז 155 מ"מ לסדן הדוהר', 'carry-drop', 'doher_salvo');
  }
  return null;
}

function m1Target() {
  const activeId = save.activeMissionId;
  const camp = activeLeaf();
  const campDef = camp?.leaf?.def || null;
  const campShoot = campDef?.type === 'shoot-targets' ? campDef : null;
  const allowsFlag = (id, campMatch = false) => !camp || activeId === id || campMatch;

  if (runtime.rangeActive && !save.completed.range && allowsFlag('range', Boolean(campShoot && campShoot.entityGroup !== 'roemTargets'))) {
    const area = centroidPos(entities?.rangeTargets, () => true) || RANGE_AREA;
    return make(area.x, area.z, 'פגע במטרות המטווח החי', 'm1', campShoot && campShoot.entityGroup !== 'roemTargets' ? camp.runner.mission.id : 'range');
  }
  if (activeId === 'range' && !save.completed.range && LANDMARKS.rangeConsole) return make(LANDMARKS.rangeConsole.x, LANDMARKS.rangeConsole.z, 'הפעל מטווח ירי חי', 'm1', 'range');

  if (runtime.roemRapidActive && !save.completed.roem_rapid && allowsFlag('roem_rapid', Boolean(campShoot && campShoot.entityGroup === 'roemTargets'))) {
    const area = centroidPos(entities?.roemTargets, (t) => !t.hit) || centroidPos(entities?.roemTargets, () => true) || { x: LANDMARKS.roemPos.x, z: LANDMARKS.roemPos.z - 53 };
    return make(area.x, area.z, 'פגע במטרות האש', 'm1', campShoot && campShoot.entityGroup === 'roemTargets' ? camp.runner.mission.id : 'roem_rapid');
  }
  if (activeId === 'roem_rapid' && !save.completed.roem_rapid) {
    const node = nearestPos(entities?.roemNodes, (n) => !n.calibrated);
    if (node) return make(node.x, node.z, 'כייל צומת בקרה', 'm1', 'roem_rapid');
  }
  if ((activeId === 'patrol' || (!camp && !save.completed.patrol && runtime.patrolActive)) && !save.completed.patrol) {
    const cp = entities?.checkpoints?.[runtime.patrolStep];
    if (cp) return make(cp.pos.x, cp.pos.z, `המשך אל: ${cp.label}`, 'm1', 'patrol');
  }
  if (activeId === 'base' && !save.completed.base) {
    const bag = nearestPos(entities?.sandbagPickups, (b) => b.id >= runtime.sandbagsPlaced);
    if (bag) return make(bag.x, bag.z, 'הרם שק חול לביצור השער', 'm1', 'base');
  }
  if (activeId === 'doher_salvo' && !save.completed.doher_salvo) {
    if (runtime.shellsLoaded >= 4 && entities?.doherBreech?.pos) return make(entities.doherBreech.pos.x, entities.doherBreech.pos.z, 'בצע ירי סוללתי ב"דוהר"', 'm1', 'doher_salvo');
    const sh = nearestPos(entities?.shellPickups, (s) => s.id >= runtime.shellsLoaded);
    if (sh) return make(sh.x, sh.z, 'הרם פגז 155 מ"מ', 'm1', 'doher_salvo');
  }
  if ((activeId === 'rokhash_recon' || (!camp && save.profile.roleId === 'rokhash' && !save.completed.rokhash_recon && runtime.uavLaunched)) && !save.completed.rokhash_recon) {
    if (runtime.uavLaunched) {
      const tx = nearestPos(entities?.borderTransmitters, (t) => t.isRokhashBorder && !t.destroyed);
      if (tx) return make(tx.x, tx.z, 'השמד משדר אויב', 'm1', 'rokhash_recon');
    }
    if (entities?.uavPad?.pos) return make(entities.uavPad.pos.x, entities.uavPad.pos.z, 'שגר כטמ"ם "סקיילרק"', 'm1', 'rokhash_recon');
  }
  if ((activeId === 'mafik_radar' || (!camp && save.profile.roleId === 'mafik' && !save.completed.mafik_radar && runtime.radarWaveActive)) && !save.completed.mafik_radar) {
    if (runtime.radarWaveActive) {
      const drone = nearestPos(entities?.drones, (d) => d.isMissionDrone && !d.destroyed && !(typeof d.hp === 'number' && d.hp <= 0));
      if (drone) return make(drone.x, drone.z, 'יירט רחפני תצפית עוינים', 'm1', 'mafik_radar');
    }
    const dish = nearestPos(entities?.radarDishes, (d) => !d.calibrated);
    if (dish) return make(dish.x, dish.z, 'כייל אנטנת מכ"ם', 'm1', 'mafik_radar');
  }
  return null;
}

function campaignTarget() {
  const camp = activeLeaf();
  if (!camp) return null;
  const { runner, leaf } = camp;
  const mission = runner.mission;
  if (!leaf) return mission.markerPos ? make(mission.markerPos.x, mission.markerPos.z, stripKeyHints(mission.title || 'משימה פעילה'), 'campaign', mission.id) : null;
  const d = leaf.def;
  const pts = d.points || [];
  let pt = null;
  if (d.type === 'carry') pt = player.carryingType ? pts[1] || pts[0] : pts[0];
  else if (d.type === 'interact') pt = pts.find((p, i) => !leaf.visited.has(String(p.id ?? `pt_${i}`))) || pts[0];
  else if (pts.length) pt = pts[Math.min(Math.floor(leaf.progress || 0), pts.length - 1)] || pts[0];
  if (!pt) pt = mission.markerPos;
  return pt ? make(pt.x, pt.z, stripKeyHints(d.label || mission.title || 'משימה פעילה'), 'campaign', mission.id) : null;
}

export function hasRemainingMissions() {
  const runner = getActiveMissionRunner();
  if (runner && !runner.completed && !save.completed[runner.mission?.id]) return true;
  if (save.activeMissionId && MISSIONS[save.activeMissionId] && !save.completed[save.activeMissionId]) return true;
  if (runtime.rangeActive && !save.completed.range) return true;
  if (runtime.roemRapidActive && !save.completed.roem_rapid) return true;
  if (runtime.patrolActive && !save.completed.patrol) return true;
  const roleId = save.profile.roleId;
  const chapterId = save.chapterId;
  for (const m of getMissionsForRole(roleId)) {
    if (m && !save.completed[m.id]) return true;
  }
  for (const m of Object.values(MISSIONS)) {
    if (m && m.chapterId === chapterId && (!m.roleId || m.roleId === 'all' || m.roleId === roleId) && !save.completed[m.id]) return true;
  }
  return false;
}

export function getCurrentTarget() {
  ensureMarkerListeners();
  const currentMap = getCurrentMapId();
  if (lastObservedMapId && lastObservedMapId !== currentMap) traveledMapId = currentMap;
  lastObservedMapId = currentMap;
  if (currentMap !== 'shivta') traveledMapId = currentMap;

  const routineTarget = getRoutineTarget();
  if (routineTarget) return routineTarget;

  const t = carryTarget() || m1Target() || campaignTarget();
  if (t) {
    const m = MISSIONS[t.missionId];
    const targetMap = inferPointMapId(t.x, t.z, m ? getMissionMapId(m) : null);
    if (targetMap === currentMap || (LEGACY_MAPS.has(targetMap) && LEGACY_MAPS.has(currentMap))) return t;
    return travelGateTarget(currentMap, targetMap, t);
  }
  if (traveledMapId !== currentMap || !hasRemainingMissions()) return null;

  const markers = getMapMarkers();
  if (markers.length > 0) {
    let best = markers[0];
    let bestD = distXZ(player.pos, best);
    for (let i = 1; i < markers.length; i++) {
      const d = distXZ(player.pos, markers[i]);
      if (d < bestD) { best = markers[i]; bestD = d; }
    }
    const m = MISSIONS[best.missionId];
    return make(best.x, best.z, stripKeyHints(m?.title || 'משימה בגזרה'), 'mission', best.missionId);
  }

  const anyOnMap = [];
  for (const m of Object.values(MISSIONS)) {
    if (m?.markerPos && !save.completed[m.id] && getMissionMapId(m) === currentMap && (!m.roleId || m.roleId === 'all' || m.roleId === save.profile.roleId)) {
      anyOnMap.push(m);
    }
  }
  if (anyOnMap.length > 0) {
    let best = anyOnMap[0];
    let bestD = distXZ(player.pos, best.markerPos);
    for (let i = 1; i < anyOnMap.length; i++) {
      const d = distXZ(player.pos, anyOnMap[i].markerPos);
      if (d < bestD) { best = anyOnMap[i]; bestD = d; }
    }
    return make(best.markerPos.x, best.markerPos.z, stripKeyHints(best.title || 'משימה בגזרה'), 'mission', best.id);
  }

  const labels = getMapLabels(currentMap);
  const nonRegionLabels = labels.filter((l) => l.kind !== 'region');
  const landmarks = MAP_DEFS[currentMap]?.landmarks?.length
    ? MAP_DEFS[currentMap].landmarks
    : (nonRegionLabels.length ? nonRegionLabels : labels);
  if (landmarks.length > 0) {
    let best = landmarks[0];
    let bestD = distXZ(player.pos, best);
    for (let i = 1; i < landmarks.length; i++) {
      const d = distXZ(player.pos, landmarks[i]);
      if (d > bestD) { best = landmarks[i]; bestD = d; }
    }
    return make(best.x, best.z, best.text, 'landmark', null);
  }

  const b = MAP_DEFS[currentMap]?.bounds;
  if (b) {
    const corners = [
      { x: b[0] + 10, z: b[2] + 10 },
      { x: b[1] - 10, z: b[2] + 10 },
      { x: b[0] + 10, z: b[3] - 10 },
      { x: b[1] - 10, z: b[3] - 10 }
    ];
    let best = corners[0];
    let bestD = distXZ(player.pos, best);
    for (let i = 1; i < corners.length; i++) {
      const d = distXZ(player.pos, corners[i]);
      if (d > bestD) { best = corners[i]; bestD = d; }
    }
    return make(best.x, best.z, MAP_DEFS[currentMap]?.nameHe || 'גזרה', 'landmark', null);
  }
  return null;
}

export function getMapMarkers() {
  ensureMarkerListeners();
  const roleId = save.profile.roleId;
  const chapterId = save.chapterId;
  const mapId = getCurrentMapId();
  if (cachedMarkers && cachedMarkerRole === roleId && cachedMarkerChapter === chapterId && cachedMarkerMap === mapId) return cachedMarkers;
  const out = [];
  const seen = new Set();
  const add = (m) => {
    if (!m?.markerPos || seen.has(m.id) || save.completed[m.id] || getMissionMapId(m) !== mapId) return;
    seen.add(m.id);
    out.push({ x: m.markerPos.x, z: m.markerPos.z, missionId: m.id, kind: 'mission' });
  };
  for (const m of getMissionsForRole(roleId)) add(m);
  for (const m of Object.values(MISSIONS)) {
    if (m?.chapterId === chapterId && (!m.roleId || m.roleId === 'all' || m.roleId === roleId)) add(m);
  }
  cachedMarkers = out;
  cachedMarkerRole = roleId;
  cachedMarkerChapter = chapterId;
  cachedMarkerMap = mapId;
  return cachedMarkers;
}
