import { EVENTS, LANDMARKS, MISSIONS, stripKeyHints, getMissionsForRole } from './config.js';
import { save, player, runtime, on } from './state.js';
import { getActiveMissionRunner, getLeafState } from './campaign-objectives.js';

const RANGE_AREA = { x: 72, z: 0 };
const ITEM_NAMES = {
  sandbag: 'שק חול',
  shell: 'פגז 155 מ"מ',
  kitbag: 'קיטבג',
  ammoCrate: 'ארגז תחמושת',
  crate: 'ארגז'
};

let entities = null;
let cachedMarkers = null;
let cachedMarkerRole = '';
let cachedMarkerChapter = '';
let markerListenersBound = false;

function invalidateMarkers() {
  cachedMarkers = null;
}

function ensureMarkerListeners() {
  if (markerListenersBound) return;
  markerListenersBound = true;
  on(EVENTS.STATE_CHANGED, invalidateMarkers);
  on(EVENTS.ROLE_CHANGED, invalidateMarkers);
  on(EVENTS.ENLIST_COMPLETED, invalidateMarkers);
  on(EVENTS.MISSION_COMPLETED, invalidateMarkers);
  on(EVENTS.MISSION_UPDATED, invalidateMarkers);
  on(EVENTS.CHAPTER_CHANGED || 'campaign:chapter_changed', invalidateMarkers);
  on(EVENTS.OBJECTIVE_UPDATED || 'mission:objective_updated', invalidateMarkers);
}

export function bindTargetEntities(api) {
  entities = api;
  ensureMarkerListeners();
  invalidateMarkers();
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

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
  let x = 0;
  let z = 0;
  for (const p of pts) {
    x += p.pos.x;
    z += p.pos.z;
  }
  return { x: x / pts.length, z: z / pts.length };
}

function make(x, z, text, kind, missionId) {
  return { x, z, text, kind, missionId };
}

function activeLeaf() {
  const runner = getActiveMissionRunner();
  if (!runner || runner.completed) return null;
  const idx = runner.states.findIndex((s) => !s.done);
  if (idx < 0) return null;
  const top = runner.states[idx];
  return { runner, leaf: getLeafState(top) || top };
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
  if (type === 'shell' && entities?.doherBreech?.pos) {
    const b = entities.doherBreech.pos;
    return make(b.x, b.z, 'טען פגז 155 מ"מ לסדן הדוהר', 'carry-drop', 'doher_salvo');
  }
  return null;
}

function m1Target() {
  const activeId = save.activeMissionId;
  const camp = activeLeaf();
  const campDef = camp?.leaf?.def || null;
  const campShoot = campDef && campDef.type === 'shoot-targets' ? campDef : null;
  const allowsFlag = (id, campMatch = false) => !camp || activeId === id || campMatch;

  if (runtime.rangeActive && allowsFlag('range', Boolean(campShoot && campShoot.entityGroup !== 'roemTargets'))) {
    const area = centroidPos(entities?.rangeTargets, () => true) || RANGE_AREA;
    const id = campShoot && campShoot.entityGroup !== 'roemTargets' ? camp.runner.mission.id : 'range';
    return make(area.x, area.z, 'פגע במטרות המטווח החי', 'm1', id);
  }
  if (activeId === 'range' && LANDMARKS.rangeConsole) {
    return make(LANDMARKS.rangeConsole.x, LANDMARKS.rangeConsole.z, 'הפעל מטווח ירי חי', 'm1', 'range');
  }

  if (runtime.roemRapidActive && allowsFlag('roem_rapid', Boolean(campShoot && campShoot.entityGroup === 'roemTargets'))) {
    const fallback = { x: LANDMARKS.roemPos.x, z: LANDMARKS.roemPos.z - 53 };
    const area = centroidPos(entities?.roemTargets, (t) => !t.hit) || centroidPos(entities?.roemTargets, () => true) || fallback;
    const id = campShoot && campShoot.entityGroup === 'roemTargets' ? camp.runner.mission.id : 'roem_rapid';
    return make(area.x, area.z, 'פגע במטרות האש', 'm1', id);
  }
  if (activeId === 'roem_rapid') {
    const node = nearestPos(entities?.roemNodes, (n) => !n.calibrated);
    if (node) return make(node.x, node.z, 'כייל צומת בקרה', 'm1', 'roem_rapid');
  }

  if (activeId === 'patrol' || (!camp && !save.completed.patrol && runtime.patrolActive)) {
    const cp = entities?.checkpoints?.[runtime.patrolStep];
    if (cp) return make(cp.pos.x, cp.pos.z, `המשך אל: ${cp.label}`, 'm1', 'patrol');
  }

  if (activeId === 'base' && !save.completed.base) {
    const bag = nearestPos(entities?.sandbagPickups, (b) => b.id >= runtime.sandbagsPlaced);
    if (bag) return make(bag.x, bag.z, 'הרם שק חול לביצור השער', 'm1', 'base');
  }

  if (activeId === 'doher_salvo') {
    if (runtime.shellsLoaded >= 4 && entities?.doherBreech?.pos) {
      const b = entities.doherBreech.pos;
      return make(b.x, b.z, 'בצע ירי סוללתי ב"דוהר"', 'm1', 'doher_salvo');
    }
    const sh = nearestPos(entities?.shellPickups, (s) => s.id >= runtime.shellsLoaded);
    if (sh) return make(sh.x, sh.z, 'הרם פגז 155 מ"מ', 'm1', 'doher_salvo');
  }

  if (activeId === 'rokhash_recon' || (!camp && save.profile.roleId === 'rokhash' && !save.completed.rokhash_recon && runtime.uavLaunched)) {
    if (runtime.uavLaunched) {
      const tx = nearestPos(entities?.borderTransmitters, (t) => t.isRokhashBorder && !t.destroyed);
      if (tx) return make(tx.x, tx.z, 'השמד משדר אויב', 'm1', 'rokhash_recon');
    }
    const pad = entities?.uavPad?.pos;
    if (pad) return make(pad.x, pad.z, 'שגר כטמ"ם "סקיילרק"', 'm1', 'rokhash_recon');
  }

  if (activeId === 'mafik_radar' || (!camp && save.profile.roleId === 'mafik' && !save.completed.mafik_radar && runtime.radarWaveActive)) {
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
  if (!leaf) {
    const mp = mission.markerPos;
    return mp ? make(mp.x, mp.z, stripKeyHints(mission.title || 'משימה פעילה'), 'campaign', mission.id) : null;
  }
  const d = leaf.def;
  const pts = d.points || [];
  let pt = null;
  if (d.type === 'carry') {
    pt = player.carryingType ? pts[1] || pts[0] : pts[0];
  } else if (d.type === 'interact') {
    pt = pts.find((p, i) => !leaf.visited.has(String(p.id ?? `pt_${i}`))) || pts[0];
  } else if (pts.length) {
    pt = pts[Math.min(Math.floor(leaf.progress || 0), pts.length - 1)] || pts[0];
  }
  if (!pt) pt = mission.markerPos;
  if (!pt) return null;
  return make(pt.x, pt.z, stripKeyHints(d.label || mission.title || 'משימה פעילה'), 'campaign', mission.id);
}

export function getCurrentTarget() {
  return carryTarget() || m1Target() || campaignTarget();
}

export function getMapMarkers() {
  ensureMarkerListeners();
  const roleId = save.profile.roleId;
  const chapterId = save.chapterId;
  if (cachedMarkers && cachedMarkerRole === roleId && cachedMarkerChapter === chapterId) {
    return cachedMarkers;
  }
  const out = [];
  const seen = new Set();
  const add = (m) => {
    if (!m?.markerPos || seen.has(m.id) || save.completed[m.id]) return;
    seen.add(m.id);
    out.push({ x: m.markerPos.x, z: m.markerPos.z, missionId: m.id, kind: 'mission' });
  };
  for (const m of getMissionsForRole(roleId)) add(m);
  for (const m of Object.values(MISSIONS)) {
    if (!m?.chapterId || m.chapterId !== chapterId) continue;
    if (m.roleId && m.roleId !== 'all' && m.roleId !== roleId) continue;
    add(m);
  }
  cachedMarkers = out;
  cachedMarkerRole = roleId;
  cachedMarkerChapter = chapterId;
  return cachedMarkers;
}
