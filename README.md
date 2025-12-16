# あなたのインタビュワー

AIインタビュワーがユーザーを有名人のようにインタビューし、魅力を引き出して「インタビュー記事」や「各種プロフィール文」を生成するサービス

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| サービス名 | あなたのインタビュワー |
| ドメイン | your-interviewer.jp |
| コンセプト | AIインタビュワーがユーザーを有名人のようにインタビューし、魅力を引き出して「インタビュー記事」や「各種プロフィール文」を生成 |

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS 4 |
| データベース | Firebase Firestore |
| ストレージ | Firebase Storage |
| 認証 | Firebase Auth (Google, Email/Password, Anonymous) |
| ホスティング | Vercel |
| AI | Gemini API (gemini-2.0-flash-exp) |
| メール送信 | Brevo (Phase 2以降) |

## 環境構築

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定：

```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-interviewer.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-interviewer
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-interviewer.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin (サーバーサイドのみ)
FIREBASE_ADMIN_PROJECT_ID=your-interviewer
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-interviewer.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Firebase Console設定

#### 認証設定
1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト「your-interviewer」を選択
3. **Authentication** → **Sign-in method** で以下を有効化：
   - Google認証
   - Email/Password認証
   - 匿名認証（ゲストユーザー用）

#### Firestore設定
1. **Firestore Database** を作成
2. セキュリティルールを設定（本番環境では適切なルールに変更）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のデータのみ読み書き可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // インタビューは作成者のみ読み書き可能
    match /interviews/{interviewId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス

### 5. ビルド

```bash
npm run build
```

## ディレクトリ構造

```
your-interviewer/
├── public/
│   └── image/                    # 画像ファイル
│       ├── lady-interviewer.png
│       ├── icon_lady-interviewer.png
│       ├── man-interviewer.png
│       └── icon_man-interviewer.png
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # APIルート
│   │   │   ├── chat/             # チャット処理
│   │   │   ├── generate-article/ # 記事生成
│   │   │   ├── save-interview/   # インタビュー保存
│   │   │   ├── save-interviewer-name/ # インタビュワー名保存
│   │   │   ├── get-interviews/   # インタビュー取得
│   │   │   └── get-user-interviews/ # ユーザーのインタビュー一覧取得
│   │   ├── home/                 # HOMEページ（ログイン後起点）
│   │   ├── login/                # ログインページ
│   │   ├── select-interviewer/   # インタビュワー選択
│   │   ├── interview/            # インタビューページ
│   │   ├── result/               # 結果ページ
│   │   ├── mypage/               # マイページ
│   │   ├── page.tsx              # LPページ
│   │   ├── layout.tsx            # ルートレイアウト
│   │   └── providers.tsx         # プロバイダー設定
│   ├── components/               # 共通コンポーネント
│   │   └── UserHeader.tsx        # ユーザーヘッダー
│   ├── contexts/                 # React Context
│   │   └── AuthContext.tsx       # 認証コンテキスト
│   ├── lib/                      # ライブラリ・ユーティリティ
│   │   ├── firebase/
│   │   │   ├── config.ts         # Firebase Client設定
│   │   │   └── admin.ts          # Firebase Admin設定
│   │   ├── gemini.ts             # Gemini API設定
│   │   └── interviewers.ts       # インタビュワー設定
│   └── types/                    # TypeScript型定義
│       └── index.ts
├── .env.local                    # 環境変数（gitignoreに含む）
├── .gitignore
├── package.json
└── README.md
```

## ユーザーフロー

```
[1] LP表示（/）
    ├─ ゲスト利用 → Firebase匿名認証で自動ログイン
    └─ ログイン利用 → Firebase Auth (Google / Email+Password)
    ↓
[2] HOMEページ（/home）← ログイン後の起点
    ├─ 新しいインタビュー開始
    └─ マイページへ（ログインユーザーのみ）
    ↓
[3] インタビュワー選択（/select-interviewer）※初回のみ
    ├─ 女性インタビュワー
    └─ 男性インタビュワー
    ↓
[4] AIチャットインタビュー（/interview）
    ├─ Step 0: インタビュワーに名前をつける（初回のみ）
    ├─ Phase 1: 基本情報の収集（固定7ステップ）
    │   └─ 名前、ニックネーム、性別、年齢、居住地、職業、職業詳細
    └─ Phase 2: 深掘り質問（動的7ステップ）
        └─ AIが生成する個別最適化された質問
    ↓
[5] Firestore保存（全ユーザー共通）
    ├─ インタビュー完了時に自動保存
    └─ 保存されたIDで結果ページにリダイレクト
    ↓
[6] アウトプット生成・表示（/result）
    ├─ インタビュー記事（800〜1500字）
    ├─ 記事のコピー機能
    └─ （Phase 2-2: 自己PR、マッチングプロフィール、SNSプロフィール）
    ↓
[7] マイページ（/mypage）※ログインユーザーのみ
    ├─ 過去のインタビュー一覧
    ├─ インタビュー詳細表示
    └─ ログアウト（LP /に戻る）
```

## データ構造

### 固定key（全ユーザー共通の基本情報）

```typescript
interface FixedUserData {
  name: string;              // 氏名
  nickname: string;          // ニックネーム
  gender: '男性' | '女性' | 'その他';
  age: number;               // 年齢
  location: string;          // 居住地（都道府県）
  occupation: OccupationCategory;  // 職業カテゴリ
  occupationDetail: string;  // 職業詳細
  selectedInterviewer: InterviewerId;
}
```

**職業カテゴリ**: 会社員、経営者、自営業、公務員、フリーランス、主婦/主夫、学生（小学生〜大学院生）、無職、その他

### 深掘り情報（動的データ）

```typescript
interface DynamicDataItem {
  question: string;   // AIが生成した質問
  answer: string;     // ユーザーの回答
  category: string;   // AIが自動分類したカテゴリ
}

interface DynamicData {
  [key: string]: DynamicDataItem;  // dynamic_1, dynamic_2, ...
}
```

**カテゴリ例**: 趣味・ライフスタイル、価値観・仕事、エピソード・経験、将来の目標・夢、人間関係、その他

### Firestoreデータ構造

```
/users/{userId}
  - uid: string
  - email?: string
  - displayName?: string
  - interviewerName?: string  # ユーザーがつけたインタビュワーの名前
  - createdAt: Timestamp
  - lastLoginAt: Timestamp

/interviews/{interviewId}
  - userId: string
  - interviewerId: 'female_01' | 'male_01'
  - messages: ChatMessage[]
  - data: {
      fixed: FixedUserData
      dynamic: DynamicData
      createdAt: Timestamp
      updatedAt: Timestamp
    }
  - status: 'in_progress' | 'completed'
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

## API仕様

### POST /api/chat

チャット処理（インタビュー進行）

**Request:**
```json
{
  "messages": ChatMessage[],
  "interviewerId": "female_01" | "male_01"
}
```

**Response:**
```json
{
  "message": "string",
  "isCompleted": boolean,
  "interviewData": FixedUserData | null
}
```

### POST /api/generate-article

インタビュー記事生成

**Request:**
```json
{
  "interviewData": FixedUserData
}
```

**Response:**
```json
{
  "article": "string"
}
```

### POST /api/save-interview

インタビューをFirestoreに保存（ログインユーザーのみ）

**Request:**
```json
{
  "userId": "string",
  "interviewData": FixedUserData,
  "messages": ChatMessage[],
  "interviewerId": "female_01" | "male_01",
  "sessionId": "string"
}
```

**Response:**
```json
{
  "success": boolean,
  "interviewId": "string"
}
```

### GET /api/get-user-interviews?userId={userId}

ユーザーのインタビュー一覧を取得（ログインユーザーのみ）

**Response:**
```json
{
  "success": boolean,
  "interviews": Interview[]
}
```

### GET /api/get-interview?id={interviewId}

インタビューデータをIDで取得

**Response:**
```json
{
  "success": boolean,
  "data": {
    "fixed": FixedUserData,
    "dynamic": DynamicData
  },
  "interview": InterviewSession
}
```

### POST /api/save-interviewer-name

インタビュワー名を保存（ログインユーザーのみ）

**Request:**
```json
{
  "userId": "string",
  "interviewerName": "string"
}
```

**Response:**
```json
{
  "success": boolean
}
```

## インタビュワー設定

| ID | 性別 | キャラクター | 口調 |
|----|------|-------------|------|
| female_01 | 女性 | かわいい・親しみやすい | 丁寧だけどフレンドリー |
| male_01 | 男性 | かっこいい・知的 | 落ち着いた敬語 |

**名前のカスタマイズ**:
- ユーザーが初回インタビュー時にインタビュワーに自由に名前をつけられる
- 名前はCookie（365日）とFirestore（ログインユーザーのみ）に保存
- 2回目以降のインタビューでは同じ名前が使用される

**画像ファイル**:
- `/public/image/` に保存
- アイコン: 丸抜き（48px × 48px）
- 選択画面: 矩形（600px高さ）

## 開発ルール

### 作業方針
1. **日本語でのコミュニケーション**: やり取りは日本語で行う
2. **段階的な実装**: Phase 1 → Phase 2 → Phase 3 の順で実装
3. **既存コード参考**: ふるソナ（`Documents/furusona`）のコード構造を流用
4. **デプロイ禁止**: GitHub Push / Vercel デプロイは指示があるまで行わない

### コーディング規約
- TypeScriptの型を明示的に定義
- コンポーネントは'use client'ディレクティブを適切に使用
- APIルートはエラーハンドリングを徹底
- 環境変数は`.env.local`で管理（`.gitignore`に含める）

### 機密情報管理
- APIキー、秘密鍵は`.env.local`のみに記載
- 公開リポジトリにコミットしない
- Firebaseサービスアカウント鍵は絶対に公開しない

## 実装済み機能

### ✅ Phase 1 完了
- [x] LPページ
- [x] ログイン機能（Google、Email/Password）
- [x] インタビュワー選択ページ
- [x] インタビューページ（チャットUI、基本7ステップ）
- [x] 結果ページ（インタビュー記事生成）
- [x] Firestore連携（全ユーザーのデータ保存）
- [x] 認証コンテキスト（AuthContext）

### ✅ Phase 2-1 完了（深掘りインタビュー機能）
- [x] Firebase匿名認証（ゲストユーザー自動ログイン）
- [x] 深掘り質問機能（AIが動的に7つの質問を生成）
- [x] カテゴリ自動分類（AIが質問を6つのカテゴリに分類）
- [x] Firestore直接保存方式（Cookie依存からの脱却）
- [x] URLパラメータでの結果表示（/result?id={interviewId}）
- [x] マイページ（過去のインタビュー一覧）
- [x] インタビュー詳細ページ（/mypage/interview/[id]）
- [x] HOMEページ（ログイン後の起点ページ）
- [x] 導線整理（LP→HOME、ログアウト→LP）
- [x] インタビュワー名カスタマイズ機能（初回に名前付け）
- [x] インタビュワー選択の初回のみ化（2回目以降は自動選択）
- [x] ユーザーヘッダー（ログイン状態表示、HOME/マイページへの導線）
- [x] UI改善（インタビューページのアイコン配置、名前表示の最適化）

### 📋 Phase 2-2（予定）
- [ ] 4種類のアウトプット生成
  - [ ] 自己PR文（300〜400字）
  - [ ] マッチングアプリ用プロフィール（200〜300字）
  - [ ] SNSプロフィール（50〜100字）
- [ ] タブUIで複数アウトプット切り替え表示
- [ ] シェア機能（Twitter、LINE、URL公開リンク）

### 📋 Phase 3（予定）
- [ ] メール送信機能（Brevo）
- [ ] 定期実行（GitHub Actions）
- [ ] プロフィール編集機能
- [ ] インタビュー再編集機能

## トラブルシューティング

### ビルドエラー

```bash
npm run build
```

エラーが出た場合、TypeScriptの型エラーやインポートエラーを確認

### Firebase接続エラー

1. `.env.local`の環境変数を確認
2. Firebase Consoleで認証方法が有効化されているか確認
3. Firestoreのセキュリティルールを確認

### Gemini APIエラー

- `GEMINI_API_KEY`が正しく設定されているか確認
- APIキーの有効期限を確認
- レート制限に達していないか確認

### 開発サーバーエラー

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## よくある質問

### Q: ゲストユーザーのデータはどこに保存される？
A: Firebase匿名認証で自動ログインし、Firestoreに保存されます。ブラウザのキャッシュをクリアすると匿名ユーザーIDが失われ、過去のデータにアクセスできなくなります。

### Q: ログインユーザーのデータは？
A: Firestoreに永続的に保存され、マイページでいつでも確認できます。複数デバイスからアクセス可能です。

### Q: インタビューは何回まで実施できる？
A: 制限なし。全てのインタビューがFirestoreに保存されます。ログインユーザーはマイページで全ての履歴を確認可能。

### Q: 深掘り質問はどう決まる？
A: AIが基本情報とこれまでの回答を分析し、ユーザーの魅力を引き出す質問を動的に生成します。

### Q: 記事の再生成はできる？
A: 現在（Phase 2-1）は不可。Phase 3で再編集機能を実装予定。

## ライセンス

非公開プロジェクト

## 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
