import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { adminDb } from '@/lib/firebase/admin';
import { generateEpisode } from '@/lib/craft/story/pipeline';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storyId } = await request.json();

    const storyRef = adminDb.collection('stories').doc(storyId);
    const storyDoc = await storyRef.get();

    if (!storyDoc.exists) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const story = storyDoc.data()!;

    if (story.userId !== authResult.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextEpisodeNumber = story.currentEpisode + 1;
    if (nextEpisodeNumber > 3) {
      return NextResponse.json({ error: 'Story already completed' }, { status: 400 });
    }

    // 前話の末尾300文字を取得
    const lastEpisode = story.episodes[story.episodes.length - 1];
    const previousTail = lastEpisode.body.slice(-300);

    // エピソード生成
    const { episode, updatedState } = await generateEpisode(
      story.outline,
      nextEpisodeNumber,
      story.storyState,
      previousTail,
      story.birthYear || undefined,
    );

    // Firestore更新
    const updatedEpisodes = [...story.episodes, episode];
    const isCompleted = nextEpisodeNumber === 3;

    await storyRef.update({
      episodes: updatedEpisodes,
      storyState: updatedState,
      currentEpisode: nextEpisodeNumber,
      status: isCompleted ? 'completed' : 'in_progress',
      updatedAt: new Date(),
      ...(isCompleted ? { completedAt: new Date() } : {}),
    });

    return NextResponse.json({
      episode,
      isCompleted,
      episodeNumber: nextEpisodeNumber,
    });

  } catch (error) {
    console.error('Episode generation error:', error);
    return NextResponse.json(
      { error: 'エピソードの生成に失敗しました。' },
      { status: 500 }
    );
  }
}
