import { WORLD_BOUNDS } from './config.js';
import { player, runtime, getSpeedMultiplier } from './state.js';
import { colliders, getTerrainHeight } from './world.js';

const keys = new Set();
let joyPointerId = null;
let lookPointerId = null;
let joyBaseX = 0;
let joyBaseY = 0;
let joyX = 0;
let joyY = 0;
let lookLastX = 0;
let lookLastY = 0;
let touchSprint = false;
let wasPointerLocked = false;
let callbacks = {};
let joyZoneEl = null;
let joyKnobEl = null;
let joyBaseEl = null;

const JOY_MAX_RADIUS = 56;
const GRAVITY = 21;
const GROUND_SNAP = 0.6;

export function resolveCircleAABB(px, pz, r) {
  let x = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, px));
  let z = Math.max(WORLD_BOUNDS.minZ + r, Math.min(WORLD_BOUNDS.maxZ - r, pz));

  for (let pass = 0; pass < 2; pass++) {
    for (const box of colliders) {
      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const push = r - dist;
          x += (dx / dist) * push;
          z += (dz / dist) * push;
        } else {
          const leftPen = Math.abs(x - box.minX);
          const rightPen = Math.abs(box.maxX - x);
          const topPen = Math.abs(z - box.minZ);
          const bottomPen = Math.abs(box.maxZ - z);
          const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
          if (minPen === leftPen) x = box.minX - r;
          else if (minPen === rightPen) x = box.maxX + r;
          else if (minPen === topPen) z = box.minZ - r;
          else z = box.maxZ + r;
        }
      }
    }
  }

  x = Math.max(WORLD_BOUNDS.minX + r, Math.min(WORLD_BOUNDS.maxX - r, x));
  z = Math.max(WORLD_BOUNDS.minZ + r, Math.min(WORLD_BOUNDS.maxZ - r, z));
  return [x, z];
}

export function requestGameLock(canvas) {
  runtime.isPlaying = true;
  if (!runtime.isMobile && canvas && canvas.requestPointerLock) {
    try {
      const res = canvas.requestPointerLock();
      if (res && typeof res.catch === 'function') res.catch(() => {});
    } catch {}
  }
}

export function releaseGameLock() {
  runtime.isPlaying = false;
  if (document.pointerLockElement && document.exitPointerLock) {
    try {
      document.exitPointerLock();
    } catch {}
  }
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
  showJoyVisual(false);
  setJoyVisual(0, 0);
}

export function resetInputState() {
  keys.clear();
  joyPointerId = null;
  lookPointerId = null;
  joyX = 0;
  joyY = 0;
  touchSprint = false;
  const btnSprint = document.getElementById('btn-touch-sprint');
  if (btnSprint) btnSprint.classList.remove('active');
  showJoyVisual(false);
  setJoyVisual(0, 0);
}

export function getInput() {
  let moveForward = -joyY;
  let moveRight = joyX;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveForward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveForward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;
  const len = Math.hypot(moveRight, moveForward);
  if (len > 1) {
    moveRight /= len;
    moveForward /= len;
  }
  return {
    moveForward,
    moveRight,
    sprintLocked: touchSprint,
    lookYaw: player.yaw
  };
}

function isUiTarget(target) {
  return Boolean(
    target &&
    target.closest &&
    target.closest('#touch-btns, .touch-actions-grid, button, input, select, textarea, a, .modal-card, .modal-backdrop, .overlay-modal, .hud-panel, #dialogue-box, .role-card, .shop-item-card')
  );
}

function bindPointerInput(canvas) {
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
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      player.yaw -= dx * 0.0052;
      player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - dy * 0.0042));
    }
  });

  const releasePointer = (e) => {
    if (joyPointerId !== null && e.pointerId === joyPointerId) resetJoy();
    if (lookPointerId !== null && e.pointerId === lookPointerId) lookPointerId = null;
  };
  document.addEventListener('pointerup', releasePointer);
  document.addEventListener('pointercancel', releasePointer);
  if (canvas) canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindTouchButtons() {
  const btnFire = document.getElementById('btn-touch-fire');
  const btnInteract = document.getElementById('btn-touch-interact');
  const btnAbility = document.getElementById('btn-touch-ability');
  const btnSprint = document.getElementById('btn-touch-sprint');
  const btnJump = document.getElementById('btn-touch-jump');
  const btnPause = document.getElementById('btn-touch-pause');

  const jump = () => {
    if (runtime.isPlaying && player.onGround) {
      player.velY = 7.4;
      player.onGround = false;
    }
  };

  btnFire?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (runtime.isPlaying) callbacks.onFire?.();
  }, { passive: false });

  btnInteract?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (runtime.isPlaying) callbacks.onInteract?.();
  }, { passive: false });

  btnAbility?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (runtime.isPlaying) callbacks.onAbility?.();
  }, { passive: false });

  btnSprint?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchSprint = !touchSprint;
    btnSprint.classList.toggle('active', touchSprint);
  }, { passive: false });

  btnJump?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
  }, { passive: false });

  btnPause?.addEventListener('click', () => callbacks.onPauseToggle?.());
}

export function initControls(canvas, actionCallbacks = {}) {
  callbacks = actionCallbacks;
  joyZoneEl = document.getElementById('joy-zone');
  joyKnobEl = document.getElementById('joy-knob');
  joyBaseEl = document.getElementById('joy-base');

  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (keys.has(e.code)) return;
    keys.add(e.code);
    if (!runtime.isPlaying) return;
    if (e.code === 'Space') {
      if (player.onGround) {
        player.velY = 7.4;
        player.onGround = false;
      }
    } else if (e.code === 'KeyE') {
      callbacks.onInteract?.();
    } else if (e.code === 'KeyQ') {
      callbacks.onAbility?.();
    } else if (e.code === 'KeyP') {
      callbacks.onPauseToggle?.();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  window.addEventListener('blur', () => resetInputState());

  window.addEventListener('mousemove', (e) => {
    if (!runtime.isPlaying) return;
    if (document.pointerLockElement === canvas) {
      player.yaw -= e.movementX * 0.0022;
      player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - e.movementY * 0.0022));
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !runtime.isPlaying) return;
    if (!runtime.isMobile && document.pointerLockElement !== canvas) {
      requestGameLock(canvas);
    }
    callbacks.onFire?.();
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (wasPointerLocked && !locked && runtime.isPlaying && !runtime.shopOpen && !runtime.enlistOpen && !runtime.isDead) {
      callbacks.onPauseToggle?.();
    }
    wasPointerLocked = locked;
  });

  bindPointerInput(canvas);
  bindTouchButtons();
}

export function updatePlayerMovement(dt, camera) {
  let moveRight = joyX;
  let moveForward = -joyY;

  if (keys.has('KeyW') || keys.has('ArrowUp')) moveForward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveForward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveRight += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveRight -= 1;

  const len = Math.hypot(moveRight, moveForward);
  if (len > 1) {
    moveRight /= len;
    moveForward /= len;
  }

  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint;
  const speed = 7.6 * (sprinting ? 1.48 : 1.0) * getSpeedMultiplier();

  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  const vx = (-sinY * moveForward + cosY * moveRight) * speed;
  const vz = (-cosY * moveForward - sinY * moveRight) * speed;

  const [nx, nz] = resolveCircleAABB(player.pos.x + vx * dt, player.pos.z + vz * dt, player.radius);
  player.pos.x = nx;
  player.pos.z = nz;

  const groundY = getTerrainHeight(player.pos.x, player.pos.z);
  player.velY -= GRAVITY * dt;
  player.pos.y += player.velY * dt;
  const snapDown = player.onGround && player.velY <= 0 && player.pos.y - groundY < GROUND_SNAP;
  if (player.pos.y <= groundY || snapDown) {
    player.pos.y = groundY;
    player.velY = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  if (len > 0.1 && player.onGround) {
    runtime.bobTime += dt * (sprinting ? 12 : 8.5);
  }
  const bobOffset = player.onGround ? Math.sin(runtime.bobTime) * 0.04 : 0;

  camera.position.set(player.pos.x, player.pos.y + player.eyeHeight + bobOffset, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}
