'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2, Share2, Pickaxe, ArrowRight, Clock } from 'lucide-react';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { Story, STORY_GENRE_CONFIG } from '@/types/story';

const TOTAL_EPISODES = 3;

/** タイトルから「第N話」等のプレフィックスを除去 */
function cleanEpisodeTitle(title: string): string {
  return title.replace(/^第[0-9０-９]+話[\s「」『』]*/g, '').replace(/^[「」『』]+/g, '').replace(/[「」『』]+$/g, '').trim() || title;
}

const LOADING_EPISODE_STEPS = [
  '物語を執筆中...',
  '品質チェック中...',
];

export default function StoryViewPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = use(params);
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);

  usePageHeader({
    title: story?.outline?.seriesTitle || 'じぶん物語',
    showBackButton: true,
    onBack: () => router.push('/craft/story'),
  });

  useEffect(() => {
    loadStory();
  }, [storyId]);

  const loadStory = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`/api/craft/story/${storyId}`);
      if (!response.ok) throw new Error('物語データの取得に失敗しました');
      const data = await response.json();
      setStory(data);
      setCurrentEpisodeIndex(data.episodes.length - 1);
      if (data.status === 'completed') {
        setShowCompletion(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateNext = async () => {
    if (!story || isGenerating) return;

    setIsGenerating(true);
    setLoadingStep(0);
    setError('');

    const stepInterval = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, LOADING_EPISODE_STEPS.length - 1));
    }, 8000);

    try {
      const response = await authenticatedFetch('/api/craft/story/episode', {
        method: 'POST',
        body: JSON.stringify({ storyId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '生成に失敗しました');
      }

      const data = await response.json();

      setStory(prev => {
        if (!prev) return prev;
        const updatedEpisodes = [...prev.episodes, data.episode];
        return {
          ...prev,
          episodes: updatedEpisodes,
          currentEpisode: data.episodeNumber,
          status: data.isCompleted ? 'completed' : 'in_progress',
        };
      });

      setCurrentEpisodeIndex(prev => prev + 1);

      if (data.isCompleted) {
        setShowCompletion(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました');
    } finally {
      setIsGenerating(false);
      clearInterval(stepInterval);
    }
  };

  const handleShare = async () => {
    if (!story) return;
    const text = `「${story.outline.seriesTitle}」- じぶんクラフトで自分が主人公の物語を作りました！\nhttps://mecraft.life`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // ユーザーがキャンセル
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-orange-500" />
          <span className="text-stone-500">物語を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error && !story) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="mb-4 text-sm text-red-500">{error}</p>
        <button
          onClick={() => router.push('/craft/story')}
          className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          戻る
        </button>
      </div>
    );
  }

  if (!story) return null;

  const currentEpisode = story.episodes[currentEpisodeIndex];
  const genreConfig = STORY_GENRE_CONFIG[story.genre];
  const isLatestEpisode = currentEpisodeIndex === story.episodes.length - 1;
  const hasNextEpisode = story.currentEpisode < TOTAL_EPISODES && story.status !== 'completed';

  // 完結画面
  if (showCompletion && story.status === 'completed') {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-amber-200">
              <BookOpen size={36} className="text-orange-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-stone-800">
              物語が完結しました
            </h2>
            <p className="text-base font-semibold text-stone-700">
              「{story.outline.seriesTitle}」
            </p>
            <p className="text-sm text-stone-500">全{TOTAL_EPISODES}話</p>
          </div>

          {/* 反映された特徴 */}
          {story.reflectedTraits && story.reflectedTraits.length > 0 && (
            <div className="glass-card mb-6 p-4">
              <h3 className="mb-3 text-sm font-bold text-stone-700">
                反映された特徴
              </h3>
              <div className="space-y-2">
                {story.reflectedTraits.map((trait, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span>{trait.icon}</span>
                    <div>
                      <span className="font-medium text-stone-700">{trait.traitLabel}</span>
                      <p className="text-xs text-stone-500">{trait.reflection}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* エピソード一覧 */}
          <div className="glass-card mb-6 p-4">
            <h3 className="mb-3 text-sm font-bold text-stone-700">全エピソード</h3>
            <div className="space-y-2">
              {story.episodes.map((ep, i) => (
                <button
                  key={i}
                  onClick={() => { setShowCompletion(false); setCurrentEpisodeIndex(i); }}
                  className="w-full rounded-lg bg-stone-50 p-3 text-left transition-colors hover:bg-stone-100"
                >
                  <span className="text-xs text-stone-400">第{ep.episodeNumber}話</span>
                  <p className="text-sm font-medium text-stone-700">{cleanEpisodeTitle(ep.title)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="space-y-3">
            <button
              onClick={handleShare}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 font-semibold text-white shadow-lg"
            >
              <Share2 size={18} />
              SNSでシェア
            </button>

            <button
              onClick={() => router.push('/dig')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 py-3 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              <Pickaxe size={18} />
              もっとほる
            </button>

            <button
              onClick={() => router.push('/craft/story')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-stone-200 py-3 font-semibold text-stone-600 transition-colors hover:bg-stone-50"
            >
              <ArrowRight size={18} />
              新しい物語をつくる
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 物語閲覧画面
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-lg">
        {/* プログレス */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
            <span>第{currentEpisode.episodeNumber}話 / {TOTAL_EPISODES}話</span>
            <span>{genreConfig.icon} {genreConfig.label}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-500"
              style={{ width: `${(currentEpisode.episodeNumber / TOTAL_EPISODES) * 100}%` }}
            />
          </div>
        </div>

        {/* エピソードナビゲーション */}
        {story.episodes.length > 1 && (
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {story.episodes.map((ep, i) => (
              <button
                key={i}
                onClick={() => setCurrentEpisodeIndex(i)}
                className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  i === currentEpisodeIndex
                    ? 'bg-orange-500 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {ep.episodeNumber}話
              </button>
            ))}
          </div>
        )}

        {/* エピソード本文 */}
        <div className="glass-card mb-6 p-5">
          <h2 className="mb-4 text-center text-lg font-bold text-stone-800">
            「{cleanEpisodeTitle(currentEpisode.title)}」
          </h2>
          <div className="prose prose-sm prose-stone max-w-none">
            {currentEpisode.body.split('\n\n').map((paragraph, i) => (
              <p key={i} className="mb-4 leading-relaxed text-stone-700">
                {paragraph.split('\n').map((line, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 次のエピソードへの導線 */}
        {isGenerating ? (
          <div className="glass-card p-6 text-center">
            <Loader2 size={24} className="mx-auto mb-3 animate-spin text-orange-500" />
            <p className="mb-2 text-sm font-semibold text-stone-700">
              次のエピソードを執筆中...
            </p>
            <div className="space-y-1">
              {LOADING_EPISODE_STEPS.map((step, i) => (
                <p
                  key={step}
                  className={`text-xs transition-all ${
                    i <= loadingStep ? 'text-stone-600' : 'text-stone-300'
                  }`}
                >
                  {i < loadingStep ? '✓' : i === loadingStep ? '●' : '○'} {step}
                </p>
              ))}
            </div>
          </div>
        ) : isLatestEpisode && hasNextEpisode ? (
          <div className="glass-card p-6 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-orange-600">
              <Clock size={20} />
              <p className="text-sm font-bold">続きは明日のお楽しみ...</p>
            </div>
            <p className="mb-4 text-xs text-stone-500">
              第{story.currentEpisode + 1}話 / 全{TOTAL_EPISODES}話
            </p>
            <button
              onClick={handleGenerateNext}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl"
            >
              続きを読む
            </button>
          </div>
        ) : story.status === 'completed' && isLatestEpisode ? (
          <div className="text-center">
            <button
              onClick={() => setShowCompletion(true)}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-semibold text-white shadow-lg"
            >
              完結画面を見る
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
