// ジャンル定義
export type StoryGenre =
  | 'growth'     // 成長物語
  | 'romance'    // ロマンス
  | 'fantasy'    // ファンタジー
  | 'sci-fi'     // SF
  | 'mystery';   // ミステリー

export const STORY_GENRE_CONFIG: Record<StoryGenre, {
  label: string;
  icon: string;
  description: string;
  bgGradient: string;
}> = {
  growth: {
    label: '成長物語',
    icon: '🌱',
    description: '日常を舞台に、あなたが一歩踏み出す物語',
    bgGradient: 'from-emerald-200 to-teal-200',
  },
  romance: {
    label: 'ロマンス',
    icon: '💐',
    description: '不器用なあなたの恋と出会いの物語',
    bgGradient: 'from-rose-200 to-pink-200',
  },
  fantasy: {
    label: 'ファンタジー',
    icon: '⚔️',
    description: '異世界で冒険するあなたの英雄譚',
    bgGradient: 'from-purple-200 to-indigo-200',
  },
  'sci-fi': {
    label: 'SF',
    icon: '🚀',
    description: '未来の世界であなたが直面する選択の物語',
    bgGradient: 'from-cyan-200 to-blue-200',
  },
  mystery: {
    label: 'ミステリー',
    icon: '🔍',
    description: '謎を解き明かすあなたの推理物語',
    bgGradient: 'from-amber-200 to-orange-200',
  },
};

// 選択肢（現在未使用・将来復活用に保持）
// export interface StoryChoice {
//   id: string;                   // 'choice_1', 'choice_2', 'choice_3'
//   text: string;                 // 選択肢の表示テキスト（20〜40文字）
//   alignment: string;            // 対応する性格傾向（例: 'high_openness'）
//   consequenceHint: string;      // ネタバレなしのヒント（10〜20文字）
// }

// エピソード
export interface StoryEpisode {
  episodeNumber: number;        // 1〜3
  title: string;                // エピソードタイトル
  body: string;                 // 本文（800〜1,500文字）
  // choices?: StoryChoice[];   // 将来復活用に保持
  // chosenChoiceId?: string;   // 将来復活用に保持
  generatedAt: Date;
}

// ストーリーステート（エピソード間の整合性管理）
export interface StoryState {
  protagonist: {
    name: string;               // 主人公名（ユーザーのニックネーム）
    emotionalState: string;     // 現在の感情状態
    relationships: Record<string, {
      name: string;
      role: string;             // 同僚、恋人候補、師匠 等
      trust: number;            // 0-100
      affection: number;        // 0-100
    }>;
    knowledgeGained: string[];  // 物語内で得た知識・気づき
    personalGrowth: string;     // 成長の現在地
  };
  plotThreads: {
    active: Array<{
      id: string;
      description: string;
      introducedIn: number;     // 何話で導入されたか
    }>;
    resolved: Array<{
      id: string;
      resolution: string;
      resolvedIn: number;
    }>;
  };
  worldSettings: {
    time: string;               // 物語内の時間
    location: string;           // 現在の場所
    season: string;             // 季節
  };
}

// シリーズアウトライン（Stage1で生成）
export interface StoryOutline {
  seriesTitle: string;
  protagonistSheet: {
    name: string;               // ユーザーのニックネーム or 生成名
    personality: string;        // 性格要約
    motivation: string;         // 行動の動機
    flaw: string;               // 欠点・課題
    arc: string;                // 第1話→第3話での変化
  };
  supportingCharacters: Array<{
    name: string;
    role: string;
    personality: string;
    relationship: string;       // 主人公との関係
  }>;
  episodes: Array<{
    number: number;
    title: string;
    summary: string;            // 200文字のあらすじ
    dramaticFunction: string;   // 導入/展開・危機/解決
    keyScenes: string[];        // 主要シーンの概要
    plotThreadsIntroduced: string[];
    plotThreadsResolved: string[];
    emotionalBeat: string;      // この話の感情的クライマックス
    cliffhanger?: string;       // 引きの概要（最終話以外）
  }>;
  themes: string[];             // テーマ（「自分を信じる」等）
  motifs: string[];             // モチーフ（「回転寿司」「猫のブローチ」等）
}

// 物語データ（Firestoreに保存）
export interface Story {
  id: string;
  userId: string;
  genre: StoryGenre;
  theme?: string;               // ユーザー選択のテーマ（任意）
  outline: StoryOutline;
  episodes: StoryEpisode[];
  storyState: StoryState;
  status: 'generating' | 'in_progress' | 'completed' | 'error';
  currentEpisode: number;       // 現在何話まで生成済みか
  traitsUsed: string[];         // 使用した特徴のID配列
  traitCount: number;           // 生成時の特徴数
  reflectedTraits: Array<{      // 反映された特徴の説明
    traitLabel: string;
    icon: string;
    reflection: string;         // どう反映されたかの説明
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 品質チェック結果
export interface QualityCheckResult {
  scores: Record<string, number>;
  averageScore: number;
  weaknesses: string[];
  suggestions: string[];
}
