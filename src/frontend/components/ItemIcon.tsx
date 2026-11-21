import React, { useMemo } from 'react';
import { AnyItemId } from '../../shared/types';
import { getItemDef } from '../../shared/blocks';
import { getItemIconUrl } from '../engine/TextureAtlas';

interface ItemIconProps {
  itemId: AnyItemId;
  size?: number;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ itemId, size = 32, className = '' }) => {
  const url = useMemo(() => getItemIconUrl(itemId), [itemId]);
  const def = getItemDef(itemId);

  return (
    <img
      src={url}
      alt={def?.name ?? 'Item'}
      width={size}
      height={size}
      draggable={false}
      referrerPolicy="no-referrer"
      className={`pixelated pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
