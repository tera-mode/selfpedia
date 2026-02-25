# じぶんクラフト

AIとの会話や診断で自分の特徴を集め、自己PR・プロフィール等のアウトプットを生成するサービス

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| サービス名 | じぶんクラフト（mecraft） |
| ドメイン | mecraft.life |
| コンセプト | AIとの会話や診断で自分の特徴を集め、自己PR・プロフィール等のアウトプットを生成 |

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
| AI | Gemini API (gemini-2.5-flash / gemini-2.5-pro) |
| 音声認識（STT） | Google Cloud Speech-to-Text |
| 音声合成（TTS） | Google Cloud Text-to-Speech |
| アナリティクス | Google Analytics 4 (GA4) |
| 商品検索 | 楽天ウェブサービス（IchibaItem Search API） |
| 映画情報 | TMDb（The Movie Database）API |

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
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id  # GA4でも共用

# Firebase Admin (サーバーサイドのみ・Google Cloud STT/TTSも同じ認証情報を使用)
FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# 楽天ウェブサービス（であう機能）
RAKUTEN_APPLICATION_ID=your_application_id
RAKUTEN_ACCESS_KEY=your_access_key        # 新API(openapi.rakuten.co.jp)用・なければ旧APIを使用
RAKUTEN_AFFILIATE_ID=your_affiliate_id    # アフィリエイトID（省略可）

# TMDb（であう機能・映画カテゴリ）
TMDB_BEARER_TOKEN=your_bearer_token

# ※ RAWG_API_KEY は不要になりました（ゲームカテゴリは楽天ブックスゲームAPIを使用）
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス

### 4. ビルド

```bash
npm run build
```

## ルート構成

5タブ構成のメインUI。`(main)` ルートグループで認証ガード・BottomNav・背景グラデーションを共有。

```
/                          → LP（エメラルドテーマ）
/login                     → ログイン / 新規登録
/debug                     → デバッグ画面（音声・であうキャッシュ・楽天APIテスト等）

(main) ルートグループ（認証必須・BottomNav付き）
├── /dig                   → ほるトップ（メニュー）
│   ├── /dig/swipe         → スワイプ診断
│   ├── /dig/gacha         → ガチャ質問（デイリー掘り下げ）
│   │   └── /result        → 回答結果
│   ├── /dig/metaphor      → 例え質問（デイリー掘り下げ）
│   │   └── /result        → 回答結果
│   ├── /dig/favorites     → 好きなもの質問（デイリー掘り下げ）
│   │   └── /result        → 回答結果
│   └── /dig/interview/
│       ├── select-mode    → モード選択
│       ├── select-interviewer → インタビュワー選択
│       ├── [mode]         → AIチャットインタビュー（音声対応）
│       └── history        → インタビュー履歴
├── /mypage                → じぶん（特徴一覧）
│   ├── /mypage/[traitId]  → 特徴詳細
│   ├── /mypage/settings   → プロフィール・インタビュワー設定
│   └── /mypage/interview/[id] → インタビュー詳細
├── /craft                 → つくるトップ（メニュー）
│   ├── /craft/create      → テキスト生成（自己PR等）
│   ├── /craft/[id]        → アウトプット詳細
│   ├── /craft/self-image  → 自分像生成
│   ├── /craft/talk-with-self → 自分AIと対話（音声対応）
│   ├── /craft/catchcopy   → じぶんキャッチコピー生成
│   ├── /craft/career-match → 適職×市場価値診断
│   ├── /craft/rarity      → じぶんレアリティ診断
│   ├── /craft/story       → じぶん物語（Web小説形式・3話構成）
│   │   └── /[storyId]     → 物語詳細
│   ├── /craft/trait-summary → 特徴サマリー
│   └── /craft/history     → アウトプット履歴
├── /encounter             → であうトップ（カテゴリ選択）
│   └── /encounter/[category] → カテゴリ別レコメンド
│                              books / movies / goods / skills
└── /everyone              → みんな（Coming Soon）
```

### リダイレクト（旧URL互換）

旧パスへのアクセスは新パスにリダイレクト：
`/home`, `/onboarding`, `/result`, `/select-interviewer`,
`/interview/*`, `/output/*`, `/mypage/traits`

## ディレクトリ構造

```
mecraft/
├── public/image/                # インタビュワー画像
├── src/
│   ├── app/
│   │   ├── (main)/              # 認証必須ルートグループ
│   │   │   ├── layout.tsx       # AuthGuard + BottomNav + bg-gradient-main
│   │   │   ├── dig/             # ほるタブ（インタビュー・デイリー掘り下げ）
│   │   │   ├── mypage/          # じぶんタブ
│   │   │   ├── craft/           # つくるタブ（各種アウトプット生成）
│   │   │   ├── encounter/       # であうタブ（パーソナライズ商品推薦）
│   │   │   └── everyone/        # みんなタブ
│   │   ├── api/                 # APIルート
│   │   │   ├── craft/           # つくる系API（career-match / rarity / story）
│   │   │   ├── encounter/       # であう系API（generate / history / cache）
│   │   │   ├── stt/             # 音声→テキスト（Google Cloud STT）
│   │   │   ├── tts/             # テキスト→音声（Google Cloud TTS）
│   │   │   └── daily-dig/       # デイリー掘り下げ質問生成
│   │   ├── debug/               # デバッグ画面（管理者専用）
│   │   ├── login/               # ログインページ
│   │   ├── page.tsx             # LPページ
│   │   ├── layout.tsx           # ルートレイアウト（OGP/SEOメタタグ含む）
│   │   └── providers.tsx        # プロバイダー設定
│   ├── components/
│   │   ├── navigation/          # AppHeader / BottomNav
│   │   ├── encounter/           # であう関連コンポーネント
│   │   ├── interview/           # インタビュー関連コンポーネント
│   │   └── voice/               # 音声機能コンポーネント
│   ├── contexts/
│   │   ├── AuthContext.tsx      # 認証コンテキスト
│   │   ├── PageHeaderContext.tsx # ページヘッダー設定コンテキスト
│   │   └── TraitsContext.tsx    # 特徴データコンテキスト
│   ├── lib/
│   │   ├── firebase/            # Firebase設定（Client / Admin）
│   │   ├── api/
│   │   │   └── authenticatedFetch.ts
│   │   ├── auth/
│   │   │   └── verifyAuth.ts
│   │   ├── encounter/           # であう機能ライブラリ
│   │   │   ├── rakuten.ts       # 楽天市場API（新旧API自動切替）
│   │   │   ├── rakutenBooks.ts  # 楽天ブックス（市場API本ジャンルで代替）
│   │   │   ├── tmdb.ts          # TMDb映画情報API
│   │   │   ├── productCache.ts  # グローバル商品キャッシュ（24h TTL）
│   │   │   ├── rateLimiter.ts   # 外部APIレート制限
│   │   │   └── unlockRules.ts   # カテゴリ解放条件定義
│   │   ├── gemini.ts            # Gemini API設定（リトライ付き）
│   │   ├── interviewers.ts
│   │   ├── interviewModes.ts
│   │   └── outputTypes.ts
│   └── types/
│       ├── index.ts
│       └── encounter.ts         # であう機能の型定義
├── .env.local
└── package.json
```

## デザインシステム

- **カラースキーム**: エメラルド / ティール基調
- **UIスタイル**: グラスモーフィズム（`glass`, `glass-card`, `glass-input` クラス）
- **グラデーション**: `bg-gradient-main`（メイン背景）、`btn-gradient-primary` / `btn-gradient-secondary`
- **装飾**: グラデーションオーブ（`gradient-orb-emerald`, `gradient-orb-amber`）

## 認証フロー

```
LP（/）
├─ ゲストで始める → Firebase匿名認証 → /dig/swipe（スワイプ診断）
├─ 新規登録 → /login?mode=signup → メール or Google登録 → /dig/swipe
└─ ログイン → /login → メール or Googleログイン → /mypage

ゲスト → 本登録（アカウントリンク）
├─ 新規登録タブ → linkWithCredential / linkWithPopup でUID維持 → データ引き継ぎ
└─ ログインタブ → 既存アカウントにサインイン → ゲスト時のデータは失われる
```

## 主要パターン

| パターン | 説明 |
|----------|------|
| `useTraits()` | TraitsContextから特徴データを取得 |
| `useAuth()` | AuthContextから認証状態・操作を取得 |
| `usePageHeader()` | ページ固有のヘッダータイトル・バックボタンを設定 |
| `authenticatedFetch()` | 認証トークン付きAPI呼び出し |
| `verifyAuth()` | サーバーサイドAPIルートでの認証検証 |
| `getGeminiModel()` | Gemini AI呼び出し（リトライロジック付き） |
| `useVoiceChat()` | STT録音・TTS再生・音声モード管理（iOS AudioContext対応） |

## データ構造

### 特徴データ（Traits）

```typescript
interface UserTrait {
  id: string;
  label: string;                 // 例: 「チームワーク重視」
  category: TraitCategory;       // personality | skill | value | interest | experience | goal
  description: string;
  keywords: string[];
  confidence: number;            // 0-1
  intensityLabel: IntensityLabel; // とても | かなり | やや
  icon: string;                  // 絵文字
  extractedAt: Date;
}
```

### Firestoreデータ構造

```
/users/{userId}
  - uid, email, displayName, nickname, occupation
  - interviewerName, selectedInterviewer
  - createdAt, lastLoginAt, updatedAt
  /recommendations/{category}          # であう最新推薦（永続・TTLなし）
    - items: RecommendedItem[]
    - personalityContext: string
    - traitsUsedCount: number
    - generatedAt: Timestamp
  /recommendationHistory/{autoId}      # であう過去履歴（全件保持）
    - category, items, personalityContext, generatedAt

/interviews/{interviewId}
  - userId, interviewerId, mode
  - messages: ChatMessage[]
  - data: { fixed, dynamic, createdAt, updatedAt }
  - traits: UserTrait[]
  - traitsSummary: { totalCount, categoryBreakdown, topTraits }
  - status: 'in_progress' | 'completed'

/productSearchCache/{category_keyword} # グローバル商品キャッシュ（24h TTL・ユーザー横断共有）
  - keyword, category
  - products: CachedProduct[]
  - cachedAt, expiresAt: Timestamp
```

## API一覧

### コア機能

| メソッド | エンドポイント | 概要 |
|----------|---------------|------|
| POST | `/api/chat` | AIチャットインタビュー |
| POST | `/api/chat-with-self` | 自分AIとの対話 |
| POST | `/api/stt` | 音声→テキスト変換（Google Cloud STT） |
| POST | `/api/tts` | テキスト→音声変換（Google Cloud TTS） |
| POST | `/api/daily-dig` | デイリー掘り下げ質問生成 |
| POST | `/api/extract-traits` | 会話から特徴抽出 |
| POST | `/api/save-traits` | 特徴保存 |
| POST | `/api/delete-trait` | 特徴削除 |
| POST | `/api/swipe-diagnose` | スワイプ診断 |
| POST | `/api/generate-output` | テキストアウトプット生成 |
| POST | `/api/generate-self-image` | 自分像生成 |
| POST | `/api/generate-article` | インタビュー記事生成 |
| DELETE | `/api/delete-self-image` | 自分像削除 |
| GET/POST | `/api/outputs` | アウトプット取得 |
| POST | `/api/craft/career-match` | 適職×市場価値診断 |
| POST | `/api/craft/rarity` | じぶんレアリティ診断 |
| POST | `/api/craft/story/generate` | じぶん物語生成（第1話） |
| POST | `/api/craft/story/episode` | 追加エピソード生成 |
| GET | `/api/craft/story/[storyId]` | 物語詳細取得 |
| POST | `/api/save-interview` | インタビュー保存 |
| POST | `/api/save-profile` | プロフィール保存 |
| POST | `/api/save-interviewer-name` | インタビュワー名保存 |
| GET | `/api/get-interviews` | インタビュー一覧取得 |
| GET | `/api/get-user-interviews` | ユーザーのインタビュー一覧 |
| GET | `/api/get-interview` | インタビュー詳細取得 |
| GET | `/api/get-user-data` | ユーザーデータ取得 |
| GET | `/api/get-user-traits` | ユーザー特徴取得 |

### であう機能

| メソッド | エンドポイント | 概要 |
|----------|---------------|------|
| POST | `/api/encounter/generate` | パーソナライズ推薦生成（Gemini+楽天+TMDb） |
| GET | `/api/encounter/history` | 過去推薦履歴取得 |
| GET | `/api/encounter/cached` | キャッシュ済み推薦取得 |
| POST | `/api/encounter/click` | 商品クリックトラッキング |
| GET | `/api/encounter/debug-rakuten` | 楽天API動作確認（開発用） |
| GET/POST | `/api/encounter/debug-cache` | キャッシュ確認・クリア（開発用） |

## であう機能

特徴数に応じてカテゴリが解放され、Gemini AIが特徴を分析してパーソナライズされた商品・コンテンツを推薦する機能。

### 解放条件

| カテゴリ | 必要特徴数 | データソース |
|----------|-----------|-------------|
| 📚 本 | 5個 | 楽天市場（本ジャンル） |
| 🎬 映画 | 10個 | TMDb API |
| 🎁 グッズ | 15個 | 楽天市場 |
| 🛠️ スキルアップ | 20個 | 楽天市場 |

### 推薦フロー

```
1. Gemini AI が特徴データを分析 → 検索キーワード5〜8個を生成
2. 楽天API / TMDb API で商品・映画を検索（グローバルキャッシュ優先）
3. Gemini AI が各アイテムの個別化推薦理由を生成
4. Firestore に保存（TTLなし・永続）→ 次回は即表示
```

### キャッシュ戦略

- **ユーザーキャッシュ** (`/users/{uid}/recommendations/{category}`): 最新推薦を永続保存。画像なしの古いキャッシュは自動破棄・再生成。
- **グローバルキャッシュ** (`/productSearchCache`): キーワード×カテゴリ単位で24時間保持・ユーザー横断で共有。外部APIへのアクセスを最小化。

## インタビュワー設定

| ID | 性別 | キャラクター | 口調 |
|----|------|-------------|------|
| female_01 | 女性 | かわいい・親しみやすい | 丁寧だけどフレンドリー |
| male_01 | 男性 | かっこいい・知的 | 落ち着いた敬語 |

## インタビューモード

| ID | モード名 | 質問数 | 説明 |
|----|----------|--------|------|
| basic | 基本インタビュー | エンドレス | 多角的に深掘りし、様々な魅力を発見 |
| self-pr | 自己PR発見 | 10問 | 仕事での強みや成果にフォーカス |
| manual | わたしの取説 | 10問 | コミュニケーションスタイルや好き嫌いを明確化 |

## 音声機能（STT/TTS）

AIインタビューと自分AIとの対話で音声入出力が利用可能。

- **STT**: Google Cloud Speech-to-Text。WebM(Opus) / MP4(iOS)形式で録音しbase64送信
- **TTS**: Google Cloud Text-to-Speech。インタビュワーごとに音声ボイスを切り替え
- **iOS対応**: `AudioContext` を録音ボタン押下時（ユーザージェスチャー）に作成・解放し、複数async後のTTS再生ブロックを回避
- **UIフロー**: ヘッダーのトグルで音声モードON/OFF → マイクボタンをタップで録音開始、再タップで停止

## トラブルシューティング

### ビルドエラー

ルートディレクトリのリネーム後はキャッシュを削除：
```bash
rm -rf .next
npm run build
```

### Windows環境での注意

`mv` がパーミッションエラーになる場合は `cp -r && rm -rf` を使用。

### Firebase接続エラー

1. `.env.local`の環境変数を確認
2. Firebase Consoleで認証方法が有効化されているか確認
3. Firestoreのセキュリティルールを確認

### STT/TTSが動作しない

1. Firebase AdminのサービスアカウントにGoogle Cloud Speech / TTS APIの権限があるか確認
2. GCPコンソールで `Cloud Speech-to-Text API` と `Cloud Text-to-Speech API` が有効化されているか確認

### 楽天APIで画像が表示されない

- `RAKUTEN_ACCESS_KEY` が設定されている場合は新API（openapi.rakuten.co.jp）を使用。`mediumImageUrls` が文字列配列形式で返る。
- キャッシュに古いデータが残っている場合は `/debug` の「であうデバッグ」タブでクリア可能。
- 429エラー時は3秒待って自動リトライする。

### Firestoreインデックス

`recommendationHistory` の履歴取得には複合インデックスが必要：
- コレクション: `recommendationHistory`
- フィールド: `category` (昇順) + `generatedAt` (降順)

## ライセンス

非公開プロジェクト
