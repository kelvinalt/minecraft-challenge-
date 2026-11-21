import React, { useState } from 'react';
import { DimensionId } from '../../shared/types';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';

interface PauseMenuProps {
  onResume: () => void;
  onSwitchDimension: (dim: DimensionId) => void;
  onSetTimeOfDay: (time: number) => void;
  onSaveNow: () => Promise<void>;
  onSaveAndQuit: () => void;
}

const DIMENSIONS: { id: DimensionId; label: string }[] = [
  { id: 'overworld', label: 'Overworld' },
  { id: 'nether', label: 'Nether' },
  { id: 'end', label: 'The End' },
];

const TIME_PRESETS: { label: string; time: number }[] = [
  { label: 'Dawn', time: 0.25 },
  { label: 'Noon', time: 0.5 },
  { label: 'Sunset', time: 0.74 },
  { label: 'Night', time: 0.0 },
];

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onSwitchDimension,
  onSetTimeOfDay,
  onSaveNow,
  onSaveAndQuit,
}) => {
  const { activeWorld, activeDimension, openSettings, setScreen, toggleGameMode } = useGame();
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

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

  const handleSaveProgress = () => {
    void onSaveNow().then(() => {
      setSavedToast(true);
      window.setTimeout(() => setSavedToast(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-[400px] text-center space-y-2.5">
        <h2
          className="font-pixel text-xl text-white mb-5"
          style={{ textShadow: '2px 2px 0 #1f1f1f' }}
        >
          Game Menu
        </h2>

        <button
          type="button"
          onClick={() => click(onResume)}
          className="mc-btn w-full py-2.5 text-sm"
        >
          Back to Game
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => click(() => setScreen('inventory'))}
            className="mc-btn py-2.5 px-2 text-xs whitespace-nowrap"
          >
            Inventory
          </button>

          <button
            type="button"
            onClick={() => click(toggleGameMode)}
            className="mc-btn py-2.5 px-2 text-xs whitespace-nowrap capitalize"
          >
            {activeWorld?.gameMode === 'survival' ? 'To Creative' : 'To Survival'}
          </button>
        </div>

        {/* Dimension Selector */}
        <div className="pt-1">
          <div className="text-[11px] font-pixel text-stone-300 mb-1.5">Travel Dimension</div>
          <div className="grid grid-cols-3 gap-2">
            {DIMENSIONS.map((d) => {
              const isCurrent = activeDimension === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => click(() => onSwitchDimension(d.id))}
                  className={`mc-btn py-2 px-1 text-[11px] whitespace-nowrap ${
                    isCurrent ? 'mc-btn-primary opacity-95' : ''
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Overworld Time of Day Controls */}
        {activeDimension === 'overworld' && (
          <div className="pt-0.5">
            <div className="text-[11px] font-pixel text-stone-300 mb-1.5">Time of Day</div>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    click(() => {
                      onSetTimeOfDay(preset.time);
                      onResume();
                    })
                  }
                  className="mc-btn py-1.5 px-1 text-[10px] whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => click(() => openSettings('paused'))}
            className="mc-btn py-2.5 px-2 text-xs whitespace-nowrap"
          >
            Options
          </button>

          <button
            type="button"
            onClick={() => click(handleCopySeed)}
            className="mc-btn py-2.5 px-2 text-xs whitespace-nowrap"
          >
            {copiedSeed ? 'Copied!' : 'Copy Seed'}
          </button>

          <button
            type="button"
            onClick={() => click(handleSaveProgress)}
            className="mc-btn mc-btn-primary py-2.5 px-2 text-xs whitespace-nowrap"
          >
            {savedToast ? 'Saved!' : 'Save World'}
          </button>
        </div>

        <div className="pt-1">
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
