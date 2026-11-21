import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import type { DimensionId } from './src/shared/types.ts';
import {
  BLOCK_ID,
  CROSS_PLANE_IDS,
  VALID_DIMENSIONS,
  isFluidBlock,
} from './src/backend/blockIds.ts';
import { MOB_SPECS, MobService } from './src/backend/MobService.ts';
import { WorldRepository, isValidWorldId } from './src/backend/WorldRepository.ts';

const PORT = 3000;
const HOST = '0.0.0.0';
const startedAt = Date.now();

const repo = new WorldRepository();
const mobService = new MobService();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] ?? '' : val ?? '';
}

function parseIntParam(raw: string): number | null {
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 100000) return null;
  return n;
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'blockcraft-server',
    worldsCount: repo.listWorlds().length,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  });
});

app.get('/api/blocks', (_req: Request, res: Response) => {
  const blocks = Object.entries(BLOCK_ID).map(([name, id]) => ({
    id,
    name,
    fluid: isFluidBlock(id),
    crossPlane: CROSS_PLANE_IDS.has(id),
  }));
  res.json({ blocks, mobs: Object.values(MOB_SPECS) });
});

app.get('/api/worlds', (_req: Request, res: Response) => {
  res.json({ worlds: repo.listWorlds() });
});

app.post('/api/worlds', (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const world = repo.createWorld({
    name: body.name,
    seed: body.seed,
    gameMode: body.gameMode,
    terrainType: body.terrainType,
  });
  res.status(201).json({ world });
});

app.get('/api/worlds/:id', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  const world = repo.getWorld(id);
  if (!world) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  res.json({ world });
});

app.put('/api/worlds/:id/state', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  const patch = req.body && typeof req.body === 'object' ? req.body : {};
  const updated = repo.saveWorldState(id, patch as Record<string, unknown>);
  if (!updated) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  res.json({ world: updated });
});

app.delete('/api/worlds/:id', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  const deleted = repo.deleteWorld(id);
  if (!deleted) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  res.json({ ok: true, id });
});

app.get('/api/worlds/:id/chunks/:dim/:cx/:cz', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  const dim = paramStr(req.params.dim) as DimensionId;
  const cx = parseIntParam(paramStr(req.params.cx));
  const cz = parseIntParam(paramStr(req.params.cz));

  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  if (!VALID_DIMENSIONS.includes(dim)) {
    res.status(400).json({ error: 'Invalid dimension' });
    return;
  }
  if (cx === null || cz === null) {
    res.status(400).json({ error: 'Invalid chunk coordinates' });
    return;
  }

  const chunk = repo.generateChunk(id, dim, cx, cz);
  if (!chunk) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  res.json(chunk);
});

app.post('/api/worlds/:id/blocks', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const dim = body.dimension as DimensionId;
  const wx = Number(body.wx);
  const wy = Number(body.wy);
  const wz = Number(body.wz);
  const blockId = Number(body.blockId);

  if (!VALID_DIMENSIONS.includes(dim)) {
    res.status(400).json({ error: 'Invalid dimension' });
    return;
  }
  const result = repo.setBlock(id, dim, wx, wy, wz, blockId);
  if (!result) {
    res.status(400).json({ error: 'Invalid block update or world not found' });
    return;
  }
  res.json({ ok: true, fluidEdits: result.fluidEdits });
});

app.get('/api/worlds/:id/mobs', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  const world = repo.getWorld(id);
  if (!world) {
    res.status(404).json({ error: 'World not found' });
    return;
  }
  const rawDim = typeof req.query.dim === 'string' ? req.query.dim : world.dimension ?? 'overworld';
  const dim = (VALID_DIMENSIONS.includes(rawDim as DimensionId) ? rawDim : 'overworld') as DimensionId;
  const rawPx = Number(req.query.px);
  const rawPz = Number(req.query.pz);
  const px = Number.isFinite(rawPx) ? Math.max(-100000, Math.min(100000, rawPx)) : 0;
  const pz = Number.isFinite(rawPz) ? Math.max(-100000, Math.min(100000, rawPz)) : 0;

  const mobs = mobService.getOrSpawnMobs(
    id,
    dim,
    (wx, wz) => repo.getSurfaceHeightAt(id, dim, wx, wz),
    px,
    pz
  );
  res.json({ mobs });
});

app.post('/api/worlds/:id/mobs/:mobId/hit', (req: Request, res: Response) => {
  const id = paramStr(req.params.id);
  if (!isValidWorldId(id)) {
    res.status(400).json({ error: 'Invalid world ID' });
    return;
  }
  const mobId = parseIntParam(paramStr(req.params.mobId));
  if (mobId === null || mobId <= 0) {
    res.status(400).json({ error: 'Invalid mob ID' });
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const dim = (
    VALID_DIMENSIONS.includes(body.dimension as DimensionId) ? body.dimension : 'overworld'
  ) as DimensionId;
  const damage = Number.isFinite(Number(body.damage)) ? Number(body.damage) : 2;
  const px = Number.isFinite(Number(body.px)) ? Number(body.px) : undefined;
  const pz = Number.isFinite(Number(body.pz)) ? Number(body.pz) : undefined;

  const result = mobService.hitMob(id, dim, mobId, damage, px, pz);
  if (!result) {
    res.status(404).json({ error: 'Mob not found' });
    return;
  }
  res.json({ ok: true, ...result });
});

app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({ settings: repo.getSettings() });
});

app.put('/api/settings', (req: Request, res: Response) => {
  const patch = req.body && typeof req.body === 'object' ? req.body : {};
  const settings = repo.saveSettings(patch as Record<string, unknown>);
  res.json({ settings });
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.resolve(distDir, 'index.html');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(500).send('Production build missing. Run npm run build first.');
      }
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(PORT, HOST, () => {
    console.log(`BlockCraft full-stack server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
