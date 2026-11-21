import React, { useEffect } from 'react';
import { decodeChunkBase64, worldApi } from '../api/worldApi';
import { useGame } from '../state/GameStore';

export const LoadingScreen: React.FC = () => {
  const {
    activeWorld,
    activeDimension,
    preloadedChunksRef,
    loadingProgress,
    setLoadingProgress,
    loadingStatus,
    setLoadingStatus,
    setScreen,
  } = useGame();

  useEffect(() => {
    let cancelled = false;

    const loadSpawnChunks = async () => {
      if (!activeWorld) {
        setScreen('main_menu');
        return;
      }

      const spawnCoords: [number, number][] = [];
      for (let cx = -1; cx <= 1; cx++) {
        for (let cz = -1; cz <= 1; cz++) {
          spawnCoords.push([cx, cz]);
        }
      }

      setLoadingProgress(12);
      setLoadingStatus('Connecting to world server...');

      let completed = 0;
      await Promise.all(
        spawnCoords.map(async ([cx, cz]) => {
          const chunk = await worldApi.fetchChunk(activeWorld.id, activeDimension, cx, cz);
          if (cancelled) return;
          if (chunk) {
            preloadedChunksRef.current.set(
              `${cx},${cz}`,
              decodeChunkBase64(chunk.blocksBase64)
            );
          }
          completed += 1;
          const pct = 15 + Math.round((completed / spawnCoords.length) * 70);
          setLoadingProgress(pct);
          setLoadingStatus(
            completed < spawnCoords.length
              ? `Streaming spawn chunks (${completed}/${spawnCoords.length})...`
              : 'Building chunk meshes...'
          );
        })
      );

      if (cancelled) return;
      setLoadingProgress(100);
      setLoadingStatus('Joining world...');

      window.setTimeout(() => {
        if (!cancelled) {
          setScreen('playing');
        }
      }, 180);
    };

    void loadSpawnChunks();

    return () => {
      cancelled = true;
    };
  }, [
    activeWorld,
    activeDimension,
    preloadedChunksRef,
    setLoadingProgress,
    setLoadingStatus,
    setScreen,
  ]);

  const totalCells = 49;
  const filledCells = Math.round((loadingProgress / 100) * totalCells);

  return (
    <div className="mc-dirt-bg w-full h-full flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-5 flex flex-col items-center">
        <div
          className="grid grid-cols-7 gap-0.5 p-1 bg-black border-2 border-[#404040]"
          aria-hidden="true"
        >
          {Array.from({ length: totalCells }).map((_, i) => {
            const active = i < filledCells;
            const center = i === 24;
            return (
              <div
                key={i}
                className="w-3.5 h-3.5 transition-colors duration-150"
                style={{
                  backgroundColor: center
                    ? '#ffffff'
                    : active
                    ? i % 5 === 0
                      ? '#2f6ee0'
                      : '#5e9d34'
                    : '#1c1c1c',
                }}
              />
            );
          })}
        </div>

        <div className="space-y-1.5">
          <h2
            className="font-pixel text-lg text-white"
            style={{ textShadow: '2px 2px 0 #1f1f1f' }}
          >
            {loadingStatus}
          </h2>
          <div className="font-mono-tabular text-sm text-[#a0a0a0]">{loadingProgress}%</div>
        </div>

        {activeWorld && (
          <p className="text-xs text-[#9c9c9c] font-ui">
            {activeWorld.name} · Seed:{' '}
            <span className="font-mono-tabular text-stone-200">{activeWorld.seed}</span>
          </p>
        )}
      </div>
    </div>
  );
};
