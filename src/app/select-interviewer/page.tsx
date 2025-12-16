'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import Image from 'next/image';
import { INTERVIEWERS } from '@/lib/interviewers';
import { InterviewerId } from '@/types';
import UserHeader from '@/components/UserHeader';

export default function SelectInterviewer() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // ゲストセッションIDを確認
    const guestSessionId = Cookies.get('guest_session_id');
    if (!guestSessionId) {
      // セッションIDがない場合はLPに戻す
      router.push('/');
      return;
    }
    setSessionId(guestSessionId);
  }, [router]);

  const handleSelectInterviewer = (interviewerId: InterviewerId) => {
    // 選択したインタビュワーIDをCookieに永続保存（365日）
    Cookies.set('selected_interviewer', interviewerId, { expires: 365, path: '/' });

    // インタビューページへ遷移
    router.push('/interview');
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-purple-50 to-white">
      {/* ユーザーヘッダー */}
      <UserHeader />

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <main className="flex w-full max-w-7xl flex-col items-center gap-12 text-center">
        {/* ヘッダー */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
            インタビュワーを選んでください
          </h1>
          <p className="text-lg text-gray-600">
            画像をクリックして選択してください
          </p>
        </div>

        {/* インタビュワー画像選択 */}
        <div className="grid w-full gap-8 md:grid-cols-2">
          {INTERVIEWERS.map((interviewer) => (
            <button
              key={interviewer.id}
              onClick={() => handleSelectInterviewer(interviewer.id as InterviewerId)}
              className="group relative overflow-hidden rounded-3xl shadow-2xl transition-all hover:scale-[1.02] hover:shadow-3xl"
            >
              <div className="relative h-[600px] w-full">
                <Image
                  src={interviewer.gender === '女性' ? '/image/lady-interviewer.png' : '/image/man-interviewer.png'}
                  alt={`${interviewer.gender}のインタビュワー`}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  priority
                />
              </div>
            </button>
          ))}
        </div>

        {/* 戻るボタン */}
        <button
          onClick={() => router.push('/home')}
          className="text-gray-500 underline hover:text-gray-700"
        >
          HOMEに戻る
        </button>
        </main>
      </div>
    </div>
  );
}
