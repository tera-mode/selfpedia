'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, TrendingUp, ArrowRight, RotateCcw, Pickaxe, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

interface CareerSuggestion {
  rank: number;
  jobTitle: string;
  matchScore: number;
  matchReason: string;
  activeImage: string;
  relatedTraitLabels: string[];
}

interface MarketValue {
  salaryMin: number;
  salaryMax: number;
  reasoning: string;
  rarityComment: string;
  growthPoints: string[];
}

interface CareerMatchResult {
  careers: CareerSuggestion[];
  marketValue: MarketValue;
  disclaimer?: string;
}

interface CareerMatchHistoryItem {
  id: string;
  result: CareerMatchResult;
  traitCount: number;
  createdAt: string;
}

const MIN_TRAITS = 15;

export default function CareerMatchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { traits, traitCount } = useTraits();
  usePageHeader({ title: '適職×市場価値診断', showBackButton: true, onBack: () => router.push('/craft') });

  const [result, setResult] = useState<CareerMatchResult | null>(null);
  const [history, setHistory] = useState<CareerMatchHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

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
      const response = await authenticatedFetch(`/api/craft/career-match?userId=${user?.uid}`);
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

    try {
      const response = await authenticatedFetch('/api/craft/career-match', {
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
      // 履歴を再読み込み
      await loadHistory();
    } catch (err: unknown) {
      console.error('Error in career-match:', err);
      setError(err instanceof Error ? err.message : '診断に失敗しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewHistoryItem = (item: CareerMatchHistoryItem) => {
    setResult({
      ...item.result,
      disclaimer: 'この診断は特徴データに基づく参考情報です。実際の適職や市場価値は、経験・スキル・市場動向など多くの要因により変動します。',
    });
  };

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {/* ヘッダー説明 */}
        {!result && (
          <div className="glass-card mb-6 p-6 text-center">
            <div className="mb-4 text-5xl">💼</div>
            <h2 className="mb-2 text-lg font-bold text-stone-800">
              あなたの特徴から<br />適職と市場価値を診断します
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
                className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
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
            <p className="mt-2 text-sm text-stone-500">適職と市場価値を診断しています</p>
          </div>
        )}

        {/* 診断結果 */}
        {result && (
          <div className="space-y-6">
            {/* 市場価値セクション */}
            <div className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp size={20} />
                  <h3 className="text-lg font-bold">市場価値</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4 text-center">
                  <p className="mb-1 text-sm text-stone-500">推定年収</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    ¥{result.marketValue.salaryMin}万 〜 ¥{result.marketValue.salaryMax}万
                  </p>
                </div>

                <div className="mb-4">
                  <p className="mb-1 text-sm font-semibold text-stone-700">根拠</p>
                  <p className="text-sm leading-relaxed text-stone-600">{result.marketValue.reasoning}</p>
                </div>

                <div className="mb-4">
                  <p className="mb-1 text-sm font-semibold text-stone-700">強みの希少性</p>
                  <p className="text-sm leading-relaxed text-stone-600">{result.marketValue.rarityComment}</p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-stone-700">伸びしろポイント</p>
                  <ul className="space-y-1">
                    {result.marketValue.growthPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                        <span className="mt-0.5 text-emerald-500">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 適職ランキング */}
            <div className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4">
                <div className="flex items-center gap-2 text-white">
                  <Briefcase size={20} />
                  <h3 className="text-lg font-bold">適職ランキング</h3>
                </div>
              </div>
              <div className="divide-y divide-stone-100">
                {result.careers.map((career) => (
                  <div key={career.rank} className="p-6">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-sm font-bold text-white">
                        {career.rank}
                      </span>
                      <h4 className="text-lg font-bold text-stone-800">{career.jobTitle}</h4>
                    </div>

                    {/* マッチ度バー */}
                    <div className="mb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-stone-500">マッチ度</span>
                        <span className="text-sm font-bold text-emerald-600">{career.matchScore}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-1000"
                          style={{ width: `${career.matchScore}%` }}
                        />
                      </div>
                    </div>

                    <p className="mb-2 text-sm leading-relaxed text-stone-600">{career.matchReason}</p>
                    <p className="mb-3 text-sm italic text-stone-500">{career.activeImage}</p>

                    {/* 関連特徴バッジ */}
                    <div className="flex flex-wrap gap-1.5">
                      {career.relatedTraitLabels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 免責事項 */}
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs leading-relaxed text-amber-700">
                {result.disclaimer}
              </p>
            </div>

            {/* アクションボタン */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setResult(null);
                  handleDiagnose();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-200 bg-white/80 px-6 py-3 font-semibold text-stone-700 transition-all hover:border-emerald-300"
              >
                <RotateCcw size={16} />
                もう一度診断する
              </button>
              <button
                onClick={() => setResult(null)}
                className="flex w-full items-center justify-center gap-2 rounded-xl text-sm text-stone-500 transition-colors hover:text-emerald-600"
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
                特徴をさらに集めると診断の精度が上がります
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
                {history.map((item) => {
                  const topCareer = item.result?.careers?.[0];
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleViewHistoryItem(item)}
                      className="flex w-full items-center gap-3 rounded-xl bg-white/80 p-4 text-left shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-stone-800 truncate">
                          {topCareer ? `1位: ${topCareer.jobTitle}` : '適職診断結果'}
                        </p>
                        <p className="text-sm text-emerald-600">
                          ¥{item.result?.marketValue?.salaryMin}万〜¥{item.result?.marketValue?.salaryMax}万
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          特徴{item.traitCount}個で診断 / {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ja-JP') : ''}
                        </p>
                      </div>
                      <span className="text-stone-400">→</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
