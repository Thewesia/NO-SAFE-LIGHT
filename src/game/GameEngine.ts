import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameStatus, HudSnapshot, SoundPulse } from '../types/game';
import { CameraController } from './CameraController';
import { createAlexMercerModel, createHollowModel, createScavengerModel } from './characters';
import { CombatSystem } from './CombatSystem';
import { ElectricitySystem } from './ElectricitySystem';
import { HollowAI, ScavengerAI } from './EnemyAI';
import { FlashlightSystem } from './FlashlightSystem';
import { InteractionSystem } from './InteractionSystem';
import { MissionManager } from './MissionManager';
import { PlayerController } from './PlayerController';
import { createMaterialLibrary, MaterialLibrary } from './proceduralMaterials';
import { soundEngine } from './soundEngine';
import { buildGreyhavenWorld, WorldBuildResult } from './worldBuilder';

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class GameEngine {
  public status: GameStatus = 'MENU';

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly materials: MaterialLibrary;
  private readonly world: WorldBuildResult;

  private readonly player: PlayerController;
  private readonly cameraCtrl: CameraController;
  private readonly flashlight: FlashlightSystem;
  private readonly electricity: ElectricitySystem;
  private readonly combat: CombatSystem;
  private readonly interaction: InteractionSystem;
  private readonly mission: MissionManager;
  private readonly scavenger: ScavengerAI;
  private readonly hollow: HollowAI;

  private readonly heldKeys = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly soundPulses: SoundPulse[] = [];

  private frameId = 0;
  private lastNow = performance.now();
  private elapsedSeconds = 0;
  private menuOrbitTime = 0;
  private hudEmitAccum = 0;
  private pointerLocked = false;
  private draggingLook = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private hoverMouseX: number | null = null;
  private dragMoved = false;
  private failReason = '';
  private disposed = false;

  private readonly onHudUpdate: (snap: HudSnapshot) => void;
  private readonly onContextLostChange: (lost: boolean) => void;

  constructor(
    private container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onContextLostChange: (lost: boolean) => void
  ) {
    this.onHudUpdate = onHudUpdate;
    this.onContextLostChange = onContextLostChange;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090c12);
    this.scene.fog = new THREE.FogExp2(0x090c12, 0.036);

    // Studio/Storm Environment Reflection Map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    pmrem.dispose();

    // Camera
    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 140);

    // Base Moonlight / Cold Storm Fill (subtle so darkness + flashlight matter!)
    const hemi = new THREE.HemisphereLight(0x3b4d6b, 0x0c0e14, 0.36);
    this.scene.add(hemi);

    const moonKey = new THREE.DirectionalLight(0x8fa8c8, 0.42);
    moonKey.position.set(-22, 34, 18);
    moonKey.castShadow = true;
    moonKey.shadow.mapSize.set(1024, 1024);
    moonKey.shadow.camera.left = -36;
    moonKey.shadow.camera.right = 36;
    moonKey.shadow.camera.top = 36;
    moonKey.shadow.camera.bottom = -36;
    moonKey.shadow.camera.near = 2;
    moonKey.shadow.camera.far = 90;
    moonKey.shadow.bias = -0.0005;
    this.scene.add(moonKey);

    // Build Materials & World
    this.materials = createMaterialLibrary(this.renderer);
    this.world = buildGreyhavenWorld(this.scene, this.materials);

    // Build Characters & Systems
    const alexRig = createAlexMercerModel(this.materials.contactShadow);
    this.scene.add(alexRig.root);

    const scavRig = createScavengerModel(this.materials.contactShadow);
    this.scene.add(scavRig.root);

    const hollowRig = createHollowModel(this.materials.contactShadow);
    this.scene.add(hollowRig.root);

    this.player = new PlayerController(alexRig);
    this.cameraCtrl = new CameraController(this.camera);
    this.flashlight = new FlashlightSystem(this.scene);
    this.electricity = new ElectricitySystem(this.world);
    this.combat = new CombatSystem(this.scene);
    this.interaction = new InteractionSystem();
    this.mission = new MissionManager();
    this.scavenger = new ScavengerAI(scavRig, this.scene);
    this.hollow = new HollowAI(hollowRig);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.scheduleNextFrame();
  }

  public startMission(): void {
    soundEngine.startAmbience();
    this.resetAll();
    this.status = 'PLAYING';
    this.mission.reset();
    this.requestLock();
    this.emitHud();
  }

  public resumeMission(): void {
    if (this.status !== 'PAUSED') return;
    this.status = 'PLAYING';
    this.heldKeys.clear();
    this.justPressed.clear();
    this.requestLock();
    this.emitHud();
  }

  public pauseMission(): void {
    if (this.status !== 'PLAYING') return;
    this.status = 'PAUSED';
    this.heldKeys.clear();
    this.justPressed.clear();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.emitHud();
  }

  public restartMission(): void {
    soundEngine.startAmbience();
    this.resetAll();
    this.status = 'PLAYING';
    this.mission.reset();
    this.requestLock();
    this.emitHud();
  }

  public returnToMenu(): void {
    this.resetAll();
    this.status = 'MENU';
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.emitHud();
  }

  public toggleMute(): void {
    soundEngine.toggleMute();
    this.emitHud();
  }

  private resetAll(): void {
    this.player.reset();
    this.cameraCtrl.reset();
    this.flashlight.reset();
    this.electricity.reset();
    this.combat.reset();
    this.scavenger.reset();
    this.hollow.reset();
    this.mission.reset();
    this.soundPulses.length = 0;
    this.elapsedSeconds = 0;
    this.failReason = '';
    this.hoverMouseX = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    soundEngine.setGeneratorHum(false);
  }

  private requestLock(): void {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Fallback drag-to-look remains active if iframe rejects pointer lock
    }
  }

  private addSoundPulse(pos: THREE.Vector3, radius: number, strength: number): void {
    this.soundPulses.push({
      position: pos.clone(),
      radius,
      strength,
      age: 0,
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextMenu = (e: MouseEvent) => e.preventDefault();

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostChange(true);
  };

  private handleContextRestored = () => {
    this.onContextLostChange(false);
  };

  private handleResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.draggingLook = false;
    this.hoverMouseX = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
  };

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (this.status === 'PLAYING') {
        e.preventDefault();
        this.pauseMission();
      } else if (this.status === 'PAUSED') {
        e.preventDefault();
        this.resumeMission();
      }
      return;
    }

    if (this.status !== 'PLAYING') return;
    if (!this.heldKeys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.heldKeys.add(e.code);

    if (e.code === 'Space') {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.status !== 'PLAYING') return;
    soundEngine.startAmbience();

    if (e.button === 0) {
      if (!this.pointerLocked) {
        this.requestLock();
        this.draggingLook = true;
        this.dragMoved = false;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else {
        this.fireWeapon();
      }
    } else if (e.button === 2 && !this.pointerLocked) {
      this.draggingLook = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.status !== 'PLAYING') return;
    if (this.pointerLocked) {
      this.cameraCtrl.addLookDelta(e.movementX, e.movementY);
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.cameraCtrl.addLookDelta(dx * 1.4, dy * 1.4);
    } else {
      // Allow smooth unlocked mouse turning even in sandboxed iframes without pointer lock
      if (this.lastMouseX !== 0 || this.lastMouseY !== 0) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.cameraCtrl.addLookDelta(dx * 1.15, dy * 1.0);
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.hoverMouseX = e.clientY > 90 ? e.clientX : null;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (this.status !== 'PLAYING') return;
    if (e.button === 0 && !this.pointerLocked) {
      if (!this.dragMoved) {
        this.fireWeapon();
      }
      this.draggingLook = false;
    } else if (e.button === 2) {
      this.draggingLook = false;
    }
  };

  private fireWeapon(): void {
    this.player.triggerCombatAlign();
    const res = this.combat.tryFire(
      this.camera,
      this.player.position,
      this.scavenger,
      this.hollow
    );
    if (res.status === 'fired') {
      soundEngine.playGunshot();
      this.cameraCtrl.addRecoil(0.045);
      this.addSoundPulse(this.player.position, 26, 1);

      if (res.hitKind === 'scavenger') {
        soundEngine.playMelee(true);
        if (res.scavengerDown) {
          this.combat.addAmmo(4);
          this.mission.showBanner('Scavenger incapacitated. Recovered +4 pistol rounds.');
        }
      } else if (res.hitKind === 'hollow') {
        this.mission.showBanner('Bullets only slow THE HOLLOW. Use your flashlight beam or electrical arcs!', 3.2);
      }
      this.emitHud();
    } else if (res.status === 'empty') {
      soundEngine.playEmptyClick();
      this.mission.showBanner('Empty magazine. Press [R] to reload.', 2.0);
      this.emitHud();
    }
  }

  private handleInteract(target: ReturnType<InteractionSystem['findNearest']>): void {
    if (!target) return;

    switch (target.kind) {
      case 'fuse':
        target.consumed = true;
        target.mesh.visible = false;
        this.electricity.collectFuse();
        soundEngine.playPickup();
        this.mission.setStep(
          'INSTALL_FUSE',
          '60A Fuse acquired. Head east to the Substation Generator.'
        );
        break;

      case 'battery':
        target.consumed = true;
        target.mesh.visible = false;
        this.flashlight.recharge(45);
        soundEngine.playPickup();
        this.mission.showBanner('Flashlight battery recharged (+45%).');
        break;

      case 'ammo':
        target.consumed = true;
        target.mesh.visible = false;
        this.combat.addAmmo(6);
        soundEngine.playPickup();
        this.mission.showBanner('Picked up +6 9mm rounds.');
        break;

      case 'medkit':
        target.consumed = true;
        target.mesh.visible = false;
        this.player.heal(40);
        soundEngine.playPickup();
        this.mission.showBanner('Medkit applied (+40 Health).');
        break;

      case 'generator':
        if (!this.electricity.hasFuse) {
          soundEngine.playEmptyClick();
          this.mission.showBanner('Requires the missing 60A Fuse from the Maintenance Depot.');
        } else if (!this.electricity.generatorRunning) {
          this.electricity.activateGenerator();
          soundEngine.playPowerSwitch();
          soundEngine.setGeneratorHum(true);
          this.addSoundPulse(target.position, 36, 1.5);
          this.hollow.alertToPower(target.position);
          this.mission.setStep(
            'POWER_STATION',
            'Power restored to streetlights—and THE HOLLOW heard the surge!'
          );
        }
        break;

      case 'security_door':
        if (!this.electricity.generatorRunning) {
          soundEngine.playEmptyClick();
          this.mission.showBanner('Shutter locked. Restore Substation Generator power first.');
        } else {
          this.electricity.openSecurityDoor();
          soundEngine.playPowerSwitch();
          this.addSoundPulse(target.position, 22, 1.0);
          this.mission.showBanner('Station shutter opening. Throw the Main Relay inside!');
        }
        break;

      case 'station_breaker':
        if (!this.electricity.generatorRunning) {
          soundEngine.playEmptyClick();
          this.mission.showBanner('No input voltage. Start the Backup Generator first.');
        } else if (!this.electricity.stationPowered) {
          this.electricity.activateStationPower();
          soundEngine.playPowerSwitch();
          this.addSoundPulse(target.position, 40, 2.0);
          this.hollow.alertToPower(this.player.position);
          this.mission.setStep(
            'REACH_EXTRACTION',
            'Emergency Station online! Extraction Gate unlocked to the North!'
          );
        }
        break;

      case 'extraction_gate':
        if (!this.electricity.extractionUnlocked) {
          soundEngine.playEmptyClick();
          this.mission.showBanner('Extraction Gate sealed. Restore Emergency Station power first.');
        } else {
          this.mission.setStep('EXTRACTED');
          this.status = 'VICTORY';
          soundEngine.playPickup();
          if (document.pointerLockElement === this.renderer.domElement) {
            document.exitPointerLock?.();
          }
        }
        break;
    }
    this.emitHud();
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    const dt = Math.min(rawDt, 0.05);

    if (this.status === 'MENU') {
      this.menuOrbitTime += dt;
      this.cameraCtrl.updateMenuOrbit(this.menuOrbitTime);
      this.updateRain(dt, new THREE.Vector3(0, 0, 8));
      this.flashlight.update(dt, this.camera, this.player.position, false, true);
      this.electricity.update(dt, this.menuOrbitTime, this.player.position);
      this.renderer.render(this.scene, this.camera);
      this.scheduleNextFrame();
      return;
    }

    if (this.status === 'PLAYING') {
      this.elapsedSeconds += dt;
      this.stepSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private stepSimulation(dt: number): void {
    // Edge-triggered actions
    if (this.justPressed.has('KeyF')) {
      const turnedOn = this.flashlight.toggle();
      soundEngine.playFlashlightClick(turnedOn);
      if (!turnedOn && this.flashlight.battery <= 0.5) {
        this.mission.showBanner('Flashlight battery depleted. Find a battery pickup.', 2.4);
      }
    }

    if (this.justPressed.has('KeyV')) {
      this.cameraCtrl.togglePerspective();
      soundEngine.playFlashlightClick(true);
    }

    if (this.justPressed.has('KeyR')) {
      if (this.combat.startReload()) {
        soundEngine.playReload();
      }
    }

    if (this.justPressed.has('KeyQ')) {
      const meleeRes = this.combat.tryMelee(
        this.player.position,
        this.cameraCtrl.yaw,
        this.scavenger,
        this.hollow
      );
      if (meleeRes.performed) {
        this.player.triggerMeleeAnim();
        soundEngine.playMelee(meleeRes.hitKind !== 'none');
        this.addSoundPulse(this.player.position, 9, 0.5);
        if (meleeRes.scavengerDown) {
          this.combat.addAmmo(4);
          this.mission.showBanner('Scavenger incapacitated. Recovered +4 pistol rounds.');
        }
      }
    }

    const nearestInteractable = this.interaction.findNearest(
      this.player.position,
      this.world.interactables
    );
    if (this.justPressed.has('KeyE') && nearestInteractable) {
      this.handleInteract(nearestInteractable);
    }

    // Continuous 360-degree turning via ArrowLeft / ArrowRight or unlocked edge panning
    const turnDir =
      (this.heldKeys.has('ArrowLeft') ? 1 : 0) -
      (this.heldKeys.has('ArrowRight') ? 1 : 0);
    if (turnDir !== 0) {
      this.cameraCtrl.yaw += turnDir * 2.6 * dt;
    } else if (!this.pointerLocked && !this.draggingLook && this.hoverMouseX !== null) {
      const vw = this.container.clientWidth || window.innerWidth;
      if (this.hoverMouseX < vw * 0.06) {
        this.cameraCtrl.yaw += 1.9 * dt;
      } else if (this.hoverMouseX > vw * 0.94) {
        this.cameraCtrl.yaw -= 1.9 * dt;
      }
    }

    // Update Player & Camera
    const moveRes = this.player.update(
      dt,
      this.heldKeys,
      this.justPressed,
      this.cameraCtrl.yaw,
      this.world.colliders,
      this.cameraCtrl.perspective === 'first_person'
    );
    if (moveRes.steppedLoudly) {
      this.addSoundPulse(this.player.position, 13, 0.6);
    }
    if (moveRes.vaulted) {
      soundEngine.playMelee(false);
    }

    this.cameraCtrl.update(
      dt,
      this.player.position,
      this.player.isSprinting,
      this.world.colliders
    );

    // Flashlight, Combat, Electricity, Rain
    this.flashlight.update(
      dt,
      this.camera,
      this.player.position,
      this.cameraCtrl.perspective === 'first_person',
      false
    );
    this.combat.update(dt);
    this.mission.update(dt);
    this.updateRain(dt, this.player.position);

    const elecRes = this.electricity.update(dt, this.elapsedSeconds, this.player.position);
    if (elecRes.playerShocked) {
      this.player.takeDamage(18);
      soundEngine.playSparkZap();
      soundEngine.playPlayerHit();
      this.mission.showBanner('High-voltage puddle! Watch the energized cables.', 2.6);
    }

    // Decay sound pulses
    for (let i = this.soundPulses.length - 1; i >= 0; i--) {
      this.soundPulses[i].age += dt;
      if (this.soundPulses[i].age > 0.65) {
        this.soundPulses.splice(i, 1);
      }
    }

    // Update Enemies
    const scavRes = this.scavenger.update(
      dt,
      this.player.position,
      this.flashlight.enabled,
      this.soundPulses,
      this.world.colliders
    );
    if (scavRes.firedShot) {
      soundEngine.playGunshot();
      this.addSoundPulse(this.scavenger.position, 22, 1.0);
    }
    if (scavRes.hitPlayerDamage > 0) {
      this.player.takeDamage(scavRes.hitPlayerDamage);
      soundEngine.playPlayerHit();
    }

    const hollowRes = this.hollow.update(
      dt,
      this.elapsedSeconds,
      this.player.position,
      this.flashlight,
      this.electricity,
      this.soundPulses,
      this.world.colliders
    );
    if (hollowRes.justStunned) {
      soundEngine.playHollowShriek(true);
      this.mission.showBanner(
        hollowRes.shockedByHazard
          ? 'THE HOLLOW was shocked by the live cable!'
          : 'Direct flashlight beam staggered THE HOLLOW!'
      );
    } else if (hollowRes.justAlerted) {
      soundEngine.playHollowShriek(false);
    }
    if (hollowRes.damagedPlayer > 0) {
      this.player.takeDamage(hollowRes.damagedPlayer);
      soundEngine.playPlayerHit();
    }

    // Auto-extract if player walks right through open extraction gate after station powered
    if (
      this.electricity.extractionUnlocked &&
      this.player.position.z <= -32.4 &&
      Math.abs(this.player.position.x) <= 3.6
    ) {
      this.mission.setStep('EXTRACTED');
      this.status = 'VICTORY';
      soundEngine.playPickup();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }

    // Defeat Check
    if (this.player.health <= 0 && this.status === 'PLAYING') {
      this.status = 'GAME_OVER';
      this.failReason =
        hollowRes.damagedPlayer > 0
          ? 'Overwhelmed by THE HOLLOW in the blackout.'
          : elecRes.playerShocked
            ? 'Electrocuted by downed high-voltage lines.'
            : 'Killed in action on Greyhaven Street.';
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }

    this.justPressed.clear();

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05 || this.status !== 'PLAYING') {
      this.hudEmitAccum = 0;
      this.emitHud(nearestInteractable?.label || null, hollowRes.proximity);
    }
  }

  private updateRain(dt: number, centerPos: THREE.Vector3): void {
    const posAttr = this.world.rainPoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= 15.5 * dt;
      arr[i] -= 1.8 * dt;
      if (arr[i + 1] < 0) {
        arr[i] = centerPos.x + (Math.random() - 0.5) * 40;
        arr[i + 1] = 15 + Math.random() * 4;
        arr[i + 2] = centerPos.z + (Math.random() - 0.5) * 40;
      }
    }
    posAttr.needsUpdate = true;
  }

  private emitHud(promptText: string | null = null, hollowProximity = 0): void {
    this.onHudUpdate({
      status: this.status,
      missionStep: this.mission.step,
      missionStepIndex: this.mission.getStepIndex(),
      objectiveText: this.mission.getObjectiveText(),
      health: Math.ceil(this.player.health),
      maxHealth: this.player.maxHealth,
      stamina: Math.round(this.player.stamina),
      battery: Math.round(this.flashlight.battery),
      flashlightOn: this.flashlight.enabled,
      ammoInMag: this.combat.ammoInMag,
      magCapacity: this.combat.magCapacity,
      reserveAmmo: this.combat.reserveAmmo,
      reloading: this.combat.reloading,
      hasFuse: this.electricity.hasFuse,
      generatorOn: this.electricity.generatorRunning,
      stationPowered: this.electricity.stationPowered,
      perspective: this.cameraCtrl.perspective,
      promptText,
      statusBanner: this.mission.bannerText,
      hollowProximity,
      hollowStunned: this.hollow.state === 'LIGHT_STUNNED',
      scavengerDefeated: this.scavenger.state === 'INCAPACITATED',
      damageFlash: this.player.damageFlash,
      pointerLocked: this.pointerLocked,
      muted: soundEngine.isMuted(),
      elapsedSeconds: this.elapsedSeconds,
      shotsFired: this.combat.shotsFired,
      hitsLanded: this.combat.hitsLanded,
      failReason: this.failReason,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    canvas.removeEventListener('contextmenu', this.handleContextMenu);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.flashlight.dispose();
    this.world.dispose();
    this.materials.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
