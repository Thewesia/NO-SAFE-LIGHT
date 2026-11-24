import React, { useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { MenuOverlays } from './components/MenuOverlays';
import { GameEngine } from './game/GameEngine';
import { HudSnapshot } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  status: 'MENU',
  missionStep: 'FIND_FUSE',
  missionStepIndex: 1,
  objectiveText: 'Find the missing 60A fuse in the Maintenance Depot',
  health: 100,
  maxHealth: 100,
  stamina: 100,
  battery: 100,
  flashlightOn: true,
  ammoInMag: 8,
  magCapacity: 8,
  reserveAmmo: 16,
  reloading: false,
  hasFuse: false,
  generatorOn: false,
  stationPowered: false,
  perspective: 'third_person',
  promptText: null,
  statusBanner: null,
  hollowProximity: 0,
  hollowStunned: false,
  scavengerDefeated: false,
  damageFlash: 0,
  pointerLocked: false,
  muted: false,
  elapsedSeconds: 0,
  shotsFired: 0,
  hitsLanded: 0,
  failReason: '',
};

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(
      container,
      (snap) => setHud(snap),
      (lost) => setContextLost(lost)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0B0D10]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={mountRef} className="h-full w-full" />

      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B0D10]/95 p-6 text-center">
          <div className="max-w-sm rounded border border-[#374151] bg-[#11141A] p-6">
            <h2 className="font-display text-2xl font-bold text-white">Graphics Context Lost</h2>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Waiting for WebGL graphics context recovery.
            </p>
          </div>
        </div>
      )}

      {hud.status === 'PLAYING' && (
        <GameHUD
          hud={hud}
          onPause={() => engineRef.current?.pauseMission()}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      <MenuOverlays
        hud={hud}
        onStart={() => engineRef.current?.startMission()}
        onResume={() => engineRef.current?.resumeMission()}
        onRestart={() => engineRef.current?.restartMission()}
        onMainMenu={() => engineRef.current?.returnToMenu()}
        onToggleMute={() => engineRef.current?.toggleMute()}
      />
    </div>
  );
}

export default App;
