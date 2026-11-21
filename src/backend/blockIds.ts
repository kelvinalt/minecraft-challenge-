import type { BiomeType, DimensionId, TerrainType } from '../shared/types.ts';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const WATER_LEVEL = 18;

export const BLOCK_ID = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Cobblestone: 4,
  OakLog: 5,
  OakPlanks: 6,
  OakLeaves: 7,
  Sand: 8,
  Sandstone: 9,
  Water: 10,
  Glass: 11,
  CoalOre: 12,
  IronOre: 13,
  GoldOre: 14,
  DiamondOre: 15,
  CraftingTable: 16,
  Furnace: 17,
  Bricks: 18,
  Snow: 19,
  Bedrock: 20,
  Torch: 21,
  RedWool: 22,
  BlueWool: 23,
  Glowstone: 24,
  BirchLog: 25,
  BirchPlanks: 26,
  BirchLeaves: 27,
  SpruceLog: 28,
  SprucePlanks: 29,
  SpruceLeaves: 30,
  CherryLog: 31,
  CherryPlanks: 32,
  CherryLeaves: 33,
  BambooBlock: 34,
  BambooPlanks: 35,
  Deepslate: 36,
  CobbledDeepslate: 37,
  StoneBricks: 38,
  MossyCobblestone: 39,
  Obsidian: 40,
  Netherrack: 41,
  NetherBricks: 42,
  SoulSand: 43,
  Lava: 44,
  EndStone: 45,
  PurpurBlock: 46,
  AmethystBlock: 47,
  CopperBlock: 48,
  MudBricks: 49,
  Bookshelf: 50,
  TNT: 51,
  Ice: 52,
  YellowWool: 53,
  GreenWool: 54,
  WhiteWool: 55,
  TallGrass: 56,
  Poppy: 57,
  Dandelion: 58,
  CherrySapling: 59,
  NetherPortal: 60,
  EndPortal: 61,
  Gravel: 62,
  Cactus: 63,
} as const;

export const ITEM_ID = {
  Stick: 101,
  Coal: 102,
  IronIngot: 103,
  GoldIngot: 104,
  Diamond: 105,
  AmethystShard: 106,
  CopperIngot: 107,
  Apple: 120,
} as const;

export const CROSS_PLANE_IDS = new Set<number>([
  BLOCK_ID.Torch,
  BLOCK_ID.TallGrass,
  BLOCK_ID.Poppy,
  BLOCK_ID.Dandelion,
  BLOCK_ID.CherrySapling,
]);

export function isFluidBlock(id: number): boolean {
  return id === BLOCK_ID.Water || id === BLOCK_ID.Lava;
}

export function isFluidReplaceable(id: number): boolean {
  return id === BLOCK_ID.Air || CROSS_PLANE_IDS.has(id);
}

export const VALID_DIMENSIONS: readonly DimensionId[] = ['overworld', 'nether', 'end'];
export const VALID_TERRAIN_TYPES: readonly TerrainType[] = ['normal', 'flat', 'islands'];
export const VALID_BIOMES: readonly BiomeType[] = [
  'Plains',
  'Forest',
  'Cherry Grove',
  'Desert',
  'Snowy Peaks',
  'Ocean',
  'Nether Wastes',
  'Soul Sand Valley',
  'The End',
];
