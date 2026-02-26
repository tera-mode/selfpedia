// やりたいことリストのカテゴリ
export type WishCategory =
  | 'experience'   // 体験・冒険
  | 'skill'        // スキル・学び
  | 'creative'     // 創作・表現
  | 'social'       // 人間関係・社会
  | 'lifestyle'    // 暮らし・習慣
  | 'career'       // 仕事・キャリア
  | 'other';       // その他

export const WISH_CATEGORY_LABELS: Record<WishCategory, string> = {
  experience: '体験・冒険',
  skill: 'スキル・学び',
  creative: '創作・表現',
  social: '人間関係・社会',
  lifestyle: '暮らし・習慣',
  career: '仕事・キャリア',
  other: 'その他',
};

export const WISH_CATEGORY_COLORS: Record<WishCategory, string> = {
  experience: 'bg-orange-100 text-orange-700',
  skill: 'bg-blue-100 text-blue-700',
  creative: 'bg-purple-100 text-purple-700',
  social: 'bg-pink-100 text-pink-700',
  lifestyle: 'bg-green-100 text-green-700',
  career: 'bg-teal-100 text-teal-700',
  other: 'bg-stone-100 text-stone-700',
};

// やりたいことリストの項目
export interface WishListItem {
  id: string;
  title: string;         // やりたいこと（20文字以内）
  description: string;   // 補足説明（40文字以内）
  category: WishCategory;
  completed: boolean;
  isUserAdded: boolean;  // ユーザー手動追加かAI生成か
  createdAt: string;     // ISO文字列
}

// Firestoreに保存するドキュメント
export interface WishList {
  id: string;
  userId: string;
  items: WishListItem[];
  traitsUsedCount: number;
  createdAt: string;
  updatedAt: string;
}
