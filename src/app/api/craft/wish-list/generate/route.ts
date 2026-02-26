import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiModel } from '@/lib/gemini';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { UserTrait } from '@/types';
import { WishListItem, WishCategory } from '@/types/wishList';
import { formatTraitsForPrompt } from '@/lib/craft/traitFormatter';

const MIN_TRAITS = 5;
const VALID_CATEGORIES: WishCategory[] = ['experience', 'skill', 'creative', 'social', 'lifestyle', 'career', 'other'];

interface GenerateRequest {
  traits: UserTrait[];
  userProfile: {
    gender?: string;
    birthYear?: number;
    occupation?: string;
  };
  existingItems?: WishListItem[];
  mode: 'initial' | 'additional';
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json(
        { error: 'ログインユーザーのみ利用可能です' },
        { status: 401 }
      );
    }

    const { traits, userProfile, existingItems = [], mode } = (await request.json()) as GenerateRequest;

    if (!traits || traits.length < MIN_TRAITS) {
      return NextResponse.json(
        { error: `特徴が${MIN_TRAITS}個以上必要です（現在${traits?.length || 0}個）` },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const age = userProfile?.birthYear ? currentYear - userProfile.birthYear : null;
    const traitsSummary = formatTraitsForPrompt(traits);

    const isAdditional = mode === 'additional';
    const count = isAdditional ? 5 : 20;

    const existingListSection = isAdditional && existingItems.length > 0
      ? `\n【既存のリスト（重複禁止）】\n${existingItems.map(i => `- ${i.title}`).join('\n')}\n\n上記リストとは異なる切り口で、新しい「やりたいかもしれないこと」を${count}個だけ提案してください。\n既存リストと似たテーマや表現は避け、まだ触れていない方向性から提案すること。`
      : '';

    const prompt = `あなたはユーザーの個性を深く理解するライフデザインAIです。
以下のユーザーの特徴データとプロフィールをもとに、「この人がやりたいと思っているかもしれないこと」を${count}個提案してください。

【ユーザープロフィール】
- 性別: ${userProfile?.gender || '不明'}
- 年齢: ${age ? `${age}歳` : '不明'}
- 職業: ${userProfile?.occupation || '不明'}

【ユーザーの特徴データ】
${traitsSummary}
${existingListSection}

【出力ルール】
以下のJSON配列で出力してください。JSON以外のテキストは含めないでください。

[
  {
    "title": "やりたいことのタイトル（20文字以内）",
    "description": "なぜこの人に合いそうか（40文字以内）",
    "category": "experience|skill|creative|social|lifestyle|career|other"
  }
]

【提案の基準】
- ユーザーの特徴の「組み合わせ」から連想されるものを提案する
- 単純な趣味の延長だけでなく、意外性のある提案も混ぜる
- 年齢と性別を考慮して現実的かつワクワクするものにする
- 大きな目標（海外移住など）と小さなアクション（新しいカフェに行く）をバランスよく混ぜる
- カテゴリが偏らないように各カテゴリ2〜4個ずつ分散させる
- descriptionは「あなたの○○な特徴から」のように特徴に言及する`;

    const model = getGeminiModel();
    let parsed: { title: string; description: string; category: string }[];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(cleanJson);
        break;
      } catch (parseError) {
        if (attempt === 1) {
          console.error('JSON parse failed after retry:', parseError);
          return NextResponse.json(
            { error: 'リストの生成に失敗しました。もう一度お試しください。' },
            { status: 500 }
          );
        }
      }
    }

    const now = new Date().toISOString();
    const items: WishListItem[] = parsed!.map((raw) => ({
      id: uuidv4(),
      title: String(raw.title || '').slice(0, 20),
      description: String(raw.description || '').slice(0, 40),
      category: VALID_CATEGORIES.includes(raw.category as WishCategory)
        ? (raw.category as WishCategory)
        : 'other',
      completed: false,
      isUserAdded: false,
      createdAt: now,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in wish-list generate:', error);
    return NextResponse.json(
      { error: 'リストの生成に失敗しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
