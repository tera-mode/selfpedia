'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage, SelfImage } from '@/types';
import { UserTrait } from '@/types/trait';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { VoiceToggle } from '@/components/voice/VoiceToggle';

export default function TalkWithSelfPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { traits, traitCount } = useTraits();

  const [selfImages, setSelfImages] = useState<SelfImage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText ?? inputText;
    if (!textToSend.trim() || isLoading || !user) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend,
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

      // TTS再生（音声モードONのときのみ）
      speakText(data.message);
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

  const { voiceState, isVoiceModeOn, setIsVoiceModeOn, startRecording, stopRecording, speakText } =
    useVoiceChat({
      interviewerId: 'self',
      onTranscript: (text) => {
        setInputText(text);
        handleSendMessage(text);
      },
    });

  usePageHeader({
    title: '自分AIと話す',
    showBackButton: true,
    onBack: () => router.push('/craft'),
    rightAction: <VoiceToggle isOn={isVoiceModeOn} onToggle={setIsVoiceModeOn} />,
  });

  useEffect(() => {
    if (user && !user.isAnonymous) {
      loadData();
    }
  }, [user]);

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

      if (traitCount >= 10) {
        const initialMessage: ChatMessage = {
          role: 'assistant',
          content: `こんにちは！わたしは、あなたの特徴を学んだAIです。あなた自身と対話するような感覚で、気軽に話しかけてくださいね。`,
          timestamp: new Date(),
        };
        setMessages([initialMessage]);
      }

      const imagesResponse = await authenticatedFetch(
        `/api/generate-self-image?userId=${user?.uid}`
      );
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-sm text-stone-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const canUse = traitCount >= 10;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
        {/* 利用不可メッセージ */}
        {!canUse && (
          <div className="glass-card mb-4 p-6 text-center">
            <p className="mb-4 text-stone-700">
              自分AIと話すには、特徴データが10個以上必要です
            </p>
            <p className="mb-4 text-2xl font-bold text-emerald-600">
              現在: {traitCount} / 10 個
            </p>
            <button
              onClick={() => router.push('/dig/interview/select-mode')}
              className="btn-gradient-primary rounded-xl px-6 py-3 font-semibold text-white"
            >
              インタビューで特徴を増やす
            </button>
          </div>
        )}

        {/* チャットエリア */}
        {canUse && (
          <>
            <div className="glass-card mb-4 flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white'
                          : 'bg-white/90 text-stone-800 shadow-sm'
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
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-sky-400"
                          style={{ animationDelay: '0ms' }}
                        ></div>
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-sky-400"
                          style={{ animationDelay: '150ms' }}
                        ></div>
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-sky-400"
                          style={{ animationDelay: '300ms' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 入力エリア */}
            <div className="glass-card p-4">
              {error && (
                <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>
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
                  className="flex-1 rounded-xl border border-sky-200 bg-white/80 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
                />
                {isVoiceModeOn && (
                  <VoiceButton
                    voiceState={voiceState}
                    onPressStart={startRecording}
                    onPressEnd={stopRecording}
                    disabled={isLoading}
                  />
                )}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isLoading}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
