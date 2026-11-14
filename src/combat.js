import * as THREE from 'three';
import { EVENTS } from './config.js';
import { save, player, runtime, getCurrentRole, getDamageMultiplier, addScoreAndMoney, emit } from './state.js';
import { worldShootables } from './world.js';
import { createWeaponModel, getWeaponGroup, spawnParticles, updateWeaponVisuals, updateParticles } from './combat-effects.js';

export { spawnParticles };

const raycaster = new THREE.Raycaster();
const centerPoint = new THREE.Vector2(0, 0);
const tmpForward = new THREE.Vector3();
let damageFlashTimer = null;

export function initCombat(scene, camera) {
  if (!camera) return;
  if (scene && !camera.parent) scene.add(camera);
  const existing = getWeaponGroup();
  if (existing && existing.parent) existing.parent.remove(existing);
  camera.add(createWeaponModel());
}

function collectEntityShootables(entitiesApi) {
  const list = [];
  if (!entitiesApi) return list;
  const addFrom = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const m = item?.hitMesh || item?.mesh || item;
      if (m && m.isObject3D && m.visible) list.push(m);
    }
  };
  addFrom(entitiesApi.targetHitMeshes);
  addFrom(entitiesApi.droneHitMeshes);
  addFrom(entitiesApi.borderTransmitters);
  return list;
}

function findMatchingEntry(hitObj, entitiesApi) {
  let curr = hitObj;
  while (curr) {
    const ud = curr.userData || {};
    if (ud.isTransmitter || ud.transmitter || ud.transmitterObj) {
      return { kind: 'transmitter', obj: ud.transmitter || ud.transmitterObj || curr };
    }
    if (ud.isDrone || ud.drone || ud.droneObj) {
      return { kind: 'drone', obj: ud.drone || ud.droneObj || curr };
    }
    if (ud.target || ud.targetObj) {
      return { kind: 'target', obj: ud.target || ud.targetObj };
    }
    if (entitiesApi?.borderTransmitters) {
      const t = entitiesApi.borderTransmitters.find((x) => x.mesh === curr || x.hitMesh === curr);
      if (t) return { kind: 'transmitter', obj: t };
    }
    if (entitiesApi?.drones) {
      const d = entitiesApi.drones.find((x) => x.mesh === curr || x.hitMesh === curr);
      if (d) return { kind: 'drone', obj: d };
    }
    if (entitiesApi?.rangeTargets) {
      const r = entitiesApi.rangeTargets.find((x) => x.mesh === curr || x.hitMesh === curr);
      if (r) return { kind: 'target', obj: r };
    }
    if (entitiesApi?.roemTargets) {
      const rt = entitiesApi.roemTargets.find((x) => x.mesh === curr || x.hitMesh === curr);
      if (rt) return { kind: 'target', obj: rt };
    }
    curr = curr.parent;
  }
  return { kind: 'target', obj: hitObj };
}

function clonePos(pos) {
  if (!pos) return null;
  return { x: pos.x, y: pos.y, z: pos.z };
}

export function damageEntity(entity, amount = 1, entitiesApi = null, missionsApi = null, scene = null, hitPos = null) {
  if (!entity) return false;
  const isTransmitter = entity.kind === 'transmitter' || Boolean(entity.isTransmitter);
  const pos = clonePos(hitPos || entity.pos || entity.mesh?.position || entity.group?.position);

  if (isTransmitter) {
    if (entity.destroyed) return false;
    spawnParticles(scene, pos, 0xff9f1c, 16);
    missionsApi?.onMissionDroneOrTransmitterHit?.(entity, entitiesApi);
    entity.destroyed = true;
    entity.active = false;
    if (entity.group) entity.group.visible = false;
    if (entity.hitMesh) entity.hitMesh.visible = false;
    emit('combat:transmitter_destroyed', {
      id: entity.id || null,
      kind: 'transmitter',
      pos,
      isTransmitter: true,
      missionTag: entity.missionTag || null,
      transmitter: entity
    });
    return true;
  }

  if (entity.destroyed) return false;
  spawnParticles(scene, pos, 0xff6b35, 16);
  const hadNumericHp = typeof entity.hp === 'number';
  const prevHp = hadNumericHp ? entity.hp : 1;
  const nextHp = prevHp - Math.max(1, amount);
  if (hadNumericHp) entity.hp = nextHp;

  if (prevHp > 0 && nextHp <= 0) {
    entitiesApi?.destroyDrone?.(entity, true);
    const baseScore = save.profile.roleId === 'rokhash' ? 32 : 25;
    addScoreAndMoney(baseScore, 15);
    emit(EVENTS.DRONE_DESTROYED, {
      id: entity.id || null,
      kind: 'drone',
      pos,
      isTransmitter: false,
      isMissionDrone: Boolean(entity.isMissionDrone),
      missionTag: entity.missionTag || null,
      drone: entity
    });
    missionsApi?.onMissionDroneOrTransmitterHit?.(entity, entitiesApi);
    return true;
  }
  return false;
}

export function killEntity(entity, entitiesApi = null, missionsApi = null, scene = null) {
  if (!entity) return false;
  const lethal = typeof entity.hp === 'number' && entity.hp > 0 ? entity.hp : 9999;
  return damageEntity(entity, lethal, entitiesApi, missionsApi, scene, null);
}

export function fireWeapon(camera, entitiesApi, missionsApi) {
  if (!runtime.isPlaying || runtime.isDead || runtime.shopOpen || runtime.enlistOpen || runtime.paused || runtime.modalOpen) return;
  if (player.carryingType) {
    emit(EVENTS.TOAST, { message: 'לא ניתן לירות בזמן נשיאת ציוד!' });
    return;
  }
  if (runtime.shootCooldown > 0) return;

  const role = getCurrentRole();
  let cooldown = 0.18 * (role.modifiers.fireCooldownMult || 1);
  if (save.gear.sight) cooldown *= 0.75;
  if (save.profile.roleId === 'roem' && runtime.abilityActiveLeft > 0) cooldown *= 0.5;
  runtime.shootCooldown = cooldown;

  let recoil = 0.25 * (role.modifiers.recoilMult || 1);
  if (save.gear.sight) recoil *= 0.6;
  if (save.profile.roleId === 'roem' && runtime.abilityActiveLeft > 0) recoil = 0;
  runtime.recoil = Math.min(0.4, runtime.recoil + recoil);
  runtime.muzzleTimer = 0.055;

  emit(EVENTS.WEAPON_FIRED, {});

  if (!camera) return;
  const maxRange = role.modifiers.weaponRange || 140;
  raycaster.setFromCamera(centerPoint, camera);
  raycaster.far = maxRange;

  let wallDist = maxRange;
  let wallPoint = null;
  if (worldShootables.length > 0) {
    const worldHits = raycaster.intersectObjects(worldShootables, false);
    if (worldHits.length > 0) {
      wallDist = worldHits[0].distance;
      wallPoint = worldHits[0].point;
    }
  }

  const candidateMeshes = collectEntityShootables(entitiesApi);
  const scene = camera.parent;
  if (candidateMeshes.length > 0) {
    const hits = raycaster.intersectObjects(candidateMeshes, true);
    const validHit = hits.find((h) => h.distance <= wallDist && h.object.visible);
    if (validHit) {
      const matched = findMatchingEntry(validHit.object, entitiesApi);
      if (matched.kind === 'drone' || matched.kind === 'transmitter') {
        damageEntity(matched.obj, 1, entitiesApi, missionsApi, scene, validHit.point);
        return;
      }
      spawnParticles(scene, validHit.point, 0xffd15c, 10);
      missionsApi?.onRangeTargetHit?.(matched.obj, entitiesApi);
      return;
    }
  }

  if (wallPoint) {
    spawnParticles(scene, wallPoint, 0xd8c89e, 6);
  }
}

export function triggerRoleAbility(entitiesApi) {
  if (!runtime.isPlaying || runtime.isDead || runtime.shopOpen || runtime.enlistOpen || runtime.paused || runtime.modalOpen) return;
  if (runtime.abilityCooldownLeft > 0) {
    emit(EVENTS.TOAST, { message: `היכולת בטעינה (${Math.ceil(runtime.abilityCooldownLeft)} ש׳)` });
    return;
  }

  const role = getCurrentRole();
  runtime.abilityCooldownLeft = role.abilityCooldown;
  runtime.abilityActiveLeft = role.abilityDuration || 0;

  if (role.id === 'doher') {
    let nearest = null;
    let bestDist = 35;
    if (Array.isArray(entitiesApi?.drones)) {
      for (const d of entitiesApi.drones) {
        if (d.destroyed) continue;
        const p = d.pos || d.mesh?.position;
        if (!p) continue;
        const dist = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
        if (dist <= bestDist) {
          bestDist = dist;
          nearest = d;
        }
      }
    }
    if (nearest) {
      const hitPos = clonePos(nearest.pos || nearest.mesh?.position);
      const scene = getWeaponGroup()?.parent?.parent;
      spawnParticles(scene, hitPos, 0xff5522, 22);
      entitiesApi.destroyDrone?.(nearest, true);
      addScoreAndMoney(30, 15);
      emit(EVENTS.DRONE_DESTROYED, {
        id: nearest.id || null,
        kind: 'drone',
        pos: hitPos,
        isTransmitter: false,
        isMissionDrone: Boolean(nearest.isMissionDrone),
        missionTag: nearest.missionTag || null,
        drone: nearest
      });
      emit(EVENTS.TOAST, { message: '💥 הפגזת סוללה! רחפן אויב הושמד!' });
    } else {
      const cam = getWeaponGroup()?.parent;
      if (cam) {
        cam.getWorldDirection(tmpForward);
        const blastPos = cam.position.clone().addScaledVector(tmpForward, 18);
        blastPos.y = Math.max(0.5, blastPos.y);
        spawnParticles(cam.parent, blastPos, 0xff7733, 18);
      }
      emit(EVENTS.TOAST, { message: '💥 הפגזת סוללה בוצעה בגזרה!' });
    }
  } else if (role.id === 'roem') {
    emit(EVENTS.TOAST, { message: '🔥 מטח מהיר פעיל ל-6 שניות — קצב אש כפול ואפס רתע!' });
  } else if (role.id === 'rokhash') {
    emit(EVENTS.TOAST, { message: '🛸 סריקת סקיילרק פעילה ל-8 שניות — איומים מסומנים במיני-מפה!' });
  } else if (role.id === 'mafik') {
    if (Array.isArray(entitiesApi?.drones)) {
      for (const d of entitiesApi.drones) {
        const p = d.pos || d.mesh?.position;
        if (!p) continue;
        const dist = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
        if (dist <= 30) {
          d.jammedTimer = 6;
          spawnParticles(getWeaponGroup()?.parent?.parent, p, 0x3c91a8, 10);
        }
      }
    }
    emit(EVENTS.TOAST, { message: '📡 שיבוש אלקטרוני הופעל ל-6 שניות בטווח 30 מ׳!' });
  }

  emit(EVENTS.ABILITY_USED, {
    roleId: role.id,
    abilityName: role.abilityName,
    duration: role.abilityDuration,
    cooldown: role.abilityCooldown
  });
}

export function applyDamage(rawDamage, entitiesApi) {
  if (runtime.isDead || !runtime.isPlaying) return;
  const dmg = Math.max(1, Math.round(rawDamage * getDamageMultiplier()));
  player.hp = Math.max(0, player.hp - dmg);

  const flash = document.getElementById('damage-flash');
  if (flash) {
    flash.classList.add('active');
    clearTimeout(damageFlashTimer);
    damageFlashTimer = setTimeout(() => flash.classList.remove('active'), 170);
  }

  emit(EVENTS.PLAYER_DAMAGED, { amount: dmg, hp: player.hp, maxHp: player.maxHp });

  if (player.hp <= 0) {
    runtime.isDead = true;
    runtime.isPlaying = false;
    player.carryingType = null;
    if (document.pointerLockElement && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {}
    }
    const deathModal = document.getElementById('death-modal');
    if (deathModal) {
      deathModal.classList.remove('hidden');
      deathModal.style.display = 'flex';
    }
    entitiesApi?.clearAllDrones?.();
    emit(EVENTS.PLAYER_DIED, {});
  }
}

export function updateCombat(dt, scene) {
  if (runtime.shootCooldown > 0) runtime.shootCooldown = Math.max(0, runtime.shootCooldown - dt);
  if (runtime.muzzleTimer > 0) runtime.muzzleTimer = Math.max(0, runtime.muzzleTimer - dt);
  if (runtime.recoil > 0) runtime.recoil = Math.max(0, runtime.recoil - dt * 2.4);
  if (runtime.abilityCooldownLeft > 0) runtime.abilityCooldownLeft = Math.max(0, runtime.abilityCooldownLeft - dt);
  if (runtime.abilityActiveLeft > 0) runtime.abilityActiveLeft = Math.max(0, runtime.abilityActiveLeft - dt);

  updateWeaponVisuals(dt);
  updateParticles(dt, scene);
}
