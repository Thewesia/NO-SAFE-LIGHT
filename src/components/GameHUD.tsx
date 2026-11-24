import React from 'react';
import { HudSnapshot } from '../types/game';

interface GameHUDProps {
  hud: HudSnapshot;
  onPause: () => void;
  onToggleMute: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ hud, onPause, onToggleMute }) => {
  const healthPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const lowHealth = hud.health <= 30;
  const lowBattery = hud.battery <= 20;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Damage Flash Vignette */}
      {hud.damageFlash > 0.01 && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            opacity: hud.damageFlash * 0.65,
            background:
              'radial-gradient(circle at center, transparent 42%, rgba(185, 28, 28, 0.72) 100%)',
          }}
        />
      )}

      {/* Supernatural Proximity Vignette (THE HOLLOW nearby) */}
      {hud.hollowProximity > 0.08 && !hud.hollowStunned && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            opacity: hud.hollowProximity * 0.45,
            background:
              'radial-gradient(circle at center, transparent 52%, rgba(30, 58, 138, 0.55) 100%)',
          }}
        />
      )}

      {/* Center Reticle & Contextual Prompts */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          {/* Minimal Crosshair */}
          <div className="relative h-5 w-5">
            <span className="absolute top-0 left-1/2 h-1.5 w-[1.5px] -translate-x-1/2 bg-white/75" />
            <span className="absolute bottom-0 left-1/2 h-1.5 w-[1.5px] -translate-x-1/2 bg-white/75" />
            <span className="absolute top-1/2 left-0 h-[1.5px] w-1.5 -translate-y-1/2 bg-white/75" />
            <span className="absolute top-1/2 right-0 h-[1.5px] w-1.5 -translate-y-1/2 bg-white/75" />
            <span className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D99B26]/90" />
          </div>

          {/* Interaction Prompt */}
          {hud.promptText && (
            <div className="mt-7 rounded border border-[#D99B26]/70 bg-[#0B0D10]/88 px-3.5 py-1.5 text-xs font-medium text-[#F3F4F6] whitespace-nowrap">
              <span className="mr-2 font-mono font-semibold text-[#D99B26]">[E]</span>
              {hud.promptText}
            </div>
          )}

          {/* Contextual Status Banner */}
          {hud.statusBanner && (
            <div className="mt-3 rounded border border-[#374151] bg-[#0B0D10]/88 px-4 py-1.5 text-xs text-[#E5E7EB]">
              {hud.statusBanner}
            </div>
          )}
        </div>
      </div>

      {/* Perimeter HUD */}
      <div className="flex h-full flex-col justify-between p-4 sm:p-6">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-4">
          {/* Top-Left: Objective & Step Progress */}
          <div className="max-w-md rounded border border-[#374151]/80 bg-[#0B0D10]/80 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wider text-[#D99B26] uppercase">
              <span>The First Night</span>
              <span aria-hidden="true" className="text-[#4B5563]">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#9CA3AF]">
                Step {hud.missionStepIndex}/4
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-[#F3F4F6] sm:text-sm">
              {hud.objectiveText}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-1 rounded-sm ${
                    step <= hud.missionStepIndex ? 'bg-[#D99B26]' : 'bg-[#1F2937]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Top-Right: Camera / Audio / Pause Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            {!hud.pointerLocked && (
              <span className="hidden rounded border border-[#374151]/70 bg-[#0B0D10]/80 px-3 py-1.5 text-[11px] text-[#9CA3AF] md:inline-block whitespace-nowrap">
                Click view to lock aim (or drag)
              </span>
            )}
            <button
              type="button"
              onClick={onToggleMute}
              className="cursor-pointer rounded border border-[#374151] bg-[#0B0D10]/82 px-3 py-1.5 text-xs font-medium text-[#D1D5DB] transition-colors hover:border-[#D99B26] hover:text-white whitespace-nowrap shrink-0"
            >
              {hud.muted ? 'Muted' : 'Audio'}
            </button>
            <button
              type="button"
              onClick={onPause}
              className="cursor-pointer rounded border border-[#374151] bg-[#0B0D10]/82 px-3 py-1.5 text-xs font-medium text-[#D1D5DB] transition-colors hover:border-[#D99B26] hover:text-white whitespace-nowrap shrink-0"
            >
              Pause [Esc]
            </button>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex items-end justify-between gap-4">
          {/* Bottom-Left: Health & Stamina */}
          <div className="w-56 rounded border border-[#374151]/80 bg-[#0B0D10]/82 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] tracking-wider text-[#9CA3AF] uppercase">
                Health
              </span>
              <span
                className={`font-mono text-sm font-semibold tabular-nums ${
                  lowHealth ? 'text-[#EF4444]' : 'text-[#F3F4F6]'
                }`}
              >
                {hud.health} / {hud.maxHealth}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-[#1F2937]">
              <div
                className={`h-full transition-[width] duration-150 ${
                  lowHealth ? 'bg-[#DC2626]' : 'bg-[#E5E7EB]'
                }`}
                style={{ width: `${healthPct}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <span>Stamina</span>
              <span className="font-mono tabular-nums">{hud.stamina}%</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-[#1F2937]">
              <div
                className="h-full bg-[#60A5FA]"
                style={{ width: `${hud.stamina}%` }}
              />
            </div>
          </div>

          {/* Bottom-Right: Flashlight Battery, Pistol Ammo, Camera Mode */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 rounded border border-[#374151]/80 bg-[#0B0D10]/82 px-4 py-3">
              {/* Flashlight */}
              <div className="pr-3 border-r border-[#374151]/70">
                <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] uppercase">
                  <span>Light [F]</span>
                  <span
                    className={
                      hud.flashlightOn ? 'text-[#D99B26]' : 'text-[#6B7280]'
                    }
                  >
                    {hud.flashlightOn ? 'On' : 'Off'}
                  </span>
                </div>
                <div
                  className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${
                    lowBattery ? 'text-[#EF4444]' : 'text-[#F3F4F6]'
                  }`}
                >
                  {hud.battery}%
                </div>
              </div>

              {/* Ammunition */}
              <div className="pr-3 border-r border-[#374151]/70">
                <div className="text-[11px] text-[#9CA3AF] uppercase">
                  9mm [R]
                </div>
                <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#F3F4F6]">
                  {hud.reloading ? (
                    <span className="text-xs text-[#D99B26]">Reloading</span>
                  ) : (
                    <>
                      {hud.ammoInMag}{' '}
                      <span className="text-xs text-[#9CA3AF]">
                        / {hud.reserveAmmo}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Camera & Fuse Status */}
              <div>
                <div className="text-[11px] text-[#9CA3AF] uppercase">
                  View [V]
                </div>
                <div className="mt-0.5 font-mono text-xs font-medium text-[#D1D5DB]">
                  {hud.perspective === 'third_person' ? '3rd Person' : '1st Person'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
