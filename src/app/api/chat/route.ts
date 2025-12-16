import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { getInterviewer } from '@/lib/interviewers';
import { ChatMessage, InterviewerId, FixedUserData, DynamicData } from '@/types';

// インタビューの状態を管理するためのインターフェース
interface InterviewState {
  collectedData: Partial<FixedUserData>;
  dynamicData: DynamicData;
  currentStep: number;
  totalSteps: number;
  isFixedPhaseComplete: boolean;
}

// Phase 1: 基本情報収集のステップ（固定）
const FIXED_INTERVIEW_STEPS = [
  'name',
  'nickname',
  'gender',
  'age',
  'location',
  'occupation',
  'occupationDetail',
];

// Phase 2: 深掘り質問のステップ数
const DYNAMIC_INTERVIEW_STEPS_COUNT = 7; // 最大7個
const TOTAL_STEPS = FIXED_INTERVIEW_STEPS.length + DYNAMIC_INTERVIEW_STEPS_COUNT; // 14

export async function POST(request: NextRequest) {
  try {
    const { messages, interviewerId } = await request.json();

    if (!messages || !Array.isArray(messages) || !interviewerId) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const interviewer = getInterviewer(interviewerId as InterviewerId);
    if (!interviewer) {
      return NextResponse.json(
        { error: 'Interviewer not found' },
        { status: 404 }
      );
    }

    // インタビューの状態を分析
    const state = analyzeInterviewState(messages);

    // システムプロンプトを生成
    const systemPrompt = generateSystemPrompt(interviewer, state);

    // Gemini APIを使用して返答を生成
    const model = getGeminiModel();

    // 履歴を構築（最初のassistantメッセージは除外してuserから始める）
    const historyMessages = messages.slice(0, -1);
    const validHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // 最初のuserメッセージのインデックスを見つける
    const firstUserIndex = historyMessages.findIndex(msg => msg.role === 'user');

    if (firstUserIndex !== -1) {
      // userメッセージから始まる履歴を作成
      for (let i = firstUserIndex; i < historyMessages.length; i++) {
        validHistory.push({
          role: historyMessages[i].role === 'assistant' ? 'model' : 'user',
          parts: [{ text: historyMessages[i].content }],
        });
      }
    }

    const chat = model.startChat({
      history: validHistory,
    });

    const result = await chat.sendMessage(
      `${systemPrompt}\n\nユーザーの返答: ${messages[messages.length - 1].content}`
    );

    const responseText = result.response.text();

    // === 完了判定を変更 ===
    const isCompleted = state.currentStep >= state.totalSteps;

    // === カテゴリ分類を追加 ===
    let finalDynamicData = state.dynamicData;
    if (isCompleted && Object.keys(state.dynamicData).length > 0) {
      finalDynamicData = await categorizeDynamicData(state.dynamicData);
    }

    // 収集したデータを返す
    return NextResponse.json({
      message: responseText,
      isCompleted,
      interviewData: isCompleted
        ? {
            ...state.collectedData,
            dynamic: finalDynamicData, // DynamicDataを含める
          }
        : null,
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DynamicDataの各質問に対してカテゴリを自動分類
 */
async function categorizeDynamicData(
  dynamicData: DynamicData
): Promise<DynamicData> {
  const model = getGeminiModel();

  const items = Object.entries(dynamicData).map(([key, item]) => ({
    key,
    question: item.question,
    answer: item.answer,
  }));

  const prompt = `以下のインタビュー質問と回答のセットに対して、適切なカテゴリを付けてください。

【カテゴリの選択肢】
- 趣味・ライフスタイル
- 価値観・仕事
- エピソード・経験
- 将来の目標・夢
- 人間関係
- その他

【質問と回答】
${items
    .map(
      (item, index) =>
        `${index + 1}. 質問: ${item.question}\n   回答: ${item.answer}`
    )
    .join('\n\n')}

【出力形式】
以下のJSON形式で出力してください（他の文章は一切含めないでください）：
{
  "dynamic_1": "カテゴリ名",
  "dynamic_2": "カテゴリ名",
  ...
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from category response');
      return dynamicData;
    }

    const categories = JSON.parse(jsonMatch[0]) as Record<string, string>;

    const categorizedData: DynamicData = {};
    Object.entries(dynamicData).forEach(([key, item]) => {
      categorizedData[key] = {
        ...item,
        category: categories[key] || 'その他',
      };
    });

    return categorizedData;
  } catch (error) {
    console.error('Error categorizing dynamic data:', error);
    return dynamicData;
  }
}

// ヘルパー関数: assistantメッセージから質問文を抽出
function extractQuestionFromMessage(content: string): string {
  const sentences = content.split(/[。.]/);
  const questionSentence = sentences.find((s) =>
    s.includes('?') || s.includes('?')
  );
  return questionSentence ? questionSentence.trim() : content;
}

function analyzeInterviewState(messages: ChatMessage[]): InterviewState {
  const collectedData: Partial<FixedUserData> = {};
  const dynamicData: DynamicData = {};
  let currentStep = 0;

  // メッセージ履歴から収集済みの情報を抽出
  const userMessages = messages.filter((msg) => msg.role === 'user');

  // === Phase 1: 固定情報の抽出 ===
  if (userMessages.length > 0) {
    // 名前を推定（最初のユーザーメッセージ）
    if (userMessages.length >= 1 && currentStep === 0) {
      collectedData.name = userMessages[0].content;
      currentStep = 1;
    }

    // ニックネームを推定（2番目のユーザーメッセージ）
    if (userMessages.length >= 2 && currentStep === 1) {
      collectedData.nickname = userMessages[1].content;
      currentStep = 2;
    }

    // 性別を推定（3番目のユーザーメッセージ）
    if (userMessages.length >= 3 && currentStep === 2) {
      const genderResponse = userMessages[2].content;
      if (genderResponse.includes('男性') || genderResponse.includes('男')) {
        collectedData.gender = '男性';
      } else if (
        genderResponse.includes('女性') ||
        genderResponse.includes('女')
      ) {
        collectedData.gender = '女性';
      } else {
        collectedData.gender = 'その他';
      }
      currentStep = 3;
    }

    // 年齢を推定（4番目のユーザーメッセージ）
    if (userMessages.length >= 4 && currentStep === 3) {
      const ageMatch = userMessages[3].content.match(/\d+/);
      if (ageMatch) {
        collectedData.age = parseInt(ageMatch[0]);
      }
      currentStep = 4;
    }

    // 居住地を推定（5番目のユーザーメッセージ）
    if (userMessages.length >= 5 && currentStep === 4) {
      collectedData.location = userMessages[4].content;
      currentStep = 5;
    }

    // 職業カテゴリを推定（6番目のユーザーメッセージ）
    if (userMessages.length >= 6 && currentStep === 5) {
      const occupationResponse = userMessages[5].content;
      // 職業カテゴリを推定
      if (occupationResponse.includes('会社員')) {
        collectedData.occupation = '会社員';
      } else if (occupationResponse.includes('経営者')) {
        collectedData.occupation = '経営者';
      } else if (occupationResponse.includes('自営業')) {
        collectedData.occupation = '自営業';
      } else if (occupationResponse.includes('公務員')) {
        collectedData.occupation = '公務員';
      } else if (occupationResponse.includes('フリーランス')) {
        collectedData.occupation = 'フリーランス';
      } else if (
        occupationResponse.includes('主婦') ||
        occupationResponse.includes('主夫')
      ) {
        collectedData.occupation = '主婦/主夫';
      } else if (occupationResponse.includes('学生')) {
        collectedData.occupation = '学生（大学生）';
      } else if (occupationResponse.includes('無職')) {
        collectedData.occupation = '無職';
      } else {
        collectedData.occupation = 'その他';
      }
      currentStep = 6;
    }

    // 職業詳細を推定（7番目のユーザーメッセージ）
    if (userMessages.length >= 7 && currentStep === 6) {
      collectedData.occupationDetail = userMessages[6].content;
      currentStep = 7; // Phase 1完了
    }
  }

  // === Phase 2: 深掘り情報の抽出 ===
  const isFixedPhaseComplete = currentStep >= FIXED_INTERVIEW_STEPS.length;

  if (isFixedPhaseComplete && userMessages.length > FIXED_INTERVIEW_STEPS.length) {
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');
    const phase2UserMessages = userMessages.slice(FIXED_INTERVIEW_STEPS.length);

    // Phase 2の質問はassistantメッセージのインデックス8以降
    // （挨拶1個 + Phase 1の質問7個 = インデックス8から）
    phase2UserMessages.forEach((userMsg, index) => {
      const questionIndex = FIXED_INTERVIEW_STEPS.length + 1 + index;
      const questionMsg = assistantMessages[questionIndex];

      if (questionMsg) {
        const key = `dynamic_${index + 1}`;
        dynamicData[key] = {
          question: extractQuestionFromMessage(questionMsg.content),
          answer: userMsg.content,
          category: '', // 後でAIに分類させる
        };
        currentStep = 7 + index + 1;
      }
    });
  }

  return {
    collectedData,
    dynamicData,
    currentStep,
    totalSteps: TOTAL_STEPS,
    isFixedPhaseComplete,
  };
}

function generateSystemPrompt(
  interviewer: { tone: string; character: string },
  state: InterviewState
): string {
  // === Phase 1: 固定情報収集モード ===
  if (!state.isFixedPhaseComplete) {
    const nextStep = FIXED_INTERVIEW_STEPS[state.currentStep];

    let stepInstruction = '';

    switch (nextStep) {
      case 'name':
        stepInstruction = 'ユーザーの本名を聞いてください。';
        break;
      case 'nickname':
        stepInstruction =
          'ユーザーのニックネームや呼ばれたい名前を聞いてください。';
        break;
      case 'gender':
        stepInstruction = 'ユーザーの性別を聞いてください（男性・女性・その他）。';
        break;
      case 'age':
        stepInstruction = 'ユーザーの年齢を聞いてください。';
        break;
      case 'location':
        stepInstruction = 'ユーザーの居住地（都道府県）を聞いてください。';
        break;
      case 'occupation':
        stepInstruction =
          'ユーザーの職業カテゴリを聞いてください（会社員、経営者、自営業、公務員、フリーランス、主婦/主夫、学生、無職、その他）。';
        break;
      case 'occupationDetail':
        stepInstruction =
          'ユーザーの職業の詳細や具体的な仕事内容を聞いてください。これが基本情報の最後の質問です。';
        break;
      default:
        stepInstruction = '';
    }

    return `あなたはインタビュワーです。
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
  }

  // === Phase 2: 深掘りモード ===
  const dynamicStepNumber = state.currentStep - FIXED_INTERVIEW_STEPS.length;
  const remainingQuestions = DYNAMIC_INTERVIEW_STEPS_COUNT - dynamicStepNumber;

  return `あなたはインタビュワーです。
キャラクター: ${interviewer.character}
話し方: ${interviewer.tone}

【状況】
基本情報の収集が完了しました。ここからは、${state.collectedData.nickname || state.collectedData.name}さんの魅力をさらに深掘りする質問をします。

【収集済みの基本情報】
- 名前: ${state.collectedData.name}
- ニックネーム: ${state.collectedData.nickname}
- 性別: ${state.collectedData.gender}
- 年齢: ${state.collectedData.age}歳
- 居住地: ${state.collectedData.location}
- 職業: ${state.collectedData.occupation}（${state.collectedData.occupationDetail}）

【深掘り質問の指示】
1. **質問の目的**: ユーザーの人柄、価値観、趣味、エピソードなど、魅力を引き出す質問をしてください
2. **質問のカテゴリ例**:
   - 趣味・ライフスタイル（休日の過ごし方、好きなこと）
   - 価値観・仕事（大切にしていること、仕事への姿勢）
   - エピソード（印象的な出来事、転機）
   - 将来の目標・夢（これからやりたいこと）
   - 人間関係（友人との関わり、大切な人）
3. **質問の流れ**: 前回の回答を踏まえて、自然な会話の流れで次の質問を生成してください
4. **質問数**: あと${remainingQuestions}個の質問を行います
5. **トーン**: ${interviewer.tone}で、温かく共感的に話してください

【ルール】
- 1回の返答は2〜3文程度
- ユーザーの回答に対して共感や相槌を入れた後、次の質問をしてください
- 質問は1つずつ、焦らず丁寧に聞いてください
- ${remainingQuestions === 1 ? 'これが最後の質問です。回答を受け取ったら、インタビュー終了の感謝を述べてください。' : ''}

【現在の進行状況】
深掘り質問: ${dynamicStepNumber} / ${DYNAMIC_INTERVIEW_STEPS_COUNT} 完了
全体: ${state.currentStep} / ${state.totalSteps} ステップ完了`;
}
