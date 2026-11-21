import React, { useEffect, useState } from 'react';
import { getItemDef } from '../../shared/blocks';
import { AnyItemId, BlockId, ItemId } from '../../shared/types';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';
import { ItemIcon } from './ItemIcon';

interface FurnaceModalProps {
  onClose: () => void;
}

interface SmeltRecipe {
  id: string;
  input: AnyItemId;
  output: AnyItemId;
  outputCount: number;
  xpGain: number;
  label: string;
}

const SMELT_RECIPES: SmeltRecipe[] = [
  {
    id: 'stone',
    input: BlockId.Cobblestone,
    output: BlockId.Stone,
    outputCount: 1,
    xpGain: 2,
    label: 'Cobblestone -> Stone',
  },
  {
    id: 'glass',
    input: BlockId.Sand,
    output: BlockId.Glass,
    outputCount: 1,
    xpGain: 2,
    label: 'Sand -> Glass',
  },
  {
    id: 'charcoal-oak',
    input: BlockId.OakLog,
    output: ItemId.Coal,
    outputCount: 1,
    xpGain: 2,
    label: 'Oak Log -> Coal',
  },
  {
    id: 'charcoal-birch',
    input: BlockId.BirchLog,
    output: ItemId.Coal,
    outputCount: 1,
    xpGain: 2,
    label: 'Birch Log -> Coal',
  },
  {
    id: 'charcoal-spruce',
    input: BlockId.SpruceLog,
    output: ItemId.Coal,
    outputCount: 1,
    xpGain: 2,
    label: 'Spruce Log -> Coal',
  },
  {
    id: 'iron-ingot',
    input: BlockId.IronOre,
    output: ItemId.IronIngot,
    outputCount: 1,
    xpGain: 4,
    label: 'Iron Ore -> Iron Ingot',
  },
  {
    id: 'gold-ingot',
    input: BlockId.GoldOre,
    output: ItemId.GoldIngot,
    outputCount: 1,
    xpGain: 5,
    label: 'Gold Ore -> Gold Ingot',
  },
  {
    id: 'copper-ingot',
    input: BlockId.CopperBlock,
    output: ItemId.CopperIngot,
    outputCount: 4,
    xpGain: 4,
    label: 'Copper Block -> 4 Copper Ingots',
  },
];

export const FurnaceModal: React.FC<FurnaceModalProps> = ({ onClose }) => {
  const { activeWorld, inventory, setInventory, addItemToInventory, addXp } = useGame();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(SMELT_RECIPES[0].id);
  const [smeltMsg, setSmeltMsg] = useState<string | null>(null);

  const isCreative = activeWorld?.gameMode === 'creative';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        soundFX.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const countInInventory = (itemId: AnyItemId): number =>
    inventory.reduce((sum, slot) => (slot && slot.itemId === itemId ? sum + slot.count : sum), 0);

  const consumeFromInventory = (itemId: AnyItemId, needed: number): boolean => {
    if (isCreative) return true;
    if (countInInventory(itemId) < needed) return false;
    setInventory((prev) => {
      const next = prev.map((s) => (s ? { ...s } : null));
      let rem = needed;
      for (let i = 0; i < next.length && rem > 0; i++) {
        const s = next[i];
        if (s && s.itemId === itemId) {
          const take = Math.min(rem, s.count);
          s.count -= take;
          rem -= take;
          if (s.count <= 0) next[i] = null;
        }
      }
      return next;
    });
    return true;
  };

  const coalCount = countInInventory(ItemId.Coal);
  const selectedRecipe = SMELT_RECIPES.find((r) => r.id === selectedRecipeId) ?? SMELT_RECIPES[0];
  const inputCount = countInInventory(selectedRecipe.input);
  const canSmelt = isCreative || (inputCount >= 1 && coalCount >= 1);

  const handleSmelt = (batch: number) => {
    const maxPossible = isCreative ? batch : Math.min(batch, inputCount, coalCount);
    if (maxPossible <= 0) {
      setSmeltMsg('Need 1 Coal and 1 input item');
      return;
    }

    if (!isCreative) {
      consumeFromInventory(selectedRecipe.input, maxPossible);
      consumeFromInventory(ItemId.Coal, maxPossible);
    }

    addItemToInventory(selectedRecipe.output, selectedRecipe.outputCount * maxPossible);
    addXp(selectedRecipe.xpGain * maxPossible);
    soundFX.playCraft();
    const outDef = getItemDef(selectedRecipe.output);
    setSmeltMsg(`Smelted ${selectedRecipe.outputCount * maxPossible}× ${outDef?.name ?? 'Item'}`);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 select-none">
      <div className="mc-inv-panel p-4 sm:p-5 w-full max-w-lg text-[#3f3f3f]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ItemIcon itemId={BlockId.Furnace} size={24} />
            <h2 className="font-pixel text-base text-[#2b2b2b]">Furnace Smelting</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="mc-btn px-3 py-1 text-xs"
          >
            Done
          </button>
        </div>

        {/* Visual Furnace Station */}
        <div className="bg-[#a8a8a8] border-2 border-[#555] p-3 mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="mc-slot w-11 h-11 flex items-center justify-center relative">
                <ItemIcon itemId={selectedRecipe.input} size={30} />
                {!isCreative && (
                  <span className="absolute bottom-0 right-0.5 font-pixel text-[10px] text-white drop-shadow-[1px_1px_0_#000]">
                    {inputCount}
                  </span>
                )}
              </div>
              <span className="font-ui text-[10px] text-[#222]">Input</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="font-pixel text-base text-[#e65c00]">=&gt;</span>
              <div className="mc-slot w-9 h-9 flex items-center justify-center relative">
                <ItemIcon itemId={ItemId.Coal} size={22} />
                {!isCreative && (
                  <span className="absolute bottom-0 right-0.5 font-pixel text-[9px] text-white drop-shadow-[1px_1px_0_#000]">
                    {coalCount}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="mc-slot w-12 h-12 flex items-center justify-center relative border-[#ffaa00]">
                <ItemIcon itemId={selectedRecipe.output} size={34} />
                {selectedRecipe.outputCount > 1 && (
                  <span className="absolute bottom-0 right-0.5 font-pixel text-[10px] text-white drop-shadow-[1px_1px_0_#000]">
                    {selectedRecipe.outputCount}
                  </span>
                )}
              </div>
              <span className="font-ui text-[10px] text-[#222]">Output</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={!canSmelt}
              onClick={() => handleSmelt(1)}
              className="mc-btn mc-btn-primary px-4 py-1.5 text-xs"
            >
              Smelt 1
            </button>
            <button
              type="button"
              disabled={!canSmelt}
              onClick={() => handleSmelt(4)}
              className="mc-btn px-4 py-1.5 text-xs"
            >
              Smelt ×4
            </button>
          </div>
        </div>

        {smeltMsg && (
          <div className="mb-2.5 text-center font-pixel text-[11px] text-[#1f5c1a]">
            {smeltMsg}
          </div>
        )}

        {/* Recipe List */}
        <div className="text-[11px] font-pixel text-[#3f3f3f] mb-1.5">Select Smelting Recipe</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto mc-scroll pr-1">
          {SMELT_RECIPES.map((r) => {
            const hasIn = isCreative || countInInventory(r.input) > 0;
            const active = r.id === selectedRecipeId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setSelectedRecipeId(r.id);
                  setSmeltMsg(null);
                }}
                className={`flex items-center gap-2 p-2 border text-left cursor-pointer ${
                  active
                    ? 'bg-[#67a93f]/30 border-[#2f5e1a]'
                    : hasIn
                    ? 'bg-[#b4b4b4] border-[#6e6e6e] hover:bg-[#c4c4c4]'
                    : 'bg-[#9a9a9a] border-[#777] opacity-65 hover:opacity-90'
                }`}
              >
                <ItemIcon itemId={r.input} size={22} />
                <span className="font-pixel text-[11px] text-[#222]">-&gt;</span>
                <ItemIcon itemId={r.output} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="font-ui text-[11px] font-semibold text-[#1f1f1f] truncate">
                    {getItemDef(r.output)?.name}
                  </div>
                  <div className="font-ui text-[10px] text-[#444] truncate">{r.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
