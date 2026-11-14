import { ROLES, EVENTS, stripKeyHints } from './config.js';
import { save, runtime, writeSave, syncDerivedStats, emit } from './state.js';

let selectedRoleId = save.profile.roleId || 'doher';
let activeConfirmCallback = null;
let listenersBound = false;

function setDisplay(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
  if (el.classList.contains('overlay-modal')) {
    el.style.display = visible ? 'flex' : 'none';
  }
}

function showStep(stepName) {
  setDisplay('enlist-step-bakum', stepName === 'bakum');
  setDisplay('enlist-step-gibbush', stepName === 'gibbush');
  setDisplay('enlist-step-roles', stepName === 'roles');
}

function updateSelectedCardHighlight() {
  const grid = document.getElementById('roles-grid-playable');
  if (!grid) return;
  const cards = grid.querySelectorAll('.role-card');
  for (const card of cards) {
    const selected = card.dataset.roleId === selectedRoleId;
    card.classList.toggle('selected', selected);
    card.setAttribute('aria-selected', selected ? 'true' : 'false');
  }
}

function renderRoleGrids() {
  const playableGrid = document.getElementById('roles-grid-playable');
  const lockedGrid = document.getElementById('roles-grid-locked');
  if (!playableGrid || !lockedGrid) return;

  if (!ROLES[selectedRoleId] || !ROLES[selectedRoleId].unlocked) {
    selectedRoleId = 'doher';
  }

  playableGrid.innerHTML = '';
  lockedGrid.innerHTML = '';

  for (const role of Object.values(ROLES)) {
    const card = document.createElement('div');
    card.dataset.roleId = role.id;

    if (role.unlocked) {
      card.className = 'role-card playable' + (role.id === selectedRoleId ? ' selected' : '');
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', role.id === selectedRoleId ? 'true' : 'false');
      card.innerHTML = `
        <div style="font-size:14px;font-weight:700;color:#ffd15c;margin-bottom:4px;">${role.name}</div>
        <div style="font-size:12px;color:#7ee3ff;margin-bottom:6px;">${role.arrayName} | ${role.battalion}</div>
        <div style="font-size:12px;color:#d6dcc2;margin-bottom:6px;line-height:1.35;">${stripKeyHints(role.description)}</div>
        <div style="font-size:12px;color:#a8e6a3;margin-bottom:4px;"><strong>פסיבי:</strong> ${stripKeyHints(role.passiveText)}</div>
        <div style="font-size:12px;color:#7ee3ff;"><strong>יכולת:</strong> ${stripKeyHints(role.abilityName)}</div>
      `;
      card.addEventListener('click', () => {
        selectedRoleId = role.id;
        updateSelectedCardHighlight();
      });
      playableGrid.appendChild(card);
    } else {
      card.className = 'role-card locked';
      card.setAttribute('aria-disabled', 'true');
      card.innerHTML = `
        <div style="font-size:14px;font-weight:700;color:#c8d1a3;margin-bottom:4px;">🔒 ${role.name}</div>
        <div style="font-size:12px;color:#ffd15c;margin-bottom:6px;">${stripKeyHints(role.unlockReqText)}</div>
        <div style="font-size:12px;color:#9ea58e;line-height:1.35;">${stripKeyHints(role.description)}</div>
      `;
      lockedGrid.appendChild(card);
    }
  }
}

export function selectRole(roleId) {
  const role = ROLES[roleId];
  if (!role || !role.unlocked) return false;
  save.profile.roleId = role.id;
  save.profile.battalion = role.battalion;
  save.enlisted = true;
  selectedRoleId = role.id;
  syncDerivedStats();
  writeSave();
  emit(EVENTS.ROLE_CHANGED, { roleId: role.id });
  return true;
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.getElementById('btn-enlist-to-shivta')?.addEventListener('click', () => {
    const input = document.getElementById('input-soldier-name');
    const cleanName = (input?.value || '').trim();
    save.profile.name = cleanName || 'יואב';
    showStep('gibbush');
  });

  document.getElementById('btn-enlist-to-roles')?.addEventListener('click', () => {
    renderRoleGrids();
    showStep('roles');
  });

  document.getElementById('btn-confirm-role')?.addEventListener('click', () => {
    const wasEnlisted = save.enlisted;
    if (!wasEnlisted) {
      const input = document.getElementById('input-soldier-name');
      const cleanName = (input?.value || '').trim();
      if (cleanName) save.profile.name = cleanName;
    }
    selectRole(selectedRoleId);
    runtime.abilityCooldownLeft = 0;
    runtime.abilityActiveLeft = 0;
    if (!wasEnlisted) {
      emit(EVENTS.ENLIST_COMPLETED, { roleId: selectedRoleId, name: save.profile.name });
    }
    runtime.enlistOpen = false;
    setDisplay('enlist-modal', false);
    if (typeof activeConfirmCallback === 'function') {
      const cb = activeConfirmCallback;
      activeConfirmCallback = null;
      cb();
    }
  });
}

export function openRoleSelectorModal(onConfirm) {
  bindListeners();
  activeConfirmCallback = onConfirm || null;
  selectedRoleId = save.profile.roleId || 'doher';
  runtime.enlistOpen = true;
  runtime.isPlaying = false;
  setDisplay('pause-modal', false);
  renderRoleGrids();
  showStep('roles');
  setDisplay('enlist-modal', true);
}

export function initEnlistment(onReadyToPlay) {
  bindListeners();
  selectedRoleId = save.profile.roleId || 'doher';

  if (save.enlisted) {
    runtime.enlistOpen = false;
    setDisplay('enlist-modal', false);
    setDisplay('pause-modal', true);
    return;
  }

  activeConfirmCallback = onReadyToPlay || null;
  runtime.enlistOpen = true;
  runtime.isPlaying = false;
  const input = document.getElementById('input-soldier-name');
  if (input) input.value = save.profile.name || 'יואב';
  renderRoleGrids();
  showStep('bakum');
  setDisplay('pause-modal', false);
  setDisplay('enlist-modal', true);
}
