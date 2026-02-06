# 開発メモ - じぶん図鑑

このドキュメントは、開発作業を進める際の詳細な技術仕様とメモをまとめたものです。

## 目次
- [現在の実装状況](#現在の実装状況)
- [技術的な詳細](#技術的な詳細)
- [既知の問題](#既知の問題)
- [次回作業項目](#次回作業項目)
- [開発tips](#開発tips)

## 現在の実装状況

### Phase 1: MVP完了 ✅

#### 認証システム
- **AuthContext** (`src/contexts/AuthContext.tsx`)
  - Google認証
  - Email/Password認証（新規登録・ログイン）
  - 認証状態の管理
  - ユーザー情報の取得

#### ページ構成
1. **LPページ** (`src/app/page.tsx`)
   - ゲスト/ログイン選択
   - サービス説明

2. **ログインページ** (`src/app/login/page.tsx`)
   - タブ切り替え（ログイン⇄新規登録）
   - メール/パスワードフォーム
   - Google認証ボタン
   - エラーハンドリング

3. **インタビュワー選択** (`src/app/select-interviewer/page.tsx`)
   - 画像選択形式（矩形、600px高さ）
   - 2人のインタビュワー（あかり・けんと）
   - 選択後、インタビューページへ遷移

4. **インタビューページ** (`src/app/interview/page.tsx`)
   - チャットUI
   - メッセージの送受信
   - インタビュー進行管理
   - 完了時、結果ページへ遷移

5. **結果ページ** (`src/app/result/page.tsx`)
   - インタビュー記事の表示
   - コピー機能
   - ログインユーザー: Firestoreに自動保存
   - 新しいインタビューを始めるボタン

6. **マイページ** (`src/app/mypage/page.tsx`)
   - 過去のインタビュー一覧
   - ログアウト機能
   - 新しいインタビューを始めるボタン

#### APIルート
1. **POST /api/chat** (`src/app/api/chat/route.ts`)
   - Gemini APIでインタビュー進行
   - 7つの固定質問（名前、ニックネーム、性別、年齢、居住地、職業、職業詳細）
   - 履歴管理（userロールから始まるように調整）
   - インタビュー完了判定

2. **POST /api/generate-article** (`src/app/api/generate-article/route.ts`)
   - Gemini APIで記事生成
   - 800〜1500字のインタビュー記事
   - 雑誌風の紹介文形式

3. **POST /api/save-interview** (`src/app/api/save-interview/route.ts`)
   - Firestoreにインタビューデータを保存
   - ログインユーザーのみ
   - usersコレクションとinterviewsコレクションを更新

4. **GET /api/get-interviews** (`src/app/api/get-interviews/route.ts`)
   - ユーザーのインタビュー一覧を取得
   - createdAtで降順ソート

#### ライブラリ・ユーティリティ
- **Firebase Client** (`src/lib/firebase/config.ts`)
  - クライアントサイドのFirebase初期化
  - Auth, Firestore, Storageの初期化

- **Firebase Admin** (`src/lib/firebase/admin.ts`)
  - サーバーサイドのFirebase初期化
  - 環境変数から秘密鍵を取得

- **Gemini API** (`src/lib/gemini.ts`)
  - Gemini APIクライアントの初期化
  - gemini-2.0-flash-expモデルを使用

- **インタビュワー設定** (`src/lib/interviewers.ts`)
  - インタビュワーの定義
  - getInterviewer関数

#### 型定義
- **TypeScript型** (`src/types/index.ts`)
  - FixedUserData: 基本情報
  - DynamicData: 変動情報（Phase 2で使用）
  - InterviewSession: インタビューセッション
  - ChatMessage: チャットメッセージ
  - Interviewer: インタビュワー情報

## 技術的な詳細

### Gemini API統合

#### チャット履歴の管理
Gemini APIのチャット履歴は**userロールから始まる必要がある**ため、以下の処理を実装：

```typescript
// 最初のassistantメッセージ（挨拶）を除外してuserロールから始める
const historyMessages = messages.slice(0, -1);
const validHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

const firstUserIndex = historyMessages.findIndex(msg => msg.role === 'user');

if (firstUserIndex !== -1) {
  for (let i = firstUserIndex; i < historyMessages.length; i++) {
    validHistory.push({
      role: historyMessages[i].role === 'assistant' ? 'model' : 'user',
      parts: [{ text: historyMessages[i].content }],
    });
  }
}
```

#### システムプロンプト
インタビュワーのキャラクターと次の質問ステップをプロンプトに含める：

```typescript
const systemPrompt = `あなたは${interviewer.name}というインタビュワーです。
キャラクター: ${interviewer.character}
話し方: ${interviewer.tone}

【重要なルール】
1. ${interviewer.tone}で話してください
2. ${interviewer.character}なキャラクターを演じてください
3. 1回の返答は2〜3文程度に抑えてください
4. 相槌や共感を入れて、親しみやすい雰囲気を作ってください
5. 次のステップ: ${stepInstruction}
6. ユーザーの回答に対して簡単にリアクションした後、次の質問をしてください

【現在の進行状況】
${state.currentStep} / ${state.totalSteps} ステップ完了`;
```

### Firebase Firestoreセキュリティルール

現在の設定（開発環境）:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /interviews/{interviewId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

**⚠️ 本番環境では、より厳格なルールに変更する必要がある**

### Cookieによるセッション管理

#### ゲストユーザー
- `guest_session_id`: UUID（30日間有効）
- `selected_interviewer`: インタビュワーID
- `interview_data`: インタビューデータ（JSON）
- `interview_messages`: メッセージ履歴（JSON）

#### ログインユーザー
- Cookieは一時的な保存のみ
- 最終的にFirestoreに保存

### 画像管理

#### ディレクトリ構造
```
public/image/
├── lady-interviewer.png      # 女性インタビュワー（大）
├── icon_lady-interviewer.png # 女性インタビュワー（アイコン）
├── man-interviewer.png        # 男性インタビュワー（大）
└── icon_man-interviewer.png  # 男性インタビュワー（アイコン）
```

#### 使用箇所
- **選択画面**: 大きい画像（矩形、600px高さ）
- **インタビュー画面ヘッダー**: アイコン（丸抜き、48px × 48px）

## 既知の問題

### 1. インタビューデータの抽出精度
現在の実装では、ユーザーの回答から情報を抽出する際、簡易的な文字列マッチングを使用しています。

**改善案**:
- Gemini APIに構造化データを返すように指示
- JSONフォーマットで回答を取得
- より正確なデータ抽出

### 2. エラーハンドリング
現在は基本的なエラーハンドリングのみ実装。

**改善案**:
- より詳細なエラーメッセージ
- リトライ機能
- エラーログの保存（Firestore）

### 3. マイページのインタビュー詳細
現在はインタビュー一覧のみ表示。クリックしても詳細ページが未実装。

**Phase 2で実装予定**:
- `/mypage/interview/[id]` ページの作成
- 過去の記事の再表示
- 再編集機能（Phase 3）

### 4. レスポンシブデザイン
基本的なレスポンシブ対応はあるが、細かい調整が必要。

**改善点**:
- モバイルでのチャットUIの最適化
- タブレットでのレイアウト調整

## 次回作業項目

### 優先度: 高

1. **Firebase Console設定の完了**
   - Email/Password認証の有効化
   - Firestoreセキュリティルールの確認
   - 動作テスト

2. **インタビュー詳細ページの実装**
   ```
   /mypage/interview/[id]
   ```
   - 過去のインタビュー記事の表示
   - 過去のチャット履歴の表示
   - 記事のコピー機能

3. **エラーハンドリングの改善**
   - ネットワークエラー時のリトライ
   - ユーザーフレンドリーなエラーメッセージ
   - エラーログの保存

### 優先度: 中

4. **Phase 2の機能追加**
   - 自己PR文生成（300〜400字）
   - マッチングアプリ用プロフィール生成（200〜300字）
   - SNSプロフィール生成（50〜100字）
   - 結果ページで4種類を切り替え表示

5. **深掘りインタビュー**
   - 変動keyの収集
   - AIが自由に質問を生成
   - カテゴリ分類（趣味、仕事、価値観など）

6. **シェア機能**
   - TwitterでシェアURL
   - Facebookでシェア
   - URLコピー

### 優先度: 低

7. **LINE認証の追加**
   - LINE Login APIの統合
   - AuthContextにsignInWithLINEを追加

8. **メール送信機能（Brevo）**
   - 記事をメールで送信
   - 定期的なリマインダー

9. **プロフィール編集**
   - ユーザー情報の編集
   - アバター画像のアップロード

## 開発Tips

### ローカル開発

#### 開発サーバーの起動
```bash
npm run dev
```

#### ビルドの確認
```bash
npm run build
npm start
```

#### 型チェック
```bash
npx tsc --noEmit
```

### Firestoreデバッグ

#### Firestoreエミュレータの使用（オプション）
```bash
npm install -g firebase-tools
firebase emulators:start
```

`.env.local`に追加：
```env
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=localhost:8080
```

### Gemini APIのテスト

#### curlでのテスト
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "assistant", "content": "こんにちは！", "timestamp": "2024-01-01T00:00:00Z"},
      {"role": "user", "content": "山田太郎です", "timestamp": "2024-01-01T00:00:01Z"}
    ],
    "interviewerId": "female_01"
  }'
```

### デバッグ用のログ

開発中は`console.log`を使用してデバッグ。本番環境では削除または環境変数で制御。

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Debug:', data);
}
```

## 参考コード: ふるソナ

既存プロジェクト「ふるソナ」（`Documents/furusona`）のコード構造を参考にする。

### 参考にした部分
- Firebase設定の構造
- APIルートのエラーハンドリング
- TypeScript型定義の方法
- 認証フローの実装

### 相違点
- ふるソナ: 複数のAIを比較
- じぶん図鑑: インタビュー形式

## Vercelデプロイ（準備中）

### 環境変数の設定
Vercelダッシュボードで以下を設定：
- `NEXT_PUBLIC_*`: 全ての環境
- `FIREBASE_ADMIN_*`: Production環境のみ
- `GEMINI_API_KEY`: Production環境のみ

### ビルド設定
- Framework Preset: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`

### ドメイン設定
- カスタムドメイン: `selfpedia.jp`
- SSL証明書の自動設定

---

**最終更新**: 2024年12月（Phase 1完了時）
