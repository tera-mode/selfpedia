'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { getOutputType } from '@/lib/outputTypes';
import { Output } from '@/types';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

interface HistoryItem {
  id: string;
  type: 'output' | 'career-match' | 'rarity';
  icon: string;
  name: string;
  preview: string;
  createdAt: string;
  href: string;
}

export default function OutputHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  usePageHeader({ title: 'アウトプット履歴', showBackButton: true, onBack: () => router.push('/craft') });
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && !user.isAnonymous) {
      fetchAllHistory();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchAllHistory = async () => {
    try {
      const [outputsRes, careerRes, rarityRes] = await Promise.all([
        authenticatedFetch(`/api/outputs?userId=${user?.uid}`),
        authenticatedFetch(`/api/craft/career-match?userId=${user?.uid}`),
        authenticatedFetch(`/api/craft/rarity?userId=${user?.uid}`),
      ]);

      const items: HistoryItem[] = [];

      // 既存のOutputs
      if (outputsRes.ok) {
        const data = await outputsRes.json();
        const activeOutputs = (data.outputs || []).filter(
          (o: Output) => o.status !== 'archived'
        );
        activeOutputs.forEach((output: Output) => {
          const config = getOutputType(output.type);
          const displayContent = output.editedContent || output.content.body;
          items.push({
            id: output.id,
            type: 'output',
            icon: config?.icon || '📄',
            name: config?.name || output.type,
            preview: displayContent.length > 80 ? displayContent.slice(0, 80) + '...' : displayContent,
            createdAt: output.createdAt as unknown as string,
            href: `/craft/${output.id}`,
          });
        });
      }

      // Career Match結果
      if (careerRes.ok) {
        const data = await careerRes.json();
        (data.results || []).forEach((item: { id: string; result: { careers: { jobTitle: string }[] }; createdAt: string }) => {
          const topCareer = item.result?.careers?.[0];
          items.push({
            id: item.id,
            type: 'career-match',
            icon: '💼',
            name: '適職×市場価値診断',
            preview: topCareer ? `1位: ${topCareer.jobTitle}` : '適職診断結果',
            createdAt: item.createdAt,
            href: `/craft/career-match`,
          });
        });
      }

      // Rarity結果
      if (rarityRes.ok) {
        const data = await rarityRes.json();
        (data.results || []).forEach((item: { id: string; result: { rank: string; rankLabel: string; percentage: number }; createdAt: string }) => {
          items.push({
            id: item.id,
            type: 'rarity',
            icon: '💎',
            name: 'じぶんレアリティ診断',
            preview: `${item.result?.rank}（${item.result?.rankLabel}）- 上位${item.result?.percentage}%`,
            createdAt: item.createdAt,
            href: `/craft/rarity`,
          });
        });
      }

      // 日付でソート（新しい順）
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setHistoryItems(items);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {/* 新規作成ボタン */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => router.push('/craft/create')}
            className="flex items-center gap-1.5 btn-gradient-primary rounded-xl px-4 py-2 font-semibold text-white"
          >
            <Plus size={16} />
            新規作成
          </button>
        </div>

        {/* ゲストユーザー向けメッセージ */}
        {user?.isAnonymous && (
          <div className="glass-card mb-6 p-6 text-center">
            <h3 className="mb-2 text-lg font-semibold text-emerald-700">ログインが必要です</h3>
            <p className="mb-4 text-sm text-stone-500">
              アウトプット機能を利用するには、ログインしてください。
            </p>
            <button
              onClick={() => router.push('/login')}
              className="btn-gradient-primary rounded-xl px-6 py-2 font-semibold text-white"
            >
              ログイン
            </button>
          </div>
        )}

        {!user?.isAnonymous && (
          <>
            {isLoading ? (
              <div className="glass-card p-8 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm"></div>
                  <p className="text-sm text-stone-500">読み込み中...</p>
                </div>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <div className="mb-4 text-5xl">📝</div>
                <h3 className="mb-2 text-lg font-semibold text-stone-800">
                  まだアウトプットがありません
                </h3>
                <p className="mb-4 text-sm text-stone-500">
                  インタビュー結果からアウトプットを作成してみましょう
                </p>
                <button
                  onClick={() => router.push('/craft/create')}
                  className="btn-gradient-primary rounded-xl px-6 py-2 font-semibold text-white"
                >
                  アウトプットを作成
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {historyItems.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => router.push(item.href)}
                    className="glass-card w-full p-4 text-left transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-200 to-blue-200 text-2xl">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 font-bold text-stone-800">
                          {item.name}
                        </h3>
                        <p className="mb-2 line-clamp-2 text-sm text-stone-500">{item.preview}</p>
                        <p className="text-xs text-stone-400">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString('ja-JP')
                            : ''}
                        </p>
                      </div>
                      <span className="text-stone-400">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
