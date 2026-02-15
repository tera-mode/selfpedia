'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { UserTrait } from '@/types';
import { TraitCard } from '@/components/interview';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { Sparkles, User } from 'lucide-react';

interface GachaResult {
  traits: UserTrait[];
  comment: string;
}

export default function GachaResultPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshTraits } = useTraits();
  const [result, setResult] = useState<GachaResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  usePageHeader({ title: '診断結果' });

  useEffect(() => {
    const stored = sessionStorage.getItem('gacha-result');
    if (!stored) {
      router.push('/dig/gacha');
      return;
    }
    const data = JSON.parse(stored) as GachaResult;
    setResult(data);

    if (data.traits.length > 0 && user) {
      saveTraits(data.traits);
    }
  }, [user]);

  const saveTraits = async (traits: UserTrait[]) => {
    if (isSaving || saved || !user) return;
    setIsSaving(true);
    try {
      const saveResponse = await authenticatedFetch('/api/save-interview', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          interviewData: { fixed: {}, dynamic: {} },
          messages: [{ role: 'assistant', content: 'ガチャ質問', timestamp: new Date() }],
          interviewerId: 'female_01',
          mode: 'basic',
          sessionId: `gacha-${Date.now()}`,
          status: 'completed',
        }),
      });

      if (!saveResponse.ok) throw new Error('Failed to create interview');
      const { interviewId } = await saveResponse.json();

      const traitResponse = await fetch('/api/save-traits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, traits }),
      });

      if (traitResponse.ok) {
        setSaved(true);
        await refreshTraits();
      }
    } catch (error) {
      console.error('Error saving gacha traits:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!result) return null;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">✨</div>
          <h2 className="text-2xl font-bold text-stone-800">新しい特徴を発見！</h2>
          {result.comment && (
            <p className="mt-3 text-sm text-stone-600 glass-card rounded-xl px-4 py-3 inline-block">
              {result.comment}
            </p>
          )}
        </div>

        <div className="space-y-4 mb-8">
          {result.traits.map((trait, index) => (
            <div
              key={trait.id}
              className="animate-scale-in"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <TraitCard trait={trait} size="full" isNew />
            </div>
          ))}
        </div>

        {isSaving && (
          <p className="mb-4 text-center text-sm text-stone-500">特徴を保存中...</p>
        )}
        {saved && (
          <p className="mb-4 text-center text-sm text-emerald-600">特徴を保存しました</p>
        )}

        <div className="space-y-3">
          <button
            onClick={() => {
              sessionStorage.removeItem('gacha-result');
              router.push('/mypage');
            }}
            className="w-full rounded-xl border border-emerald-200 bg-white/80 py-3 font-semibold text-stone-700 flex items-center justify-center gap-2 hover:bg-emerald-50"
          >
            <User size={18} />
            じぶんを見にいく
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('gacha-result');
              router.push('/dig');
            }}
            className="btn-gradient-primary w-full rounded-xl py-3 font-semibold text-white flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            もっとほる
          </button>
        </div>
      </div>
    </div>
  );
}
