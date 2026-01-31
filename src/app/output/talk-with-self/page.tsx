'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { ChatMessage, SelfImage } from '@/types';
import { UserTrait } from '@/types/trait';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

export default function TalkWithSelfPage() {
  const router = useRouter();
  const { user, loading, userProfile } = useAuth();

  const [traits, setTraits] = useState<UserTrait[]>([]);
  const [selfImages, setSelfImages] = useState<SelfImage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && (!user || user.isAnonymous)) {
      router.push('/login');
      return;
    }

    if (user && !user.isAnonymous) {
      loadData();
    }
  }, [user, loading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const loadData = async () => {
    try {
      setIsLoadingData(true);

      // 特徴データを取得
      const traitsResponse = await authenticatedFetch(`/api/get-user-traits?userId=${user?.uid}`);
      if (traitsResponse.ok) {
        const traitsData = await traitsResponse.json();
        setTraits(traitsData.traits || []);

        // 特徴が10個以上の場合のみ、初期メッセージを設定
        if (traitsData.traits && traitsData.traits.length >= 10) {
          const initialMessage: ChatMessage = {
            role: 'assistant',
            content: `こんにちは！わたしは、あなたの特徴を学んだAIです。あなた自身と対話するような感覚で、気軽に話しかけてくださいね。`,
            timestamp: new Date(),
          };
          setMessages([initialMessage]);
        }
      }

      // 自分画像を取得
      const imagesResponse = await authenticatedFetch(`/api/generate-self-image?userId=${user?.uid}`);
      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        setSelfImages(imagesData.selfImages || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('データの読み込みに失敗しました');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !user) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await authenticatedFetch('/api/chat-with-self', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...messages, userMessage],
          traits,
          userNickname: userProfile?.nickname,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading || isLoadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const canUse = traits.length >= 10;
  const avatarUrl = selfImages.length > 0 ? selfImages[0].squareImageUrl : null;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-warm">
      <div className="gradient-orb gradient-orb-orange absolute -right-40 top-20 h-96 w-96" />
      <div className="gradient-orb gradient-orb-yellow absolute -left-40 bottom-20 h-80 w-80" />

      <UserHeader />

      <div className="relative z-10 flex flex-1 flex-col px-4 py-4">
        <main className="mx-auto flex h-full w-full max-w-4xl flex-col">
          {/* ヘッダー */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-orange-200 shadow-md">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="自分AI"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-200 to-pink-200 text-2xl">
                    🤖
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  自分AIと話す
                </h1>
                <p className="text-xs text-gray-600">
                  特徴データ: {traits.length}個
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/output/create')}
              className="text-sm text-gray-500 underline decoration-orange-300 underline-offset-4 hover:text-orange-600"
            >
              戻る
            </button>
          </div>

          {/* 利用不可メッセージ */}
          {!canUse && (
            <div className="glass-card mb-4 rounded-2xl p-6 text-center">
              <p className="mb-4 text-gray-700">
                自分AIと話すには、特徴データが10個以上必要です
              </p>
              <p className="mb-4 text-2xl font-bold text-orange-600">
                現在: {traits.length} / 10 個
              </p>
              <button
                onClick={() => router.push('/interview/select-mode')}
                className="btn-gradient-primary rounded-xl px-6 py-3 font-semibold text-white shadow-md"
              >
                インタビューで特徴を増やす
              </button>
            </div>
          )}

          {/* チャットエリア */}
          {canUse && (
            <>
              <div className="glass-card mb-4 flex-1 overflow-y-auto rounded-2xl p-4">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                            : 'bg-white/90 text-gray-900 shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl bg-white/90 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: '0ms' }}></div>
                          <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: '150ms' }}></div>
                          <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* 入力エリア */}
              <div className="glass-card rounded-2xl p-4">
                {error && (
                  <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="メッセージを入力..."
                    disabled={isLoading}
                    className="flex-1 rounded-xl border border-orange-200 bg-white/80 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isLoading}
                    className="btn-gradient-primary flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
