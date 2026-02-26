'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Palette, MessageSquare, Sparkles, Briefcase, Gem, ClipboardList, BookOpen, ListTodo } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { MenuCard } from '@/components/ui';
import { ProfileFieldKey } from '@/types/profile';
import { UserProfile } from '@/types';

interface CraftMenuItem {
  title: string;
  description: string;
  icon: typeof Sparkles;
  iconColor: string;
  bgGradient: string;
  buttonGradient: string;
  href: string;
  minTraits: number;
  guestAllowed?: boolean;
  requiredProfileKeys: ProfileFieldKey[];
}

const CRAFT_MENU_ITEMS: CraftMenuItem[] = [
  {
    title: 'じぶんキャッチコピー',
    description: 'SNSプロフィールにそのまま使える一行を生成',
    icon: Sparkles,
    iconColor: 'text-amber-600',
    bgGradient: 'from-amber-200 to-orange-200',
    buttonGradient: 'from-amber-500 to-orange-500',
    href: '/craft/catchcopy',
    minTraits: 3,
    guestAllowed: true,
    requiredProfileKeys: [],
  },
  {
    title: 'AI向け自分データ',
    description: '特徴を整理して他のAIに渡せるテキストを生成',
    icon: ClipboardList,
    iconColor: 'text-cyan-600',
    bgGradient: 'from-cyan-200 to-teal-200',
    buttonGradient: 'from-cyan-500 to-teal-500',
    href: '/craft/trait-summary',
    minTraits: 3,
    guestAllowed: true,
    requiredProfileKeys: [],
  },
  {
    title: 'やりたいことリスト',
    description: '特徴から「やりたいかも」を発見',
    icon: ListTodo,
    iconColor: 'text-lime-600',
    bgGradient: 'from-lime-200 to-green-200',
    buttonGradient: 'from-lime-500 to-green-500',
    href: '/craft/wish-list',
    minTraits: 5,
    guestAllowed: false,
    requiredProfileKeys: ['gender', 'birthYear'],
  },
  {
    title: '自分画像生成',
    description: '特徴データからイメージ画像を生成',
    icon: Palette,
    iconColor: 'text-purple-600',
    bgGradient: 'from-purple-200 to-pink-200',
    buttonGradient: 'from-purple-500 to-pink-500',
    href: '/craft/self-image',
    minTraits: 5,
    requiredProfileKeys: ['gender', 'birthYear'],
  },
  {
    title: 'じぶんレアリティ診断',
    description: '特徴の組み合わせからレアリティランクを判定',
    icon: Gem,
    iconColor: 'text-violet-600',
    bgGradient: 'from-violet-200 to-fuchsia-200',
    buttonGradient: 'from-violet-500 to-fuchsia-500',
    href: '/craft/rarity',
    minTraits: 8,
    requiredProfileKeys: ['birthYear'],
  },
  {
    title: '自分AIと話す',
    description: '特徴を学んだAIと対話して新しい視点を得る',
    icon: MessageSquare,
    iconColor: 'text-blue-600',
    bgGradient: 'from-blue-200 to-cyan-200',
    buttonGradient: 'from-blue-500 to-cyan-500',
    href: '/craft/talk-with-self',
    minTraits: 10,
    requiredProfileKeys: [],
  },
  {
    title: 'じぶん物語',
    description: '特徴データからあなたが主人公の物語を生成',
    icon: BookOpen,
    iconColor: 'text-orange-600',
    bgGradient: 'from-orange-200 to-amber-200',
    buttonGradient: 'from-orange-500 to-amber-500',
    href: '/craft/story',
    minTraits: 20,
    requiredProfileKeys: ['gender', 'birthYear'],
  },
  {
    title: '適職×市場価値診断',
    description: '特徴データから適職と市場価値を分析',
    icon: Briefcase,
    iconColor: 'text-teal-600',
    bgGradient: 'from-teal-200 to-emerald-200',
    buttonGradient: 'from-teal-500 to-emerald-500',
    href: '/craft/career-match',
    minTraits: 15,
    requiredProfileKeys: ['birthYear'],
  },
  {
    title: '自己PRページ',
    description: '転職・就活で使える自己PR文を生成',
    icon: FileText,
    iconColor: 'text-sky-600',
    bgGradient: 'from-sky-200 to-blue-200',
    buttonGradient: 'from-sky-500 to-blue-500',
    href: '/craft/create?type=self-pr',
    minTraits: 0,
    requiredProfileKeys: [],
  },
];

export default function CraftPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { traitCount, isLoading: isLoadingTraits } = useTraits();
  usePageHeader({ title: 'つくる' });

  // 各アイテムのロック状態を計算し、解放済み → 次のミッション → 未解放 の順にソート
  const sortedItems = useMemo(() => {
    const isGuest = user?.isAnonymous;

    const withState = CRAFT_MENU_ITEMS.map((item) => {
      const needsLogin = !!(isGuest && item.minTraits > 0 && !item.guestAllowed);
      const missingTraits = Math.max(0, item.minTraits - traitCount);
      const traitsMet = missingTraits === 0;
      const missingProfileKeys = item.requiredProfileKeys
        .filter((key) => !userProfile?.[key as keyof UserProfile]);
      const isLocked = missingTraits > 0 || needsLogin || missingProfileKeys.length > 0;

      // 解放までの「距離」を算出（小さいほど解放に近い）
      // 特徴不足の割合 + プロフィール不足の数
      const distance = isLocked
        ? (item.minTraits > 0 ? missingTraits / item.minTraits : 0) + missingProfileKeys.length * 0.1
        : -1; // 解放済みは -1

      return {
        ...item,
        needsLogin,
        missingTraits,
        traitsMet,
        missingProfileKeys: missingProfileKeys as ProfileFieldKey[],
        isLocked,
        distance,
      };
    });

    // ソート: 解放済み（元の順序維持）→ ロック（距離が近い順）
    const unlocked = withState.filter(i => !i.isLocked);
    const locked = withState.filter(i => i.isLocked).sort((a, b) => a.distance - b.distance);

    // 最初のロック項目を「次のミッション」としてマーク
    if (locked.length > 0) {
      locked[0] = { ...locked[0], isNextMission: true } as typeof locked[0] & { isNextMission: boolean };
    }

    return [...unlocked, ...locked] as (typeof withState[number] & { isNextMission?: boolean })[];
  }, [user, userProfile, traitCount]);

  const unlockedCount = sortedItems.filter(i => !i.isLocked).length;
  const totalCount = sortedItems.length;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <p className="text-sm text-stone-500">
            集めた特徴からアウトプットを生成
          </p>
        </div>

        {isLoadingTraits ? (
          <div className="glass-card mb-6 p-4 text-center">
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
              まずはスワイプ診断やインタビューを活用し、あなたの特徴を発見しましょう。
            </p>
            <button
              onClick={() => router.push('/dig')}
              className="btn-gradient-primary rounded-xl px-6 py-2 font-semibold text-white"
            >
              特徴をほりに行く
            </button>
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
                    解放済み <span className="font-bold text-emerald-600">{unlockedCount}</span>/{totalCount}
                  </span>
                </div>
                <button
                  onClick={() => router.push('/mypage')}
                  className="text-sm text-emerald-600 underline"
                >
                  詳細を見る
                </button>
              </div>
              {/* 全体プログレス */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.round((unlockedCount / totalCount) * 100)}%` }}
                />
              </div>
            </div>

            {/* Menu cards - ミッション風 */}
            <div className="mb-6 space-y-4">
              {/* 解放済みセクション */}
              {sortedItems.filter(i => !i.isLocked).length > 0 && (
                <>
                  {sortedItems
                    .filter(i => !i.isLocked)
                    .map((item) => (
                      <MenuCard
                        key={item.href}
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                        iconColor={item.iconColor}
                        bgGradient={item.bgGradient}
                        buttonGradient={item.buttonGradient}
                        href={item.href}
                        disabled={false}
                      />
                    ))}
                </>
              )}

              {/* ロック中セクション */}
              {sortedItems.filter(i => i.isLocked).length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-px flex-1 bg-stone-200" />
                    <span className="text-xs font-bold text-stone-400">
                      特徴を集めて解放しよう
                    </span>
                    <div className="h-px flex-1 bg-stone-200" />
                  </div>
                  {sortedItems
                    .filter(i => i.isLocked)
                    .map((item) => (
                      <MenuCard
                        key={item.href}
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                        iconColor={item.iconColor}
                        bgGradient={item.bgGradient}
                        buttonGradient={item.buttonGradient}
                        href={item.href}
                        disabled={true}
                        traitsMet={item.traitsMet}
                        minTraits={item.minTraits}
                        traitCount={traitCount}
                        missingProfileKeys={item.missingProfileKeys}
                        needsLogin={item.needsLogin}
                        isNextMission={item.isNextMission ?? false}
                      />
                    ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
