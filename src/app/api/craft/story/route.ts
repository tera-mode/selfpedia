import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb.collection('stories')
      .where('userId', '==', authResult.uid)
      .get();

    const stories = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        genre: data.genre,
        theme: data.theme,
        seriesTitle: data.outline?.seriesTitle,
        status: data.status,
        currentEpisode: data.currentEpisode,
        traitCount: data.traitCount,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt || null,
      };
    });

    stories.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Story list fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 });
  }
}
