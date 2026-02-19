import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import { verifyAuth } from '@/lib/auth/verifyAuth';

const speechClient = new SpeechClient({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.authenticated || !authResult.uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { audioBase64, encoding = 'WEBM_OPUS' } = await request.json();
  if (!audioBase64) {
    return NextResponse.json({ error: 'audioBase64 is required' }, { status: 400 });
  }

  // encodingに応じてsampleRateHertzを調整
  const sampleRateHertz = encoding === 'MP3' ? 44100 : 48000;

  const [response] = await speechClient.recognize({
    audio: { content: audioBase64 },
    config: {
      encoding: encoding as 'WEBM_OPUS' | 'MP3',
      sampleRateHertz,
      languageCode: 'ja-JP',
      model: 'latest_short',
    },
  });

  const transcript = response.results
    ?.map(r => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join('') || '';

  return NextResponse.json({ transcript });
}
