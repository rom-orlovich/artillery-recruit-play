import * as THREE from 'three';
import { fbm } from './world-terrain.js';

const FADE_DURATION_MS = 500;
const FADE_MIDPOINT_MS = 250;
const RIDGES = [
  { radius: 640, base: 22, amp: 34, seed: 3, segments: 160 },
  { radius: 1020, base: 46, amp: 60, seed: 11, segments: 160 }
];
const COLOR_KEYS = ['horizon', 'sunLight', 'hemiSky', 'hemiGround', 'fog', 'ridgeNear', 'ridgeFar'];
const NUMBER_KEYS = ['sunIntensity', 'hemiIntensity', 'fogDensity', 'exposure', 'envIntensity'];
const MAX_SUN_ELEV = (63 * Math.PI) / 180;
const SIN_MAX_ELEV = Math.sin(MAX_SUN_ELEV);
const COS_MAX_ELEV = Math.cos(MAX_SUN_ELEV);
const MOON_DIR = new THREE.Vector3(0.35, 0.62, -0.5).normalize();

function getFadeOverlay() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('phase-fade');
  if (!el) {
    el = document.createElement('div');
    el.id = 'phase-fade';
    el.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:999;opacity:0;';
    document.body.appendChild(el);
  }
  return el;
}

function ridgeGeometry({ radius, base, amp, seed, segments }) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const n = fbm(Math.cos(a) * 3 + seed, Math.sin(a) * 3 - seed, 4);
    const peak = base + Math.pow(n, 1.6) * amp * 1.6;
    positions.push(Math.cos(a) * radius, -60, Math.sin(a) * radius, Math.cos(a) * radius, peak, Math.sin(a) * radius);
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function dominantRegionIndex(weights, regionOrder) {
  let bestIdx = 0;
  let bestW = -1;
  regionOrder.forEach((id, i) => {
    const w = weights ? (weights[id] ?? 0) : (i === 0 ? 1 : 0);
    if (w > bestW) {
      bestW = w;
      bestIdx = i;
    }
  });
  return bestIdx;
}

export function createHorizonRidges(scene) {
  return RIDGES.map((def, i) => {
    const mesh = new THREE.Mesh(ridgeGeometry(def), new THREE.MeshBasicMaterial({ color: 0x333333, fog: false, side: THREE.DoubleSide }));
    mesh.name = `horizon-ridge-${i}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    scene.add(mesh);
    return mesh;
  });
}

export function createEnvManager(scene, renderer, targets, regionOrder) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envCache = new Map();
  let activeEnvKey = '';
  return {
    syncEnvMap(phase, weights) {
      const idx = dominantRegionIndex(weights, regionOrder);
      const key = `${phase}:${regionOrder[idx]}`;
      if (key === activeEnvKey) return;
      let envTarget = envCache.get(key);
      if (!envTarget) {
        envTarget = pmrem.fromCubemap(targets[idx].texture);
        envCache.set(key, envTarget);
      }
      activeEnvKey = key;
      scene.environment = envTarget.texture;
    },
    dispose() {
      for (const target of envCache.values()) target.dispose();
      envCache.clear();
      pmrem.dispose();
      activeEnvKey = '';
      scene.environment = null;
    }
  };
}

export function createHeadlampController() {
  const headlamp = new THREE.SpotLight(0xfff3dc, 55, 24, 0.42, 0.6, 2);
  headlamp.name = 'player-headlamp';
  headlamp.castShadow = false;
  headlamp.position.set(0, 0.1, 0);
  headlamp.target.position.set(0, -0.4, -6);
  let attachedCamera = null;
  return {
    sync(camera, isNight) {
      if (isNight && camera) {
        if (attachedCamera !== camera) {
          if (attachedCamera) attachedCamera.remove(headlamp, headlamp.target);
          camera.add(headlamp, headlamp.target);
          attachedCamera = camera;
        }
      } else if (attachedCamera) {
        attachedCamera.remove(headlamp, headlamp.target);
        attachedCamera = null;
      }
    },
    dispose() {
      if (attachedCamera) {
        attachedCamera.remove(headlamp, headlamp.target);
        attachedCamera = null;
      }
      headlamp.dispose();
    }
  };
}

export function createFadeController(initialPhase, onSwap) {
  const fadeOverlay = getFadeOverlay();
  const state = { active: false, targetPhase: initialPhase, startMs: 0, blackPainted: false, swapped: false, timerId: null };
  return {
    step() {
      if (!state.active) return;
      const elapsed = performance.now() - state.startMs;
      if (elapsed < FADE_MIDPOINT_MS) {
        const alpha = Math.min(1, elapsed / (FADE_MIDPOINT_MS * 0.88));
        if (fadeOverlay) fadeOverlay.style.opacity = String(alpha);
        if (alpha >= 1) state.blackPainted = true;
        return;
      }
      if (!state.swapped) {
        if (fadeOverlay) fadeOverlay.style.opacity = '1';
        if (!state.blackPainted) {
          state.blackPainted = true;
          return;
        }
        onSwap(state.targetPhase);
        state.swapped = true;
        return;
      }
      if (elapsed < FADE_DURATION_MS) {
        const alpha = Math.max(0, 1 - (elapsed - FADE_MIDPOINT_MS) / (FADE_DURATION_MS - FADE_MIDPOINT_MS));
        if (fadeOverlay) fadeOverlay.style.opacity = String(alpha);
        return;
      }
      if (fadeOverlay) fadeOverlay.style.opacity = '0';
      state.active = false;
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
    },
    start(targetPhase) {
      if (state.active && state.targetPhase === targetPhase) return;
      if (state.timerId) clearTimeout(state.timerId);
      state.active = true;
      state.targetPhase = targetPhase;
      state.startMs = performance.now();
      state.blackPainted = false;
      state.swapped = false;
      state.timerId = setTimeout(() => {
        if (!state.active) return;
        if (!state.swapped) {
          state.blackPainted = true;
          onSwap(state.targetPhase);
          state.swapped = true;
        }
        if (fadeOverlay) fadeOverlay.style.opacity = '0';
        state.active = false;
        state.timerId = null;
      }, FADE_DURATION_MS + 40);
    },
    clear() {
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }
      state.active = false;
      if (fadeOverlay) fadeOverlay.style.opacity = '0';
    }
  };
}

function sampleSunDir(h, out) {
  if (h >= 6 && h <= 18.5) {
    const u = h <= 12.5 ? 0.5 * (h - 6) / 6.5 : 0.5 + 0.5 * (h - 12.5) / 6;
    const theta = u * Math.PI;
    const y = Math.max(0.02, Math.sin(theta) * SIN_MAX_ELEV);
    return out.set(Math.cos(theta), y, Math.sin(theta) * COS_MAX_ELEV).normalize();
  }
  if (h >= 5.5 && h < 6) return out.set(0.995, 0.04, 0.09).normalize();
  if (h > 18.5 && h < 19.5) return out.set(-0.995, 0.04, 0.09).normalize();
  return out.copy(MOON_DIR);
}

export function createPresetBlender(regionOrder, atmospheres, keyframes) {
  const parsedKeyframes = keyframes.map((kf) => {
    const colors = {};
    const nums = {};
    for (const key of COLOR_KEYS) colors[key] = new THREE.Color(kf[key]);
    for (const key of NUMBER_KEYS) nums[key] = kf[key];
    return { hour: kf.hour, colors, nums };
  });
  const parsedRegions = regionOrder.map((id) => {
    const p = atmospheres[id];
    const colors = {};
    for (const key of COLOR_KEYS) colors[key] = new THREE.Color(p[key]);
    return {
      id,
      colors,
      sunScale: p.sunIntensity / 2.6,
      hemiIntensity: p.hemiIntensity,
      fogDensity: p.fogDensity,
      exposure: p.exposure,
      envScale: p.envIntensity / 0.6
    };
  });
  const hourColors = {};
  const hourNums = {};
  const mixed = { lightDir: new THREE.Vector3() };
  for (const key of COLOR_KEYS) {
    hourColors[key] = new THREE.Color();
    mixed[key] = new THREE.Color();
  }
  for (const key of NUMBER_KEYS) {
    hourNums[key] = 0;
    mixed[key] = 0;
  }
  const regionColor = new THREE.Color();
  const tmpColor = new THREE.Color();
  return function blend(weights, hour) {
    const h = ((hour % 24) + 24) % 24;
    let a = parsedKeyframes[0];
    let b = parsedKeyframes[parsedKeyframes.length - 1];
    for (let i = 0; i < parsedKeyframes.length - 1; i++) {
      if (h >= parsedKeyframes[i].hour && h <= parsedKeyframes[i + 1].hour) {
        a = parsedKeyframes[i];
        b = parsedKeyframes[i + 1];
        break;
      }
    }
    const span = b.hour - a.hour;
    const t = span > 0 ? (h - a.hour) / span : 0;
    for (let k = 0; k < COLOR_KEYS.length; k++) {
      const key = COLOR_KEYS[k];
      hourColors[key].copy(a.colors[key]).lerp(b.colors[key], t);
    }
    for (let k = 0; k < NUMBER_KEYS.length; k++) {
      const key = NUMBER_KEYS[k];
      hourNums[key] = a.nums[key] + (b.nums[key] - a.nums[key]) * t;
    }
    for (let k = 0; k < COLOR_KEYS.length; k++) {
      const key = COLOR_KEYS[k];
      regionColor.setRGB(0, 0, 0);
      for (let i = 0; i < parsedRegions.length; i++) {
        const r = parsedRegions[i];
        const w = weights ? (weights[r.id] ?? 0) : (i === 0 ? 1 : 0);
        if (w > 0) regionColor.add(tmpColor.copy(r.colors[key]).multiplyScalar(w));
      }
      mixed[key].copy(hourColors[key]).multiply(regionColor);
    }
    let sunScale = 0;
    let hemiBase = 0;
    let fogBase = 0;
    let expBase = 0;
    let envScale = 0;
    for (let i = 0; i < parsedRegions.length; i++) {
      const r = parsedRegions[i];
      const w = weights ? (weights[r.id] ?? 0) : (i === 0 ? 1 : 0);
      sunScale += r.sunScale * w;
      hemiBase += r.hemiIntensity * w;
      fogBase += r.fogDensity * w;
      expBase += r.exposure * w;
      envScale += r.envScale * w;
    }
    mixed.sunIntensity = hourNums.sunIntensity * sunScale;
    mixed.hemiIntensity = hourNums.hemiIntensity * hemiBase;
    mixed.fogDensity = hourNums.fogDensity * fogBase;
    mixed.exposure = hourNums.exposure * expBase;
    mixed.envIntensity = hourNums.envIntensity * envScale;
    sampleSunDir(h, mixed.lightDir);
    return mixed;
  };
}
