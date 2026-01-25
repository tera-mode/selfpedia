'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import Image from 'next/image';
import { getInterviewer } from '@/lib/interviewers';
import { ChatMessage, InterviewerId } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';
import { TraitCardList, TraitCardCollapsible } from '@/components/interview';
import { useTraitExtraction } from '@/hooks/useTraitExtraction';
import { useIsDesktop } from '@/hooks/useMediaQuery';

export default function Interview() {
  const router = useRouter();
  const { user } = useAuth();
  const [interviewerId, setInterviewerId] = useState<InterviewerId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [interviewerName, setInterviewerName] = useState<string>('');
  const [userNickname, setUserNickname] = useState<string>(''); // ユーザーの呼び名
  const [currentInterviewId, setCurrentInterviewId] = useState<string | null>(null); // 現在のインタビューID
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useIsDesktop();
  const { traits, newTraitIds, updatedTraitIds, isExtracting, extractTraits } = useTraitExtraction();

  const interviewer = interviewerId ? getInterviewer(interviewerId) : null;

  useEffect(() => {
    // セッションとインタビュワーを確認
    const guestSessionId = Cookies.get('guest_session_id');
    const selectedInterviewer = Cookies.get('selected_interviewer') as InterviewerId;
    const savedName = Cookies.get('interviewer_name');

    if (!guestSessionId || !selectedInterviewer || !savedName) {
      // 必要な情報がない場合はインタビュワー選択ページへ
      router.push('/select-interviewer');
      return;
    }

    console.log('Interview initialized. User:', user ? user.uid : 'not yet loaded');

    setInterviewerId(selectedInterviewer);
    setInterviewerName(savedName);

    // 最初のメッセージ（ユーザーの呼び名を聞く）
    const initialMessage: ChatMessage = {
      role: 'assistant',
      content: `こんにちは！私は${savedName}です。今日はあなたのことをたくさん教えてください。まず、あなたのことをなんて呼んだらいいですか？`,
      timestamp: new Date(),
    };

    setMessages([initialMessage]);
  }, [router, user]);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ローディング完了後に入力欄にフォーカス
  useEffect(() => {
    if (!isLoading && !isCompleted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, isCompleted]);

  // インタビューデータを保存する関数
  const saveInterview = async (
    updatedMessages: ChatMessage[],
    interviewData: { fixed?: Record<string, unknown>; dynamic?: Record<string, unknown> } | null,
    status: 'in_progress' | 'completed'
  ) => {
    try {
      const saveResponse = await fetch('/api/save-interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid,
          interviewData: interviewData,
          messages: updatedMessages,
          interviewerId: interviewerId,
          sessionId: Cookies.get('guest_session_id'),
          interviewId: currentInterviewId, // 既存のIDがあれば更新
          status: status,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save interview');
      }

      const saveResult = await saveResponse.json();

      // 初回保存時はIDを保存
      if (!currentInterviewId) {
        setCurrentInterviewId(saveResult.interviewId);
      }

      console.log('Interview saved:', saveResult.interviewId, 'status:', status);
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
      // APIにメッセージを送信
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          interviewerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      const updatedMessages = [...messages, userMessage, assistantMessage];

      // ユーザーの呼び名が抽出されたら保存
      if (data.extractedNickname && !userNickname) {
        setUserNickname(data.extractedNickname);
      }

      // 特徴抽出（完了前のみ）
      if (!data.isCompleted) {
        extractTraits(
          currentInput,
          data.message,
          messages.length + 1 // 現在のメッセージインデックス
        );
      }

      // インタビュー完了チェック
      if (data.isCompleted) {
        setIsCompleted(true);

        console.log('Interview completed! Data:', data.interviewData);

        // interviewDataの構造を拡張（fixed + dynamic）
        const interviewDataToSave = {
          fixed: {
            nickname: data.interviewData.nickname,
            occupation: data.interviewData.occupation,
            selectedInterviewer: interviewerId,
          },
          dynamic: data.interviewData.dynamic || {},
        };

        try {
          const savedInterviewId = await saveInterview(updatedMessages, interviewDataToSave, 'completed');

          // 特徴カードを保存
          if (traits.length > 0) {
            try {
              await fetch('/api/save-traits', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  interviewId: savedInterviewId,
                  traits: traits,
                }),
              });
              console.log('Traits saved to Firestore');
            } catch (traitError) {
              console.error('Error saving traits:', traitError);
            }
          }

          // 保存成功後、結果ページへ遷移
          setTimeout(() => {
            router.push(`/result?id=${savedInterviewId}`);
          }, 2000);
        } catch (error) {
          alert('インタビューの保存に失敗しました。もう一度お試しください。');
        }
      } else {
        // 進行中のインタビューを都度保存（バックグラウンドで実行）
        saveInterview(updatedMessages, null, 'in_progress').catch((error) => {
          console.error('Background save failed:', error);
        });
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!interviewer) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-purple-50 to-white">
      {/* ユーザーヘッダー */}
      <UserHeader showHomeButton={false} userNickname={userNickname} />

      {/* ステータスバー */}
      {isCompleted && (
        <div className="border-b bg-green-50 px-4 py-3">
          <div className="mx-auto max-w-4xl text-center">
            <span className="text-sm font-semibold text-green-700">
              ✓ インタビュー完了
            </span>
          </div>
        </div>
      )}

      {/* SP版: 折りたたみパネル */}
      {!isDesktop && (
        <TraitCardCollapsible
          traits={traits}
          newTraitIds={newTraitIds}
          updatedTraitIds={updatedTraitIds}
          isLoading={isExtracting}
        />
      )}

      {/* メインコンテンツ（PC版は横並び） */}
      <div className="flex flex-1 overflow-hidden">
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
              {message.role === 'assistant' && interviewer && (
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
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
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
            </div>
          ))}
          {isLoading && interviewer && (
            <div className="flex items-start gap-3 justify-start">
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
                <Image
                  src={interviewer.gender === '女性' ? '/image/icon_lady-interviewer.png' : '/image/icon_man-interviewer.png'}
                  alt="インタビュワー"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="max-w-[70%] rounded-2xl bg-white px-5 py-3 shadow-sm">
                <div className="flex gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
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
      <div className="border-t bg-white px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isCompleted
                ? 'インタビューは完了しました'
                : 'メッセージを入力...'
            }
            disabled={isLoading || isCompleted}
            className="flex-1 rounded-full border border-gray-300 px-5 py-3 focus:border-purple-500 focus:outline-none disabled:bg-gray-100"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || isCompleted}
            className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:bg-gray-300"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
