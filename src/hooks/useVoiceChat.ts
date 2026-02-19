import { useState, useRef, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/api/authenticatedFetch';

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

interface UseVoiceChatOptions {
  interviewerId?: string;
  onTranscript: (text: string) => void;
}

export function useVoiceChat({ interviewerId = 'female_01', onTranscript }: UseVoiceChatOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isVoiceModeOn, setIsVoiceModeOn] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm;codecs=opus');

  // 録音開始
  const startRecording = useCallback(async () => {
    if (voiceState !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // iOSではwebm非対応のためmp4にフォールバック
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setVoiceState('processing');

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // ブラウザ互換のbase64変換
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const audioBase64 = btoa(binary);

        // エンコード形式をAPIに伝える（iOS対応）
        const encoding = mimeType.startsWith('audio/mp4') ? 'MP3' : 'WEBM_OPUS';

        try {
          const res = await authenticatedFetch('/api/stt', {
            method: 'POST',
            body: JSON.stringify({ audioBase64, encoding }),
          });
          const { transcript } = await res.json();
          if (transcript?.trim()) {
            onTranscript(transcript.trim());
          }
        } catch (err) {
          console.error('STT error:', err);
        } finally {
          setVoiceState('idle');
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setVoiceState('recording');
    } catch (err) {
      console.error('マイクの取得に失敗しました:', err);
      alert('マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。');
    }
  }, [voiceState, onTranscript]);

  // 録音停止
  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  // AI返答テキストをTTSで再生
  const speakText = useCallback(async (text: string) => {
    if (!isVoiceModeOn) return;
    setVoiceState('speaking');
    try {
      const res = await authenticatedFetch('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text, interviewerId }),
      });
      const { audioBase64 } = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setVoiceState('idle');
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setVoiceState('idle');
    }
  }, [isVoiceModeOn, interviewerId]);

  // 音声再生を止める
  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setVoiceState('idle');
  }, []);

  return {
    voiceState,
    isVoiceModeOn,
    setIsVoiceModeOn,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
  };
}
