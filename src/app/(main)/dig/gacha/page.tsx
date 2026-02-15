'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { getRandomGachaQuestion, GachaQuestion } from '@/lib/gachaQuestions';
import { Loader2 } from 'lucide-react';

export default function GachaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { traits } = useTraits();
  const [question, setQuestion] = useState<GachaQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  usePageHeader({ title: 'ガチャ質問' });

  useEffect(() => {
    const lastDate = localStorage.getItem('lastGachaDate');
    if (lastDate === new Date().toISOString().slice(0, 10)) {
      router.push('/dig');
      return;
    }
    setQuestion(getRandomGachaQuestion());
  }, [router]);

  const handleSubmit = async () => {
    if (!question || answer.length < 10 || isSubmitting || !user) return;
    setIsSubmitting(true);
    setError('');

    localStorage.setItem('lastGachaDate', new Date().toISOString().slice(0, 10));

    try {
      const response = await authenticatedFetch('/api/daily-dig', {
        method: 'POST',
        body: JSON.stringify({
          type: 'gacha',
          question: question.question,
          answer,
          existingTraits: traits.map(t => ({ label: t.label })),
        }),
      });

      if (!response.ok) throw new Error('API error');
      const data = await response.json();

      sessionStorage.setItem('gacha-result', JSON.stringify(data));
      router.push('/dig/gacha/result');
    } catch {
      setError('分析に失敗しました。もう一度お試しください。');
      setIsSubmitting(false);
    }
  };

  if (!question) return null;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🎰</div>
          <h2 className="text-lg font-bold text-stone-800">今日の質問</h2>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-6">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 mb-3">
            {question.category}
          </span>
          <p className="text-xl font-bold text-stone-800 leading-relaxed">
            {question.question}
          </p>
        </div>

        <div className="mb-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, 200))}
            placeholder={question.placeholder}
            rows={3}
            className="glass-input w-full rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-right text-xs text-stone-400">{answer.length}/200</p>
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-red-500">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={answer.length < 10 || isSubmitting}
          className="btn-gradient-primary w-full rounded-xl py-3 font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              あなたの回答を分析中...
            </>
          ) : (
            '回答する'
          )}
        </button>
      </div>
    </div>
  );
}
