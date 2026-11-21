import React, { useEffect, useRef, useState } from 'react';
import { getItemDef } from '../../shared/blocks';
import { AnyItemId, BlockId, DimensionId, ItemId } from '../../shared/types';
import { worldApi } from '../api/worldApi';
import { LocalWorldProvider } from '../engine/LocalWorldProvider';
import { soundFX } from '../engine/SoundFX';
import { VoxelEngine } from '../engine/VoxelEngine';
import { useGame } from '../state/GameStore';
import { FurnaceModal } from './FurnaceModal';
import { GameHUD } from './GameHUD';
import { InventoryModal } from './InventoryModal';
import { PauseMenu } from './PauseMenu';
import { SettingsMenu } from './SettingsMenu';

export const GameViewport: React.FC = () => {
  const {
    activeWorld,
    activeDimension,
    preloadedChunksRef,
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
    addXp,
    markPlayerHurt,
    addItemToInventory,
    consumeSelectedHotbarItem,
    damageHeldTool,
    setCraftingTableOpen,
    furnaceOpen,
    setFurnaceOpen,
    setTelemetry,
    setTargetHit,
    setMiningProgress,
    setPointerLocked,
    switchDimension,
    saveWorldProgress,
    saveAndQuitWorld,
  } = useGame();

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const worldRef = useRef<LocalWorldProvider | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const stateRef = useRef({
    screen,
    inventory,
    selectedHotbarSlot,
    activeDimension,
    furnaceOpen,
    gameMode: activeWorld?.gameMode ?? 'survival',
    showDebugHud: settings.showDebugHud,
    addItemToInventory,
    consumeSelectedHotbarItem,
    damageHeldTool,
    switchDimension,
    addXp,
    markPlayerHurt,
    saveWorldProgress,
  });

  stateRef.current = {
    screen,
    inventory,
    selectedHotbarSlot,
    activeDimension,
    furnaceOpen,
    gameMode: activeWorld?.gameMode ?? 'survival',
    showDebugHud: settings.showDebugHud,
    addItemToInventory,
    consumeSelectedHotbarItem,
    damageHeldTool,
    switchDimension,
    addXp,
    markPlayerHurt,
    saveWorldProgress,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !activeWorld) return;

    const initialModified =
      activeWorld.modifiedBlocksByDim?.[activeDimension] ??
      (activeDimension === 'overworld' ? activeWorld.modifiedBlocks : undefined);

    const world = new LocalWorldProvider(
      activeWorld.seed,
      activeWorld.terrainType,
      initialModified,
      activeDimension,
      {
        worldId: activeWorld.id,
        preloadedChunks: preloadedChunksRef.current,
      }
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
            stateRef.current.addItemToInventory(dropId, dropCount);
            stateRef.current.damageHeldTool();

            if (blockId === BlockId.CoalOre) stateRef.current.addXp(2);
            else if (blockId === BlockId.IronOre || blockId === BlockId.CopperBlock)
              stateRef.current.addXp(3);
            else if (blockId === BlockId.GoldOre || blockId === BlockId.AmethystBlock)
              stateRef.current.addXp(5);
            else if (blockId === BlockId.DiamondOre) stateRef.current.addXp(8);
          }
        },
        onPlaceBlock: (placePos) => {
          const slot = stateRef.current.inventory[stateRef.current.selectedHotbarSlot];
          if (!slot) return;
          const def = getItemDef(slot.itemId);
          if (!def?.isBlock) return;
          const [px, py, pz] = placePos;
          if (py < 1 || py >= 63) return;
          if (def.solid && engine.isBlockOccupiedByPlayer(px, py, pz)) return;

          world.setBlock(px, py, pz, slot.itemId as BlockId);
          engine.rebuildBlockArea(px, py, pz);
          soundFX.playBlockPlace();
          stateRef.current.consumeSelectedHotbarItem();
        },
        onInteractBlock: (_pos, blockId) => {
          if (blockId === BlockId.CraftingTable) {
            soundFX.playClick();
            setFurnaceOpen(false);
            setCraftingTableOpen(true);
            setScreen('inventory');
            return true;
          }
          if (blockId === BlockId.Furnace) {
            soundFX.playClick();
            setCraftingTableOpen(false);
            setFurnaceOpen(true);
            setScreen('inventory');
            return true;
          }
          if (blockId === BlockId.NetherPortal) {
            soundFX.playClick();
            const nextDim: DimensionId =
              stateRef.current.activeDimension === 'nether' ? 'overworld' : 'nether';
            stateRef.current.switchDimension(
              nextDim,
              world.getModifiedBlocksMap(),
              engine.timeOfDay
            );
            return true;
          }
          if (blockId === BlockId.EndPortal) {
            soundFX.playClick();
            const nextDim: DimensionId =
              stateRef.current.activeDimension === 'end' ? 'overworld' : 'end';
            stateRef.current.switchDimension(
              nextDim,
              world.getModifiedBlocksMap(),
              engine.timeOfDay
            );
            return true;
          }
          return false;
        },
        onHitMob: (mobId) => {
          const heldSlot = stateRef.current.inventory[stateRef.current.selectedHotbarSlot];
          const heldId = heldSlot?.itemId;
          let damage = 1;
          if (heldId === ItemId.StoneSword) damage = 5;
          else if (heldId === ItemId.WoodenSword || heldId === ItemId.StoneAxe) damage = 4;
          else if (heldId === ItemId.WoodenAxe || heldId === ItemId.DiamondPickaxe) damage = 3;
          else if (heldId) {
            const def = getItemDef(heldId);
            if (def?.toolType) damage = 2;
          }

          soundFX.playBlockBreak(false);
          if (stateRef.current.gameMode === 'survival') {
            stateRef.current.damageHeldTool();
          }

          void worldApi
            .hitMob(
              activeWorld.id,
              stateRef.current.activeDimension,
              mobId,
              damage,
              engine.playerPos.x,
              engine.playerPos.z
            )
            .then((res) => {
              if (!res) return;
              if (res.killed) {
                for (const drop of res.drops) {
                  stateRef.current.addItemToInventory(drop.itemId as AnyItemId, drop.count);
                }
                if (res.xp > 0) {
                  stateRef.current.addXp(res.xp);
                }
                soundFX.playClick();
              }
              void worldApi
                .getMobs(
                  activeWorld.id,
                  stateRef.current.activeDimension,
                  engine.playerPos.x,
                  engine.playerPos.z
                )
                .then((mobs) => {
                  if (mobs) engine.syncMobs(mobs);
                });
            });
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
            setFurnaceOpen(false);
            setScreen('inventory');
          } else if (stateRef.current.screen === 'inventory') {
            setCraftingTableOpen(false);
            setFurnaceOpen(false);
            setScreen('playing');
          }
        },
        onToggleDebug: () => {
          updateSettings({ showDebugHud: !stateRef.current.showDebugHud });
        },
        onPointerLockChange: (locked) => {
          setPointerLocked(locked);
        },
        onWebGLContextLost: (lost) => setWebglLost(lost),
        onPlayerHurt: (dmg) => {
          stateRef.current.markPlayerHurt();
          setHealth((h) => Math.max(0, h - dmg));
        },
        onConsumeHunger: (delta) => {
          setHunger((h) => Math.max(0, Math.min(20, h - delta)));
          if (delta < 0) {
            stateRef.current.consumeSelectedHotbarItem();
          }
        },
      }
    );

    world.setOnChunkHydrated((cx, cz) => {
      engine.rebuildChunkIfLoaded(cx, cz);
    });

    world.setOnFluidEdits((edits) => {
      const rebuilt = new Set<string>();
      for (const fe of edits) {
        const key = `${Math.floor(fe.wx / 16)},${Math.floor(fe.wz / 16)}`;
        if (!rebuilt.has(key)) {
          rebuilt.add(key);
          engine.rebuildBlockArea(fe.wx, fe.wy, fe.wz);
        }
      }
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      worldRef.current = null;
    };
  }, [activeWorld?.id, activeDimension]);

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

  // Periodic background autosave to Express backend while playing
  useEffect(() => {
    if (!activeWorld || screen !== 'playing') return;
    const autosaveTimer = window.setInterval(() => {
      const engine = engineRef.current;
      const world = worldRef.current;
      if (!engine || !world) return;
      void stateRef.current.saveWorldProgress(
        world.getModifiedBlocksMap(),
        [
          Number(engine.playerPos.x.toFixed(2)),
          Number(engine.playerPos.y.toFixed(2)),
          Number(engine.playerPos.z.toFixed(2)),
        ],
        engine.timeOfDay
      );
    }, 15000);
    return () => window.clearInterval(autosaveTimer);
  }, [activeWorld?.id, screen]);

  // Poll server-authoritative mobs (Minecraft-2hrs EntityManager) while playing
  useEffect(() => {
    if (!activeWorld || screen !== 'playing') return;
    let cancelled = false;
    const syncOnce = () => {
      const engine = engineRef.current;
      if (!engine || cancelled) return;
      void worldApi
        .getMobs(activeWorld.id, activeDimension, engine.playerPos.x, engine.playerPos.z)
        .then((mobs) => {
          if (!cancelled && mobs) {
            engineRef.current?.syncMobs(mobs);
          }
        });
    };
    syncOnce();
    const timer = window.setInterval(syncOnce, 450);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeWorld?.id, activeDimension, screen]);

  const handleSaveNow = async () => {
    const engine = engineRef.current;
    const world = worldRef.current;
    if (!engine || !world) return;
    await saveWorldProgress(
      world.getModifiedBlocksMap(),
      [
        Number(engine.playerPos.x.toFixed(2)),
        Number(engine.playerPos.y.toFixed(2)),
        Number(engine.playerPos.z.toFixed(2)),
      ],
      engine.timeOfDay
    );
  };

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
      <div ref={mountRef} className="w-full h-full" />

      {screen === 'playing' && health > 0 && (
        <GameHUD
          onPause={() => {
            soundFX.playClick();
            void handleSaveNow();
            setScreen('paused');
          }}
          onOpenInventory={() => {
            soundFX.playClick();
            setFurnaceOpen(false);
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

      {health <= 0 && activeWorld?.gameMode === 'survival' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#4f0e0e]/75 p-4">
          <div className="mc-dark-panel p-7 max-w-sm w-full text-center space-y-4">
            <h2 className="font-pixel text-2xl text-red-400 drop-shadow-[2px_2px_0_#000]">
              You Died!
            </h2>
            <p className="text-xs text-stone-300 font-ui">
              Watch your step when climbing high cliffs or exploring lava caves.
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

      {screen === 'inventory' && furnaceOpen && (
        <FurnaceModal
          onClose={() => {
            setFurnaceOpen(false);
            setScreen('playing');
          }}
        />
      )}

      {screen === 'inventory' && !furnaceOpen && (
        <InventoryModal
          onClose={() => {
            setCraftingTableOpen(false);
            setScreen('playing');
          }}
        />
      )}

      {screen === 'paused' && (
        <PauseMenu
          onResume={() => {
            setScreen('playing');
            engineRef.current?.requestPointerLock();
          }}
          onSwitchDimension={(dim) => {
            const engine = engineRef.current;
            const world = worldRef.current;
            if (engine && world) {
              switchDimension(dim, world.getModifiedBlocksMap(), engine.timeOfDay);
            }
          }}
          onSetTimeOfDay={(t) => {
            engineRef.current?.setTimeOfDay(t);
          }}
          onSaveNow={handleSaveNow}
          onSaveAndQuit={handleSaveAndQuit}
        />
      )}

      {screen === 'settings' && <SettingsMenu />}
    </div>
  );
};
