import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { verifyAuth } from '@/lib/auth/verifyAuth';

const ttsClient = new TextToSpeechClient({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

// インタビュワーIDに対応するNeural2音声
const VOICE_MAP: Record<string, string> = {
  female_01: 'ja-JP-Neural2-B',    // 女性・明るめ
  male_01: 'ja-JP-Neural2-C',      // 男性・落ち着き
  self: 'ja-JP-Neural2-D',         // 自分AI用（中性的）
  self_female: 'ja-JP-Neural2-A',  // 自分AI用・女性ユーザー向け
};

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.authenticated || !authResult.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text, interviewerId = 'female_01' } = await request.json();
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // 長文は500文字でカット（TTSの応答速度維持のため）
  const truncatedText = text.length > 500 ? text.slice(0, 500) + '…' : text;

  const voiceName = VOICE_MAP[interviewerId] || VOICE_MAP['female_01'];

  const [response] = await ttsClient.synthesizeSpeech({
    input: { text: truncatedText },
    voice: {
      languageCode: 'ja-JP',
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.05, // 少し速め（自然な会話に近づける）
      pitch: 0,
    },
  });

  const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');
  return NextResponse.json({ audioBase64 });
}
