'use client';

import { use, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, ChevronDown, Clock, CheckCircle } from 'lucide-react';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { EncounterCategory, RecommendedItem } from '@/types/encounter';
import { ENCOUNTER_UNLOCK_RULES } from '@/lib/encounter/unlockRules';
import EncounterItemCard from '@/components/encounter/EncounterItemCard';
import PersonalityInsight from '@/components/encounter/PersonalityInsight';
import TraitGateCTA from '@/components/encounter/TraitGateCTA';

interface PageState {
  recommendations: RecommendedItem[];
  personalityContext: string;
  traitsUsedCount: number;
  generatedAt: string;
  fromCache?: boolean;
}

interface HistoryEntry {
  id: string;
  category: EncounterCategory;
  items: RecommendedItem[];
  personalityContext: string;
  traitsUsedCount: number;
  generatedAt: string;
}

interface EncounterCategoryPageProps {
  params: Promise<{ category: string }>;
}

// ─── ローディングステップ ───
const LOADING_STEPS = [
  { label: '特徴データを分析しています...', delay: 0 },
  { label: 'あなただけのキーワードを生成中...', delay: 2800 },
  { label: '商品・コンテンツを検索中...', delay: 6000 },
  { label: 'パーソナライズされた推薦文を作成中...', delay: 10500 },
];

function LoadingSteps() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timers = LOADING_STEPS.map((step, i) =>
      setTimeout(() => setCurrentStep(i), step.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="glass-card p-6">
      <p className="mb-4 text-center text-sm font-medium text-stone-700">
        あなたとのであいを準備しています...
      </p>
      <div className="space-y-4">
        {LOADING_STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 transition-all duration-500 ${
                i <= currentStep ? 'opacity-100' : 'opacity-25'
              }`}
            >
              <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-all ${
                isDone ? 'bg-emerald-500' : isCurrent ? 'bg-violet-500' : 'bg-stone-200'
              }`}>
                {isDone ? (
                  <CheckCircle size={14} className="text-white" />
                ) : isCurrent ? (
                  <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                ) : (
                  <span className="text-[10px] text-stone-400">{i + 1}</span>
                )}
              </div>
              <p className={`text-sm transition-all ${
                isCurrent ? 'font-semibold text-stone-800' : isDone ? 'text-emerald-700' : 'text-stone-400'
              }`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 過去履歴セクション ───
function formatDateJP(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function HistorySection({ category, categoryLabel }: { category: EncounterCategory; categoryLabel: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    authenticatedFetch(`/api/encounter/history?category=${category}&limit=8`)
      .then(r => r.json())
      .then(data => setHistory(data.history ?? []))
      .catch(() => {})
      .finally(() => setIsFetching(false));
  }, [category]);

  if (isFetching || history.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={14} className="text-stone-400" />
        <h3 className="text-sm font-semibold text-stone-500">過去のであいの記録</h3>
      </div>
      <div className="space-y-2">
        {history.map(entry => (
          <div key={entry.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="flex w-full items-center justify-between p-3 text-left"
            >
              <span className="text-xs text-stone-600">
                {formatDateJP(entry.generatedAt)} の{categoryLabel}とのであい（{entry.items.length}件）
              </span>
              <ChevronDown
                size={14}
                className={`flex-shrink-0 text-stone-400 transition-transform ${
                  expandedId === entry.id ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedId === entry.id && (
              <div className="grid grid-cols-3 gap-2 border-t border-stone-100 p-3">
                {entry.items.slice(0, 6).map(item => (
                  <a
                    key={item.id}
                    href={item.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl">
                          {ENCOUNTER_UNLOCK_RULES[category]?.icon ?? '💫'}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] text-stone-600">{item.name}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── メインページ ───
export default function EncounterCategoryPage({ params }: EncounterCategoryPageProps) {
  const { category: categoryParam } = use(params);
  const category = categoryParam as EncounterCategory;
  const router = useRouter();
  const { traitCount, isLoading: isLoadingTraits } = useTraits();

  const rule = ENCOUNTER_UNLOCK_RULES[category];
  const isValidCategory = !!rule;
  const categoryLabel = rule?.label ?? '';

  // AppHeaderにタイトル+バックボタンを設定（他の下層ページと同じパターン）
  usePageHeader({
    title: isValidCategory ? `${rule.icon} ${categoryLabel}とのであい` : 'であう',
    showBackButton: true,
    onBack: () => router.push('/encounter'),
  });

  const [state, setState] = useState<PageState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const isUnlocked = !isLoadingTraits && traitCount >= (rule?.requiredTraits || 0);

  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    if (!isUnlocked || isFetchingRef.current) return;
    isFetchingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const res = await authenticatedFetch('/api/encounter/generate', {
        method: 'POST',
        body: JSON.stringify({ category, forceRefresh }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'であいの生成に失敗しました');
      }

      const data = await res.json();
      setState({
        recommendations: data.recommendations || [],
        personalityContext: data.personalityContext || '',
        traitsUsedCount: data.traitsUsedCount || 0,
        generatedAt: data.generatedAt || new Date().toISOString(),
        fromCache: data.fromCache ?? false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'であいの生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [category, isUnlocked]);

  useEffect(() => {
    if (isUnlocked && !state) {
      fetchRecommendations(false);
    }
  }, [isUnlocked, state, fetchRecommendations]);

  if (!isValidCategory) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-stone-500">このカテゴリは存在しません</p>
        <button onClick={() => router.push('/encounter')} className="mt-4 text-emerald-600 underline">
          「であう」に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">

        {/* 特徴不足の場合 */}
        {!isLoadingTraits && !isUnlocked && (
          <TraitGateCTA
            currentTraits={traitCount}
            requiredTraits={rule.requiredTraits}
            categoryLabel={categoryLabel}
          />
        )}

        {/* 初期ローディング（ステップ表示） */}
        {(isLoadingTraits || (isLoading && !state)) && (
          <LoadingSteps />
        )}

        {/* 更新中（既存データあり） */}
        {isLoading && state && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-violet-50 p-3">
            <RefreshCw size={14} className="animate-spin text-violet-500" />
            <span className="text-sm text-violet-700">新しいであいを探しています...</span>
          </div>
        )}

        {/* エラー */}
        {error && !isLoading && (
          <div className="glass-card mb-4 p-6 text-center border border-rose-100 bg-rose-50/30">
            <p className="text-sm text-rose-600 mb-3">{error}</p>
            <button
              onClick={() => fetchRecommendations(false)}
              className="text-sm font-medium text-emerald-600 underline"
            >
              もう一度試す
            </button>
          </div>
        )}

        {/* 結果表示 */}
        {state && isUnlocked && (
          <>
            {/* 個性コンテキスト */}
            {state.personalityContext && (
              <div className="mb-4">
                <PersonalityInsight context={state.personalityContext} />
              </div>
            )}

            {/* 更新ボタン行 */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-stone-400">
                {state.generatedAt ? `更新: ${formatDateJP(state.generatedAt)}` : ''}
                {state.fromCache && <span className="ml-1 text-emerald-600">（保存済み）</span>}
              </span>
              <button
                onClick={() => fetchRecommendations(true)}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600 transition-all hover:bg-stone-200 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                新しいであいを探す
              </button>
            </div>

            {/* アイテム一覧（2列グリッド） */}
            {state.recommendations.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {state.recommendations.map((item, index) => (
                  <EncounterItemCard
                    key={item.id}
                    item={item}
                    category={category}
                    position={index + 1}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-stone-500 mb-3">であいが見つかりませんでした</p>
                <button
                  onClick={() => fetchRecommendations(true)}
                  className="text-sm text-emerald-600 underline"
                >
                  再度探す
                </button>
              </div>
            )}

            {/* 過去履歴セクション */}
            <HistorySection category={category} categoryLabel={categoryLabel} />

            {/* アフィリエイト注記 + 帰属表示 */}
            <div className="mt-6 space-y-1 text-center">
              <p className="text-xs text-stone-400">
                ※ 商品リンクにはアフィリエイトリンクを含みます
              </p>
              {category === 'games' && (
                <p className="text-xs text-stone-400">
                  Game data powered by{' '}
                  <a href="https://rawg.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">RAWG</a>
                </p>
              )}
              {category === 'anime' && (
                <p className="text-xs text-stone-400">
                  Anime data from{' '}
                  <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">MyAnimeList</a>{' '}
                  via Jikan API
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
