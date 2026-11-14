import { player, runtime } from './state.js';

const JOY_MAX_RADIUS = 56;
const JOY_EDGE_THRESHOLD = 0.85;
const AUTO_SPRINT_DELAY = 1.0;
const FORWARD_COS_THRESHOLD = Math.cos(Math.PI / 6);

let joyPointerId = null;
let lookPointerId = null;
let joyBaseX = 0;
let joyBaseY = 0;
let joyX = 0;
let joyY = 0;
let lookLastX = 0;
let lookLastY = 0;
let touchSprint = false;
let autoSprint = false;
let joyEdgeHoldTime = 0;
let joyEdgeStartAt = 0;
let joyZoneEl = null;
let joyKnobEl = null;
let joyBaseEl = null;

function isForwardEdge() {
  const joyMag = Math.hypot(joyX, joyY);
  if (joyMag < JOY_EDGE_THRESHOLD) return false;
  return (-joyY / joyMag) >= FORWARD_COS_THRESHOLD;
}

function knobRest() {
  if (!joyZoneEl || !joyKnobEl) return { x: 0, y: 0 };
  const zr = joyZoneEl.getBoundingClientRect();
  return {
    x: zr.left + joyKnobEl.offsetLeft + joyKnobEl.offsetWidth / 2,
    y: zr.top + joyKnobEl.offsetTop + joyKnobEl.offsetHeight / 2
  };
}

function setJoyVisual(offX, offY) {
  if (!joyKnobEl) return;
  joyKnobEl.style.transform = `translate(${offX}px, ${offY}px)`;
}

function syncSprintButton() {
  const btnSprint = document.getElementById('btn-touch-sprint');
  if (btnSprint) btnSprint.classList.toggle('active', touchSprint || autoSprint);
}

function updateJoyFromPoint(clientX, clientY) {
  const rest = knobRest();
  let dx = clientX - joyBaseX;
  let dy = clientY - joyBaseY;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_MAX_RADIUS) {
    dx = (dx / dist) * JOY_MAX_RADIUS;
    dy = (dy / dist) * JOY_MAX_RADIUS;
  }
  joyX = dx / JOY_MAX_RADIUS;
  joyY = dy / JOY_MAX_RADIUS;
  if (isForwardEdge()) {
    if (!joyEdgeStartAt) joyEdgeStartAt = performance.now();
  } else {
    joyEdgeHoldTime = 0;
    joyEdgeStartAt = 0;
    if (autoSprint) {
      autoSprint = false;
      syncSprintButton();
    }
  }
  setJoyVisual(joyBaseX - rest.x + dx, joyBaseY - rest.y + dy);
}

function showJoyVisual(show) {
  if (joyBaseEl) joyBaseEl.classList.toggle('active', show);
  if (joyKnobEl) joyKnobEl.classList.toggle('active', show);
}

function resetJoy() {
  joyPointerId = null;
  joyX = 0;
  joyY = 0;
  joyEdgeHoldTime = 0;
  joyEdgeStartAt = 0;
  autoSprint = false;
  syncSprintButton();
  showJoyVisual(false);
  setJoyVisual(0, 0);
}

export function resetTouchState() {
  joyPointerId = null;
  lookPointerId = null;
  joyX = 0;
  joyY = 0;
  touchSprint = false;
  autoSprint = false;
  joyEdgeHoldTime = 0;
  joyEdgeStartAt = 0;
  syncSprintButton();
  showJoyVisual(false);
  setJoyVisual(0, 0);
}

export function getTouchInput() {
  return {
    joyX,
    joyY,
    sprintLocked: touchSprint || autoSprint
  };
}

export function updateTouchAutoSprint(dt) {
  if (joyPointerId !== null && isForwardEdge() && runtime.isPlaying) {
    if (!joyEdgeStartAt) joyEdgeStartAt = performance.now();
    joyEdgeHoldTime += dt;
    if ((joyEdgeHoldTime >= AUTO_SPRINT_DELAY || (performance.now() - joyEdgeStartAt) >= 1000) && !autoSprint) {
      autoSprint = true;
      syncSprintButton();
    }
  } else {
    joyEdgeHoldTime = 0;
    joyEdgeStartAt = 0;
    if (autoSprint) {
      autoSprint = false;
      syncSprintButton();
    }
  }
}

function isUiTarget(target) {
  return Boolean(
    target &&
    target.closest &&
    target.closest('#touch-btns, .touch-actions-grid, button, input, select, textarea, a, .modal-card, .modal-backdrop, .overlay-modal, .hud-panel, #hud-status, #hud-objective-pill, #dialogue-box, .role-card, .shop-item-card')
  );
}

function bindSingleTap(el, handler) {
  if (!el) return;
  let lastTouchAt = 0;
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    lastTouchAt = performance.now();
    handler();
  }, { passive: false });
  el.addEventListener('click', (e) => {
    if (performance.now() - lastTouchAt < 450) {
      e.preventDefault();
      return;
    }
    handler();
  });
}

export function initTouchControls(canvas, getCallbacks, getLookSensitivity) {
  joyZoneEl = document.getElementById('joy-zone');
  joyKnobEl = document.getElementById('joy-knob');
  joyBaseEl = document.getElementById('joy-base');

  document.addEventListener('pointerdown', (e) => {
    if (isUiTarget(e.target)) return;
    const zoneRect = joyZoneEl ? joyZoneEl.getBoundingClientRect() : null;
    const inZone = Boolean(
      (e.target && e.target.closest && e.target.closest('#joy-zone')) ||
      (zoneRect &&
        e.clientX >= zoneRect.left &&
        e.clientX <= zoneRect.right &&
        e.clientY >= zoneRect.top &&
        e.clientY <= zoneRect.bottom)
    );
    if (inZone && joyPointerId === null && e.pointerType !== 'mouse') {
      joyPointerId = e.pointerId;
      joyBaseX = e.clientX;
      joyBaseY = e.clientY;
      if (joyBaseEl && joyZoneEl) {
        const zr = joyZoneEl.getBoundingClientRect();
        joyBaseEl.style.left = `${Math.round(e.clientX - zr.left)}px`;
        joyBaseEl.style.top = `${Math.round(e.clientY - zr.top)}px`;
      }
      showJoyVisual(true);
      const rest = knobRest();
      setJoyVisual(e.clientX - rest.x, e.clientY - rest.y);
      joyX = 0;
      joyY = 0;
      joyEdgeHoldTime = 0;
      joyEdgeStartAt = 0;
      return;
    }
    if (!inZone && lookPointerId === null && e.pointerType !== 'mouse') {
      lookPointerId = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
    }
  });

  document.addEventListener('pointermove', (e) => {
    if (joyPointerId !== null && e.pointerId === joyPointerId) {
      updateJoyFromPoint(e.clientX, e.clientY);
      return;
    }
    if (lookPointerId !== null && e.pointerId === lookPointerId) {
      if (!runtime.isPlaying) return;
      const sens = getLookSensitivity();
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      player.yaw -= dx * 0.0052 * sens;
      player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - dy * 0.0042 * sens));
    }
  });

  const releasePointer = (e) => {
    if (joyPointerId !== null && e.pointerId === joyPointerId) resetJoy();
    if (lookPointerId !== null && e.pointerId === lookPointerId) lookPointerId = null;
  };
  document.addEventListener('pointerup', releasePointer);
  document.addEventListener('pointercancel', releasePointer);
  if (canvas) canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const btnFire = document.getElementById('btn-touch-fire');
  const btnInteract = document.getElementById('btn-touch-interact');
  const btnAbility = document.getElementById('btn-touch-ability');
  const btnSprint = document.getElementById('btn-touch-sprint');
  const btnJump = document.getElementById('btn-touch-jump');
  const btnPause = document.getElementById('btn-touch-pause');

  bindSingleTap(btnFire, () => {
    if (runtime.isPlaying) getCallbacks().onFire?.();
  });
  bindSingleTap(btnInteract, () => {
    if (runtime.isPlaying) getCallbacks().onInteract?.();
  });
  bindSingleTap(btnAbility, () => {
    if (runtime.isPlaying) getCallbacks().onAbility?.();
  });
  bindSingleTap(btnSprint, () => {
    touchSprint = !touchSprint;
    syncSprintButton();
  });
  bindSingleTap(btnJump, () => {
    if (runtime.isPlaying && player.onGround) {
      player.velY = 7.4;
      player.onGround = false;
    }
  });
  btnPause?.addEventListener('click', () => getCallbacks().onPauseToggle?.());
}
