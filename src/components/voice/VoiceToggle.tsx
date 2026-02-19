'use client';
import { Volume2, VolumeX } from 'lucide-react';

interface VoiceToggleProps {
  isOn: boolean;
  onToggle: (value: boolean) => void;
}

export function VoiceToggle({ isOn, onToggle }: VoiceToggleProps) {
  return (
    <button
      onClick={() => onToggle(!isOn)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
        ${isOn ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}
    >
      {isOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      {isOn ? '音声ON' : '音声OFF'}
    </button>
  );
}
