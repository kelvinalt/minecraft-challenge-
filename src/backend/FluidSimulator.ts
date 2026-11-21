// Tick-budgeted cellular automata FluidSimulator ported from Minecraft-2hrs (src/backend/fluid/FluidSimulator.js)
import { BLOCK_ID, CHUNK_HEIGHT, isFluidBlock, isFluidReplaceable } from './blockIds.ts';

export interface FluidEdit {
  wx: number;
  wy: number;
  wz: number;
  blockId: number;
}

const HORIZONTAL_DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const ALL_DIRS: readonly [number, number, number][] = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export interface VoxelAccessor {
  getBlock(wx: number, wy: number, wz: number): number;
  setBlock(wx: number, wy: number, wz: number, blockId: number): void;
}

export class ServerFluidSimulator {
  private readonly maxUpdates: number;

  constructor(maxUpdates = 36) {
    this.maxUpdates = maxUpdates;
  }

  /**
   * Evaluates cellular fluid spread around a changed voxel (wx, wy, wz)
   * so digging near Water/Lava or placing fluid naturally floods adjacent air pockets.
   */
  public simulateAround(
    accessor: VoxelAccessor,
    originX: number,
    originY: number,
    originZ: number
  ): FluidEdit[] {
    const queue: [number, number, number][] = [];
    const seen = new Set<string>();
    const edits: FluidEdit[] = [];

    const enqueue = (x: number, y: number, z: number) => {
      if (y < 1 || y >= CHUNK_HEIGHT - 1) return;
      const key = `${x},${y},${z}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push([x, y, z]);
    };

    enqueue(originX, originY, originZ);
    for (const [dx, dy, dz] of ALL_DIRS) {
      enqueue(originX + dx, originY + dy, originZ + dz);
    }

    let steps = 0;
    while (queue.length > 0 && steps < this.maxUpdates) {
      const [wx, wy, wz] = queue.shift()!;
      const curr = accessor.getBlock(wx, wy, wz);
      if (!isFluidBlock(curr)) continue;

      steps += 1;
      const fluidId = curr;
      const maxSpreadDist = fluidId === BLOCK_ID.Lava ? 2 : 4;

      // 1. Always try flowing downward first (gravity waterfall)
      if (wy > 1) {
        const below = accessor.getBlock(wx, wy - 1, wz);
        if (isFluidReplaceable(below)) {
          accessor.setBlock(wx, wy - 1, wz, fluidId);
          edits.push({ wx, wy: wy - 1, wz, blockId: fluidId });
          enqueue(wx, wy - 1, wz);
          continue;
        }
        // Water + Lava interaction -> Obsidian / Cobblestone
        if (
          (fluidId === BLOCK_ID.Water && below === BLOCK_ID.Lava) ||
          (fluidId === BLOCK_ID.Lava && below === BLOCK_ID.Water)
        ) {
          accessor.setBlock(wx, wy - 1, wz, BLOCK_ID.Cobblestone);
          edits.push({ wx, wy: wy - 1, wz, blockId: BLOCK_ID.Cobblestone });
          continue;
        }
      }

      // 2. Bounded horizontal spread over solid ground
      const distFromOrigin = Math.abs(wx - originX) + Math.abs(wz - originZ);
      if (distFromOrigin >= maxSpreadDist) continue;

      for (const [dx, dz] of HORIZONTAL_DIRS) {
        const nx = wx + dx;
        const nz = wz + dz;
        const neighbor = accessor.getBlock(nx, wy, nz);
        if (isFluidReplaceable(neighbor)) {
          accessor.setBlock(nx, wy, nz, fluidId);
          edits.push({ wx: nx, wy, wz: nz, blockId: fluidId });
          enqueue(nx, wy, nz);
        }
      }
    }

    return edits;
  }
}
