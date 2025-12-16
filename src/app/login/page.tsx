'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // 匿名ユーザーの場合は何もしない（ログインフローを進めるため）
    if (user && !loading && !user.isAnonymous) {
      // 通常のログイン済みユーザーの場合のみHOMEにリダイレクト
      router.push('/home');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      await signInWithGoogle();
      router.push('/home');
    } catch (error: any) {
      console.error('ログインエラー:', error);
      setError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    setError('');

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        if (!displayName.trim()) {
          setError('名前を入力してください');
          setIsSigningIn(false);
          return;
        }
        await signUpWithEmail(email, password, displayName);
      }
      router.push('/home');
    } catch (error: any) {
      console.error('認証エラー:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています');
      } else if (error.code === 'auth/weak-password') {
        setError('パスワードは6文字以上で設定してください');
      } else if (error.code === 'auth/invalid-email') {
        setError('メールアドレスの形式が正しくありません');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else {
        setError('認証に失敗しました。もう一度お試しください。');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/* ロゴ・タイトル */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-gray-900">
            あなたのインタビュワー
          </h1>
          <p className="text-lg text-gray-600">
            {mode === 'login' ? 'ログイン' : '新規登録'}
          </p>
        </div>

        {/* ゲストユーザー向けメッセージ */}
        {user && user.isAnonymous && (
          <div className="w-full rounded-lg bg-blue-50 p-4 text-left">
            <p className="text-sm text-blue-800">
              現在ゲストとしてログインしています。<br />
              ログインすることで、インタビュー履歴を永続的に保存できます。
            </p>
          </div>
        )}

        {/* メイン認証フォーム */}
        <div className="w-full rounded-2xl bg-white p-8 shadow-lg">
          {/* タブ切り替え */}
          <div className="mb-6 flex gap-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-md px-4 py-2 font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-md px-4 py-2 font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              新規登録
            </button>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* メール/パスワードフォーム */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div className="text-left">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  名前
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="山田太郎"
                  required
                />
              </div>
            )}

            <div className="text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="example@email.com"
                required
              />
            </div>

            <div className="text-left">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="6文字以上"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full rounded-full bg-blue-600 px-8 py-3 font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {isSigningIn
                ? '処理中...'
                : mode === 'login'
                ? 'ログイン'
                : '新規登録'}
            </button>
          </form>

          {/* 区切り線 */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300"></div>
            <span className="text-sm text-gray-500">または</span>
            <div className="h-px flex-1 bg-gray-300"></div>
          </div>

          {/* Googleログインボタン */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-gray-300 bg-white px-8 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Googleでログイン
          </button>
        </div>

        {/* 説明文 */}
        <p className="text-sm text-gray-600">
          ログインすることで、インタビューデータを永続的に保存できます
        </p>

        {/* 戻るボタン */}
        <button
          onClick={() => router.push('/')}
          className="text-gray-500 underline hover:text-gray-700"
        >
          トップに戻る
        </button>
      </main>
    </div>
  );
}
