import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiModel } from '@/lib/gemini';
import {
  UserTrait,
  TraitCategory,
  ExtractTraitsRequest,
  ExtractTraitsResponse,
} from '@/types';
import { verifyAuth } from '@/lib/auth/verifyAuth';

const EXTRACTION_PROMPT = `あなたはインタビューの会話からユーザーの特徴を抽出・更新する専門家です。
以下の会話から、ユーザーの特徴を分析してJSON形式で出力してください。

【重要】既存の特徴との関係性を必ず分析してください：
1. 新しい特徴を発見した場合 → newTraitsに追加
2. 既存の特徴に関連する情報が追加された場合 → updatedTraitsに追加（既存のidを使用）
3. 既存の特徴の強弱が明らかになった場合 → updatedTraitsで強弱を更新

【出力形式】
\`\`\`json
{
  "newTraits": [
    {
      "label": "キャッチーなラベル（下記ルール参照）",
      "category": "personality|hobby|skill|work|value|lifestyle|experience|other",
      "icon": "絵文字1つ",
      "description": "特徴の詳細説明（30文字以内）",
      "keywords": ["関連キーワード1", "関連キーワード2"],
      "intensityLabel": "強弱キーワードまたはnull",
      "confidence": 0〜1の数値
    }
  ],
  "updatedTraits": [
    {
      "id": "既存の特徴のID",
      "intensityLabel": "新しい強弱キーワード（更新する場合）",
      "description": "追加の説明（更新する場合）",
      "keywords": ["追加のキーワード"]
    }
  ]
}
\`\`\`

【★最重要：ラベルの付け方】
ラベルはSNSプロフィールに貼りたくなるような「二つ名・称号」にしてください。
- 3〜6文字の短くてキャッチーな造語・組み合わせ語にする
- 「◯◯な人」「◯◯がある」のような説明文にしない
- 具体的な名詞・比喩・擬人化を使い、読んだ瞬間に意味が伝わるものにする
- ポジティブで、本人が「自分を表す言葉」として誇れる表現にする

良い例：「深掘り職人」「共感アンテナ」「直感キャッチャー」「没頭エンジン」「裏方の鬼」「冒険イノベーター」「分析マスター」「ひらめきの泉」「橋渡し名人」「こだわり研究家」
悪い例：「社交的」「几帳面」「好奇心旺盛」「読書好き」→ ただの形容詞・説明文はNG

【カテゴリの説明】
- personality: 性格・人柄
- hobby: 趣味・興味
- skill: スキル・能力
- work: 仕事・キャリア
- value: 価値観・信念
- lifestyle: ライフスタイル
- experience: 経験・実績
- other: その他

【強弱キーワードについて】
- 会話から強弱が読み取れる場合のみ設定
- 強弱が明確でない場合はnull
- 例：
  - スキル系：「駆け出し」「経験あり」「得意」「熟練」「プロ級」
  - 趣味系：「ちょっと興味」「好き」「大好き」「ハマり中」「生きがい」
  - 性格系：「ややそう」「わりとそう」「かなりそう」「とてもそう」

【注意事項】
- JSON以外のテキストは出力しないでください
- 新規も更新もない場合は {"newTraits": [], "updatedTraits": []} を返してください`;

interface GeminiNewTrait {
  label: string;
  category: string;
  icon?: string;
  description?: string;
  keywords?: string[];
  intensityLabel?: string | null;
  confidence?: number;
}

interface GeminiUpdatedTrait {
  id: string;
  intensityLabel?: string | null;
  description?: string;
  keywords?: string[];
}

interface GeminiResponse {
  newTraits: GeminiNewTrait[];
  updatedTraits: GeminiUpdatedTrait[];
}

export async function POST(request: NextRequest) {
  try {
    // 認証検証（匿名ユーザーも含む）
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json<ExtractTraitsResponse>(
        { newTraits: [], updatedTraits: [], error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ExtractTraitsRequest = await request.json();
    const { userMessage, assistantMessage, messageIndex, existingTraits } = body;

    if (!userMessage) {
      return NextResponse.json<ExtractTraitsResponse>(
        { newTraits: [], updatedTraits: [], error: 'User message is required' },
        { status: 400 }
      );
    }

    const model = getGeminiModel();

    // 既存の特徴を詳細に記述
    const existingTraitsInfo = existingTraits.length > 0
      ? existingTraits.map((t) =>
          `- ID: ${t.id}, ラベル: ${t.label}, カテゴリ: ${t.category}, 強弱: ${t.intensityLabel || '未設定'}, キーワード: ${t.keywords.join(', ')}`
        ).join('\n')
      : 'なし';

    const prompt = `${EXTRACTION_PROMPT}

【既存の特徴一覧】
${existingTraitsInfo}

【インタビュワーの質問】
${assistantMessage}

【ユーザーの回答】
${userMessage}`;

    // リトライロジック（レート制限対策）
    let result;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status === 429 && retries < maxRetries) {
          // レート制限エラーの場合、待機してリトライ
          console.log(`Rate limited, waiting before retry ${retries + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 3000 * (retries + 1)));
          retries++;
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      return NextResponse.json<ExtractTraitsResponse>({ newTraits: [], updatedTraits: [] });
    }

    const responseText = result.response.text();

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in response:', responseText);
      return NextResponse.json<ExtractTraitsResponse>({ newTraits: [], updatedTraits: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiResponse;

    // 新規特徴をUserTrait型に変換
    const newTraits: UserTrait[] = (parsed.newTraits || [])
      .filter((trait: GeminiNewTrait) => {
        if (!trait.label) return false;
        // 既存の特徴と完全重複チェック
        return !existingTraits.some(
          (existing) => existing.label === trait.label
        );
      })
      .map((trait: GeminiNewTrait) => ({
        id: uuidv4(),
        label: trait.label.slice(0, 10),
        category: validateCategory(trait.category),
        icon: trait.icon || getDefaultIcon(validateCategory(trait.category)),
        description: trait.description?.slice(0, 50),
        keywords: trait.keywords?.slice(0, 5) || [],
        intensityLabel: trait.intensityLabel || null,
        confidence: Math.min(Math.max(trait.confidence || 0.7, 0), 1),
        sourceMessageIndex: messageIndex,
        extractedAt: new Date(),
      }));

    // 更新される特徴を処理
    const updatedTraits: UserTrait[] = (parsed.updatedTraits || [])
      .map((update: GeminiUpdatedTrait) => {
        const existing = existingTraits.find((t) => t.id === update.id);
        if (!existing) return null;

        // 既存の特徴を更新
        const updated: UserTrait = {
          ...existing,
          intensityLabel: update.intensityLabel !== undefined
            ? update.intensityLabel
            : existing.intensityLabel,
          description: update.description
            ? (existing.description ? `${existing.description} / ${update.description}` : update.description).slice(0, 80)
            : existing.description,
          keywords: update.keywords
            ? [...new Set([...existing.keywords, ...update.keywords])].slice(0, 5)
            : existing.keywords,
          updatedAt: new Date(),
        };
        return updated;
      })
      .filter((t): t is UserTrait => t !== null);

    return NextResponse.json<ExtractTraitsResponse>({ newTraits, updatedTraits });
  } catch (error) {
    console.error('Error extracting traits:', error);
    return NextResponse.json<ExtractTraitsResponse>(
      { newTraits: [], updatedTraits: [], error: 'Failed to extract traits' },
      { status: 500 }
    );
  }
}

function validateCategory(category: string): TraitCategory {
  const validCategories: TraitCategory[] = [
    'personality',
    'hobby',
    'skill',
    'work',
    'value',
    'lifestyle',
    'experience',
    'other',
  ];
  return validCategories.includes(category as TraitCategory)
    ? (category as TraitCategory)
    : 'other';
}

function getDefaultIcon(category: TraitCategory): string {
  const icons: Record<TraitCategory, string> = {
    personality: '😊',
    hobby: '🎯',
    skill: '💡',
    work: '💼',
    value: '💎',
    lifestyle: '🌟',
    experience: '📚',
    other: '✨',
  };
  return icons[category];
}
