'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { UserTrait } from '@/types/trait';
import { SelfImage, InterviewerId } from '@/types';
import { getInterviewer } from '@/lib/interviewers';

export default function SelfImagePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [traits, setTraits] = useState<UserTrait[]>([]);
  const [selfImages, setSelfImages] = useState<SelfImage[]>([]);
  const [interviewerGender, setInterviewerGender] = useState<'男性' | '女性'>('女性');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.isAnonymous)) {
      router.push('/login');
      return;
    }

    if (user && !user.isAnonymous) {
      loadData();
    }
  }, [user, loading, router]);

  const loadData = async () => {
    try {
      setIsLoadingData(true);

      // 特徴データを取得
      const traitsResponse = await authenticatedFetch(`/api/get-user-traits?userId=${user?.uid}`);
      if (traitsResponse.ok) {
        const traitsData = await traitsResponse.json();
        setTraits(traitsData.traits || []);
      }

      // 既存の自分画像を取得
      const imagesResponse = await authenticatedFetch(`/api/generate-self-image?userId=${user?.uid}`);
      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        setSelfImages(imagesData.selfImages || []);
      }

      // ユーザーのインタビュワー設定を取得
      const userDataResponse = await authenticatedFetch(`/api/get-user-data?userId=${user?.uid}`);
      if (userDataResponse.ok) {
        const userData = await userDataResponse.json();
        if (userData.user?.interviewer?.id) {
          const interviewer = getInterviewer(userData.user.interviewer.id as InterviewerId);
          if (interviewer) {
            setInterviewerGender(interviewer.gender);
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!user || user.isAnonymous || traits.length < 10) return;

    setIsGenerating(true);
    setError('');

    try {
      const response = await authenticatedFetch('/api/generate-self-image', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          traits,
          interviewerGender,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      setSelfImages([data.selfImage, ...selfImages]);
    } catch (err: unknown) {
      console.error('Error generating image:', err);
      setError(err instanceof Error ? err.message : '画像生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading image:', err);
      alert('ダウンロードに失敗しました');
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('この画像を削除しますか？')) return;

    setIsDeleting(imageId);
    try {
      const response = await authenticatedFetch('/api/delete-self-image', {
        method: 'POST',
        body: JSON.stringify({ imageId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // ローカル状態から削除
      setSelfImages(selfImages.filter(img => img.id !== imageId));
    } catch (err) {
      console.error('Error deleting image:', err);
      alert('削除に失敗しました');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading || isLoadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const canGenerate = traits.length >= 10;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-warm">
      <div className="gradient-orb gradient-orb-orange absolute -right-40 top-20 h-96 w-96" />
      <div className="gradient-orb gradient-orb-yellow absolute -left-40 bottom-20 h-80 w-80" />

      <UserHeader />

      <div className="relative z-10 px-4 py-8">
        <main className="mx-auto max-w-4xl">
          {/* ヘッダー */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
              自分画像生成
            </h1>
            <p className="text-gray-600">
              特徴データを元に、あなたのイメージ画像を生成します
            </p>
          </div>

          {/* 注意書き */}
          <div className="glass-card mb-6 rounded-2xl bg-blue-50/80 p-4">
            <p className="text-sm text-blue-800">
              Google Imagen 4を使用して、あなたの特徴を表現するアート画像を生成します。
              生成には数秒かかります。
            </p>
          </div>

          {/* 特徴数チェック */}
          {!canGenerate && (
            <div className="glass-card mb-6 rounded-2xl p-6 text-center">
              <p className="mb-4 text-gray-700">
                自分画像を生成するには、特徴データが10個以上必要です
              </p>
              <p className="mb-4 text-2xl font-bold text-orange-600">
                現在: {traits.length} / 10 個
              </p>
              <button
                onClick={() => router.push('/interview/select-mode')}
                className="btn-gradient-primary rounded-xl px-6 py-3 font-semibold text-white shadow-md"
              >
                インタビューで特徴を増やす
              </button>
            </div>
          )}

          {/* 生成ボタン */}
          {canGenerate && (
            <div className="glass-card mb-8 rounded-2xl p-6 text-center">
              <p className="mb-4 text-gray-700">
                特徴データ: <span className="font-bold text-orange-600">{traits.length}個</span>
              </p>
              <button
                onClick={handleGenerateImage}
                disabled={isGenerating}
                className="btn-gradient-primary rounded-xl px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
              >
                {isGenerating ? '生成中...' : '新しい画像を生成'}
              </button>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 生成された画像一覧（履歴） */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="mb-6 text-xl font-bold text-gray-800">
              生成履歴
              {selfImages.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({selfImages.length}件)
                </span>
              )}
            </h2>

            {selfImages.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                まだ画像が生成されていません
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {selfImages.map((selfImage) => (
                  <div key={selfImage.id} className="rounded-xl bg-white/80 p-4 shadow-md">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                      <Image
                        src={selfImage.squareImageUrl}
                        alt="自分画像"
                        fill
                        className="object-cover"
                      />
                    </div>

                    {/* ボタン群 */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleDownload(selfImage.squareImageUrl, `self-image-${selfImage.id}.png`)}
                        className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                      >
                        ダウンロード
                      </button>
                      <button
                        onClick={() => handleDelete(selfImage.id)}
                        disabled={isDeleting === selfImage.id}
                        className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-300 disabled:opacity-50"
                      >
                        {isDeleting === selfImage.id ? '...' : '削除'}
                      </button>
                    </div>

                    {/* 生成理由 */}
                    {selfImage.reason && (
                      <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                        {selfImage.reason}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-gray-400">
                      生成日時: {selfImage.generatedAt
                        ? (typeof selfImage.generatedAt === 'object' && 'toDate' in selfImage.generatedAt)
                          ? (selfImage.generatedAt as { toDate: () => Date }).toDate().toLocaleString('ja-JP')
                          : new Date(selfImage.generatedAt).toLocaleString('ja-JP')
                        : '不明'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 戻るボタン */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/output/create')}
              className="text-gray-500 underline decoration-orange-300 underline-offset-4 hover:text-orange-600"
            >
              アウトプット一覧に戻る
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
