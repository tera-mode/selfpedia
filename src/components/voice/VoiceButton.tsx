'use client';
import { Mic, Volume2, Loader2 } from 'lucide-react';

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

interface VoiceButtonProps {
  voiceState: VoiceState;
  onPressStart: () => void;
  onPressEnd: () => void;
  disabled?: boolean;
}

export function VoiceButton({ voiceState, onPressStart, onPressEnd, disabled }: VoiceButtonProps) {
  const isRecording = voiceState === 'recording';
  const isProcessing = voiceState === 'processing';
  const isSpeaking = voiceState === 'speaking';

  return (
    <button
      onMouseDown={onPressStart}
      onMouseUp={onPressEnd}
      onTouchStart={(e) => { e.preventDefault(); onPressStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); onPressEnd(); }}
      disabled={disabled || isProcessing || isSpeaking}
      className={`
        w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0
        ${isRecording ? 'bg-red-500 scale-110 animate-pulse' : ''}
        ${isProcessing || isSpeaking ? 'bg-stone-400 cursor-not-allowed' : ''}
        ${!isRecording && !isProcessing && !isSpeaking ? 'bg-emerald-500 hover:bg-emerald-600 active:scale-95' : ''}
      `}
    >
      {isProcessing && <Loader2 className="w-5 h-5 text-white animate-spin" />}
      {isSpeaking && <Volume2 className="w-5 h-5 text-white animate-bounce" />}
      {(voiceState === 'idle' || isRecording) && <Mic className="w-5 h-5 text-white" />}
    </button>
  );
}
