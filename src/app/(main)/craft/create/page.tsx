'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { Copy, Check, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { getEnabledOutputTypes, OutputTypeConfig } from '@/lib/outputTypes';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { Output } from '@/types';

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const { traits, traitCount, isLoading: isLoadingTraits } = useTraits();
  const [selectedType, setSelectedType] = useState<OutputTypeConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Output[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const outputTypes = getEnabledOutputTypes().filter(
    t => t.minLength > 0 && t.maxLength > 0
  );
  const typeParam = searchParams.get('type');
  const isDirectAccess = !!typeParam;

  useEffect(() => {
    if (typeParam) {
      const found = outputTypes.find((t) => t.id === typeParam);
      if (found) setSelectedType(found);
    }
  }, [typeParam]);

  useEffect(() => {
    if (user && selectedType) {
      loadHistory(selectedType.id);
    } else {
      setIsLoadingHistory(false);
    }
  }, [user, selectedType]);

  usePageHeader({
    title: selectedType?.name || 'テキスト生成',
    showBackButton: true,
    onBack: () => router.push('/craft'),
  });

  const loadHistory = async (typeId: string) => {
    try {
      setIsLoadingHistory(true);
      const response = await authenticatedFetch(`/api/outputs?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.outputs || []).filter(
          (o: Output) => o.type === typeId && o.status !== 'archived'
        );
        setHistory(filtered);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSelectType = (type: OutputTypeConfig) => {
    setSelectedType(type);
    setGeneratedContent('');
    setError('');
  };

  const handleGenerate = async () => {
    if (!selectedType || traitCount === 0) return;

    setIsGenerating(true);
    setError('');

    try {
      const response = await authenticatedFetch('/api/generate-output', {
        method: 'POST',
        body: JSON.stringify({
          type: selectedType.id,
          traits,
          userProfile: userProfile
            ? {
                nickname: userProfile.nickname,
                occupation: userProfile.occupation,
              }
            : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate output');

      const data = await response.json();
      setGeneratedContent(data.content);
    } catch (err) {
      console.error('Error generating output:', err);
      setError('生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedType || !generatedContent || !user) return;

    setIsSaving(true);
    setError('');

    try {
      const response = await authenticatedFetch('/api/outputs', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.uid,
          type: selectedType.id,
          content: generatedContent,
          traits,
          interviewIds: [],
        }),
      });

      if (!response.ok) throw new Error('Failed to save output');

      setGeneratedContent('');
      await loadHistory(selectedType.id);
    } catch (err) {
      console.error('Error saving output:', err);
      setError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDelete = async (outputId: string) => {
    if (!confirm('この生成結果を削除しますか？')) return;

    setDeletingId(outputId);
    try {
      const response = await authenticatedFetch(`/api/outputs?outputId=${outputId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      setHistory(history.filter((o) => o.id !== outputId));
    } catch (err) {
      console.error('Error deleting output:', err);
      alert('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {/* 特徴データの状態 */}
        {isLoadingTraits ? (
          <div className="glass-card mb-6 p-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm"></div>
              <p className="text-sm text-stone-500">特徴データを読み込み中...</p>
            </div>
          </div>
        ) : traitCount === 0 ? (
          <div className="glass-card mb-6 p-6 text-center">
            <h3 className="mb-2 text-lg font-semibold text-emerald-700">
              特徴データがありません
            </h3>
            <p className="mb-4 text-sm text-stone-500">
              まずはインタビューを受けて、あなたの特徴を発見しましょう。
            </p>
            <button
              onClick={() => router.push('/dig/interview/select-mode')}
              className="btn-gradient-primary rounded-xl px-6 py-2 font-semibold text-white"
            >
              インタビューを始める
            </button>
          </div>
        ) : (
          <>
            {/* 直接アクセス時: 説明 + 生成ボタンのみ */}
            {isDirectAccess && selectedType ? (
              <>
                {/* プレビュー表示 */}
                {generatedContent ? (
                  <div className="glass-card mb-6 p-6">
                    <h3 className="mb-3 text-center text-sm font-semibold text-stone-500">生成結果</h3>
                    <div className="mb-4 rounded-xl bg-white/50 p-4">
                      <p className="whitespace-pre-wrap text-stone-800">{generatedContent}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-stone-500">{generatedContent.length}文字</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-4 py-2 text-sm font-semibold text-stone-700 transition-all hover:bg-stone-50 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          再生成
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {isSaving ? '保存中...' : '保存する'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card mb-6 p-6 text-center">
                    <p className="mb-2 text-sm text-stone-500">{selectedType.description}</p>
                    <p className="mb-4 text-xs text-stone-400">
                      {selectedType.minLength}〜{selectedType.maxLength}文字 ／ 特徴 {traitCount}個で生成
                    </p>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="btn-gradient-primary rounded-xl px-8 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                          生成中...
                        </span>
                      ) : (
                        `${selectedType.name}を生成`
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 特徴サマリー */}
                <div className="glass-card mb-6 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-700">
                      集めた特徴: <span className="font-bold text-emerald-600">{traitCount}個</span>
                    </span>
                  </div>
                </div>

                {/* アウトプットタイプ選択 */}
                <div className="mb-6 grid gap-3 md:grid-cols-2">
                  {outputTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type)}
                      className={`glass-card flex items-start gap-4 p-4 text-left transition-all ${
                        selectedType?.id === type.id
                          ? 'ring-2 ring-sky-400 shadow-lg'
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-200 to-blue-200 text-xl">
                        {type.icon}
                      </div>
                      <div>
                        <h3 className="mb-0.5 font-bold text-stone-800">{type.name}</h3>
                        <p className="text-xs text-stone-500">{type.description}</p>
                        <p className="mt-1 text-xs text-stone-400">
                          {type.minLength}〜{type.maxLength}文字
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 生成ボタン */}
                {selectedType && (
                  <div className="mb-6 text-center">
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="btn-gradient-primary rounded-xl px-8 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-2">
                          <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm"></div>
                          生成中...
                        </span>
                      ) : (
                        `${selectedType.name}を生成`
                      )}
                    </button>
                  </div>
                )}

                {/* 生成結果 */}
                {generatedContent && (
                  <div className="glass-card mb-6 p-6">
                    <h3 className="mb-4 text-lg font-bold text-stone-800">生成結果</h3>
                    <div className="mb-4 rounded-xl bg-white/50 p-4">
                      <p className="whitespace-pre-wrap text-stone-800">{generatedContent}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-stone-500">{generatedContent.length}文字</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="rounded-xl border border-sky-200 bg-white/80 px-4 py-2 text-sm font-semibold text-stone-700 transition-all hover:bg-sky-50 disabled:opacity-50"
                        >
                          再生成
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="btn-gradient-primary rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {isSaving ? '保存中...' : '保存する'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* エラー表示 */}
            {error && (
              <div className="mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* 生成履歴 */}
            {selectedType && (
              <div className="glass-card p-6">
                <h2 className="mb-4 text-lg font-bold text-stone-800">
                  生成履歴
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
                  <p className="py-8 text-center text-stone-500">まだ生成履歴がありません</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => {
                      const content = item.editedContent || item.content.body;
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl bg-white/80 p-4 shadow-sm"
                        >
                          <p className="mb-2 text-sm leading-relaxed text-stone-800 line-clamp-3">
                            {content}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-stone-400">
                              {item.createdAt
                                ? new Date(item.createdAt as unknown as string).toLocaleDateString('ja-JP')
                                : ''}
                            </p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleCopy(content, item.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200"
                                title="コピー"
                              >
                                {copiedId === item.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={deletingId === item.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 disabled:opacity-50"
                                title="削除"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CreateOutputPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm"></div>
            <p className="text-sm text-stone-500">読み込み中...</p>
          </div>
        </div>
      }
    >
      <CreateContent />
    </Suspense>
  );
}
