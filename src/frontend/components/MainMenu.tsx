import React, { useMemo, useState } from 'react';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';
import { PanoramaBackdrop } from './PanoramaBackdrop';

const SPLASH_TEXTS = [
  '100% Procedural WebGL!',
  'Dig, Craft, Survive!',
  'Punching trees!',
  'Creeper? Aw man!',
  'Now in Your Browser!',
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
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between py-6 px-6">
      <PanoramaBackdrop />

      {/* Subtle atmospheric vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0.55) 100%)',
        }}
      />

      <div className="relative z-10 h-4" />

      {/* Classic Centered MINECRAFT Title & Button Stack */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[400px] my-auto">
        <div className="relative mb-12 text-center select-none">
          <h1
            className="font-pixel text-5xl sm:text-6xl font-bold tracking-[0.06em] text-[#d6d6d6]"
            style={{
              textShadow:
                '0 4px 0 #7a7a7a, 0 7px 0 #3f3f3f, 0 10px 0 #161616, 0 14px 24px rgba(0,0,0,0.85)',
            }}
          >
            MINECRAFT
          </h1>
          <div
            className="font-pixel text-[11px] sm:text-xs tracking-[0.28em] text-[#dedede] mt-1.5"
            style={{ textShadow: '2px 2px 0 #1f1f1f' }}
          >
            WEBGL EDITION
          </div>
          <p
            className="mc-splash font-pixel text-xs sm:text-sm text-[#ffff00] absolute -bottom-3 -right-4 sm:-right-8 whitespace-nowrap pointer-events-none"
            style={{ textShadow: '2px 2px 0 #3f3f00' }}
          >
            {splash}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={() => handleAction(() => setScreen('world_select'))}
            className="mc-btn w-full py-2.5 px-6 text-sm tracking-wide"
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
            className="mc-btn w-full py-2.5 px-6 text-sm tracking-wide truncate"
          >
            Quick Play{worlds[0] ? `: ${worlds[0].name}` : ''}
          </button>

          <button
            type="button"
            onClick={() => handleAction(() => setShowControls(true))}
            className="mc-btn w-full py-2.5 px-6 text-sm tracking-wide"
          >
            Controls & Keybinds
          </button>

          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button
              type="button"
              onClick={() => handleAction(() => openSettings('main_menu'))}
              className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
            >
              Options...
            </button>
            <button
              type="button"
              onClick={() => handleAction(() => setScreen('world_select'))}
              className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
            >
              Worlds
            </button>
          </div>
        </div>
      </div>

      {/* Classic Minecraft Bottom Corner Labels */}
      <div
        className="relative z-10 w-full flex items-center justify-between text-xs font-pixel text-white"
        style={{ textShadow: '2px 2px 0 #1f1f1f' }}
      >
        <span>Minecraft 1.21 (WebGL)</span>
        <span className="hidden sm:inline">Full-Stack Voxel Sandbox</span>
      </div>

      {/* Controls Reference Modal */}
      {showControls && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="mc-dark-panel w-full max-w-lg p-6 text-white">
            <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-4">
              <h2 className="font-pixel text-base text-[#ffff55]">Key Binds</h2>
              <button
                type="button"
                onClick={() => handleAction(() => setShowControls(false))}
                className="mc-btn px-3 py-1 text-xs"
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm font-ui">
              {[
                ['Walk', 'W A S D'],
                ['Jump / Swim', 'Space'],
                ['Sprint', 'Left Shift'],
                ['Fly (Creative)', 'F / Double Space'],
                ['Attack / Mine', 'Left Click'],
                ['Use / Place / Eat', 'Right Click'],
                ['Inventory', 'E'],
                ['Hotbar Slots', '1 – 9 / Scroll'],
                ['Debug Screen', 'F3'],
                ['Pause', 'Esc'],
              ].map(([action, key]) => (
                <div
                  key={action}
                  className="flex items-center justify-between py-1.5 border-b border-white/10"
                >
                  <span className="text-stone-300">{action}</span>
                  <span className="font-mono-tabular text-xs bg-black/60 px-2 py-0.5 border border-white/20 text-[#ffffa0]">
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
