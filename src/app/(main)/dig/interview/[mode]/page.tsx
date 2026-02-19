'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import Image from 'next/image';
import { getInterviewer } from '@/lib/interviewers';
import { getInterviewMode, isEndlessMode, getRandomQuestion } from '@/lib/interviewModes';
import { ChatMessage, InterviewerId, InterviewMode, UserTrait } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { TraitCardList, TraitCardCollapsible } from '@/components/interview';
import { useTraitExtraction } from '@/hooks/useTraitExtraction';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { VoiceToggle } from '@/components/voice/VoiceToggle';

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
  const interviewIdRef = useRef<string | null>(null);

  // 抽出完了時にtraitsを保存するコールバック
  const handleTraitsChanged = useCallback((allTraits: UserTrait[]) => {
    const id = interviewIdRef.current;
    if (id && allTraits.length > 0) {
      fetch('/api/save-traits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: id, traits: allTraits }),
      }).catch(console.error);
    }
  }, []);

  const { traits, newTraitIds, updatedTraitIds, isExtracting, extractTraits } = useTraitExtraction({
    onTraitsChanged: handleTraitsChanged,
  });

  const interviewer = interviewerId ? getInterviewer(interviewerId) : null;
  const modeConfig = getInterviewMode(mode);
  const isEndless = isEndlessMode(mode);

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
      if (!currentInterviewId) {
        setCurrentInterviewId(saveResult.interviewId);
        interviewIdRef.current = saveResult.interviewId;
      }

      if (status === 'completed') {
        const traitsToSave = currentTraits || traits;
        if (traitsToSave.length > 0) {
          await fetch('/api/save-traits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interviewId: saveResult.interviewId, traits: traitsToSave }),
          });
        }
      }

      return saveResult.interviewId;
    } catch (error) {
      console.error('Error saving interview:', error);
      throw error;
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
      setTimeout(() => router.push('/craft'), 2000);
    } catch {
      alert('インタビューの保存に失敗しました。もう一度お試しください。');
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText ?? inputText;
    if (!textToSend.trim() || isLoading || !interviewerId) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
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
          userProfile: {
            nickname: userNickname,
            ...(userProfile?.occupation ? { occupation: userProfile.occupation } : {}),
          },
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

      // TTS再生（音声モードONのときのみ）
      speakText(data.message);

      if (!data.isCompleted) {
        const recentContext = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        extractTraits(textToSend, data.message, messages.length + 1, recentContext);
      }

      if (data.isCompleted) {
        await handleInterviewComplete(updatedMessages, data.interviewData);
      } else {
        saveInterview(updatedMessages, null, 'in_progress').catch(console.error);
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

  const { voiceState, isVoiceModeOn, setIsVoiceModeOn, startRecording, stopRecording, speakText } =
    useVoiceChat({
      interviewerId: interviewerId || 'female_01',
      onTranscript: (text) => {
        setInputText(text);
        handleSendMessage(text);
      },
    });

  usePageHeader({
    title: 'AIインタビュー',
    showBackButton: true,
    onBack: () => router.push('/dig'),
    rightAction: modeConfig ? (
      <div className="flex items-center gap-2">
        <VoiceToggle isOn={isVoiceModeOn} onToggle={setIsVoiceModeOn} />
        <span className="text-lg">{modeConfig.icon}</span>
        <span className="text-sm font-medium text-stone-700">{modeConfig.name}</span>
        {isEndless && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-600">
            エンドレス
          </span>
        )}
      </div>
    ) : undefined,
  });

  useEffect(() => {
    if (!modeConfig) {
      router.push('/dig/interview/select-mode');
      return;
    }

    const guestSessionId = Cookies.get('guest_session_id');
    const selectedInterviewer = Cookies.get('selected_interviewer') as InterviewerId;
    const savedName = Cookies.get('interviewer_name');

    if (!guestSessionId || !selectedInterviewer || !savedName) {
      router.push('/dig/interview/select-interviewer');
      return;
    }

    setInterviewerId(selectedInterviewer);
    setInterviewerName(savedName);

    const customization = Cookies.get('interviewer_customization') || '';
    const greetingStyle = getGreetingStyle(customization);

    const nickname = userProfile?.nickname || user?.displayName || 'ゲスト';
    setUserNickname(nickname);

    const firstQuestion = userProfile?.occupation
      ? (getRandomQuestion(mode, 'iceBreak') || '最近ハマってることってありますか？')
      : '普段はどんなことして過ごしてますか？お仕事とか学校とか、なんでも教えてください！';

    const initialMessage: ChatMessage = {
      role: 'assistant',
      content: greetingStyle.hasCustom
        ? `${greetingStyle.greeting}${nickname}さん${greetingStyle.suffix} 私は${savedName}です${greetingStyle.suffix} 今日は「${modeConfig.name}」モードで、${nickname}さんの魅力をたくさん引き出していきますね${greetingStyle.suffix}\n\n${firstQuestion}`
        : `こんにちは、${nickname}さん！私は${savedName}です。今日は「${modeConfig.name}」モードで、${nickname}さんの魅力をたくさん引き出していきますね。\n\n${firstQuestion}`,
      timestamp: new Date(),
    };
    setMessages([initialMessage]);
  }, [router, mode, modeConfig, userProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading && !isCompleted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isCompleted]);

  const getGreetingStyle = (customization: string): { hasCustom: boolean; greeting: string; suffix: string } => {
    if (!customization) return { hasCustom: false, greeting: 'こんにちは', suffix: '。' };
    const lower = customization.toLowerCase();
    if (lower.includes('元気') || lower.includes('明るい') || lower.includes('テンション高')) {
      return { hasCustom: true, greeting: 'やっほー！', suffix: '！' };
    }
    if (lower.includes('落ち着') || lower.includes('穏やか') || lower.includes('優しい') || lower.includes('丁寧')) {
      return { hasCustom: true, greeting: 'こんにちは、', suffix: '。' };
    }
    if (lower.includes('フレンドリー') || lower.includes('カジュアル') || lower.includes('親しみ')) {
      return { hasCustom: true, greeting: 'こんにちは〜！', suffix: '！' };
    }
    if (lower.includes('クール') || lower.includes('知的') || lower.includes('大人')) {
      return { hasCustom: true, greeting: 'こんにちは、', suffix: '。' };
    }
    return { hasCustom: true, greeting: 'こんにちは！', suffix: '！' };
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!interviewer || !modeConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 spinner-warm"></div>
          <p className="text-stone-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-52px)] flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={interviewer.gender === '女性' ? '/image/lady-interviewer.png' : '/image/man-interviewer.png'}
          alt="背景"
          fill
          className="object-cover opacity-15"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/90 via-teal-50/80 to-emerald-100/90" />
      </div>

      {/* SP: Collapsible traits */}
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

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Messages */}
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
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-200 shadow-md">
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
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-200 shadow-md">
                  <Image
                    src={interviewer.gender === '女性' ? '/image/icon_lady-interviewer.png' : '/image/icon_man-interviewer.png'}
                    alt="インタビュワー"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="chat-bubble-assistant max-w-[70%] rounded-2xl px-5 py-3">
                  <div className="flex gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: '0.1s' }}></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* PC: Side panel */}
        {isDesktop && (
          <TraitCardList
            traits={traits}
            newTraitIds={newTraitIds}
            updatedTraitIds={updatedTraitIds}
            isLoading={isExtracting}
          />
        )}
      </div>

      {/* Input area */}
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
            className="glass-input flex-1 rounded-full px-5 py-3 focus:ring-2 focus:ring-emerald-300 focus:outline-none disabled:bg-stone-100 disabled:opacity-60"
          />
          {isVoiceModeOn && (
            <VoiceButton
              voiceState={voiceState}
              onPressStart={startRecording}
              onPressEnd={stopRecording}
              disabled={isLoading || isCompleted}
            />
          )}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading || isCompleted}
            className="btn-gradient-primary rounded-full px-6 py-3 font-semibold text-white shadow-md disabled:opacity-50"
          >
            送信
          </button>
          {isEndless && !isCompleted && (
            <button
              onClick={() => setShowEndConfirm(true)}
              disabled={isLoading || messages.length < 5}
              className="rounded-full border-2 border-emerald-300 bg-white/80 px-4 py-3 font-semibold text-emerald-600 shadow-md transition-all hover:bg-emerald-50 disabled:opacity-50"
            >
              終了
            </button>
          )}
        </div>
      </div>

      {/* End confirmation modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="glass-modal w-full max-w-md rounded-3xl p-6">
            <h2 className="mb-4 text-center text-xl font-bold text-stone-800">
              インタビューを終了しますか？
            </h2>
            <p className="mb-6 text-center text-sm text-stone-500">
              終了すると、これまでの会話内容をもとに結果が生成されます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 font-semibold text-stone-700 transition-all hover:bg-emerald-50"
              >
                続ける
              </button>
              <button
                onClick={async () => {
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
                        userProfile: {
                          nickname: userNickname,
                          ...(userProfile?.occupation ? { occupation: userProfile.occupation } : {}),
                        },
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
                }}
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
