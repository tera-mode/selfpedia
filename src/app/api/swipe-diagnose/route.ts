import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiModel } from '@/lib/gemini';
import { UserTrait, TraitCategory } from '@/types';
import { verifyAuth } from '@/lib/auth/verifyAuth';

interface SwipeAnswer {
  questionId: string;
  optionA: string;
  optionB: string;
  selected: 'A' | 'B';
  categoryHint: string;
}

const SWIPE_PROMPT = `あなたはユーザーの性格・価値観診断の専門家です。
以下の二択質問の回答結果から、ユーザーの特徴を2〜3個抽出してJSON形式で出力してください。

【出力形式】
\`\`\`json
{
  "traits": [
    {
      "label": "キャッチーなラベル（下記ルール参照）",
      "category": "personality|hobby|skill|work|value|lifestyle|experience|other",
      "icon": "絵文字1つ",
      "description": "特徴の詳細説明（30文字以内）",
      "keywords": ["関連キーワード1", "関連キーワード2"],
      "intensityLabel": "強弱キーワードまたはnull",
      "confidence": 0.6〜0.9の数値
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

【注意事項】
- JSON以外のテキストは出力しないでください
- 回答のパターンから総合的に判断してください
- 2〜3個の特徴を抽出してください
- ポジティブな表現で特徴を記述してください`;

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json(
        { traits: [], error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const answers: SwipeAnswer[] = body.answers;

    if (!answers || answers.length === 0) {
      return NextResponse.json(
        { traits: [], error: 'Answers are required' },
        { status: 400 }
      );
    }

    const model = getGeminiModel();

    const answersText = answers.map((a, i) =>
      `Q${i + 1}: 「${a.optionA}」vs「${a.optionB}」→ 回答: ${a.selected === 'A' ? a.optionA : a.optionB}`
    ).join('\n');

    const prompt = `${SWIPE_PROMPT}\n\n【ユーザーの回答】\n${answersText}`;

    // Retry logic
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
          await new Promise(resolve => setTimeout(resolve, 3000 * (retries + 1)));
          retries++;
        } else {
          throw error;
        }
      }
    }

    if (!result) {
      return NextResponse.json({ traits: [] });
    }

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.log('No JSON found in swipe response:', responseText);
      return NextResponse.json({ traits: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validCategories: TraitCategory[] = [
      'personality', 'hobby', 'skill', 'work', 'value', 'lifestyle', 'experience', 'other',
    ];

    const traits: UserTrait[] = (parsed.traits || []).map((trait: {
      label: string;
      category: string;
      icon?: string;
      description?: string;
      keywords?: string[];
      intensityLabel?: string | null;
      confidence?: number;
    }) => ({
      id: uuidv4(),
      label: (trait.label || '').slice(0, 10),
      category: validCategories.includes(trait.category as TraitCategory)
        ? trait.category as TraitCategory
        : 'other',
      icon: trait.icon || '✨',
      description: trait.description?.slice(0, 50),
      keywords: trait.keywords?.slice(0, 5) || [],
      intensityLabel: trait.intensityLabel || null,
      confidence: Math.min(Math.max(trait.confidence || 0.7, 0), 1),
      sourceMessageIndex: 0,
      extractedAt: new Date(),
    }));

    return NextResponse.json({ traits });
  } catch (error) {
    console.error('Error in swipe diagnose:', error);
    return NextResponse.json(
      { traits: [], error: 'Failed to diagnose' },
      { status: 500 }
    );
  }
}
