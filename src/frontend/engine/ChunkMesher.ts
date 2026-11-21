import * as THREE from 'three';
import { BlockId } from '../../shared/types';
import { getItemDef, isBlockSolid, isBlockTransparent } from '../../shared/blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, IWorldProvider } from '../../shared/worldInterface';
import { ATLAS_GRID, getBlockFaceTiles, TileId } from './TextureAtlas';

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  uvOrder: [number, number][];
  shade: number;
  faceType: 'top' | 'bottom' | 'front' | 'side';
  // Tangent axes uAxis, vAxis for ambient occlusion corner sampling
  uAxis: [number, number, number];
  vAxis: [number, number, number];
  cornerSigns: [number, number][];
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
    uAxis: [1, 0, 0],
    vAxis: [0, 0, 1],
    cornerSigns: [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ],
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
    shade: 0.62,
    faceType: 'bottom',
    uAxis: [1, 0, 0],
    vAxis: [0, 0, 1],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
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
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
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
    uAxis: [1, 0, 0],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
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
    shade: 0.78,
    faceType: 'side',
    uAxis: [0, 0, 1],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [1, -1],
      [-1, -1],
      [-1, 1],
      [1, 1],
    ],
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
    shade: 0.78,
    faceType: 'side',
    uAxis: [0, 0, 1],
    vAxis: [0, 1, 0],
    cornerSigns: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
];

const AO_CURVE = [0.52, 0.7, 0.86, 1.0];

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

function isOccluder(world: IWorldProvider, x: number, y: number, z: number): number {
  if (y < 0 || y >= CHUNK_HEIGHT) return 0;
  const b = world.getBlock(x, y, z);
  return isBlockSolid(b) && !isBlockTransparent(b) ? 1 : 0;
}

function pushFace(
  buf: MeshBuffers,
  world: IWorldProvider,
  wx: number,
  wy: number,
  wz: number,
  face: FaceDef,
  tileId: TileId,
  yTopOffset = 0,
  enableAO = true
) {
  const baseIndex = buf.positions.length / 3;
  const tx = tileId % ATLAS_GRID;
  const ty = Math.floor(tileId / ATLAS_GRID);

  const eps = 0.0012;
  const uMin = tx / ATLAS_GRID + eps;
  const uMax = (tx + 1) / ATLAS_GRID - eps;
  const vMax = 1 - ty / ATLAS_GRID - eps;
  const vMin = 1 - (ty + 1) / ATLAS_GRID + eps;

  const nx = wx + face.dir[0];
  const ny = wy + face.dir[1];
  const nz = wz + face.dir[2];

  const aoVals: number[] = [3, 3, 3, 3];

  for (let i = 0; i < 4; i++) {
    const corner = face.corners[i];
    const cy = corner[1] === 1 ? 1 + yTopOffset : corner[1];
    buf.positions.push(wx + corner[0], wy + cy, wz + corner[2]);
    buf.normals.push(face.dir[0], face.dir[1], face.dir[2]);

    const [ou, ov] = face.uvOrder[i];
    buf.uvs.push(ou === 0 ? uMin : uMax, ov === 0 ? vMin : vMax);

    let shade = face.shade;
    if (enableAO) {
      const [su, sv] = face.cornerSigns[i];
      const s1 = isOccluder(
        world,
        nx + face.uAxis[0] * su,
        ny + face.uAxis[1] * su,
        nz + face.uAxis[2] * su
      );
      const s2 = isOccluder(
        world,
        nx + face.vAxis[0] * sv,
        ny + face.vAxis[1] * sv,
        nz + face.vAxis[2] * sv
      );
      const c =
        s1 && s2
          ? 1
          : isOccluder(
              world,
              nx + face.uAxis[0] * su + face.vAxis[0] * sv,
              ny + face.uAxis[1] * su + face.vAxis[1] * sv,
              nz + face.uAxis[2] * su + face.vAxis[2] * sv
            );
      const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
      aoVals[i] = ao;
      shade *= AO_CURVE[ao];
    }
    buf.colors.push(shade, shade, shade);
  }

  // Flip quad diagonal to keep AO interpolation symmetric
  if (aoVals[0] + aoVals[2] < aoVals[1] + aoVals[3]) {
    buf.indices.push(
      baseIndex + 1,
      baseIndex + 2,
      baseIndex + 3,
      baseIndex + 1,
      baseIndex + 3,
      baseIndex
    );
  } else {
    buf.indices.push(
      baseIndex,
      baseIndex + 1,
      baseIndex + 2,
      baseIndex,
      baseIndex + 2,
      baseIndex + 3
    );
  }
}

function pushCrossPlane(
  buf: MeshBuffers,
  wx: number,
  wy: number,
  wz: number,
  tileId: TileId,
  bright = 0.96
) {
  const tx = tileId % ATLAS_GRID;
  const ty = Math.floor(tileId / ATLAS_GRID);
  const eps = 0.0012;
  const uMin = tx / ATLAS_GRID + eps;
  const uMax = (tx + 1) / ATLAS_GRID - eps;
  const vMax = 1 - ty / ATLAS_GRID - eps;
  const vMin = 1 - (ty + 1) / ATLAS_GRID + eps;

  const quads: [[number, number, number], [number, number, number], [number, number, number]][] = [
    [
      [0.14, 0, 0.14],
      [0.86, 0, 0.86],
      [0.707, 0, -0.707],
    ],
    [
      [0.14, 0, 0.86],
      [0.86, 0, 0.14],
      [0.707, 0, 0.707],
    ],
  ];

  for (const [p0, p1, n] of quads) {
    const baseIndex = buf.positions.length / 3;
    const verts: [number, number, number, number, number][] = [
      [wx + p0[0], wy, wz + p0[2], uMin, vMin],
      [wx + p1[0], wy, wz + p1[2], uMax, vMin],
      [wx + p1[0], wy + 1, wz + p1[2], uMax, vMax],
      [wx + p0[0], wy + 1, wz + p0[2], uMin, vMax],
    ];
    for (const [px, py, pz, u, v] of verts) {
      buf.positions.push(px, py, pz);
      buf.normals.push(n[0], n[1], n[2]);
      buf.uvs.push(u, v);
      buf.colors.push(bright, bright, bright);
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
}

export interface ChunkMeshResult {
  opaque: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
  cutout: THREE.BufferGeometry | null;
  emissive: THREE.BufferGeometry | null;
}

export function buildChunkGeometry(
  world: IWorldProvider,
  cx: number,
  cz: number
): ChunkMeshResult {
  const opaqueBuf = createBuffers();
  const waterBuf = createBuffers();
  const cutoutBuf = createBuffers();
  const emissiveBuf = createBuffers();

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
        const def = getItemDef(blockId);
        const tiles = getBlockFaceTiles(blockId);

        if (def?.isCrossPlane) {
          const target = def.emissive ? emissiveBuf : cutoutBuf;
          pushCrossPlane(target, wx, y, wz, tiles.side, def.emissive ? 1.1 : 0.94);
          continue;
        }

        const isWater = blockId === BlockId.Water;
        const isEmissive = Boolean(def?.emissive);
        const isCutout =
          !isWater &&
          !isEmissive &&
          (blockId === BlockId.Glass ||
            blockId === BlockId.OakLeaves ||
            blockId === BlockId.BirchLeaves ||
            blockId === BlockId.SpruceLeaves ||
            blockId === BlockId.CherryLeaves);

        const targetBuf = isWater
          ? waterBuf
          : isEmissive
            ? emissiveBuf
            : isCutout
              ? cutoutBuf
              : opaqueBuf;

        for (const face of FACES) {
          const nx = wx + face.dir[0];
          const ny = y + face.dir[1];
          const nz = wz + face.dir[2];

          const neighbor = ny < 0 || ny >= CHUNK_HEIGHT ? BlockId.Air : world.getBlock(nx, ny, nz);

          if (isWater) {
            if (neighbor !== BlockId.Air && !isBlockTransparent(neighbor)) {
              continue;
            }
            if (neighbor === BlockId.Water) continue;
          } else if (blockId === BlockId.Lava) {
            if (neighbor === BlockId.Lava) continue;
            if (neighbor !== BlockId.Air && !isBlockTransparent(neighbor)) continue;
          } else if (isCutout || blockId === BlockId.NetherPortal) {
            if (neighbor === blockId || (!isBlockTransparent(neighbor) && neighbor !== BlockId.Air)) {
              continue;
            }
          } else {
            if (neighbor !== BlockId.Air && !isBlockTransparent(neighbor)) {
              continue;
            }
          }

          let tile = tiles.side;
          if (face.faceType === 'top') tile = tiles.top;
          else if (face.faceType === 'bottom') tile = tiles.bottom;
          else if (face.faceType === 'front' && tiles.front !== undefined) tile = tiles.front;

          const topOffset =
            (isWater && world.getBlock(wx, y + 1, wz) !== BlockId.Water) ||
            (blockId === BlockId.Lava && world.getBlock(wx, y + 1, wz) !== BlockId.Lava)
              ? -0.14
              : 0;

          pushFace(
            targetBuf,
            world,
            wx,
            y,
            wz,
            face,
            tile,
            topOffset,
            !isWater && !isEmissive && !isCutout
          );
        }
      }
    }
  }

  return {
    opaque: finalizeGeometry(opaqueBuf),
    water: finalizeGeometry(waterBuf),
    cutout: finalizeGeometry(cutoutBuf),
    emissive: finalizeGeometry(emissiveBuf),
  };
}
