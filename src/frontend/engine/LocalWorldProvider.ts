import { BiomeType, BlockId, TerrainType } from '../../shared/types';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  ChunkData,
  IWorldProvider,
  WATER_LEVEL,
} from '../../shared/worldInterface';

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
  private readonly numericSeed: number;
  private chunks = new Map<string, ChunkData>();
  private modified = new Map<string, BlockId>();

  constructor(seed: string, terrainType: TerrainType, initialModified?: Record<string, number>) {
    this.seed = seed || 'BlockCraft';
    this.terrainType = terrainType;
    this.numericSeed = hashString(this.seed);
    if (initialModified) {
      for (const [k, v] of Object.entries(initialModified)) {
        this.modified.set(k, v as BlockId);
      }
    }
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private blockKey(wx: number, wy: number, wz: number): string {
    return `${wx},${wy},${wz}`;
  }

  public getBiomeAt(wx: number, wz: number): BiomeType {
    if (this.terrainType === 'flat') return 'Plains';
    const temp = fbm2D(wx * 0.008, wz * 0.008, this.numericSeed + 411, 3);
    const moist = fbm2D(wx * 0.008, wz * 0.008, this.numericSeed + 823, 3);
    const h = this.computeBaseHeight(wx, wz);
    if (h < WATER_LEVEL - 1) return 'Ocean';
    if (h > 34 || temp < 0.28) return 'Snowy Peaks';
    if (temp > 0.68 && moist < 0.48) return 'Desert';
    if (moist > 0.54) return 'Forest';
    return 'Plains';
  }

  private computeBaseHeight(wx: number, wz: number): number {
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

    // Normal varied terrain with gentle spawn plateau near (0,0)
    const mountainFactor = Math.max(0, ridge - 0.52) * 32;
    const rawHeight = 16 + continental * 12 + mountainFactor + detail * 3;
    const spawnDist = Math.hypot(wx, wz);
    if (spawnDist < 12) {
      const blend = Math.max(0, (spawnDist - 4) / 8);
      return Math.floor(22 * (1 - blend) + rawHeight * blend);
    }
    return Math.min(CHUNK_HEIGHT - 10, Math.max(6, Math.floor(rawHeight)));
  }

  public getSurfaceHeightAt(wx: number, wz: number): number {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const b = chunk.blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE];
      if (b !== BlockId.Air && b !== BlockId.OakLeaves) {
        return y;
      }
    }
    return 20;
  }

  public getChunk(cx: number, cz: number): ChunkData {
    const key = this.chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = this.computeBaseHeight(wx, wz);
        const biome = this.getBiomeAt(wx, wz);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
          let block = BlockId.Air;

          if (y === 0) {
            block = BlockId.Bedrock;
          } else if (y <= h) {
            if (y === h) {
              if (h < WATER_LEVEL) {
                block = BlockId.Sand;
              } else if (biome === 'Desert') {
                block = BlockId.Sand;
              } else if (biome === 'Snowy Peaks' && h >= 29) {
                block = BlockId.Snow;
              } else if (h <= WATER_LEVEL + 1) {
                block = BlockId.Sand;
              } else {
                block = BlockId.Grass;
              }
            } else if (y >= h - 3) {
              if (biome === 'Desert') {
                block = y >= h - 2 ? BlockId.Sand : BlockId.Sandstone;
              } else if (h < WATER_LEVEL) {
                block = BlockId.Sand;
              } else {
                block = BlockId.Dirt;
              }
            } else {
              // Stone + procedural ore veins
              const oreHash = hash2D(wx * 31 + y, wz * 17 - y, this.numericSeed + y * 13);
              if (y < 14 && oreHash > 0.992) {
                block = BlockId.DiamondOre;
              } else if (y < 20 && oreHash > 0.985) {
                block = BlockId.GoldOre;
              } else if (y < 28 && oreHash > 0.968) {
                block = BlockId.IronOre;
              } else if (oreHash > 0.945) {
                block = BlockId.CoalOre;
              } else {
                block = BlockId.Stone;
              }
            }
          } else if (y <= WATER_LEVEL && this.terrainType !== 'flat') {
            block = BlockId.Water;
          }

          blocks[idx] = block;
        }
      }
    }

    // Place procedural trees (avoiding chunk edges slightly so canopies stay crisp inside chunk)
    if (this.terrainType !== 'flat') {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          if (Math.hypot(wx, wz) < 5) continue; // Keep spawn clear
          const h = this.computeBaseHeight(wx, wz);
          if (h <= WATER_LEVEL + 1) continue;
          const biome = this.getBiomeAt(wx, wz);
          if (biome !== 'Forest' && biome !== 'Plains') continue;

          const treeProb = biome === 'Forest' ? 0.968 : 0.989;
          const roll = hash2D(wx, wz, this.numericSeed + 999);
          if (roll > treeProb && h + 7 < CHUNK_HEIGHT) {
            const trunkH = 4 + Math.floor(hash2D(wx + 3, wz - 5, this.numericSeed) * 2);
            for (let ty = 1; ty <= trunkH; ty++) {
              blocks[lx + lz * CHUNK_SIZE + (h + ty) * CHUNK_SIZE * CHUNK_SIZE] = BlockId.OakLog;
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
                    blocks[idx] = BlockId.OakLeaves;
                  }
                }
              }
            }
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
      if (wx >= minX && wx < minX + CHUNK_SIZE && wz >= minZ && wz < minZ + CHUNK_SIZE && wy >= 0 && wy < CHUNK_HEIGHT) {
        const lx = wx - minX;
        const lz = wz - minZ;
        blocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] = blockId;
      }
    }

    const chunk: ChunkData = { cx, cz, blocks };
    this.chunks.set(key, chunk);
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

  public setBlock(wx: number, wy: number, wz: number, blockId: BlockId): void {
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

  public getModifiedBlocksMap(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.modified.entries()) {
      out[k] = v;
    }
    return out;
  }
}
