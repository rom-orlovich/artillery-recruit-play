import * as THREE from 'three';
import { ensureTimeOfDay, getSkyPhase, setTimeOfDay, registerTimeListener } from './world-time.js';
import {
  ATMOSPHERES,
  DAY_KEYFRAMES,
  LINE_DUSK,
  SKY_VERTEX,
  SKY_DOME_FRAGMENT
} from './world-sky-presets.js';
import {
  createHorizonRidges,
  createEnvManager,
  createHeadlampController,
  createPresetBlender
} from './world-sky-env.js';

export { getSkyPhase, setTimeOfDay, LINE_DUSK };

const SKY_RADIUS = 1400;
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
  const skyUniforms = {
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
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_DOME_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    })
  );
  dome.name = 'sky-dome';
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  scene.add(dome);

  const ridges = createHorizonRidges(scene);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2(0xffffff, 0.003);

  const envManager = createEnvManager(scene, renderer);
  const headlamp = createHeadlampController();
  const blend = createPresetBlender(REGION_ORDER, ATMOSPHERES, DAY_KEYFRAMES);

  function applySkyUniforms(mixed) {
    skyUniforms.zenith.value.copy(mixed.zenith);
    skyUniforms.horizon.value.copy(mixed.horizon);
    skyUniforms.horizonAway.value.copy(mixed.horizonAway);
    skyUniforms.groundCol.value.copy(mixed.ground);
    skyUniforms.sunColor.value.copy(mixed.sunColor);
    skyUniforms.sunDir.value.copy(mixed.lightDir);
    skyUniforms.clouds.value = mixed.clouds;
    skyUniforms.rays.value = mixed.rays;
    skyUniforms.stars.value = mixed.stars;
  }

  const initHour = ensureTimeOfDay();
  applySkyUniforms(blend(null, initHour));
  envManager.syncEnvMap(initHour, skyUniforms);

  activeDispose = () => {
    registerTimeListener(null);
    envManager.dispose();
    headlamp.dispose();
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
      const hour = ensureTimeOfDay();
      headlamp.sync(camera, getSkyPhase(hour) === 'night');
      const mixed = blend(weights, hour);
      applySkyUniforms(mixed);
      envManager.syncEnvMap(hour, skyUniforms);
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
