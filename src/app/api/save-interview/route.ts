import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import {
  FixedUserData,
  InterviewSession,
  ChatMessage,
  InterviewerId,
} from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { userId, interviewData, messages, interviewerId, sessionId, interviewId, status } =
      await request.json();

    // userIdはオプショナル（ゲストユーザーの場合はundefined）
    if (!messages || !interviewerId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const now = new Date();
    const interviewStatus = status || 'in_progress';

    // 既存のインタビューを更新する場合
    if (interviewId) {
      const interviewRef = adminDb.collection('interviews').doc(interviewId);

      const updateData: Record<string, unknown> = {
        messages: messages.map((msg: ChatMessage) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        status: interviewStatus,
        updatedAt: now,
      };

      // interviewDataがある場合のみ更新
      if (interviewData) {
        updateData['data.fixed'] = interviewData.fixed as FixedUserData;
        updateData['data.dynamic'] = interviewData.dynamic || {};
        updateData['data.updatedAt'] = now;
      }

      await interviewRef.update(updateData);

      return NextResponse.json({
        success: true,
        interviewId: interviewId,
      });
    }

    // 新規インタビューを作成する場合
    const interviewSession: Omit<InterviewSession, 'id'> = {
      userId,
      interviewerId: interviewerId as InterviewerId,
      messages: messages.map((msg: ChatMessage) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
      data: {
        fixed: (interviewData?.fixed || {}) as FixedUserData,
        dynamic: interviewData?.dynamic || {},
        createdAt: now,
        updatedAt: now,
      },
      status: interviewStatus,
      createdAt: now,
      updatedAt: now,
    };

    // Firestoreにインタビューセッションを保存
    const interviewRef = await adminDb
      .collection('interviews')
      .add(interviewSession);

    // ログインユーザーの場合のみユーザードキュメントを更新または作成
    if (userId) {
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        // 既存ユーザー：最終ログイン日時を更新
        await userRef.update({
          lastLoginAt: now,
          updatedAt: now,
        });
      } else {
        // 新規ユーザー：ドキュメントを作成
        await userRef.set({
          uid: userId,
          createdAt: now,
          lastLoginAt: now,
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      interviewId: interviewRef.id,
    });
  } catch (error) {
    console.error('Error saving interview:', error);
    return NextResponse.json(
      { error: 'Failed to save interview' },
      { status: 500 }
    );
  }
}
