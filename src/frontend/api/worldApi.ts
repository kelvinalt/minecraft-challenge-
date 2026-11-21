import {
  DimensionId,
  GameMode,
  GameSettings,
  MobEntityDto,
  TerrainType,
  WorldConfig,
} from '../../shared/types';

export interface FluidEdit {
  wx: number;
  wy: number;
  wz: number;
  blockId: number;
}

export interface MobHitResponse {
  ok: boolean;
  mob: MobEntityDto | null;
  killed: boolean;
  drops: { itemId: number; count: number }[];
  xp: number;
}

export interface ServerChunkResponse {
  cx: number;
  cz: number;
  dimension: DimensionId;
  blocksBase64: string;
  surfaceY: number;
  biome: string;
}

export function decodeChunkBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const worldApi = {
  async listWorlds(): Promise<WorldConfig[] | null> {
    const data = await jsonFetch<{ worlds: WorldConfig[] }>('/api/worlds');
    return data?.worlds ?? null;
  },

  async getWorld(worldId: string): Promise<WorldConfig | null> {
    const data = await jsonFetch<{ world: WorldConfig }>(
      `/api/worlds/${encodeURIComponent(worldId)}`
    );
    return data?.world ?? null;
  },

  async createWorld(payload: {
    name: string;
    seed: string;
    gameMode: GameMode;
    terrainType: TerrainType;
  }): Promise<WorldConfig | null> {
    const data = await jsonFetch<{ world: WorldConfig }>('/api/worlds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data?.world ?? null;
  },

  async saveWorldState(
    worldId: string,
    patch: Omit<Partial<WorldConfig>, 'playerPosition'> & {
      playerPosition?: [number, number, number] | null;
    }
  ): Promise<WorldConfig | null> {
    const data = await jsonFetch<{ world: WorldConfig }>(
      `/api/worlds/${encodeURIComponent(worldId)}/state`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    );
    return data?.world ?? null;
  },

  async deleteWorld(worldId: string): Promise<boolean> {
    const data = await jsonFetch<{ ok: boolean }>(
      `/api/worlds/${encodeURIComponent(worldId)}`,
      { method: 'DELETE' }
    );
    return Boolean(data?.ok);
  },

  async fetchChunk(
    worldId: string,
    dimension: DimensionId,
    cx: number,
    cz: number
  ): Promise<ServerChunkResponse | null> {
    return jsonFetch<ServerChunkResponse>(
      `/api/worlds/${encodeURIComponent(worldId)}/chunks/${dimension}/${cx}/${cz}`
    );
  },

  async setBlock(
    worldId: string,
    dimension: DimensionId,
    wx: number,
    wy: number,
    wz: number,
    blockId: number
  ): Promise<{ ok: boolean; fluidEdits: FluidEdit[] }> {
    const data = await jsonFetch<{ ok: boolean; fluidEdits?: FluidEdit[] }>(
      `/api/worlds/${encodeURIComponent(worldId)}/blocks`,
      {
        method: 'POST',
        body: JSON.stringify({ dimension, wx, wy, wz, blockId }),
      }
    );
    return {
      ok: Boolean(data?.ok),
      fluidEdits: Array.isArray(data?.fluidEdits) ? data.fluidEdits : [],
    };
  },

  async getMobs(
    worldId: string,
    dimension: DimensionId,
    px: number,
    pz: number
  ): Promise<MobEntityDto[] | null> {
    const qs = new URLSearchParams({
      dim: dimension,
      px: px.toFixed(1),
      pz: pz.toFixed(1),
    });
    const data = await jsonFetch<{ mobs: MobEntityDto[] }>(
      `/api/worlds/${encodeURIComponent(worldId)}/mobs?${qs.toString()}`
    );
    return data?.mobs ?? null;
  },

  async hitMob(
    worldId: string,
    dimension: DimensionId,
    mobId: number,
    damage: number,
    px: number,
    pz: number
  ): Promise<MobHitResponse | null> {
    return jsonFetch<MobHitResponse>(
      `/api/worlds/${encodeURIComponent(worldId)}/mobs/${mobId}/hit`,
      {
        method: 'POST',
        body: JSON.stringify({ dimension, damage, px, pz }),
      }
    );
  },

  async getSettings(): Promise<GameSettings | null> {
    const data = await jsonFetch<{ settings: GameSettings }>('/api/settings');
    return data?.settings ?? null;
  },

  async saveSettings(patch: Partial<GameSettings>): Promise<GameSettings | null> {
    const data = await jsonFetch<{ settings: GameSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return data?.settings ?? null;
  },
};
