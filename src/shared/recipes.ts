import { AnyItemId, BlockId, CraftingRecipe, ItemId } from './types';

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Wood logs -> Planks
  {
    id: 'oak_planks',
    result: { itemId: BlockId.OakPlanks, count: 4 },
    shapeless: [BlockId.OakLog],
    requiresTable: false,
  },
  {
    id: 'birch_planks',
    result: { itemId: BlockId.BirchPlanks, count: 4 },
    shapeless: [BlockId.BirchLog],
    requiresTable: false,
  },
  {
    id: 'spruce_planks',
    result: { itemId: BlockId.SprucePlanks, count: 4 },
    shapeless: [BlockId.SpruceLog],
    requiresTable: false,
  },
  {
    id: 'cherry_planks',
    result: { itemId: BlockId.CherryPlanks, count: 4 },
    shapeless: [BlockId.CherryLog],
    requiresTable: false,
  },
  {
    id: 'bamboo_planks',
    result: { itemId: BlockId.BambooPlanks, count: 2 },
    shapeless: [BlockId.BambooBlock],
    requiresTable: false,
  },

  // Sticks from any planks
  {
    id: 'sticks',
    result: { itemId: ItemId.Stick, count: 4 },
    pattern: [['P'], ['P']],
    key: { P: BlockId.OakPlanks },
    requiresTable: false,
  },
  {
    id: 'sticks_birch',
    result: { itemId: ItemId.Stick, count: 4 },
    pattern: [['P'], ['P']],
    key: { P: BlockId.BirchPlanks },
    requiresTable: false,
  },
  {
    id: 'sticks_spruce',
    result: { itemId: ItemId.Stick, count: 4 },
    pattern: [['P'], ['P']],
    key: { P: BlockId.SprucePlanks },
    requiresTable: false,
  },
  {
    id: 'sticks_cherry',
    result: { itemId: ItemId.Stick, count: 4 },
    pattern: [['P'], ['P']],
    key: { P: BlockId.CherryPlanks },
    requiresTable: false,
  },
  {
    id: 'sticks_bamboo',
    result: { itemId: ItemId.Stick, count: 4 },
    pattern: [['P'], ['P']],
    key: { P: BlockId.BambooPlanks },
    requiresTable: false,
  },

  // Crafting Table from any planks
  {
    id: 'crafting_table',
    result: { itemId: BlockId.CraftingTable, count: 1 },
    pattern: [
      ['P', 'P'],
      ['P', 'P'],
    ],
    key: { P: BlockId.OakPlanks },
    requiresTable: false,
  },
  {
    id: 'crafting_table_birch',
    result: { itemId: BlockId.CraftingTable, count: 1 },
    pattern: [
      ['P', 'P'],
      ['P', 'P'],
    ],
    key: { P: BlockId.BirchPlanks },
    requiresTable: false,
  },
  {
    id: 'crafting_table_spruce',
    result: { itemId: BlockId.CraftingTable, count: 1 },
    pattern: [
      ['P', 'P'],
      ['P', 'P'],
    ],
    key: { P: BlockId.SprucePlanks },
    requiresTable: false,
  },
  {
    id: 'crafting_table_cherry',
    result: { itemId: BlockId.CraftingTable, count: 1 },
    pattern: [
      ['P', 'P'],
      ['P', 'P'],
    ],
    key: { P: BlockId.CherryPlanks },
    requiresTable: false,
  },

  // Torches & Lights
  {
    id: 'torch',
    result: { itemId: BlockId.Torch, count: 4 },
    pattern: [['C'], ['S']],
    key: { C: ItemId.Coal, S: ItemId.Stick },
    requiresTable: false,
  },
  {
    id: 'glowstone',
    result: { itemId: BlockId.Glowstone, count: 1 },
    pattern: [
      ['C', 'G'],
      ['G', 'C'],
    ],
    key: { C: ItemId.Coal, G: ItemId.GoldIngot },
    requiresTable: false,
  },

  // Building variants
  {
    id: 'sandstone',
    result: { itemId: BlockId.Sandstone, count: 1 },
    pattern: [
      ['S', 'S'],
      ['S', 'S'],
    ],
    key: { S: BlockId.Sand },
    requiresTable: false,
  },
  {
    id: 'stone_bricks',
    result: { itemId: BlockId.StoneBricks, count: 4 },
    pattern: [
      ['C', 'C'],
      ['C', 'C'],
    ],
    key: { C: BlockId.Cobblestone },
    requiresTable: false,
  },
  {
    id: 'mossy_cobblestone',
    result: { itemId: BlockId.MossyCobblestone, count: 1 },
    shapeless: [BlockId.Cobblestone, BlockId.TallGrass],
    requiresTable: false,
  },
  {
    id: 'mud_bricks',
    result: { itemId: BlockId.MudBricks, count: 4 },
    pattern: [
      ['D', 'S'],
      ['S', 'D'],
    ],
    key: { D: BlockId.Dirt, S: BlockId.Sand },
    requiresTable: false,
  },
  {
    id: 'glass_from_sand',
    result: { itemId: BlockId.Glass, count: 2 },
    pattern: [
      ['S', 'C'],
      ['C', 'S'],
    ],
    key: { S: BlockId.Sand, C: ItemId.Coal },
    requiresTable: false,
  },
  {
    id: 'bricks',
    result: { itemId: BlockId.Bricks, count: 4 },
    pattern: [
      ['C', 'D'],
      ['D', 'C'],
    ],
    key: { C: BlockId.Cobblestone, D: BlockId.Dirt },
    requiresTable: false,
  },
  {
    id: 'nether_bricks',
    result: { itemId: BlockId.NetherBricks, count: 4 },
    pattern: [
      ['N', 'N'],
      ['N', 'N'],
    ],
    key: { N: BlockId.Netherrack },
    requiresTable: false,
  },
  {
    id: 'purpur_block',
    result: { itemId: BlockId.PurpurBlock, count: 4 },
    pattern: [
      ['E', 'E'],
      ['E', 'E'],
    ],
    key: { E: BlockId.EndStone },
    requiresTable: false,
  },
  {
    id: 'nether_portal',
    result: { itemId: BlockId.NetherPortal, count: 1 },
    pattern: [
      ['O', 'O', 'O'],
      ['O', 'D', 'O'],
      ['O', 'O', 'O'],
    ],
    key: { O: BlockId.Obsidian, D: ItemId.Diamond },
    requiresTable: true,
  },
  {
    id: 'end_portal',
    result: { itemId: BlockId.EndPortal, count: 1 },
    pattern: [
      ['E', 'D', 'E'],
      ['D', 'O', 'D'],
      ['E', 'D', 'E'],
    ],
    key: { E: BlockId.EndStone, D: ItemId.Diamond, O: BlockId.Obsidian },
    requiresTable: true,
  },
  {
    id: 'bookshelf',
    result: { itemId: BlockId.Bookshelf, count: 1 },
    pattern: [
      ['P', 'P', 'P'],
      ['S', 'S', 'S'],
      ['P', 'P', 'P'],
    ],
    key: { P: BlockId.OakPlanks, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'tnt',
    result: { itemId: BlockId.TNT, count: 1 },
    pattern: [
      ['C', 'S', 'C'],
      ['S', 'C', 'S'],
      ['C', 'S', 'C'],
    ],
    key: { C: ItemId.Coal, S: BlockId.Sand },
    requiresTable: true,
  },
  {
    id: 'furnace',
    result: { itemId: BlockId.Furnace, count: 1 },
    pattern: [
      ['C', 'C', 'C'],
      ['C', null, 'C'],
      ['C', 'C', 'C'],
    ],
    key: { C: BlockId.Cobblestone },
    requiresTable: true,
  },

  // Tools
  {
    id: 'wooden_pickaxe',
    result: { itemId: ItemId.WoodenPickaxe, count: 1 },
    pattern: [
      ['P', 'P', 'P'],
      [null, 'S', null],
      [null, 'S', null],
    ],
    key: { P: BlockId.OakPlanks, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'stone_pickaxe',
    result: { itemId: ItemId.StonePickaxe, count: 1 },
    pattern: [
      ['C', 'C', 'C'],
      [null, 'S', null],
      [null, 'S', null],
    ],
    key: { C: BlockId.Cobblestone, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'iron_pickaxe',
    result: { itemId: ItemId.IronPickaxe, count: 1 },
    pattern: [
      ['I', 'I', 'I'],
      [null, 'S', null],
      [null, 'S', null],
    ],
    key: { I: ItemId.IronIngot, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'diamond_pickaxe',
    result: { itemId: ItemId.DiamondPickaxe, count: 1 },
    pattern: [
      ['D', 'D', 'D'],
      [null, 'S', null],
      [null, 'S', null],
    ],
    key: { D: ItemId.Diamond, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'wooden_axe',
    result: { itemId: ItemId.WoodenAxe, count: 1 },
    pattern: [
      ['P', 'P'],
      ['P', 'S'],
      [null, 'S'],
    ],
    key: { P: BlockId.OakPlanks, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'stone_axe',
    result: { itemId: ItemId.StoneAxe, count: 1 },
    pattern: [
      ['C', 'C'],
      ['C', 'S'],
      [null, 'S'],
    ],
    key: { C: BlockId.Cobblestone, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'wooden_sword',
    result: { itemId: ItemId.WoodenSword, count: 1 },
    pattern: [['P'], ['P'], ['S']],
    key: { P: BlockId.OakPlanks, S: ItemId.Stick },
    requiresTable: true,
  },
  {
    id: 'stone_sword',
    result: { itemId: ItemId.StoneSword, count: 1 },
    pattern: [['C'], ['C'], ['S']],
    key: { C: BlockId.Cobblestone, S: ItemId.Stick },
    requiresTable: true,
  },
];

export function matchCraftingRecipe(
  grid: (AnyItemId | null)[],
  gridSize: 2 | 3
): CraftingRecipe | null {
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;
  const presentItems: AnyItemId[] = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const id = grid[r * gridSize + c];
      if (id !== null && id !== undefined) {
        presentItems.push(id);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (presentItems.length === 0) return null;

  const trimmedH = maxR - minR + 1;
  const trimmedW = maxC - minC + 1;

  for (const recipe of CRAFTING_RECIPES) {
    if (gridSize === 2 && recipe.requiresTable) continue;

    if (recipe.shapeless) {
      if (presentItems.length !== recipe.shapeless.length) continue;
      const a = [...presentItems].sort((x, y) => x - y);
      const b = [...recipe.shapeless].sort((x, y) => x - y);
      if (a.every((val, idx) => val === b[idx])) {
        return recipe;
      }
      continue;
    }

    if (recipe.pattern && recipe.key) {
      const patH = recipe.pattern.length;
      const patW = recipe.pattern[0].length;
      if (patH !== trimmedH || patW !== trimmedW) continue;

      let matches = true;
      for (let r = 0; r < patH; r++) {
        for (let c = 0; c < patW; c++) {
          const sym = recipe.pattern[r][c];
          const expected = sym ? recipe.key[sym] : null;
          const actual = grid[(minR + r) * gridSize + (minC + c)] ?? null;
          if (expected !== actual) {
            matches = false;
            break;
          }
        }
        if (!matches) break;
      }
      if (matches) return recipe;
    }
  }

  return null;
}
