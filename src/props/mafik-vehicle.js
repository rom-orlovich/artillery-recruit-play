import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createMafikVehicle() {
  const group = new THREE.Group();
  const colors = [0x817b56, 0x948c62, 0x655f42, 0x25241f, 0x494733, 0xaaa078, 0xc6c0a1, 0x272e30];
  const parts = colors.map(() => []);
  const put = (g, m, p = [0, 0, 0], r = [0, 0, 0]) => {
    g.rotateX(r[0]); g.rotateY(r[1]); g.rotateZ(r[2]);
    g.translate(...p); parts[m].push(g);
  };
  const box = (m, w, h, d, x, y, z, r = [0, 0, 0]) => put(new THREE.BoxGeometry(w, h, d), m, [x, y, z], r);
  const cyl = (m, rt, rb, h, seg, x, y, z, r = [0, 0, 0]) => put(new THREE.CylinderGeometry(rt, rb, h, seg), m, [x, y, z], r);
  const rod = (m, a, b, radius, seg = 5) => {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const g = new THREE.CylinderGeometry(radius, radius, v.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    parts[m].push(g);
  };
  const side = (m, profile, width) => {
    const n = profile.length, verts = [], indices = [];
    for (const x of [-width / 2, width / 2]) for (const [z, y] of profile) verts.push(x, y, z);
    for (let i = 1; i < n - 1; i++) { indices.push(0, i + 1, i, n, n + i, n + i + 1); }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(i, j, n + j, i, n + j, n + i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(verts.length / 3 * 2).fill(0), 2));
    g.setIndex(indices); g.computeVertexNormals(); parts[m].push(g);
  };
  side(0, [[-2.39, .69], [2.38, .69], [2.47, 1.01], [2.02, 1.95], [1.55, 2.34], [.93, 2.54], [-2.35, 2.54]], 2.42);
  box(1, 2.44, .11, 3.23, 0, 2.58, -.7);
  box(2, 2.48, .1, 4.5, 0, .76, -.05);
  side(1, [[1.94, 1.99], [2.45, 1.02], [1.87, 1.08], [1.49, 2.15]], 2.47);
  box(1, 1.86, .055, .88, 0, 2.14, 1.42, [-.55, 0, 0]);
  for (const s of [-1, 1]) {
    const x = s * 1.31;
    box(2, .16, .48, 3.8, x, 1.22, -.13);
    box(1, .06, .11, 4.05, s * 1.25, 1.53, -.2);
    box(4, .055, .065, 3.45, s * 1.25, 1.71, -.38);
    for (let i = 0; i < 5; i++) {
      const z = -1.52 + i * .76;
      cyl(3, .42, .42, .15, 14, s * 1.24, .46, z, [0, 0, Math.PI / 2]);
      cyl(1, .335, .335, .17, 14, s * 1.35, .46, z, [0, 0, Math.PI / 2]);
      cyl(2, .225, .225, .18, 12, s * 1.37, .46, z, [0, 0, Math.PI / 2]);
      cyl(1, .082, .082, .19, 9, s * 1.4, .46, z, [0, 0, Math.PI / 2]);
    }
    for (const z of [-2.05, 2.04]) {
      cyl(3, .36, .36, .16, 12, s * 1.25, .58, z, [0, 0, Math.PI / 2]);
      cyl(2, .265, .265, .18, 12, s * 1.37, .58, z, [0, 0, Math.PI / 2]);
      cyl(1, .09, .09, .19, 8, s * 1.4, .58, z, [0, 0, Math.PI / 2]);
    }
    box(3, .27, .16, 3.85, s * 1.31, .12, 0);
    box(3, .27, .12, 3.85, s * 1.31, .98, 0);
    for (let i = 0; i < 33; i++) {
      const z = -1.9 + i * 3.8 / 32;
      box(3, .29, .085, .105, s * 1.34, .11, z);
      box(4, .29, .075, .105, s * 1.34, .98, z);
    }
    for (const z of [-2.13, 2.12]) for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 6 + (z < 0 ? Math.PI : 0);
      box(3, .29, .1, .19, s * 1.34, .55 + Math.sin(a) * .44, z + Math.cos(a) * .27, [a, 0, 0]);
    }
    box(1, .17, .18, 4.2, s * 1.32, 1.6, -.11);
    for (const z of [-1.76, -.95, .06, .9]) {
      box(2, .035, .034, .35, s * 1.245, 1.78, z);
      box(2, .035, .29, .035, s * 1.245, 1.91, z - .17);
    }
    for (const z of [-2.13, -.45, 1.25]) {
      rod(2, [s * 1.265, 1.91, z - .1], [s * 1.36, 1.91, z - .1], .024);
      rod(2, [s * 1.36, 1.91, z - .1], [s * 1.36, 1.91, z + .16], .024);
      rod(2, [s * 1.36, 1.91, z + .16], [s * 1.265, 1.91, z + .16], .024);
    }
  }
  box(1, .055, 1.05, .83, -1.246, 2.04, -.45);
  box(2, .035, 1.07, .04, -1.287, 2.04, -.86);
  box(2, .035, 1.07, .04, -1.287, 2.04, -.04);
  box(2, .035, .04, .84, -1.287, 2.55, -.45);
  box(2, .035, .04, .84, -1.287, 1.51, -.45);
  box(2, .12, .08, .035, -1.32, 2.19, -.86);
  box(2, .12, .08, .035, -1.32, 1.73, -.86);
  rod(2, [-1.31, 1.89, -.19], [-1.39, 1.89, -.19], .018);
  rod(2, [-1.39, 1.89, -.19], [-1.39, 2.13, -.19], .018);
  box(2, .65, .56, .055, 0, 1.9, 2.25, [-.48, 0, 0]);
  box(2, 1.64, .045, .065, 0, 1.36, 2.33);
  for (const s of [-1, 1]) {
    box(2, .045, .65, .045, s * .84, 1.65, 2.18, [-.48, 0, 0]);
    box(2, .055, .39, .4, s * 1.0, 1.45, 2.07);
    for (const dx of [-.1, .1]) {
      cyl(4, .125, .125, .07, 12, s * 1.04 + dx, 1.52, 2.32, [Math.PI / 2, 0, 0]);
      cyl(6, .073, .073, .075, 12, s * 1.04 + dx, 1.52, 2.37, [Math.PI / 2, 0, 0]);
    }
    cyl(2, .075, .075, .07, 10, s * 1.04, 1.24, 2.32, [Math.PI / 2, 0, 0]);
    for (const h of [1.21, 1.79]) rod(2, [s * .79, h, 2.43], [s * 1.3, h, 2.43], .026);
    for (const xx of [.79, 1.3]) rod(2, [s * xx, 1.21, 2.43], [s * xx, 1.79, 2.43], .026);
    rod(2, [s * .63, 1.14, 2.48], [s * .63, 1.44, 2.48], .033);
    rod(2, [s * .63, 1.44, 2.48], [s * .75, 1.44, 2.45], .033);
  }
  box(2, 1.65, .075, .07, 0, .97, 2.45);
  for (const x of [-.58, .58]) {
    box(4, .32, .19, .07, x, 2.23, 1.72, [-.55, 0, 0]);
    box(7, .23, .095, .018, x, 2.28, 1.76, [-.55, 0, 0]);
  }
  box(1, .82, .08, .65, 0, 2.65, .91);
  box(2, .87, .045, .047, 0, 2.69, 1.24);
  cyl(1, .21, .23, .16, 12, .76, 2.7, .58);
  cyl(2, .27, .27, .04, 12, .76, 2.79, .58);
  box(2, .55, .18, .1, -.42, 2.75, -.25);
  box(3, .5, .14, .04, -.42, 2.75, -.18);
  for (let i = 0; i < 7; i++) rod(2, [-.65 + i * .075, 2.69, -.16], [-.65 + i * .075, 2.81, -.16], .012, 4);
  box(5, 2.5, .18, .7, 0, 2.52, -2.02);
  box(5, 2.51, .92, .12, 0, 2.05, -2.43);
  for (const x of [-1.23, 1.23]) box(2, .045, .87, .1, x, 2.04, -2.45);
  for (let i = 0; i < 8; i++) box(i % 2 ? 5 : 2, 2.44, .018, .024, 0, 2.61, -2.34 + i * .093);
  for (const z of [-2.39, -1.75]) rod(2, [-1.22, 2.64, z], [1.22, 2.64, z], .026);
  for (const [x, z, h] of [[-1.0, -1.2, 2.63], [.76, -.58, 2.68], [.17, .7, 2.67], [1.03, 1.52, 2.33]]) {
    cyl(2, .12, .16, .09, 8, x, h, z);
    cyl(4, .055, .08, .2, 8, x, h + .12, z);
    rod(2, [x, h + .2, z], [x + .035, h + 2.75, z + .015], .013, 5);
    cyl(3, .021, .021, .025, 6, x + .035, h + 2.76, z + .015);
  }
  const mats = colors.map((c, i) => new THREE.MeshStandardMaterial({ color: c, roughness: i === 7 ? .25 : .94, metalness: i === 2 || i === 4 ? .2 : .04, side: THREE.DoubleSide }));
  parts.forEach((geoms, i) => {
    if (!geoms.length) return;
    const merged = mergeGeometries(geoms, false);
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, mats[i]);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    geoms.forEach(g => g.dispose());
  });
  group.scale.x = .91;
  group.name = 'Mafik M577 command vehicle';
  return group;
}
