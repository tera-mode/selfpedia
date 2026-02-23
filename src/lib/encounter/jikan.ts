/**
 * Jikan API ラッパー（MyAnimeListデータ）
 * 完全無料・認証不要。アニメ特化の豊富なデータ。
 * レート制限: 3リクエスト/秒、60リクエスト/分（厳守）
 */

import { rateLimiter } from './rateLimiter';

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';

export interface JikanSearchParams {
  q?: string;
  genres?: string;     // MALジャンルID（カンマ区切り: '1,22'）
  type?: 'tv' | 'movie' | 'ova' | 'special' | 'ona';
  min_score?: number;
  order_by?: 'score' | 'popularity' | 'rank' | 'start_date';
  sort?: 'asc' | 'desc';
  limit?: number;
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_japanese: string | null;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      large_image_url: string;
    };
  };
  synopsis: string | null;
  score: number | null;
  scored_by: number | null;
  url: string;
  genres: { mal_id: number; name: string }[];
}

/** アニメタイトルで楽天Blu-ray検索URLを生成（アフィリエイト対応）*/
function getRakutenAnimeBlurayUrl(title: string): string {
  const keyword = `${title} Blu-ray`;
  const encoded = encodeURIComponent(keyword);
  if (RAKUTEN_AFFILIATE_ID) {
    const dest = `https://search.rakuten.co.jp/search/mall/${encoded}/`;
    return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(dest)}&m=${encodeURIComponent(dest)}`;
  }
  return `https://search.rakuten.co.jp/search/mall/${encoded}/`;
}

export async function searchJikanAnime(params: JikanSearchParams): Promise<JikanAnime[]> {
  const url = new URL(`${JIKAN_API_BASE}/anime`);

  if (params.q) url.searchParams.set('q', params.q);
  if (params.genres) url.searchParams.set('genres', params.genres);
  if (params.type) url.searchParams.set('type', params.type);
  if (params.min_score) url.searchParams.set('min_score', String(params.min_score));
  url.searchParams.set('order_by', params.order_by || 'score');
  url.searchParams.set('sort', params.sort || 'desc');
  url.searchParams.set('limit', String(params.limit || 10));
  url.searchParams.set('sfw', 'true'); // セーフコンテンツのみ

  await rateLimiter.wait('jikan');
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Jikan API error: ${response.status}`);

  const data = await response.json();
  return data.data || [];
}

/** JikanAnime → RecommendedItem 形式に変換 */
export function jikanAnimeToItem(anime: JikanAnime, query: { reason: string; matchedTraits: string[] }) {
  // 日本語タイトル優先
  const displayTitle = anime.title_japanese || anime.title;
  const imageUrl =
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    '';
  // スコアは MAL の 1-10 → 表示用 0.0-5.0 に変換
  const rating = anime.score ? parseFloat((anime.score / 2).toFixed(1)) : null;

  return {
    id: `jikan_${anime.mal_id}`,
    source: 'jikan' as const,
    name: displayTitle,
    price: null as null,
    imageUrl,
    affiliateUrl: getRakutenAnimeBlurayUrl(displayTitle),
    originalUrl: anime.url,
    rating,
    reason: query.reason,
    matchedTraits: query.matchedTraits,
    score: 0.7,
  };
}

// Jikanジャンル ID（MAL準拠）
export const JIKAN_GENRE_IDS = {
  action: 1,
  adventure: 2,
  comedy: 4,
  drama: 8,
  fantasy: 10,
  horror: 14,
  mystery: 7,
  romance: 22,
  scifi: 24,
  sliceOfLife: 36,
  sports: 30,
  supernatural: 37,
  thriller: 41,
  music: 19,
  psychological: 40,
} as const;
