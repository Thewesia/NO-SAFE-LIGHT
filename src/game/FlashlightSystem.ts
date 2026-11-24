import * as THREE from 'three';

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

export class FlashlightSystem {
  public enabled = true;
  public battery = 100;
  public readonly spotLight: THREE.SpotLight;
  public readonly beamCone: THREE.Mesh;

  private readonly drainPerSec = 2.2;
  private flickerTimer = 0;

  constructor(scene: THREE.Scene) {
    this.spotLight = new THREE.SpotLight(0xfff4dc, 6.2, 34, Math.PI / 5.8, 0.55, 1.5);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.shadow.camera.near = 0.4;
    this.spotLight.shadow.camera.far = 34;
    this.spotLight.shadow.bias = -0.0005;
    scene.add(this.spotLight);
    scene.add(this.spotLight.target);

    // Subtle volumetric beam cone attached to light direction
    const coneGeo = new THREE.ConeGeometry(3.2, 11.5, 20, 1, true);
    coneGeo.translate(0, -5.75, 0);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.beamCone = new THREE.Mesh(coneGeo, coneMat);
    scene.add(this.beamCone);
  }

  public reset(): void {
    this.enabled = true;
    this.battery = 100;
    this.flickerTimer = 0;
  }

  public toggle(): boolean {
    if (!this.enabled && this.battery <= 0.5) {
      return false;
    }
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public recharge(amount: number): void {
    this.battery = Math.min(100, this.battery + amount);
  }

  public update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    isFirstPerson: boolean,
    isMenu: boolean
  ): void {
    if (isMenu) {
      this.spotLight.intensity = 0;
      this.beamCone.visible = false;
      return;
    }

    if (this.enabled) {
      this.battery = Math.max(0, this.battery - this.drainPerSec * dt);
      if (this.battery <= 0) {
        this.enabled = false;
      }
    }

    // Position light slightly forward from Alex's chest/shoulder or camera in 1st person
    camera.getWorldDirection(_dir);
    if (isFirstPerson) {
      _origin.copy(camera.position).addScaledVector(_dir, 0.25);
      _origin.y -= 0.14;
    } else {
      _origin.set(playerPos.x, playerPos.y + 1.38, playerPos.z).addScaledVector(_dir, 0.35);
    }

    this.spotLight.position.copy(_origin);
    this.spotLight.target.position.copy(_origin).addScaledVector(_dir, 14);
    this.spotLight.target.updateMatrixWorld();

    this.beamCone.position.copy(_origin);
    this.beamCone.lookAt(this.spotLight.target.position);

    if (!this.enabled) {
      this.spotLight.intensity = 0;
      this.beamCone.visible = false;
      return;
    }

    this.beamCone.visible = true;
    let intensity = 6.2;
    if (this.battery < 20) {
      this.flickerTimer += dt * 18;
      const noise = Math.sin(this.flickerTimer) * Math.cos(this.flickerTimer * 2.3);
      intensity = noise > -0.35 ? 4.4 : 0.8;
    }
    this.spotLight.intensity = intensity;
  }

  public isIlluminatingPoint(targetPos: THREE.Vector3, maxRange = 22): boolean {
    if (!this.enabled || this.battery <= 0) return false;
    _toTarget.copy(targetPos).sub(this.spotLight.position);
    const dist = _toTarget.length();
    if (dist > maxRange || dist < 0.01) return false;
    _toTarget.divideScalar(dist);

    _dir.copy(this.spotLight.target.position).sub(this.spotLight.position).normalize();
    const dot = _dir.dot(_toTarget);
    // SpotLight angle is ~31 deg -> cos(28 deg) ~ 0.88
    return dot > 0.88;
  }

  public dispose(): void {
    this.beamCone.geometry.dispose();
    (this.beamCone.material as THREE.Material).dispose();
  }
}
