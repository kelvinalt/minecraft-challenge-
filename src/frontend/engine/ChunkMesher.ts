import * as THREE from 'three';
import { BlockId } from '../../shared/types';
import { isBlockTransparent } from '../../shared/blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, IWorldProvider } from '../../shared/worldInterface';
import { ATLAS_GRID, getBlockFaceTiles, TileId } from './TextureAtlas';

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  uvOrder: [number, number][];
  shade: number;
  faceType: 'top' | 'bottom' | 'front' | 'side';
}

const FACES: FaceDef[] = [
  // +Y Top
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 1.0,
    faceType: 'top',
  },
  // -Y Bottom
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.58,
    faceType: 'bottom',
  },
  // +Z Front
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.88,
    faceType: 'front',
  },
  // -Z Back
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.84,
    faceType: 'side',
  },
  // +X Right
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.76,
    faceType: 'side',
  },
  // -X Left
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    uvOrder: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    shade: 0.76,
    faceType: 'side',
  },
];

interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function createBuffers(): MeshBuffers {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

function finalizeGeometry(buf: MeshBuffers): THREE.BufferGeometry | null {
  if (buf.positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices);
  geo.computeBoundingSphere();
  return geo;
}

function pushFace(
  buf: MeshBuffers,
  wx: number,
  wy: number,
  wz: number,
  face: FaceDef,
  tileId: TileId,
  yTopOffset = 0
) {
  const baseIndex = buf.positions.length / 3;
  const tx = tileId % ATLAS_GRID;
  const ty = Math.floor(tileId / ATLAS_GRID);

  // Small epsilon inset prevents texture atlas seam bleeding
  const eps = 0.0015;
  const uMin = tx / ATLAS_GRID + eps;
  const uMax = (tx + 1) / ATLAS_GRID - eps;
  const vMax = 1 - ty / ATLAS_GRID - eps;
  const vMin = 1 - (ty + 1) / ATLAS_GRID + eps;

  for (let i = 0; i < 4; i++) {
    const corner = face.corners[i];
    const cy = corner[1] === 1 ? 1 + yTopOffset : corner[1];
    buf.positions.push(wx + corner[0], wy + cy, wz + corner[2]);
    buf.normals.push(face.dir[0], face.dir[1], face.dir[2]);

    const [ou, ov] = face.uvOrder[i];
    buf.uvs.push(ou === 0 ? uMin : uMax, ov === 0 ? vMin : vMax);
    buf.colors.push(face.shade, face.shade, face.shade);
  }

  buf.indices.push(
    baseIndex,
    baseIndex + 1,
    baseIndex + 2,
    baseIndex,
    baseIndex + 2,
    baseIndex + 3
  );
}

export interface ChunkMeshResult {
  opaque: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  cutout: THREE.BufferGeometry | null;
}

export function buildChunkGeometry(
  world: IWorldProvider,
  cx: number,
  cz: number
): ChunkMeshResult {
  const opaqueBuf = createBuffers();
  const waterBuf = createBuffers();
  const cutoutBuf = createBuffers();

  const chunk = world.getChunk(cx, cz);
  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const blockId = chunk.blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] as BlockId;
        if (blockId === BlockId.Air) continue;

        const wx = startX + lx;
        const wz = startZ + lz;
        const tiles = getBlockFaceTiles(blockId);
        const isWater = blockId === BlockId.Water;
        const isCutout = blockId === BlockId.Glass || blockId === BlockId.OakLeaves;
        const targetBuf = isWater ? waterBuf : isCutout ? cutoutBuf : opaqueBuf;

        for (const face of FACES) {
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];

          const neighbor = ny < 0 || ny >= CHUNK_HEIGHT ? BlockId.Air : world.getBlock(nx, ny, nz);

          if (isWater) {
            // Only render water face against air (never against solid or other water)
            if (neighbor !== BlockId.Air && neighbor !== BlockId.Glass && neighbor !== BlockId.OakLeaves) {
              continue;
            }
          } else if (isCutout) {
            if (neighbor === blockId || (!isBlockTransparent(neighbor) && neighbor !== BlockId.Air)) {
              continue;
            }
          } else {
            // Opaque block: cull against any opaque neighbor
            if (neighbor !== BlockId.Air && !isBlockTransparent(neighbor)) {
              continue;
            }
          }

          let tile = tiles.side;
          if (face.faceType === 'top') tile = tiles.top;
          else if (face.faceType === 'bottom') tile = tiles.bottom;
          else if (face.faceType === 'front' && tiles.front !== undefined) tile = tiles.front;

          const topOffset = isWater && world.getBlock(wx, y + 1, wz) !== BlockId.Water ? -0.14 : 0;
          pushFace(targetBuf, wx, y, wz, face, tile, topOffset);
        }
      }
    }
  }

  return {
    opaque: finalizeGeometry(opaqueBuf),
    water: finalizeGeometry(waterBuf),
    cutout: finalizeGeometry(cutoutBuf),
  };
}
