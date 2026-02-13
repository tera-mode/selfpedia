// 職業カテゴリ
export type OccupationCategory =
  | '会社員'
  | '経営者'
  | '自営業'
  | '公務員'
  | 'フリーランス'
  | '主婦/主夫'
  | '学生（小学生）'
  | '学生（中学生）'
  | '学生（高校生）'
  | '学生（大学生）'
  | '学生（大学院生）'
  | '無職'
  | 'その他';

// 性別
export type Gender = '男性' | '女性' | 'その他';

// インタビュワーID
export type InterviewerId = 'female_01' | 'male_01';

// インタビューモード
export type InterviewMode = 'basic' | 'self-pr' | 'manual';

// アウトプットタイプ
export type OutputType = 'sns-profile' | 'self-pr' | 'resume' | 'self-image' | 'talk-with-self' | 'catchcopy' | 'career-match' | 'rarity';

// アウトプットステータス
export type OutputStatus = 'draft' | 'published' | 'archived';

// インタビュワー情報
export interface Interviewer {
  id: InterviewerId;
  gender: '女性' | '男性';
  character: string;
  tone: string;
  avatarUrl?: string;
  description: string;
  ageImage?: string; // 年齢イメージ（例: "28歳"）
  speechPatterns?: {
    basic: string[];
    surprise: string[];
    empathy: string[];
    admiration: string[];
    curiosity: string[];
  };
}

// 固定key（全ユーザー共通の基本情報）
// 簡素化版: nickname（呼び名）とoccupation（職業）のみ必須
export interface FixedUserData {
  nickname: string; // 呼び名（AIが抽出した適切な呼び方）
  occupation: string; // 職業（仕事/学生など）
  selectedInterviewer: InterviewerId;
  // 以下は後で別フォームで取得（現在は未使用）
  name?: string;
  gender?: Gender;
  age?: number;
  location?: string;
  occupationDetail?: string;
}

// 変動key（インタビュー中に収集される情報）
export interface DynamicDataItem {
  question: string;
  answer: string;
  category: string;
}

export interface DynamicData {
  [key: string]: DynamicDataItem;
}

// インタビューデータ全体
export interface InterviewData {
  fixed: FixedUserData;
  dynamic: DynamicData;
  createdAt: Date;
  updatedAt: Date;
}

// チャットメッセージ
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// インタビューセッション
export interface InterviewSession {
  id: string;
  userId?: string; // ログインユーザーの場合のみ
  interviewerId: InterviewerId;
  mode?: InterviewMode; // インタビューモード（新規追加）
  messages: ChatMessage[];
  data: Partial<InterviewData>;
  status: 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

// アウトプット
export interface InterviewOutput {
  article: string; // インタビュー記事（800〜1500字）
  selfPR?: string; // 自己PR文（300〜400字）Phase 2以降
  matchingProfile?: string; // マッチングアプリ用（200〜300字）Phase 2以降
  snsProfile?: string; // SNSプロフィール（50〜100字）Phase 2以降
  generatedAt: Date;
}

// ユーザープロフィール（新規追加）
export interface UserProfile {
  nickname: string;              // 呼び名（必須）
  occupation: string;            // 職業
  onboardingCompleted: boolean;  // 初回設定完了フラグ
}

// ユーザーのインタビュワー設定（新規追加）
export interface UserInterviewer {
  id: InterviewerId;             // 選択中のインタビュワーID
  customName: string;            // ユーザーがつけた呼び名
  customPersonality?: string;    // カスタマイズされた性格（任意）
}

// ユーザーデータ（Firestore保存用）- 拡張版
export interface UserData {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;

  // 新規追加: プロフィール情報
  profile?: UserProfile;

  // 新規追加: インタビュワー設定
  interviewer?: UserInterviewer;

  // 後方互換性のため残す（非推奨）
  interviewerName?: string;

  interviews: InterviewSession[];
  createdAt: Date;
  lastLoginAt: Date;
}

// アウトプット（新規追加）
export interface Output {
  id: string;
  userId: string;
  type: OutputType;

  sourceData: {
    traits: import('./trait').UserTrait[];
    interviewIds: string[];
    generatedAt: Date;
  };

  content: {
    title?: string;
    body: string;
  };

  isEdited: boolean;
  editedContent?: string;
  status: OutputStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ゲストセッション（LocalStorage/Cookie保存用）
export interface GuestSession {
  sessionId: string;
  interview?: InterviewSession;
  createdAt: Date;
  expiresAt: Date;
}

// 自分画像（Self Image）
export interface SelfImage {
  id: string;
  userId: string;
  squareImageUrl: string;     // スクエア画像URL
  prompt?: string;            // 生成に使用したプロンプト
  situation?: string;         // 選ばれたシチュエーション（英語）
  reason?: string;            // 生成理由（日本語）
  traitsUsed: string[];       // 使用した特徴のID配列
  generatedAt: Date;
  createdAt: Date;
}

// 特徴カード関連の型をエクスポート
export * from './trait';
