import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storyId } = await params;
    const storyDoc = await adminDb.collection('stories').doc(storyId).get();

    if (!storyDoc.exists || storyDoc.data()?.userId !== authResult.uid) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(storyDoc.data());
  } catch (error) {
    console.error('Story fetch error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
