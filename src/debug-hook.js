import { EVENTS, ROLES } from './config.js';
import * as configMod from './config.js';
import * as stateMod from './state.js';
import { save, player, runtime, emit, on, syncDerivedStats } from './state.js';
import { getInput } from './controls.js';
import { savePlayerPosition, openModalByName, closeAllModals } from './modal-manager.js';

function getFallbackObjectiveState() {
  const missionId = save.activeMissionId || 'base';
  const m = configMod.MISSIONS?.[missionId];
  const map = {
    base: { stepProgress: runtime.sandbagsPlaced, targetCount: 5, timerRemainingSec: null },
    range: { stepProgress: runtime.rangeHits, targetCount: 10, timerRemainingSec: runtime.rangeActive ? runtime.rangeTimeLeft : null },
    doher_salvo: { stepProgress: runtime.shellsLoaded, targetCount: 4, timerRemainingSec: null },
    roem_rapid: { stepProgress: runtime.roemRapidHits, targetCount: 6, timerRemainingSec: runtime.roemRapidActive ? runtime.roemRapidTimeLeft : null },
    rokhash_recon: { stepProgress: runtime.transmittersDestroyed, targetCount: 4, timerRemainingSec: null },
    mafik_radar: { stepProgress: runtime.radarDronesKilled, targetCount: 3, timerRemainingSec: null },
    patrol: { stepProgress: runtime.patrolStep, targetCount: 4, timerRemainingSec: null }
  };
  const info = map[missionId] || { stepProgress: runtime.objectiveProgress || 0, targetCount: m?.targetCount || 0, timerRemainingSec: null };
  return {
    missionId,
    stepProgress: info.stepProgress,
    targetCount: info.targetCount,
    timerRemainingSec: info.timerRemainingSec,
    holdElapsedSec: 0,
    done: Boolean(save.completed?.[missionId])
  };
}

export function installDebugHook(ctx) {
  const { modules, camera, entitiesApi, onInteract, startGame, togglePause, setModalVisible, syncFallbackHUD } = ctx;
  const { campaign: campaignMod, entities: entitiesMod, combat: combatMod, missions: missionsMod, hud: hudMod } = modules;

  const counters = { droneDestroyed: 0, transmitterDestroyed: 0 };
  on(EVENTS.DRONE_DESTROYED, () => {
    counters.droneDestroyed += 1;
  });
  on('combat:transmitter_destroyed', () => {
    counters.transmitterDestroyed += 1;
  });

  window.__gameDebug = {
    ready: true,
    modules: {
      state: stateMod,
      config: configMod,
      campaign: campaignMod,
      entities: entitiesMod,
      combat: combatMod,
      missions: missionsMod,
      hud: hudMod
    },
    counters,
    enlist(roleId = 'doher') {
      const validRoleId = ROLES[roleId] ? roleId : 'doher';
      const role = ROLES[validRoleId];
      save.enlisted = true;
      save.profile.roleId = validRoleId;
      if ('role' in save) save.role = validRoleId;
      if (role?.battalion) save.profile.battalion = role.battalion;
      runtime.enlistOpen = false;
      runtime.titleActive = false;
      setModalVisible('title-screen', false);
      setModalVisible('enlist-modal', false);
      syncDerivedStats();
      emit(EVENTS.ROLE_CHANGED, { roleId: validRoleId, role });
      emit(EVENTS.ENLIST_COMPLETED, { save, roleId: validRoleId });
      stateMod.writeSave();
      if (!hudMod) syncFallbackHUD();
      startGame();
      return validRoleId;
    },
    teleport(x, z, yaw = 0, pitch = 0) {
      player.pos.x = x;
      player.pos.z = z;
      player.yaw = yaw;
      player.pitch = pitch;
      camera.position.set(player.pos.x, player.pos.y + player.eyeHeight, player.pos.z);
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
    },
    interact() {
      return onInteract();
    },
    startMission(missionId) {
      return campaignMod?.startCampaignMission?.(missionId) ?? false;
    },
    getObjectiveState() {
      return campaignMod?.getCampaignObjectiveState?.() || getFallbackObjectiveState();
    },
    completeCurrentMission() {
      if (campaignMod?.completeCurrentCampaignMission?.()) return true;
      const fallbackId = save.activeMissionId || 'base';
      if (missionsMod?.completeMission && configMod.MISSIONS?.[fallbackId]) {
        missionsMod.completeMission(fallbackId);
        return true;
      }
      return false;
    },
    spawnTestEntities() {
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      const dx = player.pos.x + fx * 15 - fz * 1.5;
      const dz = player.pos.z + fz * 15 + fx * 1.5;
      const tx = player.pos.x + fx * 15 + fz * 1.5;
      const tz = player.pos.z + fz * 15 - fx * 1.5;
      let drone = null;
      if (entitiesApi?.spawnDrone) {
        drone = entitiesApi.spawnDrone({ x: dx, y: 2.5, z: dz, isMissionDrone: true }, true)
          || entitiesApi.drones?.[entitiesApi.drones.length - 1]
          || null;
        if (drone) {
          drone.kind = 'drone';
          if (drone.pos) {
            drone.pos.x = dx;
            drone.pos.y = 2.5;
            drone.pos.z = dz;
          }
          if (drone.group) {
            drone.group.position.set(dx, 2.5, dz);
            drone.group.updateMatrixWorld?.(true);
          }
          if (drone.hitMesh) drone.hitMesh.updateMatrixWorld?.(true);
        }
      }
      let transmitter = null;
      if (typeof entitiesApi?.spawnTransmitter === 'function') {
        transmitter = entitiesApi.spawnTransmitter({ x: tx, y: 0, z: tz });
      } else if (entitiesApi?.borderTransmitters?.length) {
        transmitter = entitiesApi.borderTransmitters.find((t) => !t.destroyed) || entitiesApi.borderTransmitters[0];
        if (transmitter) {
          transmitter.destroyed = false;
          transmitter.active = true;
          transmitter.kind = 'transmitter';
          transmitter.isTransmitter = true;
          if (typeof transmitter.hp === 'number') transmitter.hp = transmitter.maxHp || 40;
          if (transmitter.pos) {
            transmitter.pos.x = tx;
            transmitter.pos.y = 0;
            transmitter.pos.z = tz;
          }
          if (transmitter.group) {
            transmitter.group.visible = true;
            transmitter.group.position.set(tx, 0, tz);
            transmitter.group.updateMatrixWorld?.(true);
          }
          if (transmitter.hitMesh) {
            transmitter.hitMesh.visible = true;
            transmitter.hitMesh.updateMatrixWorld?.(true);
          }
        }
      }
      return { drone, transmitter };
    },
    kill(entity) {
      if (!entity) return false;
      if (typeof combatMod?.damageEntity === 'function') {
        combatMod.damageEntity(entity, (entity.hp || 100) + 999, entitiesApi, missionsMod);
        return true;
      }
      if (!combatMod?.fireWeapon) return false;
      const basePos = entity.pos || entity.group?.position;
      if (!basePos) return false;
      if (entity.group) {
        entity.group.visible = true;
        entity.group.updateMatrixWorld?.(true);
      }
      if (entity.hitMesh) {
        entity.hitMesh.visible = true;
        entity.hitMesh.updateMatrixWorld?.(true);
      }
      const hx = entity.group ? entity.group.position.x + (entity.hitMesh?.position?.x || 0) : basePos.x;
      const hy = entity.group ? entity.group.position.y + (entity.hitMesh?.position?.y || 0) : basePos.y;
      const hz = entity.group ? entity.group.position.z + (entity.hitMesh?.position?.z || 0) : basePos.z;
      const savedPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      const savedYaw = camera.rotation.y;
      const savedPitch = camera.rotation.x;
      const savedCooldown = runtime.shootCooldown;
      const dx = hx - savedPos.x;
      const dy = hy - savedPos.y;
      const dz = hz - savedPos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 60 && dist > 0.001) {
        const scale = 10 / dist;
        camera.position.set(hx - dx * scale, hy - dy * scale, hz - dz * scale);
      }
      const adx = hx - camera.position.x;
      const ady = hy - camera.position.y;
      const adz = hz - camera.position.z;
      camera.rotation.y = Math.atan2(-adx, -adz);
      camera.rotation.x = Math.atan2(ady, Math.hypot(adx, adz));
      camera.updateMatrixWorld?.(true);
      for (let i = 0; i < 12; i++) {
        if (entity.destroyed || entity.dead || (typeof entity.hp === 'number' && entity.hp <= 0)) break;
        if (entity.hitMesh && !entity.hitMesh.visible && i > 0) break;
        runtime.shootCooldown = 0;
        combatMod.fireWeapon(camera, entitiesApi, missionsMod);
      }
      camera.position.set(savedPos.x, savedPos.y, savedPos.z);
      camera.rotation.y = savedYaw;
      camera.rotation.x = savedPitch;
      camera.updateMatrixWorld?.(true);
      runtime.shootCooldown = savedCooldown;
      return true;
    },
    isChapterCompleted(chapterId) {
      return campaignMod?.isChapterCompleted?.(chapterId) ?? false;
    },
    setPaused(isPaused) {
      const wantPaused = Boolean(isPaused);
      if (wantPaused && runtime.isPlaying) {
        togglePause();
      } else if (!wantPaused && !runtime.isPlaying) {
        togglePause();
      }
    },
    emit(eventName, payload) {
      emit(eventName, payload);
    },
    getInput() {
      return getInput();
    },
    getCameraYaw() {
      return camera ? camera.rotation.y : 0;
    },
    savePosition() {
      savePlayerPosition();
      return true;
    },
    openModal(name) {
      openModalByName(name);
      return true;
    },
    closeModals() {
      closeAllModals();
      return true;
    }
  };
}
