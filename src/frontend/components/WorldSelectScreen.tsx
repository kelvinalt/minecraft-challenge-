import React, { useState } from 'react';
import { GameMode, TerrainType } from '../../shared/types';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';

export const WorldSelectScreen: React.FC = () => {
  const { worlds, setScreen, launchWorld, createWorld, deleteWorld } = useGame();
  const [selectedId, setSelectedId] = useState<string>(worlds[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [worldName, setWorldName] = useState('New World');
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
    void createWorld(worldName, worldSeed, gameMode, terrainType);
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
    <div className="mc-dirt-bg w-full h-full flex flex-col items-center justify-between py-6">
      {/* Header */}
      <div className="w-full text-center px-4">
        <h1
          className="font-pixel text-xl sm:text-2xl text-white"
          style={{ textShadow: '2px 2px 0 #1f1f1f' }}
        >
          Select World
        </h1>
      </div>

      {/* Classic Minecraft Recessed Full-Width Dirt Scroll Well */}
      <div className="w-full flex-1 my-4 bg-black/65 border-y-2 border-black shadow-[inset_0_8px_18px_rgba(0,0,0,0.85),inset_0_-8px_18px_rgba(0,0,0,0.85)] overflow-y-auto mc-scroll py-3 px-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {worlds.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <p className="font-pixel text-sm text-stone-300 mb-4">No worlds created yet</p>
              <button
                type="button"
                onClick={() => click(() => setCreating(true))}
                className="mc-btn px-6 py-2.5 text-sm"
              >
                Create New World
              </button>
            </div>
          ) : (
            worlds.map((w) => {
              const isSelected = selectedWorld?.id === w.id;
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
                  className={`flex items-center gap-3.5 p-2 cursor-pointer ${
                    isSelected
                      ? 'bg-black/80 border-2 border-[#e0e0e0]'
                      : 'border-2 border-transparent hover:bg-black/45'
                  }`}
                >
                  {/* 64x64 Classic World Icon */}
                  <div
                    className="w-16 h-16 shrink-0 border-2 border-black flex flex-col overflow-hidden"
                    aria-hidden="true"
                  >
                    {w.terrainType === 'flat' ? (
                      <>
                        <div className="h-6 bg-[#7fb4ff]" />
                        <div className="h-3 bg-[#5e9d34]" />
                        <div className="flex-1 bg-[#866043]" />
                      </>
                    ) : w.terrainType === 'islands' ? (
                      <>
                        <div className="h-7 bg-[#6ca5f2]" />
                        <div className="h-2 bg-[#e3d7a3]" />
                        <div className="flex-1 bg-[#2f6ee0]" />
                      </>
                    ) : (
                      <>
                        <div className="h-6 bg-[#7fb4ff]" />
                        <div className="h-3 bg-[#6ab03b]" />
                        <div className="h-3 bg-[#866043]" />
                        <div className="flex-1 bg-[#7d7d7d]" />
                      </>
                    )}
                  </div>

                  {/* Two-line Minecraft World Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="font-pixel text-base text-white truncate">{w.name}</div>
                    <div className="font-ui text-xs text-[#a0a0a0] mt-0.5 truncate">
                      {w.name} ({formatDate(w.lastPlayedAt)})
                    </div>
                    <div className="font-ui text-xs text-[#8a8a8a] capitalize mt-0.5">
                      {w.gameMode} Mode · {w.terrainType} ·{' '}
                      {w.dimension === 'nether'
                        ? 'Nether'
                        : w.dimension === 'end'
                        ? 'The End'
                        : 'Overworld'}{' '}
                      · Seed: {w.seed}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Classic 2-Row Bottom Button Grid */}
      <div className="w-full max-w-2xl px-4 space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={!selectedWorld}
            onClick={() => selectedWorld && click(() => launchWorld(selectedWorld.id))}
            className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
          >
            Play Selected World
          </button>
          <button
            type="button"
            onClick={() => click(() => setCreating(true))}
            className="mc-btn py-2.5 px-4 text-sm whitespace-nowrap"
          >
            Create New World
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
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
            className="mc-btn mc-btn-danger py-2 px-4 text-sm whitespace-nowrap"
          >
            {confirmDeleteId && confirmDeleteId === selectedWorld?.id
              ? 'Confirm Delete'
              : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => click(() => setScreen('main_menu'))}
            className="mc-btn py-2 px-4 text-sm whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Create New World Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="mc-dirt-bg border-2 border-black shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <h2
              className="font-pixel text-lg text-white text-center pb-2"
              style={{ textShadow: '2px 2px 0 #1f1f1f' }}
            >
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
                className="w-full bg-black border-2 border-[#a0a0a0] focus:border-white outline-none px-3 py-2 text-sm text-white font-ui"
                placeholder="New World"
              />
            </div>

            <div>
              <label className="block font-pixel text-xs text-stone-300 mb-1.5">
                Seed for the World Generator
              </label>
              <input
                type="text"
                maxLength={24}
                value={worldSeed}
                onChange={(e) => setWorldSeed(e.target.value)}
                className="w-full bg-black border-2 border-[#a0a0a0] focus:border-white outline-none px-3 py-2 text-sm text-white font-mono-tabular"
                placeholder="Leave blank for random seed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  click(() =>
                    setGameMode((m) => (m === 'survival' ? 'creative' : 'survival'))
                  )
                }
                className="mc-btn py-2.5 px-3 text-xs capitalize"
              >
                Mode: {gameMode}
              </button>

              <button
                type="button"
                onClick={() =>
                  click(() =>
                    setTerrainType((t) =>
                      t === 'normal' ? 'islands' : t === 'islands' ? 'flat' : 'normal'
                    )
                  )
                }
                className="mc-btn py-2.5 px-3 text-xs capitalize"
              >
                Type: {terrainType}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button type="submit" className="mc-btn py-2.5 text-sm">
                Create New World
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
