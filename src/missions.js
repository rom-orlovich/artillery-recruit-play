import { LANDMARKS, MISSIONS, EVENTS, getMissionsForRole } from './config.js';
import { save, player, runtime, addScoreAndMoney, advanceDay, writeSave, emit, on } from './state.js';
import { getCurrentMapId } from './world.js';
import { getGunDrillInteraction, performGunDrillStep } from './fire-drill.js';
import { getRoutineInteraction, performRoutineStep } from './daily-routine.js';

const VALID_MAPS = new Set(['shivta', 'yoav', 'line', 'zaura', 'beit_hillel']);
let listenersBound = false;
let currentEntities = null;

function inferMapIdFromCoords(x, z) {
  if (z < -215) return 'line';
  if (z <= -128 && x < -40) return 'yoav';
  return 'shivta';
}

export function getMissionMapId(mission) {
  if (!mission) return 'shivta';
  if (VALID_MAPS.has(mission.mapId)) return mission.mapId;
  const pt = mission.startSpawn || mission.markerPos || mission.spawn;
  const mapId = pt && Number.isFinite(pt.x) && Number.isFinite(pt.z) ? inferMapIdFromCoords(pt.x, pt.z) : 'shivta';
  mission.mapId = mapId;
  return mapId;
}

for (const m of Object.values(MISSIONS)) if (m) m.mapId = getMissionMapId(m);

const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function syncAllVisuals(entitiesApi) {
  if (!entitiesApi) return;
  entitiesApi.syncSandbagVisuals?.();
  entitiesApi.syncDoherVisuals?.();
  entitiesApi.syncRoemVisuals?.();
  entitiesApi.syncRokhashVisuals?.();
  entitiesApi.syncMafikVisuals?.();
  entitiesApi.syncCheckpointVisuals?.();
  if (!runtime.rangeActive) entitiesApi.resetRangeTargets?.();
}

function resetProgressForRespawn(entitiesApi) {
  runtime.patrolActive = false;
  runtime.patrolStep = 0;
  if (runtime.uavLaunched && !save.completed.rokhash_recon) {
    runtime.uavLaunched = false;
    runtime.transmittersDestroyed = 0;
    entitiesApi?.borderTransmitters?.forEach((tr) => { tr.destroyed = false; });
  }
  if (runtime.radarWaveActive && !save.completed.mafik_radar) {
    runtime.radarWaveActive = false;
    runtime.radarDronesKilled = 0;
    runtime.radarCalibrated = 0;
    entitiesApi?.radarDishes?.forEach((d) => { d.calibrated = false; });
  }
  entitiesApi?.clearAllDrones?.();
  syncAllVisuals(entitiesApi);
}

export function completeMission(missionId) {
  const m = MISSIONS[missionId];
  if (!m) return;
  const firstTime = !save.completed[missionId];
  const moneyReward = firstTime ? m.moneyReward : Math.round(m.moneyReward * 0.25);
  const scoreReward = firstTime ? m.scoreReward : Math.round(m.scoreReward * 0.25);
  save.completed[missionId] = true;
  addScoreAndMoney(scoreReward, moneyReward);
  advanceDay(1);
  emit(EVENTS.MISSION_COMPLETED, { missionId, title: m.title, moneyReward, scoreReward, firstTime });
  emit(EVENTS.TOAST, { message: `${firstTime ? 'הושלמה משימה' : 'אימון חוזר הושלם'}: ${m.title} (+${moneyReward} ₪, +${scoreReward} נק׳)`, duration: 4200 });
}

export function initMissions(entitiesApi) {
  currentEntities = entitiesApi;
  Object.assign(runtime, {
    sandbagsPlaced: save.completed.base ? 5 : 0, rangeActive: false, rangeTimeLeft: 60, rangeHits: 0,
    shellsLoaded: 0, roemNodesCalibrated: 0, roemRapidActive: false, roemRapidTimeLeft: 45, roemRapidHits: 0,
    uavLaunched: false, transmittersDestroyed: 0, radarCalibrated: 0, radarWaveActive: false, radarDronesKilled: 0,
    patrolActive: false, patrolStep: 0
  });
  player.carryingType = null;
  if (entitiesApi) {
    entitiesApi.roemNodes?.forEach((n) => { n.calibrated = false; });
    entitiesApi.roemTargets?.forEach((t) => { t.hit = false; });
    entitiesApi.borderTransmitters?.forEach((tr) => { tr.destroyed = false; });
    entitiesApi.radarDishes?.forEach((d) => { d.calibrated = false; });
    syncAllVisuals(entitiesApi);
  }
  if (!listenersBound) {
    listenersBound = true;
    on(EVENTS.PLAYER_RESPAWNED, () => resetProgressForRespawn(currentEntities));
    on(EVENTS.ROLE_CHANGED, () => {
      player.carryingType = null;
      Object.assign(runtime, { shellsLoaded: 0, roemNodesCalibrated: 0, roemRapidActive: false, uavLaunched: false, radarCalibrated: 0, radarWaveActive: false });
      currentEntities?.roemNodes?.forEach((n) => { n.calibrated = false; });
      currentEntities?.roemTargets?.forEach((t) => { t.hit = false; });
      currentEntities?.borderTransmitters?.forEach((tr) => { tr.destroyed = false; });
      currentEntities?.radarDishes?.forEach((d) => { d.calibrated = false; });
      syncAllVisuals(currentEntities);
    });
    on(EVENTS.DRONE_DESTROYED, (p) => { if (p?.drone?.isMissionDrone) handleMissionDroneKill(p.drone, currentEntities); });
  }
}

function handleMissionDroneKill(drone, entitiesApi) {
  if (!drone || drone._countedMissionKill) return;
  drone._countedMissionKill = true;
  if (!runtime.radarWaveActive) return;
  runtime.radarDronesKilled += 1;
  emit(EVENTS.MISSION_UPDATED, { missionId: 'mafik_radar', progressText: `${runtime.radarDronesKilled}/3` });
  if (runtime.radarDronesKilled >= 3) {
    runtime.radarWaveActive = false;
    runtime.radarCalibrated = 0;
    entitiesApi?.radarDishes?.forEach((d) => { d.calibrated = false; });
    entitiesApi?.syncMafikVisuals?.();
    completeMission('mafik_radar');
  }
}

export function findNearbyInteraction(entitiesApi) {
  const candidates = [];
  const consider = (dist, maxR, type, label, target) => { if (dist <= maxR) candidates.push({ dist, type, label, target }); };
  if (getCurrentMapId() === 'shivta') {
    consider(distXZ(player.pos, LANDMARKS.shop), 4.3, 'shop', '[E] אפסנאות — קניית ציוד ומיגון', LANDMARKS.shop);
    consider(distXZ(player.pos, LANDMARKS.clinic), 3.4, 'clinic', '[E] מרפאה צבאית — טיפול וריפוי', LANDMARKS.clinic);
    consider(distXZ(player.pos, LANDMARKS.barracksA), 3.5, 'barracks', '[E] מגורי לוחמים — מסדר בוקר (+1 יום)', LANDMARKS.barracksA);
    if (!runtime.rangeActive) consider(distXZ(player.pos, LANDMARKS.rangeConsole), 3.8, 'start_range', '[E] הפעל מטווח ירי חי (60 ש׳)', LANDMARKS.rangeConsole);
  }
  if (entitiesApi) {
    if (player.carryingType === 'sandbag') {
      for (const drop of entitiesApi.sandbagDrops || []) if (!drop.filled) consider(distXZ(player.pos, drop.pos), 3.4, 'drop_sandbag', '[E] הנח שק חול בעמדת השער', drop);
    } else if (!player.carryingType && runtime.sandbagsPlaced < 5 && !save.completed.base) {
      for (const bag of entitiesApi.sandbagPickups || []) if (!bag.taken) consider(distXZ(player.pos, bag.pos), 3.2, 'pickup_sandbag', '[E] הרם שק חול לביצור השער', bag);
    }
    if (save.profile.roleId === 'doher' && entitiesApi.doherBreech?.pos) {
      if (player.carryingType === 'shell') consider(distXZ(player.pos, entitiesApi.doherBreech.pos), 3.8, 'load_shell', '[E] טען פגז 155 מ"מ לסדן הדוהר', entitiesApi.doherBreech);
      else if (!player.carryingType) {
        if (runtime.shellsLoaded < 4) { for (const sh of entitiesApi.shellPickups || []) if (!sh.taken) consider(distXZ(player.pos, sh.pos), 3.2, 'pickup_shell', '[E] הרם פגז 155 מ"מ', sh); }
        else consider(distXZ(player.pos, entitiesApi.doherBreech.pos), 3.8, 'fire_doher', '[E] בצע ירי סוללתי ב"דוהר"!', entitiesApi.doherBreech);
      }
    }
    if (save.profile.roleId === 'roem' && !runtime.roemRapidActive) {
      for (const node of entitiesApi.roemNodes || []) if (!node.calibrated) consider(distXZ(player.pos, node.pos), 3.5, 'calibrate_roem', '[E] כייל צומת בקרה (רועם)', node);
    }
    if (save.profile.roleId === 'rokhash' && !runtime.uavLaunched && entitiesApi.uavPad?.pos) {
      consider(distXZ(player.pos, entitiesApi.uavPad.pos), 3.8, 'launch_uav', '[E] שגר כטמ"ם "סקיילרק"', entitiesApi.uavPad);
    }
    if (save.profile.roleId === 'mafik' && !runtime.radarWaveActive) {
      for (const dish of entitiesApi.radarDishes || []) if (!dish.calibrated) consider(distXZ(player.pos, dish.pos), 3.5, 'calibrate_radar', '[E] כייל אנטנת מכ"ם "ר"ז"', dish);
    }
  }
  if (!player.carryingType) {
    const drill = getGunDrillInteraction(player.pos);
    if (drill) candidates.push(drill);
    const routine = getRoutineInteraction(player.pos);
    if (routine) candidates.push(routine);
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  const { type, label, shortLabel, target, taskId } = candidates[0];
  const result = shortLabel ? { type, label, shortLabel, target } : { type, label, target };
  if (taskId) result.taskId = taskId;
  return result;
}

export function handleInteract(entitiesApi, shopApi, combatApi) {
  const nearby = findNearbyInteraction(entitiesApi);
  if (!nearby) return;
  switch (nearby.type) {
    case 'shop': shopApi?.openShop?.(); break;
    case 'clinic':
      if (shopApi?.useClinic) shopApi.useClinic();
      else { player.hp = player.maxHp; writeSave(); emit(EVENTS.TOAST, { message: 'טופלת במרפאה הצבאית — הבריאות מלאה!', duration: 2800 }); }
      break;
    case 'barracks':
      if (shopApi?.performMorningInspection) shopApi.performMorningInspection();
      else { advanceDay(1); addScoreAndMoney(15, 0); emit(EVENTS.TOAST, { message: 'מסדר בוקר הושלם! +1 יום ו-+15 נק׳ משמעת.', duration: 2800 }); }
      break;
    case 'pickup_sandbag':
      player.carryingType = 'sandbag'; entitiesApi?.syncSandbagVisuals?.();
      emit(EVENTS.TOAST, { message: 'הנח את שק החול בעמדות הירוקות בשער הצפוני.', duration: 2600 }); writeSave(); break;
    case 'drop_sandbag':
      player.carryingType = null; runtime.sandbagsPlaced += 1; entitiesApi?.syncSandbagVisuals?.();
      emit(EVENTS.MISSION_UPDATED, { missionId: 'base', progressText: `${runtime.sandbagsPlaced}/5` });
      if (runtime.sandbagsPlaced >= 5) completeMission('base');
      else { emit(EVENTS.TOAST, { message: `הוצבו ${runtime.sandbagsPlaced}/5 שקי חול בשער.`, duration: 2400 }); writeSave(); }
      break;
    case 'start_range':
      runtime.rangeActive = true; runtime.rangeTimeLeft = 60; runtime.rangeHits = 0;
      entitiesApi?.resetRangeTargets?.(); entitiesApi?.popRandomRangeTarget?.(); entitiesApi?.popRandomRangeTarget?.();
      emit(EVENTS.MISSION_UPDATED, { missionId: 'range', progressText: '0/10' });
      emit(EVENTS.TOAST, { message: 'מטווח ירי חי פעיל! פגע ב-10 מטרות תוך 60 שניות!', duration: 3000 }); writeSave(); break;
    case 'pickup_shell':
      player.carryingType = 'shell'; entitiesApi?.syncDoherVisuals?.();
      emit(EVENTS.TOAST, { message: 'העמס את פגז ה-155 מ"מ לסדן תומ"ת ה"דוהר".', duration: 2500 }); writeSave(); break;
    case 'load_shell':
      player.carryingType = null; runtime.shellsLoaded += 1; entitiesApi?.syncDoherVisuals?.();
      emit(EVENTS.MISSION_UPDATED, { missionId: 'doher_salvo', progressText: `${runtime.shellsLoaded}/4` });
      emit(EVENTS.TOAST, { message: runtime.shellsLoaded >= 4 ? '4/4 פגזים נטענו! לחץ [E] לירי סוללתי!' : `נטענו ${runtime.shellsLoaded}/4 פגזי 155 מ"מ.`, duration: 2800 }); writeSave(); break;
    case 'fire_doher':
      runtime.shellsLoaded = 0; entitiesApi?.syncDoherVisuals?.();
      combatApi?.spawnParticles?.(null, { x: LANDMARKS.doherPos.x, y: 2.6, z: LANDMARKS.doherPos.z - 11 }, 0xffaa33, 22);
      completeMission('doher_salvo'); break;
    case 'calibrate_roem':
      nearby.target.calibrated = true; runtime.roemNodesCalibrated += 1; entitiesApi?.syncRoemVisuals?.();
      if (runtime.roemNodesCalibrated >= 3) {
        runtime.roemRapidActive = true; runtime.roemRapidTimeLeft = 45; runtime.roemRapidHits = 0;
        entitiesApi?.roemTargets?.forEach((t) => { t.hit = false; }); entitiesApi?.syncRoemVisuals?.();
        emit(EVENTS.TOAST, { message: 'צמתי הרועם כוילו! צא צפונה ופגע ב-6 מטרות אש תוך 45 שניות!', duration: 3800 });
      } else emit(EVENTS.TOAST, { message: `כוילו ${runtime.roemNodesCalibrated}/3 צמתי רועם.`, duration: 2400 });
      writeSave(); break;
    case 'launch_uav':
      runtime.uavLaunched = true; runtime.transmittersDestroyed = 0;
      entitiesApi?.borderTransmitters?.forEach((tr) => { tr.destroyed = false; }); entitiesApi?.syncRokhashVisuals?.();
      entitiesApi?.spawnDrone?.({ x: LANDMARKS.outpostCenter.x - 16, y: 5, z: LANDMARKS.outpostCenter.z + 4 }, false);
      entitiesApi?.spawnDrone?.({ x: LANDMARKS.outpostCenter.x + 16, y: 5.5, z: LANDMARKS.outpostCenter.z - 4 }, false);
      emit(EVENTS.MISSION_UPDATED, { missionId: 'rokhash_recon', progressText: '0/4' });
      emit(EVENTS.TOAST, { message: 'סקיילרק באוויר! השמד 4 משדרים כתומים לאורך גדר הצפון!', duration: 3600 }); writeSave(); break;
    case 'calibrate_radar':
      nearby.target.calibrated = true; runtime.radarCalibrated += 1; entitiesApi?.syncMafikVisuals?.();
      if (runtime.radarCalibrated >= 3) {
        runtime.radarWaveActive = true; runtime.radarDronesKilled = 0;
        entitiesApi?.spawnDrone?.({ x: LANDMARKS.mafikPos.x - 12, y: 4.8, z: LANDMARKS.mafikPos.z - 34 }, { isMissionDrone: true, enemyType: 'recon_drone' });
        entitiesApi?.spawnDrone?.({ x: LANDMARKS.mafikPos.x, y: 5.2, z: LANDMARKS.mafikPos.z - 40 }, { isMissionDrone: true, enemyType: 'recon_drone' });
        entitiesApi?.spawnDrone?.({ x: LANDMARKS.mafikPos.x + 12, y: 4.8, z: LANDMARKS.mafikPos.z - 34 }, { isMissionDrone: true, enemyType: 'recon_drone' });
        emit(EVENTS.TOAST, { message: 'מכ"ם ר"ז פעיל! יירט 3 רחפני תצפית עוינים מעל קו התומ"תים!', duration: 3600 });
      } else emit(EVENTS.TOAST, { message: `כוילו ${runtime.radarCalibrated}/3 אנטנות מכ"ם.`, duration: 2400 });
      writeSave(); break;
    case 'gun_drill': performGunDrillStep(); return true;
    case 'routine': performRoutineStep(nearby.taskId); return true;
  }
}

export function onRangeTargetHit(targetObj, entitiesApi) {
  if (!targetObj || !targetObj.active) return;
  if (targetObj.isRoemTarget) {
    if (!runtime.roemRapidActive) return;
    targetObj.active = false; targetObj.hit = true; targetObj.group.visible = false; targetObj.hitMesh.visible = false; targetObj.group.position.y = -12;
    runtime.roemRapidHits += 1;
    emit(EVENTS.RANGE_HIT, { targetId: targetObj.id, isRoemTarget: true });
    emit(EVENTS.MISSION_UPDATED, { missionId: 'roem_rapid', progressText: `${runtime.roemRapidHits}/6` });
    if (runtime.roemRapidHits >= 6) {
      runtime.roemRapidActive = false; runtime.roemNodesCalibrated = 0;
      entitiesApi?.roemNodes?.forEach((n) => { n.calibrated = false; }); entitiesApi?.syncRoemVisuals?.();
      completeMission('roem_rapid');
    } else writeSave();
    return;
  }
  if (!runtime.rangeActive) return;
  targetObj.active = false; targetObj.group.rotation.x = -Math.PI / 2; targetObj.hitMesh.visible = false;
  runtime.rangeHits += 1;
  emit(EVENTS.RANGE_HIT, { targetId: targetObj.id, isRoemTarget: false });
  emit(EVENTS.MISSION_UPDATED, { missionId: 'range', progressText: `${runtime.rangeHits}/10` });
  if (runtime.rangeHits >= 10) { runtime.rangeActive = false; entitiesApi?.resetRangeTargets?.(); completeMission('range'); }
  else { entitiesApi?.popRandomRangeTarget?.(); writeSave(); }
}

export function onMissionDroneOrTransmitterHit(hitObj, entitiesApi) {
  if (!hitObj) return;
  if (hitObj.isTransmitter) {
    if (!runtime.uavLaunched || hitObj.destroyed) return;
    hitObj.destroyed = true; hitObj.active = false; hitObj.group.visible = false; hitObj.hitMesh.visible = false; hitObj.group.position.y = -15;
    runtime.transmittersDestroyed += 1;
    emit(EVENTS.DRONE_DESTROYED, { pos: hitObj.pos, isTransmitter: true });
    emit(EVENTS.MISSION_UPDATED, { missionId: 'rokhash_recon', progressText: `${runtime.transmittersDestroyed}/4` });
    if (runtime.transmittersDestroyed >= 4) { runtime.uavLaunched = false; entitiesApi?.syncRokhashVisuals?.(); completeMission('rokhash_recon'); }
    else writeSave();
    return;
  }
  const drone = hitObj.droneObj || hitObj;
  if (drone && drone.isMissionDrone) handleMissionDroneKill(drone, entitiesApi);
}

export function updateMissions(dt, entitiesApi) {
  if (runtime.rangeActive && (runtime.rangeTimeLeft -= dt) <= 0) {
    runtime.rangeActive = false; runtime.rangeTimeLeft = 60; entitiesApi?.resetRangeTargets?.();
    emit(EVENTS.TOAST, { message: 'זמן המטווח תם! חזור לעמדת ההפעלה [E] לניסיון נוסף.', duration: 3200 }); writeSave();
  }
  if (runtime.roemRapidActive && (runtime.roemRapidTimeLeft -= dt) <= 0) {
    runtime.roemRapidActive = false; runtime.roemRapidTimeLeft = 45; runtime.roemNodesCalibrated = 0;
    entitiesApi?.roemNodes?.forEach((n) => { n.calibrated = false; }); entitiesApi?.roemTargets?.forEach((t) => { t.hit = false; });
    entitiesApi?.syncRoemVisuals?.(); emit(EVENTS.TOAST, { message: 'זמן ירי הרועם תם! כייל מחדש את הצמתים לניסיון נוסף.', duration: 3200 }); writeSave();
  }
  if (entitiesApi?.checkpoints?.length) {
    const cp = entitiesApi.checkpoints[runtime.patrolStep];
    if (cp && distXZ(player.pos, cp.pos) <= 3.6) {
      runtime.patrolActive = true; runtime.patrolStep += 1;
      emit(EVENTS.MISSION_UPDATED, { missionId: 'patrol', progressText: `${runtime.patrolStep}/4` });
      if (runtime.patrolStep >= 4) { runtime.patrolActive = false; runtime.patrolStep = 0; entitiesApi.syncCheckpointVisuals?.(); completeMission('patrol'); }
      else { entitiesApi.syncCheckpointVisuals?.(); emit(EVENTS.TOAST, { message: `נקודת סיור ${runtime.patrolStep}/4 הושלמה — המשך אל: ${entitiesApi.checkpoints[runtime.patrolStep].label}`, duration: 2800 }); writeSave(); }
    }
  }
  if (getCurrentMapId() === 'line' && (player.pos.z < LANDMARKS.outpostCenter.z + 34 || runtime.patrolActive)) {
    runtime.droneSpawnTimer -= dt;
    if (runtime.droneSpawnTimer <= 0) { runtime.droneSpawnTimer = 6.5; if ((entitiesApi?.drones?.length || 0) < 3) entitiesApi?.spawnDrone?.(null, false); }
  }
  if (getMissionsForRole(save.profile.roleId).length && save.rankId === 'turai' && save.score >= 400) addScoreAndMoney(0, 0);
}
