import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getItemDef } from '../../shared/blocks';
import { CRAFTING_RECIPES, matchCraftingRecipe } from '../../shared/recipes';
import { AnyItemId, InventorySlot, ItemCategory } from '../../shared/types';
import { soundFX } from '../engine/SoundFX';
import { useGame } from '../state/GameStore';
import { ItemIcon } from './ItemIcon';

interface InventoryModalProps {
  onClose: () => void;
}

type SlotSource =
  | { kind: 'inv'; index: number }
  | { kind: 'craft'; index: number };

interface DragOrigin {
  src: SlotSource;
  x: number;
  y: number;
  moved: boolean;
}

type CreativeTab = 'all' | 'building' | 'natural' | 'functional' | 'tool' | 'material';

const CREATIVE_TABS: { id: CreativeTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'building', label: 'Build' },
  { id: 'natural', label: 'Nature' },
  { id: 'functional', label: 'Func' },
  { id: 'tool', label: 'Tools' },
  { id: 'material', label: 'Mat/Food' },
];

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
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{
    itemId: AnyItemId;
    durability?: number;
  } | null>(null);
  const [showRecipes, setShowRecipes] = useState(true);
  const [creativeTab, setCreativeTab] = useState<CreativeTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyCraftable, setOnlyCraftable] = useState(false);

  const dragOriginRef = useRef<DragOrigin | null>(null);
  const craftGridRef = useRef(craftGrid);
  const cursorItemRef = useRef(cursorItem);
  const inventoryRef = useRef(inventory);
  const returnedRef = useRef(false);

  craftGridRef.current = craftGrid;
  cursorItemRef.current = cursorItem;
  inventoryRef.current = inventory;

  const updateCursorItem = useCallback((val: InventorySlot | null) => {
    cursorItemRef.current = val;
    setCursorItem(val);
  }, []);

  const updateCraftGrid = useCallback(
    (updater: (prev: (InventorySlot | null)[]) => (InventorySlot | null)[]) => {
      const next = updater(craftGridRef.current);
      craftGridRef.current = next;
      setCraftGrid(next);
    },
    []
  );

  const returnPendingItemsOnce = useCallback(() => {
    if (returnedRef.current) return;
    returnedRef.current = true;

    craftGridRef.current.forEach((slot) => {
      if (slot) addItemToInventory(slot.itemId, slot.count, slot.durability);
    });
    craftGridRef.current = Array(9).fill(null);

    if (cursorItemRef.current) {
      addItemToInventory(
        cursorItemRef.current.itemId,
        cursorItemRef.current.count,
        cursorItemRef.current.durability
      );
      cursorItemRef.current = null;
    }
  }, [addItemToInventory]);

  // Ensure items in craftGrid/cursorItem are NEVER lost even when closed via 'E' or 'Esc'
  useEffect(() => {
    return () => {
      returnPendingItemsOnce();
    };
  }, [returnPendingItemsOnce]);

  const handleClose = useCallback(() => {
    returnPendingItemsOnce();
    soundFX.playClick();
    onClose();
  }, [onClose, returnPendingItemsOnce]);

  // Escape & E handling cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Escape') {
          (e.target as HTMLElement).blur();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handleClose]);

  const getSlotValue = useCallback((src: SlotSource): InventorySlot | null => {
    return src.kind === 'inv'
      ? inventoryRef.current[src.index]
      : craftGridRef.current[src.index];
  }, []);

  const setSlotValue = useCallback(
    (src: SlotSource, val: InventorySlot | null) => {
      if (src.kind === 'inv') {
        setInventory((prev) => {
          const next = [...prev];
          next[src.index] = val;
          inventoryRef.current = next;
          return next;
        });
      } else {
        updateCraftGrid((prev) => {
          const next = [...prev];
          next[src.index] = val;
          return next;
        });
      }
    },
    [setInventory, updateCraftGrid]
  );

  // Global pointer tracking for smooth drag-and-drop & floating cursor item
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      const origin = dragOriginRef.current;
      if (origin && !origin.moved) {
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
        if (dist > 5) {
          origin.moved = true;
          if (!cursorItemRef.current) {
            const val = getSlotValue(origin.src);
            if (val) {
              updateCursorItem(val);
              setSlotValue(origin.src, null);
              soundFX.playClick();
            }
          }
        }
      }
    };

    const onPointerUp = () => {
      window.setTimeout(() => {
        dragOriginRef.current = null;
      }, 0);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [getSlotValue, setSlotValue, updateCursorItem]);

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

  const handleClearCraftGrid = () => {
    let any = false;
    craftGridRef.current.forEach((slot) => {
      if (slot) {
        any = true;
        addItemToInventory(slot.itemId, slot.count, slot.durability);
      }
    });
    if (any) {
      soundFX.playClick();
      updateCraftGrid(() => Array(9).fill(null));
    }
  };

  const handleShiftMove = (src: SlotSource) => {
    const current = getSlotValue(src);
    if (!current) return;

    const def = getItemDef(current.itemId);
    const maxStack = def?.stackSize ?? 64;

    if (src.kind === 'craft') {
      addItemToInventory(current.itemId, current.count, current.durability);
      setSlotValue(src, null);
      soundFX.playClick();
      return;
    }

    const targetStart = src.index < 9 ? 9 : 0;
    const targetEnd = src.index < 9 ? 36 : 9;

    setInventory((prev) => {
      const next = prev.map((s) => (s ? { ...s } : null));
      let rem = current.count;

      if (maxStack > 1) {
        for (let i = targetStart; i < targetEnd && rem > 0; i++) {
          const t = next[i];
          if (t && t.itemId === current.itemId && t.count < maxStack) {
            const add = Math.min(rem, maxStack - t.count);
            t.count += add;
            rem -= add;
          }
        }
      }

      for (let i = targetStart; i < targetEnd && rem > 0; i++) {
        if (!next[i]) {
          const add = Math.min(rem, maxStack);
          next[i] = {
            itemId: current.itemId,
            count: add,
            durability: current.durability,
          };
          rem -= add;
        }
      }

      next[src.index] = rem > 0 ? { ...current, count: rem } : null;
      inventoryRef.current = next;
      return next;
    });
    soundFX.playClick();
  };

  const applyLeftSlotAction = (src: SlotSource) => {
    const current = getSlotValue(src);
    const held = cursorItemRef.current;

    if (!held) {
      if (current) {
        updateCursorItem(current);
        setSlotValue(src, null);
        soundFX.playClick();
      }
      return;
    }

    if (!current) {
      setSlotValue(src, held);
      updateCursorItem(null);
      soundFX.playClick();
      return;
    }

    if (current.itemId === held.itemId) {
      const maxStack = getItemDef(current.itemId)?.stackSize ?? 64;
      if (maxStack > 1 && current.count < maxStack) {
        const move = Math.min(held.count, maxStack - current.count);
        setSlotValue(src, { ...current, count: current.count + move });
        if (held.count - move <= 0) {
          updateCursorItem(null);
        } else {
          updateCursorItem({ ...held, count: held.count - move });
        }
        soundFX.playClick();
        return;
      }
    }

    setSlotValue(src, held);
    updateCursorItem(current);
    soundFX.playClick();
  };

  const handleSlotPointerDown = (e: React.PointerEvent, src: SlotSource) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    if (e.button === 2) {
      e.preventDefault();
      soundFX.playClick();
      const current = getSlotValue(src);
      const held = cursorItemRef.current;

      if (!held) {
        if (!current) return;
        const take = Math.ceil(current.count / 2);
        const remain = current.count - take;
        updateCursorItem({ ...current, count: take });
        setSlotValue(src, remain > 0 ? { ...current, count: remain } : null);
        return;
      }

      const maxStack = getItemDef(held.itemId)?.stackSize ?? 64;
      if (!current) {
        setSlotValue(src, { ...held, count: 1 });
        if (held.count <= 1) updateCursorItem(null);
        else updateCursorItem({ ...held, count: held.count - 1 });
      } else if (current.itemId === held.itemId && current.count < maxStack) {
        setSlotValue(src, { ...current, count: current.count + 1 });
        if (held.count <= 1) updateCursorItem(null);
        else updateCursorItem({ ...held, count: held.count - 1 });
      }
      return;
    }

    if (e.button !== 0) return;

    if (e.shiftKey) {
      handleShiftMove(src);
      return;
    }

    dragOriginRef.current = {
      src,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
  };

  const handleSlotPointerUp = (e: React.PointerEvent, target: SlotSource) => {
    if (e.button !== 0 || e.shiftKey) return;
    const origin = dragOriginRef.current;

    if (origin && origin.moved) {
      if (cursorItemRef.current) {
        applyLeftSlotAction(target);
      }
      dragOriginRef.current = null;
      return;
    }

    applyLeftSlotAction(target);
    dragOriginRef.current = null;
  };

  const handleCraftOutput = (e: React.MouseEvent) => {
    if (!matchedRecipe) return;
    const def = getItemDef(matchedRecipe.result.itemId);
    const outCount = matchedRecipe.result.count;
    const maxStack = def?.stackSize ?? 64;

    if (e.shiftKey) {
      let minIng = Infinity;
      for (let i = 0; i < gridDim * gridDim; i++) {
        const s = craftGridRef.current[i];
        if (s && s.count < minIng) minIng = s.count;
      }
      if (minIng === Infinity || minIng <= 0) return;

      const maxBatchesByStack = Math.max(1, Math.floor(maxStack / outCount));
      const batches = Math.min(minIng, maxBatchesByStack);

      updateCraftGrid((prev) => {
        const next = [...prev];
        for (let i = 0; i < gridDim * gridDim; i++) {
          const s = next[i];
          if (s) {
            next[i] = s.count > batches ? { ...s, count: s.count - batches } : null;
          }
        }
        return next;
      });
      addItemToInventory(matchedRecipe.result.itemId, outCount * batches, def?.maxDurability);
      soundFX.playCraft();
      return;
    }

    const held = cursorItemRef.current;
    if (held) {
      if (held.itemId !== matchedRecipe.result.itemId) return;
      if (held.count + outCount > maxStack) return;
    }

    soundFX.playCraft();

    updateCraftGrid((prev) => {
      const next = [...prev];
      for (let i = 0; i < gridDim * gridDim; i++) {
        const s = next[i];
        if (s) {
          next[i] = s.count > 1 ? { ...s, count: s.count - 1 } : null;
        }
      }
      return next;
    });

    if (held) {
      updateCursorItem({ ...held, count: held.count + outCount });
    } else {
      updateCursorItem({
        itemId: matchedRecipe.result.itemId,
        count: outCount,
        durability: def?.maxDurability,
      });
    }
  };

  const getRecipeRequirements = (recipeId: string): Map<AnyItemId, number> => {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    const required = new Map<AnyItemId, number>();
    if (!recipe) return required;
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
    return required;
  };

  const availableInventoryCounts = useMemo(() => {
    const map = new Map<AnyItemId, number>();
    inventory.forEach((s) => {
      if (s) map.set(s.itemId, (map.get(s.itemId) ?? 0) + s.count);
    });
    return map;
  }, [inventory]);

  const canCraftRecipeFromInv = useCallback(
    (recipeId: string): boolean => {
      const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
      if (!recipe) return false;
      if (recipe.requiresTable && !craftingTableOpen) return false;
      const required = getRecipeRequirements(recipeId);
      for (const [id, need] of required.entries()) {
        if ((availableInventoryCounts.get(id) ?? 0) < need) return false;
      }
      return true;
    },
    [availableInventoryCounts, craftingTableOpen]
  );

  const handleQuickCraftRecipe = (recipeId: string) => {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    if (recipe.requiresTable && !craftingTableOpen) return;

    const required = getRecipeRequirements(recipeId);
    for (const [id, need] of required.entries()) {
      if ((availableInventoryCounts.get(id) ?? 0) < need) return;
    }

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
      inventoryRef.current = next;
      return next;
    });

    const outDef = getItemDef(recipe.result.itemId);
    addItemToInventory(recipe.result.itemId, recipe.result.count, outDef?.maxDurability);
    soundFX.playCraft();
  };

  const filteredCreativeItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return creativeCatalog.filter((id) => {
      const def = getItemDef(id);
      if (!def) return false;
      if (creativeTab !== 'all') {
        if (creativeTab === 'material') {
          if (def.category !== 'material' && def.category !== 'food') return false;
        } else if (def.category !== (creativeTab as ItemCategory)) {
          return false;
        }
      }
      if (q && !def.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [creativeCatalog, creativeTab, searchQuery]);

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CRAFTING_RECIPES.filter((r) => {
      if (onlyCraftable && !canCraftRecipeFromInv(r.id)) return false;
      if (q) {
        const def = getItemDef(r.result.itemId);
        if (!def?.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [canCraftRecipeFromInv, onlyCraftable, searchQuery]);

  const renderSlot = (slot: InventorySlot | null, src: SlotSource, key: string) => {
    const def = slot ? getItemDef(slot.itemId) : undefined;
    const durRatio =
      slot && slot.durability !== undefined && def?.maxDurability
        ? slot.durability / def.maxDurability
        : null;

    return (
      <div
        key={key}
        onPointerDown={(e) => handleSlotPointerDown(e, src)}
        onPointerUp={(e) => handleSlotPointerUp(e, src)}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={(e) => {
          setMousePos({ x: e.clientX, y: e.clientY });
          setHoveredItem(
            slot ? { itemId: slot.itemId, durability: slot.durability } : null
          );
        }}
        onMouseLeave={() => setHoveredItem(null)}
        className="mc-slot relative w-11 h-11 flex items-center justify-center cursor-pointer"
      >
        {slot && <ItemIcon itemId={slot.itemId} size={30} />}
        {slot && slot.count > 1 && (
          <span
            className="absolute bottom-0 right-1 font-pixel text-[11px] text-white leading-none pointer-events-none"
            style={{ textShadow: '1px 1px 0 #1f1f1f' }}
          >
            {slot.count}
          </span>
        )}
        {durRatio !== null && durRatio < 1 && (
          <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-[#1a1a1a] pointer-events-none">
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
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-4 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col lg:flex-row items-stretch gap-3 max-w-5xl w-full justify-center">
        {/* Classic Minecraft Recipe Book / Creative Catalog Panel */}
        {showRecipes && (
          <div className="mc-gui-panel p-3.5 w-full lg:w-80 flex flex-col max-h-[468px]">
            <div className="flex items-center justify-between border-b-2 border-[#7c7c7c] pb-2 mb-2">
              <h3 className="font-pixel text-xs text-[#3f3f3f]">
                {isCreative ? `Creative (${filteredCreativeItems.length})` : 'Recipe Book'}
              </h3>
              {!isCreative && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setOnlyCraftable((v) => !v);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-pixel border cursor-pointer ${
                    onlyCraftable
                      ? 'bg-[#5d8e3e] text-white border-[#2f4f1c]'
                      : 'bg-[#8b8b8b] text-[#262626] border-[#4f4f4f]'
                  }`}
                >
                  {onlyCraftable ? 'Craftable' : 'All'}
                </button>
              )}
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={isCreative ? 'Search blocks & items...' : 'Filter recipes...'}
              className="w-full mb-2 px-2 py-1 text-xs font-ui bg-[#262626] text-white border-2 border-[#4f4f4f] placeholder:text-stone-400 focus:outline-none focus:border-[#ffffa0]"
            />

            {/* Creative Category Tabs */}
            {isCreative && (
              <div className="grid grid-cols-3 gap-1 mb-2">
                {CREATIVE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setCreativeTab(tab.id);
                    }}
                    className={`py-1 px-1 text-[10px] font-pixel border cursor-pointer truncate ${
                      creativeTab === tab.id
                        ? 'bg-[#5d8e3e] text-white border-[#2f4f1c]'
                        : 'bg-[#9b9b9b] text-[#2a2a2a] border-[#525252] hover:bg-[#adadad]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {isCreative ? (
              <div className="grid grid-cols-6 gap-1 overflow-y-auto mc-scroll pr-1">
                {filteredCreativeItems.map((id) => {
                  const def = getItemDef(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={(e) => {
                        soundFX.playClick();
                        setMousePos({ x: e.clientX, y: e.clientY });
                        const count = def?.stackSize ?? 64;
                        if (e.shiftKey || cursorItemRef.current) {
                          addItemToInventory(id, count, def?.maxDurability);
                        } else {
                          updateCursorItem({
                            itemId: id,
                            count,
                            durability: def?.maxDurability,
                          });
                        }
                      }}
                      onMouseEnter={(e) => {
                        setMousePos({ x: e.clientX, y: e.clientY });
                        setHoveredItem({ itemId: id });
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="mc-slot w-10 h-10 flex items-center justify-center cursor-pointer"
                      title={def?.name}
                    >
                      <ItemIcon itemId={id} size={26} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto mc-scroll pr-1">
                {filteredRecipes.map((recipe) => {
                  const outDef = getItemDef(recipe.result.itemId);
                  const craftable = canCraftRecipeFromInv(recipe.id);
                  const lockedByTable = recipe.requiresTable && !craftingTableOpen;
                  const reqs = Array.from(getRecipeRequirements(recipe.id).entries());
                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      disabled={!craftable}
                      onClick={() => handleQuickCraftRecipe(recipe.id)}
                      onMouseEnter={(e) => {
                        setMousePos({ x: e.clientX, y: e.clientY });
                        setHoveredItem({ itemId: recipe.result.itemId });
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`w-full flex items-center justify-between gap-2 p-1.5 border-2 text-left ${
                        craftable
                          ? 'bg-[#8b8b8b] border-t-white border-l-white border-r-[#373737] border-b-[#373737] hover:bg-[#9c9c9c] cursor-pointer'
                          : 'bg-[#707070] border-[#454545] opacity-65 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ItemIcon itemId={recipe.result.itemId} size={24} />
                        <div className="min-w-0">
                          <div className="font-pixel text-[11px] text-white truncate">
                            {outDef?.name} ×{recipe.result.count}
                          </div>
                          {lockedByTable ? (
                            <div className="text-[10px] font-ui text-[#ffaaaa]">
                              Requires 3×3 Table
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {reqs.map(([ingId, qty]) => (
                                <span
                                  key={ingId}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-mono-tabular text-stone-200"
                                >
                                  <ItemIcon itemId={ingId} size={13} />×{qty}
                                </span>
                              ))}
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

        {/* Classic #c6c6c6 Minecraft Inventory Window */}
        <div className="mc-gui-panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-pixel text-sm text-[#3f3f3f]">
              {craftingTableOpen ? 'Crafting (3×3)' : 'Inventory'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setShowRecipes((s) => !s);
                }}
                className="mc-btn px-2.5 py-1 text-[10px]"
              >
                {showRecipes ? 'Hide Book' : 'Recipe Book'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="mc-btn mc-btn-danger px-2.5 py-1 text-[10px]"
              >
                Done
              </button>
            </div>
          </div>

          {/* Top Row: Black Steve Portrait + Crafting Grid */}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="w-28 h-32 bg-black border-t-2 border-l-2 border-[#373737] border-r-2 border-b-2 border-r-white border-b-white flex flex-col items-center justify-center relative">
              <div className="w-9 h-9 bg-[#c99374] border border-[#2b1a0e] relative">
                <div className="absolute top-0 left-0 right-0 h-2.5 bg-[#4a321d]" />
                <div className="absolute top-4 left-1.5 w-1.5 h-1.5 bg-[#4062b8]" />
                <div className="absolute top-4 right-1.5 w-1.5 h-1.5 bg-[#4062b8]" />
                <div className="absolute bottom-1.5 left-3 right-3 h-1 bg-[#7d4935]" />
              </div>
              <div className="flex items-start">
                <div className="w-3.5 h-10 bg-[#c99374] border border-[#2b1a0e]">
                  <div className="h-3.5 bg-[#20a3a8]" />
                </div>
                <div className="w-9 h-10 bg-[#20a3a8] border-y border-[#145d61]" />
                <div className="w-3.5 h-10 bg-[#c99374] border border-[#2b1a0e]">
                  <div className="h-3.5 bg-[#20a3a8]" />
                </div>
              </div>
              <div className="flex">
                <div className="w-4.5 h-8 bg-[#344085] border border-[#1a224a]" />
                <div className="w-4.5 h-8 bg-[#344085] border border-[#1a224a]" />
              </div>
            </div>

            {/* Crafting Grid */}
            <div className="flex items-center gap-3 pr-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-pixel text-[11px] text-[#3f3f3f]">Crafting</span>
                  {craftGrid.some(Boolean) && (
                    <button
                      type="button"
                      onClick={handleClearCraftGrid}
                      className="text-[10px] font-ui text-[#3f3f3f] hover:text-black underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${gridDim}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: gridDim * gridDim }).map((_, idx) =>
                    renderSlot(craftGrid[idx], { kind: 'craft', index: idx }, `craft-${idx}`)
                  )}
                </div>
              </div>

              <div className="font-pixel text-2xl text-[#555555] pt-4">→</div>

              <div className="pt-4 flex items-center gap-2">
                <div
                  onClick={handleCraftOutput}
                  onMouseEnter={(e) => {
                    setMousePos({ x: e.clientX, y: e.clientY });
                    setHoveredItem(
                      matchedRecipe ? { itemId: matchedRecipe.result.itemId } : null
                    );
                  }}
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
                        <span
                          className="absolute bottom-0.5 right-1 font-pixel text-[11px] text-white"
                          style={{ textShadow: '1px 1px 0 #1f1f1f' }}
                        >
                          {matchedRecipe.result.count}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {isCreative && (
                  <button
                    type="button"
                    title="Destroy Held Item"
                    onClick={() => {
                      if (cursorItemRef.current) {
                        soundFX.playClick();
                        updateCursorItem(null);
                      }
                    }}
                    className="mc-slot w-11 h-11 flex items-center justify-center bg-[#9c4c4c] hover:bg-[#b85a5a] cursor-pointer font-pixel text-sm text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3x9 Main Inventory */}
          <div className="grid grid-cols-9 gap-0.5">
            {Array.from({ length: 27 }).map((_, i) =>
              renderSlot(inventory[9 + i], { kind: 'inv', index: 9 + i }, `inv-${9 + i}`)
            )}
          </div>

          {/* 1x9 Hotbar */}
          <div className="pt-2 grid grid-cols-9 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) =>
              renderSlot(inventory[i], { kind: 'inv', index: i }, `hotbar-${i}`)
            )}
          </div>

          <div className="text-[11px] font-ui text-[#4a4a4a]">
            Click or Drag stacks · Right-Click splits/places 1 · Shift-Click quick-moves
          </div>
        </div>
      </div>

      {/* Classic Dark-Purple Minecraft Tooltip */}
      {hoveredDef && !cursorItem && mousePos && (
        <div
          className="mc-tooltip fixed z-50 pointer-events-none px-2.5 py-1.5"
          style={{ left: mousePos.x + 14, top: mousePos.y - 36 }}
        >
          <div className="font-pixel text-xs text-white">{hoveredDef.name}</div>
          {hoveredItem?.durability !== undefined && hoveredDef.maxDurability && (
            <div className="text-[10px] font-mono-tabular text-[#aaaaaa]">
              Durability: {hoveredItem.durability} / {hoveredDef.maxDurability}
            </div>
          )}
          {hoveredDef.foodValue && (
            <div className="text-[10px] font-ui text-[#aaaaaa]">
              Restores {hoveredDef.foodValue} Hunger
            </div>
          )}
        </div>
      )}

      {/* Floating Cursor Item Stack */}
      {cursorItem && mousePos && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: mousePos.x - 16, top: mousePos.y - 16 }}
        >
          <div className="relative">
            <ItemIcon itemId={cursorItem.itemId} size={34} />
            {cursorItem.count > 1 && (
              <span
                className="absolute -bottom-1 -right-1 font-pixel text-xs text-white"
                style={{ textShadow: '1px 1px 0 #000' }}
              >
                {cursorItem.count}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
