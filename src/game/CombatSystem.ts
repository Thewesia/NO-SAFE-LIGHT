import * as THREE from 'three';
import { HollowAI, ScavengerAI } from './EnemyAI';

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();

interface Tracer {
  line: THREE.Line;
  life: number;
}

export class CombatSystem {
  public ammoInMag = 8;
  public readonly magCapacity = 8;
  public reserveAmmo = 16;
  public reloading = false;
  public shotsFired = 0;
  public hitsLanded = 0;

  private reloadTimer = 0;
  private fireCooldown = 0;
  private meleeCooldown = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly muzzleLight: THREE.PointLight;
  private readonly tracers: Tracer[] = [];

  constructor(private scene: THREE.Scene) {
    this.muzzleLight = new THREE.PointLight(0xfbbf24, 0, 9, 2);
    scene.add(this.muzzleLight);
  }

  public reset(): void {
    this.ammoInMag = 8;
    this.reserveAmmo = 16;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.meleeCooldown = 0;
    this.shotsFired = 0;
    this.hitsLanded = 0;
    this.muzzleLight.intensity = 0;
    this.tracers.forEach((t) => {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    });
    this.tracers.length = 0;
  }

  public addAmmo(amount: number): void {
    this.reserveAmmo += amount;
  }

  public startReload(): boolean {
    if (this.reloading || this.ammoInMag >= this.magCapacity || this.reserveAmmo <= 0) {
      return false;
    }
    this.reloading = true;
    this.reloadTimer = 1.15;
    return true;
  }

  public update(dt: number): void {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 32);

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this.magCapacity - this.ammoInMag;
        const load = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += load;
        this.reserveAmmo -= load;
        this.reloading = false;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const mat = t.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        mat.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  public tryFire(
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    scavenger: ScavengerAI,
    hollow: HollowAI
  ): {
    status: 'fired' | 'empty' | 'cooldown';
    hitKind: 'scavenger' | 'hollow' | 'none';
    scavengerDown: boolean;
  } {
    if (this.reloading || this.fireCooldown > 0) {
      return { status: 'cooldown', hitKind: 'none', scavengerDown: false };
    }
    if (this.ammoInMag <= 0) {
      this.fireCooldown = 0.25;
      return { status: 'empty', hitKind: 'none', scavengerDown: false };
    }

    this.ammoInMag -= 1;
    this.shotsFired += 1;
    this.fireCooldown = 0.28;

    camera.getWorldDirection(_rayDir);
    _rayOrigin.copy(camera.position);

    // Muzzle flash near player shoulder/camera
    this.muzzleLight.position.set(
      playerPos.x + _rayDir.x * 0.6,
      playerPos.y + 1.4,
      playerPos.z + _rayDir.z * 0.6
    );
    this.muzzleLight.intensity = 6.5;

    this.raycaster.set(_rayOrigin, _rayDir);
    this.raycaster.far = 48;

    let hitKind: 'scavenger' | 'hollow' | 'none' = 'none';
    let scavengerDown = false;
    let endPoint = _rayOrigin.clone().addScaledVector(_rayDir, 38);

    // Check ray against scavenger & hollow hit meshes (plus generous capsule distance check along ray)
    const scavHits =
      scavenger.state !== 'INCAPACITATED'
        ? this.raycaster.intersectObjects(scavenger.rig.hitMeshes, false)
        : [];
    const hollowHits = this.raycaster.intersectObjects(hollow.rig.hitMeshes, false);

    // Fallback generous center-mass sphere check along aim ray for responsive 3rd-person shooting
    const ray = this.raycaster.ray;
    const scavCenter = new THREE.Vector3(scavenger.position.x, 1.15, scavenger.position.z);
    const hollowCenter = new THREE.Vector3(hollow.position.x, 1.35, hollow.position.z);
    const scavDistRay =
      scavenger.state !== 'INCAPACITATED' ? ray.distanceSqToPoint(scavCenter) : Infinity;
    const hollowDistRay = ray.distanceSqToPoint(hollowCenter);

    const scavHit = scavHits.length > 0 || scavDistRay < 0.36;
    const hollowHit = hollowHits.length > 0 || hollowDistRay < 0.45;

    if (scavHit && (!hollowHit || playerPos.distanceTo(scavenger.position) <= playerPos.distanceTo(hollow.position))) {
      hitKind = 'scavenger';
      this.hitsLanded += 1;
      scavengerDown = scavenger.takeDamage(34, _rayDir);
      endPoint = scavHits[0]?.point ?? scavCenter;
    } else if (hollowHit) {
      hitKind = 'hollow';
      this.hitsLanded += 1;
      hollow.flinchFromBullet();
      endPoint = hollowHits[0]?.point ?? hollowCenter;
    }

    // Spawn brief tracer line from weapon height
    const startPt = new THREE.Vector3(
      playerPos.x + _rayDir.x * 0.55,
      playerPos.y + 1.36,
      playerPos.z + _rayDir.z * 0.55
    );
    const lineGeo = new THREE.BufferGeometry().setFromPoints([startPt, endPoint]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });

    return { status: 'fired', hitKind, scavengerDown };
  }

  public tryMelee(
    playerPos: THREE.Vector3,
    cameraYaw: number,
    scavenger: ScavengerAI,
    hollow: HollowAI
  ): { performed: boolean; hitKind: 'scavenger' | 'hollow' | 'none'; scavengerDown: boolean } {
    if (this.meleeCooldown > 0) {
      return { performed: false, hitKind: 'none', scavengerDown: false };
    }
    this.meleeCooldown = 0.58;

    const fwdX = -Math.sin(cameraYaw);
    const fwdZ = -Math.cos(cameraYaw);

    // Check Scavenger within 2.5m forward arc
    if (scavenger.state !== 'INCAPACITATED') {
      _toEnemy.copy(scavenger.position).sub(playerPos);
      _toEnemy.y = 0;
      const dist = _toEnemy.length();
      if (dist < 2.55) {
        const dot = dist > 0.01 ? (_toEnemy.x * fwdX + _toEnemy.z * fwdZ) / dist : 1;
        if (dot > 0.25) {
          const knock = _toEnemy.clone().normalize();
          const down = scavenger.takeDamage(28, knock);
          return { performed: true, hitKind: 'scavenger', scavengerDown: down };
        }
      }
    }

    // Check Hollow within 2.6m forward arc (brief stagger only)
    _toEnemy.copy(hollow.position).sub(playerPos);
    _toEnemy.y = 0;
    const hDist = _toEnemy.length();
    if (hDist < 2.65) {
      const dot = hDist > 0.01 ? (_toEnemy.x * fwdX + _toEnemy.z * fwdZ) / hDist : 1;
      if (dot > 0.25) {
        hollow.flinchFromBullet();
        return { performed: true, hitKind: 'hollow', scavengerDown: false };
      }
    }

    return { performed: true, hitKind: 'none', scavengerDown: false };
  }
}
