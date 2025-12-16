'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // ログインしていない場合はLPへリダイレクト
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleStartInterview = () => {
    // ゲストセッションIDがない場合は作成
    if (!Cookies.get('guest_session_id')) {
      const sessionId = uuidv4();
      Cookies.set('guest_session_id', sessionId, { expires: 30, path: '/' });
    }

    // すでにインタビュワーが選択されている場合は直接インタビューページへ
    const selectedInterviewer = Cookies.get('selected_interviewer');
    if (selectedInterviewer) {
      router.push('/interview');
    } else {
      // 初回の場合はインタビュワー選択ページへ
      router.push('/select-interviewer');
    }
  };

  const handleGoToMyPage = () => {
    if (user?.isAnonymous) {
      alert('マイページはログインユーザーのみアクセスできます。\nログインすることで、インタビュー履歴を永続的に保存できます。');
      return;
    }
    router.push('/mypage');
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-purple-50 to-white">
      {/* ユーザーヘッダー */}
      <UserHeader showHomeButton={false} />

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <main className="flex w-full max-w-4xl flex-col items-center gap-12 text-center">
          {/* ヘッダー */}
          <div className="flex flex-col gap-4">
            <h1 className="text-5xl font-bold text-gray-900 md:text-6xl">
              ようこそ
            </h1>
            <p className="text-xl text-gray-600 md:text-2xl">
              AIインタビューで自分の魅力を発見しましょう
            </p>
          </div>

          {/* アクションカード */}
          <div className="grid w-full gap-6 md:grid-cols-2">
            {/* 新しいインタビューを始める */}
            <button
              onClick={handleStartInterview}
              className="group flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 text-4xl transition-colors group-hover:bg-purple-200">
                💬
              </div>
              <div>
                <h2 className="mb-2 text-2xl font-bold text-gray-900">
                  新しいインタビュー
                </h2>
                <p className="text-gray-600">
                  AIとの対話であなたの魅力を引き出します
                </p>
              </div>
            </button>

            {/* マイページ */}
            <button
              onClick={handleGoToMyPage}
              className="group flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl transition-colors group-hover:bg-blue-200">
                📝
              </div>
              <div>
                <h2 className="mb-2 text-2xl font-bold text-gray-900">
                  マイページ
                </h2>
                <p className="text-gray-600">
                  {user.isAnonymous
                    ? 'ログインして過去のインタビューを確認'
                    : '過去のインタビューを確認'}
                </p>
              </div>
            </button>
          </div>

          {/* ゲストユーザー向けメッセージ */}
          {user.isAnonymous && (
            <div className="w-full max-w-2xl rounded-xl bg-blue-50 p-6">
              <h3 className="mb-2 text-lg font-semibold text-blue-900">
                ゲストモードでご利用中
              </h3>
              <p className="mb-4 text-sm text-blue-800">
                ログインすることで、インタビュー履歴を永続的に保存できます。
              </p>
              <button
                onClick={() => router.push('/login')}
                className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                ログインする
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
