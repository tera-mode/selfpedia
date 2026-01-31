import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { UserTrait } from '@/types/trait';

export async function GET(request: NextRequest) {
  try {
    // 認証検証
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // リクエストのuserIdと認証されたuidが一致するか検証
    if (userId !== authResult.uid) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 全てのインタビューから特徴を収集
    const interviewsSnapshot = await adminDb
      .collection('interviews')
      .where('userId', '==', userId)
      .get();

    const allTraits: UserTrait[] = [];
    const traitMap = new Map<string, UserTrait>();

    interviewsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const traits = data.traits || [];

      traits.forEach((trait: UserTrait) => {
        // 同じlabelの特徴は統合（最新のものを保持）
        const existing = traitMap.get(trait.label);
        if (!existing || new Date(trait.extractedAt) > new Date(existing.extractedAt)) {
          traitMap.set(trait.label, trait);
        }
      });
    });

    // Mapから配列に変換
    traitMap.forEach(trait => allTraits.push(trait));

    // 確信度順にソート
    allTraits.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      traits: allTraits,
      count: allTraits.length,
    });
  } catch (error) {
    console.error('Error fetching user traits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user traits' },
      { status: 500 }
    );
  }
}
