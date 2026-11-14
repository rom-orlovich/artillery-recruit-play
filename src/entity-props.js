import * as THREE from 'three';
import { LANDMARKS, ENEMY_TYPES } from './config.js';
import { getTerrainHeight } from './world-terrain.js';

const SHELL_OFFSETS = [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]];
const ROEM_NODE_OFFSETS = [[-2.2, 0.5], [2.2, 0.5], [3.0, -3.5]];
const ROEM_TARGET_OFFSETS = [[-11, -48], [-6, -54], [-2, -58], [2, -58], [6, -54], [11, -48]];
const TRANSMITTER_XS = [-36, -12, 12, 36];
const TRANSMITTER_DZ = -22;
const DISH_OFFSETS = [[-6, -3.5], [6, -3.5], [0, 0.5]];
const CHECKPOINT_OFFSETS = [[0, 18, 'שער מוצב צוקית'], [-16, 4, 'עמדה מערבית'], [0, -14, 'תצפית צפונית'], [16, 4, 'עמדה מזרחית']];
const offsetFrom = (origin, offsets) => offsets.map(([dx, dz, ...rest]) => [origin.x + dx, origin.z + dz, ...rest]);

export function createRing(radius, color) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.72, radius, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  return mesh;
}

export function createSandbagMesh(color = 0xb89f6d) {
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.38, 0.58),
    new THREE.MeshStandardMaterial({ color, roughness: 0.92 })
  );
  bag.castShadow = true;
  return bag;
}

export function createDroneVisuals(isMissionDrone, enemyType = 'attack_drone') {
  const def = ENEMY_TYPES[enemyType] || ENEMY_TYPES.attack_drone;
  const isRecon = def.id === 'recon_drone';
  const group = new THREE.Group();
  const bodyColor = isRecon ? 0x453924 : (isMissionDrone ? 0x3b2a3f : 0x2c3034);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.24, 0.95),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.45, roughness: 0.4 })
  );
  group.add(body);

  const eyeColor = isRecon ? def.hex : (isMissionDrone ? 0xff9922 : def.hex);
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), eyeMat);
  eye.position.set(0, -0.05, 0.46);
  group.add(eye);

  const rotors = [];
  const offsets = [
    [-0.62, 0.14, -0.62],
    [0.62, 0.14, -0.62],
    [-0.62, 0.14, 0.62],
    [0.62, 0.14, 0.62]
  ];
  const armMat = new THREE.MeshStandardMaterial({ color: 0x555b62 });
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0xd0d7de, side: THREE.DoubleSide });
  for (const [ox, oy, oz] of offsets) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.08), armMat);
    arm.position.set(ox * 0.55, 0.04, oz * 0.55);
    arm.rotation.y = Math.atan2(oz, ox);
    group.add(arm);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.08), bladeMat);
    blade.position.set(ox, oy, oz);
    group.add(blade);
    rotors.push(blade);
  }

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.8, 1.55),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  group.add(hitMesh);

  return { group, hitMesh, eyeMat, rotors };
}

export function createTransmitterEntry(scene, x, y, z, id, hidden = false, extra = {}) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.5, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xff7722, emissive: 0x662200 })
  );
  box.position.y = 0.75;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8c2b, transparent: true, opacity: 0.42 })
  );
  beam.position.y = 8;
  g.add(box, beam);
  g.position.set(x, hidden ? -15 : y, z);
  g.visible = !hidden;
  scene.add(g);

  const tr = {
    id,
    kind: 'transmitter',
    isTransmitter: true,
    active: !hidden,
    destroyed: false,
    pos: { x, y: hidden ? 1.0 : y + 1.0, z },
    group: g,
    hitMesh: box,
    mesh: box,
    ...extra
  };
  box.visible = !hidden;
  box.userData = { transmitter: tr, transmitterObj: tr, isTransmitter: true };
  return tr;
}

export function createSandbagProps(scene) {
  const sandbagPickups = [];
  const bagOffsets = [
    [-8.6, 5.6], [-7.5, 5.6], [-8.1, 6.5], [-7.0, 6.6], [-7.8, 7.4]
  ];
  bagOffsets.forEach(([x, z], idx) => {
    const mesh = createSandbagMesh(0xc2a66e);
    mesh.position.set(x, 0.22 + (idx % 2) * 0.14, z);
    mesh.rotation.y = idx * 0.4;
    scene.add(mesh);
    sandbagPickups.push({ id: idx, pos: { x, y: 0, z }, taken: false, mesh });
  });

  const sandbagDrops = [];
  const dropCoords = [
    [-11, -31], [-7, -31], [-4, -31], [5, -31], [9.5, -31]
  ];
  dropCoords.forEach(([x, z], idx) => {
    const markerMesh = createRing(1.05, 0x4be37a);
    markerMesh.position.set(x, 0.06, z);
    scene.add(markerMesh);
    const bagMesh = createSandbagMesh(0xa68e5c);
    bagMesh.position.set(x, 0.22, z);
    bagMesh.visible = false;
    scene.add(bagMesh);
    sandbagDrops.push({ id: idx, pos: { x, y: 0, z }, filled: false, markerMesh, bagMesh });
  });

  return { sandbagPickups, sandbagDrops };
}

export function createDoherProps(scene) {
  const shellPickups = [];
  const shellCoords = offsetFrom(LANDMARKS.shellPile, SHELL_OFFSETS);
  const shellBodyMat = new THREE.MeshStandardMaterial({ color: 0x56643a, roughness: 0.5, metalness: 0.35 });
  const shellTipMat = new THREE.MeshStandardMaterial({ color: 0xd4a946, roughness: 0.35, metalness: 0.6 });
  shellCoords.forEach(([x, z], idx) => {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.72, 10), shellBodyMat);
    cyl.position.y = 0.36;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 10), shellTipMat);
    cone.position.y = 0.86;
    g.add(cyl, cone);
    g.position.set(x, getTerrainHeight(x, z), z);
    scene.add(g);
    shellPickups.push({ id: idx, pos: { x, y: 0, z }, taken: false, mesh: g });
  });

  const breechRing = createRing(1.4, 0xffb838);
  breechRing.position.set(LANDMARKS.doherPos.x, getTerrainHeight(LANDMARKS.doherPos.x, LANDMARKS.doherPos.z) + 0.06, LANDMARKS.doherPos.z);
  scene.add(breechRing);
  const doherBreech = {
    pos: { x: LANDMARKS.doherPos.x, y: 0, z: LANDMARKS.doherPos.z },
    ringMesh: breechRing
  };

  return { shellPickups, doherBreech };
}

export function createRoemProps(scene, targetHitMeshes) {
  const roemNodes = [];
  const nodeCoords = offsetFrom(LANDMARKS.roemPos, ROEM_NODE_OFFSETS);
  nodeCoords.forEach(([x, z], idx) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 1.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x3b4448, metalness: 0.4 })
    );
    post.position.y = 0.68;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa726 })
    );
    lamp.position.y = 1.45;
    const ringMesh = createRing(1.0, 0xffa726);
    g.add(post, lamp, ringMesh);
    g.position.set(x, getTerrainHeight(x, z), z);
    scene.add(g);
    roemNodes.push({ id: idx, pos: { x, y: 0, z }, calibrated: false, mesh: g, lamp, ringMesh });
  });

  const roemTargets = [];
  const roemTargetCoords = offsetFrom(LANDMARKS.roemPos, ROEM_TARGET_OFFSETS);
  roemTargetCoords.forEach(([x, z], idx) => {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 1.5, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x2d3a42 })
    );
    stand.position.y = 0.75;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.45, 1.15),
      new THREE.MeshStandardMaterial({ color: 0xff6e2b, emissive: 0x7a2600 })
    );
    plate.position.y = 1.65;
    g.add(stand, plate);
    g.position.set(x, -12, z);
    g.visible = false;
    scene.add(g);
    const tObj = {
      id: `roem_t_${idx}`,
      isRoemTarget: true,
      active: false,
      hit: false,
      pos: { x, y: 1.65, z },
      group: g,
      hitMesh: plate,
      mesh: plate
    };
    plate.userData = { target: tObj, targetObj: tObj, isRoemTarget: true };
    roemTargets.push(tObj);
    targetHitMeshes.push(plate);
  });

  return { roemNodes, roemTargets };
}

export function createRokhashProps(scene) {
  const padGroup = new THREE.Group();
  padGroup.position.set(LANDMARKS.uavLaunch.x, getTerrainHeight(LANDMARKS.uavLaunch.x, LANDMARKS.uavLaunch.z) + 0.4, LANDMARKS.uavLaunch.z);
  const uavPlane = new THREE.Group();
  const fuselage = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.16, 1.35),
    new THREE.MeshStandardMaterial({ color: 0xd0d6d4 })
  );
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.05, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x3c91a8 })
  );
  uavPlane.add(fuselage, wing);
  uavPlane.position.y = 0.55;
  padGroup.add(uavPlane);
  const padRing = createRing(2.6, 0x3c91a8);
  padRing.position.y = 0.08;
  padGroup.add(padRing);
  scene.add(padGroup);

  const uavPad = {
    pos: { x: LANDMARKS.uavLaunch.x, y: 0, z: LANDMARKS.uavLaunch.z },
    group: padGroup,
    uavPlane,
    ringMesh: padRing
  };

  const borderZ = LANDMARKS.outpostCenter.z + TRANSMITTER_DZ;
  const borderTransmitters = TRANSMITTER_XS.map((dx, idx) =>
    createTransmitterEntry(scene, LANDMARKS.outpostCenter.x + dx, 0, borderZ, `tx_${idx}`, true, { isRokhashBorder: true })
  );

  return { uavPad, borderTransmitters };
}

export function createMafikProps(scene) {
  const radarDishes = [];
  const dishCoords = offsetFrom(LANDMARKS.mafikPos, DISH_OFFSETS);
  dishCoords.forEach(([x, z], idx) => {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4b5344 })
    );
    stand.position.y = 0.7;
    const dishMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 0.45, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3c91a8, side: THREE.DoubleSide })
    );
    dishMesh.position.y = 1.6;
    dishMesh.rotation.x = Math.PI * 0.35;
    const ringMesh = createRing(1.05, 0xffb838);
    g.add(stand, dishMesh, ringMesh);
    g.position.set(x, getTerrainHeight(x, z), z);
    scene.add(g);
    radarDishes.push({ id: idx, pos: { x, y: 0, z }, calibrated: false, group: g, dishMesh, ringMesh });
  });
  return { radarDishes };
}

export function createRangeProps(scene, targetHitMeshes) {
  const rangeTargets = [];
  const rangeCoords = [
    [64, -8], [64, 0], [64, 8],
    [72, -5], [72, 5],
    [80, -8], [80, 0], [80, 8]
  ];
  rangeCoords.forEach(([x, z], idx) => {
    const g = new THREE.Group();
    g.position.set(x, 0.08, z);
    g.rotation.x = -Math.PI / 2;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.5, 0.95),
      new THREE.MeshStandardMaterial({ color: 0xd94336 })
    );
    board.position.y = 0.85;
    const bull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff5d1 })
    );
    bull.rotation.z = Math.PI / 2;
    bull.position.y = 1.0;
    g.add(board, bull);
    scene.add(g);

    const tObj = {
      id: `range_t_${idx}`,
      isRoemTarget: false,
      active: false,
      timer: 0,
      pos: { x, y: 1.0, z },
      group: g,
      hitMesh: board,
      mesh: board
    };
    board.visible = false;
    board.userData = { target: tObj, targetObj: tObj, isRoemTarget: false };
    rangeTargets.push(tObj);
    targetHitMeshes.push(board);
  });
  return { rangeTargets };
}

export function createCheckpointProps(scene) {
  const checkpoints = [];
  const cpCoords = offsetFrom(LANDMARKS.outpostCenter, CHECKPOINT_OFFSETS);
  cpCoords.forEach(([x, z, label], idx) => {
    const ringMesh = createRing(2.2, 0x3c91a8);
    ringMesh.position.set(x, getTerrainHeight(x, z) + 0.07, z);
    const beaconMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 7.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x4cc9ff, transparent: true, opacity: 0.35 })
    );
    beaconMesh.position.set(x, getTerrainHeight(x, z) + 3.8, z);
    scene.add(ringMesh, beaconMesh);
    checkpoints.push({ id: idx, pos: { x, y: 0, z }, label, ringMesh, beaconMesh });
  });
  return { checkpoints };
}
