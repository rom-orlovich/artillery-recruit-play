export const ATMOSPHERES = {
  shivta: {
    zenith: '#4f86c4', horizon: '#eadfc6', horizonAway: '#dcd8c8', ground: '#d9c7a2', sunColor: '#fff2da', sunLight: '#fff1d8',
    sunDir: [0.42, 0.66, 0.4], lightDir: [0.42, 0.66, 0.4], sunIntensity: 2.6, hemiSky: '#dbe6f0', hemiGround: '#b89e70', hemiIntensity: 2.2,
    fog: '#e2d4b6', fogDensity: 0.0026, clouds: 0.2, rays: 0, ridgeNear: '#b39b78', ridgeFar: '#cfbea0', exposure: 1.0, envIntensity: 0.6
  },
  yoav: {
    zenith: '#46698f', horizon: '#d6d6d0', horizonAway: '#bcc6cc', ground: '#9a9d9a', sunColor: '#fbeedc', sunLight: '#f6ead6',
    sunDir: [-0.45, 0.42, -0.5], lightDir: [-0.45, 0.48, -0.5], sunIntensity: 3.0, hemiSky: '#cfd9e2', hemiGround: '#5e5a50', hemiIntensity: 2.6,
    fog: '#aab3b8', fogDensity: 0.0026, clouds: 0.62, rays: 0.15, ridgeNear: '#4b5052', ridgeFar: '#7d858b', exposure: 1.0, envIntensity: 0.6
  },
  line: {
    zenith: '#7e9cc4', horizon: '#dfe0dc', horizonAway: '#cfd6dc', ground: '#8f8272', sunColor: '#fff4e2', sunLight: '#fff4e2',
    sunDir: [-0.35, 0.62, -0.5], lightDir: [-0.35, 0.62, -0.5], sunIntensity: 2.2, hemiSky: '#dfe7ef', hemiGround: '#8a7458', hemiIntensity: 3.5,
    fog: '#c9ccc8', fogDensity: 0.0022, clouds: 0.48, rays: 0, ridgeNear: '#6f6b63', ridgeFar: '#9da3a6', exposure: 1.1, envIntensity: 0.6
  }
};

export const DAY_KEYFRAMES = [
  { hour: 0, zenith: '#28303c', horizon: '#1a2840', horizonAway: '#142034', ground: '#141820', sunColor: '#9fb4d8', sunLight: '#7da2e0', sunIntensity: 0.1, hemiSky: '#283b5c', hemiGround: '#1a202c', hemiIntensity: 0.24, fog: '#0d1522', fogDensity: 1.2, ridgeNear: '#121822', ridgeFar: '#162030', exposure: 0.95, envIntensity: 0.25, rays: 0, stars: 1 },
  { hour: 5, zenith: '#28303c', horizon: '#1a2840', horizonAway: '#142034', ground: '#141820', sunColor: '#9fb4d8', sunLight: '#7da2e0', sunIntensity: 0.1, hemiSky: '#283b5c', hemiGround: '#1a202c', hemiIntensity: 0.24, fog: '#0d1522', fogDensity: 1.2, ridgeNear: '#121822', ridgeFar: '#162030', exposure: 0.95, envIntensity: 0.25, rays: 0, stars: 1 },
  { hour: 6, zenith: '#8c94b8', horizon: '#f0a06c', horizonAway: '#a8b0c8', ground: '#706054', sunColor: '#ffb878', sunLight: '#ff8a3d', sunIntensity: 0.95, hemiSky: '#c8a8a0', hemiGround: '#9c7e68', hemiIntensity: 0.55, fog: '#d89e7c', fogDensity: 1.08, ridgeNear: '#685852', ridgeFar: '#968074', exposure: 1.0, envIntensity: 0.45, rays: 0.3, stars: 0 },
  { hour: 8, zenith: '#c4d8f2', horizon: '#f4e6d0', horizonAway: '#dce4ee', ground: '#e4dac8', sunColor: '#ffe8c8', sunLight: '#ffe0b2', sunIntensity: 1.85, hemiSky: '#dce4ec', hemiGround: '#c8ba9e', hemiIntensity: 0.85, fog: '#eedcc4', fogDensity: 1.0, ridgeNear: '#c8bea8', ridgeFar: '#d8ceb8', exposure: 1.0, envIntensity: 0.55, rays: 0, stars: 0 },
  { hour: 8.5, zenith: '#d6e6fa', horizon: '#fffcf6', horizonAway: '#f0f4fa', ground: '#f6f2ea', sunColor: '#fffbf5', sunLight: '#fffbf5', sunIntensity: 2.45, hemiSky: '#f7f9fc', hemiGround: '#faf8f5', hemiIntensity: 0.95, fog: '#fffbf5', fogDensity: 1.0, ridgeNear: '#f7f6f4', ridgeFar: '#f8f7f5', exposure: 1.0, envIntensity: 0.58, rays: 0, stars: 0 },
  { hour: 12.5, zenith: '#ffffff', horizon: '#ffffff', horizonAway: '#ffffff', ground: '#ffffff', sunColor: '#ffffff', sunLight: '#ffffff', sunIntensity: 2.6, hemiSky: '#ffffff', hemiGround: '#ffffff', hemiIntensity: 1.0, fog: '#ffffff', fogDensity: 1.0, ridgeNear: '#ffffff', ridgeFar: '#ffffff', exposure: 1.0, envIntensity: 0.6, rays: 0, stars: 0 },
  { hour: 16, zenith: '#e6d6c8', horizon: '#ffe8cc', horizonAway: '#f2e4d8', ground: '#f4e8d8', sunColor: '#fff0d8', sunLight: '#fffbf5', sunIntensity: 2.45, hemiSky: '#f7f9fc', hemiGround: '#faf8f5', hemiIntensity: 0.95, fog: '#fffbf5', fogDensity: 1.0, ridgeNear: '#f7f6f4', ridgeFar: '#f8f7f5', exposure: 1.0, envIntensity: 0.58, rays: 0, stars: 0 },
  { hour: 18, zenith: '#9a849c', horizon: '#f4a65e', horizonAway: '#b098a8', ground: '#98725a', sunColor: '#ffb464', sunLight: '#ff9c42', sunIntensity: 1.15, hemiSky: '#eab48c', hemiGround: '#9c7858', hemiIntensity: 0.55, fog: '#e0a476', fogDensity: 1.08, ridgeNear: '#725e56', ridgeFar: '#a07c6a', exposure: 1.02, envIntensity: 0.4, rays: 0.65, stars: 0 },
  { hour: 19.5, zenith: '#383850', horizon: '#68383c', horizonAway: '#403442', ground: '#2c2228', sunColor: '#4a3038', sunLight: '#b83224', sunIntensity: 0.25, hemiSky: '#5a4254', hemiGround: '#382a2a', hemiIntensity: 0.3, fog: '#3c2832', fogDensity: 1.15, ridgeNear: '#2c2028', ridgeFar: '#402c32', exposure: 0.98, envIntensity: 0.28, rays: 0, stars: 0.55 },
  { hour: 21, zenith: '#28303c', horizon: '#1a2840', horizonAway: '#142034', ground: '#141820', sunColor: '#9fb4d8', sunLight: '#7da2e0', sunIntensity: 0.1, hemiSky: '#283b5c', hemiGround: '#1a202c', hemiIntensity: 0.24, fog: '#0d1522', fogDensity: 1.2, ridgeNear: '#121822', ridgeFar: '#162030', exposure: 0.95, envIntensity: 0.25, rays: 0, stars: 1 },
  { hour: 24, zenith: '#28303c', horizon: '#1a2840', horizonAway: '#142034', ground: '#141820', sunColor: '#9fb4d8', sunLight: '#7da2e0', sunIntensity: 0.1, hemiSky: '#283b5c', hemiGround: '#1a202c', hemiIntensity: 0.24, fog: '#0d1522', fogDensity: 1.2, ridgeNear: '#121822', ridgeFar: '#162030', exposure: 0.95, envIntensity: 0.25, rays: 0, stars: 1 }
];

export const LINE_DUSK = {
  zenith: '#3d5f8e', horizon: '#ffae58', horizonAway: '#aebbcb', ground: '#a87a5a', sunColor: '#ffb25e', sunLight: '#ffc27e',
  sunDir: [-0.76, 0.045, -0.64], lightDir: [-0.74, 0.27, -0.62], sunIntensity: 2.6, hemiSky: '#f0c49c', hemiGround: '#6e5c48', hemiIntensity: 1.2,
  fog: '#9d938e', fogDensity: 0.0025, clouds: 0.58, rays: 1, ridgeNear: '#2f2a31', ridgeFar: '#5b4a4e', exposure: 1.05, envIntensity: 0.35
};

const PHASES = {
  dawn: {
    zenith: '#4c6d9c', horizon: '#f0b892', horizonAway: '#9cb0c9', ground: '#7e6e5c', sunColor: '#ffd4a6', sunLight: '#ffd9b0',
    sunDir: [0.72, 0.12, 0.48], lightDir: [0.7, 0.28, 0.46], sunIntensity: 1.5, hemiSky: '#c8d4e6', hemiGround: '#6c5c4a', hemiIntensity: 1.4,
    fog: '#b2aeb2', fogDensity: 0.0028, clouds: 0.38, rays: 0.35, ridgeNear: '#47454d', ridgeFar: '#7d7a84', exposure: 1.0, envIntensity: 0.45, stars: 0
  },
  night: {
    zenith: '#0b1324', horizon: '#1c2a3f', horizonAway: '#142033', ground: '#0c1018', sunColor: '#9fb4d8', sunLight: '#9fb4d8',
    sunDir: [0.35, 0.62, -0.5], lightDir: [0.35, 0.62, -0.5], sunIntensity: 0.35, hemiSky: '#2a3d5c', hemiGround: '#151920', hemiIntensity: 0.6,
    fog: '#0e141d', fogDensity: 0.0032, clouds: 0.18, rays: 0, ridgeNear: '#0b1018', ridgeFar: '#121b29', exposure: 1.0, envIntensity: 0.25, stars: 1
  }
};

const REGION_TINT = {
  shivta: { ground: '#948369', fog: '#bfb4a4', ridgeNear: '#5e5244', ridgeFar: '#8e806f' },
  yoav: { ground: '#747572', fog: '#a3a9ae', ridgeNear: '#3e4246', ridgeFar: '#6f777e' },
  line: { ground: '#7e6e5c', fog: '#b2aeb2', ridgeNear: '#47454d', ridgeFar: '#7d7a84' }
};

export const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_CORE = `
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 horizonAway; uniform vec3 groundCol; uniform vec3 sunColor; uniform vec3 sunDir;
uniform float clouds; uniform float rays; uniform float stars;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += noise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
vec3 evalSky() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  vec2 flatSun = normalize(sunDir.xz + 1e-4);
  float toward = pow(max(dot(d.xz / max(length(d.xz), 1e-4), flatSun), 0.0), 1.6);
  vec3 horizonCol = mix(horizonAway, horizon, toward);
  vec3 col = mix(horizonCol, zenith, pow(clamp(h, 0.0, 1.0), 0.6));
  col = mix(col, horizon * 1.08 + sunColor * 0.12, pow(sd, 3.0) * (1.0 - clamp(h * 2.5, 0.0, 1.0)) * 0.6);
  col = mix(col, groundCol, (1.0 - smoothstep(-0.06, 0.0, h)));
  vec2 cp = d.xz / (max(h, 0.0) + 0.11) * 0.9;
  float c = fbm(cp * 1.7);
  float cover = smoothstep(1.0 - clouds, 1.0 - clouds + 0.32, c) * smoothstep(0.0, 0.07, h);
  vec3 cloudLit = mix(vec3(0.82, 0.84, 0.88), sunColor * 1.25 + 0.15, pow(sd, 2.0) * 0.9 + rays * 0.25);
  vec3 cloudShade = mix(zenith * 0.9, vec3(0.42, 0.45, 0.52), 0.55);
  vec3 cloudCol = mix(cloudShade, cloudLit, smoothstep(0.45, 0.85, c) * 0.7 + pow(sd, 6.0) * 0.5);
  cloudCol = mix(cloudCol, mix(zenith * 0.8, horizon * 0.9, 0.4) + sunColor * 0.08 * pow(sd, 3.0), stars * 0.9);
  col = mix(col, cloudCol, cover * 0.88);
  vec3 up = normalize(cross(cross(normalize(sunDir), vec3(0.0, 1.0, 0.0)), normalize(sunDir)));
  vec3 right = normalize(cross(normalize(sunDir), up));
  float ang = atan(dot(d, right), dot(d, up) + 1e-5);
  float streak = smoothstep(0.45, 0.95, noise(vec2(ang * 9.0, 0.5))) * pow(sd, 5.0) * step(0.0, h);
  col += sunColor * streak * rays * 0.55 * (1.0 - cover * 0.6);
  col += sunColor * (pow(sd, 10.0) * 0.45 + pow(sd, 90.0) * 0.9) * mix(1.0, 0.35, stars);
  col += sunColor * smoothstep(0.99955, 0.9998, sd) * 3.0 * mix(1.0, 0.45, stars);
  vec3 sp = d * 110.0;
  vec3 cell = floor(sp);
  vec3 f = fract(sp) - 0.5;
  float s = hash3(cell);
  float star = (1.0 - smoothstep(0.06, 0.42, length(f))) * step(0.984, s);
  float mag = fract(s * 173.3);
  float starMask = smoothstep(0.05, 0.22, h) * (1.0 - cover * 0.85) * stars;
  col += mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.95, 0.86), mag) * star * (0.45 + 0.75 * mag) * starMask;
  return col;
}`;

export const SKY_FRAGMENT = `${SKY_CORE}
void main() {
  gl_FragColor = vec4(evalSky(), 1.0);
}`;

export const SKY_DOME_FRAGMENT = `${SKY_CORE}
void main() {
  gl_FragColor = vec4(evalSky(), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function getPhasePreset(regionId, phase) {
  if (phase === 'day') return ATMOSPHERES[regionId];
  if (phase === 'dusk') return LINE_DUSK;
  if (phase === 'night') return PHASES.night;
  const tint = REGION_TINT[regionId] || REGION_TINT.line;
  return { ...PHASES.dawn, ...tint };
}
