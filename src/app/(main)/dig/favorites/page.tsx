'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { getRandomFavoritesQuestion, FavoritesQuestion } from '@/lib/favoritesQuestions';
import { Loader2 } from 'lucide-react';

export default function FavoritesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { traits } = useTraits();
  const [question, setQuestion] = useState<FavoritesQuestion | null>(null);
  const [favorite, setFavorite] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  usePageHeader({ title: 'あなたの好きな○○' });

  useEffect(() => {
    const lastDate = localStorage.getItem('lastFavoritesDate');
    if (lastDate === new Date().toISOString().slice(0, 10)) {
      router.push('/dig');
      return;
    }
    setQuestion(getRandomFavoritesQuestion());
  }, [router]);

  const isValid = favorite.length >= 1 && reason.length >= 5;

  const handleSubmit = async () => {
    if (!question || !isValid || isSubmitting || !user) return;
    setIsSubmitting(true);
    setError('');

    localStorage.setItem('lastFavoritesDate', new Date().toISOString().slice(0, 10));

    const answerText = `${favorite}。理由：${reason}`;

    try {
      const response = await authenticatedFetch('/api/daily-dig', {
        method: 'POST',
        body: JSON.stringify({
          type: 'favorites',
          question: question.question,
          answer: answerText,
          existingTraits: traits.map(t => ({ label: t.label })),
        }),
      });

      if (!response.ok) throw new Error('API error');
      const data = await response.json();

      sessionStorage.setItem('favorites-result', JSON.stringify(data));
      router.push('/dig/favorites/result');
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
          <div className="mb-2 text-4xl">{question.icon}</div>
          <p className="text-sm text-stone-500">今日のテーマ: {question.theme}</p>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-6">
          <p className="text-xl font-bold text-stone-800 leading-relaxed">
            {question.question}
          </p>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={favorite}
            onChange={(e) => setFavorite(e.target.value.slice(0, 50))}
            placeholder={question.placeholder}
            className="glass-input w-full rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-2">
          <p className="mb-2 text-sm font-medium text-stone-600">{question.reasonPlaceholder}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="理由を教えてね"
            rows={3}
            className="glass-input w-full rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <p className="mb-4 text-center text-sm text-red-500">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
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
