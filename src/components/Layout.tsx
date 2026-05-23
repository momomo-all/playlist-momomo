import { ReactNode } from 'react';
import { Music2, ChevronLeft } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  actions?: ReactNode;
}

export default function Layout({ children, onBack, backLabel, title, actions }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {onBack ? (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                {backLabel || '뒤로'}
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <Music2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold text-sm tracking-tight">드림 페어링 아카이브</span>
              </div>
            )}
            {title && (
              <span className="text-zinc-400 text-sm truncate hidden sm:block">/ {title}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
