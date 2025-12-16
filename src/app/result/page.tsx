'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { FixedUserData, DynamicData, InterviewData } from '@/types';
import UserHeader from '@/components/UserHeader';
import Cookies from 'js-cookie';

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interviewId = searchParams.get('id');

  const [interviewData, setInterviewData] = useState<Partial<InterviewData> | null>(null);
  const [article, setArticle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    console.log('Result page loaded with ID:', interviewId);

    if (!interviewId) {
      console.error('No interview ID provided, redirecting to home');
      router.push('/');
      return;
    }

    // FirestoreからインタビューデータをIDで取得
    loadInterviewData(interviewId);
  }, [router, interviewId]);

  const loadInterviewData = async (id: string) => {
    try {
      console.log('Loading interview data from Firestore:', id);

      const response = await fetch(`/api/get-interview?id=${id}`);

      if (!response.ok) {
        throw new Error('Failed to load interview data');
      }

      const result = await response.json();
      console.log('Interview data loaded:', result);

      setInterviewData(result.data);

      // 記事生成
      if (result.data.fixed) {
        console.log('Generating article with fixed data');
        generateArticle(result.data.fixed);
      } else {
        console.error('No fixed data found in interview data');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading interview data:', error);
      alert('インタビューデータの読み込みに失敗しました。');
      router.push('/');
    }
  };

  const generateArticle = async (data: Partial<FixedUserData>) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interviewData: data }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate article');
      }

      const result = await response.json();
      setArticle(result.article);
    } catch (error) {
      console.error('Error generating article:', error);
      setArticle('記事の生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyArticle = async () => {
    try {
      await navigator.clipboard.writeText(article);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleStartNew = () => {
    // ゲストセッションIDがない場合は作成
    if (!Cookies.get('guest_session_id')) {
      const { v4: uuidv4 } = require('uuid');
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
          </div>
          <p className="text-xl font-semibold text-gray-700">
            インタビュー記事を生成中...
          </p>
          <p className="mt-2 text-gray-500">少々お待ちください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* ユーザーヘッダー */}
      <UserHeader />

      <div className="px-4 py-12">
        <main className="mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
            インタビュー記事が完成しました
          </h1>
          <p className="text-lg text-gray-600">
            あなたの魅力を引き出した記事をご覧ください
          </p>
        </div>

        {/* プロフィール概要 */}
        {interviewData && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">
              プロフィール
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <span className="font-semibold text-gray-700">名前:</span>{' '}
                {interviewData.fixed?.name}
              </div>
              <div>
                <span className="font-semibold text-gray-700">ニックネーム:</span>{' '}
                {interviewData.fixed?.nickname}
              </div>
              <div>
                <span className="font-semibold text-gray-700">性別:</span>{' '}
                {interviewData.fixed?.gender}
              </div>
              <div>
                <span className="font-semibold text-gray-700">年齢:</span>{' '}
                {interviewData.fixed?.age}歳
              </div>
              <div>
                <span className="font-semibold text-gray-700">居住地:</span>{' '}
                {interviewData.fixed?.location}
              </div>
              <div>
                <span className="font-semibold text-gray-700">職業:</span>{' '}
                {interviewData.fixed?.occupation}
              </div>
            </div>
            {interviewData.fixed?.occupationDetail && (
              <div className="mt-3">
                <span className="font-semibold text-gray-700">職業詳細:</span>{' '}
                {interviewData.fixed.occupationDetail}
              </div>
            )}

            {/* 深掘り情報（Phase 2-1で追加） */}
            {interviewData.dynamic &&
              Object.keys(interviewData.dynamic).length > 0 && (
                <>
                  <hr className="my-6 border-gray-200" />
                  <h3 className="mb-3 text-xl font-semibold text-gray-800">
                    深掘り情報
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(interviewData.dynamic).map(
                      ([key, item]) => (
                        <div key={key} className="rounded-lg bg-purple-50 p-4">
                          <p className="mb-1 text-xs font-semibold text-purple-600">
                            {item.category}
                          </p>
                          <p className="mb-2 font-semibold text-gray-800">
                            Q: {item.question}
                          </p>
                          <p className="text-gray-700">A: {item.answer}</p>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
          </div>
        )}

        {/* インタビュー記事 */}
        <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">インタビュー記事</h2>
            <button
              onClick={handleCopyArticle}
              className={`rounded-full px-6 py-2 font-semibold text-white transition-colors ${
                copySuccess
                  ? 'bg-green-500'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {copySuccess ? 'コピーしました！' : 'コピー'}
            </button>
          </div>
          <div className="prose max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {article}
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-center">
          <button
            onClick={handleStartNew}
            className="rounded-full bg-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-purple-700 hover:shadow-lg"
          >
            新しいインタビューを始める
          </button>
          <button
            onClick={() => router.push('/home')}
            className="rounded-full border-2 border-purple-600 bg-white px-8 py-4 text-lg font-semibold text-purple-600 shadow-md transition-all hover:bg-purple-50 hover:shadow-lg"
          >
            HOMEに戻る
          </button>
        </div>
        </main>
      </div>
    </div>
  );
}

export default function Result() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
          </div>
          <p className="text-xl font-semibold text-gray-700">読み込み中...</p>
        </div>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
