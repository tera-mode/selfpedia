'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gem, ArrowRight, RotateCcw, Pickaxe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

interface RareCombination {
  traitLabels: string[];
  description: string;
}

interface RarityResult {
  rank: 'SSR' | 'SR' | 'R' | 'N';
  rankLabel: string;
  estimatedCount: number;
  percentage: number;
  reasoning: string;
  rareCombinations: RareCombination[];
  rankUpAdvice: string;
}

interface RarityHistoryItem {
  id: string;
  result: RarityResult;
  traitCount: number;
  createdAt: string;
}

const MIN_TRAITS = 8;

const RANK_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  SSR: {
    bg: 'bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-400',
    text: 'text-amber-900',
    border: 'border-amber-400',
    glow: 'shadow-[0_0_30px_rgba(251,191,36,0.5)]',
  },
  SR: {
    bg: 'bg-gradient-to-br from-purple-300 via-violet-200 to-purple-400',
    text: 'text-purple-900',
    border: 'border-purple-400',
    glow: 'shadow-[0_0_20px_rgba(167,139,250,0.4)]',
  },
  R: {
    bg: 'bg-gradient-to-br from-sky-300 via-blue-200 to-sky-400',
    text: 'text-sky-900',
    border: 'border-sky-400',
    glow: 'shadow-[0_0_15px_rgba(56,189,248,0.3)]',
  },
  N: {
    bg: 'bg-gradient-to-br from-stone-200 via-gray-100 to-stone-300',
    text: 'text-stone-700',
    border: 'border-stone-300',
    glow: '',
  },
};

const RANK_BADGE_COLORS: Record<string, string> = {
  SSR: 'bg-amber-100 text-amber-800 border-amber-300',
  SR: 'bg-purple-100 text-purple-800 border-purple-300',
  R: 'bg-sky-100 text-sky-800 border-sky-300',
  N: 'bg-stone-100 text-stone-700 border-stone-300',
};

export default function RarityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { traits, traitCount } = useTraits();
  usePageHeader({ title: 'じぶんレアリティ診断', showBackButton: true, onBack: () => router.push('/craft') });

  const [result, setResult] = useState<RarityResult | null>(null);
  const [history, setHistory] = useState<RarityHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const canDiagnose = traitCount >= MIN_TRAITS;

  useEffect(() => {
    if (user && !user.isAnonymous) {
      loadHistory();
    } else {
      setIsLoadingHistory(false);
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await authenticatedFetch(`/api/craft/rarity?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.results || []);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDiagnose = async () => {
    if (!user || user.isAnonymous || !canDiagnose) return;

    setIsGenerating(true);
    setError('');
    setResult(null);
    setShowConfetti(false);

    try {
      const response = await authenticatedFetch('/api/craft/rarity', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          traits,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '診断に失敗しました');
      }

      const data = await response.json();
      setResult(data.result);
      await loadHistory();

      // SSRの場合はconfetti演出
      if (data.result.rank === 'SSR') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      }
    } catch (err: unknown) {
      console.error('Error in rarity:', err);
      setError(err instanceof Error ? err.message : '診断に失敗しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewHistoryItem = (item: RarityHistoryItem) => {
    setResult(item.result);
  };

  const rankStyle = result ? RANK_STYLES[result.rank] : null;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {/* CSS for shimmer and confetti animations */}
        <style jsx>{`
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .shimmer-effect {
            background-size: 200% auto;
            animation: shimmer 3s linear infinite;
          }
          .confetti-piece {
            position: fixed;
            top: -10px;
            z-index: 50;
            width: 10px;
            height: 10px;
            animation: confetti-fall 3s ease-in forwards;
          }
        `}</style>

        {/* Confetti for SSR */}
        {showConfetti && (
          <div className="pointer-events-none fixed inset-0 z-50">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  backgroundColor: ['#fbbf24', '#a78bfa', '#34d399', '#f472b6', '#60a5fa'][i % 5],
                  borderRadius: i % 3 === 0 ? '50%' : '0',
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        )}

        {/* ヘッダー説明 */}
        {!result && (
          <div className="glass-card mb-6 p-6 text-center">
            <div className="mb-4 text-5xl">💎</div>
            <h2 className="mb-2 text-lg font-bold text-stone-800">
              あなたの特徴の組み合わせは<br />どれだけレアなのか？
            </h2>
            <p className="mb-4 text-sm text-stone-500">
              特徴 <span className="font-bold text-emerald-600">{traitCount}個</span> で診断
            </p>

            {!canDiagnose ? (
              <div>
                <p className="mb-4 text-sm text-stone-500">
                  この診断には特徴が{MIN_TRAITS}個以上必要です（あと{MIN_TRAITS - traitCount}個）
                </p>
                <button
                  onClick={() => router.push('/dig')}
                  className="btn-gradient-primary rounded-xl px-6 py-3 font-semibold text-white"
                >
                  特徴をほりに行く
                </button>
              </div>
            ) : (
              <button
                onClick={handleDiagnose}
                disabled={isGenerating}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    あなたの特徴を分析中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    診断する <ArrowRight size={20} />
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {/* ローディング */}
        {isGenerating && (
          <div className="glass-card mb-6 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 spinner-warm" />
            </div>
            <p className="text-lg font-semibold text-stone-700">あなたの特徴を分析中...</p>
            <p className="mt-2 text-sm text-stone-500">レアリティを判定しています</p>
          </div>
        )}

        {/* 診断結果 */}
        {result && rankStyle && (
          <div className="space-y-6">
            {/* レアリティカード */}
            <div className={`relative overflow-hidden rounded-2xl border-2 p-8 text-center ${rankStyle.bg} ${rankStyle.border} ${rankStyle.glow} ${result.rank === 'SSR' || result.rank === 'SR' ? 'shimmer-effect' : ''}`}>
              {result.rank === 'SSR' && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent shimmer-effect" />
              )}

              <div className="relative z-10">
                <p className="mb-2 text-lg font-medium opacity-80">Your Rarity</p>
                <h2 className={`mb-1 text-5xl font-black ${rankStyle.text}`}>
                  {result.rank === 'SSR' && '✨ '}
                  {result.rank}
                  {result.rank === 'SSR' && ' ✨'}
                </h2>
                <p className={`mb-4 text-lg font-semibold ${rankStyle.text}`}>
                  {result.rankLabel}
                </p>
                <div className="mx-auto max-w-xs rounded-xl bg-white/50 px-4 py-3 backdrop-blur-sm">
                  <p className="text-sm text-stone-600">日本人口1億2000万人中</p>
                  <p className="text-xl font-bold text-stone-800">
                    約{result.estimatedCount >= 10000
                      ? `${Math.round(result.estimatedCount / 10000)}万人`
                      : `${result.estimatedCount.toLocaleString()}人`}に1人
                  </p>
                  <p className="text-sm font-semibold text-stone-600">（上位 {result.percentage}%）</p>
                </div>
              </div>
            </div>

            {/* 判定理由 */}
            <div className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3">
                <h3 className="font-bold text-white">📖 判定理由</h3>
              </div>
              <div className="p-6">
                <p className="text-sm leading-relaxed text-stone-700">{result.reasoning}</p>
              </div>
            </div>

            {/* レアな組み合わせ */}
            {result.rareCombinations.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="bg-gradient-to-r from-fuchsia-500 to-pink-500 px-6 py-3">
                  <h3 className="font-bold text-white">🔗 レアな組み合わせ</h3>
                </div>
                <div className="divide-y divide-stone-100">
                  {result.rareCombinations.map((combo, i) => (
                    <div key={i} className="p-5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {combo.traitLabels.map((label, j) => (
                          <span key={j} className="flex items-center gap-1">
                            <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700 border border-violet-200">
                              {label}
                            </span>
                            {j < combo.traitLabels.length - 1 && (
                              <span className="text-sm font-bold text-stone-400">×</span>
                            )}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed text-stone-600">→ {combo.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ランクアップへの道 */}
            <div className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3">
                <h3 className="font-bold text-white">🚀 ランクアップへの道</h3>
              </div>
              <div className="p-6">
                <p className="text-sm leading-relaxed text-stone-700">{result.rankUpAdvice}</p>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setResult(null);
                  handleDiagnose();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-200 bg-white/80 px-6 py-3 font-semibold text-stone-700 transition-all hover:border-violet-300"
              >
                <RotateCcw size={16} />
                もう一度診断する
              </button>
              <button
                onClick={() => setResult(null)}
                className="flex w-full items-center justify-center gap-2 rounded-xl text-sm text-stone-500 transition-colors hover:text-violet-600"
              >
                トップに戻る
              </button>
            </div>

            {/* ほるへの導線 */}
            <div className="glass-card p-6 text-center">
              <p className="mb-2 text-sm font-semibold text-stone-700">
                もっと正確な診断のために...
              </p>
              <p className="mb-4 text-sm text-stone-500">
                特徴をさらに集めるとランクアップの可能性が上がります
              </p>
              <button
                onClick={() => router.push('/dig')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg"
              >
                <Pickaxe size={16} />
                もっとほる
              </button>
            </div>
          </div>
        )}

        {/* 生成履歴 */}
        {!result && !isGenerating && (
          <div className="glass-card p-6">
            <h2 className="mb-4 text-lg font-bold text-stone-800">
              診断履歴
              {history.length > 0 && (
                <span className="ml-2 text-sm font-normal text-stone-500">
                  ({history.length}件)
                </span>
              )}
            </h2>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-4 spinner-warm" />
                <p className="text-sm text-stone-500">読み込み中...</p>
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-stone-500">まだ診断履歴がありません</p>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleViewHistoryItem(item)}
                    className="flex w-full items-center gap-3 rounded-xl bg-white/80 p-4 text-left shadow-sm transition-all hover:shadow-md"
                  >
                    <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${RANK_BADGE_COLORS[item.result?.rank] || ''}`}>
                      {item.result?.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-800">
                        {item.result?.rankLabel} - 上位{item.result?.percentage}%
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        特徴{item.traitCount}個で診断 / {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ja-JP') : ''}
                      </p>
                    </div>
                    <span className="text-stone-400">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
