import * as THREE from 'three';
import { player, on } from './state.js';
import { LANDMARKS } from './config.js';
import { isAnyModalOpen } from './modal-manager.js';
import { getCurrentTarget } from './current-target.js';

const LABEL_DEFS = [
  { key: 'shop', name: 'אפסנאות', y: 2.2 },
  { key: 'mafikPos', name: 'נגמ״ש מפי״ק', y: 2.4 },
  { key: 'outpostCenter', name: 'מוצב הקרב', y: 2.2 },
  { key: 'uavLaunch', name: 'נקודת שיגור', y: 2.2 },
  { key: 'clinic', name: 'מרפאה', y: 2.2 },
  { key: 'barracksA', name: 'מגורים א׳', y: 2.2 },
  { key: 'rangeConsole', name: 'עמדת מטווח', y: 2.2 },
  { key: 'doherPos', name: 'תומ״ת דוהר', y: 2.6 },
  { key: 'roemPos', name: 'תומ״ת רועם', y: 2.6 },
  { key: 'shellPile', name: 'מערום פגזים', y: 1.8 }
];

const HUD_IDS = [
  'hud-status',
  'hud-missions',
  'hud-objective-pill',
  'hud-compass',
  'minimap-wrap',
  'radio-bar',
  'dialogue-box'
];

const LABEL_MAX_DIST = 120;
const LABEL_MAX_SHOWN = 3;
const camSpace = new THREE.Vector3();
const worldSpace = new THREE.Vector3();

let camera = null;
let group = null;
let markerMesh = null;
let pillarMesh = null;
let indicatorEl = null;
let indicatorArrowEl = null;
let indicatorDistEl = null;
let compassMarkerEl = null;
let hudLayerEl = null;
let cachedRects = [];
let cachedIndW = 86;
let cachedIndH = 30;
let listenersBound = false;
let labels = [];
let target = null;

function toPoint(pos) {
  if (!pos) return null;
  if (Array.isArray(pos)) return { x: pos[0], y: pos[1] || 0, z: pos[2] };
  if (typeof pos.x === 'number' && typeof pos.z === 'number') return { x: pos.x, y: pos.y || 0, z: pos.z };
  return null;
}

export function setWaypointTarget(pos) {
  target = toPoint(pos);
}

function getEdgeX() {
  return Math.min(54, Math.max(40, Math.ceil(cachedIndW / 2) + 6));
}

function getEdgeY() {
  return Math.min(22, Math.max(18, Math.ceil(cachedIndH / 2) + 6));
}

function isVisibleNode(node) {
  if (!node || node.closest('.hidden')) return false;
  const s = getComputedStyle(node);
  return s.display !== 'none' && s.visibility !== 'hidden';
}

export function refreshHudRects() {
  const next = [];
  for (const id of HUD_IDS) {
    const node = document.getElementById(id);
    if (!isVisibleNode(node)) continue;
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      next.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  }
  const touchRoot = document.getElementById('touch-controls');
  if (isVisibleNode(touchRoot)) {
    const touchNodes = [
      touchRoot.querySelector('.touch-actions-grid'),
      ...touchRoot.querySelectorAll('.touch-btn')
    ];
    for (const node of touchNodes) {
      if (!isVisibleNode(node)) continue;
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        next.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      }
    }
  }
  cachedRects = next;
  if (indicatorEl && isVisibleNode(indicatorEl)) {
    const ir = indicatorEl.getBoundingClientRect();
    if (ir.width > 0 && ir.height > 0) {
      cachedIndW = Math.ceil(ir.width);
      cachedIndH = Math.ceil(ir.height);
    }
  }
  for (const lb of labels) {
    if (lb.measured) continue;
    const prevDisplay = lb.el.style.display;
    const prevVis = lb.el.style.visibility;
    lb.el.style.visibility = 'hidden';
    lb.el.style.display = '';
    const r = lb.el.getBoundingClientRect();
    lb.el.style.display = prevDisplay;
    lb.el.style.visibility = prevVis;
    if (r.width > 0 && r.height > 0) {
      lb.w = Math.ceil(r.width) + 12;
      lb.h = Math.ceil(r.height) + 4;
      lb.measured = true;
    }
  }
}

function projectToScreen(point, height) {
  worldSpace.set(point.x, height, point.z);
  camSpace.copy(worldSpace).applyMatrix4(camera.matrixWorldInverse);
  const behind = camSpace.z > -0.05;
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const tanH = tanV * camera.aspect;
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!behind) {
    const ndcX = camSpace.x / -camSpace.z / tanH;
    const ndcY = camSpace.y / -camSpace.z / tanV;
    return { behind, ndcX, ndcY, x: ((ndcX + 1) / 2) * W, y: ((1 - ndcY) / 2) * H, W, H };
  }
  const edgeX = getEdgeX();
  const edgeY = getEdgeY();
  const cx = W / 2;
  const cy = H / 2;
  const maxDx = Math.max(1, cx - edgeX);
  const maxDy = Math.max(1, cy - edgeY);
  const horizNorm = Math.abs(camSpace.x) / Math.max(0.05, Math.hypot(camSpace.x, camSpace.z));
  let dirX = (camSpace.x / tanH) * cx;
  let dirY = (-camSpace.y / tanV) * cy;
  if (horizNorm < 0.02) {
    dirX = 0;
    dirY = 1;
  }
  const tx = Math.abs(dirX) > 1e-6 ? maxDx / Math.abs(dirX) : Infinity;
  const ty = Math.abs(dirY) > 1e-6 ? maxDy / Math.abs(dirY) : Infinity;
  const t = Math.min(tx, ty);
  const x = cx + dirX * t;
  const y = cy + dirY * t;
  const ndcX = (x / W) * 2 - 1;
  const ndcY = 1 - (y / H) * 2;
  return { behind, ndcX, ndcY, x, y, W, H };
}

function rectOverlap(cx, cy, w, h, rects) {
  for (const r of rects) {
    const ox = Math.min(cx + w / 2, r.right) - Math.max(cx - w / 2, r.left);
    const oy = Math.min(cy + h / 2, r.bottom) - Math.max(cy - h / 2, r.top);
    if (ox > 0 && oy > 0) return true;
  }
  return false;
}

function resolveClearPosition(sx, sy, minX, maxX, minY, maxY, rects, preferEdge) {
  const cw = Math.max(92, cachedIndW + 8);
  const ch = Math.max(34, cachedIndH + 8);
  if (!rectOverlap(sx, sy, cw, ch, rects)) return { x: sx, y: sy };
  const edges = [];
  for (let x = minX; x <= maxX; x += 20) {
    edges.push({ x, y: minY });
    edges.push({ x, y: maxY });
  }
  edges.push({ x: maxX, y: minY }, { x: maxX, y: maxY });
  for (let y = minY; y <= maxY; y += 18) {
    edges.push({ x: minX, y });
    edges.push({ x: maxX, y });
  }
  const interior = [];
  for (let x = minX + 24; x < maxX; x += 28) {
    for (let y = minY + 20; y < maxY; y += 24) {
      interior.push({ x, y });
    }
  }
  const byDist = (a, b) => Math.hypot(a.x - sx, a.y - sy) - Math.hypot(b.x - sx, b.y - sy);
  if (preferEdge) {
    edges.sort(byDist);
    for (const c of edges) {
      if (!rectOverlap(c.x, c.y, cw, ch, rects)) return c;
    }
    interior.sort(byDist);
    for (const c of interior) {
      if (!rectOverlap(c.x, c.y, cw, ch, rects)) return c;
    }
  } else {
    const all = edges.concat(interior).sort(byDist);
    for (const c of all) {
      if (!rectOverlap(c.x, c.y, cw, ch, rects)) return c;
    }
  }
  return { x: sx, y: sy };
}

function positionIndicator(dist) {
  if (!indicatorEl) return;
  const p = projectToScreen(target, 1.5);
  const edgeX = getEdgeX();
  const edgeY = getEdgeY();
  const minX = edgeX;
  const maxX = Math.max(minX, p.W - edgeX);
  const minY = edgeY;
  const maxY = Math.max(minY, p.H - edgeY);
  const clampedOutside = p.x < minX || p.x > maxX || p.y < minY || p.y > maxY;
  const sx0 = Math.min(Math.max(p.x, minX), maxX);
  const sy0 = Math.min(Math.max(p.y, minY), maxY);
  const pos = resolveClearPosition(sx0, sy0, minX, maxX, minY, maxY, cachedRects, p.behind || clampedOutside);
  const sx = pos.x;
  const sy = pos.y;
  indicatorEl.style.left = `${Math.round(sx)}px`;
  indicatorEl.style.top = `${Math.round(sy)}px`;
  if (indicatorDistEl) indicatorDistEl.textContent = `${Math.round(dist)}m`;
  if (indicatorArrowEl) {
    const angle = Math.atan2(sy - p.H / 2, sx - p.W / 2);
    indicatorArrowEl.style.transform = `rotate(${angle + Math.PI / 2}rad)`;
  }
  indicatorEl.classList.remove('hidden');
  if (compassMarkerEl && !p.behind) {
    const rel = Math.atan2(camSpace.x, -camSpace.z);
    compassMarkerEl.style.transform = `translateX(${Math.round((rel / Math.PI) * 180)}px)`;
  } else if (compassMarkerEl && p.behind) {
    compassMarkerEl.style.transform = `translateX(${camSpace.x >= 0 ? 150 : -150}px)`;
  }
}

function updateLabels() {
  const blocked = isAnyModalOpen();
  const candidates = [];
  for (const lb of labels) {
    const p = projectToScreen(lb.pos, lb.pos.y);
    const offScreen = p.ndcX < -1.1 || p.ndcX > 1.1 || p.ndcY < -1.1 || p.ndcY > 1.1;
    const d = Math.hypot(lb.pos.x - player.pos.x, lb.pos.z - player.pos.z);
    if (blocked || p.behind || offScreen || d > LABEL_MAX_DIST) {
      if (lb.el.style.display !== 'none') lb.el.style.display = 'none';
      continue;
    }
    candidates.push({ lb, p, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  const placed = [];
  let shown = 0;
  for (const cand of candidates) {
    const { lb, p, d } = cand;
    if (shown >= LABEL_MAX_SHOWN) {
      if (lb.el.style.display !== 'none') lb.el.style.display = 'none';
      continue;
    }
    if (rectOverlap(p.x, p.y, lb.w, lb.h, cachedRects) || rectOverlap(p.x, p.y, lb.w, lb.h, placed)) {
      if (lb.el.style.display !== 'none') lb.el.style.display = 'none';
      continue;
    }
    lb.el.style.display = '';
    lb.el.style.left = `${Math.round(p.x)}px`;
    lb.el.style.top = `${Math.round(p.y)}px`;
    placed.push({
      left: p.x - lb.w / 2,
      right: p.x + lb.w / 2,
      top: p.y - lb.h / 2,
      bottom: p.y + lb.h / 2
    });
    shown += 1;
    lb.distEl.textContent = `${Math.round(d)}m`;
  }
}

export function initWaypointCompass(sceneRef, cameraRef) {
  camera = cameraRef;
  group = new THREE.Group();
  markerMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.2),
    new THREE.MeshBasicMaterial({ color: 0x2cc5b6 })
  );
  markerMesh.position.y = 2.4;
  pillarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.45, 14, 8),
    new THREE.MeshBasicMaterial({ color: 0x2cc5b6, transparent: true, opacity: 0.22 })
  );
  pillarMesh.position.y = 7;
  group.add(markerMesh);
  group.add(pillarMesh);
  sceneRef.add(group);

  indicatorEl = document.getElementById('waypoint-indicator');
  if (indicatorEl) {
    indicatorEl.innerHTML = '';
    indicatorArrowEl = document.createElement('span');
    indicatorArrowEl.className = 'waypoint-arrow';
    indicatorArrowEl.textContent = '▲';
    indicatorDistEl = document.createElement('bdi');
    indicatorDistEl.className = 'waypoint-dist';
    indicatorDistEl.dir = 'ltr';
    indicatorDistEl.textContent = '0m';
    indicatorEl.appendChild(indicatorArrowEl);
    indicatorEl.appendChild(indicatorDistEl);
  }
  compassMarkerEl = document.getElementById('compass-marker');
  hudLayerEl = document.getElementById('hud-layer');

  labels = [];
  if (hudLayerEl) {
    for (const def of LABEL_DEFS) {
      const lm = LANDMARKS[def.key];
      if (!lm) continue;
      const node = document.createElement('div');
      node.className = 'world-label';
      const nameEl = document.createElement('span');
      nameEl.textContent = def.name;
      const distEl = document.createElement('bdi');
      distEl.dir = 'ltr';
      distEl.className = 'world-label-dist';
      distEl.textContent = '0m';
      node.appendChild(nameEl);
      node.appendChild(distEl);
      hudLayerEl.appendChild(node);
      labels.push({
        el: node,
        distEl,
        pos: { x: lm.x, y: def.y, z: lm.z },
        w: Math.max(96, def.name.length * 10 + 48),
        h: 26,
        measured: false
      });
    }
  }

  on('mission:completed', () => {
    target = null;
  });

  if (!listenersBound) {
    listenersBound = true;
    window.addEventListener('resize', refreshHudRects);
    window.addEventListener('orientationchange', refreshHudRects);
  }

  target = null;
  refreshHudRects();
}

export function updateWaypointCompass(tSec) {
  if (!group || !camera) return;
  camera.updateMatrixWorld(true);
  const resolved = getCurrentTarget();
  target = resolved ? toPoint(resolved) : null;
  if (!target) {
    group.visible = false;
    if (indicatorEl) indicatorEl.classList.add('hidden');
    if (compassMarkerEl) compassMarkerEl.style.visibility = 'hidden';
    updateLabels();
    return;
  }
  group.visible = true;
  if (compassMarkerEl) compassMarkerEl.style.visibility = '';
  group.position.set(target.x, 0, target.z);
  markerMesh.position.y = 2.4 + Math.sin(tSec * Math.PI * 5) * 0.25;
  const dist = Math.hypot(target.x - player.pos.x, target.z - player.pos.z);
  pillarMesh.visible = dist >= 8;
  positionIndicator(dist);
  updateLabels();
}
