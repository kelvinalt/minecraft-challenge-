import React, { useState } from 'react';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';

interface PauseMenuProps {
  onResume: () => void;
  onSaveAndQuit: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onSaveAndQuit }) => {
  const { activeWorld, openSettings, setScreen, toggleGameMode } = useGame();
  const [copiedSeed, setCopiedSeed] = useState(false);

  const click = (fn: () => void) => {
    soundFX.playClick();
    fn();
  };

  const handleCopySeed = () => {
    if (!activeWorld) return;
    navigator.clipboard?.writeText(activeWorld.seed).catch(() => {});
    setCopiedSeed(true);
    window.setTimeout(() => setCopiedSeed(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <div className="mc-dark-panel w-full max-w-sm p-6 text-center space-y-3">
        <div className="mb-4">
          <h2 className="font-pixel text-2xl text-white drop-shadow-[2px_2px_0_#0d0d0d]">
            Game Menu
          </h2>
          {activeWorld && (
            <p className="text-xs text-stone-300 font-ui mt-1">
              {activeWorld.name} · <span className="capitalize">{activeWorld.gameMode}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => click(onResume)}
          className="mc-btn mc-btn-primary w-full py-2.5 text-sm"
        >
          Back to Game
        </button>

        <button
          type="button"
          onClick={() => click(() => setScreen('inventory'))}
          className="mc-btn w-full py-2.5 text-sm"
        >
          Open Inventory & Crafting
        </button>

        <button
          type="button"
          onClick={() => click(toggleGameMode)}
          className="mc-btn w-full py-2.5 text-sm"
        >
          Switch Mode ({activeWorld?.gameMode === 'survival' ? 'To Creative' : 'To Survival'})
        </button>

        <button
          type="button"
          onClick={() => click(() => openSettings('paused'))}
          className="mc-btn w-full py-2.5 text-sm"
        >
          Options...
        </button>

        {activeWorld && (
          <button
            type="button"
            onClick={() => click(handleCopySeed)}
            className="mc-btn w-full py-2 text-xs"
          >
            {copiedSeed ? 'Seed Copied!' : `Copy Seed (${activeWorld.seed})`}
          </button>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => click(onSaveAndQuit)}
            className="mc-btn mc-btn-danger w-full py-2.5 text-sm"
          >
            Save and Quit to Title
          </button>
        </div>
      </div>
    </div>
  );
};
