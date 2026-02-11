'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export default function AppHeader({ title, showBackButton = false, onBack, rightAction }: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-30 glass-header px-4 py-3 shadow-sm">
      <div className="relative mx-auto flex max-w-4xl items-center justify-between">
        <div className="flex items-center gap-2 min-w-[40px]">
          {showBackButton && (
            <button onClick={handleBack} className="rounded-full p-1 hover:bg-white/50 transition-colors">
              <ChevronLeft size={24} className="text-gray-700" />
            </button>
          )}
          {title && (
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          )}
        </div>
        {!showBackButton && (
          <button onClick={() => router.push('/mypage')} className="absolute left-1/2 -translate-x-1/2">
            <Image
              src="/image/mecraft_logo.png"
              alt="じぶんクラフト"
              width={140}
              height={35}
              priority
            />
          </button>
        )}
        <div className="min-w-[40px]">{rightAction}</div>
      </div>
    </header>
  );
}
