import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AnyItemId,
  BlockId,
  DebugTelemetry,
  GameMode,
  GameSettings,
  RaycastHit,
} from '../../shared/types';
import { getItemDef, isBlockSolid } from '../../shared/blocks';
import { CHUNK_HEIGHT, CHUNK_SIZE, IWorldProvider, WATER_LEVEL } from '../../shared/worldInterface';
import { buildChunkGeometry } from './ChunkMesher';
import { createAtlasTexture } from './TextureAtlas';
import { soundFX } from './SoundFX';

// Reusable module-level math objects (Zero GC inside render loop)
const _vForward = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vRayOrigin = new THREE.Vector3();
const _vRayDir = new THREE.Vector3();
const _vSkyColor = new THREE.Color();
const _vDaySky = new THREE.Color(0x7fb4ff);
const _vSunsetSky = new THREE.Color(0xe68c5c);
const _vNightSky = new THREE.Color(0x0c1324);

export interface VoxelEngineCallbacks {
  onTelemetry: (telemetry: DebugTelemetry) => void;
  onHitChange: (hit: RaycastHit | null) => void;
  onMiningProgress: (progress: number) => void; // 0 to 1
  onBreakBlock: (pos: [number, number, number], blockId: BlockId) => void;
  onPlaceBlock: (pos: [number, number, number], normal: [number, number, number]) => void;
  onInteractBlock: (pos: [number, number, number], blockId: BlockId) => boolean; // true if handled (e.g. Crafting Table)
  onSelectHotbarIndex: (index: number) => void;
  onPauseRequest: () => void;
  onToggleInventory: () => void;
  onToggleDebug: () => void;
  onPointerLockChange: (locked: boolean) => void;
  onWebGLContextLost: (lost: boolean) => void;
  onPlayerHurt: (damage: number) => void;
  onConsumeHunger: (amount: number) => void;
}

interface ChunkMeshGroup {
  opaqueMesh?: THREE.Mesh;
  waterMesh?: THREE.Mesh;
  cutoutMesh?: THREE.Mesh;
}

interface BreakParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export class VoxelEngine {
  private container: HTMLElement;
  private world: IWorldProvider;
  private callbacks: VoxelEngineCallbacks;
  private settings: GameSettings;
  private gameMode: GameMode;
  private heldItem: AnyItemId | null = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private atlasTexture!: THREE.CanvasTexture;
  private opaqueMaterial!: THREE.MeshStandardMaterial;
  private cutoutMaterial!: THREE.MeshStandardMaterial;
  private waterMaterial!: THREE.MeshStandardMaterial;

  private chunkMeshes = new Map<string, ChunkMeshGroup>();
  private worldGroup = new THREE.Group();
  private cloudGroup = new THREE.Group();
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Target block highlight & mining crack box
  private highlightMesh!: THREE.LineSegments;
  private crackMesh!: THREE.Mesh;
  private crackTextures: THREE.CanvasTexture[] = [];

  // First-person held hand/block viewmodel
  private handScene!: THREE.Scene;
  private handCamera!: THREE.PerspectiveCamera;
  private handPivot = new THREE.Group();
  private handCube!: THREE.Mesh;
  private handArm!: THREE.Mesh;
  private swingProgress = 0;
  private isSwinging = false;

  // Particles
  private particles: BreakParticle[] = [];
  private particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);

  // Player state
  public playerPos = new THREE.Vector3(0.5, 25, 0.5);
  public velocity = new THREE.Vector3(0, 0, 0);
  public yaw = 0; // radians
  public pitch = -0.15;
  private isGrounded = false;
  private isFlying = false;
  private isSubmerged = false;
  private lastSpaceTap = 0;
  private fallStartY: number | null = null;
  private stepDist = 0;
  private bobPhase = 0;
  public timeOfDay = 0.28; // 0..1 (0.25 morning, 0.5 noon, 0.75 dusk, 0.0 midnight)
  private dayCount = 1;

  // Input state
  private keys = new Set<string>();
  private isPointerLocked = false;
  private isActive = false;
  private isMouseDownLeft = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private currentHit: RaycastHit | null = null;
  private miningBlockKey: string | null = null;
  private miningTimer = 0;

  // Loop & timing
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private telemetryTimer = 0;

  constructor(
    container: HTMLElement,
    world: IWorldProvider,
    initialPos: [number, number, number],
    initialTimeOfDay: number,
    gameMode: GameMode,
    settings: GameSettings,
    callbacks: VoxelEngineCallbacks
  ) {
    this.container = container;
    this.world = world;
    this.playerPos.set(initialPos[0], initialPos[1], initialPos[2]);
    this.timeOfDay = initialTimeOfDay;
    this.gameMode = gameMode;
    this.settings = { ...settings };
    this.callbacks = callbacks;

    this.initRenderer();
    this.initScene();
    this.initHandViewmodel();
    this.initSelectionAndCrackOverlays();
    this.bindEvents();
    this.updateLoadedChunks(true);
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRenderer() {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onWebGLContextLost(true);
  };

  private handleContextRestored = () => {
    this.callbacks.onWebGLContextLost(false);
  };

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7fb4ff);
    this.scene.fog = new THREE.Fog(0x7fb4ff, 28, this.settings.renderDistance * CHUNK_SIZE * 1.05);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, width / height, 0.08, 320);

    // Studio environment reflection for subtle PBR crispness
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    // Warm sun directional + cool hemisphere fill
    this.hemiLight = new THREE.HemisphereLight(0xd9ecff, 0x4b5545, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.35);
    this.keyLight.position.set(45, 85, 35);
    this.keyLight.castShadow = !this.isSoftwareGl && this.settings.shadowsEnabled;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 200;
    const d = 48;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    // Celestial Sun & Moon
    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe484, fog: false })
    );
    this.scene.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xdbe6ff, fog: false })
    );
    this.scene.add(this.moonMesh);

    // Procedural blocky clouds
    const cloudGeo = new THREE.BoxGeometry(14, 1.8, 9);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(cloudGeo, cloudMat);
      c.position.set(((i * 37) % 180) - 90, 56 + (i % 3) * 2, ((i * 53) % 180) - 90);
      c.scale.set(0.7 + (i % 4) * 0.3, 1, 0.8 + (i % 3) * 0.35);
      this.cloudGroup.add(c);
    }
    this.scene.add(this.cloudGroup);

    // Block atlas materials
    this.atlasTexture = createAtlasTexture();
    this.atlasTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTexture,
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
    });

    this.cutoutMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTexture,
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.02,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
    });

    this.waterMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTexture,
      vertexColors: true,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.scene.add(this.worldGroup);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initHandViewmodel() {
    this.handScene = new THREE.Scene();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.handCamera = new THREE.PerspectiveCamera(58, width / height, 0.05, 10);

    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(1, 2, 2);
    this.handScene.add(light);
    this.handScene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // Bare arm
    const armGeo = new THREE.BoxGeometry(0.24, 0.65, 0.24);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xc99374, roughness: 0.85 });
    this.handArm = new THREE.Mesh(armGeo, armMat);
    this.handArm.position.set(0.55, -0.52, -0.78);
    this.handArm.rotation.set(0.55, -0.35, 0.22);

    // Held block miniature
    const cubeGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x67a93f,
      roughness: 0.85,
    });
    this.handCube = new THREE.Mesh(cubeGeo, cubeMat);
    this.handCube.position.set(0.52, -0.36, -0.76);
    this.handCube.rotation.set(0.18, -0.65, 0.08);
    this.handCube.visible = false;

    this.handPivot.add(this.handArm);
    this.handPivot.add(this.handCube);
    this.handScene.add(this.handPivot);
  }

  private initSelectionAndCrackOverlays() {
    const box = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const edges = new THREE.EdgesGeometry(box);
    this.highlightMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 })
    );
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Build 5 crack overlay stages procedurally
    for (let stage = 0; stage < 5; stage++) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = 'rgba(15, 15, 15, 0.78)';
      const lines = (stage + 1) * 4;
      for (let i = 0; i < lines; i++) {
        const rx = (i * 5 + stage * 3) % 14;
        const ry = (i * 7 + stage * 2) % 14;
        ctx.fillRect(rx, ry, 2, 1);
        ctx.fillRect(rx + 1, ry + 1, 1, 2);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this.crackTextures.push(tex);
    }

    const crackGeo = new THREE.BoxGeometry(1.012, 1.012, 1.012);
    const crackMat = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.crackMesh = new THREE.Mesh(crackGeo, crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);
  }

  public setHeldItem(itemId: AnyItemId | null) {
    this.heldItem = itemId;
    if (!itemId) {
      this.handArm.visible = true;
      this.handCube.visible = false;
      return;
    }
    const def = getItemDef(itemId);
    this.handArm.visible = !def?.isBlock;
    this.handCube.visible = Boolean(def?.isBlock);

    if (def?.isBlock) {
      const colorMap: Partial<Record<number, number>> = {
        [BlockId.Grass]: 0x67a93f,
        [BlockId.Dirt]: 0x865d3b,
        [BlockId.Stone]: 0x7d7d7d,
        [BlockId.Cobblestone]: 0x6a6a6a,
        [BlockId.OakLog]: 0x684e2e,
        [BlockId.OakPlanks]: 0xba9258,
        [BlockId.Sand]: 0xdfd39e,
        [BlockId.Glass]: 0x99d9f2,
        [BlockId.Bricks]: 0xa14839,
        [BlockId.CraftingTable]: 0xb38650,
        [BlockId.Furnace]: 0x777777,
        [BlockId.Torch]: 0xf5be4e,
        [BlockId.RedWool]: 0xb52b2b,
        [BlockId.BlueWool]: 0x2d4db5,
      };
      (this.handCube.material as THREE.MeshStandardMaterial).color.setHex(
        colorMap[itemId] ?? 0xa0a0a0
      );
    }
  }

  public updateSettings(next: GameSettings) {
    const renderDistChanged = next.renderDistance !== this.settings.renderDistance;
    const shadowsChanged = next.shadowsEnabled !== this.settings.shadowsEnabled;
    this.settings = { ...next };

    this.camera.fov = next.fov;
    this.camera.updateProjectionMatrix();

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = Math.max(16, next.renderDistance * CHUNK_SIZE * 0.45);
      this.scene.fog.far = Math.max(32, next.renderDistance * CHUNK_SIZE * 1.05);
    }

    if (shadowsChanged) {
      this.renderer.shadowMap.enabled = !this.isSoftwareGl && next.shadowsEnabled;
      this.keyLight.castShadow = !this.isSoftwareGl && next.shadowsEnabled;
    }

    if (renderDistChanged) {
      this.updateLoadedChunks(true);
    }
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    if (mode === 'survival') {
      this.isFlying = false;
    }
  }

  public setActive(active: boolean) {
    this.isActive = active;
    if (!active) {
      this.keys.clear();
      this.isMouseDownLeft = false;
      this.isDraggingLook = false;
      this.resetMining();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
    }
  }

  public requestPointerLock() {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Fallback drag look remains usable if browser/iframe blocks pointer lock
    }
  }

  public moveTouchInput(forward: number, strafe: number, jump: boolean) {
    this.keys.delete('KeyW');
    this.keys.delete('KeyS');
    this.keys.delete('KeyA');
    this.keys.delete('KeyD');
    this.keys.delete('Space');
    if (forward > 0.2) this.keys.add('KeyW');
    if (forward < -0.2) this.keys.add('KeyS');
    if (strafe > 0.2) this.keys.add('KeyD');
    if (strafe < -0.2) this.keys.add('KeyA');
    if (jump) this.keys.add('Space');
  }

  public triggerPrimaryAction() {
    this.triggerSwing();
    if (!this.currentHit) return;
    if (this.gameMode === 'creative') {
      this.breakTargetBlock(this.currentHit);
    }
  }

  public triggerSecondaryAction() {
    this.triggerSwing();
    if (!this.currentHit) {
      this.tryEatHeld();
      return;
    }
    const handled = this.callbacks.onInteractBlock(this.currentHit.blockPos, this.currentHit.blockId);
    if (handled) return;
    if (!this.tryEatHeld()) {
      this.callbacks.onPlaceBlock(this.currentHit.placePos, this.currentHit.normal);
    }
  }

  private tryEatHeld(): boolean {
    if (!this.heldItem) return false;
    const def = getItemDef(this.heldItem);
    if (def?.foodValue) {
      this.callbacks.onConsumeHunger(-def.foodValue);
      soundFX.playClick();
      return true;
    }
    return false;
  }

  public rebuildBlockArea(wx: number, wy: number, wz: number) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const toRebuild = new Set<string>();
    toRebuild.add(`${cx},${cz}`);
    if (lx === 0) toRebuild.add(`${cx - 1},${cz}`);
    if (lx === CHUNK_SIZE - 1) toRebuild.add(`${cx + 1},${cz}`);
    if (lz === 0) toRebuild.add(`${cx},${cz - 1}`);
    if (lz === CHUNK_SIZE - 1) toRebuild.add(`${cx},${cz + 1}`);

    for (const key of toRebuild) {
      const [rcx, rcz] = key.split(',').map(Number);
      this.buildAndAttachChunk(rcx, rcz);
    }
  }

  private buildAndAttachChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const existing = this.chunkMeshes.get(key);
    if (existing) {
      if (existing.opaqueMesh) {
        this.worldGroup.remove(existing.opaqueMesh);
        existing.opaqueMesh.geometry.dispose();
      }
      if (existing.waterMesh) {
        this.worldGroup.remove(existing.waterMesh);
        existing.waterMesh.geometry.dispose();
      }
      if (existing.cutoutMesh) {
        this.worldGroup.remove(existing.cutoutMesh);
        existing.cutoutMesh.geometry.dispose();
      }
      this.chunkMeshes.delete(key);
    }

    const res = buildChunkGeometry(this.world, cx, cz);
    const group: ChunkMeshGroup = {};

    if (res.opaque) {
      const m = new THREE.Mesh(res.opaque, this.opaqueMaterial);
      m.castShadow = true;
      m.receiveShadow = true;
      this.worldGroup.add(m);
      group.opaqueMesh = m;
    }
    if (res.cutout) {
      const m = new THREE.Mesh(res.cutout, this.cutoutMaterial);
      m.castShadow = true;
      m.receiveShadow = true;
      this.worldGroup.add(m);
      group.cutoutMesh = m;
    }
    if (res.water) {
      const m = new THREE.Mesh(res.water, this.waterMaterial);
      m.renderOrder = 2;
      this.worldGroup.add(m);
      group.waterMesh = m;
    }

    this.chunkMeshes.set(key, group);
  }

  private updateLoadedChunks(forceAll = false) {
    const pcx = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(this.playerPos.z / CHUNK_SIZE);
    const radius = Math.max(2, Math.min(6, this.settings.renderDistance));

    const wanted = new Set<string>();
    const missing: [number, number, number][] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz > radius * radius + 2) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx},${cz}`;
        wanted.add(key);
        if (!this.chunkMeshes.has(key)) {
          missing.push([cx, cz, dx * dx + dz * dz]);
        }
      }
    }

    // Unload distant chunks
    for (const [key, group] of this.chunkMeshes.entries()) {
      if (!wanted.has(key)) {
        if (group.opaqueMesh) {
          this.worldGroup.remove(group.opaqueMesh);
          group.opaqueMesh.geometry.dispose();
        }
        if (group.waterMesh) {
          this.worldGroup.remove(group.waterMesh);
          group.waterMesh.geometry.dispose();
        }
        if (group.cutoutMesh) {
          this.worldGroup.remove(group.cutoutMesh);
          group.cutoutMesh.geometry.dispose();
        }
        this.chunkMeshes.delete(key);
      }
    }

    // Build nearest chunks first (cap per frame unless initial load)
    missing.sort((a, b) => a[2] - b[2]);
    const limit = forceAll ? missing.length : 2;
    for (let i = 0; i < Math.min(limit, missing.length); i++) {
      this.buildAndAttachChunk(missing[i][0], missing[i][1]);
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true });
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.handCamera.aspect = width / height;
    this.handCamera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.isPointerLocked = locked;
    this.callbacks.onPointerLockChange(locked);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyE' && !e.repeat) {
      this.callbacks.onToggleInventory();
      return;
    }
    if (e.code === 'Escape' && !e.repeat) {
      if (this.isActive && !this.isPointerLocked) {
        this.callbacks.onPauseRequest();
      }
      return;
    }
    if (!this.isActive) return;

    if (e.code === 'F3' && !e.repeat) {
      e.preventDefault();
      this.callbacks.onToggleDebug();
      return;
    }
    if (e.code === 'KeyF' && !e.repeat && this.gameMode === 'creative') {
      this.isFlying = !this.isFlying;
      this.velocity.y = 0;
      return;
    }
    if (e.code === 'Space' && !e.repeat && this.gameMode === 'creative') {
      const now = performance.now();
      if (now - this.lastSpaceTap < 280) {
        this.isFlying = !this.isFlying;
        this.velocity.y = 0;
      }
      this.lastSpaceTap = now;
    }

    if (e.code.startsWith('Digit') && !e.repeat) {
      const digit = Number(e.code.replace('Digit', ''));
      if (digit >= 1 && digit <= 9) {
        this.callbacks.onSelectHotbarIndex(digit - 1);
      }
    }

    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isActive) return;
    if (!this.isPointerLocked && !this.isDraggingLook) return;

    const sens = 0.0022 * this.settings.mouseSensitivity;
    const ySign = this.settings.invertY ? -1 : 1;
    let dx = e.movementX || 0;
    let dy = e.movementY || 0;

    if (!this.isPointerLocked && this.isDraggingLook) {
      dx = e.clientX - this.lastPointerX;
      dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }

    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sens * ySign,
      -Math.PI / 2 + 0.02,
      Math.PI / 2 - 0.02
    );
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.isActive) return;

    if (!this.isPointerLocked) {
      this.requestPointerLock();
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }

    if (e.button === 0) {
      this.isMouseDownLeft = true;
      this.triggerSwing();
      if (this.gameMode === 'creative' && this.currentHit) {
        this.breakTargetBlock(this.currentHit);
      }
    } else if (e.button === 2) {
      this.triggerSecondaryAction();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isMouseDownLeft = false;
      this.resetMining();
    }
    this.isDraggingLook = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.isActive) return;
    if (Math.abs(e.deltaY) < 4) return;
    // Delta direction handled in GameViewport via callback
    const dir = e.deltaY > 0 ? 1 : -1;
    this.callbacks.onSelectHotbarIndex(dir + 100); // sentinel offset for relative wheel scroll
  };

  private triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  private resetMining() {
    this.miningBlockKey = null;
    this.miningTimer = 0;
    this.crackMesh.visible = false;
    this.callbacks.onMiningProgress(0);
  }

  private breakTargetBlock(hit: RaycastHit) {
    const [bx, by, bz] = hit.blockPos;
    const def = getItemDef(hit.blockId);
    if (!def || def.hardness === Infinity) return;

    this.world.setBlock(bx, by, bz, BlockId.Air);
    this.rebuildBlockArea(bx, by, bz);
    this.spawnBreakParticles(bx, by, bz, hit.blockId);
    soundFX.playBlockBreak(def.preferredTool === 'pickaxe');
    this.callbacks.onBreakBlock(hit.blockPos, hit.blockId);
    this.resetMining();
  }

  private spawnBreakParticles(bx: number, by: number, bz: number, blockId: BlockId) {
    const colorMap: Partial<Record<number, number>> = {
      [BlockId.Grass]: 0x5b9b37,
      [BlockId.Dirt]: 0x865d3b,
      [BlockId.Stone]: 0x7d7d7d,
      [BlockId.Cobblestone]: 0x6b6b6b,
      [BlockId.OakLog]: 0x684e2e,
      [BlockId.OakPlanks]: 0xba9258,
      [BlockId.OakLeaves]: 0x3a7225,
      [BlockId.Sand]: 0xdfd39e,
      [BlockId.Snow]: 0xf2f7fa,
    };
    const col = colorMap[blockId] ?? 0x8a8a8a;
    const mat = new THREE.MeshBasicMaterial({ color: col });

    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.position.set(
        bx + 0.25 + Math.random() * 0.5,
        by + 0.25 + Math.random() * 0.5,
        bz + 0.25 + Math.random() * 0.5
      );
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          1.5 + Math.random() * 3,
          (Math.random() - 0.5) * 3.5
        ),
        life: 0.45 + Math.random() * 0.2,
      });
    }
  }

  private raycastVoxel(): RaycastHit | null {
    const eyeY = this.playerPos.y + 1.62;
    _vRayOrigin.set(this.playerPos.x, eyeY, this.playerPos.z);

    const cosPitch = Math.cos(this.pitch);
    _vRayDir.set(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch
    ).normalize();

    let x = Math.floor(_vRayOrigin.x);
    let y = Math.floor(_vRayOrigin.y);
    let z = Math.floor(_vRayOrigin.z);

    const stepX = _vRayDir.x >= 0 ? 1 : -1;
    const stepY = _vRayDir.y >= 0 ? 1 : -1;
    const stepZ = _vRayDir.z >= 0 ? 1 : -1;

    const tDeltaX = _vRayDir.x === 0 ? Infinity : Math.abs(1 / _vRayDir.x);
    const tDeltaY = _vRayDir.y === 0 ? Infinity : Math.abs(1 / _vRayDir.y);
    const tDeltaZ = _vRayDir.z === 0 ? Infinity : Math.abs(1 / _vRayDir.z);

    let tMaxX = _vRayDir.x === 0
      ? Infinity
      : ((stepX > 0 ? x + 1 - _vRayOrigin.x : _vRayOrigin.x - x) * tDeltaX);
    let tMaxY = _vRayDir.y === 0
      ? Infinity
      : ((stepY > 0 ? y + 1 - _vRayOrigin.y : _vRayOrigin.y - y) * tDeltaY);
    let tMaxZ = _vRayDir.z === 0
      ? Infinity
      : ((stepZ > 0 ? z + 1 - _vRayOrigin.z : _vRayOrigin.z - z) * tDeltaZ);

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let dist = 0;
    const maxDist = 5.5;

    while (dist <= maxDist) {
      const b = this.world.getBlock(x, y, z);
      if (b !== BlockId.Air && b !== BlockId.Water) {
        return {
          blockPos: [x, y, z],
          normal: [nx, ny, nz],
          placePos: [x + nx, y + ny, z + nz],
          blockId: b,
          distance: dist,
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          dist = tMaxY;
          tMaxY += tDeltaY;
          nx = 0;
          ny = -stepY;
          nz = 0;
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      }
    }

    return null;
  }

  public isBlockOccupiedByPlayer(bx: number, by: number, bz: number): boolean {
    const r = 0.28;
    const minX = this.playerPos.x - r;
    const maxX = this.playerPos.x + r;
    const minY = this.playerPos.y;
    const maxY = this.playerPos.y + 1.78;
    const minZ = this.playerPos.z - r;
    const maxZ = this.playerPos.z + r;

    return (
      maxX > bx &&
      minX < bx + 1 &&
      maxY > by &&
      minY < by + 1 &&
      maxZ > bz &&
      minZ < bz + 1
    );
  }

  private collidesAt(px: number, py: number, pz: number): boolean {
    const r = 0.28;
    const h = 1.78;
    const x0 = Math.floor(px - r);
    const x1 = Math.floor(px + r);
    const y0 = Math.floor(py);
    const y1 = Math.floor(py + h);
    const z0 = Math.floor(pz - r);
    const z1 = Math.floor(pz + r);

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (isBlockSolid(this.world.getBlock(x, y, z))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updatePhysics(dt: number) {
    if (!this.isActive) return;

    const headBlock = this.world.getBlock(
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y + 1.5),
      Math.floor(this.playerPos.z)
    );
    const feetBlock = this.world.getBlock(
      Math.floor(this.playerPos.x),
      Math.floor(this.playerPos.y + 0.2),
      Math.floor(this.playerPos.z)
    );
    const inWater = feetBlock === BlockId.Water || headBlock === BlockId.Water;
    this.isSubmerged = headBlock === BlockId.Water;

    _vForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    _vRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    let moveF = 0;
    let moveR = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveF += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveF -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveR += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveR -= 1;

    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ControlLeft');
    const baseSpeed = this.isFlying ? 11.5 : inWater ? 3.2 : isSprinting ? 6.6 : 4.6;

    let moveX = _vForward.x * moveF + _vRight.x * moveR;
    let moveZ = _vForward.z * moveF + _vRight.z * moveR;
    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      moveX = (moveX / len) * baseSpeed;
      moveZ = (moveZ / len) * baseSpeed;
      if (isSprinting && this.gameMode === 'survival' && Math.random() < dt * 0.6) {
        this.callbacks.onConsumeHunger(1);
      }
    }

    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, moveX, 14, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, moveZ, 14, dt);

    if (this.isFlying) {
      let vy = 0;
      if (this.keys.has('Space')) vy += 7.5;
      if (this.keys.has('ShiftLeft') || this.keys.has('KeyC')) vy -= 7.5;
      this.velocity.y = THREE.MathUtils.damp(this.velocity.y, vy, 12, dt);
      this.fallStartY = null;
    } else if (inWater) {
      this.velocity.y -= 8.0 * dt;
      if (this.keys.has('Space')) {
        this.velocity.y = 3.8;
      }
      this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -4, 4.5);
      this.fallStartY = null;
    } else {
      this.velocity.y -= 24.0 * dt;
      if (this.keys.has('Space') && this.isGrounded) {
        this.velocity.y = 8.4;
        this.isGrounded = false;
      }
    }

    // Separate axis AABB resolution
    const dx = this.velocity.x * dt;
    if (!this.collidesAt(this.playerPos.x + dx, this.playerPos.y, this.playerPos.z)) {
      this.playerPos.x += dx;
    } else {
      this.velocity.x = 0;
    }

    const dz = this.velocity.z * dt;
    if (!this.collidesAt(this.playerPos.x, this.playerPos.y, this.playerPos.z + dz)) {
      this.playerPos.z += dz;
    } else {
      this.velocity.z = 0;
    }

    const dy = this.velocity.y * dt;
    if (!this.collidesAt(this.playerPos.x, this.playerPos.y + dy, this.playerPos.z)) {
      this.playerPos.y += dy;
      if (this.velocity.y < 0 && this.fallStartY === null && !this.isFlying && !inWater) {
        this.fallStartY = this.playerPos.y;
      }
      this.isGrounded = false;
    } else {
      if (this.velocity.y < 0) {
        this.isGrounded = true;
        if (this.fallStartY !== null && this.gameMode === 'survival') {
          const fallDist = this.fallStartY - this.playerPos.y;
          if (fallDist > 3.6) {
            const dmg = Math.floor(fallDist - 3);
            if (dmg > 0) this.callbacks.onPlayerHurt(dmg);
          }
        }
        this.fallStartY = null;
      }
      this.velocity.y = 0;
    }

    // Safety floor above bedrock
    if (this.playerPos.y < 1.5) {
      this.playerPos.y = 28;
      this.velocity.y = 0;
    }

    // Footstep sound & subtle head bob
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.isGrounded && horizSpeed > 0.6) {
      this.stepDist += horizSpeed * dt;
      this.bobPhase += horizSpeed * dt * 2.2;
      if (this.stepDist > 1.85) {
        this.stepDist = 0;
        soundFX.playStep();
      }
    } else {
      this.bobPhase = THREE.MathUtils.damp(this.bobPhase, 0, 8, dt);
    }

    // Apply camera transform
    const bobY = this.isGrounded && horizSpeed > 0.6 ? Math.sin(this.bobPhase) * 0.045 : 0;
    this.camera.position.set(this.playerPos.x, this.playerPos.y + 1.62 + bobY, this.playerPos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  private updateMiningAndTarget(dt: number) {
    const hit = this.isActive ? this.raycastVoxel() : null;
    this.currentHit = hit;
    this.callbacks.onHitChange(hit);

    if (hit) {
      this.highlightMesh.visible = true;
      this.highlightMesh.position.set(
        hit.blockPos[0] + 0.5,
        hit.blockPos[1] + 0.5,
        hit.blockPos[2] + 0.5
      );
    } else {
      this.highlightMesh.visible = false;
    }

    if (this.isActive && this.isMouseDownLeft && hit && this.gameMode === 'survival') {
      const key = hit.blockPos.join(',');
      if (this.miningBlockKey !== key) {
        this.miningBlockKey = key;
        this.miningTimer = 0;
      }

      const blockDef = getItemDef(hit.blockId);
      const hardness = blockDef?.hardness ?? 1.0;
      if (hardness !== Infinity) {
        let speedMult = 1.0;
        if (this.heldItem) {
          const toolDef = getItemDef(this.heldItem);
          if (toolDef?.toolPower) {
            if (!blockDef?.preferredTool || toolDef.toolType === blockDef.preferredTool) {
              speedMult = toolDef.toolPower;
            } else {
              speedMult = 1.25;
            }
          }
        }
        this.miningTimer += dt * speedMult;
        const progress = Math.min(1, this.miningTimer / hardness);
        this.callbacks.onMiningProgress(progress);

        const stage = Math.min(4, Math.floor(progress * 5));
        (this.crackMesh.material as THREE.MeshBasicMaterial).map = this.crackTextures[stage];
        (this.crackMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        this.crackMesh.position.copy(this.highlightMesh.position);
        this.crackMesh.visible = true;

        if (progress >= 1) {
          this.breakTargetBlock(hit);
        }
      }
    } else if (!this.isMouseDownLeft) {
      this.resetMining();
    }
  }

  private updateSkyAndLighting(dt: number) {
    // 1 full day = ~8 minutes
    this.timeOfDay += dt / 480;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.dayCount += 1;
    }

    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);

    this.sunMesh.position.set(
      this.playerPos.x + sunX * 140,
      this.playerPos.y + sunY * 140,
      this.playerPos.z - 40
    );
    this.moonMesh.position.set(
      this.playerPos.x - sunX * 140,
      this.playerPos.y - sunY * 140,
      this.playerPos.z - 40
    );

    const daylight = THREE.MathUtils.clamp((sunY + 0.15) / 0.65, 0, 1);
    const sunsetFactor = 1 - Math.min(1, Math.abs(sunY) / 0.28);

    _vSkyColor.copy(_vNightSky).lerp(_vDaySky, daylight);
    if (sunsetFactor > 0.01) {
      _vSkyColor.lerp(_vSunsetSky, sunsetFactor * 0.48);
    }

    this.scene.background = _vSkyColor;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(_vSkyColor);
    }

    this.keyLight.intensity = 0.25 + daylight * 1.25;
    this.hemiLight.intensity = 0.3 + daylight * 0.65;
    this.keyLight.position.set(
      this.playerPos.x + sunX * 45,
      this.playerPos.y + Math.max(15, Math.abs(sunY) * 75),
      this.playerPos.z + 25
    );
    this.keyLight.target.position.copy(this.playerPos);

    // Drift clouds gently
    this.cloudGroup.position.x = this.playerPos.x;
    this.cloudGroup.position.z = this.playerPos.z;
    for (const c of this.cloudGroup.children) {
      c.position.x += dt * 0.85;
      if (c.position.x > 95) c.position.x = -95;
    }
  }

  private updateParticlesAndHand(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 4;
    }

    // Viewmodel swing + walk sway
    if (this.isSwinging) {
      this.swingProgress += dt * 5.2;
      if (this.swingProgress >= 1) {
        this.isSwinging = false;
        this.swingProgress = 0;
      }
    }
    const swingAngle = this.isSwinging ? Math.sin(this.swingProgress * Math.PI) : 0;
    this.handPivot.rotation.set(-swingAngle * 0.75, swingAngle * 0.35, swingAngle * 0.25);
    this.handPivot.position.set(
      0,
      Math.sin(this.bobPhase) * 0.015 - swingAngle * 0.08,
      -swingAngle * 0.1
    );
  }

  private emitTelemetry(dt: number) {
    this.fpsAccum += dt;
    this.fpsFrames += 1;
    this.telemetryTimer += dt;

    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (this.telemetryTimer >= 0.1) {
      this.telemetryTimer = 0;
      const wx = Math.floor(this.playerPos.x);
      const wz = Math.floor(this.playerPos.z);
      const yawDeg = ((((-this.yaw * 180) / Math.PI) % 360) + 360) % 360;
      const dirs = ['North (-Z)', 'East (+X)', 'South (+Z)', 'West (-X)'];
      const facing = dirs[Math.round(yawDeg / 90) % 4];
      const totalMins = Math.floor(this.timeOfDay * 24 * 60);
      const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const mm = String(totalMins % 60).padStart(2, '0');

      const targetDef = this.currentHit ? getItemDef(this.currentHit.blockId) : undefined;

      this.callbacks.onTelemetry({
        fps: this.currentFps,
        position: [
          Number(this.playerPos.x.toFixed(1)),
          Number(this.playerPos.y.toFixed(1)),
          Number(this.playerPos.z.toFixed(1)),
        ],
        chunk: [Math.floor(wx / CHUNK_SIZE), Math.floor(wz / CHUNK_SIZE)],
        facing,
        yawDeg: Math.round(yawDeg),
        pitchDeg: Math.round((this.pitch * 180) / Math.PI),
        biome: this.world.getBiomeAt(wx, wz),
        targetBlock: targetDef?.name ?? null,
        targetCoords: this.currentHit ? this.currentHit.blockPos : null,
        timeOfDayLabel: `${hh}:${mm}`,
        dayCount: this.dayCount,
        loadedChunks: this.chunkMeshes.size,
        isGrounded: this.isGrounded,
        isFlying: this.isFlying,
        isSubmerged: this.isSubmerged,
      });
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.updatePhysics(dt);
      this.updateLoadedChunks(false);
      this.updateMiningAndTarget(dt);
      this.updateSkyAndLighting(dt);
      this.updateParticlesAndHand(dt);
      this.emitTelemetry(dt);

      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.handScene, this.handCamera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    for (const group of this.chunkMeshes.values()) {
      group.opaqueMesh?.geometry.dispose();
      group.waterMesh?.geometry.dispose();
      group.cutoutMesh?.geometry.dispose();
    }
    this.chunkMeshes.clear();
    this.opaqueMaterial.dispose();
    this.cutoutMaterial.dispose();
    this.waterMaterial.dispose();
    this.atlasTexture.dispose();
    this.particleGeo.dispose();
    this.crackTextures.forEach((t) => t.dispose());
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
