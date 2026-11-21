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
export type DimensionId = 'overworld' | 'nether' | 'end';

export type BiomeType =
  | 'Plains'
  | 'Forest'
  | 'Cherry Grove'
  | 'Desert'
  | 'Snowy Peaks'
  | 'Ocean'
  | 'Nether Wastes'
  | 'Soul Sand Valley'
  | 'The End';

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
  Glowstone = 24,
  BirchLog = 25,
  BirchPlanks = 26,
  BirchLeaves = 27,
  SpruceLog = 28,
  SprucePlanks = 29,
  SpruceLeaves = 30,
  CherryLog = 31,
  CherryPlanks = 32,
  CherryLeaves = 33,
  BambooBlock = 34,
  BambooPlanks = 35,
  Deepslate = 36,
  CobbledDeepslate = 37,
  StoneBricks = 38,
  MossyCobblestone = 39,
  Obsidian = 40,
  Netherrack = 41,
  NetherBricks = 42,
  SoulSand = 43,
  Lava = 44,
  EndStone = 45,
  PurpurBlock = 46,
  AmethystBlock = 47,
  CopperBlock = 48,
  MudBricks = 49,
  Bookshelf = 50,
  TNT = 51,
  Ice = 52,
  YellowWool = 53,
  GreenWool = 54,
  WhiteWool = 55,
  TallGrass = 56,
  Poppy = 57,
  Dandelion = 58,
  CherrySapling = 59,
  NetherPortal = 60,
  EndPortal = 61,
  Gravel = 62,
  Cactus = 63,
}

export enum ItemId {
  Stick = 101,
  Coal = 102,
  IronIngot = 103,
  GoldIngot = 104,
  Diamond = 105,
  AmethystShard = 106,
  CopperIngot = 107,
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
  hardness?: number;
  transparent?: boolean;
  solid?: boolean;
  liquid?: boolean;
  isCrossPlane?: boolean; // X-shaped crossed-plane geometry (flowers, tall grass, torches, saplings)
  emissive?: boolean;
  dropId?: AnyItemId;
  dropCount?: number;
  foodValue?: number;
  saturation?: number;
  toolType?: 'pickaxe' | 'axe' | 'shovel' | 'sword';
  toolPower?: number;
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
  dimension?: DimensionId;
  createdAt: number;
  lastPlayedAt: number;
  modifiedBlocks?: Record<string, number>;
  modifiedBlocksByDim?: Partial<Record<DimensionId, Record<string, number>>>;
  playerPosition?: [number, number, number];
  inventory?: (InventorySlot | null)[];
  health?: number;
  hunger?: number;
  selectedSlot?: number;
  timeOfDay?: number;
}

export interface GameSettings {
  fov: number;
  renderDistance: number;
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
  dimension: DimensionId;
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
  pattern?: (string | null)[][];
  key?: Record<string, AnyItemId>;
  shapeless?: AnyItemId[];
  requiresTable: boolean;
}

export type MobType = 'sheep' | 'cow' | 'zombie' | 'slime';

export interface MobEntityDto {
  id: number;
  type: MobType;
  name: string;
  category: 'passive' | 'hostile';
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  hurtTimer: number;
  walkPhase: number;
  palette: { primary: number; secondary: number; accent: number };
}
