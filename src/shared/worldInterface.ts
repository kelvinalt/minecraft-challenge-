import { BiomeType, BlockId, DimensionId, TerrainType } from './types';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 18;

export interface ChunkData {
  cx: number;
  cz: number;
  blocks: Uint8Array; // length = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE
}

/**
 * Shared contract between Frontend Renderer/HUD and Backend World/Chunk Generation.
 */
export interface IWorldProvider {
  readonly seed: string;
  readonly terrainType: TerrainType;
  readonly dimension: DimensionId;
  getChunk(cx: number, cz: number): ChunkData;
  getBlock(wx: number, wy: number, wz: number): BlockId;
  setBlock(wx: number, wy: number, wz: number, blockId: BlockId): void;
  getBiomeAt(wx: number, wz: number): BiomeType;
  getSurfaceHeightAt(wx: number, wz: number): number;
  getModifiedBlocksMap(): Record<string, number>;
}
