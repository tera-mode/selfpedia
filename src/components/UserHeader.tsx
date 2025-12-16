'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface UserHeaderProps {
  showHomeButton?: boolean;
}

export default function UserHeader({ showHomeButton = true }: UserHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleMyPage = () => {
    if (user?.isAnonymous) {
      alert('マイページはログインユーザーのみアクセスできます。\nログインすることで、インタビュー履歴を永続的に保存できます。');
      return;
    }
    router.push('/mypage');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="border-b bg-white px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* ユーザー情報 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-lg">
            {user.isAnonymous ? '👤' : '👨‍💼'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {user.isAnonymous ? 'ゲストユーザー' : user.email}
            </p>
            {user.isAnonymous && (
              <p className="text-xs text-gray-500">一時的なセッション</p>
            )}
          </div>
        </div>

        {/* ボタン群 */}
        <div className="flex items-center gap-2">
          {showHomeButton && (
            <button
              onClick={() => router.push('/home')}
              className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              HOME
            </button>
          )}
          {!user.isAnonymous && (
            <button
              onClick={handleMyPage}
              className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
            >
              マイページ
            </button>
          )}
          {user.isAnonymous && (
            <button
              onClick={() => router.push('/login')}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              ログインして保存
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
