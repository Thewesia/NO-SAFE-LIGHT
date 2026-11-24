import * as THREE from 'three';
import { WorldBuildResult } from './worldBuilder';

export class ElectricitySystem {
  public hasFuse = false;
  public fuseInstalled = false;
  public generatorRunning = false;
  public securityDoorOpen = false;
  public stationPowered = false;
  public extractionUnlocked = false;

  private doorY: number;
  private sparkTimer = 0;
  private shockCooldown = 0;

  constructor(private world: WorldBuildResult) {
    this.doorY = world.securityDoorClosedY;
  }

  public reset(): void {
    this.hasFuse = false;
    this.fuseInstalled = false;
    this.generatorRunning = false;
    this.securityDoorOpen = false;
    this.stationPowered = false;
    this.extractionUnlocked = false;
    this.doorY = this.world.securityDoorClosedY;
    this.world.securityDoorMesh.position.y = this.doorY;
    this.world.securityDoorCollider.enabled = true;
    this.shockCooldown = 0;

    this.world.generatorIndicatorMat.color.setHex(0xef4444);
    this.world.generatorIndicatorMat.emissive.setHex(0xdc2626);
    this.world.stationIndicatorMat.color.setHex(0xdc2626);
    this.world.stationIndicatorMat.emissive.setHex(0x991b1b);
    this.world.extractionBeaconMat.color.setHex(0xdc2626);
    this.world.extractionBeaconMat.emissive.setHex(0x991b1b);
    this.world.extractionBeaconLight.color.setHex(0xdc2626);
    this.world.extractionBeaconLight.intensity = 1.6;
    this.world.hazardLight.intensity = 0;
    (this.world.hazardSparks.material as THREE.PointsMaterial).opacity = 0;

    for (const node of this.world.poweredLights) {
      node.light.intensity = 0;
      node.bulbMat.emissive.setHex(0x000000);
      node.bulbMat.emissiveIntensity = 0;
    }

    // Restore interactable labels
    for (const item of this.world.interactables) {
      item.consumed = false;
      item.mesh.visible = true;
      if (item.kind === 'generator') item.label = 'Backup Generator (Fuse Missing)';
      if (item.kind === 'security_door') item.label = 'Station Shutter Control (No Power)';
      if (item.kind === 'station_breaker') item.label = 'Emergency Station Main Relay';
      if (item.kind === 'extraction_gate') item.label = 'North Extraction Gate (Power Offline)';
    }
  }

  public collectFuse(): void {
    this.hasFuse = true;
    const gen = this.world.interactables.find((i) => i.kind === 'generator');
    if (gen) gen.label = 'Install 60A Fuse & Start Generator';
  }

  public activateGenerator(): void {
    this.fuseInstalled = true;
    this.generatorRunning = true;

    this.world.generatorIndicatorMat.color.setHex(0xfbbf24);
    this.world.generatorIndicatorMat.emissive.setHex(0xd97706);

    const doorCtrl = this.world.interactables.find((i) => i.kind === 'security_door');
    if (doorCtrl) doorCtrl.label = 'Open Emergency Station Shutter';

    const gen = this.world.interactables.find((i) => i.kind === 'generator');
    if (gen) {
      gen.label = 'Generator Running';
      gen.consumed = true;
    }
  }

  public openSecurityDoor(): void {
    this.securityDoorOpen = true;
    this.world.securityDoorCollider.enabled = false;
    const doorCtrl = this.world.interactables.find((i) => i.kind === 'security_door');
    if (doorCtrl) doorCtrl.consumed = true;
  }

  public activateStationPower(): void {
    this.stationPowered = true;
    this.extractionUnlocked = true;

    this.world.stationIndicatorMat.color.setHex(0x38bdf8);
    this.world.stationIndicatorMat.emissive.setHex(0x0284c7);

    this.world.extractionBeaconMat.color.setHex(0xfbbf24);
    this.world.extractionBeaconMat.emissive.setHex(0xd97706);
    this.world.extractionBeaconLight.color.setHex(0xfbbf24);
    this.world.extractionBeaconLight.intensity = 4.4;

    const breaker = this.world.interactables.find((i) => i.kind === 'station_breaker');
    if (breaker) breaker.consumed = true;

    const ext = this.world.interactables.find((i) => i.kind === 'extraction_gate');
    if (ext) ext.label = 'Escape Through Extraction Gate';
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3
  ): { playerShocked: boolean } {
    let playerShocked = false;
    this.shockCooldown = Math.max(0, this.shockCooldown - dt);

    // Smooth motorized shutter animation
    const targetDoorY = this.securityDoorOpen
      ? this.world.securityDoorOpenY
      : this.world.securityDoorClosedY;
    this.doorY = THREE.MathUtils.damp(this.doorY, targetDoorY, 6, dt);
    this.world.securityDoorMesh.position.y = this.doorY;

    // Flicker ambient emergency/trouble lights
    for (const fl of this.world.flickerLights) {
      const f = Math.sin(elapsed * 9 + fl.seed) * Math.sin(elapsed * 23 + fl.seed);
      fl.light.intensity = fl.baseIntensity * (f > -0.55 ? 1.0 : 0.42);
    }

    // Powered Streetlights & Station Floodlights
    for (const node of this.world.poweredLights) {
      const active =
        (!node.requiresGenerator || this.generatorRunning) &&
        (!node.requiresStation || this.stationPowered);
      if (active) {
        const hum = 0.92 + 0.08 * Math.sin(elapsed * 14 + node.flickerSeed);
        node.light.intensity = THREE.MathUtils.damp(
          node.light.intensity,
          node.baseIntensity * hum,
          8,
          dt
        );
        node.bulbMat.emissive.setHex(node.emissiveColor);
        node.bulbMat.emissiveIntensity = 1.8;
      } else {
        node.light.intensity = 0;
        node.bulbMat.emissive.setHex(0x000000);
        node.bulbMat.emissiveIntensity = 0;
      }
    }

    // Electrical Hazard puddle sparks once generator runs
    if (this.generatorRunning) {
      this.sparkTimer += dt;
      const posAttr = this.world.hazardSparks.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += (Math.random() - 0.35) * dt * 4.5;
        if (arr[i + 1] > 1.35 || arr[i + 1] < 0.05) {
          arr[i] = this.world.hazardZone.x + (Math.random() - 0.5) * 2.4;
          arr[i + 1] = 0.08 + Math.random() * 0.4;
          arr[i + 2] = this.world.hazardZone.z + (Math.random() - 0.5) * 2.4;
        }
      }
      posAttr.needsUpdate = true;
      (this.world.hazardSparks.material as THREE.PointsMaterial).opacity =
        0.55 + 0.45 * Math.sin(elapsed * 28);
      this.world.hazardLight.intensity = 1.6 + Math.random() * 2.2;

      // Check if player steps into electrified puddle
      const dx = playerPos.x - this.world.hazardZone.x;
      const dz = playerPos.z - this.world.hazardZone.z;
      if (dx * dx + dz * dz < this.world.hazardZone.radius * this.world.hazardZone.radius) {
        if (this.shockCooldown <= 0 && playerPos.y < 0.5) {
          this.shockCooldown = 1.1;
          playerShocked = true;
        }
      }
    }

    return { playerShocked };
  }

  public isPointInHazard(pos: THREE.Vector3): boolean {
    if (!this.generatorRunning) return false;
    const dx = pos.x - this.world.hazardZone.x;
    const dz = pos.z - this.world.hazardZone.z;
    return dx * dx + dz * dz < this.world.hazardZone.radius * this.world.hazardZone.radius;
  }
}
