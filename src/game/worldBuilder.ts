import * as THREE from 'three';
import {
  ColliderBox,
  InteractableObject,
  PoweredLightNode,
} from '../types/game';
import { MaterialLibrary } from './proceduralMaterials';

export interface WorldBuildResult {
  colliders: ColliderBox[];
  interactables: InteractableObject[];
  poweredLights: PoweredLightNode[];
  flickerLights: { light: THREE.PointLight; baseIntensity: number; seed: number }[];
  securityDoorMesh: THREE.Mesh;
  securityDoorCollider: ColliderBox;
  securityDoorClosedY: number;
  securityDoorOpenY: number;
  hazardZone: { x: number; z: number; radius: number };
  hazardSparks: THREE.Points;
  hazardLight: THREE.PointLight;
  extractionBeaconLight: THREE.PointLight;
  extractionBeaconMat: THREE.MeshStandardMaterial;
  rainPoints: THREE.Points;
  generatorIndicatorMat: THREE.MeshStandardMaterial;
  stationIndicatorMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function buildGreyhavenWorld(
  scene: THREE.Scene,
  mats: MaterialLibrary
): WorldBuildResult {
  const disposables: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMaterials.push(m);
    return m;
  };

  const colliders: ColliderBox[] = [];
  const interactables: InteractableObject[] = [];
  const poweredLights: PoweredLightNode[] = [];
  const flickerLights: { light: THREE.PointLight; baseIntensity: number; seed: number }[] = [];

  const addBoxCollider = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    d: number,
    maxY: number,
    isVaultable = false
  ): ColliderBox => {
    const box: ColliderBox = {
      id,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      maxY,
      isVaultable,
      enabled: true,
    };
    colliders.push(box);
    return box;
  };

  // 1. Wet Asphalt Ground extending far past playable district so horizon merges seamlessly into fog
  const roadGeo = trackGeo(new THREE.PlaneGeometry(180, 180));
  const roadMesh = new THREE.Mesh(roadGeo, mats.wetAsphalt);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // Road centerline stripes
  const stripeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 })
  );
  for (let z = -30; z <= 30; z += 5.5) {
    const s = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.22, 2.6)), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.015, z);
    s.receiveShadow = true;
    scene.add(s);
  }

  // Reflective rain puddles across the street (offset Y >= 0.02 to prevent Z-fighting)
  const puddlePositions = [
    [-2.2, 20, 2.4],
    [3.1, 14, 1.9],
    [-4.5, 2, 2.8],
    [6.5, -3, 2.2],
    [-1.5, -10, 3.2], // Central electrical hazard puddle!
    [2.0, -23, 2.5],
  ];
  puddlePositions.forEach(([x, z, r]) => {
    const p = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(r, 20)), mats.puddleReflective);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.02, z);
    p.receiveShadow = true;
    scene.add(p);
  });

  // Sidewalks flanking main avenue
  const addSidewalk = (cx: number, cz: number, w: number, d: number) => {
    const sw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, 0.16, d)), mats.sidewalkConcrete);
    sw.position.set(cx, 0.08, cz);
    sw.receiveShadow = true;
    scene.add(sw);
  };
  addSidewalk(-15, 0, 14, 72);
  addSidewalk(15, 0, 14, 72);

  // Outer perimeter blocks & distant skyline silhouettes (natural urban canyon containment)
  const addSolidBuilding = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material = mats.buildingBrick,
    collide = true
  ) => {
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);

    const main = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    main.position.y = h / 2;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    // Rooftop parapet trim
    const trim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(w + 0.35, 0.35, d + 0.35)),
      mats.darkSteel
    );
    trim.position.y = h + 0.17;
    group.add(trim);

    // Dark recessed window bays
    const winCols = Math.max(1, Math.floor(w / 4));
    for (let i = 0; i < winCols; i++) {
      const wx = -w / 2 + (w / (winCols + 1)) * (i + 1);
      const win = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.3, 1.8, d + 0.08)),
        mats.glassDark
      );
      win.position.set(wx, Math.min(h - 2, 3.6), 0);
      group.add(win);
    }

    scene.add(group);
    if (collide) {
      addBoxCollider(id, cx, cz, w, d, h);
    }
  };

  // Playable Perimeter Walls / Urban Block Boundaries (X = ±29, Z = +35, North sides)
  addSolidBuilding('west_wall_south', -25, 22, 10, 11, 22);
  addSolidBuilding('west_wall_mid', -25, -2, 10, 14, 24);
  addSolidBuilding('west_wall_north', -25, -26, 10, 12, 22);
  addSolidBuilding('east_wall_south', 25, 20, 10, 13, 26);
  addSolidBuilding('east_wall_mid', 25, -6, 10, 11, 24);
  addSolidBuilding('east_wall_north', 25, -28, 10, 14, 18);
  addSolidBuilding('south_block_left', -12, 36, 18, 10, 6);
  addSolidBuilding('south_block_right', 12, 36, 18, 10, 6);
  // Roadblock barrier at South start
  addSolidBuilding('south_gate_block', 0, 35.5, 8, 1.4, 1.2, mats.hazardStripe, true);

  // North Perimeter flanking the Extraction Gate
  addSolidBuilding('north_block_left', -14, -36, 18, 12, 6);
  addSolidBuilding('north_block_right', 14, -36, 18, 12, 6);

  // Distant atmospheric skyline silhouettes outside the block
  const skylineCoords = [
    [-42, -30, 14, 26, 16],
    [-40, 10, 16, 22, 18],
    [42, -25, 16, 28, 18],
    [42, 15, 14, 24, 16],
    [-16, -52, 22, 26, 12],
    [16, -52, 22, 30, 12],
    [0, 52, 28, 20, 12],
  ];
  skylineCoords.forEach(([x, z, w, h, d], idx) => {
    addSolidBuilding(`sky_${idx}`, x, z, w, h, d, mats.buildingBrick, false);
  });

  // 2. SOUTH-WEST MAINTENANCE DEPOT (Holds Missing Fuse) around x=-14, z=12
  // Open front toward street (+X), back wall at x=-19, side walls at z=7 & z=17
  addSolidBuilding('depot_back', -18.5, 12, 1.2, 4.4, 10.5);
  addSolidBuilding('depot_south', -14, 17.2, 9.5, 4.4, 1);
  addSolidBuilding('depot_north', -14, 6.8, 9.5, 4.4, 1);
  // Roof overhang
  const depotRoof = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(10, 0.4, 11.4)),
    mats.industrialMetal
  );
  depotRoof.position.set(-14, 4.5, 12);
  depotRoof.castShadow = true;
  depotRoof.receiveShadow = true;
  scene.add(depotRoof);

  // Workbench inside Depot
  const bench = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.4, 0.9, 3.6)),
    mats.darkSteel
  );
  bench.position.set(-16.8, 0.45, 12);
  bench.castShadow = true;
  bench.receiveShadow = true;
  scene.add(bench);
  addBoxCollider('depot_bench', -16.8, 12, 1.5, 3.6, 0.9);

  // Missing 60A Fuse pickup sitting on workbench with subtle warm worklamp glow
  const fuseGroup = new THREE.Group();
  fuseGroup.position.set(-16.6, 0.98, 11.8);
  const fuseCyl = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.34, 12)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xd99b26, emissive: 0x7c5308, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.7 }))
  );
  fuseCyl.rotation.z = Math.PI / 2;
  const fuseCapL = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 12)),
    mats.darkSteel
  );
  fuseCapL.rotation.z = Math.PI / 2;
  fuseCapL.position.x = -0.16;
  const fuseCapR = fuseCapL.clone();
  fuseCapR.position.x = 0.16;
  fuseGroup.add(fuseCyl, fuseCapL, fuseCapR);
  scene.add(fuseGroup);

  const depotLamp = new THREE.PointLight(0xf59e0b, 1.35, 9, 2);
  depotLamp.position.set(-15.8, 2.8, 12);
  scene.add(depotLamp);
  flickerLights.push({ light: depotLamp, baseIntensity: 1.35, seed: 1.7 });

  interactables.push({
    id: 'pickup_fuse',
    kind: 'fuse',
    mesh: fuseGroup,
    position: new THREE.Vector3(-16.6, 0.98, 11.8),
    radius: 2.3,
    consumed: false,
    label: 'Take 60A Industrial Fuse',
  });

  // 3. EAST SUBSTATION YARD & BACKUP GENERATOR around x=15, z=-6
  addSolidBuilding('substation_wall_s', 14.5, 0.5, 11, 2.8, 0.8, mats.buildingBrick);
  addSolidBuilding('substation_wall_n', 14.5, -12.5, 11, 2.8, 0.8, mats.buildingBrick);

  // Composite Multi-Part Backup Generator
  const genGroup = new THREE.Group();
  genGroup.position.set(16.2, 0, -6);
  const genBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.3, 3.8)), mats.darkSteel);
  genBase.position.y = 0.15;
  const genHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 1.6, 3.2)), mats.industrialMetal);
  genHull.position.y = 1.1;
  genHull.castShadow = true;
  genHull.receiveShadow = true;
  const genTank = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 12)), mats.darkSteel);
  genTank.rotation.x = Math.PI / 2;
  genTank.position.set(0.4, 2.05, 0);
  const genPipe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 1.3, 10)), mats.darkSteel);
  genPipe.position.set(-0.6, 2.5, 0.9);
  const genPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.25, 0.9, 1.1)), mats.darkSteel);
  genPanel.position.set(-1.12, 1.15, 0);

  const generatorIndicatorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 2.2,
      roughness: 0.25,
    })
  );
  const genBeacon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 10)), generatorIndicatorMat);
  genBeacon.position.set(-1.12, 1.75, 0);

  genGroup.add(genBase, genHull, genTank, genPipe, genPanel, genBeacon);
  scene.add(genGroup);
  addBoxCollider('generator_body', 16.2, -6, 2.6, 3.8, 2.4);

  const genStatusLight = new THREE.PointLight(0xdc2626, 1.2, 7.5, 2);
  genStatusLight.position.set(14.5, 2.1, -6);
  scene.add(genStatusLight);
  flickerLights.push({ light: genStatusLight, baseIntensity: 1.2, seed: 4.1 });

  interactables.push({
    id: 'interact_generator',
    kind: 'generator',
    mesh: genGroup,
    position: new THREE.Vector3(14.6, 1.0, -6),
    radius: 2.8,
    consumed: false,
    label: 'Backup Generator (Fuse Missing)',
  });

  // 4. NORTH-WEST EMERGENCY STATION around x=-14, z=-18
  addSolidBuilding('station_back', -18.5, -20, 1.4, 4.8, 12);
  addSolidBuilding('station_south', -13.5, -13.5, 10.5, 4.8, 1.2);
  addSolidBuilding('station_north', -13.5, -26.5, 10.5, 4.8, 1.2);
  // Front wall with doorway opening at z=-19..-21
  addSolidBuilding('station_front_s', -8.6, -15.6, 1.0, 4.8, 4.4);
  addSolidBuilding('station_front_n', -8.6, -24.0, 1.0, 4.8, 5.2);
  const stationHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 1.2, 4.4)), mats.buildingBrick);
  stationHeader.position.set(-8.6, 4.2, -19.8);
  scene.add(stationHeader);

  const stationRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.2, 0.45, 14)), mats.industrialMetal);
  stationRoof.position.set(-13.6, 4.9, -20);
  stationRoof.castShadow = true;
  scene.add(stationRoof);

  // Motorized Security Door (slides UP when opened)
  const securityDoorClosedY = 1.8;
  const securityDoorOpenY = 4.6;
  const securityDoorMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.35, 3.6, 3.8)),
    mats.hazardStripe
  );
  securityDoorMesh.position.set(-8.6, securityDoorClosedY, -19.6);
  securityDoorMesh.castShadow = true;
  scene.add(securityDoorMesh);
  const securityDoorCollider = addBoxCollider('security_door', -8.6, -19.6, 0.6, 3.8, 3.6);

  // Door Switch outside Emergency Station
  const doorSwitch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.45, 0.32)), mats.darkSteel);
  doorSwitch.position.set(-7.9, 1.35, -17.1);
  scene.add(doorSwitch);

  interactables.push({
    id: 'interact_security_door',
    kind: 'security_door',
    mesh: doorSwitch,
    position: new THREE.Vector3(-7.9, 1.35, -17.1),
    radius: 2.6,
    consumed: false,
    label: 'Station Shutter Control (No Power)',
  });

  // Emergency Station Main Breaker Console inside Station
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(-15.5, 0, -20);
  const consoleBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 1.7, 2.4)), mats.darkSteel);
  consoleBody.position.y = 0.85;
  const stationIndicatorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 1.8,
    })
  );
  const consoleBeacon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.18, 0.5)), stationIndicatorMat);
  consoleBeacon.position.set(0.55, 1.35, 0);
  consoleGroup.add(consoleBody, consoleBeacon);
  scene.add(consoleGroup);
  addBoxCollider('station_console', -15.5, -20, 1.2, 2.4, 1.8);

  interactables.push({
    id: 'interact_station_breaker',
    kind: 'station_breaker',
    mesh: consoleGroup,
    position: new THREE.Vector3(-14.6, 1.1, -20),
    radius: 2.6,
    consumed: false,
    label: 'Emergency Station Main Relay',
  });

  // 5. NORTH EXTRACTION GATE at (0, 0, -33)
  const gateGroup = new THREE.Group();
  gateGroup.position.set(0, 0, -33);
  const pillarL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 4.5, 0.9)), mats.darkSteel);
  pillarL.position.set(-4.2, 2.25, 0);
  const pillarR = pillarL.clone();
  pillarR.position.set(4.2, 2.25, 0);
  const arch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.4, 0.8, 0.9)), mats.hazardStripe);
  arch.position.set(0, 4.2, 0);
  const extractionBeaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 1.8,
    })
  );
  const beaconOrb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 12, 12)), extractionBeaconMat);
  beaconOrb.position.set(0, 4.75, 0.2);
  gateGroup.add(pillarL, pillarR, arch, beaconOrb);
  scene.add(gateGroup);

  const extractionBeaconLight = new THREE.PointLight(0xdc2626, 1.8, 16, 2);
  extractionBeaconLight.position.set(0, 4.8, -32.2);
  scene.add(extractionBeaconLight);

  // Physical stop wall beyond extraction gate so player doesn't walk off world
  addBoxCollider('extraction_stop', 0, -35.5, 10, 1.5, 4);

  interactables.push({
    id: 'interact_extraction',
    kind: 'extraction_gate',
    mesh: gateGroup,
    position: new THREE.Vector3(0, 1.0, -32.2),
    radius: 3.4,
    consumed: false,
    label: 'North Extraction Gate (Power Offline)',
  });

  // 6. ABANDONED VEHICLES (Multi-part sedans/vans with collider boxes)
  const addAbandonedVehicle = (id: string, x: number, z: number, rotY: number, colorHex: number, isVan = false) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const bodyMat = trackMat(new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.46, metalness: 0.55 }));
    const len = isVan ? 4.4 : 3.8;
    const h = isVan ? 1.55 : 0.78;
    const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.85, h, len)), bodyMat);
    chassis.position.y = 0.35 + h / 2;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    g.add(chassis);

    if (!isVan) {
      const cabin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.62, 0.62, 1.9)), bodyMat);
      cabin.position.set(0, 1.38, -0.15);
      cabin.castShadow = true;
      g.add(cabin);
      const windshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.52, 1.96)), mats.glassDark);
      windshield.position.set(0, 1.38, -0.15);
      g.add(windshield);
    }

    const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14));
    const wheelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.85 }));
    [
      [-0.88, 0.36, len * 0.32],
      [0.88, 0.36, len * 0.32],
      [-0.88, 0.36, -len * 0.32],
      [0.88, 0.36, -len * 0.32],
    ].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, wy, wz);
      g.add(w);
    });

    scene.add(g);
    const cos = Math.abs(Math.cos(rotY));
    const boxW = cos > 0.7 ? 2.0 : len;
    const boxD = cos > 0.7 ? len : 2.0;
    addBoxCollider(id, x, z, boxW, boxD, 1.9);
  };

  addAbandonedVehicle('car_1', -3.6, 13.5, 0.22, 0x2c353f, false);
  addAbandonedVehicle('car_2', 4.4, -2.5, -0.35, 0x3b2d2c, false);
  addAbandonedVehicle('van_1', 11.5, 16.5, 1.4, 0x262e36, true);

  // 7. VAULTABLE LOW BARRIERS & CRATES (height <= 1.1m -> vaultable with Space!)
  const addBarrier = (id: string, x: number, z: number, w: number, d: number, h = 0.95) => {
    const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mats.sidewalkConcrete);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w + 0.04, 0.14, d + 0.04)), mats.hazardStripe);
    cap.position.set(x, h - 0.08, z);
    scene.add(m, cap);
    addBoxCollider(id, x, z, w, d, h, true);
  };

  addBarrier('barrier_1', -4.2, 18.5, 2.8, 0.65, 0.9);
  addBarrier('barrier_2', 1.2, 6.2, 3.2, 0.65, 0.95);
  addBarrier('barrier_3', -5.5, -5.5, 2.8, 0.65, 0.95);
  addBarrier('barrier_4', 4.5, -16.5, 2.8, 0.65, 0.95);

  // 8. STREETLIGHTS (Powered by Backup Generator & Emergency Station!)
  const addStreetlight = (x: number, z: number, facingX: number, requiresStation = false) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8)), mats.darkSteel);
    pole.position.y = 2.7;
    pole.castShadow = true;
    const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.12, 0.14)), mats.darkSteel);
    arm.position.set(facingX * 0.75, 5.3, 0);
    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x333842,
        emissive: 0x000000,
        emissiveIntensity: 0,
      })
    );
    const bulb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.12, 0.24)), bulbMat);
    bulb.position.set(facingX * 1.35, 5.2, 0);
    g.add(pole, arm, bulb);
    scene.add(g);

    const light = new THREE.PointLight(requiresStation ? 0x93c5fd : 0xf59e0b, 0, 22, 1.7);
    light.position.set(x + facingX * 1.35, 5.0, z);
    scene.add(light);

    poweredLights.push({
      light,
      bulbMat,
      baseIntensity: requiresStation ? 5.5 : 4.6,
      emissiveColor: requiresStation ? 0x60a5fa : 0xfbbf24,
      requiresGenerator: true,
      requiresStation,
      flickerSeed: Math.random() * 10,
    });
  };

  addStreetlight(-7.6, 17, 1, false);
  addStreetlight(7.6, 7, -1, false);
  addStreetlight(7.6, -7, -1, false);
  addStreetlight(-7.6, -12, 1, false);
  addStreetlight(-12.5, -20, 1, true); // Station interior floodlight
  addStreetlight(0, -26, 0, true); // Extraction approach floodlight

  // 9. COLLECTIBLE SUPPLIES (Batteries, Pistol Ammo, Medkits)
  const addPickup = (
    id: string,
    kind: 'battery' | 'ammo' | 'medkit',
    x: number,
    z: number,
    label: string
  ) => {
    const g = new THREE.Group();
    g.position.set(x, 0.22, z);

    const color =
      kind === 'battery' ? 0x38bdf8 : kind === 'ammo' ? 0xd99b26 : 0xef4444;
    const box = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.36, 0.22, 0.26)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.35,
          roughness: 0.35,
          metalness: 0.4,
        })
      )
    );
    box.castShadow = true;
    g.add(box);
    scene.add(g);

    interactables.push({
      id,
      kind,
      mesh: g,
      position: new THREE.Vector3(x, 0.25, z),
      radius: 2.1,
      consumed: false,
      label,
    });
  };

  addPickup('bat_1', 'battery', -10.5, 20.5, 'Pick up Flashlight Battery (+45%)');
  addPickup('bat_2', 'battery', 9.8, 12.0, 'Pick up Flashlight Battery (+45%)');
  addPickup('bat_3', 'battery', 10.5, -10.5, 'Pick up Flashlight Battery (+45%)');
  addPickup('ammo_1', 'ammo', 13.8, 18.2, 'Pick up 9mm Pistol Ammo (+6)');
  addPickup('ammo_2', 'ammo', -5.8, -1.5, 'Pick up 9mm Pistol Ammo (+6)');
  addPickup('med_1', 'medkit', -15.5, 9.2, 'Use Emergency Medkit (+40 HP)');
  addPickup('med_2', 'medkit', -12.0, -23.0, 'Use Emergency Medkit (+40 HP)');

  // 10. ELECTRICAL HAZARD (Downed cable sparking into puddle at x=-1.5, z=-10 when generator runs)
  const hazardZone = { x: -1.5, z: -10, radius: 3.1 };
  const cable = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 5.2, 8)),
    mats.darkSteel
  );
  cable.rotation.z = Math.PI / 2;
  cable.rotation.y = 0.4;
  cable.position.set(-3.2, 0.06, -10.4);
  scene.add(cable);

  const sparkCount = 45;
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    sparkPos[i * 3] = hazardZone.x + (Math.random() - 0.5) * 2.4;
    sparkPos[i * 3 + 1] = 0.08 + Math.random() * 1.1;
    sparkPos[i * 3 + 2] = hazardZone.z + (Math.random() - 0.5) * 2.4;
  }
  const sparkGeo = trackGeo(new THREE.BufferGeometry());
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = trackMat(
    new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.14,
      transparent: true,
      opacity: 0,
    })
  );
  const hazardSparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(hazardSparks);

  const hazardLight = new THREE.PointLight(0x60a5fa, 0, 9, 2);
  hazardLight.position.set(hazardZone.x, 0.8, hazardZone.z);
  scene.add(hazardLight);

  // 11. ATMOSPHERIC RAIN PARTICLE FIELD (follows player smoothly)
  const rainCount = 650;
  const rainArr = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainArr[i * 3] = (Math.random() - 0.5) * 42;
    rainArr[i * 3 + 1] = Math.random() * 18;
    rainArr[i * 3 + 2] = (Math.random() - 0.5) * 42;
  }
  const rainGeo = trackGeo(new THREE.BufferGeometry());
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr, 3));
  const rainMat = trackMat(
    new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.09,
      transparent: true,
      opacity: 0.42,
    })
  );
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  scene.add(rainPoints);

  return {
    colliders,
    interactables,
    poweredLights,
    flickerLights,
    securityDoorMesh,
    securityDoorCollider,
    securityDoorClosedY,
    securityDoorOpenY,
    hazardZone,
    hazardSparks,
    hazardLight,
    extractionBeaconLight,
    extractionBeaconMat,
    rainPoints,
    generatorIndicatorMat,
    stationIndicatorMat,
    dispose: () => {
      disposables.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
    },
  };
}
