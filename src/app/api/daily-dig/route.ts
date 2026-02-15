import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiModel } from '@/lib/gemini';
import { UserTrait, TraitCategory } from '@/types';
import { verifyAuth } from '@/lib/auth/verifyAuth';

interface DailyDigRequest {
  type: 'gacha' | 'metaphor' | 'favorites';
  question: string;
  answer: string;
  existingTraits: { label: string }[];
}

const BASE_PROMPT = `あなたはユーザーの個性を発見する専門家です。
以下の質問と回答から、ユーザーの特徴を1〜2個抽出してJSON形式で出力してください。

【質問タイプ】{type}
【質問】{question}
【ユーザーの回答】{answer}

【既存の特徴ラベル一覧】
{existingTraitLabels}
※ 上記と同じ・類似のラベルは避け、新しい切り口の特徴を抽出すること

【出力形式】
{
  "traits": [
    {
      "label": "キャッチーなラベル（3〜6文字の二つ名・称号）",
      "category": "personality|hobby|skill|work|value|lifestyle|experience|other",
      "icon": "絵文字1つ",
      "description": "特徴の詳細説明（30文字以内）",
      "keywords": ["関連キーワード1", "関連キーワード2"],
      "intensityLabel": "強弱キーワードまたはnull",
      "confidence": 0.6〜0.85の数値
    }
  ],
  "comment": "ユーザーへの一言コメント（40文字以内、ポジティブで共感的なトーン）"
}

【★最重要：ラベルの付け方】
ラベルはSNSプロフィールに貼りたくなるような「二つ名・称号」にしてください。
- 3〜6文字の短くてキャッチーな造語・組み合わせ語にする
- 「◯◯な人」「◯◯がある」のような説明文にしない
- 具体的な名詞・比喩・擬人化を使い、読んだ瞬間に意味が伝わるものにする
- ポジティブで、本人が「自分を表す言葉」として誇れる表現にする

良い例：「深掘り職人」「共感アンテナ」「直感キャッチャー」「没頭エンジン」「裏方の鬼」「冒険イノベーター」「分析マスター」「ひらめきの泉」「橋渡し名人」「こだわり研究家」
悪い例：「社交的」「几帳面」「好奇心旺盛」「読書好き」→ ただの形容詞・説明文はNG

【注意事項】
- JSON以外のテキストは出力しないでください
- 短い回答でも、選択・表現の仕方から特徴を読み取ってください
- commentは「へぇ！」「なるほど！」のような軽い反応 + 回答への一言感想`;

const TYPE_INSTRUCTIONS: Record<string, string> = {
  gacha: '回答の内容だけでなく、回答のしかた（具体的/抽象的、ポジティブ/ネガティブ、即答的/熟考的）からも特徴を読み取ってください',
  metaphor: '選んだ比喩対象の特性と、その理由の両方から特徴を抽出してください。例えば"猫"を選んだ理由が"マイペースだから"なら、行動パターンに着目した特徴を抽出してください',
  favorites: '好きなものの選び方（定番/マニアック、感性重視/論理重視）や、理由の述べ方から、趣味嗜好だけでなく価値観・思考パターンも読み取ってください',
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json(
        { traits: [], comment: '', error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: DailyDigRequest = await request.json();
    const { type, question, answer, existingTraits } = body;

    if (!type || !question || !answer) {
      return NextResponse.json(
        { traits: [], comment: '', error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const existingTraitLabels = (existingTraits || []).map(t => t.label).join('、') || 'なし';

    const prompt = BASE_PROMPT
      .replace('{type}', type)
      .replace('{question}', question)
      .replace('{answer}', answer)
      .replace('{existingTraitLabels}', existingTraitLabels)
      + '\n\n【追加指示】\n' + (TYPE_INSTRUCTIONS[type] || '');

    const model = getGeminiModel();

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
      return NextResponse.json({ traits: [], comment: '' });
    }

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.log('No JSON found in daily-dig response:', responseText);
      return NextResponse.json({ traits: [], comment: '' });
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

    const comment: string = parsed.comment || '';

    return NextResponse.json({ traits, comment });
  } catch (error) {
    console.error('Error in daily-dig:', error);
    return NextResponse.json(
      { traits: [], comment: '', error: 'Failed to analyze' },
      { status: 500 }
    );
  }
}
