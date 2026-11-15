import * as THREE from 'three';

export function createCarriedSandbag() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xb59b6b, roughness: 0.95 })
  );
  mesh.position.set(0, -0.27, -0.5);
  mesh.visible = false;
  return mesh;
}

export function createCarriedShell() {
  const group = new THREE.Group();
  const shellBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.078, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x4c5838, roughness: 0.6, metalness: 0.3 })
  );
  shellBody.rotation.x = Math.PI / 2;
  const shellTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9a84c, roughness: 0.4, metalness: 0.6 })
  );
  shellTip.rotation.x = -Math.PI / 2;
  shellTip.position.z = -0.28;
  group.add(shellBody, shellTip);
  group.position.set(0.08, -0.26, -0.52);
  group.visible = false;
  return group;
}
