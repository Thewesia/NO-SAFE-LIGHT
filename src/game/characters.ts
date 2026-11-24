import * as THREE from 'three';

export interface ArticulatedHumanRig {
  root: THREE.Group;
  body: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  head: THREE.Group;
  muzzlePoint: THREE.Object3D;
  flashlightMount: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
}

export interface HollowRig {
  root: THREE.Group;
  spine: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
  coreLight: THREE.PointLight;
  eyeMat: THREE.MeshStandardMaterial;
  hitMeshes: THREE.Mesh[];
}

export function createAlexMercerModel(shadowMat: THREE.MeshBasicMaterial): ArticulatedHumanRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x2a333d,
    roughness: 0.78,
    metalness: 0.08,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    roughness: 0.85,
    metalness: 0.05,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x111215,
    roughness: 0.48,
    metalness: 0.25,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc29b82,
    roughness: 0.65,
    metalness: 0.02,
  });
  const gearMat = new THREE.MeshStandardMaterial({
    color: 0x1f242a,
    roughness: 0.45,
    metalness: 0.55,
  });
  const hiVisMat = new THREE.MeshStandardMaterial({
    color: 0xb88628,
    roughness: 0.42,
    metalness: 0.25,
  });

  // Ground contact shadow
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // Legs (pivoted at hip y = 0.86)
  const makeLeg = (xOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.86, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.2), pantsMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.36, 0.17), pantsMat);
    shin.position.y = -0.58;
    shin.castShadow = true;
    legGroup.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.27), bootMat);
    boot.position.set(0, -0.79, -0.03);
    boot.castShadow = true;
    legGroup.add(boot);

    return legGroup;
  };

  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);
  body.add(leftLeg, rightLeg);

  // Torso (y = 0.86..1.44)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), jacketMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  // Utility hi-vis electrical maintenance strap across jacket
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.475, 0.06, 0.275), hiVisMat);
  strap.position.y = 1.04;
  body.add(strap);

  // Tool backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.16), gearMat);
  pack.position.set(0, 1.17, 0.2);
  pack.castShadow = true;
  body.add(pack);

  // Head
  const head = new THREE.Group();
  head.position.set(0, 1.54, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.23), skinMat);
  skull.castShadow = true;
  head.add(skull);

  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.23, 0.09, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x181514, roughness: 0.9 })
  );
  hair.position.set(0, 0.1, 0.01);
  head.add(hair);
  body.add(head);

  // Left Arm + Tactical Flashlight
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.29, 1.38, 0);
  const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.15), jacketMat);
  lArmMesh.position.set(0, -0.22, -0.06);
  lArmMesh.rotation.x = Math.PI * 0.26;
  lArmMesh.castShadow = true;
  leftArm.add(lArmMesh);

  const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.18, 10), gearMat);
  torchBody.rotation.x = Math.PI / 2;
  torchBody.position.set(0, -0.34, -0.28);
  leftArm.add(torchBody);

  const flashlightMount = new THREE.Object3D();
  flashlightMount.position.set(0, -0.34, -0.38);
  leftArm.add(flashlightMount);
  body.add(leftArm);

  // Right Arm + Pistol
  const rightArm = new THREE.Group();
  rightArm.position.set(0.29, 1.38, 0);
  const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.15), jacketMat);
  rArmMesh.position.set(0, -0.22, -0.08);
  rArmMesh.rotation.x = Math.PI * 0.34;
  rArmMesh.castShadow = true;
  rightArm.add(rArmMesh);

  const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.22), gearMat);
  pistolSlide.position.set(0, -0.32, -0.35);
  rightArm.add(pistolSlide);

  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.1, 0.05), bootMat);
  pistolGrip.position.set(0, -0.38, -0.28);
  pistolGrip.rotation.x = 0.22;
  rightArm.add(pistolGrip);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, -0.31, -0.47);
  rightArm.add(muzzlePoint);
  body.add(rightArm);

  return {
    root,
    body,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    muzzlePoint,
    flashlightMount,
    hitMeshes: [torso, skull],
  };
}

export function createScavengerModel(shadowMat: THREE.MeshBasicMaterial): ArticulatedHumanRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const coatMat = new THREE.MeshStandardMaterial({
    color: 0x3b2c26,
    roughness: 0.85,
    metalness: 0.06,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x1d1f23,
    roughness: 0.86,
  });
  const maskMat = new THREE.MeshStandardMaterial({
    color: 0x16181c,
    roughness: 0.55,
    metalness: 0.4,
  });
  const goggleMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0x92400e,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    roughness: 0.4,
    metalness: 0.75,
  });

  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const makeLeg = (xOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.86, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.84, 0.2), pantsMat);
    leg.position.y = -0.43;
    leg.castShadow = true;
    legGroup.add(leg);
    return legGroup;
  };

  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  body.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), coatMat);
  torso.position.y = 1.16;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 1.57, 0);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.27), coatMat);
  hood.castShadow = true;
  head.add(hood);

  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), maskMat);
  mask.position.set(0, -0.03, -0.13);
  head.add(mask);

  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.04), goggleMat);
  goggles.position.set(0, 0.04, -0.14);
  head.add(goggles);
  body.add(head);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 1.38, 0);
  const lMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.15), coatMat);
  lMesh.position.set(0, -0.22, -0.05);
  lMesh.castShadow = true;
  leftArm.add(lMesh);
  body.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 1.38, 0);
  const rMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.15), coatMat);
  rMesh.position.set(0, -0.22, -0.1);
  rMesh.rotation.x = Math.PI * 0.35;
  rMesh.castShadow = true;
  rightArm.add(rMesh);

  const carbine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.56), gunMat);
  carbine.position.set(0, -0.32, -0.38);
  rightArm.add(carbine);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, -0.32, -0.66);
  rightArm.add(muzzlePoint);

  const flashlightMount = new THREE.Object3D();
  body.add(rightArm);

  return {
    root,
    body,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    muzzlePoint,
    flashlightMount,
    hitMeshes: [torso, hood],
  };
}

export function createHollowModel(shadowMat: THREE.MeshBasicMaterial): HollowRig {
  const root = new THREE.Group();

  const fleshMat = new THREE.MeshStandardMaterial({
    color: 0x101318,
    roughness: 0.35,
    metalness: 0.25,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x262d38,
    roughness: 0.55,
    metalness: 0.3,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    emissive: 0x3b82f6,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const makeLimb = (w: number, len: number) => {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 0.72, len * 0.52, 7), fleshMat);
    upper.position.y = -len * 0.26;
    upper.castShadow = true;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.7, w * 0.42, len * 0.5, 7), fleshMat);
    lower.position.y = -len * 0.76;
    lower.castShadow = true;
    g.add(upper, lower);
    return { group: g, upper, lower };
  };

  const lLeg = makeLimb(0.085, 1.15);
  lLeg.group.position.set(-0.18, 1.15, 0);
  const rLeg = makeLimb(0.085, 1.15);
  rLeg.group.position.set(0.18, 1.15, 0);
  root.add(lLeg.group, rLeg.group);

  const spine = new THREE.Group();
  spine.position.set(0, 1.15, 0);
  spine.rotation.x = -0.22; // ominous forward hunch
  root.add(spine);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 7), fleshMat);
  pelvis.position.y = 0.1;
  spine.add(pelvis);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.68, 0.26), fleshMat);
  chest.position.y = 0.56;
  chest.castShadow = true;
  spine.add(chest);

  // Pale bone-like rib arches
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.028, 6, 12, Math.PI * 1.2), ribMat);
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = -Math.PI * 0.1;
    rib.position.y = 0.4 + i * 0.14;
    spine.add(rib);
  }

  // Hollowed head with faint cold-blue electrical core
  const head = new THREE.Group();
  head.position.set(0, 1.04, -0.06);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.28), fleshMat);
  skull.castShadow = true;
  head.add(skull);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
  leftEye.position.set(-0.065, 0.03, -0.14);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
  rightEye.position.set(0.065, 0.03, -0.14);
  head.add(leftEye, rightEye);
  spine.add(head);

  const coreLight = new THREE.PointLight(0x60a5fa, 1.2, 6.5, 2);
  coreLight.position.set(0, 0.65, -0.22);
  spine.add(coreLight);

  // Elongated clawed arms
  const lArm = makeLimb(0.065, 1.28);
  lArm.group.position.set(-0.32, 0.84, 0);
  const rArm = makeLimb(0.065, 1.28);
  rArm.group.position.set(0.32, 0.84, 0);
  spine.add(lArm.group, rArm.group);

  return {
    root,
    spine,
    leftArm: lArm.group,
    rightArm: rArm.group,
    leftLeg: lLeg.group,
    rightLeg: rLeg.group,
    head,
    coreLight,
    eyeMat,
    hitMeshes: [chest, skull],
  };
}
