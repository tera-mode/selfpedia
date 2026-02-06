'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Cookies from 'js-cookie';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import { INTERVIEWERS } from '@/lib/interviewers';
import { InterviewerId } from '@/types';

export default function InterviewerSettingsPage() {
  const router = useRouter();
  const { user, loading, userInterviewer, updateUserInterviewer } = useAuth();

  const [selectedInterviewer, setSelectedInterviewer] = useState<InterviewerId | null>(null);
  const [interviewerName, setInterviewerName] = useState('');
  const [customPersonality, setCustomPersonality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Cookieまたはユーザー設定から読み込み
    const cookieInterviewer = Cookies.get('selected_interviewer') as InterviewerId;
    const cookieName = Cookies.get('interviewer_name');

    if (userInterviewer) {
      setSelectedInterviewer(userInterviewer.id);
      setInterviewerName(userInterviewer.customName);
      setCustomPersonality(userInterviewer.customPersonality || '');
    } else if (cookieInterviewer) {
      setSelectedInterviewer(cookieInterviewer);
      setInterviewerName(cookieName || '');
      const cookieCustomization = Cookies.get('interviewer_customization');
      setCustomPersonality(cookieCustomization || '');
    }
  }, [user, loading, userInterviewer, router]);

  const handleSelectInterviewer = (id: InterviewerId) => {
    setSelectedInterviewer(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!selectedInterviewer) {
      setError('インタビュワーを選択してください');
      return;
    }

    if (!interviewerName.trim()) {
      setError('名前を入力してください');
      return;
    }

    setIsSubmitting(true);

    try {
      // Cookieに保存
      Cookies.set('selected_interviewer', selectedInterviewer, { expires: 365, path: '/' });
      Cookies.set('interviewer_name', interviewerName.trim(), { expires: 365, path: '/' });
      if (customPersonality.trim()) {
        Cookies.set('interviewer_customization', customPersonality.trim(), { expires: 365, path: '/' });
      } else {
        Cookies.remove('interviewer_customization');
      }

      // ログインユーザーの場合はFirestoreにも保存
      if (user && !user.isAnonymous) {
        await updateUserInterviewer({
          id: selectedInterviewer,
          customName: interviewerName.trim(),
          customPersonality: customPersonality.trim() || undefined,
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating interviewer settings:', err);
      setError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
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
    ? INTERVIEWERS.find((i) => i.id === selectedInterviewer)
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-warm">
      <div className="gradient-orb gradient-orb-orange absolute -right-40 top-20 h-96 w-96" />
      <div className="gradient-orb gradient-orb-yellow absolute -left-40 bottom-20 h-80 w-80" />

      <UserHeader />

      <div className="relative z-10 px-4 py-8">
        <main className="mx-auto max-w-2xl">
          {/* ヘッダー */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-3xl font-bold text-transparent">
              インタビュワー設定
            </h1>
            <p className="text-gray-600">
              インタビュワーを選んで名前をつけましょう
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* インタビュワー選択 */}
            <div className="glass-card mb-6 rounded-2xl p-6">
              <h2 className="mb-4 font-bold text-gray-800">
                インタビュワーを選択
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {INTERVIEWERS.map((interviewer) => (
                  <button
                    key={interviewer.id}
                    type="button"
                    onClick={() => handleSelectInterviewer(interviewer.id)}
                    className={`relative overflow-hidden rounded-2xl transition-all ${
                      selectedInterviewer === interviewer.id
                        ? 'ring-4 ring-orange-400 shadow-lg'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div className="relative aspect-[3/4]">
                      <Image
                        src={
                          interviewer.gender === '女性'
                            ? '/image/lady-interviewer.png'
                            : '/image/man-interviewer.png'
                        }
                        alt={`${interviewer.gender}のインタビュワー`}
                        fill
                        className="object-cover"
                      />
                      {selectedInterviewer === interviewer.id && (
                        <div className="absolute inset-0 bg-orange-500/20" />
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                      <p className="text-sm font-medium text-white">
                        {interviewer.description}
                      </p>
                    </div>
                    {selectedInterviewer === interviewer.id && (
                      <div className="absolute right-2 top-2 rounded-full bg-orange-500 p-1 text-white">
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 名前設定 */}
            {selectedInterviewer && (
              <div className="glass-card mb-6 rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-orange-200">
                    <Image
                      src={
                        selectedInterviewerData?.gender === '女性'
                          ? '/image/icon_lady-interviewer.png'
                          : '/image/icon_man-interviewer.png'
                      }
                      alt="インタビュワー"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800">名前を設定</h2>
                    <p className="text-sm text-gray-600">
                      インタビュワーの呼び名を決めてください
                    </p>
                  </div>
                </div>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="例：あかり、けんと、など"
                  className="w-full rounded-xl border border-orange-200 bg-white/80 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  maxLength={20}
                />
              </div>
            )}

            {/* 性格カスタマイズ */}
            {selectedInterviewer && (
              <div className="glass-card mb-6 rounded-2xl p-6">
                <h2 className="mb-2 font-bold text-gray-800">
                  性格のカスタマイズ（任意）
                </h2>
                <p className="mb-4 text-sm text-gray-600">
                  インタビュワーの性格や雰囲気を自由に設定できます
                </p>
                <textarea
                  value={customPersonality}
                  onChange={(e) => setCustomPersonality(e.target.value)}
                  placeholder="例：明るくて元気、優しくて落ち着いた雰囲気、フレンドリーで親しみやすい、など"
                  className="w-full rounded-xl border border-orange-200 bg-white/80 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  rows={4}
                  maxLength={200}
                />
                <p className="mt-1 text-right text-xs text-gray-500">
                  {customPersonality.length}/200
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                保存しました
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !selectedInterviewer}
              className="btn-gradient-primary w-full rounded-xl py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : '保存する'}
            </button>
          </form>

          {/* 戻るボタン */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/mypage')}
              className="text-gray-500 underline decoration-orange-300 underline-offset-4 hover:text-orange-600"
            >
              マイページに戻る
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
