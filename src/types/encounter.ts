// であう機能の型定義

export type EncounterCategory = 'books' | 'movies' | 'anime' | 'games' | 'goods' | 'skills';

export type ProductSource = 'rakuten' | 'rakuten_books' | 'rakuten_books_game' | 'tmdb' | 'openbd' | 'rawg' | 'jikan';

export interface RecommendedItem {
  id: string;
  source: ProductSource;
  name: string;
  price: number | null;
  imageUrl: string;
  affiliateUrl: string;
  originalUrl: string;
  rating: number | null;
  reason: string;           // パーソナライズされた推薦理由
  matchedTraits: string[];  // 紐づく特徴のlabel
  score: number;            // 0.0〜1.0
}

export interface RecommendationResult {
  category: EncounterCategory;
  items: RecommendedItem[];
  personalityContext: string;
  traitsUsedCount: number;
  generatedAt: string;      // ISO8601
}

export interface PersonalityProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  summary: string;
  updatedAt: Date;
}

export interface ClickLogEntry {
  userId: string;
  productId: string;
  productSource: ProductSource;
  category: EncounterCategory;
  position: number;
  affiliateUrl: string;
  timestamp: Date;
}

// Gemini キーワード生成レスポンス
export interface SearchKeywordResult {
  searchQueries: {
    keyword: string;
    genreId?: string;
    reason: string;
    matchedTraits: string[];
  }[];
  personalityContext: string;
}

// 楽天市場APIの商品
export interface RakutenItem {
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl: string;
  imageUrl: string;
  shopName: string;
  reviewAverage: number;
  reviewCount: number;
  itemCaption: string;
  genreId: string;
}

// 楽天ブックスAPIの書籍
export interface RakutenBookItem {
  title: string;
  author: string;
  publisherName: string;
  isbn: string;
  itemPrice: number;
  itemUrl: string;
  affiliateUrl: string;
  largeImageUrl: string;
  mediumImageUrl: string;
  smallImageUrl: string;
  reviewAverage: number;
  reviewCount: number;
  itemCaption: string;
  booksGenreId: string;
}

// TMDb映画
export interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}
