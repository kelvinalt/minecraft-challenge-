import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BlockId } from '../../shared/types';
import { LocalWorldProvider } from '../engine/LocalWorldProvider';
import { buildChunkGeometry } from '../engine/ChunkMesher';
import { createAtlasTexture } from '../engine/TextureAtlas';

export const PanoramaBackdrop: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x6fa6eb);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 22, 58);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 120);

    const hemi = new THREE.HemisphereLight(0xd9ecff, 0x45523b, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d1, 1.3);
    sun.position.set(24, 42, 18);
    scene.add(sun);

    const world = new LocalWorldProvider('panorama-island', 'islands');
    // Place a small cobblestone lookout & crafting bench near origin
    const baseH = world.getSurfaceHeightAt(8, 8);
    for (let x = 6; x <= 10; x++) {
      for (let z = 6; z <= 10; z++) {
        world.setBlock(x, baseH + 1, z, BlockId.OakPlanks);
      }
    }
    world.setBlock(6, baseH + 2, 6, BlockId.OakLog);
    world.setBlock(6, baseH + 3, 6, BlockId.OakLog);
    world.setBlock(10, baseH + 2, 6, BlockId.OakLog);
    world.setBlock(10, baseH + 3, 6, BlockId.OakLog);
    world.setBlock(8, baseH + 2, 8, BlockId.CraftingTable);
    world.setBlock(9, baseH + 2, 8, BlockId.Torch);

    const atlas = createAtlasTexture();
    const opaqueMat = new THREE.MeshStandardMaterial({
      map: atlas,
      vertexColors: true,
      roughness: 0.88,
    });
    const cutoutMat = new THREE.MeshStandardMaterial({
      map: atlas,
      vertexColors: true,
      roughness: 0.85,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      map: atlas,
      vertexColors: true,
      roughness: 0.15,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const meshes: THREE.Mesh[] = [];
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        const res = buildChunkGeometry(world, cx, cz);
        if (res.opaque) {
          const m = new THREE.Mesh(res.opaque, opaqueMat);
          scene.add(m);
          meshes.push(m);
        }
        if (res.cutout) {
          const m = new THREE.Mesh(res.cutout, cutoutMat);
          scene.add(m);
          meshes.push(m);
        }
        if (res.water) {
          const m = new THREE.Mesh(res.water, waterMat);
          scene.add(m);
          meshes.push(m);
        }
      }
    }

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let disposed = false;
    let frameId = 0;
    let angle = 0.4;
    let last = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) return;
        const st = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      angle += dt * 0.14;
      const radius = 22;
      camera.position.set(
        8 + Math.cos(angle) * radius,
        baseH + 10 + Math.sin(angle * 0.7) * 2,
        8 + Math.sin(angle) * radius
      );
      camera.lookAt(8, baseH + 2, 8);
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) frameId = window.setTimeout(tick, 16);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      meshes.forEach((m) => m.geometry.dispose());
      opaqueMat.dispose();
      cutoutMat.dispose();
      waterMat.dispose();
      atlas.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};
