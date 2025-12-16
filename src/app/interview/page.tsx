'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import Image from 'next/image';
import { getInterviewer } from '@/lib/interviewers';
import { ChatMessage, InterviewerId } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import UserHeader from '@/components/UserHeader';

export default function Interview() {
  const router = useRouter();
  const { user } = useAuth();
  const [interviewerId, setInterviewerId] = useState<InterviewerId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [interviewerName, setInterviewerName] = useState<string>('');
  const [isNamingPhase, setIsNamingPhase] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const interviewer = interviewerId ? getInterviewer(interviewerId) : null;

  useEffect(() => {
    // セッションとインタビュワーを確認
    const guestSessionId = Cookies.get('guest_session_id');
    const selectedInterviewer = Cookies.get('selected_interviewer') as InterviewerId;

    if (!guestSessionId || !selectedInterviewer) {
      router.push('/');
      return;
    }

    console.log('Interview initialized. User:', user ? user.uid : 'not yet loaded');

    setInterviewerId(selectedInterviewer);

    // 保存されているインタビュワー名をチェック
    const savedName = Cookies.get('interviewer_name');

    let initialMessage: ChatMessage;
    if (savedName) {
      // すでに名前がある場合
      setInterviewerName(savedName);
      setIsNamingPhase(false);
      initialMessage = {
        role: 'assistant',
        content: `こんにちは！私は${savedName}です。今日はあなたのことをたくさん教えてください。まず、お名前を教えていただけますか？`,
        timestamp: new Date(),
      };
    } else {
      // 初回の場合は名前をつけてもらう
      initialMessage = {
        role: 'assistant',
        content: 'こんにちは！まず、私に名前を付けてください。どんな名前で呼んでほしいですか？',
        timestamp: new Date(),
      };
    }

    setMessages([initialMessage]);
  }, [router, user]);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // 名前付けフェーズの処理
    if (isNamingPhase) {
      const name = currentInput.trim();
      setInterviewerName(name);
      setIsNamingPhase(false);

      // Cookieに保存（365日）
      Cookies.set('interviewer_name', name, { expires: 365, path: '/' });

      // Firestoreにも保存（ログインユーザーの場合）
      if (user && !user.isAnonymous) {
        try {
          await fetch('/api/save-interviewer-name', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.uid,
              interviewerName: name,
            }),
          });
        } catch (error) {
          console.error('Failed to save interviewer name:', error);
        }
      }

      const responseMessage: ChatMessage = {
        role: 'assistant',
        content: `ありがとうございます！これから私は${name}としてインタビューさせていただきます。それでは、あなたのお名前を教えていただけますか？`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, responseMessage]);
      setIsLoading(false);
      return;
    }

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

      // インタビュー完了チェック
      if (data.isCompleted) {
        setIsCompleted(true);
        const updatedMessages = [...messages, userMessage, assistantMessage];

        console.log('Interview completed! Data:', data.interviewData);

        // interviewDataの構造を拡張（fixed + dynamic）
        const interviewDataToSave = {
          fixed: {
            name: data.interviewData.name,
            nickname: data.interviewData.nickname,
            gender: data.interviewData.gender,
            age: data.interviewData.age,
            location: data.interviewData.location,
            occupation: data.interviewData.occupation,
            occupationDetail: data.interviewData.occupationDetail,
            selectedInterviewer: interviewerId,
          },
          dynamic: data.interviewData.dynamic || {}, // DynamicDataを含める
        };

        console.log('Saving to Firestore immediately...');

        // Firestoreに直接保存
        try {
          const saveResponse = await fetch('/api/save-interview', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user?.uid,
              interviewData: interviewDataToSave,
              messages: updatedMessages,
              interviewerId: interviewerId,
              sessionId: Cookies.get('guest_session_id'),
            }),
          });

          if (!saveResponse.ok) {
            throw new Error('Failed to save interview');
          }

          const saveResult = await saveResponse.json();
          console.log('Interview saved to Firestore:', saveResult.interviewId);

          // 保存成功後、結果ページへ遷移（IDをURLパラメータとして渡す）
          setTimeout(() => {
            router.push(`/result?id=${saveResult.interviewId}`);
          }, 2000);
        } catch (error) {
          console.error('Error saving interview:', error);
          alert('インタビューの保存に失敗しました。もう一度お試しください。');
        }
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
      <UserHeader showHomeButton={false} />

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

      {/* 入力エリア */}
      <div className="border-t bg-white px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl gap-2">
          <input
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
