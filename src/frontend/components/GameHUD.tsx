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
  <svg width="18" height="18" viewBox="0 0 9 9" className="pixelated shrink-0">
    <path
      d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1V1z"
      fill="#101010"
    />
    <path
      d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z"
      fill="#2a2a2a"
    />
    {state !== 'empty' && (
      <path
        d={
          state === 'full'
            ? 'M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z'
            : 'M1 2h2v1h1v1h0V7H3V6H2V5H1V2z'
        }
        fill="#ff1313"
      />
    )}
    {state !== 'empty' && <rect x="2" y="3" width="1" height="1" fill="#ffc4c4" />}
  </svg>
);

const PixelHunger: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg width="18" height="18" viewBox="0 0 9 9" className="pixelated shrink-0">
    <path
      d="M4 0h3v1h1v3H7v1H5v1H4v1H2v1H1V7h1V5h1V4h1V1h0V0z"
      fill="#101010"
    />
    <path d="M4 1h3v3H6v1H4v1H3V5h1V1z" fill="#2a2a2a" />
    {state !== 'empty' && (
      <path
        d={
          state === 'full'
            ? 'M4 1h3v3H6v1H4v1H3V5h1V1z'
            : 'M4 1h1v4H4v1H3V5h1V1z'
        }
        fill="#a35a24"
      />
    )}
    <rect x="1" y="6" width="2" height="2" fill="#e8dcc0" />
    {state !== 'empty' && <rect x="5" y="2" width="1" height="1" fill="#db8b48" />}
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
    xp,
    lastHurtAt,
    telemetry,
    targetHit,
    miningProgress,
    pointerLocked,
  } = useGame();

  const [itemToast, setItemToast] = useState<string | null>(null);
  const [hurtFlash, setHurtFlash] = useState(false);
  const selectedSlot = inventory[selectedHotbarSlot];
  const selectedDef = selectedSlot ? getItemDef(selectedSlot.itemId) : undefined;

  useEffect(() => {
    if (!lastHurtAt) return;
    setHurtFlash(true);
    const t = window.setTimeout(() => setHurtFlash(false), 260);
    return () => window.clearTimeout(t);
  }, [lastHurtAt]);

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
  const xpLevel = Math.floor(xp / 10);
  const xpPct = (xp % 10) * 10;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between">
      {/* Survival Hurt Vignette */}
      {hurtFlash && (
        <div
          className="fixed inset-0 z-10 pointer-events-none transition-opacity duration-200"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 20, 20, 0.72)',
            backgroundColor: 'rgba(180, 15, 15, 0.14)',
          }}
        />
      )}

      {/* WebGL Context Lost Banner */}
      {webglLost && (
        <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-6 pointer-events-auto">
          <div className="mc-dark-panel p-6 max-w-sm text-center space-y-3">
            <h3 className="font-pixel text-lg text-[#ffff55]">Graphics Context Lost</h3>
            <p className="text-sm text-stone-300 font-ui">
              WebGL rendering was paused by the browser. Waiting for context restore.
            </p>
          </div>
        </div>
      )}

      {/* Top Row: Classic F3 Debug Lines + Target Hint + Quick Buttons */}
      <div className="flex items-start justify-between p-2.5 gap-4">
        {settings.showDebugHud ? (
          <div
            className="font-mono-tabular text-[12px] leading-[1.35] text-white space-y-0.5 max-w-sm"
            style={{ textShadow: '1px 1px 0 #1c1c1c' }}
          >
            <div className="bg-black/50 px-1.5 inline-block">
              Minecraft 1.21 ({telemetry.fps} fps)
            </div>
            <br />
            <div className="bg-black/50 px-1.5 inline-block">
              XYZ: {telemetry.position[0]} / {telemetry.position[1]} / {telemetry.position[2]}
            </div>
            <br />
            <div className="bg-black/50 px-1.5 inline-block">
              Chunk: {telemetry.chunk[0]}, {telemetry.chunk[1]} ({telemetry.loadedChunks} loaded)
            </div>
            <br />
            <div className="bg-black/50 px-1.5 inline-block">
              Facing: {telemetry.facing} ({telemetry.yawDeg}° / {telemetry.pitchDeg}°)
            </div>
            <br />
            <div className="bg-black/50 px-1.5 inline-block">
              Dim: {telemetry.dimension === 'nether' ? 'The Nether' : telemetry.dimension === 'end' ? 'The End' : 'Overworld'} · Biome: {telemetry.biome} · Day {telemetry.dayCount} ({telemetry.timeOfDayLabel})
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Top-Center: Target Block & Click-to-Lock Banner */}
        <div className="flex flex-col items-center gap-1.5">
          {targetDef && targetHit && (
            <div className="bg-black/65 border border-black px-3 py-1 flex items-center gap-2">
              <ItemIcon itemId={targetHit.blockId} size={20} />
              <div className="font-pixel text-xs text-white" style={{ textShadow: '1px 1px 0 #111' }}>
                {targetDef.name}
                {targetHit.blockId === BlockId.CraftingTable || targetHit.blockId === BlockId.Furnace
                  ? ' (Right-Click)'
                  : ''}
                {targetHit.blockId === BlockId.NetherPortal || targetHit.blockId === BlockId.EndPortal
                  ? ' (Right-Click to Travel)'
                  : ''}
              </div>
            </div>
          )}

          {!pointerLocked && (
            <button
              type="button"
              onClick={onRequestLock}
              className="pointer-events-auto bg-black/75 hover:bg-black/90 border border-[#ffffa0]/45 px-3 py-1 text-xs font-ui text-[#ffffa0] cursor-pointer"
            >
              Click world to lock cursor (or drag to look)
            </button>
          )}
        </div>

        {/* Top-Right Quick Menu Buttons */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={onOpenInventory}
            className="mc-btn px-2.5 py-1 text-[11px] whitespace-nowrap"
          >
            Inv (E)
          </button>
          <button
            type="button"
            onClick={onPause}
            className="mc-btn px-2.5 py-1 text-[11px] whitespace-nowrap"
          >
            Menu (Esc)
          </button>
        </div>
      </div>

      {/* Authentic Inverted Pixel Crosshair */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex flex-col items-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            className="mix-blend-difference"
          >
            <rect x="8" y="2" width="2" height="14" fill="#ffffff" />
            <rect x="2" y="8" width="14" height="2" fill="#ffffff" />
          </svg>
          {miningProgress > 0 && (
            <div className="mt-3 w-14 h-1.5 bg-black/80 border border-black">
              <div
                className="h-full bg-[#80ff20]"
                style={{ width: `${Math.round(miningProgress * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Classic Minecraft HUD */}
      <div className="relative pb-2.5 px-4 flex flex-col items-center">
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

        {/* Selected Item Name Above Hotbar */}
        <div className="h-5 mb-1 flex items-center justify-center">
          {itemToast && (
            <span
              className="font-pixel text-xs text-white"
              style={{ textShadow: '2px 2px 0 #1a1a1a' }}
            >
              {itemToast}
            </span>
          )}
        </div>

        {/* Health + Hunger + XP Bar */}
        <div className="w-full max-w-[424px] mb-1.5 space-y-1">
          {isSurvival ? (
            <>
              <div className="flex items-end justify-between">
                {/* 10 Hearts */}
                <div className="flex items-center gap-[1px]" aria-label={`Health ${health} of 20`}>
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const val = health - idx * 2;
                    const state = val >= 2 ? 'full' : val === 1 ? 'half' : 'empty';
                    return <PixelHeart key={idx} state={state} />;
                  })}
                </div>

                {/* Oxygen + 10 Hunger Drumsticks */}
                <div className="flex flex-col items-end gap-0.5">
                  {telemetry.isSubmerged && (
                    <div className="flex items-center gap-1" aria-label="Underwater">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-2.5 h-2.5 border border-[#0f345e] bg-[#4cb8ff] inline-block"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-[1px]" aria-label={`Hunger ${hunger} of 20`}>
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const val = hunger - (9 - idx) * 2;
                      const state = val >= 2 ? 'full' : val === 1 ? 'half' : 'empty';
                      return <PixelHunger key={idx} state={state} />;
                    })}
                  </div>
                </div>
              </div>

              {/* Classic Segmented Green Experience Bar */}
              <div className="relative w-full h-1.5 bg-[#1a1a1a] border border-black">
                <div className="h-full bg-[#80ff20] transition-all duration-200" style={{ width: `${xpPct}%` }} />
                {xpLevel > 0 && (
                  <span
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 font-pixel text-[11px] text-[#80ff20]"
                    style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}
                  >
                    {xpLevel}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div
              className="flex items-center justify-between text-[11px] font-pixel text-[#ffffa0]"
              style={{ textShadow: '1px 1px 0 #111' }}
            >
              <span>Creative Mode</span>
              <span>{telemetry.isFlying ? 'Flying' : 'Double-Space / F to Fly'}</span>
            </div>
          )}
        </div>

        {/* Classic 9-Slot Minecraft Hotbar */}
        <div className="mc-hotbar-bar p-1 flex items-center gap-1 pointer-events-auto">
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
                className={`relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center cursor-pointer ${
                  isActive ? 'mc-hotbar-slot-active' : 'mc-hotbar-slot'
                }`}
              >
                {slot && <ItemIcon itemId={slot.itemId} size={30} />}

                {slot && slot.count > 1 && (
                  <span
                    className="absolute bottom-0 right-0.5 font-pixel text-[11px] text-white leading-none"
                    style={{ textShadow: '1px 1px 0 #1f1f1f' }}
                  >
                    {slot.count}
                  </span>
                )}

                {durRatio !== null && durRatio < 1 && (
                  <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-[#141414]">
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

        {settings.showControlsHint && (
          <div
            className="mt-1.5 text-[11px] font-ui text-white/85 hidden sm:block"
            style={{ textShadow: '1px 1px 0 #111' }}
          >
            WASD Move · Space Jump · L-Click Mine · R-Click Place/Eat · 1-9 Hotbar · E Inventory · F3 Debug
          </div>
        )}
      </div>
    </div>
  );
};
