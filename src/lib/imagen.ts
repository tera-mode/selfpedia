import { GoogleGenAI } from '@google/genai';
import { getGeminiModel } from './gemini';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not defined');
}

const genAI = new GoogleGenAI({ apiKey });

/**
 * Imagen 4を使用して画像を生成
 * @param prompt 画像生成用のプロンプト
 * @param aspectRatio アスペクト比（デフォルト: 1:1）
 * @returns 生成された画像のBase64データ
 */
export async function generateImage(
  prompt: string,
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1'
): Promise<Buffer> {
  const response = await genAI.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio,
    },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error('No images were generated');
  }

  const generatedImage = response.generatedImages[0];

  // 画像データをBufferに変換
  if (generatedImage.image?.imageBytes) {
    return Buffer.from(generatedImage.image.imageBytes, 'base64');
  }

  throw new Error('Image data not found in response');
}

/**
 * 特徴データからシチュエーションを4つ生成（Gemini使用）
 */
async function generateSituations(traits: { label: string; keywords: string[] }[]): Promise<string[]> {
  const model = getGeminiModel();
  const topTraits = traits.slice(0, 10);
  const labels = topTraits.map(t => t.label).join('、');
  const keywords = topTraits.flatMap(t => t.keywords).slice(0, 15).join('、');

  const prompt = `以下の特徴を持つ人物が、その個性を発揮しているシチュエーションを4つ考えてください。

特徴: ${labels}
キーワード: ${keywords}

【条件】
- 日常的で親しみやすいシーン
- その人らしさが表れる具体的な行動や場面
- 画像生成に適した視覚的に描写しやすいシーン
- 4つそれぞれ異なるシチュエーション

【出力形式】
以下のJSON形式で出力（他の文章は不要）：
["シチュエーション1の英語説明", "シチュエーション2の英語説明", "シチュエーション3の英語説明", "シチュエーション4の英語説明"]

例：
["reading a book at a cozy cafe by the window", "cooking a creative dish in a warm kitchen", "taking photos of nature during a morning walk", "working on a laptop at a stylish co-working space"]`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // JSONを抽出
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const situations = JSON.parse(jsonMatch[0]) as string[];
      if (situations.length >= 4) {
        return situations;
      }
    }
  } catch (error) {
    console.error('Error generating situations:', error);
  }

  // フォールバック: デフォルトのシチュエーション
  return [
    'enjoying a peaceful moment at a cozy cafe',
    'taking a relaxing walk in a beautiful park',
    'working creatively at a comfortable home office',
    'sharing a warm conversation with friends'
  ];
}

/**
 * 特徴データから画像生成用のプロンプトを作成
 * @param traits 特徴データ
 * @param interviewerGender インタビュワーの性別（ユーザーは逆の性別と推測）
 * @returns プロンプトと選ばれたシチュエーション
 */
export async function buildImagePrompt(
  traits: { label: string; keywords: string[] }[],
  interviewerGender: '男性' | '女性' = '女性'
): Promise<{ prompt: string; situation: string }> {
  const topTraits = traits.slice(0, 10);
  const labels = topTraits.map(t => t.label).join(', ');
  const keywords = topTraits.flatMap(t => t.keywords).slice(0, 15).join(', ');

  // インタビュワーの性別から利用者の性別を推測
  const userGender = interviewerGender === '女性' ? 'male' : 'female';
  const userGenderJp = interviewerGender === '女性' ? '男性' : '女性';

  // 特徴から4つのシチュエーションを生成し、ランダムで1つ選択
  const situations = await generateSituations(topTraits);
  const selectedSituation = situations[Math.floor(Math.random() * situations.length)];

  const prompt = `A portrait of a Japanese ${userGender} (${userGenderJp}) person ${selectedSituation}.

Character traits: ${labels}
Personality keywords: ${keywords}

Art style requirements:
- Semi-realistic illustration style (between photorealistic and anime)
- Warm, inviting color palette with soft lighting
- The person should look approachable and genuine
- Show them actively engaged in the activity, not just posing
- Modern, clean composition suitable for social media profile
- NO TEXT or letters anywhere in the image
- High quality, professional illustration
- The face should be clearly visible and expressive
- Natural Japanese features and appearance`;

  return { prompt, situation: selectedSituation };
}
