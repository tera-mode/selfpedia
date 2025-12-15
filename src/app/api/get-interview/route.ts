import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Interview ID is required' },
        { status: 400 }
      );
    }

    console.log('Fetching interview data for ID:', id);

    // Firestoreからインタビューデータを取得
    const interviewDoc = await adminDb.collection('interviews').doc(id).get();

    if (!interviewDoc.exists) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }

    const interviewData = interviewDoc.data();
    console.log('Interview data found:', interviewData);

    return NextResponse.json({
      success: true,
      data: interviewData?.data || null,
      interview: interviewData, // 完全なインタビューデータも返す（マイページ用）
    });
  } catch (error) {
    console.error('Error fetching interview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interview' },
      { status: 500 }
    );
  }
}
