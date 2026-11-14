import { getMissionsForRole, stripKeyHints } from './config.js';
import { save, runtime } from './state.js';

let lastMissionKey = '';

function getMissionProgressText(mission) {
  const done = Boolean(save.completed[mission.id]);
  if (done) return `${mission.targetCount}/${mission.targetCount} ✓`;

  switch (mission.id) {
    case 'base':
      return `${runtime.sandbagsPlaced}/${mission.targetCount}`;
    case 'range':
      return `${runtime.rangeHits}/${mission.targetCount}`;
    case 'doher_salvo':
      return `${runtime.shellsLoaded}/${mission.targetCount}`;
    case 'roem_rapid':
      return runtime.roemRapidActive
        ? `${runtime.roemRapidHits}/${mission.targetCount}`
        : `כיול ${runtime.roemNodesCalibrated}/3`;
    case 'rokhash_recon':
      return runtime.uavLaunched
        ? `${runtime.transmittersDestroyed}/${mission.targetCount}`
        : 'שגר כטמ"ם';
    case 'mafik_radar':
      return runtime.radarWaveActive
        ? `${runtime.radarDronesKilled}/${mission.targetCount}`
        : `כיול ${runtime.radarCalibrated}/3`;
    case 'patrol':
      return `${runtime.patrolStep}/${mission.targetCount}`;
    default:
      return `0/${mission.targetCount}`;
  }
}

export function renderMissionsList() {
  const listEl = document.getElementById('missions-list');
  const countEl = document.getElementById('missions-done-count');
  if (!listEl) return;

  const missions = getMissionsForRole(save.profile.roleId);
  const doneCount = missions.filter((m) => save.completed[m.id]).length;
  const key = missions
    .map((m) => `${m.id}:${save.completed[m.id] ? 1 : 0}:${getMissionProgressText(m)}`)
    .join('|');

  if (key === lastMissionKey) return;
  lastMissionKey = key;

  if (countEl) countEl.textContent = `${doneCount}/${missions.length}`;
  listEl.innerHTML = '';

  for (const m of missions) {
    const isDone = Boolean(save.completed[m.id]);
    const item = document.createElement('div');
    item.className = 'mission-item' + (isDone ? ' done' : '');

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.gap = '6px';
    row.style.fontWeight = '700';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = m.title;

    const progSpan = document.createElement('span');
    progSpan.style.color = isDone ? '#54c772' : '#ffd15c';
    progSpan.textContent = getMissionProgressText(m);

    row.append(titleSpan, progSpan);
    item.appendChild(row);

    if (!isDone) {
      const desc = document.createElement('div');
      desc.style.fontSize = '12px';
      desc.style.color = '#c8d1a3';
      desc.style.marginTop = '2px';
      desc.textContent = stripKeyHints(m.description);
      item.appendChild(desc);
    }
    listEl.appendChild(item);
  }
}

export function invalidateMissionsListKey() {
  lastMissionKey = '';
}
