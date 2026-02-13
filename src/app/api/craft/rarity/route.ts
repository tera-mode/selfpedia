import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { UserTrait } from '@/types';
import { formatTraitsForPrompt, getCategoryBreakdown } from '@/lib/craft/traitFormatter';
import { adminDb } from '@/lib/firebase/admin';

const MIN_TRAITS = 8;

interface RarityRequest {
  userId: string;
  traits: UserTrait[];
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

    const snapshot = await adminDb.collection('rarityResults')
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
    console.error('Error fetching rarity results:', error);
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

    const { userId, traits } = (await request.json()) as RarityRequest;

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
    const categoryBreakdown = getCategoryBreakdown(traits);

    const prompt = `あなたは個性分析の専門AIです。
ユーザーの特徴データの組み合わせから、その人のレアリティ（稀少度）を診断してください。

【ユーザーの特徴データ】
${traitsSummary}

【特徴の統計】
- 特徴数: ${traits.length}個
- カテゴリ分布: ${categoryBreakdown}

【レアリティランクの基準】
- SSR（Super Special Rare）: 日本人口の0.1%以下。特徴が非常に多く（25個以上目安）、多様なカテゴリにまたがり、通常共存しにくい特徴の組み合わせを持つ。
- SR（Super Rare）: 日本人口の1%以下。特徴が多く（18個以上目安）、複数カテゴリにまたがり、珍しい組み合わせがある。
- R（Rare）: 日本人口の10%以下。特徴がそれなりにあり（12個以上目安）、ある程度の多様性がある。
- N（Normal）: それ以上。特徴データがまだ少なく、個性の全体像が見えていない段階。

【重要】
- 特徴の数が多いほど、組み合わせの稀少度は指数関数的に上がる
- 同じカテゴリの特徴ばかりでは稀少度は上がりにくい
- 矛盾するように見える特徴の共存（例：慎重×大胆）は非常に高い稀少度
- 基準はあくまで目安であり、特徴の内容によって柔軟に判定すること

【出力ルール】
以下のJSON形式で出力してください。JSON以外のテキストは含めないでください。

{
  "rank": "SSR",
  "rankLabel": "Super Special Rare",
  "estimatedCount": 80000,
  "percentage": 0.07,
  "reasoning": "あなたは○○の特徴と△△の特徴を...",
  "rareCombinations": [
    {
      "traitLabels": ["慎重派", "行動力がある"],
      "description": "慎重に考えつつ素早く動ける人は..."
    }
  ],
  "rankUpAdvice": "現在R(レア)ランクです。あと○個ほど特徴を集め、特に○○系の特徴を掘り下げると..."
}

【トーンの方針】
- ポジティブで、ユーザーの個性を肯定する
- Nランクでも「まだ特徴が見つかっていないだけ。もっと掘れば必ずレアな組み合わせが見つかる」という前向きな表現にする
- 具体的な特徴名を引用して説明する`;

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
      rank: parsed.rank,
      rankLabel: parsed.rankLabel,
      estimatedCount: parsed.estimatedCount,
      percentage: parsed.percentage,
      reasoning: parsed.reasoning,
      rareCombinations: parsed.rareCombinations,
      rankUpAdvice: parsed.rankUpAdvice,
    };

    // Firestoreに保存
    try {
      await adminDb.collection('rarityResults').add({
        userId: authResult.uid,
        result,
        traitsUsed: traits.map(t => t.id),
        traitCount: traits.length,
        createdAt: new Date(),
      });
    } catch (saveError) {
      console.error('Failed to save rarity result:', saveError);
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error in rarity:', error);
    return NextResponse.json(
      { error: '診断に失敗しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
