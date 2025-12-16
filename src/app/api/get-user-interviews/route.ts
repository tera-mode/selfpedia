import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Fetching interviews for user:', userId);

    // Firestoreからユーザーのインタビュー一覧を取得
    const interviewsSnapshot = await adminDb
      .collection('interviews')
      .where('userId', '==', userId)
      .get();

    const interviews = interviewsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      }))
      .sort((a, b) => {
        // クライアントサイドで新しい順にソート
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    console.log(`Found ${interviews.length} interviews for user ${userId}`);

    return NextResponse.json({
      success: true,
      interviews,
    });
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviews' },
      { status: 500 }
    );
  }
}
