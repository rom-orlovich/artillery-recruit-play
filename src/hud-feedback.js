import { stripKeyHints } from './config.js';

const refs = {};
function ref(id) {
  if (!refs[id]) refs[id] = document.getElementById(id);
  return refs[id];
}

let toastTimeout = null;
let radioTimeout = null;
let hitMarkerTimeout = null;

export function ensureHitMarker() {
  let el = ref('hit-marker');
  if (!el && typeof document !== 'undefined') {
    el = document.createElement('div');
    el.id = 'hit-marker';
    el.className = 'hit-marker hidden';
    el.setAttribute('aria-hidden', 'true');
    const host = document.getElementById('hud') || document.body;
    if (host) host.appendChild(el);
    refs['hit-marker'] = el;
  }
  return el;
}

export function showHitMarker() {
  const el = ensureHitMarker();
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('active');
  clearTimeout(hitMarkerTimeout);
  hitMarkerTimeout = setTimeout(() => {
    el.classList.remove('active');
    el.classList.add('hidden');
  }, 240);
}

export function hideRadio() {
  clearTimeout(radioTimeout);
  radioTimeout = null;
  const box = ref('radio-bar');
  const speakerEl = ref('radio-speaker');
  const textEl = ref('radio-text');
  if (box) {
    box.classList.add('hidden');
    box.style.display = 'none';
  }
  if (speakerEl) speakerEl.textContent = '';
  if (textEl) textEl.textContent = '';
}

function ensureVisible(node, fallbackDisplay = 'block') {
  if (!node) return;
  node.classList.remove('hidden');
  node.style.display = '';
  if (typeof window !== 'undefined' && window.getComputedStyle(node).display === 'none') {
    node.style.display = fallbackDisplay;
  }
}

export function showRadio(payload = {}) {
  const speaker = typeof payload?.speaker === 'string' ? payload.speaker.trim() : '';
  const rawText = typeof payload?.text === 'string'
    ? payload.text.trim()
    : (typeof payload?.message === 'string' ? payload.message.trim() : '');
  const text = stripKeyHints(rawText).trim();

  if (!text) {
    hideRadio();
    return;
  }

  const box = ref('radio-bar');
  const speakerEl = ref('radio-speaker');
  const textEl = ref('radio-text');

  ensureVisible(box, 'flex');
  if (speakerEl) {
    speakerEl.textContent = speaker;
    ensureVisible(speakerEl, 'inline');
  }
  if (textEl) {
    textEl.textContent = text;
    ensureVisible(textEl, 'inline');
  }

  const durationMs = typeof payload?.durationMs === 'number'
    ? payload.durationMs
    : (typeof payload?.duration === 'number' ? payload.duration : 4500);
  clearTimeout(radioTimeout);
  if (durationMs > 0) {
    radioTimeout = setTimeout(hideRadio, durationMs);
  }
}

export function showToast(message, duration = 2500) {
  const banner = ref('toast-banner');
  const cleaned = stripKeyHints(message || '').trim();
  if (!banner || !cleaned) return;
  banner.textContent = cleaned;
  banner.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    banner.classList.add('hidden');
  }, duration);
}
