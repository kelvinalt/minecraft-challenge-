import React, { useEffect, useRef, useState } from 'react';
import { getItemDef } from '../../shared/blocks';
import { BlockId } from '../../shared/types';
import { LocalWorldProvider } from '../engine/LocalWorldProvider';
import { soundFX } from '../engine/SoundFX';
import { VoxelEngine } from '../engine/VoxelEngine';
import { useGame } from '../state/GameStore';
import { GameHUD } from './GameHUD';
import { InventoryModal } from './InventoryModal';
import { PauseMenu } from './PauseMenu';
import { SettingsMenu } from './SettingsMenu';

export const GameViewport: React.FC = () => {
  const {
    activeWorld,
    screen,
    setScreen,
    settings,
    updateSettings,
    inventory,
    selectedHotbarSlot,
    setSelectedHotbarSlot,
    health,
    setHealth,
    hunger,
    setHunger,
    addItemToInventory,
    consumeSelectedHotbarItem,
    damageHeldTool,
    setCraftingTableOpen,
    setTelemetry,
    setTargetHit,
    setMiningProgress,
    setPointerLocked,
    saveAndQuitWorld,
  } = useGame();

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const worldRef = useRef<LocalWorldProvider | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  // Refs for fresh state inside engine callbacks without re-mounting WebGL
  const stateRef = useRef({
    screen,
    inventory,
    selectedHotbarSlot,
    gameMode: activeWorld?.gameMode ?? 'survival',
    showDebugHud: settings.showDebugHud,
  });

  stateRef.current = {
    screen,
    inventory,
    selectedHotbarSlot,
    gameMode: activeWorld?.gameMode ?? 'survival',
    showDebugHud: settings.showDebugHud,
  };

  // Initialize VoxelEngine once per launched world
  useEffect(() => {
    const container = mountRef.current;
    if (!container || !activeWorld) return;

    const world = new LocalWorldProvider(
      activeWorld.seed,
      activeWorld.terrainType,
      activeWorld.modifiedBlocks
    );
    worldRef.current = world;

    const spawnPos: [number, number, number] = activeWorld.playerPosition ?? [
      0.5,
      world.getSurfaceHeightAt(0, 0) + 2,
      0.5,
    ];

    const engine = new VoxelEngine(
      container,
      world,
      spawnPos,
      activeWorld.timeOfDay ?? 0.28,
      activeWorld.gameMode,
      settings,
      {
        onTelemetry: (t) => setTelemetry(t),
        onHitChange: (hit) => setTargetHit(hit),
        onMiningProgress: (p) => setMiningProgress(p),
        onBreakBlock: (_pos, blockId) => {
          if (stateRef.current.gameMode === 'survival') {
            const def = getItemDef(blockId);
            const dropId = def?.dropId ?? blockId;
            const dropCount = def?.dropCount ?? 1;
            addItemToInventory(dropId, dropCount);
            damageHeldTool();
          }
        },
        onPlaceBlock: (placePos) => {
          const slot = stateRef.current.inventory[stateRef.current.selectedHotbarSlot];
          if (!slot) return;
          const def = getItemDef(slot.itemId);
          if (!def?.isBlock) return;
          const [px, py, pz] = placePos;
          if (py < 1 || py >= 63) return;
          if (engine.isBlockOccupiedByPlayer(px, py, pz)) return;

          world.setBlock(px, py, pz, slot.itemId as BlockId);
          engine.rebuildBlockArea(px, py, pz);
          soundFX.playBlockPlace();
          consumeSelectedHotbarItem();
        },
        onInteractBlock: (_pos, blockId) => {
          if (blockId === BlockId.CraftingTable) {
            soundFX.playClick();
            setCraftingTableOpen(true);
            setScreen('inventory');
            return true;
          }
          return false;
        },
        onSelectHotbarIndex: (idx) => {
          if (idx >= 99) {
            const delta = idx - 100;
            const next = (stateRef.current.selectedHotbarSlot + delta + 9) % 9;
            setSelectedHotbarSlot(next);
          } else {
            setSelectedHotbarSlot(idx);
          }
        },
        onPauseRequest: () => {
          setScreen('paused');
        },
        onToggleInventory: () => {
          if (stateRef.current.screen === 'playing') {
            setCraftingTableOpen(false);
            setScreen('inventory');
          } else if (stateRef.current.screen === 'inventory') {
            setCraftingTableOpen(false);
            setScreen('playing');
          }
        },
        onToggleDebug: () => {
          updateSettings({ showDebugHud: !stateRef.current.showDebugHud });
        },
        onPointerLockChange: (locked) => {
          setPointerLocked(locked);
          if (!locked && stateRef.current.screen === 'playing') {
            // Keep playing with drag-look fallback; Esc opens pause when unlocked
          }
        },
        onWebGLContextLost: (lost) => setWebglLost(lost),
        onPlayerHurt: (dmg) => {
          setHealth((h) => Math.max(0, h - dmg));
        },
        onConsumeHunger: (delta) => {
          // Positive delta drains hunger; negative restores hunger
          setHunger((h) => Math.max(0, Math.min(20, h - delta)));
          if (delta < 0) {
            consumeSelectedHotbarItem();
          }
        },
      }
    );

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      worldRef.current = null;
    };
  }, [activeWorld?.id]);

  // Sync active state & pause state
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const isPlaying = screen === 'playing' && health > 0;
    engine.setActive(isPlaying);
  }, [screen, health]);

  // Sync game mode & settings
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !activeWorld) return;
    engine.setGameMode(activeWorld.gameMode);
  }, [activeWorld?.gameMode]);

  useEffect(() => {
    engineRef.current?.updateSettings(settings);
  }, [settings]);

  // Sync held item viewmodel
  useEffect(() => {
    const slot = inventory[selectedHotbarSlot];
    engineRef.current?.setHeldItem(slot?.itemId ?? null);
  }, [inventory, selectedHotbarSlot]);

  // Natural health regeneration when hunger >= 16 in survival
  useEffect(() => {
    if (screen !== 'playing' || activeWorld?.gameMode !== 'survival') return;
    const timer = window.setInterval(() => {
      setHealth((h) => {
        if (h > 0 && h < 20 && hunger >= 16) return h + 1;
        return h;
      });
    }, 3500);
    return () => window.clearInterval(timer);
  }, [screen, activeWorld?.gameMode, hunger, setHealth]);

  const handleSaveAndQuit = () => {
    const engine = engineRef.current;
    const world = worldRef.current;
    if (engine && world) {
      saveAndQuitWorld(
        world.getModifiedBlocksMap(),
        [
          Number(engine.playerPos.x.toFixed(2)),
          Number(engine.playerPos.y.toFixed(2)),
          Number(engine.playerPos.z.toFixed(2)),
        ],
        engine.timeOfDay
      );
    } else {
      saveAndQuitWorld({}, [0.5, 25, 0.5], 0.28);
    }
  };

  const handleRespawn = () => {
    soundFX.playClick();
    const engine = engineRef.current;
    const world = worldRef.current;
    if (engine && world) {
      const sy = world.getSurfaceHeightAt(0, 0) + 2;
      engine.playerPos.set(0.5, sy, 0.5);
      engine.velocity.set(0, 0, 0);
    }
    setHealth(20);
    setHunger(20);
    setScreen('playing');
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#141414]">
      {/* Dedicated isolated WebGL mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Active HUD */}
      {screen === 'playing' && health > 0 && (
        <GameHUD
          onPause={() => {
            soundFX.playClick();
            setScreen('paused');
          }}
          onOpenInventory={() => {
            soundFX.playClick();
            setCraftingTableOpen(false);
            setScreen('inventory');
          }}
          onRequestLock={() => engineRef.current?.requestPointerLock()}
          onTouchMove={(f, s, j) => engineRef.current?.moveTouchInput(f, s, j)}
          onTouchBreak={() => engineRef.current?.triggerPrimaryAction()}
          onTouchPlace={() => engineRef.current?.triggerSecondaryAction()}
          webglLost={webglLost}
        />
      )}

      {/* Survival Respawn Overlay */}
      {health <= 0 && activeWorld?.gameMode === 'survival' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#4f0e0e]/75 p-4">
          <div className="mc-dark-panel p-7 max-w-sm w-full text-center space-y-4">
            <h2 className="font-pixel text-2xl text-red-400 drop-shadow-[2px_2px_0_#000]">
              You Died!
            </h2>
            <p className="text-xs text-stone-300 font-ui">
              Watch your step when climbing high cliffs.
            </p>
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleRespawn}
                className="mc-btn mc-btn-primary w-full py-2.5 text-sm"
              >
                Respawn
              </button>
              <button
                type="button"
                onClick={handleSaveAndQuit}
                className="mc-btn w-full py-2.5 text-sm"
              >
                Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory & Crafting Modal */}
      {screen === 'inventory' && (
        <InventoryModal
          onClose={() => {
            setCraftingTableOpen(false);
            setScreen('playing');
          }}
        />
      )}

      {/* Pause Menu */}
      {screen === 'paused' && (
        <PauseMenu
          onResume={() => {
            setScreen('playing');
            engineRef.current?.requestPointerLock();
          }}
          onSaveAndQuit={handleSaveAndQuit}
        />
      )}

      {/* In-Game Settings */}
      {screen === 'settings' && <SettingsMenu />}
    </div>
  );
};
