'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { getRandomMetaphorQuestion, MetaphorQuestion } from '@/lib/metaphorQuestions';
import { Loader2 } from 'lucide-react';

export default function MetaphorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { traits } = useTraits();
  const [question, setQuestion] = useState<MetaphorQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [freeAnswer, setFreeAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  usePageHeader({ title: '自分を○○に例えると？' });

  useEffect(() => {
    const lastDate = localStorage.getItem('lastMetaphorDate');
    if (lastDate === new Date().toISOString().slice(0, 10)) {
      router.push('/dig');
      return;
    }
    setQuestion(getRandomMetaphorQuestion());
  }, [router]);

  const hasOptions = question?.options && question.options.length > 0;

  const isValid = hasOptions
    ? selected !== null && reason.length >= 5
    : freeAnswer.length >= 10;

  const handleSubmit = async () => {
    if (!question || !isValid || isSubmitting || !user) return;
    setIsSubmitting(true);
    setError('');

    localStorage.setItem('lastMetaphorDate', new Date().toISOString().slice(0, 10));

    const answerText = hasOptions
      ? `${selected}。理由：${reason}`
      : freeAnswer;

    try {
      const response = await authenticatedFetch('/api/daily-dig', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metaphor',
          question: question.question,
          answer: answerText,
          existingTraits: traits.map(t => ({ label: t.label })),
        }),
      });

      if (!response.ok) throw new Error('API error');
      const data = await response.json();

      sessionStorage.setItem('metaphor-result', JSON.stringify(data));
      router.push('/dig/metaphor/result');
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
          <p className="text-sm text-stone-500">今日のお題: {question.theme}</p>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-6">
          <p className="text-xl font-bold text-stone-800 leading-relaxed">
            {question.question}
          </p>
        </div>

        {hasOptions && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {question.options!.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelected(option)}
                  disabled={isSubmitting}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    selected === option
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-white/80 text-stone-600 border border-stone-200 hover:border-emerald-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasOptions ? (
          <div className="mb-2">
            <p className="mb-2 text-sm font-medium text-stone-600">{question.placeholder}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              placeholder="理由を教えてね"
              rows={2}
              className="glass-input w-full rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <div className="mb-2">
            <textarea
              value={freeAnswer}
              onChange={(e) => setFreeAnswer(e.target.value.slice(0, 200))}
              placeholder={question.placeholder}
              rows={3}
              className="glass-input w-full rounded-xl px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              disabled={isSubmitting}
            />
          </div>
        )}

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
