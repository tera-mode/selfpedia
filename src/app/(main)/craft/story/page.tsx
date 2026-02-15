'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { StoryGenre, STORY_GENRE_CONFIG } from '@/types/story';

const MIN_TRAITS = 20;

interface StoryHistoryItem {
  id: string;
  genre: StoryGenre;
  theme?: string;
  seriesTitle?: string;
  status: 'generating' | 'in_progress' | 'completed' | 'error';
  currentEpisode: number;
  traitCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  generating: { label: '生成中', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: '続きあり', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '完結', color: 'bg-emerald-100 text-emerald-700' },
  error: { label: 'エラー', color: 'bg-red-100 text-red-700' },
};

const LOADING_STEPS = [
  '特徴データを分析中...',
  'キャラクターを設計中...',
  'アウトラインを構成中...',
  '第1話を執筆中...',
  '品質チェック中...',
];

export default function StorySetupPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { traits, traitCount } = useTraits();
  usePageHeader({ title: 'じぶん物語', showBackButton: true, onBack: () => router.push('/craft') });

  const [selectedGenre, setSelectedGenre] = useState<StoryGenre | null>(null);
  const [theme, setTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [visibleTraitIndex, setVisibleTraitIndex] = useState(0);
  const [history, setHistory] = useState<StoryHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const canGenerate = traitCount >= MIN_TRAITS && selectedGenre;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await authenticatedFetch('/api/craft/story');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.stories || []);
      }
    } catch {
      // 履歴取得失敗は無視
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError('');
    setLoadingStep(0);
    setVisibleTraitIndex(0);

    // ステップ表示のアニメーション
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 8000);

    // 特徴カードの表示アニメーション
    const traitInterval = setInterval(() => {
      setVisibleTraitIndex(prev => (prev + 1) % Math.min(traits.length, 10));
    }, 2000);

    try {
      const response = await authenticatedFetch('/api/craft/story/generate', {
        method: 'POST',
        body: JSON.stringify({
          genre: selectedGenre,
          theme: theme || undefined,
          traits,
          userProfile,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '生成に失敗しました');
      }

      const data = await response.json();
      router.push(`/craft/story/${data.storyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました');
      setIsGenerating(false);
    } finally {
      clearInterval(stepInterval);
      clearInterval(traitInterval);
    }
  };

  // ローディング画面
  if (isGenerating) {
    const displayTraits = traits.slice(0, 10);
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-amber-200">
              <BookOpen size={36} className="animate-pulse text-orange-600" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-stone-800">
              あなたの物語を紡いでいます...
            </h2>
            <p className="text-sm text-stone-500">
              30〜60秒ほどかかります
            </p>
          </div>

          {/* ステップ表示 */}
          <div className="mb-6 space-y-2">
            {LOADING_STEPS.map((step, i) => (
              <div
                key={step}
                className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                  i <= loadingStep ? 'text-stone-700' : 'text-stone-300'
                }`}
              >
                {i < loadingStep ? (
                  <span className="text-emerald-500">✓</span>
                ) : i === loadingStep ? (
                  <Loader2 size={14} className="animate-spin text-orange-500" />
                ) : (
                  <span className="text-stone-300">○</span>
                )}
                {step}
              </div>
            ))}
          </div>

          {/* 特徴カード表示アニメーション */}
          <div className="glass-card overflow-hidden p-4">
            <p className="mb-3 text-xs font-semibold text-stone-500">使用する特徴</p>
            <div className="flex h-12 items-center justify-center">
              {displayTraits[visibleTraitIndex] && (
                <div
                  key={visibleTraitIndex}
                  className="animate-fade-in flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 px-4 py-2"
                >
                  <span>{displayTraits[visibleTraitIndex].icon || '✨'}</span>
                  <span className="text-sm font-medium text-stone-700">
                    {displayTraits[visibleTraitIndex].label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-lg">
        {/* ヘッダー */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-amber-200">
            <BookOpen size={28} className="text-orange-600" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-stone-800">
            あなたが主人公の物語を生成します
          </h2>
          <p className="text-sm text-stone-500">
            特徴 <span className="font-bold text-orange-600">{traitCount}個</span>で生成
          </p>
        </div>

        {traitCount < MIN_TRAITS && (
          <div className="glass-card mb-6 p-4 text-center">
            <p className="mb-2 text-sm font-semibold text-stone-700">
              特徴が足りません（{traitCount}/{MIN_TRAITS}）
            </p>
            <p className="mb-3 text-xs text-stone-500">
              あと{MIN_TRAITS - traitCount}個の特徴が必要です
            </p>
            <button
              onClick={() => router.push('/dig')}
              className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold text-white"
            >
              特徴をほりに行く
            </button>
          </div>
        )}

        {/* ジャンル選択 */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-bold text-stone-700">ジャンルを選ぶ</h3>
          <div className="space-y-2">
            {(Object.entries(STORY_GENRE_CONFIG) as [StoryGenre, typeof STORY_GENRE_CONFIG[StoryGenre]][]).map(
              ([genre, config]) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedGenre === genre
                      ? 'border-orange-400 bg-gradient-to-r ' + config.bgGradient + ' shadow-md'
                      : 'border-stone-200 bg-white/70 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <p className={`font-bold ${
                        selectedGenre === genre ? 'text-stone-800' : 'text-stone-700'
                      }`}>
                        {config.label}
                      </p>
                      <p className={`text-xs ${
                        selectedGenre === genre ? 'text-stone-600' : 'text-stone-400'
                      }`}>
                        {config.description}
                      </p>
                    </div>
                  </div>
                </button>
              )
            )}
          </div>
        </div>

        {/* テーマ入力（任意） */}
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-stone-700">
            テーマ（任意）
          </h3>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例：挑戦、出会い、再出発"
            className="glass-input w-full rounded-xl px-4 py-3 text-sm"
            maxLength={30}
          />
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 生成ボタン */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`w-full rounded-xl py-4 text-base font-bold text-white transition-all ${
            canGenerate
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg hover:shadow-xl'
              : 'cursor-not-allowed bg-stone-300'
          }`}
        >
          物語をつくる
        </button>

        <p className="mt-3 text-center text-xs text-stone-400">
          3話完結の物語が生成されます（1話あたり30〜60秒）
        </p>

        {/* 生成履歴 */}
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-bold text-stone-700">生成履歴</h3>
          {isLoadingHistory ? (
            <div className="glass-card flex items-center justify-center p-6">
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 size={16} className="animate-spin" />
                読み込み中...
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-stone-400">
              まだ物語が生成されていません
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const genreConfig = STORY_GENRE_CONFIG[item.genre];
                const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.error;
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(`/craft/story/${item.id}`)}
                    className="glass-card flex w-full items-center gap-3 p-4 text-left transition-all hover:shadow-md"
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${genreConfig?.bgGradient || 'from-stone-200 to-stone-300'}`}>
                      <span className="text-lg">{genreConfig?.icon || '📖'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-800">
                        {item.seriesTitle || '無題の物語'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>{genreConfig?.label}</span>
                        <span>·</span>
                        <span>{item.currentEpisode}/3話</span>
                        <span>·</span>
                        <span>
                          {new Date(item.createdAt).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <ChevronRight size={16} className="text-stone-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
