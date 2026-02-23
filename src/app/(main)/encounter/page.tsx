'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, Film, Tv, Gamepad2, Gift, GraduationCap, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { ENCOUNTER_UNLOCK_RULES, ENCOUNTER_CATEGORIES } from '@/lib/encounter/unlockRules';
import { EncounterCategory } from '@/types/encounter';

interface EncounterMenuItem {
  category: EncounterCategory;
  icon: LucideIcon;
  iconColor: string;
  bgGradient: string;
  buttonGradient: string;
}

const ENCOUNTER_MENU: EncounterMenuItem[] = [
  {
    category: 'books',
    icon: BookOpen,
    iconColor: 'text-amber-600',
    bgGradient: 'from-amber-200 to-orange-200',
    buttonGradient: 'from-amber-500 to-orange-500',
  },
  {
    category: 'movies',
    icon: Film,
    iconColor: 'text-violet-600',
    bgGradient: 'from-violet-200 to-purple-200',
    buttonGradient: 'from-violet-500 to-purple-500',
  },
  {
    category: 'anime',
    icon: Tv,
    iconColor: 'text-pink-600',
    bgGradient: 'from-pink-200 to-fuchsia-200',
    buttonGradient: 'from-pink-500 to-fuchsia-500',
  },
  {
    category: 'games',
    icon: Gamepad2,
    iconColor: 'text-emerald-600',
    bgGradient: 'from-emerald-200 to-teal-200',
    buttonGradient: 'from-emerald-500 to-teal-500',
  },
  {
    category: 'goods',
    icon: Gift,
    iconColor: 'text-rose-600',
    bgGradient: 'from-rose-200 to-pink-200',
    buttonGradient: 'from-rose-500 to-pink-500',
  },
  {
    category: 'skills',
    icon: GraduationCap,
    iconColor: 'text-sky-600',
    bgGradient: 'from-sky-200 to-blue-200',
    buttonGradient: 'from-sky-500 to-blue-500',
  },
];

export default function EncounterPage() {
  const router = useRouter();
  const { traitCount, isLoading } = useTraits();
  usePageHeader({ title: 'であう' });

  const unlockedCount = ENCOUNTER_CATEGORIES.filter(
    cat => traitCount >= ENCOUNTER_UNLOCK_RULES[cat].requiredTraits,
  ).length;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">

        {/* サブタイトル */}
        <p className="mb-6 text-center text-sm text-stone-500">
          集めた特徴からぴったりのモノ・コトとであう
        </p>

        {isLoading ? (
          <div className="glass-card p-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm" />
              <p className="text-sm text-stone-500">特徴データを読み込み中...</p>
            </div>
          </div>
        ) : (
          <>
            {/* 進捗サマリー */}
            <div className="glass-card mb-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-stone-700">
                    集めた特徴: <span className="font-bold text-emerald-600">{traitCount}個</span>
                  </span>
                  <span className="mx-2 text-stone-300">|</span>
                  <span className="text-sm text-stone-500">
                    解放済み <span className="font-bold text-emerald-600">{unlockedCount}</span>/{ENCOUNTER_CATEGORIES.length}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-400 transition-all duration-500"
                  style={{ width: `${Math.round((unlockedCount / ENCOUNTER_CATEGORIES.length) * 100)}%` }}
                />
              </div>
            </div>

            {/* カテゴリ一覧 */}
            <div className="space-y-4">
              {ENCOUNTER_MENU.map(({ category, icon: Icon, iconColor, bgGradient, buttonGradient }) => {
                const rule = ENCOUNTER_UNLOCK_RULES[category];
                const isUnlocked = traitCount >= rule.requiredTraits;
                const remaining = rule.requiredTraits - traitCount;
                const progress = Math.min(100, Math.round((traitCount / rule.requiredTraits) * 100));

                if (isUnlocked) {
                  return (
                    <div key={category} className="glass-card rounded-2xl p-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${bgGradient}`}>
                          <Icon size={24} className={iconColor} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-stone-800">
                            {rule.icon} {rule.label}とのであい
                          </h3>
                          <p className="text-sm text-stone-500">{rule.description}</p>
                        </div>
                        <button
                          onClick={() => router.push(`/encounter/${category}`)}
                          className={`flex-shrink-0 rounded-xl bg-gradient-to-r ${buttonGradient} px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg`}
                        >
                          はじめる
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={category} className="relative rounded-2xl border border-stone-200/60 bg-white/60 p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-stone-100">
                        <Icon size={24} className="text-stone-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-stone-400">
                          {rule.icon} {rule.label}とのであい
                        </h3>
                        <p className="text-sm text-stone-300">{rule.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl bg-stone-50/80 p-3">
                      <p className="mb-2 text-xs font-bold text-stone-500">🔓 解放条件</p>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-stone-500">
                          特徴 {rule.requiredTraits}個以上
                        </span>
                        <span className="text-xs font-bold text-stone-400">
                          {traitCount}/{rule.requiredTraits}（あと{remaining}個）
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-stone-300 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 特徴が少ない場合の誘導 */}
            {traitCount < 5 && (
              <button
                onClick={() => router.push('/dig')}
                className="mt-6 flex w-full items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 transition-all hover:bg-emerald-50"
              >
                <span className="text-sm text-emerald-700">特徴をもっと集めて、であいを解放しよう</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  ほる <ArrowRight size={14} />
                </span>
              </button>
            )}

            {/* アフィリエイト注記 */}
            <p className="mt-6 text-center text-xs text-stone-400">
              ※ 商品リンクにはアフィリエイトリンクを含みます
            </p>
          </>
        )}
      </div>
    </div>
  );
}
