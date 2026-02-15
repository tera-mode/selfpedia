'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pickaxe, MessageSquare, ArrowRight, Dices, Palette, Heart } from 'lucide-react';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { MenuCard } from '@/components/ui';

function isUsedToday(key: string): boolean {
  const lastDate = localStorage.getItem(key);
  return lastDate === new Date().toISOString().slice(0, 10);
}

export default function DigPage() {
  const router = useRouter();
  usePageHeader({ title: 'ほる' });

  const [isSwipeUsedToday, setIsSwipeUsedToday] = useState(false);
  const [isGachaUsedToday, setIsGachaUsedToday] = useState(false);
  const [isMetaphorUsedToday, setIsMetaphorUsedToday] = useState(false);
  const [isFavoritesUsedToday, setIsFavoritesUsedToday] = useState(false);

  useEffect(() => {
    setIsSwipeUsedToday(isUsedToday('lastSwipeDate'));
    setIsGachaUsedToday(isUsedToday('lastGachaDate'));
    setIsMetaphorUsedToday(isUsedToday('lastMetaphorDate'));
    setIsFavoritesUsedToday(isUsedToday('lastFavoritesDate'));
  }, []);

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-lg">
        <p className="mb-6 text-center text-sm text-stone-500">5つの方法であなたの特徴を発見</p>

        {/* 今日のひと掘り */}
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-600">
            <span>🎲</span> 今日のひと掘り（1日1回）
          </p>
          <div className="space-y-4">
            <MenuCard
              title="1分じぶん掘り"
              description="スワイプ診断でじぶん発見"
              icon={Pickaxe}
              iconColor="text-amber-600"
              bgGradient="from-amber-200 to-yellow-200"
              buttonGradient="from-amber-500 to-yellow-500"
              href="/dig/swipe"
              disabled={isSwipeUsedToday}
              disabledMessage="本日の利用回数に達しました。次回は明日ご利用できます"
            />

            <MenuCard
              title="ガチャ質問"
              description="ランダムな質問に答えて特徴発見"
              icon={Dices}
              iconColor="text-violet-600"
              bgGradient="from-violet-200 to-purple-200"
              buttonGradient="from-violet-500 to-purple-500"
              href="/dig/gacha"
              disabled={isGachaUsedToday}
              disabledMessage="本日の利用回数に達しました。次回は明日ご利用できます"
            />

            <MenuCard
              title="自分を○○に例えると？"
              description="比喩で自分を再発見"
              icon={Palette}
              iconColor="text-rose-600"
              bgGradient="from-rose-200 to-pink-200"
              buttonGradient="from-rose-500 to-pink-500"
              href="/dig/metaphor"
              disabled={isMetaphorUsedToday}
              disabledMessage="本日の利用回数に達しました。次回は明日ご利用できます"
            />

            <MenuCard
              title="あなたの好きな○○"
              description="好きなものから個性を発見"
              icon={Heart}
              iconColor="text-orange-600"
              bgGradient="from-orange-200 to-amber-200"
              buttonGradient="from-orange-500 to-amber-500"
              href="/dig/favorites"
              disabled={isFavoritesUsedToday}
              disabledMessage="本日の利用回数に達しました。次回は明日ご利用できます"
            />
          </div>
        </div>

        {/* じっくり掘る */}
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-600">
            <span>⛏</span> じっくり掘る
          </p>
          <div className="space-y-4">
            <MenuCard
              title="AIインタビュー"
              description="あなた専用インタビュワーが深掘り"
              icon={MessageSquare}
              iconColor="text-emerald-600"
              bgGradient="from-emerald-200 to-teal-200"
              buttonGradient="from-emerald-500 to-teal-500"
              href="/dig/interview/select-mode"
            />
          </div>
        </div>

        {/* 次のステップへのナビゲーション */}
        <button
          onClick={() => router.push('/mypage')}
          className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 transition-all hover:bg-emerald-50"
        >
          <span className="text-sm text-emerald-700">掘り出した特徴を見にいく</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
            じぶん <ArrowRight size={14} />
          </span>
        </button>
      </div>
    </div>
  );
}
