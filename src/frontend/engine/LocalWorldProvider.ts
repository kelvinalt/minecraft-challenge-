import { SimplexNoise } from '../../backend/Noise';
import { BiomeType, BlockId, DimensionId, TerrainType } from '../../shared/types';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  ChunkData,
  IWorldProvider,
  WATER_LEVEL,
} from '../../shared/worldInterface';
import { FluidEdit, decodeChunkBase64, worldApi } from '../api/worldApi';

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2D(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = smoothstep(x - xi);
  const zf = smoothstep(z - zi);

  const v00 = hash2D(xi, zi, seed);
  const v10 = hash2D(xi + 1, zi, seed);
  const v01 = hash2D(xi, zi + 1, seed);
  const v11 = hash2D(xi + 1, zi + 1, seed);

  const x1 = v00 + (v10 - v00) * xf;
  const x2 = v01 + (v11 - v01) * xf;
  return x1 + (x2 - x1) * zf;
}

function fbm2D(x: number, z: number, seed: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(x * freq, z * freq, seed + i * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02;
  }
  return value / norm;
}

export class LocalWorldProvider implements IWorldProvider {
  public readonly seed: string;
  public readonly terrainType: TerrainType;
  public readonly dimension: DimensionId;
  private readonly worldId?: string;
  private readonly numericSeed: number;
  private readonly caveNoise: SimplexNoise;
  private readonly gravelNoise: SimplexNoise;
  private chunks = new Map<string, ChunkData>();
  private modified = new Map<string, BlockId>();
  private syncedChunks = new Set<string>();
  private inFlightChunks = new Set<string>();
  private onChunkHydrated?: (cx: number, cz: number) => void;
  private onFluidEdits?: (edits: FluidEdit[]) => void;

  constructor(
    seed: string,
    terrainType: TerrainType,
    initialModified?: Record<string, number>,
    dimension: DimensionId = 'overworld',
    options?: {
      worldId?: string;
      preloadedChunks?: Map<string, Uint8Array>;
      onChunkHydrated?: (cx: number, cz: number) => void;
      onFluidEdits?: (edits: FluidEdit[]) => void;
    }
  ) {
    this.seed = seed || 'BlockCraft';
    this.terrainType = terrainType;
    this.dimension = dimension;
    this.worldId = options?.worldId;
    this.onChunkHydrated = options?.onChunkHydrated;
    this.onFluidEdits = options?.onFluidEdits;
    this.numericSeed = hashString(this.seed);
    this.caveNoise = new SimplexNoise(this.numericSeed + 808);
    this.gravelNoise = new SimplexNoise(this.numericSeed + 303);
    if (initialModified) {
      for (const [k, v] of Object.entries(initialModified)) {
        this.modified.set(k, v as BlockId);
      }
    }
    if (options?.preloadedChunks) {
      for (const [key, blocks] of options.preloadedChunks.entries()) {
        const [cx, cz] = key.split(',').map(Number);
        if (Number.isInteger(cx) && Number.isInteger(cz)) {
          this.chunks.set(key, { cx, cz, blocks: new Uint8Array(blocks) });
          this.syncedChunks.add(key);
        }
      }
    }
  }

  public setOnChunkHydrated(cb: (cx: number, cz: number) => void) {
    this.onChunkHydrated = cb;
  }

  public setOnFluidEdits(cb: (edits: FluidEdit[]) => void) {
    this.onFluidEdits = cb;
  }

  public prefetchChunk(cx: number, cz: number): void {
    if (!this.worldId) return;
    const key = this.chunkKey(cx, cz);
    if (this.syncedChunks.has(key) || this.inFlightChunks.has(key)) return;
    this.inFlightChunks.add(key);

    void worldApi.fetchChunk(this.worldId, this.dimension, cx, cz).then((res) => {
      this.inFlightChunks.delete(key);
      if (!res) return;
      this.syncedChunks.add(key);
      const serverBlocks = decodeChunkBase64(res.blocksBase64);

      // Re-apply any local edits made while fetch was in flight
      const minX = cx * CHUNK_SIZE;
      const minZ = cz * CHUNK_SIZE;
      for (const [bKey, blockId] of this.modified.entries()) {
        const parts = bKey.split(',');
        const wx = Number(parts[0]);
        const wy = Number(parts[1]);
        const wz = Number(parts[2]);
        if (
          wx >= minX &&
          wx < minX + CHUNK_SIZE &&
          wz >= minZ &&
          wz < minZ + CHUNK_SIZE &&
          wy >= 0 &&
          wy < CHUNK_HEIGHT
        ) {
          const lx = wx - minX;
          const lz = wz - minZ;
          serverBlocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] = blockId;
        }
      }

      this.chunks.set(key, { cx, cz, blocks: serverBlocks });
      this.onChunkHydrated?.(cx, cz);
    });
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private blockKey(wx: number, wy: number, wz: number): string {
    return `${wx},${wy},${wz}`;
  }

  public getBiomeAt(wx: number, wz: number): BiomeType {
    if (this.dimension === 'nether') {
      const n = fbm2D(wx * 0.015, wz * 0.015, this.numericSeed + 601, 3);
      return n > 0.58 ? 'Soul Sand Valley' : 'Nether Wastes';
    }
    if (this.dimension === 'end') {
      return 'The End';
    }
    if (this.terrainType === 'flat') return 'Plains';

    const temp = fbm2D(wx * 0.008, wz * 0.008, this.numericSeed + 411, 3);
    const moist = fbm2D(wx * 0.008, wz * 0.008, this.numericSeed + 823, 3);
    const h = this.computeBaseHeight(wx, wz);
    if (h < WATER_LEVEL - 1) return 'Ocean';
    if (h > 34 || temp < 0.27) return 'Snowy Peaks';
    if (temp > 0.68 && moist < 0.48) return 'Desert';
    if (moist > 0.58 && temp > 0.46) return 'Cherry Grove';
    if (moist > 0.5) return 'Forest';
    return 'Plains';
  }

  private computeBaseHeight(wx: number, wz: number): number {
    if (this.dimension === 'nether') {
      const n = fbm2D(wx * 0.024, wz * 0.024, this.numericSeed + 717, 4);
      const d = fbm2D(wx * 0.06, wz * 0.06, this.numericSeed + 919, 2);
      const raw = 9 + n * 16 + d * 4;
      const spawnDist = Math.hypot(wx, wz);
      if (spawnDist < 8) {
        return 19;
      }
      return Math.min(28, Math.max(7, Math.floor(raw)));
    }

    if (this.dimension === 'end') {
      const dist = Math.hypot(wx, wz);
      if (dist < 32) {
        const edge = Math.max(0, 1 - dist / 32);
        const detail = fbm2D(wx * 0.05, wz * 0.05, this.numericSeed + 313, 3);
        return Math.floor(17 + edge * 5 + detail * 3);
      }
      const islandNoise = fbm2D(wx * 0.022, wz * 0.022, this.numericSeed + 777, 3);
      if (islandNoise > 0.61) {
        return Math.floor(18 + (islandNoise - 0.61) * 24);
      }
      return -1; // Void gap
    }

    if (this.terrainType === 'flat') {
      return 20;
    }

    const continental = fbm2D(wx * 0.012, wz * 0.012, this.numericSeed, 4);
    const ridge = fbm2D(wx * 0.032, wz * 0.032, this.numericSeed + 199, 3);
    const detail = fbm2D(wx * 0.08, wz * 0.08, this.numericSeed + 503, 2);

    if (this.terrainType === 'islands') {
      const dist = Math.hypot(wx, wz);
      const islandFalloff = Math.max(0, 1 - dist / 95);
      return Math.floor(11 + continental * 16 + ridge * 8 * islandFalloff + detail * 3);
    }

    const mountainFactor = Math.max(0, ridge - 0.52) * 32;
    const rawHeight = 16 + continental * 12 + mountainFactor + detail * 3;
    const spawnDist = Math.hypot(wx, wz);
    if (spawnDist < 12) {
      const blend = Math.max(0, (spawnDist - 4) / 8);
      return Math.floor(22 * (1 - blend) + rawHeight * blend);
    }
    return Math.min(CHUNK_HEIGHT - 12, Math.max(6, Math.floor(rawHeight)));
  }

  public getSurfaceHeightAt(wx: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const maxCheck = this.dimension === 'nether' ? 38 : CHUNK_HEIGHT - 1;
    for (let y = maxCheck; y >= 0; y--) {
      const b = chunk.blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
      if (
        b !== BlockId.Air &&
        b !== BlockId.OakLeaves &&
        b !== BlockId.BirchLeaves &&
        b !== BlockId.SpruceLeaves &&
        b !== BlockId.CherryLeaves &&
        b !== BlockId.TallGrass &&
        b !== BlockId.Poppy &&
        b !== BlockId.Dandelion &&
        b !== BlockId.CherrySapling
      ) {
        return y;
      }
    }
    return this.dimension === 'nether' ? 19 : 21;
  }

  private generateNetherChunk(cx: number, cz: number, blocks: Uint8Array) {
    const LAVA_LEVEL = 12;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const floorH = this.computeBaseHeight(wx, wz);
        const ceilNoise = fbm2D(wx * 0.028, wz * 0.028, this.numericSeed + 888, 3);
        const ceilY = Math.floor(46 + ceilNoise * 12);
        const biome = this.getBiomeAt(wx, wz);
        const distSpawn = Math.hypot(wx, wz);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
          let block = BlockId.Air;

          if (y === 0 || y === CHUNK_HEIGHT - 1) {
            block = BlockId.Bedrock;
          } else if (y <= floorH) {
            if (distSpawn < 5 && y >= floorH - 1) {
              block = BlockId.NetherBricks;
            } else if (y === floorH && biome === 'Soul Sand Valley' && floorH > LAVA_LEVEL) {
              block = BlockId.SoulSand;
            } else if (y === floorH && hash2D(wx, wz, this.numericSeed + 123) > 0.96) {
              block = BlockId.GoldOre;
            } else {
              block = BlockId.Netherrack;
            }
          } else if (y <= LAVA_LEVEL) {
            block = BlockId.Lava;
          } else if (y >= ceilY) {
            if (y === ceilY && hash2D(wx * 3, wz * 5, this.numericSeed + 555) > 0.94) {
              block = BlockId.Glowstone;
            } else {
              block = BlockId.Netherrack;
            }
          }

          blocks[idx] = block;
        }
      }
    }

    // Occasional Nether Brick pillars & Obsidian Return Portal near spawn
    if (cx === 0 && cz === 0) {
      this.placePortalFrame(blocks, 10, 20, 10, BlockId.NetherPortal);
    }
  }

  private generateEndChunk(cx: number, cz: number, blocks: Uint8Array) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const topY = this.computeBaseHeight(wx, wz);
        if (topY < 0) continue;

        const bottomY = Math.max(8, topY - 6 - Math.floor(hash2D(wx, wz, this.numericSeed + 41) * 4));
        for (let y = bottomY; y <= topY; y++) {
          blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = BlockId.EndStone;
        }

        // Tall Obsidian Pillars with Glowstone beacon on top
        const pillarPositions = [
          [11, 11],
          [-11, 11],
          [11, -11],
          [-11, -11],
        ];
        for (const [px, pz] of pillarPositions) {
          if (Math.abs(wx - px) <= 1 && Math.abs(wz - pz) <= 1) {
            const pHeight = 14;
            for (let y = topY + 1; y <= topY + pHeight; y++) {
              if (y < CHUNK_HEIGHT) {
                blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] =
                  wx === px && wz === pz && y === topY + pHeight ? BlockId.Glowstone : BlockId.Obsidian;
              }
            }
          }
        }

        // Occasional Purpur spires on outer islands
        if (Math.hypot(wx, wz) > 35 && hash2D(wx, wz, this.numericSeed + 909) > 0.992) {
          for (let y = topY + 1; y <= Math.min(CHUNK_HEIGHT - 2, topY + 6); y++) {
            blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] =
              y === topY + 6 ? BlockId.Glowstone : BlockId.PurpurBlock;
          }
        }
      }
    }

    if (cx === 0 && cz === 0) {
      const sy = this.computeBaseHeight(6, 6);
      if (sy > 0) {
        this.placePortalFrame(blocks, 6, sy + 1, 6, BlockId.EndPortal);
      }
    }
  }

  private placePortalFrame(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
    portalBlock: BlockId
  ) {
    if (lx < 2 || lx > CHUNK_SIZE - 4 || lz < 1 || lz > CHUNK_SIZE - 2 || baseY + 5 >= CHUNK_HEIGHT) {
      return;
    }
    const set = (x: number, y: number, z: number, id: BlockId) => {
      blocks[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = id;
    };
    for (let dx = 0; dx < 4; dx++) {
      set(lx + dx, baseY, lz, BlockId.Obsidian);
      set(lx + dx, baseY + 4, lz, BlockId.Obsidian);
    }
    for (let dy = 1; dy < 4; dy++) {
      set(lx, baseY + dy, lz, BlockId.Obsidian);
      set(lx + 3, baseY + dy, lz, BlockId.Obsidian);
      set(lx + 1, baseY + dy, lz, portalBlock);
      set(lx + 2, baseY + dy, lz, portalBlock);
    }
  }

  private placeTree(
    blocks: Uint8Array,
    lx: number,
    h: number,
    lz: number,
    logId: BlockId,
    leafId: BlockId,
    wx: number,
    wz: number
  ) {
    const trunkH = 4 + Math.floor(hash2D(wx + 3, wz - 5, this.numericSeed) * 2);
    if (h + trunkH + 2 >= CHUNK_HEIGHT) return;

    for (let ty = 1; ty <= trunkH; ty++) {
      blocks[lx + lz * CHUNK_SIZE + (h + ty) * CHUNK_SIZE * CHUNK_SIZE] = logId;
    }

    const topY = h + trunkH;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy === 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy !== -1) continue;
          const bx = lx + dx;
          const bz = lz + dz;
          const by = topY + dy;
          if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE || by >= CHUNK_HEIGHT) continue;
          const idx = bx + bz * CHUNK_SIZE + by * CHUNK_SIZE * CHUNK_SIZE;
          if (blocks[idx] === BlockId.Air) {
            blocks[idx] = leafId;
          }
        }
      }
    }
  }

  public getChunk(cx: number, cz: number): ChunkData {
    const key = this.chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

    if (this.dimension === 'nether') {
      this.generateNetherChunk(cx, cz, blocks);
    } else if (this.dimension === 'end') {
      this.generateEndChunk(cx, cz, blocks);
    } else {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          const h = this.computeBaseHeight(wx, wz);
          const biome = this.getBiomeAt(wx, wz);
          const distSpawn = Math.hypot(wx, wz);
          const shoreRoll = hash2D(wx, wz, this.numericSeed + 31);
          const gravelPatch =
            h >= 28 && this.gravelNoise.noise2D(wx * 0.08, wz * 0.08) > 0.34;

          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
            let block = BlockId.Air;

            if (y === 0) {
              block = BlockId.Bedrock;
            } else if (y <= h) {
              let isCave = false;
              if (
                this.terrainType !== 'flat' &&
                y > 2 &&
                y < h - 3 &&
                distSpawn >= 5 &&
                !(h <= WATER_LEVEL + 1 && y > h - 6)
              ) {
                const c1 = Math.abs(this.caveNoise.noise3D(wx * 0.045, y * 0.06, wz * 0.045));
                const c2 = Math.abs(
                  this.caveNoise.noise3D(wx * 0.045 + 31.7, y * 0.06 - 12.4, wz * 0.045 + 19.2)
                );
                if (c1 < 0.095 && c2 < 0.14) {
                  isCave = true;
                }
              }

              if (isCave) {
                block = BlockId.Air;
              } else if (y === h) {
                if (h < WATER_LEVEL) {
                  block = h < WATER_LEVEL - 1 && shoreRoll > 0.48 ? BlockId.Gravel : BlockId.Sand;
                } else if (biome === 'Desert') {
                  block = BlockId.Sand;
                } else if (biome === 'Snowy Peaks' && h >= 29) {
                  block =
                    h >= 36 && hash2D(wx, wz, this.numericSeed + 88) > 0.72
                      ? BlockId.Ice
                      : gravelPatch && h < 34
                      ? BlockId.Gravel
                      : BlockId.Snow;
                } else if (h <= WATER_LEVEL + 1) {
                  block = BlockId.Sand;
                } else if (gravelPatch && biome === 'Plains' && h >= 29) {
                  block = BlockId.Gravel;
                } else {
                  block = BlockId.Grass;
                }
              } else if (y >= h - 3) {
                if (biome === 'Desert') {
                  block = y >= h - 2 ? BlockId.Sand : BlockId.Sandstone;
                } else if (h < WATER_LEVEL) {
                  block = h < WATER_LEVEL - 1 ? BlockId.Gravel : BlockId.Sand;
                } else {
                  block = BlockId.Dirt;
                }
              } else {
                const oreHash = hash2D(wx * 31 + y, wz * 17 - y, this.numericSeed + y * 13);
                if (y <= 8) {
                  if (oreHash > 0.991) block = BlockId.DiamondOre;
                  else if (oreHash > 0.982) block = BlockId.AmethystBlock;
                  else if (oreHash > 0.968) block = BlockId.GoldOre;
                  else block = BlockId.Deepslate;
                } else {
                  if (y < 14 && oreHash > 0.992) block = BlockId.DiamondOre;
                  else if (y < 20 && oreHash > 0.985) block = BlockId.GoldOre;
                  else if (y < 26 && oreHash > 0.974) block = BlockId.CopperBlock;
                  else if (y < 28 && oreHash > 0.958) block = BlockId.IronOre;
                  else if (oreHash > 0.94) block = BlockId.CoalOre;
                  else block = BlockId.Stone;
                }
              }
            } else if (y <= WATER_LEVEL && this.terrainType !== 'flat') {
              block = BlockId.Water;
            }

            blocks[idx] = block;
          }
        }
      }

      // Place procedural trees, bamboo, cacti, and crossed-plane flora in Overworld
      if (this.terrainType !== 'flat') {
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
          for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;
            if (Math.hypot(wx, wz) < 5) continue;
            const h = this.computeBaseHeight(wx, wz);
            if (h <= WATER_LEVEL + 1 || h + 2 >= CHUNK_HEIGHT) continue;
            const surfaceBlock = blocks[lx + lz * CHUNK_SIZE + h * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
            const biome = this.getBiomeAt(wx, wz);

            if (biome === 'Desert' && surfaceBlock === BlockId.Sand) {
              const cactusRoll = hash2D(wx, wz, this.numericSeed + 2411);
              if (cactusRoll < 0.012 && h + 4 < CHUNK_HEIGHT) {
                const cactusHeight = 2 + Math.floor(hash2D(wx, wz, this.numericSeed + 2477) * 2);
                for (let ch = 1; ch <= cactusHeight; ch++) {
                  blocks[lx + lz * CHUNK_SIZE + (h + ch) * CHUNK_SIZE * CHUNK_SIZE] = BlockId.Cactus;
                }
              }
              continue;
            }

            if (surfaceBlock !== BlockId.Grass && surfaceBlock !== BlockId.Snow) continue;

            const roll = hash2D(wx, wz, this.numericSeed + 999);

            if (biome === 'Cherry Grove') {
              if (roll > 0.968) {
                this.placeTree(blocks, lx, h, lz, BlockId.CherryLog, BlockId.CherryLeaves, wx, wz);
              } else if (roll > 0.86) {
                blocks[lx + lz * CHUNK_SIZE + (h + 1) * CHUNK_SIZE * CHUNK_SIZE] = BlockId.CherrySapling;
              }
            } else if (biome === 'Forest') {
              if (roll > 0.964) {
                const isBirch = hash2D(wx + 11, wz - 7, this.numericSeed + 321) > 0.52;
                this.placeTree(
                  blocks,
                  lx,
                  h,
                  lz,
                  isBirch ? BlockId.BirchLog : BlockId.OakLog,
                  isBirch ? BlockId.BirchLeaves : BlockId.OakLeaves,
                  wx,
                  wz
                );
              } else if (roll > 0.955 && h + 5 < CHUNK_HEIGHT) {
                const bh = 3 + Math.floor(hash2D(wx, wz, this.numericSeed + 412) * 3);
                for (let ty = 1; ty <= bh; ty++) {
                  blocks[lx + lz * CHUNK_SIZE + (h + ty) * CHUNK_SIZE * CHUNK_SIZE] = BlockId.BambooBlock;
                }
              } else if (roll > 0.85) {
                blocks[lx + lz * CHUNK_SIZE + (h + 1) * CHUNK_SIZE * CHUNK_SIZE] =
                  roll > 0.93 ? BlockId.Poppy : BlockId.TallGrass;
              }
            } else if (biome === 'Snowy Peaks' && h < 31) {
              if (roll > 0.976) {
                this.placeTree(blocks, lx, h, lz, BlockId.SpruceLog, BlockId.SpruceLeaves, wx, wz);
              }
            } else if (biome === 'Plains' && surfaceBlock === BlockId.Grass) {
              if (roll > 0.988) {
                this.placeTree(blocks, lx, h, lz, BlockId.OakLog, BlockId.OakLeaves, wx, wz);
              } else if (roll > 0.82) {
                const fRoll = hash2D(wx + 5, wz + 9, this.numericSeed + 602);
                blocks[lx + lz * CHUNK_SIZE + (h + 1) * CHUNK_SIZE * CHUNK_SIZE] =
                  fRoll > 0.92 ? BlockId.Poppy : fRoll > 0.84 ? BlockId.Dandelion : BlockId.TallGrass;
              }
            }
          }
        }

        // Ruined Nether Portal landmark in chunk (0, 0)
        if (cx === 0 && cz === 0) {
          const ph = this.computeBaseHeight(10, 10);
          if (ph >= WATER_LEVEL) {
            this.placePortalFrame(blocks, 10, ph + 1, 10, BlockId.NetherPortal);
          }
        }
      }
    }

    // Apply player modifications that belong to this chunk
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    for (const [bKey, blockId] of this.modified.entries()) {
      const parts = bKey.split(',');
      const wx = Number(parts[0]);
      const wy = Number(parts[1]);
      const wz = Number(parts[2]);
      if (
        wx >= minX &&
        wx < minX + CHUNK_SIZE &&
        wz >= minZ &&
        wz < minZ + CHUNK_SIZE &&
        wy >= 0 &&
        wy < CHUNK_HEIGHT
      ) {
        const lx = wx - minX;
        const lz = wz - minZ;
        blocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] = blockId;
      }
    }

    const chunk: ChunkData = { cx, cz, blocks };
    this.chunks.set(key, chunk);
    this.prefetchChunk(cx, cz);
    return chunk;
  }

  public getBlock(wx: number, wy: number, wz: number): BlockId {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.Air;
    const mod = this.modified.get(this.blockKey(wx, wy, wz));
    if (mod !== undefined) return mod;

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.blocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
  }

  private applyBlockLocal(wx: number, wy: number, wz: number, blockId: BlockId): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    this.modified.set(this.blockKey(wx, wy, wz), blockId);

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (chunk) {
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      chunk.blocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] = blockId;
    }
  }

  public setBlock(wx: number, wy: number, wz: number, blockId: BlockId): void {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    this.applyBlockLocal(wx, wy, wz, blockId);

    if (this.worldId) {
      void worldApi.setBlock(this.worldId, this.dimension, wx, wy, wz, blockId).then((res) => {
        if (res.fluidEdits.length > 0) {
          for (const fe of res.fluidEdits) {
            this.applyBlockLocal(fe.wx, fe.wy, fe.wz, fe.blockId as BlockId);
          }
          this.onFluidEdits?.(res.fluidEdits);
        }
      });
    }
  }

  public getModifiedBlocksMap(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.modified.entries()) {
      out[k] = v;
    }
    return out;
  }
}
