import { getGeminiModel } from '@/lib/gemini';
import {
  StoryGenre, StoryOutline, StoryEpisode, StoryState,
  QualityCheckResult,
} from '@/types/story';
import { UserTrait } from '@/types/trait';
import { UserProfile } from '@/types';
import {
  buildOutlinePrompt, buildEpisodePrompt,
  buildQualityCheckPrompt, buildRefinePrompt,
  buildStateUpdatePrompt, traitsToFormattedTraits,
} from './prompts';

const QUALITY_THRESHOLD = 3.5;
const MAX_REFINE_RETRIES = 2;

/**
 * JSON安全パース（Geminiの出力揺れ対策）
 */
function parseJsonResponse<T>(text: string): T {
  // ```json ... ``` の除去
  let cleaned = text.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim();

  // 前後の説明文を除去してJSON部分だけ抽出
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  // まずそのままパースを試みる
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Geminiがよく出す不正JSONの修復を試みる
  }

  // 末尾カンマの除去: ,] → ] , ,} → }
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  // コメント行の除去: // ...
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '');

  // 制御文字の除去（改行・タブ以外）
  cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 最終手段: 括弧のバランスを修正
  }

  // 括弧バランス修復: 閉じ括弧不足の場合に補完
  let braces = 0;
  let brackets = 0;
  for (const ch of cleaned) {
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }
  while (brackets > 0) { cleaned += ']'; brackets--; }
  while (braces > 0) { cleaned += '}'; braces--; }

  return JSON.parse(cleaned) as T;
}

/**
 * Stage 1: アウトライン生成（Gemini 2.5 Pro使用）
 */
export async function generateOutline(
  traits: UserTrait[],
  genre: StoryGenre,
  theme?: string,
  userProfile?: UserProfile,
  nickname?: string,
): Promise<StoryOutline> {
  const model = getGeminiModel('gemini-2.5-pro');
  const prompt = buildOutlinePrompt(
    traitsToFormattedTraits(traits),
    genre,
    theme,
    userProfile,
    nickname,
  );

  // JSONパースエラー時にリトライ（最大2回）
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: attempt === 0 ? 0.8 : 0.6,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        },
      });
      const text = result.response.text().trim();
      console.log(`Outline attempt ${attempt + 1}: response length=${text.length}, finishReason=${result.response.candidates?.[0]?.finishReason}`);
      if (!text || text.length < 10) {
        throw new Error(`Empty or too short response (length=${text.length})`);
      }
      return parseJsonResponse<StoryOutline>(text);
    } catch (error) {
      console.warn(`Outline generation attempt ${attempt + 1} failed:`, error);
      if (attempt === 2) throw error;
    }
  }
  throw new Error('Outline generation failed after 3 attempts');
}

/**
 * Stage 2-4: エピソード生成（品質チェック・推敲込み）
 */
export async function generateEpisode(
  outline: StoryOutline,
  episodeNumber: number,
  storyState: StoryState,
  previousEpisodeTail?: string,
  birthYear?: number,
): Promise<{ episode: StoryEpisode; updatedState: StoryState }> {

  // Stage 2: 本文ドラフト生成（JSONパースエラー時にリトライ）
  const flashModel = getGeminiModel('gemini-2.5-flash');
  const episodePrompt = buildEpisodePrompt(
    outline, episodeNumber, storyState, previousEpisodeTail, birthYear,
  );

  let episodeResult;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await flashModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: episodePrompt }] }],
        generationConfig: {
          temperature: attempt === 0 ? 0.95 : 0.85,
          topP: 0.90,
          topK: 30,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });
      // パースできるか事前確認
      parseJsonResponse<{ title: string; body: string }>(result.response.text());
      episodeResult = result;
      break;
    } catch (error) {
      console.warn(`Episode generation attempt ${attempt + 1} failed:`, error);
      if (attempt === 2) throw error;
    }
  }
  if (!episodeResult) throw new Error('Episode generation failed');

  const episodeData = parseJsonResponse<{
    title: string;
    body: string;
  }>(episodeResult.response.text());

  // Stage 3: 品質チェック
  const checkPrompt = buildQualityCheckPrompt(episodeData.body);
  const checkResult = await flashModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: checkPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });
  const quality = parseJsonResponse<QualityCheckResult>(checkResult.response.text());

  // Stage 4: 推敲（品質閾値未達の場合）
  if (quality.averageScore < QUALITY_THRESHOLD) {
    for (let i = 0; i < MAX_REFINE_RETRIES; i++) {
      const refineModel = i >= 1
        ? getGeminiModel('gemini-2.5-pro')
        : flashModel;

      const refinePrompt = buildRefinePrompt(episodeData.body, quality);
      const refineResult = await refineModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: refinePrompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 8192,
        },
      });

      episodeData.body = refineResult.response.text().trim();

      // 再チェック
      const recheck = await flashModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildQualityCheckPrompt(episodeData.body) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      });
      const recheckResult = parseJsonResponse<QualityCheckResult>(recheck.response.text());

      if (recheckResult.averageScore >= QUALITY_THRESHOLD) {
        break;
      }
    }
    // 推敲上限に達しても続行（ベストエフォート）
  }

  // Stage 5: ステート更新
  const statePrompt = buildStateUpdatePrompt(storyState, episodeData.body);
  const stateResult = await flashModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: statePrompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });
  const updatedState = parseJsonResponse<StoryState>(stateResult.response.text());

  const episode: StoryEpisode = {
    episodeNumber,
    title: episodeData.title,
    body: episodeData.body,
    generatedAt: new Date(),
  };

  return { episode, updatedState };
}

/**
 * 初期StoryStateを作成する
 */
export function createInitialStoryState(outline: StoryOutline): StoryState {
  return {
    protagonist: {
      name: outline.protagonistSheet.name,
      emotionalState: '日常',
      relationships: {},
      knowledgeGained: [],
      personalGrowth: '物語の始まり',
    },
    plotThreads: { active: [], resolved: [] },
    worldSettings: { time: '現在', location: '日常', season: '秋' },
  };
}
