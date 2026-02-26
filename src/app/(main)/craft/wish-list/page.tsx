'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Sparkles, Check, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTraits } from '@/contexts/TraitsContext';
import { usePageHeader } from '@/contexts/PageHeaderContext';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';
import { ProfileFieldKey } from '@/types/profile';
import ProfileRequirementModal from '@/components/ui/ProfileRequirementModal';
import { WishListItem, WishCategory, WISH_CATEGORY_LABELS, WISH_CATEGORY_COLORS } from '@/types/wishList';

const MIN_TRAITS = 5;

export default function WishListPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { traits, traitCount } = useTraits();
  usePageHeader({
    title: 'やりたいことリスト',
    showBackButton: true,
    onBack: () => router.push('/craft'),
  });

  const [items, setItems] = useState<WishListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [error, setError] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  // 自由入力
  const [newItemText, setNewItemText] = useState('');

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // アクションメニュー（長押し）
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // デバウンス保存
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasWishList = items.length > 0;
  const completedItems = items.filter((i) => i.completed);
  const pendingItems = items.filter((i) => !i.completed);

  // 初回ロード
  useEffect(() => {
    if (user && !user.isAnonymous) {
      loadWishList();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadWishList = async () => {
    try {
      setIsLoading(true);
      const res = await authenticatedFetch('/api/craft/wish-list');
      if (res.ok) {
        const data = await res.json();
        if (data.wishList) {
          setItems(data.wishList.items || []);
        }
      }
    } catch (err) {
      console.error('Error loading wish-list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // デバウンス保存
  const debouncedSave = useCallback(
    (updatedItems: WishListItem[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await authenticatedFetch('/api/craft/wish-list', {
            method: 'POST',
            body: JSON.stringify({
              items: updatedItems,
              traitsUsedCount: traitCount,
            }),
          });
        } catch (err) {
          console.error('Error saving wish-list:', err);
        }
      }, 1000);
    },
    [traitCount]
  );

  const updateItems = (updatedItems: WishListItem[]) => {
    setItems(updatedItems);
    debouncedSave(updatedItems);
  };

  // 初回生成
  const handleGenerate = async () => {
    if (!user || user.isAnonymous || traitCount < MIN_TRAITS) return;

    const requiredKeys: ProfileFieldKey[] = ['gender', 'birthYear'];
    const missing = requiredKeys.filter((key) => !userProfile?.[key as keyof typeof userProfile]);
    if (missing.length > 0) {
      setShowProfileModal(true);
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const res = await authenticatedFetch('/api/craft/wish-list/generate', {
        method: 'POST',
        body: JSON.stringify({
          traits,
          userProfile: {
            gender: userProfile?.gender,
            birthYear: userProfile?.birthYear,
            occupation: userProfile?.occupation,
          },
          mode: 'initial',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'リストの生成に失敗しました');
      }

      const data = await res.json();
      const newItems: WishListItem[] = data.items || [];

      // 即座に保存
      const saveRes = await authenticatedFetch('/api/craft/wish-list', {
        method: 'POST',
        body: JSON.stringify({
          items: newItems,
          traitsUsedCount: traitCount,
        }),
      });
      if (!saveRes.ok) throw new Error('保存に失敗しました');

      setItems(newItems);
    } catch (err: unknown) {
      console.error('Error generating wish-list:', err);
      setError(err instanceof Error ? err.message : 'リストの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // 追加AI生成
  const handleAddMore = async () => {
    if (!user || user.isAnonymous || traitCount < MIN_TRAITS || isAddingMore) return;

    setIsAddingMore(true);
    setError('');

    try {
      const res = await authenticatedFetch('/api/craft/wish-list/generate', {
        method: 'POST',
        body: JSON.stringify({
          traits,
          userProfile: {
            gender: userProfile?.gender,
            birthYear: userProfile?.birthYear,
            occupation: userProfile?.occupation,
          },
          existingItems: items,
          mode: 'additional',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '追加生成に失敗しました');
      }

      const data = await res.json();
      const newItems = [...items, ...(data.items || [])];
      updateItems(newItems);
    } catch (err: unknown) {
      console.error('Error adding more:', err);
      setError(err instanceof Error ? err.message : '追加生成に失敗しました');
    } finally {
      setIsAddingMore(false);
    }
  };

  // チェック切り替え
  const handleToggle = (id: string) => {
    setActiveMenuId(null);
    const updated = items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    updateItems(updated);
  };

  // 自由追加
  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    const newItem: WishListItem = {
      id: uuidv4(),
      title: text.slice(0, 20),
      description: '',
      category: 'other',
      completed: false,
      isUserAdded: true,
      createdAt: new Date().toISOString(),
    };
    const updated = [newItem, ...items];
    updateItems(updated);
    setNewItemText('');
  };

  // 削除
  const handleDelete = (id: string) => {
    setActiveMenuId(null);
    const updated = items.filter((item) => item.id !== id);
    updateItems(updated);
  };

  // 編集開始
  const handleStartEdit = (item: WishListItem) => {
    setActiveMenuId(null);
    setEditingId(item.id);
    setEditingText(item.title);
  };

  // 編集確定
  const handleCommitEdit = () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      setEditingId(null);
      return;
    }
    const updated = items.map((item) =>
      item.id === editingId ? { ...item, title: text.slice(0, 20) } : item
    );
    updateItems(updated);
    setEditingId(null);
  };

  // 長押し開始
  const handleLongPressStart = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setActiveMenuId(id);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-4 spinner-warm" />
          <p className="text-sm text-stone-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  const missingProfileKeys: ProfileFieldKey[] = (['gender', 'birthYear'] as ProfileFieldKey[]).filter(
    (key) => !userProfile?.[key as keyof typeof userProfile]
  );

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {/* 未生成状態 */}
        {!hasWishList && !isGenerating && (
          <div className="glass-card p-8 text-center">
            <div className="mb-4 text-5xl">🎯</div>
            <h2 className="mb-2 text-lg font-bold text-stone-800">
              あなたの特徴から
              <br />
              「やりたいかもしれないこと」を
              <br />
              AIが20個提案します
            </h2>
            <p className="mb-6 text-sm text-stone-500">
              使用する特徴:{' '}
              <span className="font-bold text-lime-600">{traitCount}個</span>
              <br />
              <span className="text-xs">性別・年齢を考慮して提案します</span>
            </p>

            {traitCount < MIN_TRAITS ? (
              <>
                <p className="mb-4 text-sm text-stone-500">
                  この機能には特徴が{MIN_TRAITS}個以上必要です（あと{MIN_TRAITS - traitCount}個）
                </p>
                <button
                  onClick={() => router.push('/dig')}
                  className="btn-gradient-primary rounded-xl px-6 py-3 font-semibold text-white"
                >
                  特徴をほりに行く
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                className="rounded-xl bg-gradient-to-r from-lime-500 to-green-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl"
              >
                リストを生成する
              </button>
            )}
          </div>
        )}

        {/* 生成中 */}
        {isGenerating && (
          <div className="glass-card p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 spinner-warm" />
            </div>
            <p className="text-lg font-semibold text-stone-700">AIが考えています...</p>
            <p className="mt-2 text-sm text-stone-500">あなたの特徴から「やりたいかも」を生成中</p>
          </div>
        )}

        {/* リスト表示 */}
        {hasWishList && !isGenerating && (
          <>
            {/* プログレスバー */}
            <div className="glass-card mb-4 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-stone-700">
                  達成 {completedItems.length}/{items.length}
                </span>
                <span className="text-sm font-bold text-lime-600">
                  {Math.round((completedItems.length / items.length) * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-lime-400 to-green-400 transition-all duration-500"
                  style={{ width: `${(completedItems.length / items.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 未完了アイテム */}
            {pendingItems.length > 0 && (
              <div className="mb-4 space-y-2">
                {pendingItems.map((item) => (
                  <WishItemCard
                    key={item.id}
                    item={item}
                    isEditing={editingId === item.id}
                    editingText={editingText}
                    isMenuOpen={activeMenuId === item.id}
                    onToggle={() => handleToggle(item.id)}
                    onLongPressStart={() => handleLongPressStart(item.id)}
                    onLongPressEnd={handleLongPressEnd}
                    onOpenMenu={() => setActiveMenuId(item.id)}
                    onEditingTextChange={setEditingText}
                    onCommitEdit={handleCommitEdit}
                    onStartEdit={() => handleStartEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                    onCloseMenu={() => setActiveMenuId(null)}
                  />
                ))}
              </div>
            )}

            {/* 自由追加フォーム */}
            <div className="glass-card mb-4 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  placeholder="自分でやりたいことを追加..."
                  maxLength={20}
                  className="flex-1 rounded-lg border border-stone-200 bg-white/80 px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                />
                <button
                  onClick={handleAddItem}
                  disabled={!newItemText.trim()}
                  className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-lime-500 to-green-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <Plus size={16} />
                  追加
                </button>
              </div>
            </div>

            {/* 追加AI生成ボタン */}
            <button
              onClick={handleAddMore}
              disabled={isAddingMore}
              className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-lime-300 bg-lime-50 px-6 py-3 font-semibold text-lime-700 transition-all hover:bg-lime-100 disabled:opacity-50"
            >
              {isAddingMore ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime-600 border-t-transparent" />
                  AIが考えています...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  ほかにもAIに考えさせる
                </>
              )}
            </button>

            {/* 完了アイテム */}
            {completedItems.length > 0 && (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-stone-200" />
                  <span className="text-xs font-bold text-stone-400">やったこと</span>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>
                <div className="space-y-2 opacity-60">
                  {completedItems.map((item) => (
                    <WishItemCard
                      key={item.id}
                      item={item}
                      isEditing={editingId === item.id}
                      editingText={editingText}
                      isMenuOpen={activeMenuId === item.id}
                      onToggle={() => handleToggle(item.id)}
                      onLongPressStart={() => handleLongPressStart(item.id)}
                      onLongPressEnd={handleLongPressEnd}
                      onOpenMenu={() => setActiveMenuId(item.id)}
                      onEditingTextChange={setEditingText}
                      onCommitEdit={handleCommitEdit}
                      onStartEdit={() => handleStartEdit(item)}
                      onDelete={() => handleDelete(item.id)}
                      onCloseMenu={() => setActiveMenuId(null)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showProfileModal && (
        <ProfileRequirementModal
          missingKeys={missingProfileKeys}
          onComplete={() => {
            setShowProfileModal(false);
            handleGenerate();
          }}
          onCancel={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}

// ── アイテムカードコンポーネント ──────────────────────────────────

interface WishItemCardProps {
  item: WishListItem;
  isEditing: boolean;
  editingText: string;
  isMenuOpen: boolean;
  onToggle: () => void;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onOpenMenu: () => void;
  onEditingTextChange: (v: string) => void;
  onCommitEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onCloseMenu: () => void;
}

function WishItemCard({
  item,
  isEditing,
  editingText,
  isMenuOpen,
  onToggle,
  onLongPressStart,
  onLongPressEnd,
  onOpenMenu,
  onEditingTextChange,
  onCommitEdit,
  onStartEdit,
  onDelete,
  onCloseMenu,
}: WishItemCardProps) {
  const categoryLabel = WISH_CATEGORY_LABELS[item.category] || item.category;
  const categoryColor = WISH_CATEGORY_COLORS[item.category] || 'bg-stone-100 text-stone-700';

  return (
    <div className="glass-card relative overflow-hidden p-4">
      {/* アクションメニュー（長押し時） */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-white/95 backdrop-blur-sm">
          <button
            onClick={onStartEdit}
            className="flex items-center gap-1.5 rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700"
          >
            <Pencil size={14} />
            編集
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-600"
          >
            <Trash2 size={14} />
            削除
          </button>
          <button
            onClick={onCloseMenu}
            className="flex items-center justify-center rounded-full bg-stone-100 p-2 text-stone-500"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* チェックボックス */}
        <button
          onClick={onToggle}
          onTouchStart={onLongPressStart}
          onTouchEnd={onLongPressEnd}
          onMouseDown={onLongPressStart}
          onMouseUp={onLongPressEnd}
          onMouseLeave={onLongPressEnd}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
            item.completed
              ? 'border-lime-500 bg-lime-500'
              : 'border-stone-300 bg-white hover:border-lime-400'
          }`}
        >
          {item.completed && <Check size={12} className="text-white" />}
        </button>

        {/* テキスト部分 */}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={editingText}
                onChange={(e) => onEditingTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommitEdit();
                  if (e.key === 'Escape') onCloseMenu();
                }}
                maxLength={20}
                className="flex-1 rounded border border-lime-300 bg-white px-2 py-0.5 text-sm focus:outline-none"
              />
              <button
                onClick={onCommitEdit}
                className="rounded bg-lime-500 px-2 py-0.5 text-xs font-semibold text-white"
              >
                保存
              </button>
            </div>
          ) : (
            <p
              className={`text-sm font-semibold text-stone-800 ${item.completed ? 'line-through opacity-50' : ''}`}
            >
              {item.title}
            </p>
          )}

          {item.description && !isEditing && (
            <p className="mt-0.5 text-xs text-stone-500">{item.description}</p>
          )}

          {/* カテゴリバッジ */}
          {!isEditing && (
            <span
              className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}
            >
              {categoryLabel}
            </span>
          )}
        </div>

        {/* 編集/削除トリガー */}
        {!isEditing && !isMenuOpen && (
          <button
            onClick={onOpenMenu}
            className="flex-shrink-0 rounded-full p-1 text-stone-300 hover:text-stone-500"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
