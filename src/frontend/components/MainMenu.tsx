import React, { useMemo, useState } from 'react';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';
import { PanoramaBackdrop } from './PanoramaBackdrop';

const SPLASH_TEXTS = [
  '100% Procedural WebGL!',
  'Dig, Craft, Build!',
  'Zero External Textures!',
  'Now With Crafting Tables!',
  'Chunks & Biomes Included!',
];

export const MainMenu: React.FC = () => {
  const { setScreen, openSettings, worlds, launchWorld } = useGame();
  const [showControls, setShowControls] = useState(false);

  const splash = useMemo(
    () => SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)],
    []
  );

  const handleAction = (fn: () => void) => {
    soundFX.playClick();
    fn();
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between py-10 px-6">
      <PanoramaBackdrop />

      {/* Measured contrast scrim */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(12, 16, 22, 0.25) 0%, rgba(10, 12, 16, 0.72) 100%)',
        }}
      />

      {/* Top spacer */}
      <div className="relative z-10 w-full flex justify-end max-w-5xl">
        <span className="font-mono-tabular text-xs text-white/80 bg-black/45 px-3 py-1.5 border border-white/15">
          Frontend Edition · Three.js
        </span>
      </div>

      {/* Hero Title + Classic Stone Button Stack */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md my-auto">
        <div className="relative mb-10 text-center">
          <h1
            className="font-pixel text-5xl sm:text-6xl font-bold tracking-wider text-[#e8e8e8] select-none"
            style={{
              textShadow:
                '0 5px 0 #3a3a3a, 0 8px 0 #181818, 0 12px 24px rgba(0,0,0,0.8)',
            }}
          >
            BLOCKCRAFT
          </h1>
          <p className="font-pixel text-xs sm:text-sm text-[#ffff55] mt-2 drop-shadow-[2px_2px_0_#3a3a00] mc-splash inline-block">
            {splash}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={() => handleAction(() => setScreen('world_select'))}
            className="mc-btn mc-btn-primary w-full py-3 px-6 text-base tracking-wide"
          >
            Singleplayer
          </button>

          <button
            type="button"
            onClick={() =>
              handleAction(() => {
                if (worlds.length > 0) launchWorld(worlds[0].id);
                else setScreen('world_select');
              })
            }
            className="mc-btn w-full py-3 px-6 text-base tracking-wide"
          >
            Quick Play{worlds[0] ? ` · ${worlds[0].name}` : ''}
          </button>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              type="button"
              onClick={() => handleAction(() => openSettings('main_menu'))}
              className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
            >
              Options...
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => setShowControls(true))}
              className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
            >
              Controls
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 w-full max-w-5xl flex flex-wrap items-center justify-between gap-4 text-xs text-white/75 font-ui">
        <span>BlockCraft Voxel Client</span>
        <span>WASD Move · Mouse Look · Left Break · Right Place · E Inventory</span>
      </div>

      {/* Controls Reference Modal */}
      {showControls && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="mc-dark-panel w-full max-w-lg p-6 text-white">
            <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
              <h2 className="font-pixel text-lg text-[#ffff55]">Player Controls</h2>
              <button
                type="button"
                onClick={() => handleAction(() => setShowControls(false))}
                className="mc-btn px-3 py-1 text-xs"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-ui">
              {[
                ['Move', 'W A S D'],
                ['Jump / Swim Up', 'Space'],
                ['Sprint', 'Left Shift'],
                ['Fly (Creative)', 'F or Double Space'],
                ['Mine / Break', 'Left Click (Hold)'],
                ['Place / Use / Eat', 'Right Click'],
                ['Inventory & Craft', 'E'],
                ['Hotbar Slot', '1 – 9 or Scroll'],
                ['Debug Info HUD', 'F3'],
                ['Pause Menu', 'Esc'],
              ].map(([action, key]) => (
                <div
                  key={action}
                  className="flex items-center justify-between py-1.5 border-b border-white/10"
                >
                  <span className="text-slate-300">{action}</span>
                  <span className="font-mono-tabular text-xs bg-white/10 px-2 py-0.5 border border-white/15 text-amber-200">
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
