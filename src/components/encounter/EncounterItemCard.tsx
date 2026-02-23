'use client';

import { ExternalLink, Star } from 'lucide-react';
import { RecommendedItem, EncounterCategory } from '@/types/encounter';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

interface EncounterItemCardProps {
  item: RecommendedItem;
  category: EncounterCategory;
  position: number;
}

function formatPrice(price: number | null): string {
  if (price === null) return '';
  return `¥${price.toLocaleString('ja-JP')}`;
}

function formatRating(rating: number | null): string {
  if (rating === null) return '';
  return rating.toFixed(1);
}

const CATEGORY_EMOJI: Record<EncounterCategory, string> = {
  books: '📚',
  movies: '🎬',
  anime: '📺',
  games: '🎮',
  goods: '🎁',
  skills: '🛠️',
};

const CATEGORY_CTA: Record<EncounterCategory, string> = {
  books: '楽天で見る',
  movies: '詳細を見る',
  anime: '楽天で探す',
  games: '楽天で探す',
  goods: '楽天で見る',
  skills: '楽天で見る',
};

export default function EncounterItemCard({ item, category, position }: EncounterItemCardProps) {
  const handleClick = async () => {
    try {
      const res = await authenticatedFetch('/api/encounter/click', {
        method: 'POST',
        body: JSON.stringify({
          productId: item.id,
          productSource: item.source,
          affiliateUrl: item.affiliateUrl,
          category,
          position,
        }),
      });
      const data = await res.json();
      window.open(data.redirectUrl || item.affiliateUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(item.affiliateUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="glass-card overflow-hidden flex flex-col h-full">
      {/* サムネイル — 通常の <img> タグで外部ドメイン制限を回避 */}
      <div className="relative flex-shrink-0 overflow-hidden bg-gradient-to-b from-stone-50 to-stone-100" style={{ height: '176px' }}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">
            {CATEGORY_EMOJI[category]}
          </div>
        )}
        {/* 評価バッジ */}
        {item.rating !== null && (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
            <Star size={9} className="fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-medium text-white">{formatRating(item.rating)}</span>
          </div>
        )}
      </div>

      {/* 商品情報 */}
      <div className="flex flex-1 flex-col p-3 gap-1.5">
        <h3 className="text-xs font-semibold text-stone-800 line-clamp-3 leading-snug flex-1">
          {item.name}
        </h3>

        {item.price !== null && (
          <p className="text-xs font-bold text-emerald-700">{formatPrice(item.price)}</p>
        )}

        {/* 推薦理由 */}
        <p className="text-[11px] leading-relaxed text-stone-500 line-clamp-2">
          💫 {item.reason}
        </p>

        {/* CTAボタン */}
        <button
          onClick={handleClick}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-xl btn-gradient-primary py-2 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {CATEGORY_CTA[category]}
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}
