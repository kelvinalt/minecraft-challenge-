import * as THREE from 'three';
import { AnyItemId, BlockId, ItemId } from '../../shared/types';
import { getItemDef } from '../../shared/blocks';

/**
 * Tile indices inside our 8x8 procedural 16px-per-tile texture atlas (128x128px).
 */
export enum TileId {
  GrassTop = 0,
  GrassSide = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  OakLogTop = 5,
  OakLogSide = 6,
  OakPlanks = 7,
  OakLeaves = 8,
  Sand = 9,
  Sandstone = 10,
  Water = 11,
  Glass = 12,
  CoalOre = 13,
  IronOre = 14,
  GoldOre = 15,
  DiamondOre = 16,
  CraftingTop = 17,
  CraftingSide = 18,
  FurnaceFront = 19,
  FurnaceSide = 20,
  Bricks = 21,
  Snow = 22,
  Bedrock = 23,
  Glowstone = 24,
  RedWool = 25,
  BlueWool = 26,
}

export const ATLAS_GRID = 8; // 8x8 tiles
export const TILE_PX = 16;

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawPixelTile(
  ctx: CanvasRenderingContext2D,
  tileIndex: number,
  drawFn: (px: (x: number, y: number, color: string) => void) => void
) {
  const tx = (tileIndex % ATLAS_GRID) * TILE_PX;
  const ty = Math.floor(tileIndex / ATLAS_GRID) * TILE_PX;
  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(tx + x, ty + y, 1, 1);
  };
  drawFn(px);
}

function noisyFill(
  px: (x: number, y: number, c: string) => void,
  palette: string[],
  seed: number
) {
  const rand = seededRand(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      px(x, y, palette[Math.floor(rand() * palette.length)]);
    }
  }
}

function oreFill(
  px: (x: number, y: number, c: string) => void,
  orePalette: string[],
  seed: number
) {
  noisyFill(px, ['#7d7d7d', '#868686', '#727272', '#6b6b6b', '#8d8d8d'], 303);
  const rand = seededRand(seed);
  const spots = [
    [3, 3], [4, 3], [3, 4],
    [10, 4], [11, 4], [11, 5],
    [5, 10], [6, 10], [6, 11], [7, 11],
    [12, 11], [12, 12], [11, 12],
    [2, 8], [3, 8],
  ];
  for (const [sx, sy] of spots) {
    px(sx, sy, orePalette[Math.floor(rand() * orePalette.length)]);
  }
}

export interface AtlasBundle {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
}

let cachedAtlasCanvas: HTMLCanvasElement | null = null;
const iconCache = new Map<number, string>();

export function buildAtlasCanvas(): HTMLCanvasElement {
  if (cachedAtlasCanvas) return cachedAtlasCanvas;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_GRID * TILE_PX;
  canvas.height = ATLAS_GRID * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Grass Top
  drawPixelTile(ctx, TileId.GrassTop, (px) => {
    noisyFill(px, ['#5b9b37', '#67a93f', '#4e8a2e', '#6db145', '#559333'], 101);
  });

  // Dirt
  drawPixelTile(ctx, TileId.Dirt, (px) => {
    noisyFill(px, ['#865d3b', '#795232', '#916744', '#6f4a2b', '#8a603e'], 202);
  });

  // Grass Side
  drawPixelTile(ctx, TileId.GrassSide, (px) => {
    noisyFill(px, ['#865d3b', '#795232', '#916744', '#6f4a2b'], 202);
    const rand = seededRand(105);
    const grass = ['#5b9b37', '#67a93f', '#4e8a2e', '#6db145'];
    for (let x = 0; x < 16; x++) {
      const overhang = 3 + (rand() > 0.45 ? 1 : 0) + (rand() > 0.78 ? 1 : 0);
      for (let y = 0; y < overhang; y++) {
        px(x, y, grass[Math.floor(rand() * grass.length)]);
      }
    }
  });

  // Stone
  drawPixelTile(ctx, TileId.Stone, (px) => {
    noisyFill(px, ['#7d7d7d', '#878787', '#727272', '#696969', '#8e8e8e'], 303);
  });

  // Cobblestone
  drawPixelTile(ctx, TileId.Cobblestone, (px) => {
    noisyFill(px, ['#666666', '#7b7b7b', '#888888', '#5c5c5c'], 404);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 0 || (x + Math.floor(y / 4) * 3) % 5 === 0) {
          px(x, y, '#4a4a4a');
        }
      }
    }
  });

  // Oak Log Top
  drawPixelTile(ctx, TileId.OakLogTop, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        if (ring > 6.5) px(x, y, '#594228');
        else if (Math.floor(ring) % 2 === 0) px(x, y, '#b8945e');
        else px(x, y, '#9c7846');
      }
    }
  });

  // Oak Log Side
  drawPixelTile(ctx, TileId.OakLogSide, (px) => {
    const rand = seededRand(606);
    const bark = ['#684e2e', '#584125', '#765936', '#4d371e'];
    for (let x = 0; x < 16; x++) {
      const colBias = x % 3 === 0 ? 1 : 0;
      for (let y = 0; y < 16; y++) {
        const idx = Math.min(bark.length - 1, Math.floor(rand() * 3) + colBias);
        px(x, y, bark[idx]);
      }
    }
  });

  // Oak Planks
  drawPixelTile(ctx, TileId.OakPlanks, (px) => {
    const rand = seededRand(707);
    const wood = ['#ba9258', '#ad854b', '#c69d62', '#9d7740'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 0) {
          px(x, y, '#7b592c');
        } else if ((y < 4 && x === 7) || (y >= 4 && y < 8 && x === 13) || (y >= 8 && y < 12 && x === 4) || (y >= 12 && x === 10)) {
          px(x, y, '#7b592c');
        } else {
          px(x, y, wood[Math.floor(rand() * wood.length)]);
        }
      }
    }
  });

  // Oak Leaves
  drawPixelTile(ctx, TileId.OakLeaves, (px) => {
    noisyFill(px, ['#3a7225', '#46872d', '#2e5c1d', '#549c37', '#264d17'], 808);
  });

  // Sand
  drawPixelTile(ctx, TileId.Sand, (px) => {
    noisyFill(px, ['#dfd39e', '#d6c88d', '#e8dca9', '#cbbd81'], 909);
  });

  // Sandstone
  drawPixelTile(ctx, TileId.Sandstone, (px) => {
    const rand = seededRand(1010);
    const cols = ['#d8ca93', '#cebe85', '#dfd3a0', '#bfb076'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        px(x, y, y === 3 || y === 11 ? '#b2a165' : cols[Math.floor(rand() * cols.length)]);
      }
    }
  });

  // Water
  drawPixelTile(ctx, TileId.Water, (px) => {
    noisyFill(px, ['#2e6fd9', '#3577e2', '#2663c7', '#3f83eb'], 1111);
  });

  // Glass
  drawPixelTile(ctx, TileId.Glass, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) {
          px(x, y, '#b8e4f5');
        } else if ((x === 3 && y === 3) || (x === 4 && y === 2) || (x === 2 && y === 4) || (x === 12 && y === 12)) {
          px(x, y, '#eefaff');
        } else {
          px(x, y, 'rgba(180, 232, 250, 0.28)');
        }
      }
    }
  });

  // Ores
  drawPixelTile(ctx, TileId.CoalOre, (px) => oreFill(px, ['#222222', '#2d2d2d', '#151515'], 1313));
  drawPixelTile(ctx, TileId.IronOre, (px) => oreFill(px, ['#d5b397', '#c29a7b', '#e5c6ab'], 1414));
  drawPixelTile(ctx, TileId.GoldOre, (px) => oreFill(px, ['#f7d038', '#e3b21b', '#ffeb73'], 1515));
  drawPixelTile(ctx, TileId.DiamondOre, (px) => oreFill(px, ['#47e5e5', '#27c5c9', '#8cf7f7'], 1616));

  // Crafting Table Top
  drawPixelTile(ctx, TileId.CraftingTop, (px) => {
    const rand = seededRand(1717);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) {
          px(x, y, '#6b4723');
        } else if (x === 5 || x === 10 || y === 5 || y === 10) {
          px(x, y, '#59391b');
        } else {
          px(x, y, rand() > 0.5 ? '#b38650' : '#a47742');
        }
      }
    }
  });

  // Crafting Table Side
  drawPixelTile(ctx, TileId.CraftingSide, (px) => {
    noisyFill(px, ['#ba9258', '#ad854b', '#c69d62'], 1818);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#6b4723');
      px(x, 1, '#6b4723');
      px(x, 15, '#6b4723');
    }
    // Saw & Hammer silhouette on side
    for (let y = 4; y <= 11; y++) {
      px(4, y, '#7f8994');
      px(5, y, '#9ca6b0');
      px(10, y, '#7a522a');
    }
    px(9, 4, '#606870');
    px(10, 4, '#606870');
    px(11, 4, '#606870');
  });

  // Furnace Front
  drawPixelTile(ctx, TileId.FurnaceFront, (px) => {
    noisyFill(px, ['#777777', '#868686', '#6b6b6b'], 1919);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#4f4f4f');
      px(x, 15, '#4f4f4f');
    }
    for (let y = 3; y <= 7; y++) {
      for (let x = 4; x <= 11; x++) px(x, y, '#262626');
    }
    for (let y = 10; y <= 13; y++) {
      for (let x = 4; x <= 11; x++) px(x, y, y === 13 ? '#e8751a' : '#222222');
    }
  });

  // Furnace Side
  drawPixelTile(ctx, TileId.FurnaceSide, (px) => {
    noisyFill(px, ['#777777', '#868686', '#6b6b6b'], 2020);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#4d4d4d');
      px(x, 8, '#555555');
      px(x, 15, '#4d4d4d');
    }
  });

  // Bricks
  drawPixelTile(ctx, TileId.Bricks, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const mortarY = y % 4 === 0;
        const row = Math.floor(y / 4);
        const mortarX = (x + (row % 2) * 4) % 8 === 0;
        if (mortarY || mortarX) {
          px(x, y, '#c2bdb5');
        } else {
          px(x, y, (x + y) % 3 === 0 ? '#8e3d2f' : '#a14839');
        }
      }
    }
  });

  // Snow
  drawPixelTile(ctx, TileId.Snow, (px) => {
    noisyFill(px, ['#f2f7fa', '#e5eff5', '#ffffff', '#dce8f0'], 2222);
  });

  // Bedrock
  drawPixelTile(ctx, TileId.Bedrock, (px) => {
    noisyFill(px, ['#2c2c2c', '#454545', '#1d1d1d', '#585858'], 2323);
  });

  // Glowstone Lamp
  drawPixelTile(ctx, TileId.Glowstone, (px) => {
    noisyFill(px, ['#f5be4e', '#ffd978', '#d9932c', '#ffe99d'], 2424);
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#9e6821');
      px(i, 15, '#9e6821');
      px(0, i, '#9e6821');
      px(15, i, '#9e6821');
    }
  });

  // Red Wool
  drawPixelTile(ctx, TileId.RedWool, (px) => {
    noisyFill(px, ['#b52b2b', '#c43737', '#9e2323', '#cf4444'], 2525);
  });

  // Blue Wool
  drawPixelTile(ctx, TileId.BlueWool, (px) => {
    noisyFill(px, ['#2d4db5', '#395ac4', '#243f99', '#4567cf'], 2626);
  });

  cachedAtlasCanvas = canvas;
  return canvas;
}

export function createAtlasTexture(): THREE.CanvasTexture {
  const canvas = buildAtlasCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function getBlockFaceTiles(blockId: BlockId): {
  top: TileId;
  bottom: TileId;
  side: TileId;
  front?: TileId;
} {
  switch (blockId) {
    case BlockId.Grass:
      return { top: TileId.GrassTop, bottom: TileId.Dirt, side: TileId.GrassSide };
    case BlockId.Dirt:
      return { top: TileId.Dirt, bottom: TileId.Dirt, side: TileId.Dirt };
    case BlockId.Stone:
      return { top: TileId.Stone, bottom: TileId.Stone, side: TileId.Stone };
    case BlockId.Cobblestone:
      return { top: TileId.Cobblestone, bottom: TileId.Cobblestone, side: TileId.Cobblestone };
    case BlockId.OakLog:
      return { top: TileId.OakLogTop, bottom: TileId.OakLogTop, side: TileId.OakLogSide };
    case BlockId.OakPlanks:
      return { top: TileId.OakPlanks, bottom: TileId.OakPlanks, side: TileId.OakPlanks };
    case BlockId.OakLeaves:
      return { top: TileId.OakLeaves, bottom: TileId.OakLeaves, side: TileId.OakLeaves };
    case BlockId.Sand:
      return { top: TileId.Sand, bottom: TileId.Sand, side: TileId.Sand };
    case BlockId.Sandstone:
      return { top: TileId.Sandstone, bottom: TileId.Sandstone, side: TileId.Sandstone };
    case BlockId.Water:
      return { top: TileId.Water, bottom: TileId.Water, side: TileId.Water };
    case BlockId.Glass:
      return { top: TileId.Glass, bottom: TileId.Glass, side: TileId.Glass };
    case BlockId.CoalOre:
      return { top: TileId.CoalOre, bottom: TileId.CoalOre, side: TileId.CoalOre };
    case BlockId.IronOre:
      return { top: TileId.IronOre, bottom: TileId.IronOre, side: TileId.IronOre };
    case BlockId.GoldOre:
      return { top: TileId.GoldOre, bottom: TileId.GoldOre, side: TileId.GoldOre };
    case BlockId.DiamondOre:
      return { top: TileId.DiamondOre, bottom: TileId.DiamondOre, side: TileId.DiamondOre };
    case BlockId.CraftingTable:
      return { top: TileId.CraftingTop, bottom: TileId.OakPlanks, side: TileId.CraftingSide };
    case BlockId.Furnace:
      return { top: TileId.FurnaceSide, bottom: TileId.FurnaceSide, side: TileId.FurnaceSide, front: TileId.FurnaceFront };
    case BlockId.Bricks:
      return { top: TileId.Bricks, bottom: TileId.Bricks, side: TileId.Bricks };
    case BlockId.Snow:
      return { top: TileId.Snow, bottom: TileId.Snow, side: TileId.Snow };
    case BlockId.Bedrock:
      return { top: TileId.Bedrock, bottom: TileId.Bedrock, side: TileId.Bedrock };
    case BlockId.Torch:
      return { top: TileId.Glowstone, bottom: TileId.Glowstone, side: TileId.Glowstone };
    case BlockId.RedWool:
      return { top: TileId.RedWool, bottom: TileId.RedWool, side: TileId.RedWool };
    case BlockId.BlueWool:
      return { top: TileId.BlueWool, bottom: TileId.BlueWool, side: TileId.BlueWool };
    default:
      return { top: TileId.Stone, bottom: TileId.Stone, side: TileId.Stone };
  }
}

function drawTileToIsoCube(blockId: BlockId): string {
  const atlas = buildAtlasCanvas();
  const tiles = getBlockFaceTiles(blockId);

  const out = document.createElement('canvas');
  out.width = 48;
  out.height = 48;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const drawFace = (tile: TileId, a: number, b: number, c: number, d: number, e: number, f: number, shade: number) => {
    const sx = (tile % ATLAS_GRID) * TILE_PX;
    const sy = Math.floor(tile / ATLAS_GRID) * TILE_PX;

    const tmp = document.createElement('canvas');
    tmp.width = 16;
    tmp.height = 16;
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    if (shade < 1) {
      tctx.fillStyle = `rgba(0,0,0,${1 - shade})`;
      tctx.fillRect(0, 0, 16, 16);
    }

    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(tmp, 0, 0, 16, 16, 0, 0, 16, 16);
    ctx.restore();
  };

  // Isometric projection onto 48x48
  const cx = 24;
  const topY = 6;
  const rx = 18 / 16;
  const ry = 9 / 16;
  const h = 19 / 16;

  // Top face
  drawFace(tiles.top, rx, ry, -rx, ry, cx, topY, 1.0);
  // Left face
  drawFace(tiles.front ?? tiles.side, rx, ry, 0, h, cx - 18, topY + 9, 0.82);
  // Right face
  drawFace(tiles.side, rx, -ry, 0, h, cx, topY + 18, 0.65);

  return out.toDataURL();
}

function drawPixelSprite(itemId: AnyItemId): string {
  const out = document.createElement('canvas');
  out.width = 32;
  out.height = 32;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const p = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 2, y * 2, 2, 2);
  };

  const drawHandle = () => {
    for (let i = 2; i <= 10; i++) {
      p(i, 15 - i, '#7a542c');
      if (i < 10) p(i + 1, 15 - i, '#593c1e');
    }
  };

  const toolColors: Record<number, [string, string, string]> = {
    [ItemId.WoodenPickaxe]: ['#ba9258', '#99713b', '#c9a165'],
    [ItemId.StonePickaxe]: ['#8a8a8a', '#6b6b6b', '#a3a3a3'],
    [ItemId.IronPickaxe]: ['#dcdcdc', '#a8a8a8', '#ffffff'],
    [ItemId.DiamondPickaxe]: ['#44e4e4', '#1fb5b8', '#9cfafa'],
    [ItemId.WoodenAxe]: ['#ba9258', '#99713b', '#c9a165'],
    [ItemId.StoneAxe]: ['#8a8a8a', '#6b6b6b', '#a3a3a3'],
    [ItemId.WoodenSword]: ['#ba9258', '#99713b', '#c9a165'],
    [ItemId.StoneSword]: ['#8a8a8a', '#6b6b6b', '#a3a3a3'],
  };

  if (
    itemId === ItemId.WoodenPickaxe ||
    itemId === ItemId.StonePickaxe ||
    itemId === ItemId.IronPickaxe ||
    itemId === ItemId.DiamondPickaxe
  ) {
    const [mid, dark, hi] = toolColors[itemId];
    drawHandle();
    const head = [
      [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2],
      [11, 3], [12, 3], [12, 4], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8], [13, 9],
      [5, 3], [10, 3], [11, 4], [12, 5], [12, 6],
    ];
    for (const [x, y] of head) p(x, y, mid);
    p(7, 2, hi);
    p(9, 2, hi);
    p(12, 4, hi);
    p(13, 8, dark);
    p(5, 3, dark);
  } else if (itemId === ItemId.WoodenAxe || itemId === ItemId.StoneAxe) {
    const [mid, dark, hi] = toolColors[itemId];
    drawHandle();
    for (let x = 8; x <= 13; x++) {
      for (let y = 2; y <= 7; y++) {
        if (x + y >= 11 && x + y <= 18) p(x, y, x === 13 ? hi : mid);
      }
    }
    p(8, 5, dark);
    p(9, 6, dark);
  } else if (itemId === ItemId.WoodenSword || itemId === ItemId.StoneSword) {
    const [mid, dark, hi] = toolColors[itemId];
    p(2, 13, '#5c3c1e');
    p(3, 12, '#7a542c');
    p(4, 11, '#7a542c');
    // Guard
    p(3, 9, '#5e4527');
    p(4, 10, '#5e4527');
    p(5, 11, '#5e4527');
    p(6, 12, '#5e4527');
    // Blade
    for (let i = 5; i <= 13; i++) {
      p(i, 15 - i, mid);
      if (i < 13) p(i + 1, 15 - i, hi);
      p(i, 14 - i, dark);
    }
    p(13, 2, hi);
  } else if (itemId === ItemId.Stick) {
    for (let i = 3; i <= 12; i++) {
      p(i, 15 - i, '#8c6234');
      p(i, 14 - i, '#6b4721');
    }
  } else if (itemId === ItemId.Coal) {
    for (let y = 4; y <= 11; y++) {
      for (let x = 4; x <= 11; x++) {
        if (Math.hypot(x - 7.5, y - 7.5) < 4.3) {
          p(x, y, (x + y) % 3 === 0 ? '#3b3b3b' : '#1d1d1d');
        }
      }
    }
  } else if (itemId === ItemId.IronIngot || itemId === ItemId.GoldIngot) {
    const isGold = itemId === ItemId.GoldIngot;
    const c1 = isGold ? '#f7d038' : '#e0e0e0';
    const c2 = isGold ? '#d4a317' : '#a8a8a8';
    const c3 = isGold ? '#fff08a' : '#ffffff';
    for (let y = 5; y <= 10; y++) {
      for (let x = 3; x <= 12; x++) {
        if (y === 5 && (x === 3 || x === 12)) continue;
        p(x, y, y < 7 ? c3 : y < 9 ? c1 : c2);
      }
    }
  } else if (itemId === ItemId.Diamond) {
    for (let y = 3; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        if (d <= 4.5) {
          p(x, y, d < 2.2 ? '#b8ffff' : d < 3.5 ? '#4ce8e8' : '#22b3b8');
        }
      }
    }
  } else if (itemId === ItemId.Apple) {
    p(7, 2, '#694520');
    p(8, 2, '#539e35');
    for (let y = 4; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        if (Math.hypot(x - 7.5, y - 8) < 4.4) {
          p(x, y, x < 7 && y < 7 ? '#ff6969' : '#c92828');
        }
      }
    }
  } else if (itemId === ItemId.Bread) {
    for (let y = 5; y <= 11; y++) {
      for (let x = 2; x <= 13; x++) {
        if (Math.hypot((x - 7.5) / 1.7, y - 8) < 3.6) {
          p(x, y, y <= 7 ? '#d99848' : '#b8762d');
        }
      }
    }
    p(5, 6, '#f0be73');
    p(8, 6, '#f0be73');
    p(10, 7, '#f0be73');
  }

  return out.toDataURL();
}

export function getItemIconUrl(itemId: AnyItemId): string {
  const cached = iconCache.get(itemId);
  if (cached) return cached;

  const def = getItemDef(itemId);
  const url = def?.isBlock ? drawTileToIsoCube(itemId as BlockId) : drawPixelSprite(itemId);
  iconCache.set(itemId, url);
  return url;
}
