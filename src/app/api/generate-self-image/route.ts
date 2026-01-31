import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { UserTrait } from '@/types/trait';
import { generateImage, buildImagePrompt } from '@/lib/imagen';

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

    const { userId, traits, interviewerGender } = await request.json();

    // リクエストのuserIdと認証されたuidが一致するか検証
    if (userId !== authResult.uid) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 特徴データが10個以上かチェック
    if (!traits || traits.length < 10) {
      return NextResponse.json(
        { error: '特徴データが10個以上必要です' },
        { status: 400 }
      );
    }

    // 特徴データから画像生成用のプロンプトを作成（インタビュワーの性別を考慮）
    // 4つのシチュエーションからランダムで1つ選択
    console.log('Generating situation variations...');
    const { prompt, situation } = await buildImagePrompt(
      traits as UserTrait[],
      interviewerGender || '女性'
    );

    // Imagen 4で画像を生成（スクエア1枚のみ）
    console.log('Generating image with Imagen 4...');
    console.log('Selected situation:', situation);
    console.log('Prompt:', prompt);
    const imageData = await generateImage(prompt, '1:1');

    // Firebase Storageに保存
    const timestamp = Date.now();
    const squareImagePath = `self-images/${userId}/square_${timestamp}.png`;

    const bucket = adminStorage.bucket();

    await bucket.file(squareImagePath).save(imageData, {
      metadata: { contentType: 'image/png' },
      public: true,
    });

    const squareImageUrl = `https://storage.googleapis.com/${bucket.name}/${squareImagePath}`;

    // 生成理由を作成（選ばれたシチュエーションを含める）
    const topTraits = (traits as UserTrait[]).slice(0, 5);
    const traitLabels = topTraits.map(t => t.label).join('、');
    const reason = `あなたの特徴「${traitLabels}」などから生成しました。`;

    // Firestoreに保存
    const selfImageRef = adminDb.collection('selfImages').doc();
    const selfImageData = {
      id: selfImageRef.id,
      userId,
      squareImageUrl,
      prompt,
      situation, // 選ばれたシチュエーション
      reason,
      traitsUsed: traits.map((t: UserTrait) => t.id),
      generatedAt: new Date(),
      createdAt: new Date(),
    };

    await selfImageRef.set(selfImageData);

    return NextResponse.json({
      success: true,
      selfImage: selfImageData,
    });
  } catch (error) {
    console.error('Error generating self image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate self image' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 認証検証（匿名ユーザーは不可）
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json(
        { error: 'ログインユーザーのみ利用可能です' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // リクエストのuserIdと認証されたuidが一致するか検証
    if (userId !== authResult.uid) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // ユーザーの自分画像を取得（インデックス不要な方法）
    const selfImagesSnapshot = await adminDb
      .collection('selfImages')
      .where('userId', '==', userId)
      .get();

    // メモリ上で日付順にソート（新しい順）
    const selfImages = selfImagesSnapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

    return NextResponse.json({
      success: true,
      selfImages,
    });
  } catch (error) {
    console.error('Error fetching self images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch self images' },
      { status: 500 }
    );
  }
}
