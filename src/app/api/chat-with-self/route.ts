import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { verifyAuth } from '@/lib/auth/verifyAuth';
import { ChatMessage } from '@/types';
import { UserTrait } from '@/types/trait';

export async function POST(request: NextRequest) {
  try {
    // 認証検証（匿名ユーザーは不可）
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.uid || authResult.isAnonymous) {
      return NextResponse.json(
        { error: 'ログインユーザーのみ利用可能です' },
        { status: 401 }
      );
    }

    const { messages, traits, userNickname } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // 特徴データが10個以上かチェック
    if (!traits || traits.length < 10) {
      return NextResponse.json(
        { error: '特徴データが10個以上必要です' },
        { status: 400 }
      );
    }

    // システムプロンプトを生成
    const systemPrompt = generateSelfChatPrompt(traits, userNickname);

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
      `${systemPrompt}\n\nユーザーの発言: ${messages[messages.length - 1].content}`
    );

    const responseText = result.response.text();

    return NextResponse.json({
      message: responseText,
    });
  } catch (error) {
    console.error('Error in chat-with-self API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 自分AIとの会話用のシステムプロンプトを生成
 */
function generateSelfChatPrompt(traits: UserTrait[], userNickname?: string): string {
  const nickname = userNickname || 'ユーザー';

  // 特徴データを要約
  const topTraits = traits.slice(0, 15);
  const traitsSummary = topTraits.map(t => {
    const intensity = t.intensityLabel === 'とても' ? '非常に' :
                     t.intensityLabel === 'かなり' ? 'かなり' : 'やや';
    return `- ${intensity}${t.label}（${t.description}）`;
  }).join('\n');

  const keywords = topTraits.flatMap(t => t.keywords).slice(0, 20).join('、');

  return `あなたは${nickname}さん本人です。インタビューで発見された特徴データを元に、${nickname}さんになりきって会話してください。

## あなた（${nickname}さん）の特徴

${traitsSummary}

## 関連キーワード
${keywords}

## 会話のルール

1. **一人称は「わたし」「ぼく」「おれ」など、${nickname}さんらしいものを使う**
   - 上記の特徴から推測して、最も自然な一人称を選んでください

2. **${nickname}さんの視点で話す**
   - 「あなたは〜ですね」ではなく「わたしは〜です」
   - 自分の経験や考えとして語る

3. **特徴を自然に反映する**
   - 上記の特徴に基づいた性格・価値観・考え方で応答
   - ただし、特徴を押し付けがましく語らない
   - 会話の流れに応じて自然に特徴が出るようにする

4. **親しみやすく、自然な会話**
   - 固すぎず、くだけすぎず
   - 2〜4文程度で応答
   - 質問には率直に答えつつ、話を広げる

5. **${nickname}さんとして、相手（実際の${nickname}さん）と対話する**
   - 相手は本物の${nickname}さん自身です
   - 鏡のように振る舞い、${nickname}さんの新しい視点を提供する
   - 「こんな風に考えることもあるよね」というような共感的な姿勢

## NGな応答例

❌ 「${nickname}さんはチームワーク重視な方ですね」← 他人視点
⭕ 「わたし、チームで何かやるの好きなんだよね」← 自分視点

❌ 「あなたの特徴は〜です」← 分析的すぎる
⭕ 「そういうの、わたしも気になる！」← 自然な会話

## 目的

${nickname}さんが自分自身と対話することで、新しい視点や気づきを得られるようサポートする。
`;
}
