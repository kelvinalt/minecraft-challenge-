import React, { useEffect, useMemo, useState } from 'react';
import { getItemDef } from '../../shared/blocks';
import { CRAFTING_RECIPES, matchCraftingRecipe } from '../../shared/recipes';
import { AnyItemId, InventorySlot } from '../../shared/types';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';
import { ItemIcon } from './ItemIcon';

interface InventoryModalProps {
  onClose: () => void;
}

type SlotSource =
  | { kind: 'inv'; index: number }
  | { kind: 'craft'; index: number };

export const InventoryModal: React.FC<InventoryModalProps> = ({ onClose }) => {
  const {
    activeWorld,
    inventory,
    setInventory,
    craftingTableOpen,
    creativeCatalog,
    addItemToInventory,
  } = useGame();

  const gridDim: 2 | 3 = craftingTableOpen ? 3 : 2;
  const [craftGrid, setCraftGrid] = useState<(InventorySlot | null)[]>(() =>
    Array(9).fill(null)
  );
  const [cursorItem, setCursorItem] = useState<InventorySlot | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState<{
    itemId: AnyItemId;
    durability?: number;
  } | null>(null);
  const [showRecipes, setShowRecipes] = useState(true);
  const [dragSource, setDragSource] = useState<SlotSource | null>(null);

  // Track pointer for floating cursor item & player avatar gaze
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Return items left in crafting grid on unmount
  useEffect(() => {
    return () => {
      // Any leftover items in craftGrid are returned when closing via button
    };
  }, []);

  const handleClose = () => {
    // Return any crafting grid items or cursor item safely back to inventory
    craftGrid.forEach((slot) => {
      if (slot) addItemToInventory(slot.itemId, slot.count);
    });
    if (cursorItem) {
      addItemToInventory(cursorItem.itemId, cursorItem.count);
    }
    soundFX.playClick();
    onClose();
  };

  // Evaluate crafting output
  const activeCraftIds = useMemo(() => {
    const arr: (AnyItemId | null)[] = [];
    for (let i = 0; i < gridDim * gridDim; i++) {
      arr.push(craftGrid[i]?.itemId ?? null);
    }
    return arr;
  }, [craftGrid, gridDim]);

  const matchedRecipe = useMemo(
    () => matchCraftingRecipe(activeCraftIds, gridDim),
    [activeCraftIds, gridDim]
  );

  const getSlotValue = (src: SlotSource): InventorySlot | null =>
    src.kind === 'inv' ? inventory[src.index] : craftGrid[src.index];

  const setSlotValue = (src: SlotSource, val: InventorySlot | null) => {
    if (src.kind === 'inv') {
      setInventory((prev) => {
        const next = [...prev];
        next[src.index] = val;
        return next;
      });
    } else {
      setCraftGrid((prev) => {
        const next = [...prev];
        next[src.index] = val;
        return next;
      });
    }
  };

  const handleSlotLeftClick = (src: SlotSource) => {
    soundFX.playClick();
    const current = getSlotValue(src);

    if (!cursorItem) {
      if (current) {
        setCursorItem(current);
        setSlotValue(src, null);
      }
      return;
    }

    // Cursor has item
    if (!current) {
      setSlotValue(src, cursorItem);
      setCursorItem(null);
      return;
    }

    if (current.itemId === cursorItem.itemId) {
      const maxStack = getItemDef(current.itemId)?.stackSize ?? 64;
      if (current.count < maxStack) {
        const move = Math.min(cursorItem.count, maxStack - current.count);
        setSlotValue(src, { ...current, count: current.count + move });
        if (cursorItem.count - move <= 0) setCursorItem(null);
        else setCursorItem({ ...cursorItem, count: cursorItem.count - move });
        return;
      }
    }

    // Swap stacks
    setSlotValue(src, cursorItem);
    setCursorItem(current);
  };

  const handleSlotRightClick = (e: React.MouseEvent, src: SlotSource) => {
    e.preventDefault();
    soundFX.playClick();
    const current = getSlotValue(src);

    if (!cursorItem) {
      if (!current) return;
      const take = Math.ceil(current.count / 2);
      const remain = current.count - take;
      setCursorItem({ ...current, count: take });
      setSlotValue(src, remain > 0 ? { ...current, count: remain } : null);
      return;
    }

    // Place 1 item from cursor
    const maxStack = getItemDef(cursorItem.itemId)?.stackSize ?? 64;
    if (!current) {
      setSlotValue(src, { ...cursorItem, count: 1 });
      if (cursorItem.count <= 1) setCursorItem(null);
      else setCursorItem({ ...cursorItem, count: cursorItem.count - 1 });
    } else if (current.itemId === cursorItem.itemId && current.count < maxStack) {
      setSlotValue(src, { ...current, count: current.count + 1 });
      if (cursorItem.count <= 1) setCursorItem(null);
      else setCursorItem({ ...cursorItem, count: cursorItem.count - 1 });
    }
  };

  // HTML5 Drag and Drop between slots
  const handleDropOnSlot = (target: SlotSource) => {
    if (!dragSource) return;
    if (dragSource.kind === target.kind && dragSource.index === target.index) {
      setDragSource(null);
      return;
    }
    const sourceVal = getSlotValue(dragSource);
    const targetVal = getSlotValue(target);
    if (!sourceVal) {
      setDragSource(null);
      return;
    }

    soundFX.playClick();
    if (!targetVal) {
      setSlotValue(target, sourceVal);
      setSlotValue(dragSource, null);
    } else if (targetVal.itemId === sourceVal.itemId) {
      const maxStack = getItemDef(targetVal.itemId)?.stackSize ?? 64;
      const move = Math.min(sourceVal.count, maxStack - targetVal.count);
      setSlotValue(target, { ...targetVal, count: targetVal.count + move });
      const rem = sourceVal.count - move;
      setSlotValue(dragSource, rem > 0 ? { ...sourceVal, count: rem } : null);
    } else {
      setSlotValue(target, sourceVal);
      setSlotValue(dragSource, targetVal);
    }
    setDragSource(null);
  };

  const handleCraftOutput = () => {
    if (!matchedRecipe) return;
    const def = getItemDef(matchedRecipe.result.itemId);
    const outCount = matchedRecipe.result.count;
    const maxStack = def?.stackSize ?? 64;

    if (cursorItem) {
      if (cursorItem.itemId !== matchedRecipe.result.itemId) return;
      if (cursorItem.count + outCount > maxStack) return;
    }

    soundFX.playCraft();

    // Consume 1 of each non-empty ingredient in crafting grid
    setCraftGrid((prev) => {
      const next = [...prev];
      for (let i = 0; i < gridDim * gridDim; i++) {
        const s = next[i];
        if (s) {
          next[i] = s.count > 1 ? { ...s, count: s.count - 1 } : null;
        }
      }
      return next;
    });

    if (cursorItem) {
      setCursorItem({ ...cursorItem, count: cursorItem.count + outCount });
    } else {
      setCursorItem({
        itemId: matchedRecipe.result.itemId,
        count: outCount,
        durability: def?.maxDurability,
      });
    }
  };

  const handleQuickCraftRecipe = (recipeId: string) => {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    if (recipe.requiresTable && !craftingTableOpen) return;

    // Count required items
    const required = new Map<AnyItemId, number>();
    if (recipe.shapeless) {
      recipe.shapeless.forEach((id) => required.set(id, (required.get(id) ?? 0) + 1));
    } else if (recipe.pattern && recipe.key) {
      for (const row of recipe.pattern) {
        for (const sym of row) {
          if (sym && recipe.key[sym]) {
            const id = recipe.key[sym];
            required.set(id, (required.get(id) ?? 0) + 1);
          }
        }
      }
    }

    // Check inventory availability
    const available = new Map<AnyItemId, number>();
    inventory.forEach((s) => {
      if (s) available.set(s.itemId, (available.get(s.itemId) ?? 0) + s.count);
    });
    for (const [id, need] of required.entries()) {
      if ((available.get(id) ?? 0) < need) return;
    }

    // Deduct from inventory and add result
    setInventory((prev) => {
      const next = prev.map((s) => (s ? { ...s } : null));
      for (const [id, need] of required.entries()) {
        let rem = need;
        for (let i = 0; i < next.length && rem > 0; i++) {
          const s = next[i];
          if (s && s.itemId === id) {
            const take = Math.min(rem, s.count);
            s.count -= take;
            rem -= take;
            if (s.count <= 0) next[i] = null;
          }
        }
      }
      return next;
    });

    addItemToInventory(recipe.result.itemId, recipe.result.count);
    soundFX.playCraft();
  };

  const canCraftRecipeFromInv = (recipeId: string): boolean => {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;
    if (recipe.requiresTable && !craftingTableOpen) return false;
    const required = new Map<AnyItemId, number>();
    if (recipe.shapeless) {
      recipe.shapeless.forEach((id) => required.set(id, (required.get(id) ?? 0) + 1));
    } else if (recipe.pattern && recipe.key) {
      recipe.pattern.forEach((row) =>
        row.forEach((sym) => {
          if (sym && recipe.key?.[sym]) {
            const id = recipe.key[sym];
            required.set(id, (required.get(id) ?? 0) + 1);
          }
        })
      );
    }
    const available = new Map<AnyItemId, number>();
    inventory.forEach((s) => {
      if (s) available.set(s.itemId, (available.get(s.itemId) ?? 0) + s.count);
    });
    for (const [id, need] of required.entries()) {
      if ((available.get(id) ?? 0) < need) return false;
    }
    return true;
  };

  const renderSlot = (slot: InventorySlot | null, src: SlotSource, key: string) => {
    const def = slot ? getItemDef(slot.itemId) : undefined;
    const durRatio =
      slot && slot.durability !== undefined && def?.maxDurability
        ? slot.durability / def.maxDurability
        : null;

    return (
      <div
        key={key}
        draggable={Boolean(slot)}
        onDragStart={() => setDragSource(src)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDropOnSlot(src)}
        onClick={() => handleSlotLeftClick(src)}
        onContextMenu={(e) => handleSlotRightClick(e, src)}
        onMouseEnter={() =>
          slot ? setHoveredItem({ itemId: slot.itemId, durability: slot.durability }) : setHoveredItem(null)
        }
        onMouseLeave={() => setHoveredItem(null)}
        className="mc-slot relative w-11 h-11 flex items-center justify-center cursor-pointer"
      >
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
      </div>
    );
  };

  const isCreative = activeWorld?.gameMode === 'creative';
  const hoveredDef = hoveredItem ? getItemDef(hoveredItem.itemId) : undefined;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 select-none">
      <div className="flex flex-col lg:flex-row items-stretch gap-3 max-w-5xl w-full justify-center">
        {/* Recipe Book / Creative Catalog Drawer */}
        {showRecipes && (
          <div className="mc-gui-panel p-4 w-full lg:w-72 flex flex-col max-h-[470px]">
            <div className="flex items-center justify-between border-b-2 border-[#7c7c7c] pb-2 mb-3">
              <h3 className="font-pixel text-sm text-[#262626]">
                {isCreative ? 'Creative Catalog' : 'Recipe Book'}
              </h3>
              <span className="text-[11px] font-ui text-[#4a4a4a]">
                {isCreative ? 'Click to add' : 'Click to craft'}
              </span>
            </div>

            {isCreative ? (
              <div className="grid grid-cols-5 gap-1.5 overflow-y-auto mc-scroll pr-1">
                {creativeCatalog.map((id) => {
                  const def = getItemDef(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        addItemToInventory(id, def?.stackSize ?? 64);
                      }}
                      onMouseEnter={() => setHoveredItem({ itemId: id })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="mc-slot w-11 h-11 flex items-center justify-center cursor-pointer"
                      title={def?.name}
                    >
                      <ItemIcon itemId={id} size={28} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto mc-scroll pr-1">
                {CRAFTING_RECIPES.map((recipe) => {
                  const outDef = getItemDef(recipe.result.itemId);
                  const craftable = canCraftRecipeFromInv(recipe.id);
                  const lockedByTable = recipe.requiresTable && !craftingTableOpen;
                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      disabled={!craftable}
                      onClick={() => handleQuickCraftRecipe(recipe.id)}
                      onMouseEnter={() => setHoveredItem({ itemId: recipe.result.itemId })}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full flex items-center justify-between p-1.5 border-2 text-left transition-colors ${
                        craftable
                          ? 'bg-[#b3c9a6] border-[#4b7832] hover:bg-[#a2bd93] cursor-pointer'
                          : 'bg-[#a6a6a6] border-[#757575] opacity-70 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ItemIcon itemId={recipe.result.itemId} size={24} />
                        <div className="min-w-0">
                          <div className="font-pixel text-[11px] text-[#1f1f1f] truncate">
                            {outDef?.name} ×{recipe.result.count}
                          </div>
                          {lockedByTable && (
                            <div className="text-[10px] font-ui text-[#6b2828]">
                              Needs Crafting Table
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Main Inventory & Crafting Panel */}
        <div className="mc-gui-panel p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-pixel text-base text-[#262626]">
              {craftingTableOpen ? 'Crafting Table (3×3)' : 'Inventory & Crafting'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setShowRecipes((s) => !s);
                }}
                className="mc-btn px-2.5 py-1 text-[11px]"
              >
                {showRecipes ? 'Hide Book' : 'Show Book'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="mc-btn mc-btn-danger px-2.5 py-1 text-[11px]"
              >
                Close (E)
              </button>
            </div>
          </div>

          {/* Top Section: Avatar Preview + Crafting Grid */}
          <div className="flex flex-wrap items-center justify-between gap-6 bg-[#b5b5b5] border-2 border-[#7c7c7c] p-3.5">
            {/* Pixel Avatar Preview */}
            <div className="w-24 h-28 bg-[#181a1f] border-2 border-[#373737] flex flex-col items-center justify-center relative overflow-hidden">
              <div className="w-8 h-8 bg-[#d29e7e] border-2 border-[#141414] relative">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[#4a321d]" />
                <div className="absolute top-3 left-1.5 w-1.5 h-1.5 bg-[#2a4a8a]" />
                <div className="absolute top-3 right-1.5 w-1.5 h-1.5 bg-[#2a4a8a]" />
              </div>
              <div className="w-9 h-10 bg-[#27858c] border-x-2 border-b-2 border-[#141414]" />
              <div className="flex">
                <div className="w-4 h-6 bg-[#344075] border-x-2 border-b-2 border-[#141414]" />
                <div className="w-4 h-6 bg-[#344075] border-r-2 border-b-2 border-[#141414]" />
              </div>
            </div>

            {/* Crafting Grid (2x2 or 3x3) + Output */}
            <div className="flex items-center gap-3">
              <div>
                <div className="font-pixel text-[11px] text-[#3a3a3a] mb-1">Crafting</div>
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${gridDim}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: gridDim * gridDim }).map((_, idx) =>
                    renderSlot(craftGrid[idx], { kind: 'craft', index: idx }, `craft-${idx}`)
                  )}
                </div>
              </div>

              <div className="font-pixel text-xl text-[#4a4a4a] px-1 pt-4">→</div>

              <div>
                <div className="font-pixel text-[11px] text-[#3a3a3a] mb-1">Result</div>
                <div
                  onClick={handleCraftOutput}
                  onMouseEnter={() =>
                    matchedRecipe
                      ? setHoveredItem({ itemId: matchedRecipe.result.itemId })
                      : setHoveredItem(null)
                  }
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`mc-slot w-12 h-12 flex items-center justify-center relative ${
                    matchedRecipe
                      ? 'bg-[#a6c993] cursor-pointer outline-2 outline-[#4b7832]'
                      : 'cursor-default'
                  }`}
                >
                  {matchedRecipe && (
                    <>
                      <ItemIcon itemId={matchedRecipe.result.itemId} size={32} />
                      {matchedRecipe.result.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 font-pixel text-[11px] text-white drop-shadow-[1px_1px_0_#000]">
                          {matchedRecipe.result.count}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main 27-Slot Storage (indices 9..35) */}
          <div>
            <div className="font-pixel text-[11px] text-[#3a3a3a] mb-1">Storage</div>
            <div className="grid grid-cols-9 gap-1">
              {Array.from({ length: 27 }).map((_, i) =>
                renderSlot(inventory[9 + i], { kind: 'inv', index: 9 + i }, `inv-${9 + i}`)
              )}
            </div>
          </div>

          {/* 9-Slot Hotbar (indices 0..8) */}
          <div className="pt-1 border-t-2 border-[#8c8c8c]">
            <div className="font-pixel text-[11px] text-[#3a3a3a] mb-1">Hotbar</div>
            <div className="grid grid-cols-9 gap-1">
              {Array.from({ length: 9 }).map((_, i) =>
                renderSlot(inventory[i], { kind: 'inv', index: i }, `hotbar-${i}`)
              )}
            </div>
          </div>

          <p className="text-[11px] font-ui text-[#454545]">
            Drag-and-drop or Left-click to move stacks · Right-click to split or place one item.
          </p>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredDef && !cursorItem && (
        <div
          className="fixed z-50 pointer-events-none bg-[#120b1c]/95 border-2 border-[#4d2680] px-2.5 py-1.5 shadow-lg"
          style={{ left: mousePos.x + 14, top: mousePos.y - 34 }}
        >
          <div className="font-pixel text-xs text-white">{hoveredDef.name}</div>
          <div className="text-[10px] font-ui text-purple-200 capitalize">
            {hoveredDef.category}
            {hoveredItem?.durability !== undefined && hoveredDef.maxDurability
              ? ` · Durability ${hoveredItem.durability}/${hoveredDef.maxDurability}`
              : ''}
            {hoveredDef.foodValue ? ` · Restores ${hoveredDef.foodValue} hunger` : ''}
          </div>
        </div>
      )}

      {/* Floating Cursor Item Stack */}
      {cursorItem && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: mousePos.x - 16, top: mousePos.y - 16 }}
        >
          <div className="relative">
            <ItemIcon itemId={cursorItem.itemId} size={34} />
            {cursorItem.count > 1 && (
              <span className="absolute -bottom-1 -right-1 font-pixel text-xs text-white drop-shadow-[1px_1px_0_#000]">
                {cursorItem.count}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
