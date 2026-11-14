import { save, player, runtime } from './state.js';
import { LANDMARKS } from './config.js';
import { getTerrainHeight } from './world-terrain.js';
import {
  createDroneVisuals,
  createTransmitterEntry,
  createSandbagProps,
  createDoherProps,
  createRoemProps,
  createRokhashProps,
  createMafikProps,
  createRangeProps,
  createCheckpointProps
} from './entity-props.js';

let sceneRef = null;
let droneSeq = 0;
let txSeq = 0;

const drones = [];
const droneHitMeshes = [];
const targetHitMeshes = [];
let apiRef = null;

function normalizeSpawnArgs(posOrOpts, secondArg) {
  const opts = posOrOpts && typeof posOrOpts === 'object' ? { ...posOrOpts } : {};
  if (typeof secondArg === 'boolean') {
    opts.isMissionDrone = secondArg;
  } else if (secondArg && typeof secondArg === 'object') {
    Object.assign(opts, secondArg);
  }
  const hasX = typeof opts.x === 'number' && Number.isFinite(opts.x);
  const hasY = typeof opts.y === 'number' && Number.isFinite(opts.y);
  const hasZ = typeof opts.z === 'number' && Number.isFinite(opts.z);
  const isMissionDrone = Boolean(opts.isMissionDrone || opts.missionTag || opts.type === 'mission');
  const hp = typeof opts.hp === 'number' && opts.hp > 0 ? opts.hp : 2;
  const speed = typeof opts.speed === 'number' && opts.speed > 0 ? opts.speed : (isMissionDrone ? 3.8 : 4.4);
  return {
    x: hasX ? opts.x : LANDMARKS.outpostCenter.x + (Math.random() - 0.5) * 34,
    y: hasY ? opts.y : 4.2 + Math.random() * 1.8,
    z: hasZ ? opts.z : LANDMARKS.outpostCenter.z + 12 - Math.random() * 28,
    isMissionDrone,
    type: opts.type || (isMissionDrone ? 'mission' : 'patrol'),
    missionTag: opts.missionTag || null,
    hp,
    speed
  };
}

export function clearAllDrones() {
  for (const d of drones) {
    if (sceneRef && d.group) sceneRef.remove(d.group);
  }
  drones.length = 0;
  droneHitMeshes.length = 0;
}

export function spawnDrone(customPos = null, secondArg = false) {
  if (!sceneRef) return null;
  droneSeq += 1;
  const cfg = normalizeSpawnArgs(customPos, secondArg);
  const { group, hitMesh, eyeMat, rotors } = createDroneVisuals(cfg.isMissionDrone);
  group.position.set(cfg.x, cfg.y, cfg.z);
  sceneRef.add(group);

  const drone = {
    id: `drone_${droneSeq}`,
    kind: 'drone',
    type: cfg.type,
    missionTag: cfg.missionTag,
    hp: cfg.hp,
    maxHp: cfg.hp,
    isMissionDrone: cfg.isMissionDrone,
    destroyed: false,
    _countedMissionKill: false,
    baseY: cfg.y,
    phase: Math.random() * Math.PI * 2,
    speed: cfg.speed,
    attackCooldown: 1.6 + Math.random() * 1.2,
    pos: group.position,
    group,
    hitMesh,
    mesh: hitMesh,
    eyeMat,
    rotors
  };
  hitMesh.userData = { drone, droneObj: drone, isDrone: true };
  drones.push(drone);
  droneHitMeshes.push(hitMesh);
  return drone;
}

export function spawnTransmitter(posOrOpts = {}) {
  if (!sceneRef) return null;
  txSeq += 1;
  const opts = posOrOpts && typeof posOrOpts === 'object' ? posOrOpts : {};
  const x = typeof opts.x === 'number' && Number.isFinite(opts.x) ? opts.x : 0;
  const y = typeof opts.y === 'number' && Number.isFinite(opts.y) ? opts.y : 0;
  const z = typeof opts.z === 'number' && Number.isFinite(opts.z) ? opts.z : -15;
  const tr = createTransmitterEntry(sceneRef, x, y, z, `tx_dyn_${txSeq}`, false, {
    isDynamic: true,
    missionTag: opts.missionTag || null
  });
  if (apiRef?.borderTransmitters) {
    apiRef.borderTransmitters.push(tr);
  }
  return tr;
}

export function destroyDrone(drone) {
  if (!drone || drone.destroyed) return;
  drone.destroyed = true;
  if (sceneRef && drone.group) sceneRef.remove(drone.group);
  const idx = drones.indexOf(drone);
  if (idx !== -1) drones.splice(idx, 1);
  const hIdx = droneHitMeshes.indexOf(drone.hitMesh);
  if (hIdx !== -1) droneHitMeshes.splice(hIdx, 1);
}

export function initEntities(scene) {
  sceneRef = scene;
  clearAllDrones();
  targetHitMeshes.length = 0;

  const { sandbagPickups, sandbagDrops } = createSandbagProps(scene);
  const { shellPickups, doherBreech } = createDoherProps(scene);
  const { roemNodes, roemTargets } = createRoemProps(scene, targetHitMeshes);
  const { uavPad, borderTransmitters } = createRokhashProps(scene);
  const { radarDishes } = createMafikProps(scene);
  const { rangeTargets } = createRangeProps(scene, targetHitMeshes);
  const { checkpoints } = createCheckpointProps(scene);

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
      t.active = show;
      t.group.visible = show;
      t.hitMesh.visible = show;
      t.group.position.y = show ? 0 : -12;
    });
  };

  const syncRokhashVisuals = () => {
    const isRok = save.profile.roleId === 'rokhash';
    uavPad.ringMesh.visible = isRok && !runtime.uavLaunched;
    uavPad.uavPlane.visible = isRok;
    if (!runtime.uavLaunched) {
      uavPad.uavPlane.position.set(0, 0.55, 0);
      uavPad.uavPlane.rotation.set(0, 0, 0);
    }
    borderTransmitters.forEach((tr) => {
      if (!tr.isRokhashBorder) return;
      const show = isRok && runtime.uavLaunched && !tr.destroyed;
      tr.active = show;
      tr.group.visible = show;
      tr.hitMesh.visible = show;
      tr.group.position.y = show ? 0 : -15;
    });
  };

  const syncMafikVisuals = () => {
    const isMafik = save.profile.roleId === 'mafik';
    radarDishes.forEach((d) => {
      d.group.visible = isMafik;
      d.ringMesh.material.color.setHex(d.calibrated ? 0x4be37a : 0xffb838);
    });
  };

  const resetRangeTargets = () => {
    for (const t of rangeTargets) {
      t.active = false;
      t.timer = 0;
      t.group.rotation.x = -Math.PI / 2;
      t.hitMesh.visible = false;
    }
  };

  const popRandomRangeTarget = () => {
    const inactive = rangeTargets.filter((t) => !t.active);
    if (!inactive.length) return null;
    const pick = inactive[Math.floor(Math.random() * inactive.length)];
    pick.active = true;
    pick.timer = 4.6;
    pick.group.rotation.x = 0;
    pick.hitMesh.visible = true;
    return pick;
  };

  const syncCheckpointVisuals = () => {
    checkpoints.forEach((cp, idx) => {
      const isCurrent = idx === runtime.patrolStep;
      cp.ringMesh.visible = isCurrent;
      cp.beaconMesh.visible = isCurrent;
    });
  };

  apiRef = {
    sandbagPickups,
    sandbagDrops,
    syncSandbagVisuals,
    shellPickups,
    doherBreech,
    syncDoherVisuals,
    roemNodes,
    roemTargets,
    syncRoemVisuals,
    uavPad,
    borderTransmitters,
    syncRokhashVisuals,
    radarDishes,
    syncMafikVisuals,
    rangeTargets,
    targetHitMeshes,
    popRandomRangeTarget,
    resetRangeTargets,
    checkpoints,
    syncCheckpointVisuals,
    drones,
    droneHitMeshes,
    spawnDrone,
    spawnTransmitter,
    destroyDrone,
    clearAllDrones
  };
  return apiRef;
}

export function updateEntities(dt, tSec, onPlayerHitByDrone) {
  if (runtime.paused || runtime.modalOpen) return;

  if (apiRef) {
    if (runtime.uavLaunched) {
      const p = apiRef.uavPad.uavPlane;
      p.position.set(Math.cos(tSec * 1.1) * 14, 14 + Math.sin(tSec * 2) * 1.2, Math.sin(tSec * 1.1) * 14 - 28);
      p.rotation.y = -tSec * 1.1;
    }
    for (const d of apiRef.radarDishes) {
      if (d.calibrated) d.dishMesh.rotation.y += dt * 1.8;
    }
    if (runtime.rangeActive) {
      let activeCount = 0;
      for (const t of apiRef.rangeTargets) {
        if (!t.active) continue;
        t.timer -= dt;
        if (t.timer <= 0) {
          t.active = false;
          t.group.rotation.x = -Math.PI / 2;
          t.hitMesh.visible = false;
        } else {
          activeCount += 1;
        }
      }
      if (activeCount < 2) apiRef.popRandomRangeTarget();
    }
  }

  const jammed = save.profile.roleId === 'mafik' && runtime.abilityActiveLeft > 0;
  for (const d of drones) {
    for (const r of d.rotors) r.rotation.y += dt * 22;

    const dx = player.pos.x - d.pos.x;
    const dz = player.pos.z - d.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const isJammed = jammed && dist < 30;

    d.eyeMat.color.setHex(isJammed ? 0x4cc9ff : (d.isMissionDrone ? 0xff9922 : 0xff2f2f));

    if (!isJammed && dist < 90) {
      if (dist > 4.8) {
        const strafeX = -dz / dist;
        const strafeZ = dx / dist;
        const s = Math.sin(tSec * 1.6 + d.phase) * 0.45;
        d.pos.x += ((dx / dist) + strafeX * s) * d.speed * dt;
        d.pos.z += ((dz / dist) + strafeZ * s) * d.speed * dt;
      }
      d.pos.y = getTerrainHeight(d.pos.x, d.pos.z) + d.baseY + Math.sin(tSec * 3.2 + d.phase) * 0.35;
      d.group.lookAt(player.pos.x, player.pos.y + 1.4, player.pos.z);

      if (dist < 17) {
        d.attackCooldown -= dt;
        if (d.attackCooldown <= 0) {
          d.attackCooldown = 2.4;
          onPlayerHitByDrone?.(12);
        }
      }
    } else if (isJammed) {
      d.pos.y = d.baseY + Math.sin(tSec * 14 + d.phase) * 0.08;
    }
  }
}
