import * as THREE from 'three';

export const MAP_BIOMES = {
  shivta: {
    bounds: [-210, 210, -132, 105],
    tileSize: 210,
    palette: {
      dirt: '#c8b186',
      dry: '#d6c39a',
      rock: '#9e8b6a',
      grass: '#b5a376',
      road: '#6b6a66',
      concrete: '#c7beaa',
      roof: '#8c4c38'
    },
    skyPreset: 'negev',
    skylineProfile: {
      near: { base: 14, amp: 22, seed: 3, colorBottom: '#9e8868', colorTop: '#b8a280', peaks: [] },
      far: { base: 26, amp: 32, seed: 11, colorBottom: '#b8a88c', colorTop: '#d4c6ab', peaks: [] }
    }
  },
  yoav: {
    bounds: [-190, -35, -230, -125],
    tileSize: 160,
    palette: {
      dirt: '#a88c62',
      dry: '#b99e72',
      rock: '#787268',
      grass: '#8f885e',
      road: '#5e5f61',
      concrete: '#b8b2a2',
      roof: '#7c4636'
    },
    skyPreset: 'negev',
    skylineProfile: {
      near: { base: 18, amp: 28, seed: 7, colorBottom: '#5a5f58', colorTop: '#767c72', peaks: [] },
      far: { base: 34, amp: 44, seed: 15, colorBottom: '#78828a', colorTop: '#96a2ab', peaks: [] }
    }
  },
  line: {
    bounds: [-210, 210, -450, -195],
    tileSize: 210,
    palette: {
      dirt: '#745b38',
      dry: '#7d6840',
      rock: '#5c4e3c',
      grass: '#6d5e39',
      road: '#574f44',
      concrete: '#847862',
      roof: '#4e5244'
    },
    skyPreset: 'golan',
    skylineProfile: {
      near: { base: 22, amp: 36, seed: 5, colorBottom: '#5b5852', colorTop: '#747068', peaks: [] },
      far: { base: 44, amp: 56, seed: 13, colorBottom: '#7f8992', colorTop: '#a4aeb5', peaks: [] }
    }
  },
  zaura: {
    bounds: [-140, 140, -140, 140],
    tileSize: 140,
    palette: {
      dirt: '#8a6b48',
      dry: '#9a8a5e',
      rock: '#4a3f38',
      grass: '#766e4c',
      road: '#626262',
      concrete: '#b8ae98',
      roof: '#b9c4cb'
    },
    skyPreset: 'golan',
    skylineProfile: {
      near: {
        base: 18,
        amp: 28,
        seed: 19,
        colorBottom: '#5c5850',
        colorTop: '#747068',
        peaks: [
          { az: 2.1, width: 0.45, height: 46 },
          { az: -1.1, width: 0.7, height: -18 }
        ]
      },
      far: {
        base: 38,
        amp: 42,
        seed: 23,
        colorBottom: '#7e8e9c',
        colorTop: '#a2adb2',
        snowLine: 92,
        snowColor: '#e8eef2',
        peaks: [{ az: -1.15, width: 0.55, height: 95 }]
      }
    }
  },
  beit_hillel: {
    bounds: [-140, 140, -140, 140],
    tileSize: 140,
    palette: {
      dirt: '#9a6b45',
      dry: '#8a7248',
      rock: '#635c54',
      grass: '#5e733b',
      road: '#626468',
      concrete: '#d0cab8',
      roof: '#e3e2da'
    },
    skyPreset: 'hula',
    skylineProfile: {
      near: {
        base: 10,
        amp: 14,
        seed: 29,
        colorBottom: '#6c7268',
        colorTop: '#969c88',
        peaks: [
          { az: Math.PI, width: 0.85, height: 68 },
          { az: 0, width: 0.85, height: 72 }
        ]
      },
      far: {
        base: 24,
        amp: 28,
        seed: 31,
        colorBottom: '#7a8ea2',
        colorTop: '#92a5b6',
        snowLine: 95,
        snowColor: '#f0f4f8',
        peaks: [{ az: -1.1, width: 0.55, height: 112 }]
      }
    }
  }
};

function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function ridgeFbm(x, z) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += noise2(x * freq + i * 17.3, z * freq - i * 9.1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function buildSkylineRing(radius, cfg) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 96, 1, true);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cBottom = new THREE.Color(cfg.colorBottom);
  const cTop = new THREE.Color(cfg.colorTop);
  const cSnow = cfg.snowColor ? new THREE.Color(cfg.snowColor) : null;
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const az = Math.atan2(z, x);
    const n = ridgeFbm(Math.cos(az) * 3 + cfg.seed, Math.sin(az) * 3 - cfg.seed);
    let peak = cfg.base + Math.pow(n, 1.55) * cfg.amp * 1.5;
    if (cfg.peaks) {
      for (const p of cfg.peaks) {
        const d = Math.abs(angleDiff(az, p.az)) / p.width;
        if (d < 1) {
          const w = 0.5 + 0.5 * Math.cos(Math.PI * d);
          peak += p.height * w;
        }
      }
    }
    peak = Math.max(4, peak);
    if (y > 0) {
      pos.setY(i, peak);
      tmp.copy(cTop);
      if (cSnow && cfg.snowLine && peak > cfg.snowLine) {
        const t = Math.min(1, (peak - cfg.snowLine) / 22);
        tmp.lerp(cSnow, t * 0.88);
      }
    } else {
      pos.setY(i, -60);
      tmp.copy(cBottom);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.raycast = () => {};
  return mesh;
}

export function buildMapSkyline(mapId) {
  const biome = MAP_BIOMES[mapId] || MAP_BIOMES.shivta;
  const group = new THREE.Group();
  group.name = `skyline-${mapId}`;
  group.frustumCulled = false;
  const near = buildSkylineRing(780, biome.skylineProfile.near);
  near.name = `skyline-${mapId}-near`;
  const far = buildSkylineRing(1180, biome.skylineProfile.far);
  far.name = `skyline-${mapId}-far`;
  group.add(far, near);
  return group;
}
