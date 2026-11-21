import React, { useEffect } from 'react';
import { useGame } from '../state/GameStore';

export const LoadingScreen: React.FC = () => {
  const {
    activeWorld,
    loadingProgress,
    setLoadingProgress,
    loadingStatus,
    setLoadingStatus,
    setScreen,
  } = useGame();

  useEffect(() => {
    const steps = [
      { pct: 24, label: 'Generating terrain noise...' },
      { pct: 52, label: 'Carving biomes & oceans...' },
      { pct: 78, label: 'Growing oak forests & ore veins...' },
      { pct: 100, label: 'Joining world...' },
    ];

    let idx = 0;
    const timer = window.setInterval(() => {
      if (idx < steps.length) {
        setLoadingProgress(steps[idx].pct);
        setLoadingStatus(steps[idx].label);
        idx += 1;
      } else {
        window.clearInterval(timer);
        setScreen('playing');
      }
    }, 240);

    return () => window.clearInterval(timer);
  }, [setLoadingProgress, setLoadingStatus, setScreen]);

  return (
    <div className="mc-dirt-bg w-full h-full flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center space-y-5">
        <h2 className="font-pixel text-xl text-white drop-shadow-[2px_2px_0_#141414]">
          {activeWorld ? `Loading "${activeWorld.name}"` : 'Loading World'}
        </h2>

        {/* Minecraft-style green progress bar */}
        <div className="w-full h-5 bg-[#1a1a1a] border-2 border-[#0e0e0e] p-0.5">
          <div
            className="h-full bg-[#5ec43d] transition-all duration-200"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono-tabular text-stone-300">
          <span>{loadingStatus}</span>
          <span>{loadingProgress}%</span>
        </div>

        {activeWorld && (
          <p className="text-xs text-stone-400 font-ui pt-2">
            Seed: <span className="font-mono-tabular text-stone-200">{activeWorld.seed}</span> ·{' '}
            <span className="capitalize">{activeWorld.gameMode}</span> Mode
          </p>
        )}
      </div>
    </div>
  );
};
