const FLASH_DURATION_MS = 520;
const MAX_ARROWS = 12;
const FIXED_OBSTACLE_IDS = [
  'hud-objective-pill',
  'hud-compass',
  'hud-status',
  'hud-missions',
  'minimap-wrap',
  'btn-touch-pause'
];
const SIDE_IDS = ['hud-status', 'hud-missions', 'minimap-wrap', 'btn-touch-pause'];
const CENTER_IDS = ['hud-objective-pill', 'hud-compass'];

const arrowPool = [];

let bannerEl = null;
let bannerIconEl = null;
let bannerTextEl = null;
let arrowsEl = null;
let flashEl = null;
let edgeLeftEl = null;
let edgeRightEl = null;
let edgeTopEl = null;
let edgeBottomEl = null;

let flashClearAtMs = 0;
let flashTimeoutId = null;

let lastBannerVisible = false;
let lastBannerText = '';
let lastBannerSeverity = '';
let lastLayoutW = 0;
let lastLayoutH = 0;

function getOrCreateArrow(idx) {
  if (idx < arrowPool.length) return arrowPool[idx];
  if (!arrowsEl || idx >= MAX_ARROWS) return null;
  const el = document.createElement('div');
  el.className = 'threat-arrow hidden';
  el.setAttribute('aria-hidden', 'true');
  arrowsEl.appendChild(el);
  const slot = { el, visible: false, x: -999, y: -999, deg: 0, severity: '' };
  arrowPool.push(slot);
  return slot;
}

function hideArrow(slot) {
  if (!slot.visible) return;
  slot.visible = false;
  slot.el.classList.add('hidden');
}

function updateArrowSlot(slot, x, y, deg, severity) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rd = Math.round(deg);
  if (!slot.visible) {
    slot.visible = true;
    slot.el.classList.remove('hidden');
  }
  if (slot.severity !== severity) {
    slot.severity = severity;
    slot.el.classList.toggle('severity-amber', severity === 'amber');
    slot.el.classList.toggle('severity-red', severity !== 'amber');
  }
  if (slot.x !== rx || slot.y !== ry || slot.deg !== rd) {
    slot.x = rx;
    slot.y = ry;
    slot.deg = rd;
    slot.el.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) rotate(${rd}deg)`;
  }
}

function isRectVisible(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.01) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function rectsOverlap(a, b) {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
}

function collectObstacles() {
  const list = [];
  for (let i = 0; i < FIXED_OBSTACLE_IDS.length; i += 1) {
    const el = document.getElementById(FIXED_OBSTACLE_IDS[i]);
    if (isRectVisible(el)) list.push(el);
  }
  const touchBtns = document.querySelectorAll('#touch-controls button');
  for (let i = 0; i < touchBtns.length; i += 1) {
    if (isRectVisible(touchBtns[i])) list.push(touchBtns[i]);
  }
  return list;
}

export function positionThreatBanner() {
  if (!bannerEl) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  lastLayoutW = vw;
  lastLayoutH = vh;

  let leftBound = 12;
  let rightBound = vw - 12;
  let topY = 46;

  for (let i = 0; i < SIDE_IDS.length; i += 1) {
    const el = document.getElementById(SIDE_IDS[i]);
    if (!isRectVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top >= vh * 0.48) continue;
    const cx = r.left + r.width / 2;
    if (cx < vw * 0.48) {
      if (r.right + 8 > leftBound) leftBound = r.right + 8;
    } else if (cx > vw * 0.52) {
      if (r.left - 8 < rightBound) rightBound = r.left - 8;
    }
  }

  for (let i = 0; i < CENTER_IDS.length; i += 1) {
    const el = document.getElementById(CENTER_IDS[i]);
    if (!isRectVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.45 && r.left < vw * 0.72 && r.right > vw * 0.28) {
      if (r.bottom + 6 > topY) topY = r.bottom + 6;
    }
  }

  const gapW = rightBound - leftBound;
  let centerX = gapW >= 140 ? (leftBound + rightBound) / 2 : vw / 2;
  let maxW = Math.max(140, Math.min(360, gapW >= 140 ? gapW : vw - 24));

  bannerEl.style.left = `${Math.round(centerX)}px`;
  bannerEl.style.transform = 'translateX(-50%)';
  bannerEl.style.maxWidth = `${Math.round(maxW)}px`;
  bannerEl.style.top = `${Math.round(topY)}px`;

  const obstacles = collectObstacles();
  for (let pass = 0; pass < 4; pass += 1) {
    const br = bannerEl.getBoundingClientRect();
    let adjusted = false;
    if (br.left < 8) {
      centerX += 8 - br.left;
      bannerEl.style.left = `${Math.round(centerX)}px`;
      adjusted = true;
    } else if (br.right > vw - 8) {
      centerX -= br.right - (vw - 8);
      bannerEl.style.left = `${Math.round(centerX)}px`;
      adjusted = true;
    }
    for (let i = 0; i < obstacles.length; i += 1) {
      const r = obstacles[i].getBoundingClientRect();
      if (!rectsOverlap(br, r)) continue;
      if (r.top < vh * 0.52) {
        topY = Math.max(topY, r.bottom + 6);
        bannerEl.style.top = `${Math.round(topY)}px`;
      } else {
        const half = br.width / 2;
        if (r.left + r.width / 2 < vw * 0.5) {
          leftBound = Math.max(leftBound, r.right + 8);
        } else {
          rightBound = Math.min(rightBound, r.left - 8);
        }
        const nextGap = rightBound - leftBound;
        if (nextGap >= 120) {
          maxW = Math.min(maxW, nextGap);
          centerX = (leftBound + rightBound) / 2;
        } else if (r.top - br.height - 6 >= 8) {
          topY = r.top - br.height - 6;
        } else if (half > 60) {
          maxW = Math.max(120, maxW - 24);
        }
        bannerEl.style.left = `${Math.round(centerX)}px`;
        bannerEl.style.maxWidth = `${Math.round(maxW)}px`;
        bannerEl.style.top = `${Math.round(topY)}px`;
      }
      adjusted = true;
    }
    if (!adjusted) break;
  }
}

export function showThreatBanner(text, severity) {
  if (!bannerEl) return;
  const wasHidden = !lastBannerVisible;
  const textChanged = lastBannerText !== text;
  if (!lastBannerVisible) {
    lastBannerVisible = true;
    bannerEl.classList.remove('hidden');
  }
  if (lastBannerSeverity !== severity) {
    lastBannerSeverity = severity;
    bannerEl.dataset.severity = severity;
    bannerEl.classList.toggle('severity-amber', severity === 'amber');
    bannerEl.classList.toggle('severity-red', severity !== 'amber');
  }
  if (textChanged) {
    lastBannerText = text;
    if (bannerTextEl) bannerTextEl.textContent = text;
    else bannerEl.textContent = text;
  }
  if (wasHidden || textChanged || lastLayoutW !== window.innerWidth || lastLayoutH !== window.innerHeight) {
    positionThreatBanner();
  }
}

export function hideThreatBanner() {
  if (!bannerEl || !lastBannerVisible) return;
  lastBannerVisible = false;
  lastBannerText = '';
  bannerEl.classList.add('hidden');
}

export function syncThreatArrows(specs) {
  if (!arrowsEl) return;
  const count = Math.min(specs.length, MAX_ARROWS);
  for (let i = 0; i < count; i += 1) {
    const slot = getOrCreateArrow(i);
    if (slot) updateArrowSlot(slot, specs[i].x, specs[i].y, specs[i].deg, specs[i].severity);
  }
  for (let i = count; i < arrowPool.length; i += 1) {
    hideArrow(arrowPool[i]);
  }
}

export function hideAllThreatArrows() {
  for (let i = 0; i < arrowPool.length; i += 1) {
    hideArrow(arrowPool[i]);
  }
}

export function clearEdgeFlash() {
  flashClearAtMs = 0;
  if (flashTimeoutId) {
    clearTimeout(flashTimeoutId);
    flashTimeoutId = null;
  }
  if (!flashEl) return;
  flashEl.dataset.hitDir = '';
  flashEl.classList.remove('edge-active', 'edge-left', 'edge-right', 'edge-top', 'edge-bottom');
  edgeLeftEl?.classList.remove('visible');
  edgeRightEl?.classList.remove('visible');
  edgeTopEl?.classList.remove('visible');
  edgeBottomEl?.classList.remove('visible');
}

export function triggerEdgeFlash(dir) {
  if (!flashEl) return;
  clearEdgeFlash();
  flashEl.dataset.hitDir = dir;
  flashEl.classList.add('edge-active', `edge-${dir}`);
  if (dir === 'left') edgeLeftEl?.classList.add('visible');
  else if (dir === 'right') edgeRightEl?.classList.add('visible');
  else if (dir === 'top') edgeTopEl?.classList.add('visible');
  else edgeBottomEl?.classList.add('visible');
  flashClearAtMs = performance.now() + FLASH_DURATION_MS;
  flashTimeoutId = setTimeout(clearEdgeFlash, FLASH_DURATION_MS);
}

export function tickEdgeFlash(nowMs) {
  if (flashClearAtMs > 0 && nowMs >= flashClearAtMs) {
    clearEdgeFlash();
  }
}

export function hasArrowsContainer() {
  return Boolean(arrowsEl);
}

export function initThreatHud() {
  bannerEl = document.getElementById('threat-banner');
  arrowsEl = document.getElementById('threat-arrows');
  flashEl = document.getElementById('damage-flash');

  if (bannerEl && !bannerEl.dataset.bound) {
    bannerEl.dataset.bound = '1';
    bannerIconEl = document.createElement('span');
    bannerIconEl.className = 'threat-banner-icon';
    bannerIconEl.textContent = '⚠️';
    bannerTextEl = document.createElement('span');
    bannerTextEl.className = 'threat-banner-text';
    bannerEl.textContent = '';
    bannerEl.append(bannerIconEl, bannerTextEl);
  }

  if (flashEl && !flashEl.dataset.edgesBound) {
    flashEl.dataset.edgesBound = '1';
    edgeLeftEl = document.createElement('div');
    edgeLeftEl.className = 'dmg-edge dmg-edge-left';
    edgeRightEl = document.createElement('div');
    edgeRightEl.className = 'dmg-edge dmg-edge-right';
    edgeTopEl = document.createElement('div');
    edgeTopEl.className = 'dmg-edge dmg-edge-top';
    edgeBottomEl = document.createElement('div');
    edgeBottomEl.className = 'dmg-edge dmg-edge-bottom';
    flashEl.append(edgeLeftEl, edgeRightEl, edgeTopEl, edgeBottomEl);
  }
}
