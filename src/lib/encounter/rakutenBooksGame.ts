/**
 * 楽天ブックスゲーム検索API
 * https://webservice.rakuten.co.jp/documentation/books-game-search
 *
 * - 新API: openapi.rakuten.co.jp（RAKUTEN_ACCESS_KEY がある場合・必須: Referer/Origin ヘッダー）
 * - 旧API: app.rakuten.co.jp（RAKUTEN_ACCESS_KEY がない場合）
 */

import { rateLimiter } from './rateLimiter';

const APP_REFERER = 'https://mecraft.life/';

const APPLICATION_ID = process.env.RAKUTEN_APPLICATION_ID ?? '';
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY ?? '';
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID ?? '';

const API_URL_NEW = 'https://openapi.rakuten.co.jp/services/api/BooksGame/Search/20170404';
const API_URL_OLD = 'https://app.rakuten.co.jp/services/api/BooksGame/Search/20170404';

export interface BooksGameSearchParams {
  title?: string;       // ゲームタイトルキーワード
  hardware?: string;    // 対応機種フィルタ（PS5, Switch, PS4, Xbox など）
  sort?: 'standard' | 'sales' | '+releaseDate' | '-releaseDate' | '+itemPrice' | '-itemPrice';
  hits?: number;        // 1〜30（デフォルト10）
}

export interface RakutenBooksGameItem {
  title: string;
  hardware: string;
  label: string;
  jan: string;
  salesDate: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl: string;
  smallImageUrl: string;
  mediumImageUrl: string;
  largeImageUrl: string;
  reviewAverage: string | number;
  reviewCount: number;
  booksGenreId: string;
}

/** largeImageUrl の解像度を 200x200 → 300x300 に拡大 */
export function getGameImageUrl(url: string): string {
  if (!url) return '';
  return url.replace('_ex=200x200', '_ex=300x300');
}

export async function searchRakutenBooksGame(
  params: BooksGameSearchParams,
): Promise<RakutenBooksGameItem[]> {
  if (!APPLICATION_ID) {
    console.warn('[rakutenBooksGame] RAKUTEN_APPLICATION_ID が未設定です');
    return [];
  }

  const useNewApi = ACCESS_KEY.length > 0;
  const apiUrl = useNewApi ? API_URL_NEW : API_URL_OLD;

  const url = new URL(apiUrl);
  url.searchParams.set('applicationId', APPLICATION_ID);
  url.searchParams.set('format', 'json');
  url.searchParams.set('hits', String(Math.min(params.hits ?? 10, 30)));
  url.searchParams.set('sort', params.sort ?? 'sales');

  if (useNewApi) url.searchParams.set('accessKey', ACCESS_KEY);
  if (AFFILIATE_ID) url.searchParams.set('affiliateId', AFFILIATE_ID);
  if (params.title) url.searchParams.set('title', params.title);
  if (params.hardware) url.searchParams.set('hardware', params.hardware);

  const headers: HeadersInit = useNewApi
    ? { 'Referer': APP_REFERER, 'Origin': 'https://mecraft.life' }
    : {};

  await rateLimiter.wait('rakuten');

  console.log(`[rakutenBooksGame] ${useNewApi ? '新API' : '旧API'} 検索: title="${params.title}" hardware="${params.hardware ?? '-'}"`);

  let response = await fetch(url.toString(), { headers });
  if (response.status === 429) {
    console.warn('[rakutenBooksGame] 429 Rate limit, 3秒後にリトライ...');
    await new Promise(r => setTimeout(r, 3000));
    response = await fetch(url.toString(), { headers });
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)');
    throw new Error(`Rakuten Books Game API error: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const items = data.Items ?? [];
  console.log(`[rakutenBooksGame] "${params.title}" → ${items.length}件取得`);

  return items.map((wrapper: { Item: RakutenBooksGameItem }) => wrapper.Item);
}

/** RakutenBooksGameItem → RecommendedItem 形式に変換 */
export function rakutenBooksGameToItem(
  game: RakutenBooksGameItem,
  query: { reason: string; matchedTraits: string[] },
) {
  const imageUrl = getGameImageUrl(game.largeImageUrl || game.mediumImageUrl || '');
  const affiliateUrl = game.affiliateUrl || game.itemUrl;
  const rating = typeof game.reviewAverage === 'string'
    ? parseFloat(game.reviewAverage) || null
    : game.reviewAverage || null;

  return {
    id: `rakuten_books_game_${game.jan || encodeURIComponent(game.itemUrl)}`,
    source: 'rakuten_books_game' as const,
    name: game.title,
    price: game.itemPrice || null,
    imageUrl,
    affiliateUrl,
    originalUrl: game.itemUrl,
    rating,
    reason: query.reason,
    matchedTraits: query.matchedTraits,
    score: 0.7,
  };
}
