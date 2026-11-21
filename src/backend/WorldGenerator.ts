import type { BiomeType, DimensionId, TerrainType } from '../shared/types.ts';
import { BLOCK_ID, CHUNK_HEIGHT, CHUNK_SIZE, WATER_LEVEL } from './blockIds.ts';
import { SimplexNoise } from './Noise.ts';

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

export class ServerWorldGenerator {
  public readonly seed: string;
  public readonly terrainType: TerrainType;
  public readonly dimension: DimensionId;
  private readonly numericSeed: number;
  private readonly caveNoise: SimplexNoise;
  private readonly gravelNoise: SimplexNoise;

  constructor(seed: string, terrainType: TerrainType, dimension: DimensionId = 'overworld') {
    this.seed = seed || 'BlockCraft';
    this.terrainType = terrainType;
    this.dimension = dimension;
    this.numericSeed = hashString(this.seed);
    this.caveNoise = new SimplexNoise(this.numericSeed + 808);
    this.gravelNoise = new SimplexNoise(this.numericSeed + 303);
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
      return -1;
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

  private placePortalFrame(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
    portalBlock: number
  ) {
    if (lx < 2 || lx > CHUNK_SIZE - 4 || lz < 1 || lz > CHUNK_SIZE - 2 || baseY + 5 >= CHUNK_HEIGHT) {
      return;
    }
    const set = (x: number, y: number, z: number, id: number) => {
      blocks[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = id;
    };
    for (let dx = 0; dx < 4; dx++) {
      set(lx + dx, baseY, lz, BLOCK_ID.Obsidian);
      set(lx + dx, baseY + 4, lz, BLOCK_ID.Obsidian);
    }
    for (let dy = 1; dy < 4; dy++) {
      set(lx, baseY + dy, lz, BLOCK_ID.Obsidian);
      set(lx + 3, baseY + dy, lz, BLOCK_ID.Obsidian);
      set(lx + 1, baseY + dy, lz, portalBlock);
      set(lx + 2, baseY + dy, lz, portalBlock);
    }
  }

  private placeTree(
    blocks: Uint8Array,
    lx: number,
    h: number,
    lz: number,
    logId: number,
    leafId: number,
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
          if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE || by >= CHUNK_HEIGHT) {
            continue;
          }
          const idx = bx + bz * CHUNK_SIZE + by * CHUNK_SIZE * CHUNK_SIZE;
          if (blocks[idx] === BLOCK_ID.Air) {
            blocks[idx] = leafId;
          }
        }
      }
    }
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
          let block: number = BLOCK_ID.Air;

          if (y === 0 || y === CHUNK_HEIGHT - 1) {
            block = BLOCK_ID.Bedrock;
          } else if (y <= floorH) {
            if (distSpawn < 5 && y >= floorH - 1) {
              block = BLOCK_ID.NetherBricks;
            } else if (y === floorH && biome === 'Soul Sand Valley' && floorH > LAVA_LEVEL) {
              block = BLOCK_ID.SoulSand;
            } else if (y === floorH && hash2D(wx, wz, this.numericSeed + 123) > 0.96) {
              block = BLOCK_ID.GoldOre;
            } else {
              block = BLOCK_ID.Netherrack;
            }
          } else if (y <= LAVA_LEVEL) {
            block = BLOCK_ID.Lava;
          } else if (y >= ceilY) {
            if (y === ceilY && hash2D(wx * 3, wz * 5, this.numericSeed + 555) > 0.94) {
              block = BLOCK_ID.Glowstone;
            } else {
              block = BLOCK_ID.Netherrack;
            }
          }

          blocks[idx] = block;
        }
      }
    }

    if (cx === 0 && cz === 0) {
      this.placePortalFrame(blocks, 10, 20, 10, BLOCK_ID.NetherPortal);
    }
  }

  private generateEndChunk(cx: number, cz: number, blocks: Uint8Array) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const topY = this.computeBaseHeight(wx, wz);
        if (topY < 0) continue;

        const bottomY = Math.max(
          8,
          topY - 6 - Math.floor(hash2D(wx, wz, this.numericSeed + 41) * 4)
        );
        for (let y = bottomY; y <= topY; y++) {
          blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = BLOCK_ID.EndStone;
        }

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
                  wx === px && wz === pz && y === topY + pHeight
                    ? BLOCK_ID.Glowstone
                    : BLOCK_ID.Obsidian;
              }
            }
          }
        }

        if (Math.hypot(wx, wz) > 35 && hash2D(wx, wz, this.numericSeed + 909) > 0.992) {
          for (let y = topY + 1; y <= Math.min(CHUNK_HEIGHT - 2, topY + 6); y++) {
            blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] =
              y === topY + 6 ? BLOCK_ID.Glowstone : BLOCK_ID.PurpurBlock;
          }
        }
      }
    }

    if (cx === 0 && cz === 0) {
      const sy = this.computeBaseHeight(6, 6);
      if (sy > 0) {
        this.placePortalFrame(blocks, 6, sy + 1, 6, BLOCK_ID.EndPortal);
      }
    }
  }

  public generateChunk(
    cx: number,
    cz: number,
    modifiedBlocks?: Record<string, number>
  ): Uint8Array {
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
            let block: number = BLOCK_ID.Air;

            if (y === 0) {
              block = BLOCK_ID.Bedrock;
            } else if (y <= h) {
              // Carve 3D Simplex worm caves below the surface (preserving bedrock, spawn area & ocean floor)
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
                block = BLOCK_ID.Air;
              } else if (y === h) {
                if (h < WATER_LEVEL) {
                  block = h < WATER_LEVEL - 1 && shoreRoll > 0.48 ? BLOCK_ID.Gravel : BLOCK_ID.Sand;
                } else if (biome === 'Desert') {
                  block = BLOCK_ID.Sand;
                } else if (biome === 'Snowy Peaks' && h >= 29) {
                  block =
                    h >= 36 && hash2D(wx, wz, this.numericSeed + 88) > 0.72
                      ? BLOCK_ID.Ice
                      : gravelPatch && h < 34
                      ? BLOCK_ID.Gravel
                      : BLOCK_ID.Snow;
                } else if (h <= WATER_LEVEL + 1) {
                  block = BLOCK_ID.Sand;
                } else if (gravelPatch && biome === 'Plains' && h >= 29) {
                  block = BLOCK_ID.Gravel;
                } else {
                  block = BLOCK_ID.Grass;
                }
              } else if (y >= h - 3) {
                if (biome === 'Desert') {
                  block = y >= h - 2 ? BLOCK_ID.Sand : BLOCK_ID.Sandstone;
                } else if (h < WATER_LEVEL) {
                  block = h < WATER_LEVEL - 1 ? BLOCK_ID.Gravel : BLOCK_ID.Sand;
                } else {
                  block = BLOCK_ID.Dirt;
                }
              } else {
                const oreHash = hash2D(wx * 31 + y, wz * 17 - y, this.numericSeed + y * 13);
                if (y <= 8) {
                  if (oreHash > 0.991) block = BLOCK_ID.DiamondOre;
                  else if (oreHash > 0.982) block = BLOCK_ID.AmethystBlock;
                  else if (oreHash > 0.968) block = BLOCK_ID.GoldOre;
                  else block = BLOCK_ID.Deepslate;
                } else {
                  if (y < 14 && oreHash > 0.992) block = BLOCK_ID.DiamondOre;
                  else if (y < 20 && oreHash > 0.985) block = BLOCK_ID.GoldOre;
                  else if (y < 26 && oreHash > 0.974) block = BLOCK_ID.CopperBlock;
                  else if (y < 28 && oreHash > 0.958) block = BLOCK_ID.IronOre;
                  else if (oreHash > 0.94) block = BLOCK_ID.CoalOre;
                  else block = BLOCK_ID.Stone;
                }
              }
            } else if (y <= WATER_LEVEL && this.terrainType !== 'flat') {
              block = BLOCK_ID.Water;
            }

            blocks[idx] = block;
          }
        }
      }

      if (this.terrainType !== 'flat') {
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
          for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;
            if (Math.hypot(wx, wz) < 5) continue;
            const h = this.computeBaseHeight(wx, wz);
            if (h <= WATER_LEVEL + 1 || h + 2 >= CHUNK_HEIGHT) continue;
            const surfaceBlock = blocks[lx + lz * CHUNK_SIZE + h * CHUNK_SIZE * CHUNK_SIZE];
            const biome = this.getBiomeAt(wx, wz);

            if (biome === 'Desert' && surfaceBlock === BLOCK_ID.Sand) {
              const cactusRoll = hash2D(wx, wz, this.numericSeed + 2411);
              if (cactusRoll < 0.012 && h + 4 < CHUNK_HEIGHT) {
                const cactusHeight = 2 + Math.floor(hash2D(wx, wz, this.numericSeed + 2477) * 2);
                for (let ch = 1; ch <= cactusHeight; ch++) {
                  blocks[lx + lz * CHUNK_SIZE + (h + ch) * CHUNK_SIZE * CHUNK_SIZE] = BLOCK_ID.Cactus;
                }
              }
              continue;
            }

            if (surfaceBlock !== BLOCK_ID.Grass && surfaceBlock !== BLOCK_ID.Snow) continue;

            const roll = hash2D(wx, wz, this.numericSeed + 999);

            if (biome === 'Cherry Grove') {
              if (roll > 0.968) {
                this.placeTree(
                  blocks,
                  lx,
                  h,
                  lz,
                  BLOCK_ID.CherryLog,
                  BLOCK_ID.CherryLeaves,
                  wx,
                  wz
                );
              } else if (roll > 0.86) {
                blocks[lx + lz * CHUNK_SIZE + (h + 1) * CHUNK_SIZE * CHUNK_SIZE] =
                  BLOCK_ID.CherrySapling;
              }
            } else if (biome === 'Forest') {
              if (roll > 0.964) {
                const isBirch = hash2D(wx + 11, wz - 7, this.numericSeed + 321) > 0.52;
                this.placeTree(
                  blocks,
                  lx,
                  h,
                  lz,
                  isBirch ? BLOCK_ID.BirchLog : BLOCK_ID.OakLog,
                  isBirch ? BLOCK_ID.BirchLeaves : BLOCK_ID.OakLeaves,
                  wx,
                  wz
                );
              } else if (roll > 0.955 && h + 5 < CHUNK_HEIGHT) {
                const bh = 3 + Math.floor(hash2D(wx, wz, this.numericSeed + 412) * 3);
                for (let ty = 1; ty <= bh; ty++) {
                  blocks[lx + lz * CHUNK_SIZE + (h + ty) * CHUNK_SIZE * CHUNK_SIZE] =
                    BLOCK_ID.BambooBlock;
                }
              } else if (roll > 0.85) {
                blocks[lx + lz * CHUNK_SIZE + (h + 1) * CHUNK_SIZE * CHUNK_SIZE] =
                  roll > 0.93 ? BLOCK_ID.Poppy : BLOCK_ID.TallGrass;
              }
            } else if (biome === 'Snowy Peaks' && h < 31) {
              if (roll > 0.976) {
                this.placeTree(
                  blocks,
                  lx,
                  h,
                  lz,
                  BLOCK_ID.SpruceLog,
                  BLOCK_ID.SpruceLeaves,
                  wx,
                  wz
                );
              }
            } else if (biome === 'Plains' && surfaceBlock === BLOCK_ID.Grass) {
              if (roll > 0.988) {
                this.placeTree(blocks, lx, h, lz, BLOCK_ID.OakLog, BLOCK_ID.OakLeaves, wx, wz);
              } else if (roll > 0.82) {
                const fRoll = hash2D(wx + 5, wz + 9, this.numericSeed + 602);
                blocks[lx + lz * CHUNK_SIZE + (h + 1) * CHUNK_SIZE * CHUNK_SIZE] =
                  fRoll > 0.92
                    ? BLOCK_ID.Poppy
                    : fRoll > 0.84
                    ? BLOCK_ID.Dandelion
                    : BLOCK_ID.TallGrass;
              }
            }
          }
        }

        if (cx === 0 && cz === 0) {
          const ph = this.computeBaseHeight(10, 10);
          if (ph >= WATER_LEVEL) {
            this.placePortalFrame(blocks, 10, ph + 1, 10, BLOCK_ID.NetherPortal);
          }
        }
      }
    }

    if (modifiedBlocks) {
      const minX = cx * CHUNK_SIZE;
      const minZ = cz * CHUNK_SIZE;
      for (const [bKey, blockId] of Object.entries(modifiedBlocks)) {
        const parts = bKey.split(',');
        const wx = Number(parts[0]);
        const wy = Number(parts[1]);
        const wz = Number(parts[2]);
        if (
          Number.isInteger(wx) &&
          Number.isInteger(wy) &&
          Number.isInteger(wz) &&
          wx >= minX &&
          wx < minX + CHUNK_SIZE &&
          wz >= minZ &&
          wz < minZ + CHUNK_SIZE &&
          wy >= 0 &&
          wy < CHUNK_HEIGHT
        ) {
          const lx = wx - minX;
          const lz = wz - minZ;
          blocks[lx + lz * CHUNK_SIZE + wy * CHUNK_SIZE * CHUNK_SIZE] = blockId & 0xff;
        }
      }
    }

    return blocks;
  }

  public getSurfaceHeightInChunk(chunkBlocks: Uint8Array, lx: number, lz: number): number {
    const maxCheck = this.dimension === 'nether' ? 38 : CHUNK_HEIGHT - 1;
    for (let y = maxCheck; y >= 0; y--) {
      const b = chunkBlocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE];
      if (
        b !== BLOCK_ID.Air &&
        b !== BLOCK_ID.OakLeaves &&
        b !== BLOCK_ID.BirchLeaves &&
        b !== BLOCK_ID.SpruceLeaves &&
        b !== BLOCK_ID.CherryLeaves &&
        b !== BLOCK_ID.TallGrass &&
        b !== BLOCK_ID.Poppy &&
        b !== BLOCK_ID.Dandelion &&
        b !== BLOCK_ID.CherrySapling
      ) {
        return y;
      }
    }
    return this.dimension === 'nether' ? 19 : 21;
  }

  public getSurfaceHeightAt(wx: number, wz: number): number {
    if (this.dimension === 'end') {
      const h = this.computeBaseHeight(wx, wz);
      return h > 0 ? h : 18;
    }
    if (this.dimension === 'nether') {
      return Math.max(13, this.computeBaseHeight(wx, wz));
    }
    return Math.max(WATER_LEVEL, this.computeBaseHeight(wx, wz));
  }
}
