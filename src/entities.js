import * as THREE from 'three';
import { save, player, runtime } from './state.js';
import { LANDMARKS, ENEMY_TYPES } from './config.js';
import { MAP_DEFS } from './world-layout.js';
import { getTerrainHeight } from './world-terrain.js';
import {
  createDroneVisuals, createTransmitterEntry, createSandbagProps, createDoherProps,
  createRoemProps, createRokhashProps, createMafikProps, createRangeProps,
  createCheckpointProps, createReserveBatteryProps
} from './entity-props.js';

let sceneRef = null, entityGroup = null, activeMapId = 'shivta', droneSeq = 0, txSeq = 0;
const drones = [], droneHitMeshes = [], targetHitMeshes = [];
const sandbagPickups = [], sandbagDrops = [], shellPickups = [], roemNodes = [], roemTargets = [];
const borderTransmitters = [], radarDishes = [], rangeTargets = [], checkpoints = [];
const dummyObj = { visible: false, position: new THREE.Vector3(), rotation: new THREE.Euler() };
const dummyRing = { visible: false, position: new THREE.Vector3(), rotation: new THREE.Euler(), material: { color: new THREE.Color() } };
const doherBreech = { pos: { x: 0, y: -999, z: 0 }, ringMesh: dummyRing };
const uavPad = { pos: { x: 0, y: -999, z: 0 }, group: dummyObj, uavPlane: dummyObj, ringMesh: dummyRing };
let apiRef = null;

export function getDrones() { return drones; }

function syncEntityVisuals(api) {
  if (!api) return;
  api.syncSandbagVisuals();
  api.syncDoherVisuals();
  api.syncRoemVisuals();
  api.syncRokhashVisuals();
  api.syncMafikVisuals();
  api.syncCheckpointVisuals();
}

function disposeObjectTree(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData?.shared) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map && !m.map.userData?.shared) m.map.dispose();
        m.dispose();
      }
    }
  });
  if (typeof root.clear === 'function') root.clear();
}

function normalizeSpawnArgs(posOrOpts, secondArg) {
  const opts = posOrOpts && typeof posOrOpts === 'object' ? { ...posOrOpts } : {};
  if (typeof secondArg === 'boolean') opts.isMissionDrone = secondArg;
  else if (secondArg && typeof secondArg === 'object') Object.assign(opts, secondArg);
  const isMissionDrone = Boolean(opts.isMissionDrone || opts.missionTag || opts.type === 'mission');
  const enemyType = ENEMY_TYPES[opts.enemyType] ? opts.enemyType : (ENEMY_TYPES[opts.type] ? opts.type : 'attack_drone');
  const enemyDef = ENEMY_TYPES[enemyType];
  return {
    x: Number.isFinite(opts.x) ? opts.x : LANDMARKS.outpostCenter.x + (Math.random() - 0.5) * 34,
    y: Number.isFinite(opts.y) ? opts.y : 4.2 + Math.random() * 1.8,
    z: Number.isFinite(opts.z) ? opts.z : LANDMARKS.outpostCenter.z + 12 - Math.random() * 28,
    isMissionDrone,
    enemyType,
    type: opts.type || (isMissionDrone ? 'mission' : enemyType),
    missionTag: opts.missionTag || null,
    hp: typeof opts.hp === 'number' && opts.hp > 0 ? opts.hp : enemyDef.hp,
    speed: typeof opts.speed === 'number' && opts.speed > 0 ? opts.speed : (isMissionDrone ? 3.8 : enemyDef.speed)
  };
}

export function clearAllDrones() {
  for (const d of drones) {
    if (d.group?.parent) d.group.parent.remove(d.group);
    disposeObjectTree(d.group);
  }
  drones.length = 0;
  droneHitMeshes.length = 0;
}

export function spawnDrone(customPos = null, secondArg = false) {
  if (!sceneRef) return null;
  droneSeq += 1;
  const cfg = normalizeSpawnArgs(customPos, secondArg);
  const { group, hitMesh, eyeMat, rotors } = createDroneVisuals(cfg.isMissionDrone, cfg.enemyType);
  group.position.set(cfg.x, cfg.y, cfg.z);
  (entityGroup || sceneRef).add(group);
  const drone = {
    id: `drone_${droneSeq}`, kind: 'drone', enemyType: cfg.enemyType, type: cfg.type, missionTag: cfg.missionTag,
    hp: cfg.hp, maxHp: cfg.hp, isMissionDrone: cfg.isMissionDrone, destroyed: false,
    revealed: cfg.enemyType !== 'infiltrator', targetable: cfg.enemyType !== 'infiltrator',
    _countedMissionKill: false, _threatAlerted: false, baseY: cfg.y, phase: Math.random() * Math.PI * 2,
    speed: cfg.speed, attackCooldown: 1.6 + Math.random() * 1.2,
    pos: group.position, group, hitMesh, mesh: hitMesh, eyeMat, rotors
  };
  group.visible = drone.revealed;
  hitMesh.visible = drone.revealed;
  hitMesh.userData = { drone, droneObj: drone, isDrone: true };
  drones.push(drone);
  droneHitMeshes.push(hitMesh);
  return drone;
}

export function spawnTransmitter(posOrOpts = {}) {
  const parent = entityGroup || sceneRef;
  if (!parent) return null;
  txSeq += 1;
  const opts = posOrOpts && typeof posOrOpts === 'object' ? posOrOpts : {};
  const x = Number.isFinite(opts.x) ? opts.x : 0;
  const y = Number.isFinite(opts.y) ? opts.y : 0;
  const z = Number.isFinite(opts.z) ? opts.z : -15;
  const tr = createTransmitterEntry(parent, x, y, z, `tx_dyn_${txSeq}`, false, {
    isDynamic: true, missionTag: opts.missionTag || null
  });
  borderTransmitters.push(tr);
  return tr;
}

export function destroyDrone(drone) {
  if (!drone || drone.destroyed) return;
  drone.destroyed = true;
  drone._threatAlerted = false;
  if (drone.group?.parent) drone.group.parent.remove(drone.group);
  disposeObjectTree(drone.group);
  const idx = drones.indexOf(drone);
  if (idx !== -1) drones.splice(idx, 1);
  const hIdx = droneHitMeshes.indexOf(drone.hitMesh);
  if (hIdx !== -1) droneHitMeshes.splice(hIdx, 1);
}

export function rebuildEntitiesForMap(mapId) {
  activeMapId = mapId || 'shivta';
  if (!sceneRef || !entityGroup) return;
  clearAllDrones();
  disposeObjectTree(entityGroup);
  sandbagPickups.length = 0;
  sandbagDrops.length = 0;
  shellPickups.length = 0;
  roemNodes.length = 0;
  roemTargets.length = 0;
  borderTransmitters.length = 0;
  radarDishes.length = 0;
  rangeTargets.length = 0;
  targetHitMeshes.length = 0;
  checkpoints.length = 0;
  doherBreech.pos = { x: 0, y: -999, z: 0 };
  doherBreech.ringMesh = dummyRing;
  uavPad.pos = { x: 0, y: -999, z: 0 };
  uavPad.group = dummyObj;
  uavPad.uavPlane = dummyObj;
  uavPad.ringMesh = dummyRing;

  if (activeMapId === 'shivta') {
    const sb = createSandbagProps(entityGroup);
    sandbagPickups.push(...sb.sandbagPickups);
    sandbagDrops.push(...sb.sandbagDrops);
    const rg = createRangeProps(entityGroup, targetHitMeshes);
    rangeTargets.push(...rg.rangeTargets);
  } else if (activeMapId === 'line') {
    const dh = createDoherProps(entityGroup);
    shellPickups.push(...dh.shellPickups);
    Object.assign(doherBreech, dh.doherBreech);
    const rm = createRoemProps(entityGroup, targetHitMeshes);
    roemNodes.push(...rm.roemNodes);
    roemTargets.push(...rm.roemTargets);
    const rk = createRokhashProps(entityGroup);
    Object.assign(uavPad, rk.uavPad);
    borderTransmitters.push(...rk.borderTransmitters);
    const mf = createMafikProps(entityGroup);
    radarDishes.push(...mf.radarDishes);
    const cp = createCheckpointProps(entityGroup);
    checkpoints.push(...cp.checkpoints);
  } else if (activeMapId === 'zaura' || activeMapId === 'beit_hillel') {
    const guns = MAP_DEFS[activeMapId]?.guns || [];
    if (guns.length) createReserveBatteryProps(entityGroup, guns);
  }
  syncEntityVisuals(apiRef);
}

export function initEntities(scene) {
  sceneRef = scene;
  if (!entityGroup) {
    entityGroup = new THREE.Group();
    entityGroup.name = 'entity-props';
  }
  if (entityGroup.parent !== scene) scene.add(entityGroup);

  const syncSandbagVisuals = () => {
    const placed = save.completed.base ? 5 : runtime.sandbagsPlaced;
    sandbagPickups.forEach((b, i) => {
      b.taken = i < placed || (player.carryingType === 'sandbag' && i === placed);
      b.mesh.visible = !b.taken;
    });
    sandbagDrops.forEach((d, i) => {
      d.filled = i < placed;
      d.bagMesh.visible = d.filled;
      d.markerMesh.visible = !d.filled;
    });
  };
  const syncDoherVisuals = () => {
    const isDoher = save.profile.roleId === 'doher';
    shellPickups.forEach((s, i) => {
      s.taken = !isDoher || i < runtime.shellsLoaded || (player.carryingType === 'shell' && i === runtime.shellsLoaded);
      s.mesh.visible = !s.taken;
    });
    doherBreech.ringMesh.visible = isDoher;
    doherBreech.ringMesh.material.color.setHex(runtime.shellsLoaded >= 4 ? 0x4be37a : 0xffb838);
  };
  const syncRoemVisuals = () => {
    const isRoem = save.profile.roleId === 'roem';
    roemNodes.forEach((n) => {
      n.mesh.visible = isRoem;
      const col = n.calibrated ? 0x4be37a : 0xffa726;
      n.lamp.material.color.setHex(col);
      n.ringMesh.material.color.setHex(col);
    });
    roemTargets.forEach((t) => {
      const show = isRoem && runtime.roemRapidActive && !t.hit;
      t.active = show; t.group.visible = show; t.hitMesh.visible = show; t.group.position.y = show ? 0 : -12;
    });
  };
  const syncRokhashVisuals = () => {
    const isRok = save.profile.roleId === 'rokhash';
    uavPad.ringMesh.visible = isRok && !runtime.uavLaunched;
    uavPad.uavPlane.visible = isRok;
    if (!runtime.uavLaunched) { uavPad.uavPlane.position.set(0, 0.55, 0); uavPad.uavPlane.rotation.set(0, 0, 0); }
    borderTransmitters.forEach((tr) => {
      if (!tr.isRokhashBorder) return;
      const show = isRok && runtime.uavLaunched && !tr.destroyed;
      tr.active = show; tr.group.visible = show; tr.hitMesh.visible = show; tr.group.position.y = show ? 0 : -15;
    });
  };
  const syncMafikVisuals = () => {
    const isMafik = save.profile.roleId === 'mafik';
    radarDishes.forEach((d) => { d.group.visible = isMafik; d.ringMesh.material.color.setHex(d.calibrated ? 0x4be37a : 0xffb838); });
  };
  const resetRangeTargets = () => {
    for (const t of rangeTargets) { t.active = false; t.timer = 0; t.group.rotation.x = -Math.PI / 2; t.hitMesh.visible = false; }
  };
  const popRandomRangeTarget = () => {
    const inactive = rangeTargets.filter((t) => !t.active);
    if (!inactive.length) return null;
    const pick = inactive[Math.floor(Math.random() * inactive.length)];
    pick.active = true; pick.timer = 4.6; pick.group.rotation.x = 0; pick.hitMesh.visible = true;
    return pick;
  };
  const syncCheckpointVisuals = () => {
    checkpoints.forEach((cp, idx) => { const cur = idx === runtime.patrolStep; cp.ringMesh.visible = cur; cp.beaconMesh.visible = cur; });
  };

  apiRef = {
    sandbagPickups, sandbagDrops, syncSandbagVisuals, shellPickups, doherBreech, syncDoherVisuals,
    roemNodes, roemTargets, syncRoemVisuals, uavPad, borderTransmitters, syncRokhashVisuals,
    radarDishes, syncMafikVisuals, rangeTargets, targetHitMeshes, popRandomRangeTarget, resetRangeTargets,
    checkpoints, syncCheckpointVisuals, drones, droneHitMeshes, spawnDrone, spawnTransmitter, destroyDrone, clearAllDrones,
    get infiltrators() { return drones.filter((d) => d.enemyType === 'infiltrator'); }
  };
  rebuildEntitiesForMap(activeMapId);
  return apiRef;
}

export function updateEntities(dt, tSec, onPlayerHitByDrone) {
  if (runtime.paused || runtime.modalOpen) return;
  if (runtime.markedUntil > 0 && tSec >= runtime.markedUntil) runtime.markedUntil = 0;
  const isMarked = runtime.markedUntil > 0;
  if (apiRef) {
    if (runtime.uavLaunched) {
      const p = apiRef.uavPad.uavPlane;
      p.position.set(Math.cos(tSec * 1.1) * 14, 14 + Math.sin(tSec * 2) * 1.2, Math.sin(tSec * 1.1) * 14 - 28);
      p.rotation.y = -tSec * 1.1;
    }
    for (const d of apiRef.radarDishes) if (d.calibrated) d.dishMesh.rotation.y += dt * 1.8;
    if (runtime.rangeActive) {
      let activeCount = 0;
      for (const t of apiRef.rangeTargets) {
        if (!t.active) continue;
        t.timer -= dt;
        if (t.timer <= 0) { t.active = false; t.group.rotation.x = -Math.PI / 2; t.hitMesh.visible = false; }
        else activeCount += 1;
      }
      if (activeCount < 2) apiRef.popRandomRangeTarget();
    }
  }
  const jammed = save.profile.roleId === 'mafik' && runtime.abilityActiveLeft > 0;
  for (const d of drones) {
    for (const r of d.rotors) r.rotation.y += dt * 22;
    const dx = player.pos.x - d.pos.x, dz = player.pos.z - d.pos.z, dist = Math.hypot(dx, dz) || 1;
    const isJammed = jammed && dist < 30;
    const def = ENEMY_TYPES[d.enemyType] || ENEMY_TYPES.attack_drone;
    const isAttack = def.id !== 'recon_drone' && Boolean(def.dealsDamage);
    const aggroRange = isMarked && isAttack ? 120 : 90, speedMult = isMarked && isAttack ? 1.3 : 1;
    d.eyeMat.color.setHex(isJammed ? 0x4cc9ff : (d.isMissionDrone && def.id === 'attack_drone' ? 0xff9922 : def.hex));
    if (!isJammed && dist <= aggroRange) {
      if (dist > (def.dealsDamage ? 4.8 : 12)) {
        const s = Math.sin(tSec * 1.6 + d.phase) * 0.45;
        d.pos.x += ((dx / dist) + (-dz / dist) * s) * d.speed * speedMult * dt;
        d.pos.z += ((dz / dist) + (dx / dist) * s) * d.speed * speedMult * dt;
      }
      d.pos.y = getTerrainHeight(d.pos.x, d.pos.z) + d.baseY + Math.sin(tSec * 3.2 + d.phase) * 0.35;
      d.group.lookAt(player.pos.x, player.pos.y + 1.4, player.pos.z);
      if (dist < 17) {
        d.attackCooldown -= dt;
        if (d.attackCooldown <= 0) {
          d.attackCooldown = 2.4;
          if (def.dealsDamage) { runtime.pendingDamageSource = { x: d.pos.x, y: d.pos.y, z: d.pos.z }; onPlayerHitByDrone?.(def.damage, d.pos); runtime.pendingDamageSource = null; }
          else if (def.marksPlayer) runtime.markedUntil = tSec + 4;
        }
      }
    } else if (isJammed) d.pos.y = d.baseY + Math.sin(tSec * 14 + d.phase) * 0.08;
  }
}
