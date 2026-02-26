import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { adminDb } from '@/lib/firebase/admin';
import { WishListItem } from '@/types/wishList';

interface SaveRequest {
  items: WishListItem[];
  traitsUsedCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await adminDb.collection('wishLists')
      .where('userId', '==', authResult.uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ wishList: null });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      wishList: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching wish-list:', error);
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

    const { items, traitsUsedCount } = (await request.json()) as SaveRequest;
    const now = new Date();

    // 既存ドキュメントを検索
    const snapshot = await adminDb.collection('wishLists')
      .where('userId', '==', authResult.uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      // 新規作成
      const docRef = await adminDb.collection('wishLists').add({
        userId: authResult.uid,
        items,
        traitsUsedCount,
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, id: docRef.id });
    } else {
      // 上書き更新
      const doc = snapshot.docs[0];
      await doc.ref.update({
        items,
        traitsUsedCount,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, id: doc.id });
    }
  } catch (error) {
    console.error('Error saving wish-list:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
