import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { getGeminiModel } from '@/lib/gemini';
import { adminDb } from '@/lib/firebase/admin';
import { searchRakutenItems } from '@/lib/encounter/rakuten';
import { searchRakutenBooks } from '@/lib/encounter/rakutenBooks';
import { searchTMDbMovies, getTMDbPosterUrl } from '@/lib/encounter/tmdb';
import { searchRakutenBooksGame, rakutenBooksGameToItem } from '@/lib/encounter/rakutenBooksGame';
import { searchJikanAnime, jikanAnimeToItem } from '@/lib/encounter/jikan';
import { getCachedProductSearch, cacheProductSearch, CachedProduct } from '@/lib/encounter/productCache';
import { UserTrait } from '@/types';
import { EncounterCategory, RecommendedItem, SearchKeywordResult } from '@/types/encounter';
import { ENCOUNTER_UNLOCK_RULES } from '@/lib/encounter/unlockRules';
import { Timestamp } from 'firebase-admin/firestore';

interface GenerateRequest {
  category: EncounterCategory;
  forceRefresh?: boolean;
}

async function getUserTraits(uid: string): Promise<UserTrait[]> {
  const snapshot = await adminDb
    .collection('interviews')
    .where('userId', '==', uid)
    .get();

  const traitMap = new Map<string, UserTrait>();
  snapshot.docs.forEach(doc => {
    const traits: UserTrait[] = doc.data().traits || [];
    traits.forEach(trait => {
      const existing = traitMap.get(trait.label);
      if (!existing || new Date(trait.extractedAt) > new Date(existing.extractedAt)) {
        traitMap.set(trait.label, trait);
      }
    });
  });

  const allTraits: UserTrait[] = [];
  traitMap.forEach(trait => allTraits.push(trait));
  allTraits.sort((a, b) => b.confidence - a.confidence);
  return allTraits;
}

/** 最新のキャッシュを取得（TTLなし・永続保存）*/
async function getCachedRecommendations(uid: string, category: EncounterCategory) {
  const doc = await adminDb
    .collection('users')
    .doc(uid)
    .collection('recommendations')
    .doc(category)
    .get();

  if (!doc.exists) return null;
  const data = doc.data()!;

  const items = data.items as RecommendedItem[];

  if (!Array.isArray(items) || items.length === 0) return null;

  // 画像URLが1件も入っていない古いキャッシュは破棄して再生成させる
  // ※ 空結果は saveLatestRecommendations で保存しないため、無限ループにはならない
  const hasAnyImage = items.some(i => !!i.imageUrl);
  if (!hasAnyImage) {
    console.warn(`[encounter/generate] 画像なしキャッシュを破棄・再生成 (uid=${uid}, category=${category})`);
    return null;
  }

  return {
    recommendations: items,
    personalityContext: data.personalityContext as string,
    traitsUsedCount: data.traitsUsedCount as number,
    generatedAt: (data.generatedAt as Timestamp)?.toDate?.()?.toISOString() ?? new Date().toISOString(),
  };
}

/** 最新を上書き保存（TTLなし） */
async function saveLatestRecommendations(
  uid: string,
  category: EncounterCategory,
  recommendations: RecommendedItem[],
  personalityContext: string,
  traitsUsedCount: number,
) {
  const now = new Date();
  await adminDb
    .collection('users')
    .doc(uid)
    .collection('recommendations')
    .doc(category)
    .set({
      category,
      items: recommendations,
      personalityContext,
      traitsUsedCount,
      generatedAt: now,
    });
}

/** 履歴として保存 */
async function saveToHistory(
  uid: string,
  category: EncounterCategory,
  recommendations: RecommendedItem[],
  personalityContext: string,
  traitsUsedCount: number,
) {
  const now = new Date();
  // NOTE: Firestore複合インデックス required: category(ASC) + generatedAt(DESC)
  await adminDb
    .collection('users')
    .doc(uid)
    .collection('recommendationHistory')
    .add({
      category,
      items: recommendations,
      personalityContext,
      traitsUsedCount,
      generatedAt: now,
    });
}

async function generateSearchKeywords(
  traits: UserTrait[],
  category: EncounterCategory,
): Promise<SearchKeywordResult> {
  const traitsSummary = traits
    .slice(0, 20)
    .map(t => `- ${t.label}（${t.category}）: ${t.description}`)
    .join('\n');

  const categoryLabel =
    category === 'books' ? '書籍'
    : category === 'movies' ? '映画'
    : category === 'anime' ? 'アニメ'
    : category === 'games' ? 'ゲーム'
    : category === 'goods' ? '商品'
    : 'スキルアップグッズ・道具';

  const skillsNote = category === 'skills'
    ? '\n- ★重要: これはスキルアップグッズ・道具カテゴリです。書籍・本・テキストは絶対に含めないでください。その人のスキルを実践・上達させるための楽器・画材・スポーツ用品・工具・ガジェット・キット・文房具・器具などの物理的なモノを提案してください。'
    : '';

  const animeNote = category === 'anime'
    ? '\n- アニメカテゴリ: keywordには検索ワード（日本語可）を入れる。genreIdにはMALジャンルID数字を指定（1=Action, 2=Adventure, 4=Comedy, 8=Drama, 10=Fantasy, 22=Romance, 24=Sci-Fi, 36=Slice of Life, 37=Supernatural, 40=Psychological, 41=Thriller）。keywordかgenreIdのどちらか一方を設定すること。'
    : '';

  const gamesNote = category === 'games'
    ? '\n- ゲームカテゴリ: keywordは楽天ブックスゲームの「タイトル部分一致検索」に使う。必ず以下のリストから1語だけ選ぶこと（複数語・説明文は絶対NG）。【ジャンル語】RPG / アクション / パズル / シミュレーション / アドベンチャー / スポーツ / 格闘 / シューティング / ホラー / レーシング / 音楽 【シリーズ名】ポケモン / マリオ / ゼルダ / ドラゴンクエスト / ファイナルファンタジー / モンスターハンター / ペルソナ / カービィ / スプラトゥーン / ピクミン。genreIdにはゲームハード名を入れる（PS5, Switch, PS4, Xbox のいずれか・省略可）。'
    : '';

  const prompt = `あなたはパーソナリティ分析の専門家です。
ユーザーの特徴データを分析し、その人に合う${categoryLabel}の検索キーワードと推薦理由を生成してください。

【ユーザーの特徴データ】
${traitsSummary}

## 特徴データの解釈ルール
- personality（性格）→ 選びの「傾向」を決める（冒険的→新奇なもの、慎重→定番）
- hobby（趣味）→ 直接的な関連（料理好き→調理器具・食材）
- skill（スキル）→ そのスキルを磨くための道具・器具・用品
- work（仕事）→ 業務効率化・仕事関連グッズ
- value（価値観）→ 選択の軸（環境意識→エシカル商品）
- lifestyle（ライフスタイル）→ 生活シーンに合うもの
- experience（経験）→ 次のステップとなるもの

## 出力形式（JSON）
{
  "searchQueries": [
    {
      "keyword": "検索キーワード（2〜4語）",
      "genreId": "ジャンルID（わかれば・書籍はbooksGenreId、映画はTMDbジャンルID数字、アニメはMALジャンルID数字、ゲームはRAWGジャンルスラッグ）",
      "reason": "この検索をする理由（ユーザーの特徴との関連・50文字以内）",
      "matchedTraits": ["関連する特徴のlabel"]
    }
  ],
  "personalityContext": "この人の全体的な消費傾向の要約（100文字以内）"
}

## ルール
- searchQueriesは5〜8個生成
- ユーザーの特徴に基づく具体的なキーワードにする（汎用的すぎるのはNG）
- 1つ以上の特徴と紐づけること
- 日本語のキーワードで検索に使えるものにすること${skillsNote}${animeNote}${gamesNote}
- JSON以外のテキストは含めないでください`;

  const model = getGeminiModel();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      return JSON.parse(cleanJson) as SearchKeywordResult;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
  throw new Error('Failed to generate keywords');
}

/** グローバルキャッシュを利用した商品検索 */
async function searchProducts(
  keywords: SearchKeywordResult,
  category: EncounterCategory,
): Promise<RecommendedItem[]> {
  const items: RecommendedItem[] = [];
  const queries = keywords.searchQueries.slice(0, 4);

  for (const query of queries) {
    try {
      // ─── グローバルキャッシュチェック ───
      const cachedProducts = await getCachedProductSearch(query.keyword, category);
      if (cachedProducts && cachedProducts.length > 0) {
        // キャッシュ済み → ユーザー固有フィールドはあとで上書きするのでプレースホルダーを入れる
        for (const p of (cachedProducts as CachedProduct[]).slice(0, 3)) {
          items.push({
            id: p.id,
            source: p.source as RecommendedItem['source'],
            name: p.name,
            price: p.price,
            imageUrl: p.imageUrl,
            affiliateUrl: p.affiliateUrl,
            originalUrl: p.originalUrl,
            rating: p.rating,
            reason: query.reason,
            matchedTraits: query.matchedTraits,
            score: 0.7,
          });
        }
        continue; // APIコールをスキップ
      }

      // ─── 外部API呼び出し ───
      let fetched: RecommendedItem[] = [];

      if (category === 'books') {
        const books = await searchRakutenBooks({
          keyword: query.keyword,
          booksGenreId: '200162',
          hits: 5,
        });
        for (const book of books.slice(0, 3)) {
          fetched.push({
            id: `rakuten_books_${book.itemUrl}`,
            source: 'rakuten_books',
            name: book.itemName,
            price: book.itemPrice || null,
            imageUrl: book.imageUrl,
            affiliateUrl: book.affiliateUrl,
            originalUrl: book.itemUrl,
            rating: book.reviewAverage || null,
            reason: query.reason,
            matchedTraits: query.matchedTraits,
            score: 0.7,
          });
        }
      } else if (category === 'movies') {
        const genreIds = query.genreId ? [parseInt(query.genreId, 10)].filter(n => !isNaN(n)) : undefined;
        const movies = await searchTMDbMovies({
          query: genreIds?.length ? undefined : query.keyword,
          genreIds: genreIds?.length ? genreIds : undefined,
          minRating: 7.0,
        });
        for (const movie of movies.slice(0, 3)) {
          fetched.push({
            id: `tmdb_${movie.id}`,
            source: 'tmdb',
            name: movie.title,
            price: null,
            imageUrl: getTMDbPosterUrl(movie.poster_path),
            affiliateUrl: `https://www.themoviedb.org/movie/${movie.id}`,
            originalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
            rating: movie.vote_average || null,
            reason: query.reason,
            matchedTraits: query.matchedTraits,
            score: 0.7,
          });
        }
      } else if (category === 'anime') {
        // Jikan API: genreIdがあればジャンル検索、なければキーワード検索
        const genreId = query.genreId && !isNaN(parseInt(query.genreId, 10)) ? query.genreId : undefined;
        const animes = await searchJikanAnime({
          q: genreId ? undefined : query.keyword,
          genres: genreId,
          min_score: 7,
          limit: 5,
        });
        for (const anime of animes.slice(0, 3)) {
          fetched.push(jikanAnimeToItem(anime, query));
        }
      } else if (category === 'games') {
        // 楽天ブックスゲームAPI: titleキーワード検索 + オプションでhardware絞り込み
        const validHardware = ['PS5', 'PS4', 'Switch', 'Xbox', 'PC'];
        const hardware = query.genreId && validHardware.includes(query.genreId.trim())
          ? query.genreId.trim()
          : undefined;
        // BooksGame APIはタイトル部分一致検索のため、先頭1語のみ使用（複合語・説明文対策）
        const gameKeyword = query.keyword.split(/[\s　]+/)[0];
        const gamesRaw = await searchRakutenBooksGame({
          title: gameKeyword,
          hardware,
          hits: 10,
          sort: 'sales',
        });
        // 玩具・フィギュア等の非ゲームソフト商品を除外
        const gameHardwareKeywords = ['Switch', 'PlayStation', 'PS4', 'PS5', 'PS3', 'Xbox', 'Windows', 'PC', '3DS', 'Wii', 'Vita'];
        const games = gamesRaw.filter(g =>
          gameHardwareKeywords.some(kw => g.hardware.includes(kw))
        );
        for (const game of games.slice(0, 3)) {
          fetched.push(rakutenBooksGameToItem(game, query));
        }
      } else {
        // goods / skills → 楽天市場
        const rakutenItems = await searchRakutenItems({
          keyword: query.keyword,
          hits: 10,
          sort: '-reviewAverage',
        });
        const nonBookItems = rakutenItems.filter(item => {
          const genreIdNum = parseInt(item.genreId || '', 10);
          if (!isNaN(genreIdNum) && (genreIdNum === 200162 || (genreIdNum >= 208000 && genreIdNum < 210000))) return false;
          const url = item.itemUrl || '';
          if (url.includes('/book/') || url.includes('rakutenkobo-ebooks') || url.includes('rbooks.')) return false;
          return true;
        });
        for (const item of nonBookItems.slice(0, 3)) {
          fetched.push({
            id: `rakuten_${item.itemUrl}`,
            source: 'rakuten',
            name: item.itemName,
            price: item.itemPrice || null,
            imageUrl: item.imageUrl,
            affiliateUrl: item.affiliateUrl,
            originalUrl: item.itemUrl,
            rating: item.reviewAverage || null,
            reason: query.reason,
            matchedTraits: query.matchedTraits,
            score: 0.7,
          });
        }
      }

      // グローバルキャッシュに保存
      if (fetched.length > 0) {
        await cacheProductSearch(query.keyword, category, fetched);
      }
      items.push(...fetched);
    } catch (e) {
      console.error(`Product search error for keyword "${query.keyword}":`, e);
    }
  }

  // 重複排除（idベース）
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function generateRecommendationReasons(
  traits: UserTrait[],
  products: RecommendedItem[],
  category: EncounterCategory,
): Promise<RecommendedItem[]> {
  if (products.length === 0) return [];

  const traitsSummary = traits
    .slice(0, 15)
    .map(t => `- ${t.label}: ${t.description}`)
    .join('\n');

  const productList = products.slice(0, 8).map((p, i) => ({
    index: i,
    name: p.name,
    source: p.source,
  }));

  const categoryLabel =
    category === 'books' ? '書籍'
    : category === 'movies' ? '映画'
    : category === 'anime' ? 'アニメ'
    : category === 'games' ? 'ゲーム'
    : category === 'goods' ? '商品'
    : 'スキルアップグッズ';

  const prompt = `あなたはパーソナリティ分析の専門家です。
ユーザーの特徴データと${categoryLabel}リストを見て、各アイテムの個別化された推薦理由を生成してください。

【ユーザーの特徴データ】
${traitsSummary}

【${categoryLabel}リスト】
${JSON.stringify(productList, null, 2)}

## 出力形式（JSON）
{
  "reasons": [
    {
      "index": 0,
      "reason": "あなたの○○という特徴から、この${categoryLabel}が特に合います。（50文字以内）",
      "matchedTraits": ["特徴ラベル1", "特徴ラベル2"],
      "score": 0.85
    }
  ]
}

## ルール
- 全アイテムに推薦理由を生成する
- 必ず「あなたの○○という特徴から」のように特徴を引用すること
- 50文字以内で具体的かつポジティブに
- scoreは特徴との関連度（0.0〜1.0）
- JSON以外のテキストは含めないでください`;

  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleanJson) as {
      reasons: { index: number; reason: string; matchedTraits: string[]; score: number }[];
    };

    return products.slice(0, 8).map((product, i) => {
      const reasonData = parsed.reasons.find(r => r.index === i);
      return {
        ...product,
        reason: reasonData?.reason || product.reason,
        matchedTraits: reasonData?.matchedTraits || product.matchedTraits,
        score: reasonData?.score || product.score,
      };
    });
  } catch (e) {
    console.error('Failed to generate recommendation reasons:', e);
    return products.slice(0, 8);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json() as GenerateRequest;
    const { category, forceRefresh } = body;

    if (!['books', 'movies', 'anime', 'games', 'goods', 'skills'].includes(category)) {
      return NextResponse.json({ error: '不正なカテゴリです' }, { status: 400 });
    }

    // ─── キャッシュチェック（TTLなし・常に即表示） ───
    if (!forceRefresh) {
      const cached = await getCachedRecommendations(authResult.uid, category);
      if (cached) {
        return NextResponse.json({ success: true, fromCache: true, ...cached });
      }
    }

    // ─── 強制更新時: 現在のキャッシュを履歴に退避 ───
    if (forceRefresh) {
      const existing = await getCachedRecommendations(authResult.uid, category);
      if (existing && existing.recommendations.length > 0) {
        await saveToHistory(
          authResult.uid,
          category,
          existing.recommendations,
          existing.personalityContext,
          existing.traitsUsedCount,
        ).catch(e => console.error('Failed to save history:', e));
      }
    }

    // ─── 特徴データ取得 ───
    const traits = await getUserTraits(authResult.uid);
    const requiredTraits = ENCOUNTER_UNLOCK_RULES[category].requiredTraits;

    if (traits.length < requiredTraits) {
      return NextResponse.json({
        error: `特徴データが${requiredTraits}個以上必要です。「ほる」で特徴を集めましょう！`,
        requiredTraits,
        currentTraits: traits.length,
      }, { status: 400 });
    }

    // ─── Geminiで検索キーワード生成 ───
    const keywords = await generateSearchKeywords(traits, category);

    // ─── 外部API（+ グローバルキャッシュ）で商品検索 ───
    const products = await searchProducts(keywords, category);

    // ─── Geminiで推薦理由を付与 ───
    const recommendations = await generateRecommendationReasons(traits, products, category);

    // ─── 最新として保存（TTLなし・空は保存しない） ───
    if (recommendations.length > 0) {
      await saveLatestRecommendations(
        authResult.uid,
        category,
        recommendations,
        keywords.personalityContext,
        traits.length,
      );
    }

    // ─── 初回生成も履歴に保存（空は保存しない） ───
    if (!forceRefresh && recommendations.length > 0) {
      await saveToHistory(
        authResult.uid,
        category,
        recommendations,
        keywords.personalityContext,
        traits.length,
      ).catch(e => console.error('Failed to save history:', e));
    }

    return NextResponse.json({
      success: true,
      fromCache: false,
      recommendations,
      personalityContext: keywords.personalityContext,
      traitsUsedCount: traits.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in encounter/generate:', error);
    return NextResponse.json(
      { error: 'であいの生成に失敗しました。もう一度お試しください。' },
      { status: 500 },
    );
  }
}
