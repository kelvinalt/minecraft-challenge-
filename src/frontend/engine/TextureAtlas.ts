import * as THREE from 'three';
import { AnyItemId, BlockId, ItemId } from '../../shared/types';
import { getItemDef } from '../../shared/blocks';

/**
 * Tile indices inside our 16x16 Modern Minecraft (1.14–1.21 Jappa)
 * 16px-per-tile texture atlas (256x256px).
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
  // 1.17–1.21 variants & dimensions
  BirchLogTop = 27,
  BirchLogSide = 28,
  BirchPlanks = 29,
  BirchLeaves = 30,
  SpruceLogTop = 31,
  SpruceLogSide = 32,
  SprucePlanks = 33,
  SpruceLeaves = 34,
  CherryLogTop = 35,
  CherryLogSide = 36,
  CherryPlanks = 37,
  CherryLeaves = 38,
  BambooTop = 39,
  BambooSide = 40,
  BambooPlanks = 41,
  Deepslate = 42,
  CobbledDeepslate = 43,
  StoneBricks = 44,
  MossyCobblestone = 45,
  Obsidian = 46,
  Netherrack = 47,
  NetherBricks = 48,
  SoulSand = 49,
  Lava = 50,
  EndStone = 51,
  PurpurBlock = 52,
  AmethystBlock = 53,
  CopperBlock = 54,
  MudBricks = 55,
  BookshelfTop = 56,
  BookshelfSide = 57,
  TNTTop = 58,
  TNTSide = 59,
  Ice = 60,
  YellowWool = 61,
  GreenWool = 62,
  WhiteWool = 63,
  Torch = 64,
  TallGrass = 65,
  Poppy = 66,
  Dandelion = 67,
  CherrySapling = 68,
  NetherPortal = 69,
  EndPortal = 70,
  Gravel = 71,
  CactusTop = 72,
  CactusSide = 73,
}

export const ATLAS_GRID = 16;
export const TILE_PX = 16;

function hash2D(x: number, y: number, seed = 1337): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rgbaPixel(r: number, g: number, b: number, a = 255): string {
  const cr = Math.max(0, Math.min(255, r | 0));
  const cg = Math.max(0, Math.min(255, g | 0));
  const cb = Math.max(0, Math.min(255, b | 0));
  return a >= 255
    ? `rgb(${cr},${cg},${cb})`
    : `rgba(${cr},${cg},${cb},${(Math.max(0, Math.min(255, a)) / 255).toFixed(3)})`;
}

function drawMc2HrsTile(
  ctx: CanvasRenderingContext2D,
  tileIndex: number,
  key: string,
  pixelFn: (x: number, y: number, n: number, n2: number, px: (x: number, y: number, c: string) => void) => void
) {
  drawTile16(ctx, tileIndex, (px) => {
    const kSeed = key.length * 97 + key.charCodeAt(0) * 13;
    const kSeed2 = key.charCodeAt(key.length - 1) * 41;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = hash2D(x, y, kSeed);
        const n2 = hash2D(x >> 1, y >> 1, kSeed2);
        pixelFn(x, y, n, n2, px);
      }
    }
  });
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawTile16(
  ctx: CanvasRenderingContext2D,
  tileIndex: number,
  drawFn: (px: (x: number, y: number, color: string) => void) => void
) {
  const tx = (tileIndex % ATLAS_GRID) * TILE_PX;
  const ty = Math.floor(tileIndex / ATLAS_GRID) * TILE_PX;
  const px = (x: number, y: number, color: string) => {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
    ctx.fillStyle = color;
    ctx.fillRect(tx + x, ty + y, 1, 1);
  };
  drawFn(px);
}

/** Soft organic 16x16 Jappa cluster painter (avoids harsh 1px static noise) */
function drawSoftPattern(
  px: (x: number, y: number, c: string) => void,
  palette: [string, string, string, string],
  seed: number,
  horizBias = false
) {
  const rand = seededRand(seed);
  const grid: number[][] = Array.from({ length: 16 }, () => Array(16).fill(1));
  for (let y = 0; y < 16; y++) {
    let prev = Math.floor(rand() * 4);
    for (let x = 0; x < 16; x++) {
      const keep = horizBias ? 0.62 : 0.45;
      if (rand() > keep) {
        const step = rand() > 0.5 ? 1 : -1;
        prev = Math.max(0, Math.min(3, prev + step));
      }
      grid[y][x] = prev;
    }
  }
  // Gentle 2nd pass smoothing vertically to create modern painterly pixel clusters
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = grid[(y + 15) % 16][x];
      const v = horizBias ? grid[y][x] : Math.round((grid[y][x] * 2 + n) / 3);
      px(x, y, palette[v]);
    }
  }
}

function drawStoneBase(px: (x: number, y: number, c: string) => void, seed = 303) {
  drawSoftPattern(px, ['#727272', '#7c7c7c', '#858585', '#8f8f8f'], seed, true);
}

function drawDirtBase(px: (x: number, y: number, c: string) => void, seed = 202) {
  drawSoftPattern(px, ['#6e4d34', '#7b573b', '#886143', '#966d4d'], seed, false);
  const rand = seededRand(seed + 17);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * 15);
    const y = Math.floor(rand() * 15);
    px(x, y, '#6b6763'); // subtle modern pebble
  }
}

function drawPlanksBase(
  px: (x: number, y: number, c: string) => void,
  groove: string,
  dark: string,
  mid: string,
  light: string,
  seed: number
) {
  const rand = seededRand(seed);
  const joints = [5, 12, 2, 9];
  for (let y = 0; y < 16; y++) {
    const row = Math.floor(y / 4);
    const ly = y % 4;
    for (let x = 0; x < 16; x++) {
      if (ly === 0) {
        px(x, y, groove);
      } else if (x === joints[row]) {
        px(x, y, groove);
      } else if (ly === 1) {
        px(x, y, rand() > 0.25 ? light : mid);
      } else if (ly === 3) {
        px(x, y, rand() > 0.35 ? dark : mid);
      } else {
        px(x, y, rand() > 0.72 ? light : rand() > 0.3 ? mid : dark);
      }
    }
  }
}

function drawLogTopBase(
  px: (x: number, y: number, c: string) => void,
  barkOuter: string,
  barkInner: string,
  ringA: string,
  ringB: string
) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (x === 0 || x === 15 || y === 0 || y === 15) {
        px(x, y, barkOuter);
      } else if (x === 1 || x === 14 || y === 1 || y === 14) {
        px(x, y, barkInner);
      } else {
        const ring = Math.floor(Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)));
        px(x, y, ring % 2 === 0 ? ringA : ringB);
      }
    }
  }
}

function drawLogSideBase(
  px: (x: number, y: number, c: string) => void,
  dark: string,
  mid: string,
  light: string,
  seed: number
) {
  const rand = seededRand(seed);
  for (let x = 0; x < 16; x++) {
    const colTone = x % 4 === 0 ? 0 : x % 4 === 2 ? 2 : 1;
    for (let y = 0; y < 16; y++) {
      const r = rand();
      const idx = Math.max(0, Math.min(2, colTone + (r > 0.78 ? 1 : r < 0.18 ? -1 : 0)));
      px(x, y, idx === 0 ? dark : idx === 1 ? mid : light);
    }
  }
}

function drawLeavesBase(
  px: (x: number, y: number, c: string) => void,
  palette: [string, string, string, string],
  seed: number,
  petal?: string
) {
  const rand = seededRand(seed);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const gap = ((x * 5 + y * 9) % 13 === 0 || (x === 4 && y === 11) || (x === 11 && y === 3)) && rand() > 0.35;
      if (gap) continue;
      if (petal && rand() > 0.84) {
        px(x, y, petal);
      } else {
        const cluster = ((x >> 1) * 3 + (y >> 1) * 5) % 4;
        const shift = rand() > 0.65 ? (rand() > 0.5 ? 1 : -1) : 0;
        const idx = Math.max(0, Math.min(3, cluster + shift));
        px(x, y, palette[idx]);
      }
    }
  }
}

function drawCobblePattern(
  px: (x: number, y: number, c: string) => void,
  mortar: string,
  dark: string,
  mid: string,
  light: string
) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) px(x, y, mortar);
  }
  const stones: [number, number, number, number][] = [
    [0, 0, 7, 4], [8, 0, 8, 5],
    [0, 5, 5, 4], [6, 5, 6, 5], [13, 5, 3, 5],
    [0, 10, 6, 5], [7, 11, 5, 4], [13, 11, 3, 4],
  ];
  stones.forEach(([sx, sy, sw, sh], idx) => {
    for (let y = sy; y < sy + sh - 1; y++) {
      for (let x = sx; x < sx + sw - 1; x++) {
        // Modern rounded stone corners
        if ((x === sx && y === sy) || (x === sx + sw - 2 && y === sy + sh - 2)) {
          if (sw > 4) continue;
        }
        let col = (x + y + idx) % 3 === 0 ? mid : dark;
        if (y === sy || x === sx) col = light;
        if (y === sy + sh - 2) col = dark;
        px(x % 16, y % 16, col);
      }
    }
  });
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

  // 0: Minecraft-2hrs Grass Top
  drawMc2HrsTile(ctx, TileId.GrassTop, 'grass_top', (x, y, n, n2, px) => {
    const shade = (n - 0.5) * 24 + (n2 - 0.5) * 16;
    px(x, y, rgbaPixel(88 + shade, 152 + shade, 62 + shade * 0.7));
  });

  // 2: Minecraft-2hrs Dirt
  drawMc2HrsTile(ctx, TileId.Dirt, 'dirt', (x, y, n, n2, px) => {
    const d = (n - 0.5) * 28 + (n2 - 0.5) * 16;
    const pebble = n > 0.9 ? -22 : 0;
    px(x, y, rgbaPixel(134 + d + pebble, 96 + d * 0.8 + pebble, 64 + d * 0.6 + pebble));
  });

  // 1: Minecraft-2hrs Grass Side
  drawMc2HrsTile(ctx, TileId.GrassSide, 'grass_side', (x, y, n, n2, px) => {
    const overhang = 3 + Math.floor(hash2D(x, 0, 511) * 3);
    if (y < overhang) {
      const shade = (n - 0.5) * 24;
      px(x, y, rgbaPixel(88 + shade, 152 + shade, 62 + shade * 0.7));
    } else if (y === overhang) {
      px(x, y, rgbaPixel(72, 118, 48));
    } else {
      const d = (n - 0.5) * 26 + (n2 - 0.5) * 14;
      px(x, y, rgbaPixel(132 + d, 94 + d * 0.8, 63 + d * 0.6));
    }
  });

  // 3: Minecraft-2hrs Stone
  drawMc2HrsTile(ctx, TileId.Stone, 'stone', (x, y, n, n2, px) => {
    const strata = Math.sin(y * 0.7 + x * 0.2) * 8;
    const d = (n - 0.5) * 24 + (n2 - 0.5) * 20 + strata;
    const c = 128 + d;
    px(x, y, rgbaPixel(c, c, c + 2));
  });

  // 4: Minecraft-2hrs Cobblestone
  drawMc2HrsTile(ctx, TileId.Cobblestone, 'cobblestone', (x, y, n, n2, px) => {
    const grid = (x + (y >> 2) * 3) % 5 === 0 || y % 4 === 0;
    const c = (grid ? 82 : 122) + (n - 0.5) * 24 + (n2 - 0.5) * 18;
    px(x, y, rgbaPixel(c, c, c + 2));
  });

  // 5-8: Minecraft-2hrs Oak
  drawMc2HrsTile(ctx, TileId.OakLogTop, 'oak_log_top', (x, y, n, _n2, px) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isBark = x === 0 || x === 15 || y === 0 || y === 15;
    if (isBark) {
      const d = (n - 0.5) * 20;
      px(x, y, rgbaPixel(94 + d, 68 + d * 0.8, 42 + d * 0.6));
    } else {
      const ring = Math.sin(dist * 2.1) > 0.25 ? -14 : 8;
      const d = (n - 0.5) * 12 + ring;
      px(x, y, rgbaPixel(174 + d, 138 + d * 0.85, 88 + d * 0.7));
    }
  });
  drawMc2HrsTile(ctx, TileId.OakLogSide, 'oak_log_side', (x, y, n, _n2, px) => {
    const ridge = Math.sin(x * 1.45) * 14 + (hash2D(x, y >> 2, 333) - 0.5) * 18;
    const d = (n - 0.5) * 12 + ridge;
    px(x, y, rgbaPixel(102 + d, 74 + d * 0.8, 46 + d * 0.6));
  });
  drawMc2HrsTile(ctx, TileId.OakPlanks, 'planks_oak', (x, y, n, _n2, px) => {
    const seam =
      y % 4 === 0 ||
      (x === 8 && (y >> 2) % 2 === 0) ||
      (x === 0 && (y >> 2) % 2 === 1);
    const grain = Math.sin(x * 0.8 + (y >> 2) * 2.1) * 7;
    const d = (n - 0.5) * 14 + grain + (seam ? -28 : 0);
    px(x, y, rgbaPixel(178 + d, 138 + d * 0.85, 86 + d * 0.65));
  });
  drawMc2HrsTile(ctx, TileId.OakLeaves, 'oak_leaves', (x, y, n, n2, px) => {
    if (n < 0.16) return;
    const d = (n - 0.5) * 26 + (n2 - 0.5) * 18;
    px(x, y, rgbaPixel(62 + d * 0.7, 126 + d, 46 + d * 0.6));
  });

  // 27-30: Modern Birch
  drawTile16(ctx, TileId.BirchLogTop, (px) =>
    drawLogTopBase(px, '#d8d5cc', '#b8b3a6', '#b89a67', '#d8be8d')
  );
  drawTile16(ctx, TileId.BirchLogSide, (px) => {
    drawSoftPattern(px, ['#d8d5cc', '#e5e3db', '#edece5', '#f5f4ee'], 2828, false);
    const scars: [number, number, number][] = [
      [1, 2, 5], [9, 4, 4], [4, 7, 6], [11, 10, 4], [2, 13, 5], [8, 14, 3],
    ];
    for (const [sx, sy, w] of scars) {
      for (let i = 0; i < w; i++) {
        px((sx + i) % 16, sy, i === 0 || i === w - 1 ? '#615e57' : '#32302c');
      }
    }
  });
  drawTile16(ctx, TileId.BirchPlanks, (px) =>
    drawPlanksBase(px, '#91805c', '#bea774', '#cfb985', '#dfd09e', 2929)
  );
  drawTile16(ctx, TileId.BirchLeaves, (px) =>
    drawLeavesBase(px, ['#43692b', '#568236', '#679942', '#7ead53'], 3030)
  );

  // 31-34: Minecraft-2hrs Spruce
  drawMc2HrsTile(ctx, TileId.SpruceLogTop, 'spruce_log_top', (x, y, n, _n2, px) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const isBark = x === 0 || x === 15 || y === 0 || y === 15;
    if (isBark) {
      const d = (n - 0.5) * 16;
      px(x, y, rgbaPixel(64 + d, 44 + d * 0.8, 28 + d * 0.6));
    } else {
      const ring = Math.sin(dist * 2.2) > 0.2 ? -12 : 6;
      const d = (n - 0.5) * 10 + ring;
      px(x, y, rgbaPixel(134 + d, 102 + d * 0.85, 66 + d * 0.7));
    }
  });
  drawMc2HrsTile(ctx, TileId.SpruceLogSide, 'spruce_log_side', (x, y, n, _n2, px) => {
    const ridge = Math.sin(x * 1.55) * 12 + (hash2D(x, y >> 2, 449) - 0.5) * 14;
    const d = (n - 0.5) * 10 + ridge;
    px(x, y, rgbaPixel(68 + d, 48 + d * 0.8, 30 + d * 0.6));
  });
  drawTile16(ctx, TileId.SprucePlanks, (px) =>
    drawPlanksBase(px, '#422b18', '#5e3f24', '#704d2d', '#825d38', 3333)
  );
  drawMc2HrsTile(ctx, TileId.SpruceLeaves, 'spruce_leaves', (x, y, n, n2, px) => {
    if (n < 0.14) return;
    const d = (n - 0.5) * 22 + (n2 - 0.5) * 14;
    px(x, y, rgbaPixel(42 + d * 0.6, 88 + d, 56 + d * 0.7));
  });

  // 35-38: Modern 1.20.1 Cherry Blossom
  drawTile16(ctx, TileId.CherryLogTop, (px) =>
    drawLogTopBase(px, '#362129', '#52323d', '#b86878', '#da919e')
  );
  drawTile16(ctx, TileId.CherryLogSide, (px) => {
    drawLogSideBase(px, '#2d1a21', '#422731', '#593743', 3636);
    // Horizontal cherry lenticel streaks
    for (const [x, y] of [[2, 3], [9, 6], [4, 10], [11, 13]]) {
      px(x, y, '#8f5968');
      px(x + 1, y, '#a36b7b');
    }
  });
  drawTile16(ctx, TileId.CherryPlanks, (px) =>
    drawPlanksBase(px, '#a36c77', '#cf919c', '#e3a5af', '#f2bcc4', 3737)
  );
  drawTile16(ctx, TileId.CherryLeaves, (px) =>
    drawLeavesBase(px, ['#cc7091', '#e88fb0', '#faa8c5', '#ffc9dc'], 3838, '#ffe8f0')
  );

  // 39-41: Modern 1.20.1 Bamboo
  drawTile16(ctx, TileId.BambooTop, (px) =>
    drawLogTopBase(px, '#4c731d', '#66942a', '#94b84f', '#b6d472')
  );
  drawTile16(ctx, TileId.BambooSide, (px) => {
    drawLogSideBase(px, '#4b731d', '#65942b', '#80b040', 4040);
    for (let x = 0; x < 16; x++) {
      px(x, 5, '#3b5c16');
      px(x, 6, '#9ec95e');
      px(x, 12, '#3b5c16');
      px(x, 13, '#9ec95e');
    }
  });
  drawTile16(ctx, TileId.BambooPlanks, (px) =>
    drawPlanksBase(px, '#8f7e32', '#baa643', '#cbb850', '#decb64', 4141)
  );

  // 9: Minecraft-2hrs Sand + 71: Gravel + 72-73: Cactus
  drawMc2HrsTile(ctx, TileId.Sand, 'sand', (x, y, n, _n2, px) => {
    const ripple = Math.sin((x + y) * 0.5) * 5;
    const d = (n - 0.5) * 18 + ripple;
    px(x, y, rgbaPixel(222 + d, 206 + d, 148 + d * 0.8));
  });
  drawMc2HrsTile(ctx, TileId.Gravel, 'gravel', (x, y, n, _n2, px) => {
    const pebble = hash2D(x >> 1, y >> 1, 919);
    const d = (pebble - 0.5) * 44 + (n - 0.5) * 18;
    px(x, y, rgbaPixel(130 + d, 125 + d, 123 + d));
  });
  drawMc2HrsTile(ctx, TileId.CactusTop, 'cactus_top', (x, y, n, _n2, px) => {
    const dx = Math.abs(x - 7.5);
    const dy = Math.abs(y - 7.5);
    const ring = Math.max(dx, dy);
    const spine = x % 4 === 1 && y % 4 === 1 ? 34 : 0;
    const d = (n - 0.5) * 16 + (ring > 5.5 ? -18 : 8) + spine;
    px(x, y, rgbaPixel(64 + d * 0.6, 134 + d, 54 + d * 0.6));
  });
  drawMc2HrsTile(ctx, TileId.CactusSide, 'cactus_side', (x, y, n, _n2, px) => {
    const rib = x % 3 === 0 ? -24 : 8;
    const spine = x % 3 === 0 && y % 4 === 2 ? 48 : 0;
    const d = (n - 0.5) * 14 + rib + spine;
    px(x, y, rgbaPixel(66 + d * 0.7, 136 + d, 56 + d * 0.6));
  });

  // 10: Sandstone
  drawTile16(ctx, TileId.Sandstone, (px) => {
    drawSoftPattern(px, ['#d2c388', '#dfd29d', '#e8ddb0', '#efe6be'], 1010, true);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#bfb072');
      px(x, 5, '#bfb072');
      px(x, 12, '#bfb072');
      if (x % 4 !== 0) {
        px(x, 2, '#c9b97c');
        px(x, 3, '#c9b97c');
      }
    }
  });

  // 11: Minecraft-2hrs Water
  drawMc2HrsTile(ctx, TileId.Water, 'water', (x, y, n, _n2, px) => {
    const wave = Math.sin(x * 0.7 + y * 0.5) * 12;
    const d = (n - 0.5) * 14 + wave;
    px(x, y, rgbaPixel(42 + d * 0.5, 118 + d, 208 + d, 205));
  });

  // 12: Minecraft-2hrs Glass
  drawMc2HrsTile(ctx, TileId.Glass, 'glass', (x, y, _n, _n2, px) => {
    const border = x === 0 || x === 15 || y === 0 || y === 15;
    const glint = (x + y === 6 || x + y === 7 || x + y === 22) && x > 2 && x < 13;
    if (border) {
      px(x, y, rgbaPixel(182, 224, 240, 255));
    } else if (glint) {
      px(x, y, rgbaPixel(238, 250, 255, 210));
    }
  });

  // 60: Modern Packed Ice
  drawTile16(ctx, TileId.Ice, (px) => {
    drawSoftPattern(px, ['#7bb1eb', '#8ec2f8', '#9fd0fc', '#b5deff'], 6060, false);
    px(3, 4, '#dff3ff');
    px(4, 3, '#dff3ff');
    px(10, 11, '#dff3ff');
    px(11, 10, '#dff3ff');
  });

  // 13-16: Ores (Coal & Iron from Minecraft-2hrs + Gold & Diamond)
  drawMc2HrsTile(ctx, TileId.CoalOre, 'coal_ore', (x, y, n, n2, px) => {
    const vein = hash2D(x >> 1, y >> 1, 1411) > 0.74 && x > 1 && x < 14 && y > 1 && y < 14;
    if (vein) {
      const c = 28 + (n - 0.5) * 18;
      px(x, y, rgbaPixel(c, c, c + 4));
    } else {
      const d = (n - 0.5) * 24 + (n2 - 0.5) * 18;
      const c = 128 + d;
      px(x, y, rgbaPixel(c, c, c + 2));
    }
  });
  drawMc2HrsTile(ctx, TileId.IronOre, 'iron_ore', (x, y, n, n2, px) => {
    const vein = hash2D(x >> 1, y >> 1, 1523) > 0.76 && x > 1 && x < 14 && y > 1 && y < 14;
    if (vein) {
      const d = (n - 0.5) * 22;
      px(x, y, rgbaPixel(206 + d, 168 + d, 134 + d));
    } else {
      const d = (n - 0.5) * 24 + (n2 - 0.5) * 18;
      const c = 128 + d;
      px(x, y, rgbaPixel(c, c, c + 2));
    }
  });
  drawTile16(ctx, TileId.GoldOre, (px) => {
    drawStoneBase(px, 303);
    const nuggets = [[3, 2], [10, 4], [4, 9], [10, 11]];
    for (const [cx, cy] of nuggets) {
      px(cx, cy, '#fff28a');
      px(cx + 1, cy, '#f7cf34');
      px(cx, cy + 1, '#f7cf34');
      px(cx + 1, cy + 1, '#c48a12');
    }
  });
  drawTile16(ctx, TileId.DiamondOre, (px) => {
    drawStoneBase(px, 303);
    const gems = [[3, 3], [10, 3], [4, 10], [11, 10]];
    for (const [cx, cy] of gems) {
      px(cx, cy, '#a6ffff');
      px(cx + 1, cy, '#3fe6e6');
      px(cx, cy + 1, '#3fe6e6');
      px(cx + 1, cy + 1, '#19a3a8');
    }
  });

  // 42-45: Deepslate, Cobbled Deepslate, Stone Bricks, Mossy Cobblestone
  drawTile16(ctx, TileId.Deepslate, (px) =>
    drawSoftPattern(px, ['#3a3b42', '#474952', '#52545e', '#5e606b'], 4242, true)
  );
  drawTile16(ctx, TileId.CobbledDeepslate, (px) =>
    drawCobblePattern(px, '#25262b', '#383a42', '#494b54', '#5c5f6b')
  );
  drawTile16(ctx, TileId.StoneBricks, (px) => {
    drawSoftPattern(px, ['#707070', '#7a7a7a', '#848484', '#8e8e8e'], 4444, true);
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 8);
      for (let x = 0; x < 16; x++) {
        if (y % 8 === 0 || (x + row * 8) % 16 === 0) px(x, y, '#525252');
        else if (y % 8 === 1 || (x + row * 8) % 16 === 1) px(x, y, '#9c9c9c');
        else if (y % 8 === 7) px(x, y, '#606060');
      }
    }
  });
  drawTile16(ctx, TileId.MossyCobblestone, (px) => {
    drawCobblePattern(px, '#4a5442', '#646b5c', '#7a7d72', '#919488');
    for (const [mx, my] of [
      [1, 1], [2, 1], [6, 3], [7, 4], [11, 6], [12, 6], [3, 9], [4, 10], [9, 12], [10, 13],
    ]) {
      px(mx, my, '#558c38');
      px(mx + 1, my, '#427328');
    }
  });

  // 17-18: Minecraft-2hrs Crafting Table
  drawMc2HrsTile(ctx, TileId.CraftingTop, 'crafting_table_top', (x, y, n, _n2, px) => {
    const border = x < 2 || x > 13 || y < 2 || y > 13;
    const grid = !border && ((x - 2) % 4 === 0 || (y - 2) % 4 === 0);
    if (border) {
      const d = (n - 0.5) * 14;
      px(x, y, rgbaPixel(118 + d, 78 + d * 0.8, 44 + d * 0.6));
    } else if (grid) {
      px(x, y, rgbaPixel(76, 50, 28));
    } else {
      const d = (n - 0.5) * 12;
      px(x, y, rgbaPixel(184 + d, 142 + d * 0.85, 90 + d * 0.65));
    }
  });
  drawMc2HrsTile(ctx, TileId.CraftingSide, 'crafting_table_side', (x, y, n, _n2, px) => {
    if (y < 4) {
      const d = (n - 0.5) * 14;
      px(x, y, rgbaPixel(118 + d, 78 + d * 0.8, 44 + d * 0.6));
    } else if ((x >= 4 && x <= 5 && y >= 6 && y <= 11) || (x >= 10 && x <= 11 && y >= 6 && y <= 11)) {
      px(x, y, rgbaPixel(82, 86, 94));
    } else {
      const seam = y % 4 === 0;
      const d = (n - 0.5) * 14 + (seam ? -22 : 0);
      px(x, y, rgbaPixel(168 + d, 128 + d * 0.85, 78 + d * 0.65));
    }
  });

  // 19-20: Modern Furnace
  drawTile16(ctx, TileId.FurnaceFront, (px) => {
    drawStoneBase(px, 1919);
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#5a5a5a'); px(i, 15, '#4d4d4d');
      px(0, i, '#5a5a5a'); px(15, i, '#4d4d4d');
    }
    for (let y = 2; y <= 6; y++) {
      for (let x = 3; x <= 12; x++) {
        if (y === 2 && (x === 3 || x === 12)) continue;
        px(x, y, '#242424');
      }
    }
    for (let x = 2; x <= 13; x++) px(x, 8, '#5e5e5e');
    for (let y = 10; y <= 13; y++) {
      for (let x = 4; x <= 11; x++) px(x, y, y === 13 ? '#e86e1c' : '#1b1b1b');
    }
  });
  drawTile16(ctx, TileId.FurnaceSide, (px) => {
    drawStoneBase(px, 2020);
    for (let x = 0; x < 16; x++) {
      px(x, 0, '#555555');
      px(x, 8, '#5a5a5a');
      px(x, 15, '#4d4d4d');
    }
  });

  // 56-57: Modern Bookshelf
  drawTile16(ctx, TileId.BookshelfTop, (px) =>
    drawPlanksBase(px, '#7d5a2b', '#a88044', '#b89154', '#c9a365', 707)
  );
  drawTile16(ctx, TileId.BookshelfSide, (px) => {
    drawPlanksBase(px, '#6e4d23', '#99733a', '#ab8348', '#bc9456', 5757);
    const spines = ['#a83232', '#2d599e', '#387d44', '#c29229', '#7d3b8a', '#ba572b'];
    [2, 9].forEach((ry) => {
      for (let x = 1; x < 15; x += 2) {
        const col = spines[(x + ry) % spines.length];
        for (let y = ry; y < ry + 5; y++) {
          px(x, y, y === ry + 1 ? '#ebe0b8' : col);
          px(x + 1, y, y === ry + 1 ? '#d4c698' : col);
        }
      }
    });
  });

  // 58-59: Modern TNT
  drawTile16(ctx, TileId.TNTTop, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) < 2.5) px(x, y, '#292929');
        else px(x, y, x % 2 === 0 ? '#bd382c' : '#a12a20');
      }
    }
  });
  drawTile16(ctx, TileId.TNTSide, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (y >= 5 && y <= 10) px(x, y, y === 5 || y === 10 ? '#c4c4c4' : '#f2f2f2');
        else px(x, y, x % 2 === 0 ? '#c23529' : '#9e261c');
      }
    }
    const pts = [
      [2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9],
      [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9],
      [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9],
    ];
    for (const [x, y] of pts) px(x, y, '#171717');
  });

  // 21 & 55: Bricks (Minecraft-2hrs) & Mud Bricks
  drawMc2HrsTile(ctx, TileId.Bricks, 'bricks', (x, y, n, n2, px) => {
    const mortar = y % 4 === 0 || (x + (y >> 2) * 4) % 8 === 0;
    if (mortar) {
      const c = 198 + (n - 0.5) * 16;
      px(x, y, rgbaPixel(c, c - 4, c - 10));
    } else {
      const d = (n - 0.5) * 24 + (n2 - 0.5) * 16;
      px(x, y, rgbaPixel(162 + d, 76 + d * 0.6, 58 + d * 0.5));
    }
  });
  drawTile16(ctx, TileId.MudBricks, (px) => {
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 4);
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0) px(x, y, '#523e30');
        else px(x, y, y % 4 === 1 ? '#997b64' : (x + row) % 3 === 0 ? '#7a5e4a' : '#8a6c56');
      }
    }
  });

  // 22-24: Snow, Bedrock, Glowstone (Minecraft-2hrs)
  drawMc2HrsTile(ctx, TileId.Snow, 'snow', (x, y, n, n2, px) => {
    const d = (n - 0.5) * 14 + (n2 - 0.5) * 10;
    px(x, y, rgbaPixel(Math.min(255, 238 + d), Math.min(255, 244 + d), Math.min(255, 250 + d)));
  });
  drawMc2HrsTile(ctx, TileId.Bedrock, 'bedrock', (x, y, n, n2, px) => {
    const d = (n - 0.5) * 52 + (n2 - 0.5) * 36;
    const c = Math.max(20, Math.min(95, 52 + d));
    px(x, y, rgbaPixel(c, c, c));
  });
  drawMc2HrsTile(ctx, TileId.Glowstone, 'glowstone', (x, y, n, n2, px) => {
    const border = x === 0 || x === 15 || y === 0 || y === 15;
    const vein = n2 > 0.68 ? -42 : 24;
    const d = (n - 0.5) * 28 + vein + (border ? -25 : 0);
    px(
      x,
      y,
      rgbaPixel(Math.min(255, 238 + d), Math.min(245, 194 + d), Math.max(40, 96 + d * 0.6))
    );
  });

  // 46-54: Obsidian, Netherrack, Nether Bricks, Soul Sand, Lava, End Stone, Purpur, Amethyst, Copper
  drawTile16(ctx, TileId.Obsidian, (px) =>
    drawSoftPattern(px, ['#0c0814', '#160f24', '#26183d', '#3a2459'], 4646, false)
  );
  drawTile16(ctx, TileId.Netherrack, (px) =>
    drawSoftPattern(px, ['#4f1d1d', '#612626', '#702e2e', '#803838'], 4747, false)
  );
  drawTile16(ctx, TileId.NetherBricks, (px) => {
    for (let y = 0; y < 16; y++) {
      const row = Math.floor(y / 4);
      for (let x = 0; x < 16; x++) {
        if (y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0) px(x, y, '#1c1014');
        else px(x, y, y % 4 === 1 ? '#45242e' : '#301920');
      }
    }
  });
  drawTile16(ctx, TileId.SoulSand, (px) => {
    drawSoftPattern(px, ['#3a2b22', '#4a372c', '#594235', '#664d3e'], 4949, false);
    px(4, 5, '#261b15'); px(6, 5, '#261b15'); px(5, 7, '#261b15');
    px(10, 10, '#261b15'); px(12, 10, '#261b15'); px(11, 12, '#261b15');
  });
  drawTile16(ctx, TileId.Lava, (px) =>
    drawSoftPattern(px, ['#cf3d0e', '#ed6815', '#fa9923', '#ffd447'], 5050, false)
  );
  drawTile16(ctx, TileId.EndStone, (px) =>
    drawSoftPattern(px, ['#c7c28d', '#d6d198', '#e3dfa6', '#edeaba'], 5151, false)
  );
  drawTile16(ctx, TileId.PurpurBlock, (px) => {
    drawSoftPattern(px, ['#916090', '#a674a5', '#b886b7', '#c797c6'], 5252, false);
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#70466f'); px(0, i, '#70466f');
      px(i, 8, '#70466f'); px(8, i, '#70466f');
    }
  });
  drawTile16(ctx, TileId.AmethystBlock, (px) => {
    drawSoftPattern(px, ['#653ea3', '#8255c7', '#9f70e3', '#bd94f5'], 5353, false);
    px(3, 5, '#ebd6ff'); px(4, 4, '#ebd6ff');
    px(10, 11, '#ebd6ff'); px(11, 10, '#ebd6ff');
  });
  drawTile16(ctx, TileId.CopperBlock, (px) => {
    drawSoftPattern(px, ['#a35236', '#ba6343', '#cc7452', '#de8662'], 5454, false);
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#783620'); px(i, 15, '#783620');
      px(0, i, '#783620'); px(15, i, '#783620');
    }
    px(2, 2, '#f0a686'); px(13, 2, '#f0a686');
    px(2, 13, '#f0a686'); px(13, 13, '#f0a686');
  });

  // Wools (Modern Jappa 1.14+ vibrant soft wool)
  drawTile16(ctx, TileId.RedWool, (px) => drawSoftPattern(px, ['#8f2020', '#a32727', '#b53131', '#c73e3e'], 2525));
  drawTile16(ctx, TileId.BlueWool, (px) => drawSoftPattern(px, ['#243d91', '#2d4ba8', '#3858bd', '#4768cf'], 2626));
  drawTile16(ctx, TileId.YellowWool, (px) => drawSoftPattern(px, ['#c99b1a', '#deb026', '#edc234', '#fad450'], 6161));
  drawTile16(ctx, TileId.GreenWool, (px) => drawSoftPattern(px, ['#3a5e1b', '#497324', '#58872d', '#699c38'], 6262));
  drawTile16(ctx, TileId.WhiteWool, (px) => drawSoftPattern(px, ['#d4d4d9', '#e3e3e8', '#f0f0f5', '#ffffff'], 6363));

  // Crossed-Plane Flora & Torch (Minecraft-2hrs sprites)
  drawMc2HrsTile(ctx, TileId.Torch, 'torch', (x, y, n, _n2, px) => {
    const dx = Math.abs(x - 7.5);
    if (dx <= 1.5 && y >= 5) {
      if (y === 5 || y === 6) {
        px(x, y, rgbaPixel(255, 225, 110));
      } else {
        const d = (n - 0.5) * 20;
        px(x, y, rgbaPixel(128 + d, 88 + d * 0.8, 52 + d * 0.6));
      }
    } else if (dx <= 2.5 && y >= 2 && y <= 5) {
      const glow = y <= 3 ? 255 : 230;
      px(x, y, rgbaPixel(glow, 175 + n * 65, 45));
    }
  });

  drawMc2HrsTile(ctx, TileId.TallGrass, 'tall_grass', (x, y, n, _n2, px) => {
    const blade = (x % 3 === 1 || x % 4 === 2) && y > 3 + hash2D(x, 0, 881) * 5;
    if (blade) {
      const shade = (15 - y) * 3 + (n - 0.5) * 20;
      px(x, y, rgbaPixel(72 + shade * 0.6, 146 + shade, 48 + shade * 0.5));
    }
  });

  drawMc2HrsTile(ctx, TileId.Poppy, 'flower', (x, y, n, _n2, px) => {
    const stem = (x === 7 || x === 8) && y >= 7;
    const petalDist = Math.hypot(x - 7.5, y - 4.5);
    if (petalDist <= 1.3) {
      px(x, y, rgbaPixel(252, 214, 64));
    } else if (petalDist <= 3.1 && y <= 7) {
      const d = (n - 0.5) * 20;
      px(x, y, rgbaPixel(232 + d, 74 + d * 0.5, 68 + d * 0.5));
    } else if (stem || ((x === 6 || x === 9) && y === 11)) {
      px(x, y, rgbaPixel(58, 128, 44));
    }
  });

  drawTile16(ctx, TileId.Dandelion, (px) => {
    for (let y = 8; y <= 15; y++) px(7, y, '#4a8528');
    px(6, 5, '#ffeb4d'); px(7, 5, '#fff58a'); px(8, 5, '#ffeb4d');
    px(6, 6, '#e0b819'); px(7, 6, '#ffd529'); px(8, 6, '#e0b819');
    px(7, 7, '#c79e10');
  });

  drawTile16(ctx, TileId.CherrySapling, (px) => {
    for (let y = 8; y <= 15; y++) px(7, y, '#4f303b');
    for (const [x, y, c] of [
      [6, 4, '#ffb8d0'], [7, 4, '#ffd9e6'], [8, 4, '#ffb8d0'],
      [5, 6, '#f08db2'], [6, 6, '#ffb8d0'], [7, 6, '#ffd9e6'], [8, 6, '#f08db2'], [9, 6, '#ffb8d0'],
      [6, 8, '#e37ca1'], [8, 8, '#f08db2'],
    ] as [number, number, string][]) {
      px(x, y, c);
    }
  });

  drawTile16(ctx, TileId.NetherPortal, (px) =>
    drawSoftPattern(px, ['#53149e', '#7822c9', '#a33be6', '#cb69ff'], 6969, false)
  );
  drawTile16(ctx, TileId.EndPortal, (px) => {
    drawSoftPattern(px, ['#050b12', '#091524', '#0f2438', '#15324a'], 7070, false);
    px(4, 5, '#66f2df'); px(10, 4, '#b8b0ff'); px(7, 11, '#66f2df');
    for (let i = 0; i < 16; i++) {
      px(i, 0, '#9eb37f'); px(i, 15, '#9eb37f');
      px(0, i, '#9eb37f'); px(15, i, '#9eb37f');
    }
  });

  cachedAtlasCanvas = canvas;
  return canvas;
}

export function createAtlasTexture(): THREE.CanvasTexture {
  const canvas = buildAtlasCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Crisp Modern Minecraft 16x16 voxel pixel edges
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
    case BlockId.BirchLog:
      return { top: TileId.BirchLogTop, bottom: TileId.BirchLogTop, side: TileId.BirchLogSide };
    case BlockId.BirchPlanks:
      return { top: TileId.BirchPlanks, bottom: TileId.BirchPlanks, side: TileId.BirchPlanks };
    case BlockId.BirchLeaves:
      return { top: TileId.BirchLeaves, bottom: TileId.BirchLeaves, side: TileId.BirchLeaves };
    case BlockId.SpruceLog:
      return { top: TileId.SpruceLogTop, bottom: TileId.SpruceLogTop, side: TileId.SpruceLogSide };
    case BlockId.SprucePlanks:
      return { top: TileId.SprucePlanks, bottom: TileId.SprucePlanks, side: TileId.SprucePlanks };
    case BlockId.SpruceLeaves:
      return { top: TileId.SpruceLeaves, bottom: TileId.SpruceLeaves, side: TileId.SpruceLeaves };
    case BlockId.CherryLog:
      return { top: TileId.CherryLogTop, bottom: TileId.CherryLogTop, side: TileId.CherryLogSide };
    case BlockId.CherryPlanks:
      return { top: TileId.CherryPlanks, bottom: TileId.CherryPlanks, side: TileId.CherryPlanks };
    case BlockId.CherryLeaves:
      return { top: TileId.CherryLeaves, bottom: TileId.CherryLeaves, side: TileId.CherryLeaves };
    case BlockId.BambooBlock:
      return { top: TileId.BambooTop, bottom: TileId.BambooTop, side: TileId.BambooSide };
    case BlockId.BambooPlanks:
      return { top: TileId.BambooPlanks, bottom: TileId.BambooPlanks, side: TileId.BambooPlanks };
    case BlockId.Sand:
      return { top: TileId.Sand, bottom: TileId.Sand, side: TileId.Sand };
    case BlockId.Gravel:
      return { top: TileId.Gravel, bottom: TileId.Gravel, side: TileId.Gravel };
    case BlockId.Cactus:
      return { top: TileId.CactusTop, bottom: TileId.CactusTop, side: TileId.CactusSide };
    case BlockId.Sandstone:
      return { top: TileId.Sandstone, bottom: TileId.Sandstone, side: TileId.Sandstone };
    case BlockId.Water:
      return { top: TileId.Water, bottom: TileId.Water, side: TileId.Water };
    case BlockId.Lava:
      return { top: TileId.Lava, bottom: TileId.Lava, side: TileId.Lava };
    case BlockId.Glass:
      return { top: TileId.Glass, bottom: TileId.Glass, side: TileId.Glass };
    case BlockId.Ice:
      return { top: TileId.Ice, bottom: TileId.Ice, side: TileId.Ice };
    case BlockId.CoalOre:
      return { top: TileId.CoalOre, bottom: TileId.CoalOre, side: TileId.CoalOre };
    case BlockId.IronOre:
      return { top: TileId.IronOre, bottom: TileId.IronOre, side: TileId.IronOre };
    case BlockId.GoldOre:
      return { top: TileId.GoldOre, bottom: TileId.GoldOre, side: TileId.GoldOre };
    case BlockId.DiamondOre:
      return { top: TileId.DiamondOre, bottom: TileId.DiamondOre, side: TileId.DiamondOre };
    case BlockId.Deepslate:
      return { top: TileId.Deepslate, bottom: TileId.Deepslate, side: TileId.Deepslate };
    case BlockId.CobbledDeepslate:
      return { top: TileId.CobbledDeepslate, bottom: TileId.CobbledDeepslate, side: TileId.CobbledDeepslate };
    case BlockId.StoneBricks:
      return { top: TileId.StoneBricks, bottom: TileId.StoneBricks, side: TileId.StoneBricks };
    case BlockId.MossyCobblestone:
      return { top: TileId.MossyCobblestone, bottom: TileId.MossyCobblestone, side: TileId.MossyCobblestone };
    case BlockId.CraftingTable:
      return { top: TileId.CraftingTop, bottom: TileId.OakPlanks, side: TileId.CraftingSide };
    case BlockId.Furnace:
      return { top: TileId.FurnaceSide, bottom: TileId.FurnaceSide, side: TileId.FurnaceSide, front: TileId.FurnaceFront };
    case BlockId.Bookshelf:
      return { top: TileId.BookshelfTop, bottom: TileId.BookshelfTop, side: TileId.BookshelfSide };
    case BlockId.TNT:
      return { top: TileId.TNTTop, bottom: TileId.TNTTop, side: TileId.TNTSide };
    case BlockId.Bricks:
      return { top: TileId.Bricks, bottom: TileId.Bricks, side: TileId.Bricks };
    case BlockId.MudBricks:
      return { top: TileId.MudBricks, bottom: TileId.MudBricks, side: TileId.MudBricks };
    case BlockId.Snow:
      return { top: TileId.Snow, bottom: TileId.Snow, side: TileId.Snow };
    case BlockId.Bedrock:
      return { top: TileId.Bedrock, bottom: TileId.Bedrock, side: TileId.Bedrock };
    case BlockId.Obsidian:
      return { top: TileId.Obsidian, bottom: TileId.Obsidian, side: TileId.Obsidian };
    case BlockId.Netherrack:
      return { top: TileId.Netherrack, bottom: TileId.Netherrack, side: TileId.Netherrack };
    case BlockId.NetherBricks:
      return { top: TileId.NetherBricks, bottom: TileId.NetherBricks, side: TileId.NetherBricks };
    case BlockId.SoulSand:
      return { top: TileId.SoulSand, bottom: TileId.SoulSand, side: TileId.SoulSand };
    case BlockId.EndStone:
      return { top: TileId.EndStone, bottom: TileId.EndStone, side: TileId.EndStone };
    case BlockId.PurpurBlock:
      return { top: TileId.PurpurBlock, bottom: TileId.PurpurBlock, side: TileId.PurpurBlock };
    case BlockId.AmethystBlock:
      return { top: TileId.AmethystBlock, bottom: TileId.AmethystBlock, side: TileId.AmethystBlock };
    case BlockId.CopperBlock:
      return { top: TileId.CopperBlock, bottom: TileId.CopperBlock, side: TileId.CopperBlock };
    case BlockId.Glowstone:
      return { top: TileId.Glowstone, bottom: TileId.Glowstone, side: TileId.Glowstone };
    case BlockId.Torch:
      return { top: TileId.Torch, bottom: TileId.Torch, side: TileId.Torch };
    case BlockId.TallGrass:
      return { top: TileId.TallGrass, bottom: TileId.TallGrass, side: TileId.TallGrass };
    case BlockId.Poppy:
      return { top: TileId.Poppy, bottom: TileId.Poppy, side: TileId.Poppy };
    case BlockId.Dandelion:
      return { top: TileId.Dandelion, bottom: TileId.Dandelion, side: TileId.Dandelion };
    case BlockId.CherrySapling:
      return { top: TileId.CherrySapling, bottom: TileId.CherrySapling, side: TileId.CherrySapling };
    case BlockId.NetherPortal:
      return { top: TileId.NetherPortal, bottom: TileId.NetherPortal, side: TileId.NetherPortal };
    case BlockId.EndPortal:
      return { top: TileId.EndPortal, bottom: TileId.Obsidian, side: TileId.EndPortal };
    case BlockId.RedWool:
      return { top: TileId.RedWool, bottom: TileId.RedWool, side: TileId.RedWool };
    case BlockId.BlueWool:
      return { top: TileId.BlueWool, bottom: TileId.BlueWool, side: TileId.BlueWool };
    case BlockId.YellowWool:
      return { top: TileId.YellowWool, bottom: TileId.YellowWool, side: TileId.YellowWool };
    case BlockId.GreenWool:
      return { top: TileId.GreenWool, bottom: TileId.GreenWool, side: TileId.GreenWool };
    case BlockId.WhiteWool:
      return { top: TileId.WhiteWool, bottom: TileId.WhiteWool, side: TileId.WhiteWool };
    default:
      return { top: TileId.Stone, bottom: TileId.Stone, side: TileId.Stone };
  }
}

function drawTileFlatIcon(blockId: BlockId): string {
  const atlas = buildAtlasCanvas();
  const tiles = getBlockFaceTiles(blockId);
  const tile = tiles.side;
  const sx = (tile % ATLAS_GRID) * TILE_PX;
  const sy = Math.floor(tile / ATLAS_GRID) * TILE_PX;

  const out = document.createElement('canvas');
  out.width = 48;
  out.height = 48;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 4, 4, 40, 40);
  return out.toDataURL();
}

function drawTileToIsoCube(blockId: BlockId): string {
  const atlas = buildAtlasCanvas();
  const tiles = getBlockFaceTiles(blockId);

  const out = document.createElement('canvas');
  out.width = 48;
  out.height = 48;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const drawFace = (
    tile: TileId,
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    shade: number
  ) => {
    const sx = (tile % ATLAS_GRID) * TILE_PX;
    const sy = Math.floor(tile / ATLAS_GRID) * TILE_PX;

    const tmp = document.createElement('canvas');
    tmp.width = TILE_PX;
    tmp.height = TILE_PX;
    const tctx = tmp.getContext('2d')!;
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
    if (shade < 1) {
      tctx.fillStyle = `rgba(0,0,0,${1 - shade})`;
      tctx.fillRect(0, 0, TILE_PX, TILE_PX);
    }

    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(tmp, 0, 0, TILE_PX, TILE_PX, 0, 0, 16, 16);
    ctx.restore();
  };

  const cx = 24;
  const topY = 6;
  const rx = 18 / 16;
  const ry = 9 / 16;
  const h = 19 / 16;

  drawFace(tiles.top, rx, ry, -rx, ry, cx, topY, 1.0);
  drawFace(tiles.front ?? tiles.side, rx, ry, 0, h, cx - 18, topY + 9, 0.84);
  drawFace(tiles.side, rx, -ry, 0, h, cx, topY + 18, 0.68);

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
      p(i, 15 - i, '#8c6234');
      p(i, 14 - i, '#6b4721');
      if (i < 10) p(i + 1, 15 - i, '#4f3314');
    }
  };

  const toolColors: Record<number, [string, string, string]> = {
    [ItemId.WoodenPickaxe]: ['#ba9258', '#8f6932', '#d6b076'],
    [ItemId.StonePickaxe]: ['#8a8a8a', '#616161', '#adadad'],
    [ItemId.IronPickaxe]: ['#dcdcdc', '#9e9e9e', '#ffffff'],
    [ItemId.DiamondPickaxe]: ['#44e4e4', '#1ba1a6', '#a8ffff'],
    [ItemId.WoodenAxe]: ['#ba9258', '#8f6932', '#d6b076'],
    [ItemId.StoneAxe]: ['#8a8a8a', '#616161', '#adadad'],
    [ItemId.WoodenSword]: ['#ba9258', '#8f6932', '#d6b076'],
    [ItemId.StoneSword]: ['#8a8a8a', '#616161', '#adadad'],
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
      [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2],
      [11, 3], [12, 3], [12, 4], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10],
      [4, 3], [10, 3], [11, 4], [12, 5], [12, 6], [12, 7],
    ];
    for (const [x, y] of head) p(x, y, mid);
    p(6, 2, hi);
    p(8, 2, hi);
    p(10, 2, hi);
    p(12, 4, hi);
    p(13, 9, dark);
    p(13, 10, dark);
    p(4, 3, dark);
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
    p(2, 13, '#4f3314');
    p(3, 12, '#7a542c');
    p(4, 11, '#7a542c');
    p(3, 9, '#5e4527');
    p(4, 10, '#5e4527');
    p(5, 11, '#5e4527');
    p(6, 12, '#5e4527');
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
          p(x, y, (x + y) % 3 === 0 ? '#3b3b3b' : '#181818');
        }
      }
    }
    p(6, 6, '#525252');
  } else if (itemId === ItemId.IronIngot || itemId === ItemId.GoldIngot || itemId === ItemId.CopperIngot) {
    const isGold = itemId === ItemId.GoldIngot;
    const isCopper = itemId === ItemId.CopperIngot;
    const c1 = isGold ? '#f7d038' : isCopper ? '#d97852' : '#e0e0e0';
    const c2 = isGold ? '#c99714' : isCopper ? '#9e4c2e' : '#9e9e9e';
    const c3 = isGold ? '#fff296' : isCopper ? '#f5a684' : '#ffffff';
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
          p(x, y, d < 2.2 ? '#c4ffff' : d < 3.5 ? '#4ce8e8' : '#1daeb3');
        }
      }
    }
  } else if (itemId === ItemId.AmethystShard) {
    for (let y = 3; y <= 13; y++) {
      for (let x = 5; x <= 10; x++) {
        if (Math.abs(x - 7.5) <= (y - 2) * 0.45 && y <= 12) {
          p(x, y, y < 6 ? '#ebd6ff' : x < 7 ? '#a970f0' : '#713bb8');
        }
      }
    }
  } else if (itemId === ItemId.Apple) {
    p(7, 2, '#694520');
    p(8, 2, '#539e35');
    for (let y = 4; y <= 12; y++) {
      for (let x = 4; x <= 11; x++) {
        if (Math.hypot(x - 7.5, y - 8) < 4.4) {
          p(x, y, x < 7 && y < 7 ? '#ff6969' : '#c92424');
        }
      }
    }
    p(5, 5, '#ffb8b8');
  } else if (itemId === ItemId.Bread) {
    for (let y = 5; y <= 11; y++) {
      for (let x = 2; x <= 13; x++) {
        if (Math.hypot((x - 7.5) / 1.7, y - 8) < 3.6) {
          p(x, y, y <= 7 ? '#d99848' : '#b37127');
        }
      }
    }
    p(5, 6, '#f2c379');
    p(8, 6, '#f2c379');
    p(10, 7, '#f2c379');
  }

  return out.toDataURL();
}

export function getItemIconUrl(itemId: AnyItemId): string {
  const cached = iconCache.get(itemId);
  if (cached) return cached;

  const def = getItemDef(itemId);
  let url: string;
  if (def?.isBlock) {
    url = def.isCrossPlane ? drawTileFlatIcon(itemId as BlockId) : drawTileToIsoCube(itemId as BlockId);
  } else {
    url = drawPixelSprite(itemId);
  }
  iconCache.set(itemId, url);
  return url;
}
