'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import Image from 'next/image';
import { INTERVIEWERS } from '@/lib/interviewers';
import { InterviewerId, InterviewMode } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';

export default function SelectInterviewer() {
  const router = useRouter();
  const { user, updateUserInterviewer, userInterviewer } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedInterviewer, setSelectedInterviewer] = useState<InterviewerId | null>(null);
  const [interviewerName, setInterviewerName] = useState('');
  const [customPersonality, setCustomPersonality] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('basic');

  useEffect(() => {
    // ゲストセッションIDを確認
    const guestSessionId = Cookies.get('guest_session_id');
    if (!guestSessionId) {
      router.push('/');
      return;
    }
    setSessionId(guestSessionId);

    // インタビューモードを取得
    const mode = Cookies.get('interview_mode') as InterviewMode;
    if (mode) {
      setInterviewMode(mode);
    }

    // すでにインタビュワーが決定済みの場合はスキップ
    const savedInterviewerId = Cookies.get('selected_interviewer');
    const savedName = Cookies.get('interviewer_name');

    // Cookieまたはユーザーデータで決定済みか確認
    const hasInterviewerInCookie = savedInterviewerId && savedName;
    const hasInterviewerInUserData = userInterviewer?.id && userInterviewer?.customName;

    if (hasInterviewerInCookie || hasInterviewerInUserData) {
      // ユーザーデータがある場合はCookieにも同期
      if (hasInterviewerInUserData && !hasInterviewerInCookie) {
        Cookies.set('selected_interviewer', userInterviewer.id, { expires: 365, path: '/' });
        Cookies.set('interviewer_name', userInterviewer.customName!, { expires: 365, path: '/' });
      }
      // インタビューページへ直接遷移
      router.push(`/interview/${mode || 'basic'}`);
      return;
    }

    // 保存されているインタビュワー名があれば取得
    if (savedName) {
      setInterviewerName(savedName);
    }
  }, [router, userInterviewer]);

  const handleSelectInterviewer = (interviewerId: InterviewerId) => {
    setSelectedInterviewer(interviewerId);

    // すでに名前が保存されている場合はそのまま進む
    const savedName = Cookies.get('interviewer_name');
    if (savedName) {
      proceedToInterview(interviewerId, savedName);
    } else {
      setShowNameInput(true);
    }
  };

  const proceedToInterview = async (interviewerId: InterviewerId, name: string) => {
    // 選択したインタビュワーIDをCookieに永続保存（365日）
    Cookies.set('selected_interviewer', interviewerId, { expires: 365, path: '/' });
    Cookies.set('interviewer_name', name, { expires: 365, path: '/' });
    if (customPersonality.trim()) {
      Cookies.set('interviewer_customization', customPersonality.trim(), { expires: 365, path: '/' });
    }

    // Firestoreにも保存（ログインユーザーの場合）
    if (user && !user.isAnonymous) {
      try {
        await updateUserInterviewer({
          id: interviewerId,
          customName: name,
          customPersonality: customPersonality.trim() || undefined,
        });
      } catch (error) {
        console.error('Failed to save interviewer settings:', error);
      }
    }

    // モード別インタビューページへ遷移
    router.push(`/interview/${interviewMode}`);
  };

  const handleNameSubmit = () => {
    if (!interviewerName.trim() || !selectedInterviewer) return;
    proceedToInterview(selectedInterviewer, interviewerName.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    }
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const selectedInterviewerData = selectedInterviewer
    ? INTERVIEWERS.find(i => i.id === selectedInterviewer)
    : null;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-warm">
      {/* 装飾用グラデーションオーブ */}
      <div className="gradient-orb gradient-orb-orange absolute -left-40 top-1/4 h-96 w-96" />
      <div className="gradient-orb gradient-orb-yellow absolute -right-40 bottom-1/4 h-80 w-80" />

      <UserHeader />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <main className="flex w-full max-w-7xl flex-col items-center gap-12 text-center">
          {/* ヘッダー */}
          <div className="flex flex-col gap-4">
            <h1 className="bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
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
                className="group relative overflow-hidden rounded-3xl shadow-2xl transition-all hover:scale-[1.02] hover-glow"
              >
                <div className="relative h-[600px] w-full">
                  <Image
                    src={interviewer.gender === '女性' ? '/image/lady-interviewer.png' : '/image/man-interviewer.png'}
                    alt={`${interviewer.gender}のインタビュワー`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-600/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>

          {/* 戻るボタン */}
          <button
            onClick={() => router.push('/interview/select-mode')}
            className="text-gray-500 underline decoration-orange-300 underline-offset-4 hover:text-orange-600 hover:decoration-orange-500"
          >
            モード選択に戻る
          </button>
        </main>
      </div>

      {/* 名前入力モーダル */}
      {showNameInput && selectedInterviewerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="glass-modal w-full max-w-md rounded-3xl p-6">
            <div className="mb-6 flex justify-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-full ring-4 ring-orange-200 shadow-lg">
                <Image
                  src={selectedInterviewerData.gender === '女性' ? '/image/icon_lady-interviewer.png' : '/image/icon_man-interviewer.png'}
                  alt="インタビュワー"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            <h2 className="mb-2 text-center text-xl font-bold text-gray-900">
              インタビュワーに名前をつけてください
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              好きな名前で呼んでください
            </p>

            <input
              type="text"
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="例：あかり、けんと、など"
              className="glass-input mb-4 w-full rounded-xl px-4 py-3 text-center text-lg focus:ring-2 focus:ring-orange-300 focus:outline-none"
              autoFocus
            />

            <div className="mb-4">
              <p className="mb-2 text-left text-sm font-medium text-gray-700">
                性格のカスタマイズ（任意）
              </p>
              <textarea
                value={customPersonality}
                onChange={(e) => setCustomPersonality(e.target.value)}
                placeholder="例：明るくて元気、優しくて落ち着いた雰囲気、など"
                className="glass-input w-full rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                rows={3}
                maxLength={200}
              />
              <p className="mt-1 text-right text-xs text-gray-500">
                {customPersonality.length}/200
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNameInput(false);
                  setSelectedInterviewer(null);
                }}
                className="flex-1 rounded-xl border border-orange-200 bg-white/80 px-4 py-3 font-semibold text-gray-700 transition-all hover:bg-orange-50"
              >
                戻る
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={!interviewerName.trim()}
                className="btn-gradient-primary flex-1 rounded-xl px-4 py-3 font-semibold text-white shadow-md disabled:opacity-50"
              >
                インタビュー開始
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
