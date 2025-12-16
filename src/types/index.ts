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

// インタビュワー情報
export interface Interviewer {
  id: InterviewerId;
  gender: '女性' | '男性';
  character: string;
  tone: string;
  avatarUrl?: string;
  description: string;
}

// 固定key（全ユーザー共通の基本情報）
export interface FixedUserData {
  name: string;
  nickname: string;
  gender: Gender;
  age: number;
  location: string;
  occupation: OccupationCategory;
  occupationDetail: string;
  selectedInterviewer: InterviewerId;
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

// ユーザーデータ（Firestore保存用）
export interface UserData {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  interviewerName?: string; // ユーザーがつけたインタビュワーの名前
  interviews: InterviewSession[];
  createdAt: Date;
  lastLoginAt: Date;
}

// ゲストセッション（LocalStorage/Cookie保存用）
export interface GuestSession {
  sessionId: string;
  interview?: InterviewSession;
  createdAt: Date;
  expiresAt: Date;
}
