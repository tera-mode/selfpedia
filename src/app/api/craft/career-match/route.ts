import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { UserTrait } from '@/types';
import { formatTraitsForPrompt } from '@/lib/craft/traitFormatter';
import { adminDb } from '@/lib/firebase/admin';

const MIN_TRAITS = 15;

interface CareerMatchRequest {
  userId: string;
  traits: UserTrait[];
  userProfile?: {
    nickname?: string;
    occupation?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (userId !== authResult.uid) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    const snapshot = await adminDb.collection('careerMatches')
      .where('userId', '==', userId)
      .get();

    const results = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });

    results.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error fetching career matches:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
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

    const { userId, traits, userProfile } = (await request.json()) as CareerMatchRequest;

    if (userId !== authResult.uid) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    if (!traits || traits.length < MIN_TRAITS) {
      return NextResponse.json(
        { error: `特徴が${MIN_TRAITS}個以上必要です（現在${traits?.length || 0}個）` },
        { status: 400 }
      );
    }

    const traitsSummary = formatTraitsForPrompt(traits);

    const profileInfo = userProfile
      ? `【ユーザー情報】
- 呼び名: ${userProfile.nickname || '不明'}
- 職業: ${userProfile.occupation || '不明'}

`
      : '';

    const prompt = `あなたはキャリアアドバイザーAIです。
ユーザーの特徴データを分析し、適職と市場価値を診断してください。

${profileInfo}【ユーザーの特徴データ】
${traitsSummary}

【出力ルール】
以下のJSON形式で出力してください。JSON以外のテキストは含めないでください。

{
  "careers": [
    {
      "rank": 1,
      "jobTitle": "具体的な職種名",
      "matchScore": 92,
      "matchReason": "あなたの○○という特徴と△△という特徴の組み合わせが...",
      "activeImage": "チームのユーザー体験を設計し、データに基づいた改善提案で...",
      "relatedTraitLabels": ["特徴ラベル1", "特徴ラベル2"]
    }
  ],
  "marketValue": {
    "salaryMin": 450,
    "salaryMax": 650,
    "reasoning": "あなたの特徴の組み合わせは...",
    "rarityComment": "○○と△△を両方持つ人材は市場でも...",
    "growthPoints": [
      "□□のスキルを磨くことで...",
      "△△の経験を積むことで..."
    ]
  }
}

【診断の基準】
- 職種は日本の労働市場で実在する具体的なものにする（3〜5件）
- 年収は日本円で、該当職種の日本における一般的なレンジをベースに算出する
- 特徴の組み合わせのユニーク性を加味して年収を調整する
- 年齢・職歴が不明な場合は20代後半〜30代前半を想定する
- マッチ度は特徴との関連度合いから0〜100で算出する
- 理由は具体的な特徴名を引用して説明する
- ポジティブかつ現実的なトーンで書く`;

    const model = getGeminiModel();
    let parsed;

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
            { error: '診断結果の生成に失敗しました。もう一度お試しください。' },
            { status: 500 }
          );
        }
      }
    }

    const result = {
      careers: parsed.careers,
      marketValue: parsed.marketValue,
      disclaimer: 'この診断は特徴データに基づく参考情報です。実際の適職や市場価値は、経験・スキル・市場動向など多くの要因により変動します。',
    };

    // Firestoreに保存
    try {
      await adminDb.collection('careerMatches').add({
        userId: authResult.uid,
        result: {
          careers: parsed.careers,
          marketValue: parsed.marketValue,
        },
        traitsUsed: traits.map(t => t.id),
        traitCount: traits.length,
        createdAt: new Date(),
      });
    } catch (saveError) {
      console.error('Failed to save career match result:', saveError);
      // 保存失敗してもユーザーには結果を返す
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error in career-match:', error);
    return NextResponse.json(
      { error: '診断に失敗しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
