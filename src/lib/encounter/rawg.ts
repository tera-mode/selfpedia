/**
 * RAWG API ラッパー（ゲームデータベース）
 * 50万件以上のゲームデータ。無料（10万MAU以下）。
 * 帰属表示必須: RAWGへのアクティブリンク + データソース明記
 */

import { rateLimiter } from './rateLimiter';

const RAWG_API_BASE = 'https://api.rawg.io/api';
const RAWG_API_KEY = process.env.RAWG_API_KEY!;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';

export interface RAWGSearchParams {
  search?: string;
  genres?: string;   // ジャンルスラッグ（カンマ区切り: 'action,rpg'）
  tags?: string;
  ordering?: string; // '-rating' | '-metacritic' | '-added'
  page_size?: number;
  platforms?: string;
}

export interface RAWGGame {
  id: number;
  name: string;
  slug: string;
  background_image: string | null;
  released: string | null;
  rating: number;
  ratings_count: number;
  metacritic: number | null;
  genres: { id: number; name: string; slug: string }[];
}

/** background_image URLをリサイズ（600×400）*/
export function getRawgImageUrl(backgroundImage: string | null): string {
  if (!backgroundImage) return '';
  // RAWGの画像リサイズ: /media/ → /media/crop/600/400/
  return backgroundImage.replace('/media/', '/media/crop/600/400/');
}

/** ゲーム名で楽天検索URLを生成（アフィリエイト対応）*/
function getRakutenGameUrl(gameName: string): string {
  const encoded = encodeURIComponent(gameName);
  if (RAKUTEN_AFFILIATE_ID) {
    const dest = `https://search.rakuten.co.jp/search/mall/${encoded}/`;
    return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(dest)}&m=${encodeURIComponent(dest)}`;
  }
  return `https://search.rakuten.co.jp/search/mall/${encoded}/`;
}

export async function searchRAWGGames(params: RAWGSearchParams): Promise<RAWGGame[]> {
  const url = new URL(`${RAWG_API_BASE}/games`);
  url.searchParams.set('key', RAWG_API_KEY);
  url.searchParams.set('page_size', String(params.page_size || 10));
  url.searchParams.set('ordering', params.ordering || '-rating');

  if (params.search) url.searchParams.set('search', params.search);
  if (params.genres) url.searchParams.set('genres', params.genres);
  if (params.tags) url.searchParams.set('tags', params.tags);
  if (params.platforms) url.searchParams.set('platforms', params.platforms);

  await rateLimiter.wait('rawg');
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`RAWG API error: ${response.status}`);

  const data = await response.json();
  return data.results || [];
}

/** RAWGGame → RecommendedItem 形式に変換 */
export function rawgGameToItem(game: RAWGGame, query: { reason: string; matchedTraits: string[] }) {
  return {
    id: `rawg_${game.id}`,
    source: 'rawg' as const,
    name: game.name,
    price: null as null,
    imageUrl: getRawgImageUrl(game.background_image),
    affiliateUrl: getRakutenGameUrl(game.name),
    originalUrl: `https://rawg.io/games/${game.slug}`,
    rating: game.rating || null,
    reason: query.reason,
    matchedTraits: query.matchedTraits,
    score: 0.7,
  };
}

// RAWGジャンルスラッグ（Geminiプロンプト用参考）
export const RAWG_GENRE_SLUGS = {
  action: 'action',
  indie: 'indie',
  adventure: 'adventure',
  rpg: 'role-playing-games-rpg',
  strategy: 'strategy',
  shooter: 'shooter',
  casual: 'casual',
  simulation: 'simulation',
  puzzle: 'puzzle',
  arcade: 'arcade',
  platformer: 'platformer',
  racing: 'racing',
  sports: 'sports',
  fighting: 'fighting',
  family: 'family',
} as const;
