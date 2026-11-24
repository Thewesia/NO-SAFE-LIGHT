import * as THREE from 'three';

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type CameraPerspective = 'third_person' | 'first_person';

export type MissionStep =
  | 'FIND_FUSE'
  | 'INSTALL_FUSE'
  | 'POWER_STATION'
  | 'REACH_EXTRACTION'
  | 'EXTRACTED';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  isVaultable?: boolean;
  enabled?: boolean;
}

export type InteractableKind =
  | 'fuse'
  | 'battery'
  | 'ammo'
  | 'medkit'
  | 'generator'
  | 'station_breaker'
  | 'security_door'
  | 'extraction_gate';

export interface InteractableObject {
  id: string;
  kind: InteractableKind;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  radius: number;
  consumed: boolean;
  label: string;
}

export interface PoweredLightNode {
  light: THREE.PointLight | THREE.SpotLight;
  bulbMat: THREE.MeshStandardMaterial;
  baseIntensity: number;
  emissiveColor: number;
  requiresGenerator: boolean;
  requiresStation: boolean;
  flickerSeed: number;
}

export interface SoundPulse {
  position: THREE.Vector3;
  radius: number;
  strength: number;
  age: number;
}

export interface HudSnapshot {
  status: GameStatus;
  missionStep: MissionStep;
  missionStepIndex: number;
  objectiveText: string;
  health: number;
  maxHealth: number;
  stamina: number;
  battery: number;
  flashlightOn: boolean;
  ammoInMag: number;
  magCapacity: number;
  reserveAmmo: number;
  reloading: boolean;
  hasFuse: boolean;
  generatorOn: boolean;
  stationPowered: boolean;
  perspective: CameraPerspective;
  promptText: string | null;
  statusBanner: string | null;
  hollowProximity: number; // 0..1 atmospheric warning intensity
  hollowStunned: boolean;
  scavengerDefeated: boolean;
  damageFlash: number; // 0..1
  pointerLocked: boolean;
  muted: boolean;
  elapsedSeconds: number;
  shotsFired: number;
  hitsLanded: number;
  failReason: string;
}
