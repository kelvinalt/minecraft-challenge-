export type ScreenState =
  | 'main_menu'
  | 'world_select'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'inventory'
  | 'settings';

export type GameMode = 'survival' | 'creative';
export type TerrainType = 'normal' | 'flat' | 'islands';

export type BiomeType = 'Plains' | 'Forest' | 'Desert' | 'Snowy Peaks' | 'Ocean';

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  OakLog = 5,
  OakPlanks = 6,
  OakLeaves = 7,
  Sand = 8,
  Sandstone = 9,
  Water = 10,
  Glass = 11,
  CoalOre = 12,
  IronOre = 13,
  GoldOre = 14,
  DiamondOre = 15,
  CraftingTable = 16,
  Furnace = 17,
  Bricks = 18,
  Snow = 19,
  Bedrock = 20,
  Torch = 21,
  RedWool = 22,
  BlueWool = 23,
}

export enum ItemId {
  // Blocks share numeric IDs 1..99
  Stick = 101,
  Coal = 102,
  IronIngot = 103,
  GoldIngot = 104,
  Diamond = 105,
  WoodenPickaxe = 110,
  StonePickaxe = 111,
  IronPickaxe = 112,
  DiamondPickaxe = 113,
  WoodenAxe = 114,
  StoneAxe = 115,
  WoodenSword = 116,
  StoneSword = 117,
  Apple = 120,
  Bread = 121,
}

export type AnyItemId = BlockId | ItemId;

export type ItemCategory =
  | 'building'
  | 'natural'
  | 'functional'
  | 'tool'
  | 'material'
  | 'food';

export interface ItemDefinition {
  id: AnyItemId;
  name: string;
  isBlock: boolean;
  category: ItemCategory;
  stackSize: number;
  hardness?: number; // seconds to break by hand
  transparent?: boolean;
  solid?: boolean;
  liquid?: boolean;
  dropId?: AnyItemId;
  dropCount?: number;
  foodValue?: number; // hunger points restored (out of 20)
  saturation?: number;
  toolType?: 'pickaxe' | 'axe' | 'shovel' | 'sword';
  toolPower?: number; // multiplier on break speed
  maxDurability?: number;
  preferredTool?: 'pickaxe' | 'axe' | 'shovel';
  lightLevel?: number;
}

export interface InventorySlot {
  itemId: AnyItemId;
  count: number;
  durability?: number;
}

export interface WorldConfig {
  id: string;
  name: string;
  seed: string;
  gameMode: GameMode;
  terrainType: TerrainType;
  createdAt: number;
  lastPlayedAt: number;
  modifiedBlocks?: Record<string, number>; // "x,y,z" -> BlockId
  playerPosition?: [number, number, number];
  inventory?: (InventorySlot | null)[];
  health?: number;
  hunger?: number;
  selectedSlot?: number;
  timeOfDay?: number;
}

export interface GameSettings {
  fov: number;
  renderDistance: number; // in chunks (radius)
  mouseSensitivity: number;
  invertY: boolean;
  masterVolume: number;
  showDebugHud: boolean;
  showControlsHint: boolean;
  shadowsEnabled: boolean;
  touchControls: boolean;
}

export interface RaycastHit {
  blockPos: [number, number, number];
  normal: [number, number, number];
  placePos: [number, number, number];
  blockId: BlockId;
  distance: number;
}

export interface DebugTelemetry {
  fps: number;
  position: [number, number, number];
  chunk: [number, number];
  facing: string;
  yawDeg: number;
  pitchDeg: number;
  biome: BiomeType;
  targetBlock: string | null;
  targetCoords: [number, number, number] | null;
  timeOfDayLabel: string;
  dayCount: number;
  loadedChunks: number;
  isGrounded: boolean;
  isFlying: boolean;
  isSubmerged: boolean;
}

export interface CraftingRecipe {
  id: string;
  result: { itemId: AnyItemId; count: number };
  // 2x2 or 3x3 pattern using single chars or null for empty; or shapeless list
  pattern?: (string | null)[][];
  key?: Record<string, AnyItemId>;
  shapeless?: AnyItemId[];
  requiresTable: boolean;
}
