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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
      {/* マイページボタン（ログインユーザーのみ） */}
      {user && !user.isAnonymous && (
        <div className="absolute right-4 top-4">
          <button
            onClick={() => router.push('/mypage')}
            className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white transition-all hover:bg-purple-700"
          >
            マイページ
          </button>
        </div>
      )}

      <main className="flex w-full max-w-4xl flex-col items-center gap-12 text-center">
        {/* ヘッダー */}
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold text-gray-900 md:text-6xl">
            あなたのインタビュワー
          </h1>
          <p className="text-xl text-gray-600 md:text-2xl">
            AIがあなたを有名人のようにインタビュー
          </p>
        </div>

        {/* サービス説明 */}
        <div className="flex max-w-2xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800">
            魅力を引き出すインタビュー体験
          </h2>
          <div className="text-left text-gray-700">
            <p className="mb-4">
              AIインタビュワーがあなたの魅力を引き出し、以下のコンテンツを生成します：
            </p>
            <ul className="list-inside list-disc space-y-2">
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
            className="rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '準備中...' : 'ゲストとして始める'}
          </button>
          <button
            onClick={handleLoginStart}
            className="rounded-full border-2 border-blue-600 bg-white px-8 py-4 text-lg font-semibold text-blue-600 shadow-md transition-all hover:bg-blue-50 hover:shadow-lg"
          >
            ログインして始める
          </button>
        </div>

        {/* 注意事項 */}
        <div className="max-w-2xl text-sm text-gray-500">
          <p>
            ゲスト利用の場合、データはCookieに保存されます。Cookieを削除するとデータが消失しますのでご注意ください。
          </p>
          <p className="mt-2">
            ログインすることで、データを永続的に保存できます。
          </p>
        </div>
      </main>
    </div>
  );
}
