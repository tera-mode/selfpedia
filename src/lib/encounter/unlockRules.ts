import { EncounterCategory } from '@/types/encounter';

// 解放条件（アンロックシステム）
// 特徴数に応じて段階的にカテゴリが解放される

export const ENCOUNTER_UNLOCK_RULES: Record<EncounterCategory, {
  requiredTraits: number;
  label: string;
  icon: string;
  description: string;
}> = {
  books:  { requiredTraits: 5,  label: '本',     icon: '📚', description: 'あなたに合う本とであおう' },
  movies: { requiredTraits: 10, label: '映画',   icon: '🎬', description: 'あなたに合う映画とであおう' },
  anime:  { requiredTraits: 10, label: 'アニメ', icon: '📺', description: 'あなたに合うアニメとであおう' },
  games:  { requiredTraits: 12, label: 'ゲーム', icon: '🎮', description: 'あなたに合うゲームとであおう' },
  goods:  { requiredTraits: 15, label: 'モノ',   icon: '🎁', description: 'あなたに合うモノとであおう' },
  skills: { requiredTraits: 20, label: '学び',   icon: '📖', description: 'あなたに合う学びとであおう' },
};

export const ENCOUNTER_CATEGORIES: EncounterCategory[] = ['books', 'movies', 'anime', 'games', 'goods', 'skills'];
