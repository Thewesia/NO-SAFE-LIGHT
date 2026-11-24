import * as THREE from 'three';
import { CameraPerspective, ColliderBox } from '../types/game';

const _desiredPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _pivot = new THREE.Vector3();

export class CameraController {
  public perspective: CameraPerspective = 'third_person';
  public yaw = 0; // radians, 0 looks down -Z
  public pitch = -0.14;
  public recoilPitch = 0;

  private readonly minPitch = -0.82;
  private readonly maxPitch = 0.72;
  private currentPos = new THREE.Vector3(0, 2.2, 31);
  private currentLook = new THREE.Vector3(0, 1.3, 22);

  constructor(public camera: THREE.PerspectiveCamera) {}

  public reset(): void {
    this.perspective = 'third_person';
    this.yaw = 0;
    this.pitch = -0.14;
    this.recoilPitch = 0;
    this.currentPos.set(0, 2.2, 31);
    this.currentLook.set(0, 1.3, 22);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
  }

  public togglePerspective(): CameraPerspective {
    this.perspective =
      this.perspective === 'third_person' ? 'first_person' : 'third_person';
    return this.perspective;
  }

  public addLookDelta(dx: number, dy: number): void {
    const sensitivity = 0.0024;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sensitivity,
      this.minPitch,
      this.maxPitch
    );
  }

  public addRecoil(amount: number): void {
    this.recoilPitch = Math.min(0.14, this.recoilPitch + amount);
  }

  public updateMenuOrbit(elapsed: number): void {
    const angle = elapsed * 0.14;
    this.camera.position.set(Math.sin(angle) * 7.5, 3.6, 16 + Math.cos(angle) * 5.0);
    this.camera.lookAt(0, 1.4, 2);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    isSprinting: boolean,
    colliders: ColliderBox[]
  ): void {
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 14, dt);
    const effectivePitch = THREE.MathUtils.clamp(
      this.pitch + this.recoilPitch,
      this.minPitch,
      this.maxPitch
    );

    const cosPitch = Math.cos(effectivePitch);
    const sinPitch = Math.sin(effectivePitch);
    const fwdX = -Math.sin(this.yaw) * cosPitch;
    const fwdY = sinPitch;
    const fwdZ = -Math.cos(this.yaw) * cosPitch;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    if (this.perspective === 'first_person') {
      _desiredPos.set(playerPos.x, playerPos.y + 1.62, playerPos.z);
      _lookTarget.set(
        _desiredPos.x + fwdX * 12,
        _desiredPos.y + fwdY * 12,
        _desiredPos.z + fwdZ * 12
      );
      this.currentPos.copy(_desiredPos);
      this.currentLook.copy(_lookTarget);
    } else {
      // Over-the-shoulder 3rd-person camera with obstacle pull-in
      const shoulderOffset = 0.56;
      let camDist = 3.6;

      _pivot.set(
        playerPos.x + rightX * shoulderOffset,
        playerPos.y + 1.56,
        playerPos.z + rightZ * shoulderOffset
      );

      // Step along camera ray to avoid clipping inside buildings
      for (let d = 0.6; d <= 3.6; d += 0.35) {
        const testX = _pivot.x - fwdX * d;
        const testY = _pivot.y - fwdY * d;
        const testZ = _pivot.z - fwdZ * d;
        if (this.pointInsideBuilding(testX, testY, testZ, colliders)) {
          camDist = Math.max(0.85, d - 0.35);
          break;
        }
      }

      _desiredPos.set(
        _pivot.x - fwdX * camDist,
        Math.max(0.55, _pivot.y - fwdY * camDist),
        _pivot.z - fwdZ * camDist
      );

      _lookTarget.set(
        _pivot.x + fwdX * 16,
        _pivot.y + fwdY * 16,
        _pivot.z + fwdZ * 16
      );

      const alpha = 1 - Math.exp(-16 * dt);
      this.currentPos.lerp(_desiredPos, alpha);
      this.currentLook.lerp(_lookTarget, alpha);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);

    const targetFov = isSprinting ? 67 : this.perspective === 'first_person' ? 68 : 62;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.02) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private pointInsideBuilding(
    x: number,
    y: number,
    z: number,
    colliders: ColliderBox[]
  ): boolean {
    for (const c of colliders) {
      if (c.enabled === false || c.isVaultable) continue;
      if (y > c.maxY) continue;
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
        return true;
      }
    }
    return false;
  }
}
