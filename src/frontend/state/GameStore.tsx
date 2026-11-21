import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AnyItemId,
  BlockId,
  DebugTelemetry,
  DimensionId,
  GameMode,
  GameSettings,
  InventorySlot,
  ItemId,
  RaycastHit,
  ScreenState,
  TerrainType,
  WorldConfig,
} from '../../shared/types';
import { ALL_CREATIVE_ITEMS, getItemDef } from '../../shared/blocks';
import { worldApi } from '../api/worldApi';
import { soundFX } from '../engine/SoundFX';

const WORLDS_STORAGE_KEY = 'blockcraft_worlds_v1';
const SETTINGS_STORAGE_KEY = 'blockcraft_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  fov: 75,
  renderDistance: 4,
  mouseSensitivity: 1.0,
  invertY: false,
  masterVolume: 0.6,
  showDebugHud: true,
  showControlsHint: true,
  shadowsEnabled: true,
  touchControls: false,
};

function createStarterInventory(mode: GameMode): (InventorySlot | null)[] {
  const slots: (InventorySlot | null)[] = Array(36).fill(null);
  if (mode === 'creative') {
    slots[0] = { itemId: BlockId.Grass, count: 64 };
    slots[1] = { itemId: BlockId.Stone, count: 64 };
    slots[2] = { itemId: BlockId.OakPlanks, count: 64 };
    slots[3] = { itemId: BlockId.OakLog, count: 64 };
    slots[4] = { itemId: BlockId.Glass, count: 64 };
    slots[5] = { itemId: BlockId.Bricks, count: 64 };
    slots[6] = { itemId: BlockId.CraftingTable, count: 64 };
    slots[7] = { itemId: BlockId.Torch, count: 64 };
    slots[8] = { itemId: ItemId.DiamondPickaxe, count: 1, durability: 1561 };
  } else {
    slots[0] = { itemId: ItemId.WoodenPickaxe, count: 1, durability: 59 };
    slots[1] = { itemId: ItemId.WoodenAxe, count: 1, durability: 59 };
    slots[2] = { itemId: BlockId.OakPlanks, count: 16 };
    slots[3] = { itemId: BlockId.Cobblestone, count: 12 };
    slots[4] = { itemId: BlockId.Torch, count: 6 };
    slots[5] = { itemId: ItemId.Apple, count: 4 };
    slots[6] = { itemId: ItemId.Bread, count: 2 };
    slots[9] = { itemId: BlockId.OakLog, count: 4 };
    slots[10] = { itemId: ItemId.Stick, count: 8 };
    slots[11] = { itemId: ItemId.Coal, count: 6 };
  }
  return slots;
}

const DEFAULT_WORLDS: WorldConfig[] = [
  {
    id: 'emerald-valley',
    name: 'Emerald Valley',
    seed: '4829104',
    gameMode: 'survival',
    terrainType: 'normal',
    createdAt: Date.now() - 86400000 * 2,
    lastPlayedAt: Date.now() - 3600000,
    health: 20,
    hunger: 18,
    selectedSlot: 0,
    timeOfDay: 0.28,
  },
  {
    id: 'skyline-builders',
    name: 'Skyline Builders',
    seed: 'creative-archipelago',
    gameMode: 'creative',
    terrainType: 'islands',
    createdAt: Date.now() - 86400000 * 5,
    lastPlayedAt: Date.now() - 86400000,
    health: 20,
    hunger: 20,
    selectedSlot: 0,
    timeOfDay: 0.42,
  },
  {
    id: 'flat-sandbox',
    name: 'Redstone Flatlands',
    seed: 'superflat-01',
    gameMode: 'creative',
    terrainType: 'flat',
    createdAt: Date.now() - 86400000 * 9,
    lastPlayedAt: Date.now() - 86400000 * 4,
    health: 20,
    hunger: 20,
    selectedSlot: 2,
    timeOfDay: 0.35,
  },
];

interface GameContextValue {
  screen: ScreenState;
  setScreen: (s: ScreenState) => void;
  returnScreen: ScreenState;
  openSettings: (from: ScreenState) => void;

  worlds: WorldConfig[];
  activeWorld: WorldConfig | null;
  activeDimension: DimensionId;
  preloadedChunksRef: React.MutableRefObject<Map<string, Uint8Array>>;
  launchWorld: (worldId: string) => void;
  createWorld: (name: string, seed: string, gameMode: GameMode, terrainType: TerrainType) => Promise<void>;
  deleteWorld: (worldId: string) => void;
  switchDimension: (
    nextDim: DimensionId,
    currentModified: Record<string, number>,
    timeOfDay: number
  ) => void;
  saveWorldProgress: (
    modifiedBlocks: Record<string, number>,
    playerPos: [number, number, number],
    timeOfDay: number
  ) => Promise<void>;
  saveAndQuitWorld: (
    modifiedBlocks: Record<string, number>,
    playerPos: [number, number, number],
    timeOfDay: number
  ) => void;

  settings: GameSettings;
  updateSettings: (patch: Partial<GameSettings>) => void;

  // Live player state
  inventory: (InventorySlot | null)[];
  setInventory: React.Dispatch<React.SetStateAction<(InventorySlot | null)[]>>;
  selectedHotbarSlot: number;
  setSelectedHotbarSlot: (idx: number) => void;
  health: number;
  setHealth: React.Dispatch<React.SetStateAction<number>>;
  hunger: number;
  setHunger: React.Dispatch<React.SetStateAction<number>>;
  xp: number;
  addXp: (amount: number) => void;
  lastHurtAt: number;
  markPlayerHurt: () => void;
  addItemToInventory: (itemId: AnyItemId, count: number, durability?: number) => void;
  consumeSelectedHotbarItem: () => void;
  damageHeldTool: () => void;

  // Crafting table & furnace modes
  craftingTableOpen: boolean;
  setCraftingTableOpen: (open: boolean) => void;
  furnaceOpen: boolean;
  setFurnaceOpen: (open: boolean) => void;

  // HUD / Engine telemetry
  telemetry: DebugTelemetry;
  setTelemetry: (t: DebugTelemetry) => void;
  targetHit: RaycastHit | null;
  setTargetHit: (hit: RaycastHit | null) => void;
  miningProgress: number;
  setMiningProgress: (p: number) => void;
  pointerLocked: boolean;
  setPointerLocked: (locked: boolean) => void;
  loadingProgress: number;
  setLoadingProgress: (p: number) => void;
  loadingStatus: string;
  setLoadingStatus: (s: string) => void;
  creativeCatalog: AnyItemId[];
  toggleGameMode: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screen, setScreen] = useState<ScreenState>('main_menu');
  const [returnScreen, setReturnScreen] = useState<ScreenState>('main_menu');

  const [worlds, setWorlds] = useState<WorldConfig[]>(() => {
    try {
      const raw = localStorage.getItem(WORLDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorldConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage failure
    }
    return DEFAULT_WORLDS;
  });

  const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<DimensionId>('overworld');
  const preloadedChunksRef = useRef<Map<string, Uint8Array>>(new Map());

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [inventory, setInventory] = useState<(InventorySlot | null)[]>(() =>
    createStarterInventory('survival')
  );
  const [selectedHotbarSlot, setSelectedHotbarSlot] = useState(0);
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [xp, setXp] = useState(0);
  const [lastHurtAt, setLastHurtAt] = useState(0);
  const [craftingTableOpen, setCraftingTableOpen] = useState(false);
  const [furnaceOpen, setFurnaceOpen] = useState(false);

  const [telemetry, setTelemetry] = useState<DebugTelemetry>({
    fps: 60,
    position: [0.5, 25, 0.5],
    chunk: [0, 0],
    facing: 'North (-Z)',
    yawDeg: 0,
    pitchDeg: 0,
    biome: 'Plains',
    dimension: 'overworld',
    targetBlock: null,
    targetCoords: null,
    timeOfDayLabel: '08:00',
    dayCount: 1,
    loadedChunks: 0,
    isGrounded: true,
    isFlying: false,
    isSubmerged: false,
  });

  const [targetHit, setTargetHit] = useState<RaycastHit | null>(null);
  const [miningProgress, setMiningProgress] = useState(0);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Building terrain...');

  // Hydrate authoritative worlds and settings from Express backend on startup
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [serverWorlds, serverSettings] = await Promise.all([
        worldApi.listWorlds(),
        worldApi.getSettings(),
      ]);
      if (cancelled) return;
      if (serverWorlds && serverWorlds.length > 0) {
        setWorlds(serverWorlds);
      }
      if (serverSettings) {
        setSettings(serverSettings);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    soundFX.setVolume(settings.masterVolume);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(WORLDS_STORAGE_KEY, JSON.stringify(worlds));
    } catch {
      // ignore
    }
  }, [worlds]);

  const activeWorld = worlds.find((w) => w.id === activeWorldId) ?? null;

  const openSettings = useCallback((from: ScreenState) => {
    setReturnScreen(from);
    setScreen('settings');
  }, []);

  const updateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void worldApi.saveSettings(next);
      return next;
    });
  }, []);

  const launchWorld = useCallback(
    (worldId: string) => {
      const target = worlds.find((w) => w.id === worldId);
      if (!target) return;

      preloadedChunksRef.current.clear();
      setActiveWorldId(worldId);
      setActiveDimension(target.dimension ?? 'overworld');
      setInventory(target.inventory ?? createStarterInventory(target.gameMode));
      setHealth(target.health ?? 20);
      setHunger(target.hunger ?? 20);
      setSelectedHotbarSlot(target.selectedSlot ?? 0);
      setCraftingTableOpen(false);
      setFurnaceOpen(false);
      setLoadingProgress(0);
      setLoadingStatus('Connecting to world server...');
      setScreen('loading');

      setWorlds((prev) =>
        prev.map((w) => (w.id === worldId ? { ...w, lastPlayedAt: Date.now() } : w))
      );

      // Pull latest saved world snapshot from backend
      void worldApi.getWorld(worldId).then((fresh) => {
        if (!fresh) return;
        setWorlds((prev) => prev.map((w) => (w.id === worldId ? fresh : w)));
        setActiveDimension(fresh.dimension ?? 'overworld');
        if (fresh.inventory) setInventory(fresh.inventory);
        if (fresh.health !== undefined) setHealth(fresh.health);
        if (fresh.hunger !== undefined) setHunger(fresh.hunger);
        if (fresh.selectedSlot !== undefined) setSelectedHotbarSlot(fresh.selectedSlot);
      });
    },
    [worlds]
  );

  const createWorld = useCallback(
    async (name: string, seed: string, gameMode: GameMode, terrainType: TerrainType) => {
      const cleanName = name.trim() || 'New World';
      const cleanSeed = seed.trim() || String(Math.floor(100000 + Math.random() * 900000));

      const createdFromServer = await worldApi.createWorld({
        name: cleanName,
        seed: cleanSeed,
        gameMode,
        terrainType,
      });

      const newWorld: WorldConfig = createdFromServer ?? {
        id: `world-${Date.now().toString(36)}`,
        name: cleanName,
        seed: cleanSeed,
        gameMode,
        terrainType,
        dimension: 'overworld',
        createdAt: Date.now(),
        lastPlayedAt: Date.now(),
        health: 20,
        hunger: 20,
        selectedSlot: 0,
        timeOfDay: 0.28,
      };

      preloadedChunksRef.current.clear();
      setWorlds((prev) => [newWorld, ...prev.filter((w) => w.id !== newWorld.id)]);
      setActiveWorldId(newWorld.id);
      setActiveDimension('overworld');
      setInventory(createStarterInventory(gameMode));
      setHealth(20);
      setHunger(20);
      setXp(0);
      setSelectedHotbarSlot(0);
      setCraftingTableOpen(false);
      setFurnaceOpen(false);
      setLoadingProgress(0);
      setLoadingStatus('Generating terrain...');
      setScreen('loading');
    },
    []
  );

  const deleteWorld = useCallback((worldId: string) => {
    setWorlds((prev) => prev.filter((w) => w.id !== worldId));
    void worldApi.deleteWorld(worldId);
  }, []);

  const switchDimension = useCallback(
    (nextDim: DimensionId, currentModified: Record<string, number>, timeOfDay: number) => {
      if (!activeWorldId || nextDim === activeDimension) return;
      preloadedChunksRef.current.clear();

      const existing = worlds.find((w) => w.id === activeWorldId);
      const nextByDim = {
        ...(existing?.modifiedBlocksByDim ?? {}),
        [activeDimension]: currentModified,
      };

      setWorlds((prev) =>
        prev.map((w) =>
          w.id === activeWorldId
            ? {
                ...w,
                dimension: nextDim,
                modifiedBlocks: activeDimension === 'overworld' ? currentModified : w.modifiedBlocks,
                modifiedBlocksByDim: nextByDim,
                playerPosition: undefined,
                timeOfDay,
              }
            : w
        )
      );

      void worldApi.saveWorldState(activeWorldId, {
        dimension: nextDim,
        modifiedBlocksByDim: nextByDim,
        playerPosition: null,
        timeOfDay,
        inventory,
        health,
        hunger,
        selectedSlot: selectedHotbarSlot,
      });

      setActiveDimension(nextDim);
      setCraftingTableOpen(false);
      setFurnaceOpen(false);
      setScreen('playing');
    },
    [activeWorldId, activeDimension, worlds, inventory, health, hunger, selectedHotbarSlot]
  );

  const saveWorldProgress = useCallback(
    async (
      modifiedBlocks: Record<string, number>,
      playerPos: [number, number, number],
      timeOfDay: number
    ) => {
      if (!activeWorldId) return;
      const existing = worlds.find((w) => w.id === activeWorldId);
      const byDim = {
        ...(existing?.modifiedBlocksByDim ?? {}),
        [activeDimension]: modifiedBlocks,
      };

      setWorlds((prev) =>
        prev.map((w) => {
          if (w.id !== activeWorldId) return w;
          return {
            ...w,
            lastPlayedAt: Date.now(),
            dimension: activeDimension,
            modifiedBlocks: activeDimension === 'overworld' ? modifiedBlocks : w.modifiedBlocks,
            modifiedBlocksByDim: byDim,
            playerPosition: playerPos,
            inventory,
            health,
            hunger,
            selectedSlot: selectedHotbarSlot,
            timeOfDay,
          };
        })
      );

      await worldApi.saveWorldState(activeWorldId, {
        dimension: activeDimension,
        modifiedBlocksByDim: byDim,
        playerPosition: playerPos,
        inventory,
        health,
        hunger,
        selectedSlot: selectedHotbarSlot,
        timeOfDay,
        gameMode: existing?.gameMode,
      });
    },
    [activeWorldId, activeDimension, worlds, health, hunger, inventory, selectedHotbarSlot]
  );

  const saveAndQuitWorld = useCallback(
    (
      modifiedBlocks: Record<string, number>,
      playerPos: [number, number, number],
      timeOfDay: number
    ) => {
      void saveWorldProgress(modifiedBlocks, playerPos, timeOfDay);
      preloadedChunksRef.current.clear();
      setActiveWorldId(null);
      setCraftingTableOpen(false);
      setFurnaceOpen(false);
      setScreen('main_menu');
    },
    [saveWorldProgress]
  );

  const toggleGameMode = useCallback(() => {
    if (!activeWorldId) return;
    setWorlds((prev) =>
      prev.map((w) => {
        if (w.id !== activeWorldId) return w;
        const nextMode: GameMode = w.gameMode === 'survival' ? 'creative' : 'survival';
        void worldApi.saveWorldState(activeWorldId, { gameMode: nextMode });
        return { ...w, gameMode: nextMode };
      })
    );
  }, [activeWorldId]);

  const addXp = useCallback((amount: number) => {
    if (amount <= 0) return;
    setXp((prev) => prev + amount);
  }, []);

  const markPlayerHurt = useCallback(() => {
    setLastHurtAt(Date.now());
  }, []);

  const addItemToInventory = useCallback(
    (itemId: AnyItemId, count: number, durability?: number) => {
      const def = getItemDef(itemId);
      const maxStack = def?.stackSize ?? 64;

      setInventory((prev) => {
        const next = prev.map((s) => (s ? { ...s } : null));
        let remaining = count;

        if (maxStack > 1) {
          for (let i = 0; i < next.length && remaining > 0; i++) {
            const slot = next[i];
            if (slot && slot.itemId === itemId && slot.count < maxStack) {
              const add = Math.min(remaining, maxStack - slot.count);
              slot.count += add;
              remaining -= add;
            }
          }
        }

        for (let i = 0; i < next.length && remaining > 0; i++) {
          if (!next[i]) {
            const add = Math.min(remaining, maxStack);
            next[i] = {
              itemId,
              count: add,
              durability: durability ?? def?.maxDurability,
            };
            remaining -= add;
          }
        }

        return next;
      });
    },
    []
  );

  const consumeSelectedHotbarItem = useCallback(() => {
    if (activeWorld?.gameMode === 'creative') return;
    setInventory((prev) => {
      const next = [...prev];
      const slot = next[selectedHotbarSlot];
      if (!slot) return prev;
      if (slot.count <= 1) {
        next[selectedHotbarSlot] = null;
      } else {
        next[selectedHotbarSlot] = { ...slot, count: slot.count - 1 };
      }
      return next;
    });
  }, [activeWorld?.gameMode, selectedHotbarSlot]);

  const damageHeldTool = useCallback(() => {
    if (activeWorld?.gameMode === 'creative') return;
    setInventory((prev) => {
      const slot = prev[selectedHotbarSlot];
      if (!slot || slot.durability === undefined) return prev;
      const next = [...prev];
      if (slot.durability <= 1) {
        next[selectedHotbarSlot] = null;
      } else {
        next[selectedHotbarSlot] = { ...slot, durability: slot.durability - 1 };
      }
      return next;
    });
  }, [activeWorld?.gameMode, selectedHotbarSlot]);

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen,
        returnScreen,
        openSettings,
        worlds,
        activeWorld,
        activeDimension,
        preloadedChunksRef,
        launchWorld,
        createWorld,
        deleteWorld,
        switchDimension,
        saveWorldProgress,
        saveAndQuitWorld,
        settings,
        updateSettings,
        inventory,
        setInventory,
        selectedHotbarSlot,
        setSelectedHotbarSlot,
        health,
        setHealth,
        hunger,
        setHunger,
        xp,
        addXp,
        lastHurtAt,
        markPlayerHurt,
        addItemToInventory,
        consumeSelectedHotbarItem,
        damageHeldTool,
        craftingTableOpen,
        setCraftingTableOpen,
        furnaceOpen,
        setFurnaceOpen,
        telemetry,
        setTelemetry,
        targetHit,
        setTargetHit,
        miningProgress,
        setMiningProgress,
        pointerLocked,
        setPointerLocked,
        loadingProgress,
        setLoadingProgress,
        loadingStatus,
        setLoadingStatus,
        creativeCatalog: ALL_CREATIVE_ITEMS,
        toggleGameMode,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
