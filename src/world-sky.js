import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { fbm } from './world-terrain.js';

const HDRI_URL = './assets/hdri/kloppenheim_06_1k.hdr';
const SKY_RADIUS = 1400;
const SKY_CUBE_SIZE = 256;
const REGION_ORDER = ['shivta', 'yoav', 'line'];
const RIDGES = [
  { radius: 640, base: 22, amp: 34, seed: 3, segments: 160 },
  { radius: 1020, base: 46, amp: 60, seed: 11, segments: 160 }
];

const ATMOSPHERES = {
  shivta: {
    zenith: '#4f86c4', horizon: '#eadfc6', horizonAway: '#dcd8c8', ground: '#d9c7a2', sunColor: '#fff2da', sunLight: '#fff1d8',
    sunDir: [0.42, 0.66, 0.4], lightDir: [0.42, 0.66, 0.4], sunIntensity: 2.4, hemiSky: '#dbe6f0', hemiGround: '#b89e70', hemiIntensity: 1.05,
    fog: '#e2d4b6', fogDensity: 0.0026, clouds: 0.2, rays: 0, ridgeNear: '#b39b78', ridgeFar: '#cfbea0', exposure: 1.0, envIntensity: 0.45
  },
  yoav: {
    zenith: '#46698f', horizon: '#d6d6d0', horizonAway: '#bcc6cc', ground: '#9a9d9a', sunColor: '#fbeedc', sunLight: '#f6ead6',
    sunDir: [-0.45, 0.42, -0.5], lightDir: [-0.45, 0.48, -0.5], sunIntensity: 2.0, hemiSky: '#cfd9e2', hemiGround: '#5e5a50', hemiIntensity: 1.1,
    fog: '#aab3b8', fogDensity: 0.0026, clouds: 0.62, rays: 0.15, ridgeNear: '#4b5052', ridgeFar: '#7d858b', exposure: 1.0, envIntensity: 0.4
  },
  line: {
    zenith: '#3d5f8e', horizon: '#ffae58', horizonAway: '#aebbcb', ground: '#a87a5a', sunColor: '#ffb25e', sunLight: '#ffc27e',
    sunDir: [-0.76, 0.045, -0.64], lightDir: [-0.74, 0.27, -0.62], sunIntensity: 2.6, hemiSky: '#f0c49c', hemiGround: '#6e5c48', hemiIntensity: 1.2,
    fog: '#9d938e', fogDensity: 0.0025, clouds: 0.58, rays: 1, ridgeNear: '#2f2a31', ridgeFar: '#5b4a4e', exposure: 1.05, envIntensity: 0.35
  }
};

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAGMENT = `
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 horizonAway; uniform vec3 groundCol; uniform vec3 sunColor; uniform vec3 sunDir;
uniform float clouds; uniform float rays;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += noise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  vec2 flatSun = normalize(sunDir.xz + 1e-4);
  float toward = pow(max(dot(normalize(d.xz + 1e-4), flatSun), 0.0), 1.6);
  vec3 horizonCol = mix(horizonAway, horizon, toward);
  vec3 col = mix(horizonCol, zenith, pow(clamp(h, 0.0, 1.0), 0.6));
  col = mix(col, horizon * 1.08 + sunColor * 0.12, pow(sd, 3.0) * (1.0 - clamp(h * 2.5, 0.0, 1.0)) * 0.6);
  col = mix(col, groundCol, smoothstep(0.0, -0.06, h));
  vec2 cp = d.xz / (max(h, 0.0) + 0.11) * 0.9;
  float c = fbm(cp * 1.7);
  float cover = smoothstep(1.0 - clouds, 1.0 - clouds + 0.32, c) * smoothstep(0.0, 0.07, h);
  vec3 cloudLit = mix(vec3(0.82, 0.84, 0.88), sunColor * 1.25 + 0.15, pow(sd, 2.0) * 0.9 + rays * 0.25);
  vec3 cloudShade = mix(zenith * 0.9, vec3(0.42, 0.45, 0.52), 0.55);
  vec3 cloudCol = mix(cloudShade, cloudLit, smoothstep(0.45, 0.85, c) * 0.7 + pow(sd, 6.0) * 0.5);
  col = mix(col, cloudCol, cover * 0.88);
  vec3 up = normalize(cross(cross(normalize(sunDir), vec3(0.0, 1.0, 0.0)), normalize(sunDir)));
  vec3 right = normalize(cross(normalize(sunDir), up));
  float ang = atan(dot(d, right), dot(d, up));
  float streak = smoothstep(0.45, 0.95, noise(vec2(ang * 9.0, 0.5))) * pow(sd, 5.0) * step(0.0, h);
  col += sunColor * streak * rays * 0.55 * (1.0 - cover * 0.6);
  col += sunColor * (pow(sd, 10.0) * 0.45 + pow(sd, 90.0) * 0.9);
  col += sunColor * smoothstep(0.99955, 0.9998, sd) * 3.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_DISPLAY_FRAGMENT = `
uniform samplerCube skyShivta; uniform samplerCube skyYoav; uniform samplerCube skyLine; uniform vec3 weights;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = textureCube(skyShivta, d).rgb * weights.x + textureCube(skyYoav, d).rgb * weights.y + textureCube(skyLine, d).rgb * weights.z;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

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

function bakeSkies(renderer) {
  const uniforms = {
    zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, horizonAway: { value: new THREE.Color() }, groundCol: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, clouds: { value: 0.3 }, rays: { value: 0 }
  };
  const bakeScene = new THREE.Scene();
  bakeScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS * 0.5, 64, 32),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false })
  ));
  return REGION_ORDER.map((id) => {
    const preset = ATMOSPHERES[id];
    uniforms.zenith.value.set(preset.zenith);
    uniforms.horizon.value.set(preset.horizon);
    uniforms.horizonAway.value.set(preset.horizonAway);
    uniforms.groundCol.value.set(preset.ground);
    uniforms.sunColor.value.set(preset.sunColor);
    uniforms.sunDir.value.set(...preset.sunDir).normalize();
    uniforms.clouds.value = preset.clouds;
    uniforms.rays.value = preset.rays;
    const target = new THREE.WebGLCubeRenderTarget(SKY_CUBE_SIZE, { type: THREE.HalfFloatType });
    new THREE.CubeCamera(1, SKY_RADIUS, target).update(renderer, bakeScene);
    return target.texture;
  });
}

export function createSky(scene, renderer) {
  const [skyShivta, skyYoav, skyLine] = bakeSkies(renderer);
  const weightsUniform = { value: new THREE.Vector3(1, 0, 0) };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: { skyShivta: { value: skyShivta }, skyYoav: { value: skyYoav }, skyLine: { value: skyLine }, weights: weightsUniform },
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
  const ridges = RIDGES.map((def, i) => {
    const mesh = new THREE.Mesh(ridgeGeometry(def), new THREE.MeshBasicMaterial({ color: 0x333333, fog: false, side: THREE.DoubleSide }));
    mesh.name = `horizon-ridge-${i}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = -1 + i * 0;
    scene.add(mesh);
    return mesh;
  });
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2(0xffffff, 0.003);

  new RGBELoader().load(HDRI_URL, (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
  }, undefined, () => {});

  const mixed = {};
  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const colorKeys = ['horizon', 'sunLight', 'hemiSky', 'hemiGround', 'fog', 'ridgeNear', 'ridgeFar'];
  const numberKeys = ['sunIntensity', 'hemiIntensity', 'fogDensity', 'exposure', 'envIntensity'];

  function blend(weights) {
    for (const key of colorKeys) {
      tmpA.setRGB(0, 0, 0);
      for (const [id, w] of Object.entries(weights)) tmpA.add(tmpB.set(ATMOSPHERES[id][key]).multiplyScalar(w));
      mixed[key] = (mixed[key] || new THREE.Color()).copy(tmpA);
    }
    for (const key of numberKeys) mixed[key] = Object.entries(weights).reduce((s, [id, w]) => s + ATMOSPHERES[id][key] * w, 0);
    for (const key of ['lightDir']) {
      const v = new THREE.Vector3();
      for (const [id, w] of Object.entries(weights)) v.add(new THREE.Vector3(...ATMOSPHERES[id][key]).multiplyScalar(w));
      mixed[key] = v.normalize();
    }
  }

  return {
    sun,
    update(weights, camera, focus) {
      blend(weights);
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
