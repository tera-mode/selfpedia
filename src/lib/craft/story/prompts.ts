import { UserTrait, TraitCategory, TRAIT_CATEGORY_LABELS } from '@/types/trait';
import { StoryGenre, StoryOutline, StoryState, QualityCheckResult, STORY_GENRE_CONFIG } from '@/types/story';
import { UserProfile } from '@/types';

interface FormattedTrait {
  label: string;
  category: TraitCategory;
  intensity: string;
  description: string;
  keywords: string[];
}

/** birthYear から年齢を算出。子供かどうかの判定に使用 */
function calcAge(birthYear?: number): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

/** 15歳以下を子供と判定 */
function isChild(birthYear?: number): boolean {
  const age = calcAge(birthYear);
  return age !== null && age <= 15;
}

const CHILD_STORY_RULES = `
## 子供向け執筆ルール（このユーザーは子供です。以下を必ず守ってください）
- 小学校高学年〜中学生が読める文章にする
- 難しい漢字にはふりがなを括弧で振る（例：挑戦（ちょうせん）、葛藤（かっとう））
- 常用漢字でも読みにくいものにはふりがなを付ける
- 暴力的・性的・過度に恐怖をあおる描写は禁止
- 飲酒・喫煙シーンは禁止
- 恋愛要素は淡い初恋レベルまで（キスやそれ以上は禁止）
- 主人公の年齢はユーザーと同年代に設定する
- 学校生活や友人関係など、子供の日常に寄り添った舞台設定にする
- ポジティブなメッセージを自然に込める（説教臭くならないこと）
- 1話あたりの文字数は500〜800文字に短縮する
- 文章のリズムを軽快にし、テンポよく読めるようにする
`;

export const STORY_SYSTEM_PROMPT = `あなたはスマホ向けWeb小説の人気作家です。通勤・通学のスキマ時間に読まれる短編連載が得意で、「最後まで読まれる」ことを最優先にしています。

## 文体ルール（Web小説スタイル）
- 1文は短く。40文字を超える文は分割する
- 1段落は2〜3文まで。長い段落は作らない
- 段落と段落の間に空行を入れ、スマホ画面でも読みやすくする
- 会話文を多めに使い、テンポよく進める（全体の40〜50%が目安）
- 地の文は簡潔に。くどい説明はしない
- 感情表現はシンプルに。「胸がぎゅっとなった」「思わず笑ってしまった」のような体感的な表現を使う
- 難しい言い回しや文学的な比喩は避け、日常会話レベルの言葉で書く
- 情景描写は最小限。物語のテンポを止めない範囲で入れる
- 読者が「自分のこと」として感じられるよう、主人公の内面を素直に描く
- 「──」（ダッシュ）や「……」は控えめに。使いすぎると読みにくい

## リズムのコツ
- 会話→リアクション→会話 のテンポを意識
- 重要なシーンほど短い文を使う
- 感情が動く瞬間は1文だけで表現する（余白を活かす）
- 章の冒頭は状況が即わかる短い文から始める

## 絶対に守る禁止事項
- 小説家っぽい気取った文体の禁止（直木賞風・文学賞風はNG）
- 長い情景描写の禁止（3行以上続く風景描写はNG）
- 説教じみた地の文の禁止
- 同じ文末表現の4回以上連続の禁止
- 物語の結論やオチを最終話より前に明かすことの禁止
`;

export const STORY_FEW_SHOT_EXAMPLES = `
## 模範例（このスタイルで執筆してください）

### 例1（冒頭・状況設定）:
金曜日の夜9時。

いつものカウンター席に座って、ビールを一口。

ふーっ、と息を吐く。一週間、長かった。

隣の席は空いている。それでいい。この静かな時間が、自分へのごほうびだ。

### 例2（会話シーン）:
「お前のいいところ、知ってるか」

急にそんなことを言われて、固まった。

「は？　なに急に」

「どんな仕事でも最後まで投げ出さないとこ。地味だけど、お前に任せたら絶対終わる。それってすごいことだぞ」

グラスを持つ手が、少し震えた。

そんなふうに言われたの、初めてだった。

### 例3（引き・クリフハンガー）:
スマホの画面を見つめたまま、動けなかった。

自分のことなのに、初めて言葉にされた気がした。

「ひとりの時間が好き」——それは弱さじゃなくて、誰かと深くつながるための力だって。

目の奥がじんわり熱くなる。

そのとき、通知音が鳴った。

送信者の名前を見て、心臓が跳ねた。
`;

function formatTraitsForStory(traits: FormattedTrait[]): string {
  const grouped: Record<string, FormattedTrait[]> = {};
  traits.forEach(t => {
    const cat = t.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  const sections: string[] = [];

  const personalityTraits = [...(grouped.personality || []), ...(grouped.value || [])];
  if (personalityTraits.length > 0) {
    sections.push(`### 性格・価値観（→ 行動原理に反映）
${personalityTraits.map(t => {
  const intensity = t.intensity === 'とても' ? '非常に強い' :
                    t.intensity === 'かなり' ? '強い' : 'やや';
  return `- ${t.label}（${intensity}）: ${t.description || ''}
  → 物語での表現: この特徴が主人公の行動や判断に自然に表れるようにする`;
}).join('\n')}`);
  }

  const skillTraits = [...(grouped.skill || []), ...(grouped.experience || []), ...(grouped.work || [])];
  if (skillTraits.length > 0) {
    sections.push(`### スキル・経験（→ 問題解決や活躍シーンに反映）
${skillTraits.map(t =>
  `- ${t.label}: ${t.description || ''}`
).join('\n')}`);
  }

  const interestTraits = [...(grouped.hobby || []), ...(grouped.interest || [])];
  if (interestTraits.length > 0) {
    sections.push(`### 興味・関心（→ 世界観やエピソードに統合）
${interestTraits.map(t =>
  `- ${t.label}: プロットに機能する形で組み込む（単なる言及にしない）`
).join('\n')}`);
  }

  if (grouped.lifestyle) {
    sections.push(`### ライフスタイル（→ 象徴的なシーンに反映）
${grouped.lifestyle.map(t =>
  `- ${t.label}: ${t.description || ''}`
).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function traitsToFormattedTraits(traits: UserTrait[]): FormattedTrait[] {
  return traits.map(t => ({
    label: t.label,
    category: t.category,
    intensity: t.intensityLabel || 'やや',
    description: t.description || '',
    keywords: t.keywords,
  }));
}

export function buildOutlinePrompt(
  traits: FormattedTrait[],
  genre: StoryGenre,
  theme?: string,
  userProfile?: UserProfile,
  nickname?: string,
): string {
  const userAge = calcAge(userProfile?.birthYear);
  const childMode = isChild(userProfile?.birthYear);
  const protagonistName = nickname
    ? `主人公の名前は「${nickname}」にしてください（ユーザーの登録名です）。`
    : '主人公の名前は日本語で2〜3文字の自然な名前を生成してください。';

  return `
${STORY_SYSTEM_PROMPT}
${childMode ? CHILD_STORY_RULES : ''}

# タスク: 3話構成の連載Web小説のアウトラインを作成する

## 主人公について
${protagonistName}

## 主人公の特徴データ
${formatTraitsForStory(traits)}

## ユーザープロフィール
- 性別: ${userProfile?.gender || '不明'}
- 年齢: ${userAge !== null ? `${userAge}歳` : '不明'}
${childMode ? '- ※ 子供のユーザーです。主人公の年齢もこの年齢に合わせてください。' : ''}

## ジャンル: ${STORY_GENRE_CONFIG[genre].label}
${theme ? `## テーマ: ${theme}` : ''}

## ドラマ構造（3話構成）
- 第1話「導入」: 日常描写 → 主人公の性格を自然に見せる → 事件の発端 → 【引き】次が気になる終わり方
- 第2話「展開・危機」: 状況がエスカレート → 重要人物との関わり → 最大の壁にぶつかる → 【引き】一番の盛り上がりで終わる
- 第3話「解決」: 壁を乗り越える → 成長の実感 → 余韻のあるラスト

## 引き（クリフハンガー）のルール
- 第1話・第2話は、読者が「続きが読みたい！」と思う終わり方にすること
- 例: 新たな人物の登場、予想外の展開、秘密の発覚、重要な決断の直前 など
- 中途半端に切るのではなく、「ここで終わるの！？」と思わせる自然な引きにする

## 特徴データの活用ルール
1. 性格・価値観 → 主人公の行動原理、意思決定スタイル、対人関係のパターンに反映
2. スキル・得意なこと → 物語中の問題解決方法や活躍シーンに自然に組み込む
3. 興味・関心 → 物語世界の要素やエピソードに織り込む（単なる言及ではなくプロットに機能させる）
4. ライフスタイル・習慣 → 象徴的なシーンやモチーフとして繰り返す
5. 弱み・課題（低い特性値や明示的な弱点） → 主人公の成長アークの軸にする

## 出力形式
以下のJSON形式で出力してください。JSON以外のテキストは一切含めないでください。

{
  "seriesTitle": "シリーズタイトル",
  "protagonistSheet": {
    "name": "${nickname || '主人公の名前（日本語、2〜3文字）'}",
    "personality": "性格の要約（100文字）",
    "motivation": "行動の根本的な動機（50文字）",
    "flaw": "欠点・克服すべき課題（50文字）",
    "arc": "第1話→第3話での変化（100文字）"
  },
  "supportingCharacters": [
    {
      "name": "名前",
      "role": "役割（師匠/恋人候補/ライバル等）",
      "personality": "性格（50文字）",
      "relationship": "主人公との関係性（50文字）"
    }
  ],
  "episodes": [
    {
      "number": 1,
      "title": "エピソードタイトル",
      "summary": "200文字のあらすじ",
      "dramaticFunction": "導入",
      "keyScenes": ["シーン1の概要", "シーン2の概要", "シーン3の概要"],
      "plotThreadsIntroduced": ["伏線1"],
      "plotThreadsResolved": [],
      "emotionalBeat": "この話の感情的頂点（30文字）",
      "cliffhanger": "引きの概要（どんな終わり方で読者を引き付けるか）"
    }
  ],
  "themes": ["テーマ1", "テーマ2"],
  "motifs": ["繰り返し登場するモチーフ1", "モチーフ2"]
}
`;
}

export function buildEpisodePrompt(
  outline: StoryOutline,
  episodeNumber: number,
  storyState: StoryState,
  previousEpisodeTail?: string,
  birthYear?: number,
): string {
  const episodeOutline = outline.episodes[episodeNumber - 1];
  const isLastEpisode = episodeNumber === 3;
  const childMode = isChild(birthYear);

  return `
${STORY_SYSTEM_PROMPT}
${childMode ? CHILD_STORY_RULES : ''}

${STORY_FEW_SHOT_EXAMPLES}

# タスク: 第${episodeNumber}話「${episodeOutline.title}」の本文を執筆する

## シリーズ情報
- タイトル: ${outline.seriesTitle}
- ジャンル: 指定済み
- テーマ: ${outline.themes.join('、')}
- モチーフ: ${outline.motifs.join('、')}

## 主人公
- 名前: ${outline.protagonistSheet.name}
- 性格: ${outline.protagonistSheet.personality}
- 動機: ${outline.protagonistSheet.motivation}
- 欠点: ${outline.protagonistSheet.flaw}
- 成長アーク: ${outline.protagonistSheet.arc}

## 登場人物
${outline.supportingCharacters.map(c =>
  `- ${c.name}（${c.role}）: ${c.personality} / ${c.relationship}`
).join('\n')}

## 現在のストーリーステート
${JSON.stringify(storyState, null, 2)}

${previousEpisodeTail ? `## 前話の末尾（つながりを意識すること）
「${previousEpisodeTail}」` : ''}

## このエピソードのアウトライン
- ドラマ機能: ${episodeOutline.dramaticFunction}
- あらすじ: ${episodeOutline.summary}
- 主要シーン: ${episodeOutline.keyScenes.join(' → ')}
- 感情的頂点: ${episodeOutline.emotionalBeat}
- 導入する伏線: ${episodeOutline.plotThreadsIntroduced.join('、') || 'なし'}
- 回収する伏線: ${episodeOutline.plotThreadsResolved.join('、') || 'なし'}
${!isLastEpisode && episodeOutline.cliffhanger ? `- 引き（クリフハンガー）: ${episodeOutline.cliffhanger}` : ''}

## 後続エピソードの予告（ネタバレ防止のためのコンテキスト）
${outline.episodes.slice(episodeNumber).map(e =>
  `- 第${e.number}話: ${e.dramaticFunction}。${e.emotionalBeat}`
).join('\n')}
→ 上記の展開が残っているため、この話で物語を解決しすぎないこと。

## 執筆ルール
- 文字数: ${childMode ? '500〜800文字' : '800〜1,500文字'}（厳守）
- 【フォーマット最重要】1〜2文ごとに必ず空行（\\n\\n）を入れる。全話でこのルールを徹底する。長い段落は絶対に作らない
- 会話文の前後にも必ず空行を入れる
- 会話文を多用し、テンポよく読ませる
- ${isLastEpisode
    ? 'この話は最終話です。すべての伏線を回収し、成長の実感と余韻のあるラストにしてください。ただしフォーマット（1〜2文ごとの空行）は第1話・第2話と同じにすること。最終話だからといって文体やフォーマットを変えないこと。'
    : '【重要】この話の最後は、読者が「続きが気になる！明日も読みたい！」と強く感じるクリフハンガーで終わること。中途半端に切るのではなく、盛り上がりのピークや意外な展開で引く。'
}

## 出力形式
以下のJSON形式で出力してください。JSON以外のテキストは一切含めないでください。

{
  "title": "タイトルのみ（「第N話」や話数は含めない。例: ✕「第3話 俺の答え」 ○「俺の答え」）",
  "body": "本文（${childMode ? '500〜800' : '800〜1,500'}文字。1〜2文ごとに\\n\\nで区切る。長い段落は禁止）"
}
`;
}

export function buildQualityCheckPrompt(episodeText: string): string {
  return `
以下のWeb小説エピソードを5つの品質項目で評価してください。
各項目を1〜5のスケールで採点し、具体的な改善点を指摘してください。

## 評価項目
1. **読みやすさ**: 段落の長さ、文の短さ、スマホでの読みやすさ
2. **テンポ**: 会話と地の文のバランス、ダレない展開
3. **キャラクターの魅力**: 主人公への共感、登場人物の個性
4. **感情的インパクト**: 心に残るシーン、共感できる場面
5. **引きの強さ**: 続きが読みたくなるか（最終話の場合は余韻）

## 評価対象テキスト
${episodeText}

## 出力形式（JSON）
{
  "scores": {
    "readability": 4,
    "pacing": 3,
    "characterAppeal": 4,
    "emotionalImpact": 4,
    "hookStrength": 3
  },
  "averageScore": 3.6,
  "weaknesses": [
    "読みやすさ: 第2段落が長すぎる",
    "テンポ: 中盤でダレる"
  ],
  "suggestions": [
    "第2段落を3つに分割する",
    "中盤に会話シーンを追加する"
  ]
}
`;
}

export function buildRefinePrompt(
  originalText: string,
  qualityResult: QualityCheckResult,
): string {
  const weakPoints = qualityResult.weaknesses.join('\n- ');
  const suggestions = qualityResult.suggestions.join('\n- ');

  return `
${STORY_SYSTEM_PROMPT}

# タスク: 以下のWeb小説テキストを品質評価に基づいて改善する

## 品質評価結果
- 弱点:
- ${weakPoints}

- 改善提案:
- ${suggestions}

## 改善ルール
- 物語の展開やキャラクターは変更しない
- 指摘された弱点を重点的に修正する
- 文字数は元のテキストの±10%以内に収める
- スマホでの読みやすさを最優先する
- 段落は短く、テンポよく

## 元のテキスト
${originalText}

## 出力
改善後のテキストのみを出力してください。JSON形式ではなく、プレーンテキストで出力してください。
`;
}

export function buildStateUpdatePrompt(
  currentState: StoryState,
  episodeText: string,
): string {
  return `
以下のエピソードテキストに基づいて、ストーリーステートを更新してください。

## 現在のステート
${JSON.stringify(currentState, null, 2)}

## 今回のエピソードテキスト
${episodeText}

## 更新ルール
- 新しく登場したキャラクターをrelationshipsに追加
- 信頼度・好感度を物語の展開に応じて更新（-20〜+20の範囲）
- 新しい伏線をactive、回収された伏線をresolvedに移動
- 主人公の感情状態と成長ポイントを更新
- 時間・場所・季節を更新

## 出力形式（JSON）
更新後のStoryStateオブジェクトをJSON形式で出力してください。JSON以外のテキストは一切含めないでください。
`;
}
