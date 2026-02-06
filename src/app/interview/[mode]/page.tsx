'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import Image from 'next/image';
import { getInterviewer } from '@/lib/interviewers';
import { getInterviewMode, isEndlessMode, getRandomQuestion } from '@/lib/interviewModes';
import { ChatMessage, InterviewerId, InterviewMode } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import { TraitCardList, TraitCardCollapsible } from '@/components/interview';
import { useTraitExtraction } from '@/hooks/useTraitExtraction';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const mode = params.mode as InterviewMode;
  const { user, userProfile } = useAuth();

  const [interviewerId, setInterviewerId] = useState<InterviewerId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [interviewerName, setInterviewerName] = useState<string>('');
  const [userNickname, setUserNickname] = useState<string>('');
  const [currentInterviewId, setCurrentInterviewId] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useIsDesktop();
  const { traits, newTraitIds, updatedTraitIds, isExtracting, extractTraits } = useTraitExtraction();

  const interviewer = interviewerId ? getInterviewer(interviewerId) : null;
  const modeConfig = getInterviewMode(mode);
  const isEndless = isEndlessMode(mode);

  useEffect(() => {
    // モードの検証
    if (!modeConfig) {
      router.push('/interview/select-mode');
      return;
    }

    // セッションとインタビュワーを確認
    const guestSessionId = Cookies.get('guest_session_id');
    const selectedInterviewer = Cookies.get('selected_interviewer') as InterviewerId;
    const savedName = Cookies.get('interviewer_name');

    if (!guestSessionId || !selectedInterviewer || !savedName) {
      router.push('/interview/select-interviewer');
      return;
    }

    setInterviewerId(selectedInterviewer);
    setInterviewerName(savedName);

    // カスタム性格から挨拶スタイルを決定
    const customization = Cookies.get('interviewer_customization') || '';
    const greetingStyle = getGreetingStyle(customization);

    // userProfileがある場合は、アイスブレイク質問から開始
    if (userProfile?.nickname && userProfile?.occupation) {
      setUserNickname(userProfile.nickname);
      const iceBreakQuestion = getRandomQuestion(mode, 'iceBreak') || '最近ハマってることってありますか？';

      const initialMessage: ChatMessage = {
        role: 'assistant',
        content: greetingStyle.hasCustom
          ? `${greetingStyle.greeting}${userProfile.nickname}さん${greetingStyle.suffix} 私は${savedName}です${greetingStyle.suffix} 今日は「${modeConfig.name}」モードで、${userProfile.nickname}さんの魅力をたくさん引き出していきますね${greetingStyle.suffix}\n\n${iceBreakQuestion}`
          : `こんにちは、${userProfile.nickname}さん！私は${savedName}です。今日は「${modeConfig.name}」モードで、${userProfile.nickname}さんの魅力をたくさん引き出していきますね。\n\n${iceBreakQuestion}`,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
    } else {
      // プロフィールがない場合
      const initialMessage: ChatMessage = {
        role: 'assistant',
        content: greetingStyle.hasCustom
          ? `${greetingStyle.greeting} 私は${savedName}です${greetingStyle.suffix} 今日は「${modeConfig.name}」モードであなたのことをたくさん教えてください${greetingStyle.suffix} まず、あなたのことをなんて呼んだらいいですか？`
          : `こんにちは！私は${savedName}です。今日は「${modeConfig.name}」モードであなたのことをたくさん教えてください。まず、あなたのことをなんて呼んだらいいですか？`,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
    }
  }, [router, mode, modeConfig, userProfile]);

  // カスタム性格から挨拶スタイルを決定するヘルパー
  const getGreetingStyle = (customization: string): { hasCustom: boolean; greeting: string; suffix: string } => {
    if (!customization) return { hasCustom: false, greeting: 'こんにちは', suffix: '。' };

    const lower = customization.toLowerCase();

    // 元気・明るい系
    if (lower.includes('元気') || lower.includes('明るい') || lower.includes('テンション高')) {
      return { hasCustom: true, greeting: 'やっほー！', suffix: '！' };
    }
    // 落ち着いた・穏やか系
    if (lower.includes('落ち着') || lower.includes('穏やか') || lower.includes('優しい') || lower.includes('丁寧')) {
      return { hasCustom: true, greeting: 'こんにちは、', suffix: '。' };
    }
    // フレンドリー・カジュアル系
    if (lower.includes('フレンドリー') || lower.includes('カジュアル') || lower.includes('親しみ')) {
      return { hasCustom: true, greeting: 'こんにちは〜！', suffix: '！' };
    }
    // クール系
    if (lower.includes('クール') || lower.includes('知的') || lower.includes('大人')) {
      return { hasCustom: true, greeting: 'こんにちは、', suffix: '。' };
    }

    // デフォルト（カスタムありだけど特定パターンなし）
    return { hasCustom: true, greeting: 'こんにちは！', suffix: '！' };
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading && !isCompleted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isCompleted]);

  const saveInterview = async (
    updatedMessages: ChatMessage[],
    interviewData: { fixed?: Record<string, unknown>; dynamic?: Record<string, unknown> } | null,
    status: 'in_progress' | 'completed',
    currentTraits?: typeof traits
  ) => {
    try {
      const saveResponse = await authenticatedFetch('/api/save-interview', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.uid,
          interviewData: interviewData,
          messages: updatedMessages,
          interviewerId: interviewerId,
          mode: mode,
          sessionId: Cookies.get('guest_session_id'),
          interviewId: currentInterviewId,
          status: status,
        }),
      });

      if (!saveResponse.ok) throw new Error('Failed to save interview');

      const saveResult = await saveResponse.json();
      if (!currentInterviewId) setCurrentInterviewId(saveResult.interviewId);

      // 特徴も一緒に保存（途中保存時も含む）
      const traitsToSave = currentTraits || traits;
      if (traitsToSave.length > 0) {
        await fetch('/api/save-traits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewId: saveResult.interviewId, traits: traitsToSave }),
        });
      }

      return saveResult.interviewId;
    } catch (error) {
      console.error('Error saving interview:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !interviewerId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      const interviewerCustomization = Cookies.get('interviewer_customization');
      const response = await authenticatedFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...messages, userMessage],
          interviewerId,
          mode,
          userProfile: userProfile?.nickname && userProfile?.occupation
            ? { nickname: userProfile.nickname, occupation: userProfile.occupation }
            : undefined,
          interviewerCustomization: interviewerCustomization || undefined,
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
      const updatedMessages = [...messages, userMessage, assistantMessage];

      if (data.extractedNickname && !userNickname) {
        setUserNickname(data.extractedNickname);
      }

      if (!data.isCompleted) {
        extractTraits(currentInput, data.message, messages.length + 1);
      }

      if (data.isCompleted) {
        await handleInterviewComplete(updatedMessages, data.interviewData);
      } else {
        saveInterview(updatedMessages, null, 'in_progress', traits).catch(console.error);
      }
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

  const handleInterviewComplete = async (
    updatedMessages: ChatMessage[],
    interviewData: { nickname: string; occupation: string; dynamic: Record<string, unknown> }
  ) => {
    setIsCompleted(true);

    const interviewDataToSave = {
      fixed: {
        nickname: interviewData.nickname,
        occupation: interviewData.occupation,
        selectedInterviewer: interviewerId,
      },
      dynamic: interviewData.dynamic || {},
    };

    try {
      await saveInterview(updatedMessages, interviewDataToSave, 'completed', traits);
      setTimeout(() => router.push('/output/create'), 2000);
    } catch {
      alert('インタビューの保存に失敗しました。もう一度お試しください。');
    }
  };

  const handleEndInterview = async () => {
    if (!interviewerId) return;
    setShowEndConfirm(false);
    setIsLoading(true);

    try {
      const interviewerCustomization = Cookies.get('interviewer_customization');
      const response = await authenticatedFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          interviewerId,
          mode,
          forceComplete: true,
          userProfile: userProfile?.nickname && userProfile?.occupation
            ? { nickname: userProfile.nickname, occupation: userProfile.occupation }
            : undefined,
          interviewerCustomization: interviewerCustomization || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to end interview');

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      const updatedMessages = [...messages, assistantMessage];

      await handleInterviewComplete(updatedMessages, data.interviewData);
    } catch (error) {
      console.error('Error ending interview:', error);
      alert('インタビューの終了に失敗しました。もう一度お試しください。');
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

  if (!interviewer || !modeConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* 背景画像 */}
      <div className="absolute inset-0 z-0">
        <Image
          src={interviewer.gender === '女性' ? '/image/lady-interviewer.png' : '/image/man-interviewer.png'}
          alt="背景"
          fill
          className="object-cover opacity-20"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/90 via-amber-50/80 to-orange-100/90" />
      </div>

      {/* ユーザーヘッダー */}
      <div className="relative z-10">
        <UserHeader showHomeButton={true} userNickname={userNickname} showInterviewStatus={true} />
      </div>

      {/* モード表示バー */}
      <div className="relative z-10 glass border-b border-orange-200 px-4 py-2">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{modeConfig.icon}</span>
            <span className="text-sm font-medium text-gray-700">{modeConfig.name}</span>
            {isEndless && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-600">
                エンドレス
              </span>
            )}
          </div>
          {isCompleted && (
            <span className="text-sm font-semibold text-green-700">✓ 完了</span>
          )}
        </div>
      </div>

      {/* SP版: 折りたたみパネル */}
      {!isDesktop && (
        <div className="relative z-10">
          <TraitCardCollapsible
            traits={traits}
            newTraitIds={newTraitIds}
            updatedTraitIds={updatedTraitIds}
            isLoading={isExtracting}
          />
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-orange-200 shadow-md">
                    <Image
                      src={interviewer.gender === '女性' ? '/image/icon_lady-interviewer.png' : '/image/icon_man-interviewer.png'}
                      alt="インタビュワー"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-5 py-3 ${
                    message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3 justify-start">
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-orange-200 shadow-md">
                  <Image
                    src={interviewer.gender === '女性' ? '/image/icon_lady-interviewer.png' : '/image/icon_man-interviewer.png'}
                    alt="インタビュワー"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="chat-bubble-assistant max-w-[70%] rounded-2xl px-5 py-3">
                  <div className="flex gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: '0.1s' }}></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-orange-400" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* PC版: サイドパネル */}
        {isDesktop && (
          <TraitCardList
            traits={traits}
            newTraitIds={newTraitIds}
            updatedTraitIds={updatedTraitIds}
            isLoading={isExtracting}
          />
        )}
      </div>

      {/* 入力エリア */}
      <div className="glass-header relative z-20 px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isCompleted ? 'インタビューは完了しました' : 'メッセージを入力...'}
            disabled={isLoading || isCompleted}
            className="glass-input flex-1 rounded-full px-5 py-3 focus:ring-2 focus:ring-orange-300 focus:outline-none disabled:bg-gray-100 disabled:opacity-60"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || isCompleted}
            className="btn-gradient-primary rounded-full px-6 py-3 font-semibold text-white shadow-md disabled:opacity-50"
          >
            送信
          </button>
          {isEndless && !isCompleted && (
            <button
              onClick={() => setShowEndConfirm(true)}
              disabled={isLoading || messages.length < 5}
              className="rounded-full border-2 border-orange-300 bg-white/80 px-4 py-3 font-semibold text-orange-600 shadow-md transition-all hover:bg-orange-50 disabled:opacity-50"
            >
              終了
            </button>
          )}
        </div>
      </div>

      {/* 終了確認モーダル */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="glass-modal w-full max-w-md rounded-3xl p-6">
            <h2 className="mb-4 text-center text-xl font-bold text-gray-900">
              インタビューを終了しますか？
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              終了すると、これまでの会話内容をもとに結果が生成されます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-xl border border-orange-200 bg-white/80 px-4 py-3 font-semibold text-gray-700 transition-all hover:bg-orange-50"
              >
                続ける
              </button>
              <button
                onClick={handleEndInterview}
                className="btn-gradient-primary flex-1 rounded-xl px-4 py-3 font-semibold text-white shadow-md"
              >
                終了する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
