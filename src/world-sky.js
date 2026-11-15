import * as THREE from 'three';
import { ensureTimeOfDay, getSkyPhase, setTimeOfDay, registerTimeListener } from './world-time.js';
import {
  ATMOSPHERES,
  DAY_KEYFRAMES,
  LINE_DUSK,
  SKY_VERTEX,
  SKY_FRAGMENT,
  SKY_DISPLAY_FRAGMENT,
  getPhasePreset
} from './world-sky-presets.js';
import {
  createHorizonRidges,
  createEnvManager,
  createHeadlampController,
  createFadeController,
  createPresetBlender
} from './world-sky-env.js';

export { getSkyPhase, setTimeOfDay, LINE_DUSK };

const SKY_RADIUS = 1400;
const SKY_CUBE_SIZE = 256;
const REGION_ORDER = ['shivta', 'yoav', 'line'];

let activeDispose = null;

export function disposeSky() {
  if (!activeDispose) return;
  const fn = activeDispose;
  activeDispose = null;
  fn();
}

export function createSky(scene, renderer) {
  disposeSky();
  const bakeUniforms = {
    zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, horizonAway: { value: new THREE.Color() }, groundCol: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, clouds: { value: 0.3 }, rays: { value: 0 }, stars: { value: 0 }
  };
  const bakeScene = new THREE.Scene();
  const bakeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS * 0.5, 64, 32),
    new THREE.ShaderMaterial({ uniforms: bakeUniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false })
  );
  bakeScene.add(bakeMesh);
  const targets = REGION_ORDER.map(() => new THREE.WebGLCubeRenderTarget(SKY_CUBE_SIZE, { type: THREE.HalfFloatType }));
  const cubeCams = targets.map((target) => new THREE.CubeCamera(1, SKY_RADIUS, target));

  function renderSkyTargets(phase) {
    const prevTarget = renderer.getRenderTarget();
    REGION_ORDER.forEach((id, i) => {
      const preset = getPhasePreset(id, phase);
      bakeUniforms.zenith.value.set(preset.zenith);
      bakeUniforms.horizon.value.set(preset.horizon);
      bakeUniforms.horizonAway.value.set(preset.horizonAway);
      bakeUniforms.groundCol.value.set(preset.ground);
      bakeUniforms.sunColor.value.set(preset.sunColor);
      bakeUniforms.sunDir.value.set(...preset.sunDir).normalize();
      bakeUniforms.clouds.value = preset.clouds;
      bakeUniforms.rays.value = preset.rays;
      bakeUniforms.stars.value = preset.stars || 0;
      cubeCams[i].update(renderer, bakeScene);
    });
    renderer.setRenderTarget(prevTarget);
  }

  let currentPhase = getSkyPhase();
  renderSkyTargets(currentPhase);

  const weightsUniform = { value: new THREE.Vector3(1, 0, 0) };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: {
        skyShivta: { value: targets[0].texture },
        skyYoav: { value: targets[1].texture },
        skyLine: { value: targets[2].texture },
        weights: weightsUniform
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_DISPLAY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    })
  );
  dome.name = 'sky-dome';
  dome.frustumCulled = false;
  dome.renderOrder = -2;
  scene.add(dome);

  const ridges = createHorizonRidges(scene);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2(0xffffff, 0.003);

  const envManager = createEnvManager(scene, renderer, targets, REGION_ORDER);
  envManager.syncEnvMap(currentPhase, null);
  const headlamp = createHeadlampController();
  const blend = createPresetBlender(REGION_ORDER, ATMOSPHERES, DAY_KEYFRAMES);
  let lastWeights = { shivta: 1, yoav: 0, line: 0 };
  let lastCamera = null;
  let initialized = false;

  const fade = createFadeController(currentPhase, (nextPhase) => {
    currentPhase = nextPhase;
    renderSkyTargets(currentPhase);
    envManager.syncEnvMap(currentPhase, lastWeights);
    headlamp.sync(lastCamera, currentPhase === 'night');
  });

  registerTimeListener(() => {
    const nextPhase = getSkyPhase();
    if (nextPhase !== currentPhase) fade.start(nextPhase);
  });

  activeDispose = () => {
    registerTimeListener(null);
    fade.clear();
    envManager.dispose();
    for (const target of targets) target.dispose();
    headlamp.dispose();
    bakeMesh.geometry.dispose();
    bakeMesh.material.dispose();
    dome.geometry.dispose();
    dome.material.dispose();
    for (const ridge of ridges) {
      ridge.geometry.dispose();
      ridge.material.dispose();
    }
  };

  return {
    sun,
    update(weights, camera, focus) {
      lastWeights = weights;
      lastCamera = camera;
      if (!initialized) {
        initialized = true;
        headlamp.sync(camera, currentPhase === 'night');
      }
      const nextPhase = getSkyPhase();
      if (nextPhase !== currentPhase) fade.start(nextPhase);
      fade.step();
      envManager.syncEnvMap(currentPhase, weights);
      const mixed = blend(weights, ensureTimeOfDay());
      weightsUniform.value.set(weights.shivta, weights.yoav, weights.line);
      dome.position.copy(camera.position);
      ridges[0].material.color.copy(mixed.ridgeNear).lerp(mixed.horizon, 0.18);
      ridges[1].material.color.copy(mixed.ridgeFar).lerp(mixed.horizon, 0.38);
      for (const ridge of ridges) ridge.position.set(camera.position.x, 0, camera.position.z);
      hemi.color.copy(mixed.hemiSky);
      hemi.groundColor.copy(mixed.hemiGround);
      hemi.intensity = mixed.hemiIntensity;
      sun.color.copy(mixed.sunLight);
      sun.intensity = mixed.sunIntensity;
      sun.target.position.set(focus.x, 0, focus.z);
      sun.position.set(focus.x + mixed.lightDir.x * 120, mixed.lightDir.y * 120, focus.z + mixed.lightDir.z * 120);
      scene.fog.color.copy(mixed.fog);
      scene.fog.density = mixed.fogDensity;
      scene.environmentIntensity = mixed.envIntensity;
      renderer.toneMappingExposure = mixed.exposure;
    }
  };
}
