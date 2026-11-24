import React, { useEffect } from 'react';
import { HudSnapshot } from '../types/game';

interface MenuOverlaysProps {
  hud: HudSnapshot;
  onStart: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onToggleMute: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const MenuOverlays: React.FC<MenuOverlaysProps> = ({
  hud,
  onStart,
  onResume,
  onRestart,
  onMainMenu,
  onToggleMute,
}) => {
  useEffect(() => {
    if (hud.status !== 'MENU') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON') return;
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.status, onStart]);

  if (hud.status === 'MENU') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-between bg-gradient-to-r from-[#0B0D10]/88 via-[#0B0D10]/55 to-transparent p-8 text-[#F3F4F6]">
        <header className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-[0.2em] text-[#D99B26] uppercase">
            Greyhaven · Blackout Sector 04
          </span>
          <button
            type="button"
            onClick={onToggleMute}
            className="cursor-pointer rounded border border-[#374151] bg-[#0B0D10]/80 px-4 py-2 text-xs font-medium text-[#E5E7EB] transition-colors hover:border-[#D99B26] whitespace-nowrap shrink-0"
          >
            {hud.muted ? 'Audio Off' : 'Audio On'}
          </button>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
          <div className="max-w-lg">
            {/* Minimal Industrial Light Emblem */}
            <div className="mb-5 flex items-center gap-3">
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                aria-hidden="true"
                className="text-[#D99B26]"
              >
                <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.7" />
                <path d="M19.5 7L12 20H18L16.5 29L24 16H18L19.5 7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <span className="font-mono text-xs tracking-[0.18em] text-[#9CA3AF] uppercase">
                Mission 01 · The First Night
              </span>
            </div>

            <h1 className="font-display text-6xl font-bold tracking-tight text-white sm:text-7xl">
              NO SAFE LIGHT
            </h1>

            <p className="mt-3 text-base font-medium text-[#D99B26]">
              When the lights come on, they know where you are.
            </p>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#D1D5DB]">
              Locate the missing 60A fuse, start the substation generator, restore power to the
              Emergency Station, and reach the North Extraction Gate before the blackout takes you.
            </p>

            <div className="mt-8 flex items-center gap-4">
              <button
                type="button"
                onClick={onStart}
                className="cursor-pointer rounded border border-[#D99B26] bg-[#D99B26] px-7 py-3 text-sm font-bold tracking-wide text-[#0B0D10] transition-colors hover:bg-[#e5aa3b] whitespace-nowrap shrink-0"
              >
                Start Mission
              </button>
            </div>
          </div>
        </main>

        <footer className="border-t border-[#374151]/50 pt-4 text-xs text-[#9CA3AF]">
          WASD Move · Mouse Aim · Shift Sprint · Space Jump/Vault · E Interact · F Flashlight · V
          View · Q Melee · R Reload · LMB Shoot · Esc Pause
        </footer>
      </div>
    );
  }

  if (hud.status === 'PAUSED') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mission Paused"
        className="fixed inset-0 z-30 flex items-center justify-center bg-[#080A0D]/82 p-6"
      >
        <div className="w-full max-w-md rounded border border-[#374151] bg-[#0F1216] p-7 shadow-2xl">
          <div className="font-mono text-xs tracking-widest text-[#D99B26] uppercase">
            Mission Paused
          </div>
          <h2 className="mt-1 font-display text-4xl font-bold text-white">THE FIRST NIGHT</h2>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            Current Objective: <span className="text-[#E5E7EB]">{hud.objectiveText}</span>
          </p>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full cursor-pointer rounded border border-[#D99B26] bg-[#D99B26] px-5 py-2.5 text-sm font-semibold text-[#0B0D10] transition-colors hover:bg-[#e5aa3b]"
            >
              Resume Mission
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full cursor-pointer rounded border border-[#374151] bg-[#161A20] px-5 py-2.5 text-sm font-medium text-[#E5E7EB] transition-colors hover:border-[#D99B26]"
            >
              Restart Mission
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="w-full cursor-pointer rounded border border-[#374151] bg-[#161A20] px-5 py-2.5 text-sm font-medium text-[#E5E7EB] transition-colors hover:border-[#D99B26]"
            >
              {hud.muted ? 'Audio: Off (Enable)' : 'Audio: On (Mute)'}
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="w-full cursor-pointer rounded border border-[#374151] px-5 py-2.5 text-sm font-medium text-[#9CA3AF] transition-colors hover:border-[#E5E7EB] hover:text-white"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.status === 'VICTORY' || hud.status === 'GAME_OVER') {
    const won = hud.status === 'VICTORY';
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={won ? 'Mission Completed' : 'Game Over'}
        className="fixed inset-0 z-30 flex items-center justify-center bg-[#080A0D]/86 p-6"
      >
        <div className="w-full max-w-lg rounded border border-[#374151] bg-[#0F1216] p-8 shadow-2xl">
          <div
            className={`font-mono text-xs tracking-widest uppercase ${
              won ? 'text-[#D99B26]' : 'text-[#EF4444]'
            }`}
          >
            {won ? 'Extraction Confirmed' : 'Signal Lost'}
          </div>
          <h2 className="mt-1 font-display text-5xl font-bold text-white">
            {won ? 'MISSION COMPLETED' : 'YOU DID NOT SURVIVE'}
          </h2>
          <p className="mt-2 text-sm text-[#D1D5DB]">
            {won
              ? 'Alex Mercer restored emergency station power and escaped Greyhaven Sector 04 alive.'
              : hud.failReason}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 border-y border-[#374151]/60 py-4">
            <div>
              <div className="text-[11px] text-[#9CA3AF] uppercase">Time</div>
              <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">
                {formatDuration(hud.elapsedSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#9CA3AF] uppercase">Step</div>
              <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">
                {hud.missionStepIndex} / 4
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#9CA3AF] uppercase">Shots / Hits</div>
              <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">
                {hud.shotsFired} / {hud.hitsLanded}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="cursor-pointer rounded border border-[#D99B26] bg-[#D99B26] px-6 py-2.5 text-sm font-semibold text-[#0B0D10] transition-colors hover:bg-[#e5aa3b] whitespace-nowrap shrink-0"
            >
              Restart Mission
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="cursor-pointer rounded border border-[#374151] bg-[#161A20] px-6 py-2.5 text-sm font-medium text-[#E5E7EB] transition-colors hover:border-[#D99B26] whitespace-nowrap shrink-0"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
