import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { adminDb } from '@/lib/firebase/admin';
import { generateOutline, generateEpisode, createInitialStoryState } from '@/lib/craft/story/pipeline';
import { StoryGenre } from '@/types/story';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json(
        { error: 'ログインユーザーのみ利用可能です' },
        { status: 401 }
      );
    }

    const { genre, theme, traits, userProfile } = await request.json();

    if (!genre || !traits || traits.length < 20) {
      return NextResponse.json(
        { error: '特徴データが20個以上必要です' },
        { status: 400 }
      );
    }

    // ニックネームの取得（登録名があればそれを主人公名に使う）
    const nickname = userProfile?.nickname || userProfile?.displayName || undefined;

    // Stage 1: アウトライン生成
    const outline = await generateOutline(
      traits,
      genre as StoryGenre,
      theme,
      userProfile,
      nickname,
    );

    // 初期ストーリーステート作成
    const initialState = createInitialStoryState(outline);

    // Stage 2-4: 第1話生成
    const { episode, updatedState } = await generateEpisode(
      outline, 1, initialState, undefined, userProfile?.birthYear,
    );

    // Firestoreに保存
    const storyRef = adminDb.collection('stories').doc();
    const storyData = {
      id: storyRef.id,
      userId: authResult.uid,
      genre,
      theme: theme || null,
      outline,
      episodes: [episode],
      storyState: updatedState,
      status: 'in_progress',
      currentEpisode: 1,
      traitsUsed: traits.map((t: { id: string }) => t.id),
      traitCount: traits.length,
      birthYear: userProfile?.birthYear || null,
      reflectedTraits: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await storyRef.set(storyData);

    return NextResponse.json({
      storyId: storyRef.id,
      episode,
      totalEpisodes: 3,
    });

  } catch (error) {
    console.error('Story generation error:', error);
    return NextResponse.json(
      { error: '物語の生成に失敗しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
