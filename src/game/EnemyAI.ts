import * as THREE from 'three';
import { ColliderBox, SoundPulse } from '../types/game';
import { ArticulatedHumanRig, HollowRig } from './characters';
import { ElectricitySystem } from './ElectricitySystem';
import { FlashlightSystem } from './FlashlightSystem';

const _toPlayer = new THREE.Vector3();
const _target = new THREE.Vector3();
const _hollowPos = new THREE.Vector3();

function resolveEnemyCollision(
  pos: THREE.Vector3,
  radius: number,
  colliders: ColliderBox[]
): void {
  for (const c of colliders) {
    if (c.enabled === false || c.isVaultable) continue;
    if (pos.x + radius > c.minX && pos.x - radius < c.maxX && pos.z + radius > c.minZ && pos.z - radius < c.maxZ) {
      const dxLeft = Math.abs(pos.x + radius - c.minX);
      const dxRight = Math.abs(pos.x - radius - c.maxX);
      const dzFront = Math.abs(pos.z + radius - c.minZ);
      const dzBack = Math.abs(pos.z - radius - c.maxZ);
      const minOverlap = Math.min(dxLeft, dxRight, dzFront, dzBack);
      if (minOverlap === dxLeft) pos.x = c.minX - radius;
      else if (minOverlap === dxRight) pos.x = c.maxX + radius;
      else if (minOverlap === dzFront) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}

export class ScavengerAI {
  public position = new THREE.Vector3(3.5, 0, 4);
  public health = 100;
  public state: 'PATROL' | 'CHASE' | 'ATTACK' | 'INCAPACITATED' = 'PATROL';
  public hitFlash = 0;

  private yaw = Math.PI;
  private attackCooldown = 0;
  private stunTimer = 0;
  private waypointIdx = 0;
  private animPhase = 0;
  private readonly waypoints = [
    new THREE.Vector3(-4.8, 0, 5.5),
    new THREE.Vector3(6.8, 0, 4.2),
    new THREE.Vector3(6.2, 0, -4.5),
    new THREE.Vector3(-4.2, 0, -2.5),
  ];

  public muzzleFlashLight: THREE.PointLight;

  constructor(public rig: ArticulatedHumanRig, scene: THREE.Scene) {
    this.muzzleFlashLight = new THREE.PointLight(0xfbbf24, 0, 7, 2);
    scene.add(this.muzzleFlashLight);
    this.reset();
  }

  public reset(): void {
    this.position.set(4.0, 0, 4.5);
    this.health = 100;
    this.state = 'PATROL';
    this.hitFlash = 0;
    this.attackCooldown = 0;
    this.stunTimer = 0;
    this.waypointIdx = 0;
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.set(0, Math.PI, 0);
    this.muzzleFlashLight.intensity = 0;
  }

  public takeDamage(amount: number, knockDir?: THREE.Vector3): boolean {
    if (this.state === 'INCAPACITATED') return false;
    this.health = Math.max(0, this.health - amount);
    this.hitFlash = 0.2;
    this.stunTimer = 0.25;
    if (knockDir) {
      this.position.addScaledVector(knockDir, 0.35);
    }
    if (this.state === 'PATROL') this.state = 'CHASE';
    if (this.health <= 0) {
      this.state = 'INCAPACITATED';
      return true;
    }
    return false;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    flashlightOn: boolean,
    soundPulses: SoundPulse[],
    colliders: ColliderBox[]
  ): { firedShot: boolean; hitPlayerDamage: number } {
    let firedShot = false;
    let hitPlayerDamage = 0;

    this.muzzleFlashLight.intensity = Math.max(0, this.muzzleFlashLight.intensity - dt * 28);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.state === 'INCAPACITATED') {
      this.rig.root.rotation.x = THREE.MathUtils.damp(this.rig.root.rotation.x, -Math.PI / 2, 10, dt);
      this.rig.root.position.y = THREE.MathUtils.damp(this.rig.root.position.y, 0.16, 10, dt);
      return { firedShot, hitPlayerDamage };
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);

    _toPlayer.copy(playerPos).sub(this.position);
    _toPlayer.y = 0;
    const distToPlayer = _toPlayer.length();

    const detectRange = flashlightOn ? 18.5 : 10.5;
    const heardLoud = soundPulses.some(
      (p) => p.position.distanceTo(this.position) <= p.radius * 0.9
    );

    if (distToPlayer < detectRange || heardLoud) {
      if (this.state === 'PATROL') this.state = 'CHASE';
    } else if (distToPlayer > 24 && this.state === 'CHASE') {
      this.state = 'PATROL';
    }

    if (this.stunTimer <= 0) {
      if (this.state === 'PATROL') {
        const wp = this.waypoints[this.waypointIdx];
        _target.copy(wp).sub(this.position);
        _target.y = 0;
        const wpDist = _target.length();
        if (wpDist < 0.8) {
          this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
        } else {
          _target.divideScalar(wpDist);
          this.position.addScaledVector(_target, 2.2 * dt);
          this.yaw = Math.atan2(-_target.x, -_target.z);
          this.animPhase += dt * 6;
        }
      } else {
        if (distToPlayer > 0.01) {
          _toPlayer.divideScalar(distToPlayer);
          this.yaw = Math.atan2(-_toPlayer.x, -_toPlayer.z);
        }

        if (distToPlayer > 7.2) {
          this.state = 'CHASE';
          this.position.addScaledVector(_toPlayer, 3.8 * dt);
          this.animPhase += dt * 9.5;
        } else {
          this.state = 'ATTACK';
          if (distToPlayer > 2.2) {
            this.position.addScaledVector(_toPlayer, 1.5 * dt);
            this.animPhase += dt * 5;
          }
          if (this.attackCooldown <= 0) {
            this.attackCooldown = distToPlayer < 2.3 ? 1.1 : 1.75;
            firedShot = true;
            this.muzzleFlashLight.position.set(this.position.x, 1.35, this.position.z);
            this.muzzleFlashLight.intensity = 5.5;
            // Reasonable survival accuracy
            if (distToPlayer < 2.4 || Math.random() < 0.62) {
              hitPlayerDamage = distToPlayer < 2.4 ? 18 : 13;
            }
          }
        }
      }
    }

    resolveEnemyCollision(this.position, 0.45, colliders);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -24, 24);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -32, 32);

    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.set(0, this.yaw, 0);
    const swing = Math.sin(this.animPhase) * 0.42;
    this.rig.leftLeg.rotation.x = swing;
    this.rig.rightLeg.rotation.x = -swing;

    // Hit flash tint
    this.rig.hitMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(this.hitFlash > 0 ? 0x991b1b : 0x000000);
      mat.emissiveIntensity = this.hitFlash > 0 ? 1.4 : 0;
    });

    return { firedShot, hitPlayerDamage };
  }
}

export class HollowAI {
  public position = new THREE.Vector3(-2, 0, -16);
  public state:
    | 'STALK'
    | 'INVESTIGATE_SOUND'
    | 'DRAWN_TO_POWER'
    | 'HUNT'
    | 'LIGHT_STUNNED' = 'STALK';
  public lightExposure = 0;

  private yaw = 0;
  private stunTimer = 0;
  private attackCooldown = 0;
  private investigatePoint = new THREE.Vector3(0, 0, -12);
  private investigateTimer = 0;
  private shockCooldown = 0;
  private animPhase = 0;
  private patrolAngle = 0;

  constructor(public rig: HollowRig) {
    this.reset();
  }

  public reset(): void {
    this.position.set(-1.5, 0, -17.5);
    this.state = 'STALK';
    this.lightExposure = 0;
    this.stunTimer = 0;
    this.attackCooldown = 0;
    this.investigateTimer = 0;
    this.shockCooldown = 0;
    this.rig.root.position.copy(this.position);
  }

  public flinchFromBullet(): void {
    if (this.state === 'LIGHT_STUNNED') return;
    this.stunTimer = Math.max(this.stunTimer, 0.45);
  }

  public alertToPower(powerLocation: THREE.Vector3): void {
    if (this.state === 'LIGHT_STUNNED') return;
    this.investigatePoint.copy(powerLocation);
    this.investigateTimer = 8.0;
    this.state = 'DRAWN_TO_POWER';
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    flashlight: FlashlightSystem,
    electricity: ElectricitySystem,
    soundPulses: SoundPulse[],
    colliders: ColliderBox[]
  ): {
    damagedPlayer: number;
    justStunned: boolean;
    justAlerted: boolean;
    shockedByHazard: boolean;
    proximity: number;
  } {
    let damagedPlayer = 0;
    let justStunned = false;
    let justAlerted = false;
    let shockedByHazard = false;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.shockCooldown = Math.max(0, this.shockCooldown - dt);
    this.investigateTimer = Math.max(0, this.investigateTimer - dt);

    _hollowPos.set(this.position.x, 1.45, this.position.z);
    _toPlayer.copy(playerPos).sub(this.position);
    _toPlayer.y = 0;
    const distToPlayer = _toPlayer.length();
    const proximity = THREE.MathUtils.clamp(1 - (distToPlayer - 3) / 19, 0, 1);

    // 1. Check Electrified Puddle Hazard
    if (this.shockCooldown <= 0 && electricity.isPointInHazard(this.position)) {
      this.shockCooldown = 5.0;
      this.stunTimer = 3.5;
      this.state = 'LIGHT_STUNNED';
      shockedByHazard = true;
      justStunned = true;
    }

    // 2. Check Direct Flashlight Beam Exposure (interruption mechanic!)
    const litByBeam = flashlight.isIlluminatingPoint(_hollowPos, 19);
    if (litByBeam && this.state !== 'LIGHT_STUNNED') {
      this.lightExposure += dt;
      // Shining light on it also warns it of your direction, unless stunned!
      if (this.lightExposure >= 0.85) {
        this.lightExposure = 0;
        this.stunTimer = 3.6;
        this.state = 'LIGHT_STUNNED';
        justStunned = true;
      }
    } else {
      this.lightExposure = Math.max(0, this.lightExposure - dt * 0.8);
    }

    // 3. Stun handling
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer <= 0 && this.state === 'LIGHT_STUNNED') {
        this.state = 'STALK';
      }
    }

    // 4. Sensory triggers when not stunned
    if (this.state !== 'LIGHT_STUNNED' && this.stunTimer <= 0) {
      // Loud sounds pull it
      for (const pulse of soundPulses) {
        if (pulse.position.distanceTo(this.position) <= pulse.radius) {
          this.investigatePoint.copy(pulse.position);
          this.investigateTimer = 6.5;
          if (this.state !== 'HUNT') {
            this.state = 'INVESTIGATE_SOUND';
          }
        }
      }

      // Sight / light / proximity detection
      const detectionRange = flashlight.enabled
        ? 18.0
        : electricity.generatorRunning
          ? 12.0
          : 7.5;

      if (distToPlayer < detectionRange || (litByBeam && distToPlayer < 19)) {
        if (this.state !== 'HUNT') {
          this.state = 'HUNT';
          justAlerted = true;
        }
      } else if (this.state === 'HUNT' && distToPlayer > 23) {
        this.state = this.investigateTimer > 0 ? 'INVESTIGATE_SOUND' : 'STALK';
      }

      // Movement
      if (this.state === 'HUNT') {
        if (distToPlayer > 0.01) {
          _toPlayer.divideScalar(distToPlayer);
          const huntSpeed = electricity.stationPowered ? 5.15 : 4.55;
          if (distToPlayer > 1.45) {
            this.position.addScaledVector(_toPlayer, huntSpeed * dt);
          }
          this.yaw = Math.atan2(-_toPlayer.x, -_toPlayer.z);
          this.animPhase += dt * 11;
        }
        if (distToPlayer < 2.15 && this.attackCooldown <= 0) {
          this.attackCooldown = 1.45;
          damagedPlayer = 24;
        }
      } else if (this.state === 'DRAWN_TO_POWER' || this.state === 'INVESTIGATE_SOUND') {
        _target.copy(this.investigatePoint).sub(this.position);
        _target.y = 0;
        const d = _target.length();
        if (d > 1.2 && this.investigateTimer > 0) {
          _target.divideScalar(d);
          this.position.addScaledVector(_target, 3.6 * dt);
          this.yaw = Math.atan2(-_target.x, -_target.z);
          this.animPhase += dt * 8;
        } else {
          this.state = 'STALK';
        }
      } else {
        // Eerie prowling stalk around north/central street
        this.patrolAngle += dt * 0.42;
        const targetX = Math.sin(this.patrolAngle) * 7.5;
        const targetZ = -12 + Math.cos(this.patrolAngle * 0.8) * 9.5;
        _target.set(targetX - this.position.x, 0, targetZ - this.position.z);
        const d = _target.length();
        if (d > 0.3) {
          _target.divideScalar(d);
          this.position.addScaledVector(_target, 2.35 * dt);
          this.yaw = Math.atan2(-_target.x, -_target.z);
          this.animPhase += dt * 5.5;
        }
      }
    }

    resolveEnemyCollision(this.position, 0.52, colliders);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -23, 23);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -31, 24);

    // Update rig & disturbing supernatural posture
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    if (this.state === 'LIGHT_STUNNED') {
      // Recoil backward, raising elongated arms to shield eyes
      this.rig.spine.rotation.x = THREE.MathUtils.damp(this.rig.spine.rotation.x, 0.25, 10, dt);
      this.rig.leftArm.rotation.x = THREE.MathUtils.damp(this.rig.leftArm.rotation.x, -2.1, 12, dt);
      this.rig.rightArm.rotation.x = THREE.MathUtils.damp(this.rig.rightArm.rotation.x, -2.1, 12, dt);
      this.rig.head.rotation.z = Math.sin(elapsed * 26) * 0.22;
      this.rig.coreLight.intensity = 2.8 + Math.sin(elapsed * 30) * 1.4;
      this.rig.eyeMat.emissiveIntensity = 4.0;
    } else {
      const twitch = Math.sin(elapsed * 19) * (this.state === 'HUNT' ? 0.14 : 0.05);
      this.rig.spine.rotation.x = THREE.MathUtils.damp(
        this.rig.spine.rotation.x,
        this.state === 'HUNT' ? -0.4 : -0.22,
        8,
        dt
      );
      this.rig.head.rotation.z = twitch;
      const swing = Math.sin(this.animPhase) * 0.55;
      this.rig.leftLeg.rotation.x = swing;
      this.rig.rightLeg.rotation.x = -swing;
      this.rig.leftArm.rotation.x = -swing * 0.7 - (this.state === 'HUNT' ? 0.75 : 0.2);
      this.rig.rightArm.rotation.x = swing * 0.7 - (this.state === 'HUNT' ? 0.75 : 0.2);
      this.rig.coreLight.intensity = this.state === 'HUNT' ? 2.2 : 1.0;
      this.rig.eyeMat.emissiveIntensity = this.state === 'HUNT' ? 3.2 : 1.8;
    }

    return {
      damagedPlayer,
      justStunned,
      justAlerted,
      shockedByHazard,
      proximity,
    };
  }
}
