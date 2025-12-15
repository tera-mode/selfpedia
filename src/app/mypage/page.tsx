'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getInterviewer } from '@/lib/interviewers';
import { InterviewerId } from '@/types';

interface Interview {
  id: string;
  userId: string;
  interviewerId: InterviewerId;
  data: {
    fixed: {
      name: string;
      nickname: string;
      gender: string;
      age: number;
      location: string;
      occupation: string;
      occupationDetail: string;
    };
    dynamic?: any;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function MyPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // ログインしていない場合はログインページへ
      router.push('/login');
      return;
    }

    // 匿名ユーザーの場合はマイページにアクセスできない
    if (user.isAnonymous) {
      alert('マイページはログインユーザーのみアクセスできます。');
      router.push('/');
      return;
    }

    fetchInterviews();
  }, [user, loading, router]);

  const fetchInterviews = async () => {
    if (!user) return;

    setIsLoadingInterviews(true);
    try {
      console.log('Loading interviews for user:', user.uid);

      const response = await fetch(`/api/get-user-interviews?userId=${user.uid}`);

      if (!response.ok) {
        throw new Error('Failed to load interviews');
      }

      const result = await response.json();
      console.log('Interviews loaded:', result.interviews);

      setInterviews(result.interviews);
    } catch (error) {
      console.error('Error loading interviews:', error);
      alert('インタビュー一覧の読み込みに失敗しました。');
    } finally {
      setIsLoadingInterviews(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const handleNewInterview = () => {
    router.push('/select-interviewer');
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white px-4 py-12">
      <main className="mx-auto max-w-6xl">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">マイページ</h1>
            <p className="mt-2 text-gray-600">
              ようこそ、{user.displayName || user.email}さん
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleNewInterview}
              className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
            >
              新しいインタビュー
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-full border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* インタビュー一覧 */}
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold text-gray-800">
            過去のインタビュー
          </h2>

          {isLoadingInterviews ? (
            <p className="text-gray-600">読み込み中...</p>
          ) : interviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">
                まだインタビューがありません
              </p>
              <button
                onClick={handleNewInterview}
                className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
              >
                最初のインタビューを始める
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {interviews.map((interview) => {
                const interviewer = getInterviewer(interview.interviewerId);
                const date = new Date(interview.createdAt);

                return (
                  <div
                    key={interview.id}
                    className="cursor-pointer rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-purple-600 hover:shadow-lg"
                    onClick={() => router.push(`/mypage/interview/${interview.id}`)}
                  >
                    {/* 日付 */}
                    <div className="mb-3 text-sm text-gray-500">
                      {date.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>

                    {/* インタビュワー */}
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-2xl">
                        {interviewer?.gender === '女性' ? '👩' : '👨'}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          インタビュワー
                        </p>
                        <p className="font-semibold text-gray-800">
                          {interviewer?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* 基本情報 */}
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-semibold text-gray-700">
                          名前:
                        </span>{' '}
                        <span className="text-sm text-gray-600">
                          {interview.data.fixed.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-700">
                          職業:
                        </span>{' '}
                        <span className="text-sm text-gray-600">
                          {interview.data.fixed.occupation}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-700">
                          深掘り質問:
                        </span>{' '}
                        <span className="text-sm text-gray-600">
                          {interview.data.dynamic
                            ? Object.keys(interview.data.dynamic).length
                            : 0}
                          件
                        </span>
                      </div>
                    </div>

                    {/* 詳細を見るボタン */}
                    <div className="mt-4 text-center">
                      <span className="text-sm font-semibold text-purple-600">
                        詳細を見る →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* トップに戻るボタン */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 underline hover:text-gray-700"
          >
            トップに戻る
          </button>
        </div>
      </main>
    </div>
  );
}
