import * as THREE from 'three';
import { fbm } from './world-terrain.js';
import { SKY_VERTEX, SKY_FRAGMENT } from './world-sky-presets.js';

const RIDGES = [
  { radius: 640, base: 22, amp: 34, seed: 3, segments: 160 },
  { radius: 1020, base: 46, amp: 60, seed: 11, segments: 160 }
];
const COLOR_KEYS = [
  'zenith',
  'horizon',
  'horizonAway',
  'ground',
  'sunColor',
  'sunLight',
  'hemiSky',
  'hemiGround',
  'fog',
  'ridgeNear',
  'ridgeFar'
];
const NUMBER_KEYS = ['sunIntensity', 'hemiIntensity', 'fogDensity', 'exposure', 'envIntensity', 'rays', 'stars'];
const MAX_SUN_ELEV = (63 * Math.PI) / 180;
const SIN_MAX_ELEV = Math.sin(MAX_SUN_ELEV);
const COS_MAX_ELEV = Math.cos(MAX_SUN_ELEV);
const MOON_DIR = new THREE.Vector3(0.35, 0.62, -0.5).normalize();
const ENV_REFRESH_HOURS = 0.5;
const ENV_COLOR_THRESHOLD = 0.03;
const ENV_CACHE_LIMIT = 2;

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

function colorDiffSum(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
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

export function createEnvManager(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const bakeUniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    horizonAway: { value: new THREE.Color() },
    groundCol: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() },
    clouds: { value: 0.3 },
    rays: { value: 0 },
    stars: { value: 0 }
  };
  const bakeScene = new THREE.Scene();
  const bakeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: bakeUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  bakeScene.add(bakeMesh);
  const cubeTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(1, 100, cubeTarget);
  const liveTargets = [];
  let hasEnv = false;
  let lastHour = 0;
  const lastZenith = new THREE.Color();
  const lastHorizon = new THREE.Color();
  const lastHorizonAway = new THREE.Color();
  const lastGround = new THREE.Color();

  return {
    syncEnvMap(hour, uniforms) {
      if (hasEnv) {
        const rawDiff = Math.abs(hour - lastHour);
        const hourDiff = Math.min(rawDiff, 24 - rawDiff);
        if (hourDiff < ENV_REFRESH_HOURS) return;
        const delta =
          colorDiffSum(uniforms.zenith.value, lastZenith) +
          colorDiffSum(uniforms.horizon.value, lastHorizon) +
          colorDiffSum(uniforms.horizonAway.value, lastHorizonAway) +
          colorDiffSum(uniforms.groundCol.value, lastGround);
        if (delta < ENV_COLOR_THRESHOLD) return;
      }
      bakeUniforms.zenith.value.copy(uniforms.zenith.value);
      bakeUniforms.horizon.value.copy(uniforms.horizon.value);
      bakeUniforms.horizonAway.value.copy(uniforms.horizonAway.value);
      bakeUniforms.groundCol.value.copy(uniforms.groundCol.value);
      bakeUniforms.sunColor.value.copy(uniforms.sunColor.value);
      bakeUniforms.sunDir.value.copy(uniforms.sunDir.value);
      bakeUniforms.clouds.value = uniforms.clouds.value;
      bakeUniforms.rays.value = uniforms.rays.value;
      bakeUniforms.stars.value = uniforms.stars.value;

      const prevTarget = renderer.getRenderTarget();
      cubeCam.update(renderer, bakeScene);
      const nextTarget = pmrem.fromCubemap(cubeTarget.texture);
      renderer.setRenderTarget(prevTarget);
      scene.environment = nextTarget.texture;
      liveTargets.push(nextTarget);
      while (liveTargets.length > ENV_CACHE_LIMIT) {
        liveTargets.shift().dispose();
      }
      hasEnv = true;
      lastHour = hour;
      lastZenith.copy(uniforms.zenith.value);
      lastHorizon.copy(uniforms.horizon.value);
      lastHorizonAway.copy(uniforms.horizonAway.value);
      lastGround.copy(uniforms.groundCol.value);
    },
    dispose() {
      for (const target of liveTargets) target.dispose();
      liveTargets.length = 0;
      cubeTarget.dispose();
      bakeMesh.geometry.dispose();
      bakeMesh.material.dispose();
      pmrem.dispose();
      hasEnv = false;
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
      envScale: p.envIntensity / 0.6,
      clouds: p.clouds,
      rays: p.rays
    };
  });
  const hourColors = {};
  const hourNums = {};
  const mixed = { lightDir: new THREE.Vector3(), clouds: 0 };
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
    let cloudsBase = 0;
    let raysBase = 0;
    for (let i = 0; i < parsedRegions.length; i++) {
      const r = parsedRegions[i];
      const w = weights ? (weights[r.id] ?? 0) : (i === 0 ? 1 : 0);
      sunScale += r.sunScale * w;
      hemiBase += r.hemiIntensity * w;
      fogBase += r.fogDensity * w;
      expBase += r.exposure * w;
      envScale += r.envScale * w;
      cloudsBase += r.clouds * w;
      raysBase += r.rays * w;
    }
    mixed.sunIntensity = hourNums.sunIntensity * sunScale;
    mixed.hemiIntensity = hourNums.hemiIntensity * hemiBase;
    mixed.fogDensity = hourNums.fogDensity * fogBase;
    mixed.exposure = hourNums.exposure * expBase;
    mixed.envIntensity = hourNums.envIntensity * envScale;
    mixed.clouds = cloudsBase;
    mixed.rays = Math.min(1, hourNums.rays + raysBase * (1 - hourNums.stars));
    mixed.stars = hourNums.stars;
    sampleSunDir(h, mixed.lightDir);
    return mixed;
  };
}
