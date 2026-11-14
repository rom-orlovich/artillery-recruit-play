import { emit, runtime } from './state.js';
import { appContext } from './main.js';

export const SETTINGS_KEY = 'artillery_corps_settings_v1';
export const SETTINGS_CHANGED_EVENT = 'settings:changed';
export const QUALITY_PIXEL_RATIOS = Object.freeze({
  auto: 1.5,
  high: 1.25,
  'battery-saver': 1.0
});

const DEFAULT_SETTINGS = Object.freeze({
  volume: 0.8,
  sensitivity: 1.0,
  aimAssist: true,
  leftHanded: false,
  graphicsQuality: 'auto'
});

let currentSettings = loadStoredSettings();
let bound = false;
let returnTarget = null;

function clamp(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function normalizeQuality(q) {
  if (q === 'auto' || q === 'high' || q === 'battery-saver') return q;
  if (q === 'battery') return 'battery-saver';
  return DEFAULT_SETTINGS.graphicsQuality;
}

function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    volume: Math.round(clamp(src.volume, 0, 1, DEFAULT_SETTINGS.volume) * 100) / 100,
    sensitivity: Math.round(clamp(src.sensitivity, 0.5, 2.0, DEFAULT_SETTINGS.sensitivity) * 100) / 100,
    aimAssist: src.aimAssist === undefined ? DEFAULT_SETTINGS.aimAssist : Boolean(src.aimAssist),
    leftHanded: src.leftHanded === undefined ? DEFAULT_SETTINGS.leftHanded : Boolean(src.leftHanded),
    graphicsQuality: normalizeQuality(src.graphicsQuality)
  };
}

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function syncRuntimeFromSettings(s) {
  const ratio = QUALITY_PIXEL_RATIOS[s.graphicsQuality] || 1.5;
  runtime.settings = { ...s };
  runtime.volume = s.volume;
  runtime.lookSensitivity = s.sensitivity;
  runtime.aimAssist = s.aimAssist;
  runtime.leftHanded = s.leftHanded;
  runtime.graphicsQuality = s.graphicsQuality;
  runtime.pixelRatio = ratio;
}

syncRuntimeFromSettings(currentSettings);

function syncSettingsUI(s) {
  const volInput = document.getElementById('setting-volume');
  const volVal = document.getElementById('setting-volume-val');
  if (volInput) volInput.value = String(Math.round(s.volume * 100));
  if (volVal) volVal.textContent = `${Math.round(s.volume * 100)}%`;

  const sensInput = document.getElementById('setting-sensitivity');
  const sensVal = document.getElementById('setting-sensitivity-val');
  if (sensInput) sensInput.value = String(Math.round(s.sensitivity * 100));
  if (sensVal) sensVal.textContent = s.sensitivity.toFixed(1);

  const aimBtn = document.getElementById('setting-aim-assist');
  if (aimBtn) {
    aimBtn.setAttribute('aria-pressed', s.aimAssist ? 'true' : 'false');
    aimBtn.textContent = s.aimAssist ? 'מופעל' : 'כבוי';
  }

  const leftBtn = document.getElementById('setting-left-handed');
  if (leftBtn) {
    leftBtn.setAttribute('aria-pressed', s.leftHanded ? 'true' : 'false');
    leftBtn.textContent = s.leftHanded ? 'מופעל' : 'כבוי';
  }

  const segs = document.querySelectorAll('#setting-graphics .setting-seg');
  for (const seg of segs) {
    const active = seg.dataset.quality === s.graphicsQuality;
    seg.classList.toggle('active', active);
    seg.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

export function getSettings() {
  return { ...currentSettings };
}

export function applySettings(next, options = {}) {
  currentSettings = normalizeSettings({ ...currentSettings, ...(next || {}) });
  if (options.persist !== false) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
    } catch {}
  }

  syncRuntimeFromSettings(currentSettings);

  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('left-handed', currentSettings.leftHanded);
  }

  const renderer = appContext && appContext.renderer;
  if (renderer && typeof renderer.setPixelRatio === 'function') {
    renderer.setPixelRatio(runtime.pixelRatio);
    if (typeof renderer.setSize === 'function' && typeof window !== 'undefined') {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
  }

  const audioMod = appContext && appContext.modules && appContext.modules.audio;
  if (audioMod && typeof audioMod.setVolume === 'function') {
    audioMod.setVolume(currentSettings.volume);
  }

  if (typeof document !== 'undefined') {
    syncSettingsUI(currentSettings);
  }

  emit(SETTINGS_CHANGED_EVENT, getSettings());
  return getSettings();
}

export function openSettingsModal(options = {}) {
  returnTarget = options.returnTo || null;
  syncSettingsUI(currentSettings);
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
  runtime.settingsOpen = true;
  runtime.modalOpen = true;
}

export function closeSettingsModal(onDone) {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  runtime.settingsOpen = false;
  if (returnTarget === 'pause') {
    returnTarget = null;
    const pause = document.getElementById('pause-modal');
    if (pause) {
      pause.classList.remove('hidden');
      pause.style.display = 'flex';
    }
    runtime.modalOpen = true;
    return;
  }
  returnTarget = null;
  runtime.modalOpen = false;
  if (typeof onDone === 'function') onDone();
}

export function initSettings(onCloseToGame) {
  currentSettings = loadStoredSettings();
  applySettings(currentSettings, { persist: false });

  if (bound || typeof document === 'undefined') return getSettings();
  bound = true;

  const volInput = document.getElementById('setting-volume');
  if (volInput) {
    volInput.addEventListener('input', () => {
      applySettings({ volume: Number(volInput.value) / 100 });
    });
  }

  const sensInput = document.getElementById('setting-sensitivity');
  if (sensInput) {
    sensInput.addEventListener('input', () => {
      applySettings({ sensitivity: Number(sensInput.value) / 100 });
    });
  }

  const aimBtn = document.getElementById('setting-aim-assist');
  if (aimBtn) {
    aimBtn.addEventListener('click', () => {
      applySettings({ aimAssist: !currentSettings.aimAssist });
    });
  }

  const leftBtn = document.getElementById('setting-left-handed');
  if (leftBtn) {
    leftBtn.addEventListener('click', () => {
      applySettings({ leftHanded: !currentSettings.leftHanded });
    });
  }

  const gfxGroup = document.getElementById('setting-graphics');
  if (gfxGroup) {
    gfxGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.setting-seg');
      if (!btn || !btn.dataset.quality) return;
      applySettings({ graphicsQuality: btn.dataset.quality });
    });
  }

  const closeBtn = document.getElementById('btn-close-settings');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeSettingsModal(onCloseToGame));
  }

  const saveBtn = document.getElementById('btn-settings-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      applySettings(currentSettings, { persist: true });
      closeSettingsModal(onCloseToGame);
    });
  }

  return getSettings();
}
