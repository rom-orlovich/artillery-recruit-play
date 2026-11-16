import * as THREE from 'three';
import { MAP_BIOMES } from './maps/map-biomes.js';
import { ensureTimeOfDay, getSkyPhase, setTimeOfDay, registerTimeListener } from './world-time.js';
import { getActiveTerrainMap } from './world-terrain.js';
import {
  ATMOSPHERES,
  DAY_KEYFRAMES,
  LINE_DUSK,
  SKY_VERTEX,
  SKY_DOME_FRAGMENT
} from './world-sky-presets.js';
import {
  createEnvManager,
  createHeadlampController,
  createPresetBlender
} from './world-sky-env.js';

export { getSkyPhase, setTimeOfDay, LINE_DUSK };

const SKY_RADIUS = 1400;
const PRESET_ORDER = ['negev', 'golan', 'galilee', 'hula', 'shivta', 'yoav', 'line'];

let activeDispose = null;
let activeSky = null;
let pendingMapId = 'shivta';

function resolvePreset(mapId) {
  if (ATMOSPHERES[mapId]) return mapId;
  const preset = MAP_BIOMES[mapId]?.skyPreset;
  if (preset && ATMOSPHERES[preset]) return preset;
  return 'negev';
}

export function disposeSky() {
  if (!activeDispose) return;
  const fn = activeDispose;
  activeDispose = null;
  activeSky = null;
  fn();
}

export function applyMapAtmosphere(mapId) {
  pendingMapId = mapId || 'shivta';
  if (!activeSky) return;
  activeSky.mapId = pendingMapId;
  activeSky.preset = resolvePreset(pendingMapId);
  const hour = ensureTimeOfDay();
  const mixed = activeSky.blend({ [activeSky.preset]: 1 }, hour);
  activeSky.applyUniforms(mixed);
  activeSky.scene.fog.color.copy(mixed.fog);
  activeSky.scene.fog.density = mixed.fogDensity;
  activeSky.scene.environmentIntensity = mixed.envIntensity;
  activeSky.renderer.toneMappingExposure = mixed.exposure;
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
  dome.raycast = () => {};
  scene.add(dome);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2(0xffffff, 0.0025);

  const envManager = createEnvManager(scene, renderer);
  const headlamp = createHeadlampController();
  const blend = createPresetBlender(PRESET_ORDER, ATMOSPHERES, DAY_KEYFRAMES);

  function applyUniforms(mixed) {
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

  const initialMapId = pendingMapId === 'shivta' ? getActiveTerrainMap() : pendingMapId;
  activeSky = {
    scene,
    renderer,
    blend,
    applyUniforms,
    mapId: initialMapId,
    preset: resolvePreset(initialMapId)
  };

  const initHour = ensureTimeOfDay();
  applyUniforms(blend({ [activeSky.preset]: 1 }, initHour));
  envManager.syncEnvMap(initHour, skyUniforms);

  activeDispose = () => {
    registerTimeListener(null);
    envManager.dispose();
    headlamp.dispose();
    dome.geometry.dispose();
    dome.material.dispose();
  };

  return {
    sun,
    update(weights, camera, focus) {
      const currentMap = getActiveTerrainMap();
      if (currentMap && currentMap !== activeSky.mapId) {
        activeSky.mapId = currentMap;
        activeSky.preset = resolvePreset(currentMap);
      }
      const hour = ensureTimeOfDay();
      headlamp.sync(camera, getSkyPhase(hour) === 'night');
      const presetWeights = weights && weights[activeSky.preset] !== undefined ? weights : { [activeSky.preset]: 1 };
      const mixed = blend(presetWeights, hour);
      applyUniforms(mixed);
      envManager.syncEnvMap(hour, skyUniforms);
      dome.position.copy(camera.position);
      const skyline = scene.getObjectByName(`skyline-${activeSky.mapId}`);
      if (skyline) {
        skyline.position.set(camera.position.x, 0, camera.position.z);
        for (const child of skyline.children) {
          if (child.material?.color) {
            child.material.color.copy(child.name.endsWith('-far') ? mixed.ridgeFar : mixed.ridgeNear);
          }
        }
      }
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
