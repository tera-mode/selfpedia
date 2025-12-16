'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getInterviewer } from '@/lib/interviewers';
import { InterviewerId, FixedUserData, DynamicData } from '@/types';

interface InterviewData {
  fixed: FixedUserData;
  dynamic?: DynamicData;
  createdAt: string;
  updatedAt: string;
}

export default function InterviewDetail() {
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useAuth();
  const interviewId = params.id as string;

  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [interviewerId, setInterviewerId] = useState<InterviewerId | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.isAnonymous) {
      alert('この機能はログインユーザーのみ利用できます。');
      router.push('/');
      return;
    }

    loadInterviewData();
  }, [user, loading, interviewId, router]);

  const loadInterviewData = async () => {
    try {
      console.log('Loading interview detail:', interviewId);

      const response = await fetch(`/api/get-interview?id=${interviewId}`);

      if (!response.ok) {
        throw new Error('Failed to load interview');
      }

      const result = await response.json();
      console.log('Interview detail loaded:', result);

      // インタビューデータとインタビュワーIDを取得
      const fullData = result.interview || {};
      setInterviewData(fullData.data);
      setInterviewerId(fullData.interviewerId);
    } catch (error) {
      console.error('Error loading interview:', error);
      alert('インタビューデータの読み込みに失敗しました。');
      router.push('/mypage');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
          </div>
          <p className="text-xl font-semibold text-gray-700">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!interviewData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white">
        <p className="text-xl text-gray-700">インタビューが見つかりませんでした</p>
        <button
          onClick={() => router.push('/mypage')}
          className="mt-4 rounded-full bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
        >
          マイページに戻る
        </button>
      </div>
    );
  }

  const interviewer = interviewerId ? getInterviewer(interviewerId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white px-4 py-12">
      <main className="mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900">インタビュー詳細</h1>
          <button
            onClick={() => router.push('/mypage')}
            className="rounded-full border-2 border-purple-600 bg-white px-6 py-3 font-semibold text-purple-600 transition-all hover:bg-purple-50"
          >
            マイページに戻る
          </button>
        </div>

        {/* インタビュワー情報は削除（ユーザーがカスタム名をつけるため） */}

        {/* プロフィール */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold text-gray-800">プロフィール</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <span className="font-semibold text-gray-700">名前:</span>{' '}
              {interviewData.fixed.name}
            </div>
            <div>
              <span className="font-semibold text-gray-700">ニックネーム:</span>{' '}
              {interviewData.fixed.nickname}
            </div>
            <div>
              <span className="font-semibold text-gray-700">性別:</span>{' '}
              {interviewData.fixed.gender}
            </div>
            <div>
              <span className="font-semibold text-gray-700">年齢:</span>{' '}
              {interviewData.fixed.age}歳
            </div>
            <div>
              <span className="font-semibold text-gray-700">居住地:</span>{' '}
              {interviewData.fixed.location}
            </div>
            <div>
              <span className="font-semibold text-gray-700">職業:</span>{' '}
              {interviewData.fixed.occupation}
            </div>
          </div>
          {interviewData.fixed.occupationDetail && (
            <div className="mt-3">
              <span className="font-semibold text-gray-700">職業詳細:</span>{' '}
              {interviewData.fixed.occupationDetail}
            </div>
          )}
        </div>

        {/* 深掘り情報 */}
        {interviewData.dynamic && Object.keys(interviewData.dynamic).length > 0 && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">深掘り情報</h2>
            <div className="space-y-4">
              {Object.entries(interviewData.dynamic).map(([key, item]) => (
                <div key={key} className="rounded-lg bg-purple-50 p-4">
                  <p className="mb-1 text-xs font-semibold text-purple-600">
                    {item.category}
                  </p>
                  <p className="mb-2 font-semibold text-gray-800">
                    Q: {item.question}
                  </p>
                  <p className="text-gray-700">A: {item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-center">
          <button
            onClick={() => router.push(`/result?id=${interviewId}`)}
            className="rounded-full bg-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-purple-700 hover:shadow-lg"
          >
            記事を見る
          </button>
          <button
            onClick={() => router.push('/mypage')}
            className="rounded-full border-2 border-purple-600 bg-white px-8 py-4 text-lg font-semibold text-purple-600 shadow-md transition-all hover:bg-purple-50 hover:shadow-lg"
          >
            マイページに戻る
          </button>
        </div>
      </main>
    </div>
  );
}
