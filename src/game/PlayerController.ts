import * as THREE from 'three';
import { ColliderBox } from '../types/game';
import { ArticulatedHumanRig } from './characters';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

export class PlayerController {
  public position = new THREE.Vector3(0, 0, 27);
  public velocity = new THREE.Vector3();
  public yaw = 0; // radians, 0 faces -Z
  public health = 100;
  public maxHealth = 100;
  public stamina = 100;
  public grounded = true;
  public isSprinting = false;
  public vaultTimer = 0;
  public meleeAnimTimer = 0;
  public combatAlignTimer = 0;
  public damageFlash = 0;

  private readonly radius = 0.42;
  private readonly walkSpeed = 4.6;
  private readonly sprintSpeed = 7.4;
  private readonly gravity = 20;
  private readonly jumpVel = 7.2;
  private animPhase = 0;

  constructor(public rig: ArticulatedHumanRig) {
    this.rig.root.position.copy(this.position);
  }

  public reset(): void {
    this.position.set(0, 0, 27);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.health = this.maxHealth;
    this.stamina = 100;
    this.grounded = true;
    this.isSprinting = false;
    this.vaultTimer = 0;
    this.meleeAnimTimer = 0;
    this.combatAlignTimer = 0;
    this.damageFlash = 0;
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.damageFlash = 1.0;
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  public triggerMeleeAnim(): void {
    this.meleeAnimTimer = 0.34;
    this.combatAlignTimer = 0.7;
  }

  public triggerCombatAlign(): void {
    this.combatAlignTimer = 0.75;
  }

  public update(
    dt: number,
    heldKeys: Set<string>,
    justPressed: Set<string>,
    cameraYaw: number,
    colliders: ColliderBox[],
    firstPerson: boolean
  ): { steppedLoudly: boolean; jumped: boolean; vaulted: boolean } {
    let steppedLoudly = false;
    let jumped = false;
    let vaulted = false;

    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    this.meleeAnimTimer = Math.max(0, this.meleeAnimTimer - dt);
    this.combatAlignTimer = Math.max(0, this.combatAlignTimer - dt);

    // Input direction in XZ plane relative to camera yaw
    const fwdInput =
      (heldKeys.has('KeyW') || heldKeys.has('ArrowUp') ? 1 : 0) -
      (heldKeys.has('KeyS') || heldKeys.has('ArrowDown') ? 1 : 0);
    const strInput =
      (heldKeys.has('KeyD') ? 1 : 0) -
      (heldKeys.has('KeyA') ? 1 : 0);

    _forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    _right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    _move.set(0, 0, 0);
    _move.addScaledVector(_forward, fwdInput);
    _move.addScaledVector(_right, strInput);
    const moving = _move.lengthSq() > 0.001;
    if (moving) _move.normalize();

    const wantsSprint =
      (heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight')) && moving && this.stamina > 8;
    this.isSprinting = wantsSprint;
    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - dt * 22);
      steppedLoudly = true;
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 16);
    }

    const speed = this.vaultTimer > 0 ? 6.2 : wantsSprint ? this.sprintSpeed : this.walkSpeed;

    // Jump or Vault when Space pressed
    if (justPressed.has('Space') && this.grounded && this.vaultTimer <= 0) {
      const vaultBox = this.findVaultableAhead(colliders, _forward);
      if (vaultBox) {
        this.vaultTimer = 0.36;
        this.velocity.y = 5.4;
        this.grounded = false;
        vaulted = true;
      } else {
        this.velocity.y = this.jumpVel;
        this.grounded = false;
        jumped = true;
      }
    }

    if (this.vaultTimer > 0) {
      this.vaultTimer = Math.max(0, this.vaultTimer - dt);
    }

    // Horizontal motion with AABB sliding collision
    const dx = _move.x * speed * dt;
    const dz = _move.z * speed * dt;

    this.position.x += dx;
    this.resolveAxisCollisions('x', colliders, this.vaultTimer > 0);

    this.position.z += dz;
    this.resolveAxisCollisions('z', colliders, this.vaultTimer > 0);

    // Clamp to outer block safety bounds
    this.position.x = THREE.MathUtils.clamp(this.position.x, -26, 26);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -34.5, 34.5);

    // Vertical gravity
    this.velocity.y -= this.gravity * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    // Smooth 360-degree character rotation:
    // Face movement vector when moving in 3rd-person (unless firing/meleeing),
    // otherwise smoothly align with camera aim yaw.
    const targetYaw =
      !firstPerson && moving && this.combatAlignTimer <= 0
        ? Math.atan2(-_move.x, -_move.z)
        : cameraYaw;
    const diff = Math.atan2(Math.sin(targetYaw - this.yaw), Math.cos(targetYaw - this.yaw));
    this.yaw += diff * Math.min(1, dt * 14);

    // Update 3D model transform & procedural limb animation
    this.rig.root.visible = !firstPerson;
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    if (moving && this.grounded) {
      this.animPhase += dt * (wantsSprint ? 13 : 8.5);
      const swing = Math.sin(this.animPhase) * (wantsSprint ? 0.65 : 0.42);
      this.rig.leftLeg.rotation.x = swing;
      this.rig.rightLeg.rotation.x = -swing;
      this.rig.body.position.y = Math.abs(Math.cos(this.animPhase)) * 0.045;
    } else {
      this.rig.leftLeg.rotation.x = THREE.MathUtils.damp(this.rig.leftLeg.rotation.x, 0, 12, dt);
      this.rig.rightLeg.rotation.x = THREE.MathUtils.damp(this.rig.rightLeg.rotation.x, 0, 12, dt);
      this.rig.body.position.y = THREE.MathUtils.damp(this.rig.body.position.y, 0, 12, dt);
    }

    // Melee arm swing override
    if (this.meleeAnimTimer > 0) {
      const p = 1 - this.meleeAnimTimer / 0.34;
      this.rig.leftArm.rotation.x = -Math.sin(p * Math.PI) * 1.15;
    } else {
      this.rig.leftArm.rotation.x = THREE.MathUtils.damp(this.rig.leftArm.rotation.x, 0.15, 12, dt);
    }

    return { steppedLoudly, jumped, vaulted };
  }

  private findVaultableAhead(colliders: ColliderBox[], dir: THREE.Vector3): ColliderBox | null {
    const probeX = this.position.x + dir.x * 1.15;
    const probeZ = this.position.z + dir.z * 1.15;
    for (const c of colliders) {
      if (c.enabled === false || !c.isVaultable) continue;
      if (
        probeX >= c.minX - 0.55 &&
        probeX <= c.maxX + 0.55 &&
        probeZ >= c.minZ - 0.55 &&
        probeZ <= c.maxZ + 0.55
      ) {
        return c;
      }
    }
    return null;
  }

  private resolveAxisCollisions(
    axis: 'x' | 'z',
    colliders: ColliderBox[],
    vaulting: boolean
  ): void {
    const r = this.radius;
    for (const c of colliders) {
      if (c.enabled === false) continue;
      if (vaulting && c.isVaultable) continue;
      if (this.position.y >= c.maxY - 0.1) continue;

      if (
        this.position.x + r > c.minX &&
        this.position.x - r < c.maxX &&
        this.position.z + r > c.minZ &&
        this.position.z - r < c.maxZ
      ) {
        if (axis === 'x') {
          const pushLeft = c.minX - (this.position.x + r);
          const pushRight = c.maxX - (this.position.x - r);
          this.position.x += Math.abs(pushLeft) < Math.abs(pushRight) ? pushLeft : pushRight;
        } else {
          const pushBack = c.minZ - (this.position.z + r);
          const pushFront = c.maxZ - (this.position.z - r);
          this.position.z += Math.abs(pushBack) < Math.abs(pushFront) ? pushBack : pushFront;
        }
      }
    }
  }
}
