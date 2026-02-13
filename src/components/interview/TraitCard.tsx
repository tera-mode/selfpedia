'use client';

import { UserTrait, TRAIT_CATEGORY_LABELS, TRAIT_CATEGORY_COLORS } from '@/types';
import IntensityLabel from './IntensityLabel';

type TraitCardSize = 'full' | 'compact' | 'mini';

interface TraitCardProps {
  trait: UserTrait;
  size?: TraitCardSize;
  isNew?: boolean;
  isUpdated?: boolean;
}

export default function TraitCard({
  trait,
  size = 'full',
  isNew = false,
  isUpdated = false,
}: TraitCardProps) {
  const categoryLabel = TRAIT_CATEGORY_LABELS[trait.category];
  const categoryColors = TRAIT_CATEGORY_COLORS[trait.category];

  // ハイライトのスタイル
  const highlightClass = isNew
    ? 'ring-2 ring-orange-400 ring-opacity-60 animate-pulse'
    : isUpdated
    ? 'ring-2 ring-amber-400 ring-opacity-60'
    : '';

  if (size === 'mini') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${categoryColors} ${highlightClass}`}
      >
        {trait.icon && <span>{trait.icon}</span>}
        <span className="truncate max-w-[80px]">{trait.label}</span>
      </span>
    );
  }

  if (size === 'compact') {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border p-2 transition-all duration-300 ${categoryColors} ${highlightClass}`}
      >
        {trait.icon && <span className="text-lg flex-shrink-0">{trait.icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm truncate">{trait.label}</span>
            <IntensityLabel intensityLabel={trait.intensityLabel} size="sm" />
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs opacity-75">{categoryLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  // full size
  return (
    <div
      className={`rounded-xl border-2 p-3 transition-all duration-300 ${categoryColors} ${highlightClass} ${
        isNew || isUpdated ? 'shadow-lg' : 'shadow-sm'
      } ${isNew ? 'animate-trait-discover' : ''}`}
    >
      <div className="flex items-start gap-2">
        {trait.icon && (
          <span className="text-2xl flex-shrink-0">{trait.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-base truncate">{trait.label}</span>
              <IntensityLabel intensityLabel={trait.intensityLabel} size="md" />
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 flex-shrink-0">
              {categoryLabel}
            </span>
          </div>
          {trait.description && (
            <p className="text-xs mt-1 opacity-80 line-clamp-2">
              {trait.description}
            </p>
          )}
          {trait.keywords.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {trait.keywords.slice(0, 2).map((keyword, index) => (
                <span
                  key={index}
                  className="text-xs px-1.5 py-0.5 rounded bg-white/40"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
