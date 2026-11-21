import fs from 'fs';
import path from 'path';
import type {
  DimensionId,
  GameMode,
  GameSettings,
  InventorySlot,
  TerrainType,
  WorldConfig,
} from '../shared/types.ts';
import {
  BLOCK_ID,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  VALID_DIMENSIONS,
  VALID_TERRAIN_TYPES,
} from './blockIds.ts';
import { ServerFluidSimulator } from './FluidSimulator.ts';
import type { FluidEdit } from './FluidSimulator.ts';
import { ServerWorldGenerator } from './WorldGenerator.ts';

const DATA_ROOT = path.resolve(process.cwd(), '.world-data');
const WORLDS_DIR = path.resolve(DATA_ROOT, 'worlds');
const SETTINGS_FILE = path.resolve(DATA_ROOT, 'settings.json');
const WORLD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export const DEFAULT_SERVER_SETTINGS: GameSettings = {
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

function createStarterWorlds(): WorldConfig[] {
  const now = Date.now();
  return [
    {
      id: 'emerald-valley',
      name: 'Emerald Valley',
      seed: '4829104',
      gameMode: 'survival',
      terrainType: 'normal',
      dimension: 'overworld',
      createdAt: now - 86400000 * 2,
      lastPlayedAt: now - 3600000,
      health: 20,
      hunger: 18,
      selectedSlot: 0,
      timeOfDay: 0.28,
      modifiedBlocksByDim: {},
    },
    {
      id: 'skyline-builders',
      name: 'Skyline Builders',
      seed: 'creative-archipelago',
      gameMode: 'creative',
      terrainType: 'islands',
      dimension: 'overworld',
      createdAt: now - 86400000 * 5,
      lastPlayedAt: now - 86400000,
      health: 20,
      hunger: 20,
      selectedSlot: 0,
      timeOfDay: 0.42,
      modifiedBlocksByDim: {},
    },
    {
      id: 'flat-sandbox',
      name: 'Redstone Flatlands',
      seed: 'superflat-01',
      gameMode: 'creative',
      terrainType: 'flat',
      dimension: 'overworld',
      createdAt: now - 86400000 * 9,
      lastPlayedAt: now - 86400000 * 4,
      health: 20,
      hunger: 20,
      selectedSlot: 2,
      timeOfDay: 0.35,
      modifiedBlocksByDim: {},
    },
  ];
}

export function isValidWorldId(id: string): boolean {
  return WORLD_ID_PATTERN.test(id);
}

function getSafeWorldFilePath(worldId: string): string {
  if (!isValidWorldId(worldId)) {
    throw new Error('Invalid world identifier');
  }
  const resolved = path.resolve(WORLDS_DIR, `${worldId}.json`);
  if (!resolved.startsWith(WORLDS_DIR + path.sep)) {
    throw new Error('Invalid world path');
  }
  return resolved;
}

function sanitizeNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sanitizeInventory(raw: unknown): (InventorySlot | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: (InventorySlot | null)[] = Array(36).fill(null);
  for (let i = 0; i < Math.min(36, raw.length); i++) {
    const slot = raw[i];
    if (
      slot &&
      typeof slot === 'object' &&
      typeof slot.itemId === 'number' &&
      Number.isInteger(slot.itemId) &&
      typeof slot.count === 'number' &&
      Number.isInteger(slot.count) &&
      slot.count >= 1 &&
      slot.count <= 64
    ) {
      const cleanSlot: InventorySlot = {
        itemId: slot.itemId,
        count: slot.count,
      };
      if (
        typeof slot.durability === 'number' &&
        Number.isInteger(slot.durability) &&
        slot.durability >= 0
      ) {
        cleanSlot.durability = slot.durability;
      }
      out[i] = cleanSlot;
    }
  }
  return out;
}

function sanitizeModifiedMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const entries = Object.entries(raw as Record<string, unknown>);
  for (let i = 0; i < Math.min(entries.length, 50000); i++) {
    const [k, v] = entries[i];
    if (!/^-?\d+,\d+,-?\d+$/.test(k)) continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 255) continue;
    out[k] = v;
  }
  return out;
}

export class WorldRepository {
  private worlds = new Map<string, WorldConfig>();
  private settings: GameSettings = { ...DEFAULT_SERVER_SETTINGS };

  constructor() {
    this.ensureDirectories();
    this.loadFromDisk();
  }

  private ensureDirectories() {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
  }

  private writeJsonAtomic(targetPath: string, payload: unknown) {
    const tmpPath = `${targetPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, targetPath);
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        this.settings = this.sanitizeSettings(raw);
      } else {
        this.writeJsonAtomic(SETTINGS_FILE, this.settings);
      }
    } catch {
      this.settings = { ...DEFAULT_SERVER_SETTINGS };
    }

    const files = fs.readdirSync(WORLDS_DIR).filter((f) => f.endsWith('.json'));
    if (files.length === 0) {
      for (const starter of createStarterWorlds()) {
        this.worlds.set(starter.id, starter);
        this.writeJsonAtomic(getSafeWorldFilePath(starter.id), starter);
      }
      return;
    }

    for (const file of files) {
      const id = file.slice(0, -5);
      if (!isValidWorldId(id)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(getSafeWorldFilePath(id), 'utf8')) as WorldConfig;
        if (raw && raw.id === id && typeof raw.name === 'string') {
          this.worlds.set(id, raw);
        }
      } catch {
        // Skip corrupted file without crashing server
      }
    }
  }

  public listWorlds(): WorldConfig[] {
    return Array.from(this.worlds.values()).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  public getWorld(worldId: string): WorldConfig | null {
    if (!isValidWorldId(worldId)) return null;
    return this.worlds.get(worldId) ?? null;
  }

  public createWorld(input: {
    name?: unknown;
    seed?: unknown;
    gameMode?: unknown;
    terrainType?: unknown;
  }): WorldConfig {
    const rawName = typeof input.name === 'string' ? input.name.trim().slice(0, 28) : '';
    const rawSeed = typeof input.seed === 'string' ? input.seed.trim().slice(0, 24) : '';
    const gameMode: GameMode = input.gameMode === 'creative' ? 'creative' : 'survival';
    const terrainType: TerrainType = VALID_TERRAIN_TYPES.includes(input.terrainType as TerrainType)
      ? (input.terrainType as TerrainType)
      : 'normal';

    const now = Date.now();
    const id = `world-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const world: WorldConfig = {
      id,
      name: rawName || 'New World',
      seed: rawSeed || String(Math.floor(100000 + Math.random() * 900000)),
      gameMode,
      terrainType,
      dimension: 'overworld',
      createdAt: now,
      lastPlayedAt: now,
      health: 20,
      hunger: 20,
      selectedSlot: 0,
      timeOfDay: 0.28,
      modifiedBlocksByDim: {},
    };

    this.worlds.set(id, world);
    this.writeJsonAtomic(getSafeWorldFilePath(id), world);
    return world;
  }

  public saveWorldState(worldId: string, patch: Record<string, unknown>): WorldConfig | null {
    const existing = this.getWorld(worldId);
    if (!existing) return null;

    const dimension: DimensionId = VALID_DIMENSIONS.includes(patch.dimension as DimensionId)
      ? (patch.dimension as DimensionId)
      : existing.dimension ?? 'overworld';

    const gameMode: GameMode =
      patch.gameMode === 'creative' || patch.gameMode === 'survival'
        ? patch.gameMode
        : existing.gameMode;

    const nextByDim: Partial<Record<DimensionId, Record<string, number>>> = {
      ...(existing.modifiedBlocksByDim ?? {}),
    };

    if (patch.modifiedBlocksByDim && typeof patch.modifiedBlocksByDim === 'object') {
      const rawMap = patch.modifiedBlocksByDim as Record<string, unknown>;
      for (const dim of VALID_DIMENSIONS) {
        if (rawMap[dim] !== undefined) {
          nextByDim[dim] = sanitizeModifiedMap(rawMap[dim]);
        }
      }
    } else if (patch.modifiedBlocks !== undefined) {
      nextByDim[dimension] = sanitizeModifiedMap(patch.modifiedBlocks);
    }

    let playerPosition = existing.playerPosition;
    if (patch.playerPosition === null) {
      playerPosition = undefined;
    } else if (
      Array.isArray(patch.playerPosition) &&
      patch.playerPosition.length === 3 &&
      patch.playerPosition.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      playerPosition = [
        sanitizeNumber(patch.playerPosition[0], -100000, 100000, 0.5),
        sanitizeNumber(patch.playerPosition[1], -32, 128, 25),
        sanitizeNumber(patch.playerPosition[2], -100000, 100000, 0.5),
      ];
    }

    const updated: WorldConfig = {
      ...existing,
      gameMode,
      dimension,
      lastPlayedAt: Date.now(),
      modifiedBlocks: nextByDim.overworld ?? existing.modifiedBlocks,
      modifiedBlocksByDim: nextByDim,
      playerPosition,
      inventory: sanitizeInventory(patch.inventory) ?? existing.inventory,
      health: sanitizeNumber(patch.health, 0, 20, existing.health ?? 20),
      hunger: sanitizeNumber(patch.hunger, 0, 20, existing.hunger ?? 20),
      selectedSlot: Math.floor(
        sanitizeNumber(patch.selectedSlot, 0, 8, existing.selectedSlot ?? 0)
      ),
      timeOfDay: sanitizeNumber(patch.timeOfDay, 0, 1, existing.timeOfDay ?? 0.28),
    };

    this.worlds.set(worldId, updated);
    this.writeJsonAtomic(getSafeWorldFilePath(worldId), updated);
    return updated;
  }

  public setBlock(
    worldId: string,
    dimension: DimensionId,
    wx: number,
    wy: number,
    wz: number,
    blockId: number
  ): { ok: true; fluidEdits: FluidEdit[] } | null {
    const world = this.getWorld(worldId);
    if (!world) return null;
    if (!VALID_DIMENSIONS.includes(dimension)) return null;
    if (!Number.isInteger(wx) || !Number.isInteger(wy) || !Number.isInteger(wz)) return null;
    if (wy < 0 || wy >= CHUNK_HEIGHT) return null;
    if (!Number.isInteger(blockId) || blockId < BLOCK_ID.Air || blockId > 255) return null;

    const byDim = { ...(world.modifiedBlocksByDim ?? {}) };
    const dimMap = { ...(byDim[dimension] ?? {}) };
    dimMap[`${wx},${wy},${wz}`] = blockId;

    // Run tick-budgeted FluidSimulator from Minecraft-2hrs around edited voxel
    const generator = new ServerWorldGenerator(world.seed, world.terrainType, dimension);
    const chunkCache = new Map<string, Uint8Array>();
    const getChunk = (cx: number, cz: number): Uint8Array => {
      const ck = `${cx},${cz}`;
      let arr = chunkCache.get(ck);
      if (!arr) {
        arr = generator.generateChunk(cx, cz, dimMap);
        chunkCache.set(ck, arr);
      }
      return arr;
    };

    const fluidSim = new ServerFluidSimulator(36);
    const fluidEdits = fluidSim.simulateAround(
      {
        getBlock: (bx, by, bz) => {
          if (by < 0 || by >= CHUNK_HEIGHT) return BLOCK_ID.Air;
          const mod = dimMap[`${bx},${by},${bz}`];
          if (mod !== undefined) return mod;
          const cx = Math.floor(bx / CHUNK_SIZE);
          const cz = Math.floor(bz / CHUNK_SIZE);
          const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          return getChunk(cx, cz)[lx + lz * CHUNK_SIZE + by * CHUNK_SIZE * CHUNK_SIZE];
        },
        setBlock: (bx, by, bz, id) => {
          dimMap[`${bx},${by},${bz}`] = id;
          const cx = Math.floor(bx / CHUNK_SIZE);
          const cz = Math.floor(bz / CHUNK_SIZE);
          const chunk = chunkCache.get(`${cx},${cz}`);
          if (chunk && by >= 0 && by < CHUNK_HEIGHT) {
            const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            chunk[lx + lz * CHUNK_SIZE + by * CHUNK_SIZE * CHUNK_SIZE] = id;
          }
        },
      },
      wx,
      wy,
      wz
    );

    byDim[dimension] = dimMap;

    const updated: WorldConfig = {
      ...world,
      lastPlayedAt: Date.now(),
      modifiedBlocks: dimension === 'overworld' ? dimMap : world.modifiedBlocks,
      modifiedBlocksByDim: byDim,
    };
    this.worlds.set(worldId, updated);
    this.writeJsonAtomic(getSafeWorldFilePath(worldId), updated);
    return { ok: true, fluidEdits };
  }

  public getSurfaceHeightAt(
    worldId: string,
    dimension: DimensionId,
    wx: number,
    wz: number
  ): number {
    const world = this.getWorld(worldId);
    if (!world || !VALID_DIMENSIONS.includes(dimension)) return 21;
    const generator = new ServerWorldGenerator(world.seed, world.terrainType, dimension);
    return generator.getSurfaceHeightAt(wx, wz);
  }

  public deleteWorld(worldId: string): boolean {
    if (!isValidWorldId(worldId)) return false;
    const existed = this.worlds.delete(worldId);
    const filePath = getSafeWorldFilePath(worldId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return existed;
  }

  public generateChunk(worldId: string, dimension: DimensionId, cx: number, cz: number) {
    const world = this.getWorld(worldId);
    if (!world) return null;
    if (!VALID_DIMENSIONS.includes(dimension)) return null;

    const generator = new ServerWorldGenerator(world.seed, world.terrainType, dimension);
    const modified =
      world.modifiedBlocksByDim?.[dimension] ??
      (dimension === 'overworld' ? world.modifiedBlocks : undefined);

    const blocks = generator.generateChunk(cx, cz, modified);
    const surfaceY = generator.getSurfaceHeightInChunk(blocks, 0, 0);
    const biome = generator.getBiomeAt(cx * 16, cz * 16);

    return {
      cx,
      cz,
      dimension,
      blocksBase64: Buffer.from(blocks).toString('base64'),
      surfaceY,
      biome,
    };
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  private sanitizeSettings(raw: unknown): GameSettings {
    const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
      fov: Math.round(sanitizeNumber(input.fov, 60, 105, DEFAULT_SERVER_SETTINGS.fov)),
      renderDistance: Math.round(
        sanitizeNumber(input.renderDistance, 2, 6, DEFAULT_SERVER_SETTINGS.renderDistance)
      ),
      mouseSensitivity: Number(
        sanitizeNumber(input.mouseSensitivity, 0.3, 2.0, DEFAULT_SERVER_SETTINGS.mouseSensitivity).toFixed(2)
      ),
      invertY:
        typeof input.invertY === 'boolean' ? input.invertY : DEFAULT_SERVER_SETTINGS.invertY,
      masterVolume: Number(
        sanitizeNumber(input.masterVolume, 0, 1, DEFAULT_SERVER_SETTINGS.masterVolume).toFixed(2)
      ),
      showDebugHud:
        typeof input.showDebugHud === 'boolean'
          ? input.showDebugHud
          : DEFAULT_SERVER_SETTINGS.showDebugHud,
      showControlsHint:
        typeof input.showControlsHint === 'boolean'
          ? input.showControlsHint
          : DEFAULT_SERVER_SETTINGS.showControlsHint,
      shadowsEnabled:
        typeof input.shadowsEnabled === 'boolean'
          ? input.shadowsEnabled
          : DEFAULT_SERVER_SETTINGS.shadowsEnabled,
      touchControls:
        typeof input.touchControls === 'boolean'
          ? input.touchControls
          : DEFAULT_SERVER_SETTINGS.touchControls,
    };
  }

  public saveSettings(patch: Record<string, unknown>): GameSettings {
    const merged = { ...this.settings, ...patch };
    this.settings = this.sanitizeSettings(merged);
    this.writeJsonAtomic(SETTINGS_FILE, this.settings);
    return { ...this.settings };
  }
}
