// Ported from Minecraft-2hrs (MobTypes.js & EntityManager.js) in Node-22 TS
import type { DimensionId, MobEntityDto, MobType } from '../shared/types.ts';
import { BLOCK_ID, ITEM_ID } from './blockIds.ts';

export interface MobDrop {
  itemId: number;
  count: number;
  chance: number;
}

export interface MobSpec {
  type: MobType;
  name: string;
  category: 'passive' | 'hostile';
  width: number;
  height: number;
  maxHealth: number;
  walkSpeed: number;
  drops: MobDrop[];
  palette: { primary: number; secondary: number; accent: number };
}

export const MOB_SPECS: Record<MobType, MobSpec> = {
  sheep: {
    type: 'sheep',
    name: 'Sheep',
    category: 'passive',
    width: 0.85,
    height: 1.25,
    maxHealth: 8,
    walkSpeed: 1.8,
    drops: [{ itemId: BLOCK_ID.WhiteWool, count: 1, chance: 1 }],
    palette: { primary: 0xf2f0eb, secondary: 0xd9c2a3, accent: 0x3a3734 },
  },
  cow: {
    type: 'cow',
    name: 'Cow',
    category: 'passive',
    width: 0.9,
    height: 1.35,
    maxHealth: 10,
    walkSpeed: 1.7,
    drops: [{ itemId: ITEM_ID.Apple, count: 1, chance: 0.8 }],
    palette: { primary: 0x5c402c, secondary: 0xd9d2c5, accent: 0x2a2018 },
  },
  zombie: {
    type: 'zombie',
    name: 'Zombie',
    category: 'hostile',
    width: 0.65,
    height: 1.85,
    maxHealth: 20,
    walkSpeed: 1.95,
    drops: [
      { itemId: ITEM_ID.Coal, count: 1, chance: 0.75 },
      { itemId: ITEM_ID.IronIngot, count: 1, chance: 0.3 },
    ],
    palette: { primary: 0x4b7f48, secondary: 0x268596, accent: 0x353b73 },
  },
  slime: {
    type: 'slime',
    name: 'Slime',
    category: 'hostile',
    width: 0.9,
    height: 0.9,
    maxHealth: 12,
    walkSpeed: 1.6,
    drops: [
      { itemId: ITEM_ID.Apple, count: 1, chance: 0.5 },
      { itemId: ITEM_ID.Stick, count: 2, chance: 0.6 },
    ],
    palette: { primary: 0x67c954, secondary: 0x489c39, accent: 0x1e3819 },
  },
};

interface InternalMob extends MobEntityDto {
  wanderTimer: number;
  lastTickAt: number;
}

export class MobService {
  private mobsByKey = new Map<string, InternalMob[]>();
  private nextId = 1;

  private keyFor(worldId: string, dim: DimensionId): string {
    return `${worldId}:${dim}`;
  }

  public getOrSpawnMobs(
    worldId: string,
    dim: DimensionId,
    getSurfaceY: (wx: number, wz: number) => number,
    playerX = 0,
    playerZ = 0
  ): MobEntityDto[] {
    const key = this.keyFor(worldId, dim);
    let list = this.mobsByKey.get(key);
    if (!list) {
      list = [];
      this.mobsByKey.set(key, list);
    }

    // Remove dead mobs & repopulate up to target herd size
    list = list.filter((m) => m.health > 0);
    const targetCount = dim === 'overworld' ? 6 : 4;

    while (list.length < targetCount) {
      const idx = list.length;
      const angle = (idx / targetCount) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 8 + Math.random() * 14;
      const wx = Math.round(playerX + Math.cos(angle) * dist);
      const wz = Math.round(playerZ + Math.sin(angle) * dist);
      const sy = getSurfaceY(wx, wz);
      const spawnY = Math.max(12, sy + 1);

      let mobType: MobType = 'sheep';
      if (dim === 'nether') {
        mobType = idx % 2 === 0 ? 'zombie' : 'slime';
      } else if (dim === 'end') {
        mobType = 'slime';
      } else {
        const pool: MobType[] = ['sheep', 'cow', 'sheep', 'cow', 'slime', 'zombie'];
        mobType = pool[idx % pool.length];
      }

      const spec = MOB_SPECS[mobType];
      list.push({
        id: this.nextId++,
        type: spec.type,
        name: spec.name,
        category: spec.category,
        x: wx + 0.5,
        y: spawnY,
        z: wz + 0.5,
        yaw: Math.random() * Math.PI * 2,
        width: spec.width,
        height: spec.height,
        health: spec.maxHealth,
        maxHealth: spec.maxHealth,
        hurtTimer: 0,
        walkPhase: 0,
        palette: spec.palette,
        wanderTimer: 1 + Math.random() * 2.5,
        lastTickAt: Date.now(),
      });
    }

    // Step lightweight server AI wander & ground snapping
    const now = Date.now();
    for (const mob of list) {
      const dt = Math.min(0.5, Math.max(0.05, (now - mob.lastTickAt) / 1000));
      mob.lastTickAt = now;
      mob.hurtTimer = Math.max(0, mob.hurtTimer - dt);
      mob.wanderTimer -= dt;

      if (mob.wanderTimer <= 0) {
        mob.wanderTimer = 1.6 + Math.random() * 3.0;
        mob.yaw += (Math.random() - 0.5) * 2.2;
      }

      const speed = MOB_SPECS[mob.type].walkSpeed * 0.55;
      const nx = mob.x - Math.sin(mob.yaw) * speed * dt;
      const nz = mob.z - Math.cos(mob.yaw) * speed * dt;

      if (Math.hypot(nx - playerX, nz - playerZ) < 36) {
        const nextSurface = getSurfaceY(Math.floor(nx), Math.floor(nz));
        if (Math.abs(nextSurface + 1 - mob.y) <= 2) {
          mob.x = nx;
          mob.z = nz;
          mob.y = nextSurface + 1;
          mob.walkPhase += speed * dt * 4.5;
        } else {
          mob.yaw += Math.PI * 0.75;
        }
      } else {
        mob.yaw += Math.PI;
      }
    }

    this.mobsByKey.set(key, list);
    return list.map(({ wanderTimer: _w, lastTickAt: _t, ...dto }) => dto);
  }

  public hitMob(
    worldId: string,
    dim: DimensionId,
    mobId: number,
    damage: number,
    attackerX?: number,
    attackerZ?: number
  ): {
    mob: MobEntityDto | null;
    killed: boolean;
    drops: { itemId: number; count: number }[];
    xp: number;
  } | null {
    const key = this.keyFor(worldId, dim);
    const list = this.mobsByKey.get(key);
    if (!list) return null;

    const mob = list.find((m) => m.id === mobId);
    if (!mob) return null;

    const cleanDmg = Math.max(1, Math.min(25, Math.floor(damage)));
    mob.health = Math.max(0, mob.health - cleanDmg);
    mob.hurtTimer = 0.35;

    if (typeof attackerX === 'number' && typeof attackerZ === 'number') {
      const dx = mob.x - attackerX;
      const dz = mob.z - attackerZ;
      const dist = Math.hypot(dx, dz) || 1;
      mob.x += (dx / dist) * 0.7;
      mob.z += (dz / dist) * 0.7;
    }

    const killed = mob.health <= 0;
    const drops: { itemId: number; count: number }[] = [];
    let xp = 0;

    if (killed) {
      const spec = MOB_SPECS[mob.type];
      for (const drop of spec.drops) {
        if (Math.random() <= drop.chance) {
          drops.push({ itemId: drop.itemId, count: drop.count });
        }
      }
      xp = spec.category === 'hostile' ? 5 : 2;
      this.mobsByKey.set(
        key,
        list.filter((m) => m.id !== mobId)
      );
    }

    const { wanderTimer: _w, lastTickAt: _t, ...dto } = mob;
    return { mob: killed ? null : dto, killed, drops, xp };
  }
}
