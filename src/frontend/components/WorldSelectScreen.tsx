import React, { useState } from 'react';
import { GameMode, TerrainType } from '../../shared/types';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';

export const WorldSelectScreen: React.FC = () => {
  const { worlds, setScreen, launchWorld, createWorld, deleteWorld } = useGame();
  const [selectedId, setSelectedId] = useState<string>(worlds[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create New World form state
  const [worldName, setWorldName] = useState('New Survival World');
  const [worldSeed, setWorldSeed] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('survival');
  const [terrainType, setTerrainType] = useState<TerrainType>('normal');

  const selectedWorld = worlds.find((w) => w.id === selectedId) ?? worlds[0] ?? null;

  const click = (fn: () => void) => {
    soundFX.playClick();
    fn();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundFX.playClick();
    createWorld(worldName, worldSeed, gameMode, terrainType);
  };

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="mc-dirt-bg w-full h-full flex flex-col items-center justify-between py-8 px-4 sm:px-8">
      {/* Header */}
      <div className="w-full max-w-3xl text-center">
        <h1 className="font-pixel text-2xl sm:text-3xl text-white drop-shadow-[2px_2px_0_#141414]">
          Select World
        </h1>
        <p className="text-xs sm:text-sm text-stone-300 mt-1 font-ui">
          Choose an existing world or generate a new procedural terrain seed.
        </p>
      </div>

      {/* World List Container */}
      <div className="w-full max-w-3xl flex-1 my-5 bg-black/55 border-2 border-[#141414] shadow-[inset_0_2px_12px_rgba(0,0,0,0.85)] overflow-y-auto mc-scroll p-3 space-y-2.5">
        {worlds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <p className="font-pixel text-sm text-stone-300 mb-4">No saved worlds found</p>
            <button
              type="button"
              onClick={() => click(() => setCreating(true))}
              className="mc-btn mc-btn-primary px-6 py-2.5 text-sm"
            >
              Create First World
            </button>
          </div>
        ) : (
          worlds.map((w) => {
            const isSelected = selectedWorld?.id === w.id;
            const modCount = w.modifiedBlocks ? Object.keys(w.modifiedBlocks).length : 0;
            return (
              <div
                key={w.id}
                role="button"
                tabIndex={0}
                onClick={() => click(() => setSelectedId(w.id))}
                onDoubleClick={() => click(() => launchWorld(w.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') click(() => launchWorld(w.id));
                }}
                className={`flex items-center gap-4 p-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#2a3324] border-2 border-[#8cc750]'
                    : 'bg-[#1a1a1d]/90 border-2 border-[#34343a] hover:border-[#686870]'
                }`}
              >
                {/* Procedural World Thumbnail Swatch */}
                <div
                  className="w-16 h-16 shrink-0 border-2 border-[#111] flex flex-col overflow-hidden"
                  aria-hidden="true"
                >
                  {w.terrainType === 'flat' ? (
                    <>
                      <div className="h-6 bg-[#7fb4ff]" />
                      <div className="h-3 bg-[#5b9b37]" />
                      <div className="flex-1 bg-[#865d3b]" />
                    </>
                  ) : w.terrainType === 'islands' ? (
                    <>
                      <div className="h-7 bg-[#6ca5f2]" />
                      <div className="h-2 bg-[#dfd39e]" />
                      <div className="flex-1 bg-[#2e6fd9]" />
                    </>
                  ) : (
                    <>
                      <div className="h-6 bg-[#7fb4ff]" />
                      <div className="h-3 bg-[#67a93f]" />
                      <div className="h-3 bg-[#865d3b]" />
                      <div className="flex-1 bg-[#7d7d7d]" />
                    </>
                  )}
                </div>

                {/* World Metadata (Unboxed text with middot separators) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-pixel text-base text-white truncate">{w.name}</h2>
                    <span className="font-mono-tabular text-xs text-stone-400 shrink-0">
                      {formatDate(w.lastPlayedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-stone-300 font-ui mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="capitalize font-semibold text-amber-300">
                      {w.gameMode} Mode
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{w.terrainType} Terrain</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-stone-400">Seed: {w.seed}</span>
                    {modCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular text-emerald-300">
                          {modCount} blocks edited
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          disabled={!selectedWorld}
          onClick={() => selectedWorld && click(() => launchWorld(selectedWorld.id))}
          className="mc-btn mc-btn-primary py-2.5 px-4 text-sm whitespace-nowrap"
        >
          Play Selected
        </button>

        <button
          type="button"
          onClick={() => click(() => setCreating(true))}
          className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
        >
          Create World
        </button>

        <button
          type="button"
          disabled={!selectedWorld}
          onClick={() =>
            selectedWorld &&
            click(() => {
              if (confirmDeleteId === selectedWorld.id) {
                deleteWorld(selectedWorld.id);
                setConfirmDeleteId(null);
              } else {
                setConfirmDeleteId(selectedWorld.id);
              }
            })
          }
          className="mc-btn mc-btn-danger py-2.5 px-4 text-sm whitespace-nowrap"
        >
          {confirmDeleteId && confirmDeleteId === selectedWorld?.id ? 'Confirm Delete' : 'Delete'}
        </button>

        <button
          type="button"
          onClick={() => click(() => setScreen('main_menu'))}
          className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
        >
          Cancel
        </button>
      </div>

      {/* Create New World Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="mc-dark-panel w-full max-w-md p-6 space-y-4"
          >
            <h2 className="font-pixel text-lg text-white border-b border-white/15 pb-3">
              Create New World
            </h2>

            <div>
              <label className="block font-pixel text-xs text-stone-300 mb-1.5">
                World Name
              </label>
              <input
                type="text"
                maxLength={28}
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                className="w-full bg-[#111215] border-2 border-[#454852] focus:border-[#8cc750] outline-none px-3 py-2 text-sm text-white font-ui"
                placeholder="My Voxel World"
              />
            </div>

            <div>
              <label className="block font-pixel text-xs text-stone-300 mb-1.5">
                Seed for World Generator
              </label>
              <input
                type="text"
                maxLength={24}
                value={worldSeed}
                onChange={(e) => setWorldSeed(e.target.value)}
                className="w-full bg-[#111215] border-2 border-[#454852] focus:border-[#8cc750] outline-none px-3 py-2 text-sm text-white font-mono-tabular"
                placeholder="Leave blank for random seed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-pixel text-xs text-stone-300 mb-1.5">
                  Game Mode
                </label>
                <button
                  type="button"
                  onClick={() =>
                    click(() =>
                      setGameMode((m) => (m === 'survival' ? 'creative' : 'survival'))
                    )
                  }
                  className="mc-btn w-full py-2 px-3 text-xs capitalize"
                >
                  {gameMode}
                </button>
              </div>

              <div>
                <label className="block font-pixel text-xs text-stone-300 mb-1.5">
                  World Type
                </label>
                <button
                  type="button"
                  onClick={() =>
                    click(() =>
                      setTerrainType((t) =>
                        t === 'normal' ? 'islands' : t === 'islands' ? 'flat' : 'normal'
                      )
                    )
                  }
                  className="mc-btn w-full py-2 px-3 text-xs capitalize"
                >
                  {terrainType}
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-400 font-ui">
              {gameMode === 'survival'
                ? 'Survival: Gather resources, craft tools, manage health and hunger.'
                : 'Creative: Unlimited blocks, instant breaking, and flight (F or double Space).'}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="submit" className="mc-btn mc-btn-primary py-2.5 text-sm">
                Create World
              </button>
              <button
                type="button"
                onClick={() => click(() => setCreating(false))}
                className="mc-btn py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
