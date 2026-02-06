'use client';

import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import Cookies from 'js-cookie';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const { user, signInAsGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGuestStart = async () => {
    setIsLoading(true);
    try {
      // 匿名認証を実行
      console.log('Starting anonymous authentication...');
      await signInAsGuest();
      console.log('Anonymous authentication successful!');

      // ゲストセッションIDを生成してCookieに保存
      const sessionId = uuidv4();
      Cookies.set('guest_session_id', sessionId, { expires: 30, path: '/' }); // 30日間有効
      console.log('Guest session ID created:', sessionId);

      // HOMEページへ遷移
      router.push('/home');
    } catch (error) {
      console.error('Failed to start as guest:', error);
      alert('ゲストとして開始できませんでした。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginStart = () => {
    // ログインページへ遷移
    router.push('/login');
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12"
      style={{
        backgroundImage: 'url(/image/lady-interviewer.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/50 to-white/70" />

      {/* マイページボタン（ログインユーザーのみ） */}
      {user && !user.isAnonymous && (
        <div className="absolute right-4 top-4 z-10">
          <button
            onClick={() => router.push('/mypage')}
            className="btn-gradient-primary rounded-full px-6 py-3 font-semibold text-white shadow-lg"
          >
            マイページ
          </button>
        </div>
      )}

      <main className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-12 text-center">
        {/* ヘッダー */}
        <div className="flex flex-col gap-4">
          <h1 className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
            じぶん図鑑
          </h1>
          <p className="text-xl text-gray-700 md:text-2xl">
            AIとの会話で自分の特徴を集めて図鑑を作ろう
          </p>
        </div>

        {/* サービス説明 */}
        <div className="glass-card flex max-w-2xl flex-col gap-6 rounded-3xl p-8 shadow-xl">
          <h2 className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-2xl font-semibold text-transparent">
            AIとの会話で自分を知る体験
          </h2>
          <div className="text-left text-gray-700">
            <p className="mb-4">
              AIとの会話であなたの特徴を集めて、以下のコンテンツを自動生成します：
            </p>
            <ul className="list-inside list-disc space-y-2 text-gray-600">
              <li>雑誌風のインタビュー記事</li>
              <li>就活・転職で使える自己PR文</li>
              <li>マッチングアプリ用プロフィール</li>
              <li>SNSプロフィール</li>
            </ul>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex w-full max-w-md flex-col gap-4">
          <button
            onClick={handleGuestStart}
            disabled={isLoading}
            className="btn-gradient-primary rounded-full px-8 py-4 text-lg font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? '準備中...' : 'ゲストとして始める'}
          </button>
          <button
            onClick={() => router.push('/login?mode=signup')}
            className="gradient-border rounded-full bg-white px-8 py-4 text-lg font-semibold text-orange-600 shadow-md transition-all hover:shadow-lg hover:scale-[1.02]"
          >
            新規会員登録して始める
          </button>
          <button
            onClick={handleLoginStart}
            className="text-gray-600 underline decoration-orange-300 underline-offset-4 hover:text-orange-600 hover:decoration-orange-500"
          >
            ログイン
          </button>
        </div>

      </main>
    </div>
  );
}
