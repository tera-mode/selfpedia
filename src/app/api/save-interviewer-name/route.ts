import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { userId, interviewerName } = await request.json();

    if (!userId || !interviewerName) {
      return NextResponse.json(
        { error: 'User ID and interviewer name are required' },
        { status: 400 }
      );
    }

    console.log(`Saving interviewer name "${interviewerName}" for user ${userId}`);

    // Firestoreのusersコレクションに保存
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // ユーザードキュメントがない場合は作成
      await userRef.set({
        uid: userId,
        interviewerName,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });
    } else {
      // すでにある場合は更新
      await userRef.update({
        interviewerName,
        lastLoginAt: new Date(),
      });
    }

    console.log('Interviewer name saved successfully');

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error saving interviewer name:', error);
    return NextResponse.json(
      { error: 'Failed to save interviewer name' },
      { status: 500 }
    );
  }
}
