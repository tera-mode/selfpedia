import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth/verifyAuth';

export async function POST(request: NextRequest) {
  try {
    // 認証検証（匿名ユーザーは不可）
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json(
        { error: 'ログインユーザーのみ利用可能です' },
        { status: 401 }
      );
    }

    const { imageId } = await request.json();

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // 画像データを取得
    const imageRef = adminDb.collection('selfImages').doc(imageId);
    const imageDoc = await imageRef.get();

    if (!imageDoc.exists) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    const imageData = imageDoc.data();

    // 所有者チェック
    if (imageData?.userId !== authResult.uid) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Firebase Storageから画像を削除
    const bucket = adminStorage.bucket();

    try {
      // squareImageUrlからパスを抽出
      if (imageData?.squareImageUrl) {
        const squarePath = imageData.squareImageUrl.split(`${bucket.name}/`)[1];
        if (squarePath) {
          await bucket.file(squarePath).delete();
        }
      }
    } catch (storageError) {
      console.error('Error deleting from storage:', storageError);
      // Storageの削除に失敗してもFirestoreからは削除を続行
    }

    // Firestoreから削除
    await imageRef.delete();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting self image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
