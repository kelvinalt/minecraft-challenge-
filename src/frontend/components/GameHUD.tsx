import React, { useEffect, useState } from 'react';
import { getItemDef } from '../../shared/blocks';
import { BlockId } from '../../shared/types';
import { useGame } from '../state/GameStore';
import { ItemIcon } from './ItemIcon';

interface GameHUDProps {
  onPause: () => void;
  onOpenInventory: () => void;
  onRequestLock: () => void;
  onTouchMove: (forward: number, strafe: number, jump: boolean) => void;
  onTouchBreak: () => void;
  onTouchPlace: () => void;
  webglLost: boolean;
}

const PixelHeart: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg width="16" height="16" viewBox="0 0 9 9" className="pixelated shrink-0">
    <path
      d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1V1z"
      fill="#141414"
    />
    {state !== 'empty' && (
      <path
        d={
          state === 'full'
            ? 'M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z'
            : 'M1 2h2v1h1v1h0V7H3V6H2V5H1V2z'
        }
        fill="#e02828"
      />
    )}
    {state !== 'empty' && <rect x="2" y="3" width="1" height="1" fill="#ff9c9c" />}
  </svg>
);

const PixelHunger: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg width="16" height="16" viewBox="0 0 9 9" className="pixelated shrink-0">
    <path
      d="M4 0h3v1h1v3H7v1H5v1H4v1H2v1H1V7h1V5h1V4h1V1h0V0z"
      fill="#141414"
    />
    {state !== 'empty' && (
      <path
        d={
          state === 'full'
            ? 'M4 1h3v3H6v1H4v1H3V5h1V1z'
            : 'M4 1h1v4H4v1H3V5h1V1z'
        }
        fill="#b86b2b"
      />
    )}
    <rect x="1" y="6" width="2" height="2" fill="#e5d7b8" />
    {state !== 'empty' && <rect x="5" y="2" width="1" height="1" fill="#e09452" />}
  </svg>
);

export const GameHUD: React.FC<GameHUDProps> = ({
  onPause,
  onOpenInventory,
  onRequestLock,
  onTouchMove,
  onTouchBreak,
  onTouchPlace,
  webglLost,
}) => {
  const {
    activeWorld,
    settings,
    inventory,
    selectedHotbarSlot,
    setSelectedHotbarSlot,
    health,
    hunger,
    telemetry,
    targetHit,
    miningProgress,
    pointerLocked,
  } = useGame();

  const [itemToast, setItemToast] = useState<string | null>(null);
  const selectedSlot = inventory[selectedHotbarSlot];
  const selectedDef = selectedSlot ? getItemDef(selectedSlot.itemId) : undefined;

  useEffect(() => {
    if (!selectedDef) {
      setItemToast(null);
      return;
    }
    setItemToast(selectedDef.name);
    const t = window.setTimeout(() => setItemToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [selectedHotbarSlot, selectedDef?.name]);

  const targetDef = targetHit ? getItemDef(targetHit.blockId) : undefined;
  const isSurvival = activeWorld?.gameMode === 'survival';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between">
      {/* WebGL Context Lost Banner */}
      {webglLost && (
        <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-6 pointer-events-auto">
          <div className="mc-dark-panel p-6 max-w-sm text-center space-y-3">
            <h3 className="font-pixel text-lg text-amber-300">Graphics Context Lost</h3>
            <p className="text-sm text-stone-300 font-ui">
              Your browser paused WebGL rendering. Reload or wait for restoration.
            </p>
          </div>
        </div>
      )}

      {/* Top Row: Left Debug/Game Info + Center Target/Pointer Prompt + Right Quick Buttons */}
      <div className="flex items-start justify-between p-3 gap-4">
        {/* Game Information Display (F3) */}
        {settings.showDebugHud ? (
          <div className="bg-black/60 border border-white/15 px-3 py-2 text-[11px] leading-relaxed font-mono-tabular text-white space-y-0.5 max-w-xs">
            <div className="font-pixel text-xs text-[#ffff55]">
              {activeWorld?.name ?? 'World'} ·{' '}
              <span className="capitalize">{activeWorld?.gameMode ?? 'survival'}</span>
            </div>
            <div>
              XYZ: {telemetry.position[0]} / {telemetry.position[1]} / {telemetry.position[2]}
            </div>
            <div>
              Chunk: {telemetry.chunk[0]}, {telemetry.chunk[1]} ({telemetry.loadedChunks} active)
            </div>
            <div>
              Facing: {telemetry.facing} ({telemetry.yawDeg}°)
            </div>
            <div>
              Biome: <span className="text-emerald-300">{telemetry.biome}</span> · Day{' '}
              {telemetry.dayCount} ({telemetry.timeOfDayLabel})
            </div>
            <div>
              FPS: {telemetry.fps}
              {telemetry.isFlying ? ' · Flying' : ''}
              {telemetry.isSubmerged ? ' · Underwater' : ''}
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Top-Center: Target Block Indicator + Click-to-Lock hint */}
        <div className="flex flex-col items-center gap-1.5">
          {targetDef && targetHit && (
            <div className="bg-black/70 border border-white/20 px-3 py-1.5 flex items-center gap-2.5">
              <ItemIcon itemId={targetHit.blockId} size={22} />
              <div className="text-left">
                <div className="font-pixel text-xs text-white leading-tight">
                  {targetDef.name}
                </div>
                <div className="font-mono-tabular text-[10px] text-stone-300">
                  [{targetHit.blockPos.join(', ')}]
                  {targetHit.blockId === BlockId.CraftingTable
                    ? ' · Right-Click to Craft'
                    : targetDef.preferredTool
                    ? ` · Best: ${targetDef.preferredTool}`
                    : ''}
                </div>
              </div>
            </div>
          )}

          {!pointerLocked && (
            <button
              type="button"
              onClick={onRequestLock}
              className="pointer-events-auto bg-black/75 hover:bg-black/90 border border-amber-300/40 px-3 py-1 text-xs font-ui text-amber-200 transition-colors cursor-pointer"
            >
              Click viewport to lock mouse look (or drag to look)
            </button>
          )}
        </div>

        {/* Top-Right: Quick Action Buttons (mouse/touch accessible) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenInventory}
            className="mc-btn px-3 py-1.5 text-xs whitespace-nowrap"
          >
            Bag (E)
          </button>
          <button
            type="button"
            onClick={onPause}
            className="mc-btn px-3 py-1.5 text-xs whitespace-nowrap"
          >
            Menu (Esc)
          </button>
        </div>
      </div>

      {/* Center Crosshair + Mining Progress */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex flex-col items-center">
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
          >
            <rect x="10" y="3" width="2" height="16" fill="#ffffff" fillOpacity="0.92" />
            <rect x="3" y="10" width="16" height="2" fill="#ffffff" fillOpacity="0.92" />
          </svg>
          {miningProgress > 0 && (
            <div className="mt-3 w-14 h-1.5 bg-black/75 border border-white/30">
              <div
                className="h-full bg-[#a3ff7a]"
                style={{ width: `${Math.round(miningProgress * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD: Touch Controls (optional) + Health/Hunger + 9-Slot Hotbar */}
      <div className="relative pb-3 px-4 flex flex-col items-center">
        {/* Optional On-Screen Touch Controls */}
        {settings.touchControls && (
          <div className="w-full flex items-end justify-between mb-3 pointer-events-auto">
            <div className="grid grid-cols-3 gap-1.5 w-36">
              <div />
              <button
                type="button"
                onPointerDown={() => onTouchMove(1, 0, false)}
                onPointerUp={() => onTouchMove(0, 0, false)}
                onPointerLeave={() => onTouchMove(0, 0, false)}
                className="mc-btn py-2.5 text-xs"
              >
                W
              </button>
              <div />
              <button
                type="button"
                onPointerDown={() => onTouchMove(0, -1, false)}
                onPointerUp={() => onTouchMove(0, 0, false)}
                onPointerLeave={() => onTouchMove(0, 0, false)}
                className="mc-btn py-2.5 text-xs"
              >
                A
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchMove(-1, 0, false)}
                onPointerUp={() => onTouchMove(0, 0, false)}
                onPointerLeave={() => onTouchMove(0, 0, false)}
                className="mc-btn py-2.5 text-xs"
              >
                S
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchMove(0, 1, false)}
                onPointerUp={() => onTouchMove(0, 0, false)}
                onPointerLeave={() => onTouchMove(0, 0, false)}
                className="mc-btn py-2.5 text-xs"
              >
                D
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={() => onTouchMove(0, 0, true)}
                onPointerUp={() => onTouchMove(0, 0, false)}
                className="mc-btn px-4 py-3 text-xs"
              >
                Jump
              </button>
              <button
                type="button"
                onClick={onTouchBreak}
                className="mc-btn mc-btn-danger px-4 py-3 text-xs"
              >
                Break
              </button>
              <button
                type="button"
                onClick={onTouchPlace}
                className="mc-btn mc-btn-primary px-4 py-3 text-xs"
              >
                Place
              </button>
            </div>
          </div>
        )}

        {/* Selected Item Name Toast */}
        <div className="h-6 mb-1 flex items-center justify-center">
          {itemToast && (
            <span className="font-pixel text-xs text-white bg-black/65 px-2.5 py-0.5 border border-white/15">
              {itemToast}
            </span>
          )}
        </div>

        {/* Status Bars (Survival: Health + Hunger + Oxygen; Creative: Creative badge text) */}
        <div className="w-full max-w-[468px] flex items-center justify-between mb-1.5 px-0.5">
          {isSurvival ? (
            <>
              {/* 10 Hearts */}
              <div className="flex items-center gap-0.5" aria-label={`Health ${health} of 20`}>
                {Array.from({ length: 10 }).map((_, idx) => {
                  const val = health - idx * 2;
                  const state = val >= 2 ? 'full' : val === 1 ? 'half' : 'empty';
                  return <PixelHeart key={idx} state={state} />;
                })}
              </div>

              {/* Right side: Oxygen (if underwater) + 10 Hunger Drumsticks */}
              <div className="flex flex-col items-end gap-1">
                {telemetry.isSubmerged && (
                  <div className="flex items-center gap-1" aria-label="Underwater">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-2.5 h-2.5 border border-[#143d6b] bg-[#52b6ff] inline-block"
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-0.5" aria-label={`Hunger ${hunger} of 20`}>
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const val = hunger - (9 - idx) * 2;
                    const state = val >= 2 ? 'full' : val === 1 ? 'half' : 'empty';
                    return <PixelHunger key={idx} state={state} />;
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-[11px] font-pixel text-amber-200 bg-black/50 px-2 py-0.5 border border-white/15">
              <span>Creative Mode</span>
              <span>{telemetry.isFlying ? 'Flying (F)' : 'Double-Space or F to Fly'}</span>
            </div>
          )}
        </div>

        {/* 9-Slot Hotbar */}
        <div className="mc-hotbar-frame p-1 flex items-center gap-1 pointer-events-auto">
          {Array.from({ length: 9 }).map((_, idx) => {
            const slot = inventory[idx];
            const isActive = selectedHotbarSlot === idx;
            const def = slot ? getItemDef(slot.itemId) : undefined;
            const durRatio =
              slot && slot.durability !== undefined && def?.maxDurability
                ? slot.durability / def.maxDurability
                : null;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedHotbarSlot(idx)}
                title={def?.name ?? `Slot ${idx + 1}`}
                className={`relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer ${
                  isActive ? 'mc-slot-active z-10' : 'mc-slot'
                }`}
              >
                <span className="absolute top-0.5 left-1 font-mono-tabular text-[9px] text-white/60 leading-none">
                  {idx + 1}
                </span>

                {slot && <ItemIcon itemId={slot.itemId} size={30} />}

                {slot && slot.count > 1 && (
                  <span className="absolute bottom-0.5 right-1 font-pixel text-[11px] text-white drop-shadow-[1px_1px_0_#000] leading-none">
                    {slot.count}
                  </span>
                )}

                {durRatio !== null && durRatio < 1 && (
                  <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-[#1a1a1a]">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(5, durRatio * 100)}%`,
                        backgroundColor:
                          durRatio > 0.5 ? '#5ec43d' : durRatio > 0.25 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Compact Controls Hint */}
        {settings.showControlsHint && (
          <div className="mt-1.5 text-[11px] font-ui text-white/80 bg-black/50 px-3 py-0.5 border border-white/10 hidden sm:block">
            WASD Move · Space Jump · L-Click Break · R-Click Place/Use · 1-9 Hotbar · E Inventory · F3 Info
          </div>
        )}
      </div>
    </div>
  );
};
