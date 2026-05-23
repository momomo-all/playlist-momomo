import { useState, useEffect, useRef } from 'react';
import { X, Save, Music2, RotateCcw } from 'lucide-react';
import { getVinylNote, saveVinylNote } from '../lib/localDb';
import { Pairing } from '../lib/types';

interface Props {
  pairing: Pairing;
  coverUrl: string;
  onClose: () => void;
}

export default function VinylMode({ pairing, coverUrl, onClose }: Props) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [isSlid, setIsSlid] = useState(false);
  const [showText, setShowText] = useState(false);
  const [noteText, setNoteText] = useState(() => getVinylNote(pairing.id));
  const [saved, setSaved] = useState(false);
  const spinRef = useRef<NodeJS.Timeout | null>(null);

  // Slide out LP after mount
  useEffect(() => {
    const t1 = setTimeout(() => setIsSlid(true), 100);
    const t2 = setTimeout(() => setIsSpinning(true), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    saveVinylNote(pairing.id, noteText);
    setSaved(true);
    if (spinRef.current) clearTimeout(spinRef.current);
    spinRef.current = setTimeout(() => setSaved(false), 2000);
  };

  const rgb = (() => {
    const c = pairing.theme_color || '#1a1a2e';
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
    if (!r) return '26,26,46';
    return `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ background: `radial-gradient(ellipse at center, rgba(${rgb},0.95) 0%, rgba(5,5,5,0.98) 100%)` }}
      />

      {/* Animated mesh blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl animate-blob1"
          style={{ background: pairing.theme_color, top: '10%', left: '5%' }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl animate-blob2"
          style={{ background: pairing.theme_color, bottom: '15%', right: '10%' }}
        />
        <div
          className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl animate-blob3"
          style={{ background: pairing.theme_color, top: '50%', left: '50%' }}
        />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white transition-all hover:scale-110"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 px-6 w-full max-w-5xl">

        {/* Turntable section */}
        <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 340, height: 340 }}>

          {/* LP Vinyl disc */}
          <div
            className="absolute rounded-full transition-all duration-700 ease-out"
            style={{
              width: 280,
              height: 280,
              left: isSlid ? 120 : 50,
              top: 30,
              zIndex: 1,
            }}
          >
            {/* Vinyl body */}
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(
                  from 0deg,
                  #111 0deg, #1a1a1a 15deg, #111 30deg, #181818 45deg,
                  #111 60deg, #1a1a1a 75deg, #111 90deg, #181818 105deg,
                  #111 120deg, #1a1a1a 135deg, #111 150deg, #181818 165deg,
                  #111 180deg, #1a1a1a 195deg, #111 210deg, #181818 225deg,
                  #111 240deg, #1a1a1a 255deg, #111 270deg, #181818 285deg,
                  #111 300deg, #1a1a1a 315deg, #111 330deg, #181818 345deg, #111 360deg
                )`,
                animation: isSpinning ? 'vinyl-spin 2s linear infinite' : 'none',
                boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(0,0,0,0.4)',
              }}
            >
              {/* Grooves */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'repeating-radial-gradient(circle, transparent, transparent 6px, rgba(255,255,255,0.03) 6px, rgba(255,255,255,0.03) 7px)',
              }} />
              {/* Center label */}
              <div
                className="absolute rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  width: 80, height: 80,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: pairing.theme_color,
                }}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <Music2 className="w-6 h-6 text-white/50" />
                )}
                {/* Center hole */}
                <div className="absolute w-4 h-4 rounded-full bg-[#0a0a0a]" />
              </div>
            </div>
          </div>

          {/* Jacket */}
          <div
            className="absolute rounded-2xl overflow-hidden cursor-pointer shadow-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              width: 240,
              height: 240,
              left: 0,
              top: 50,
              zIndex: 2,
              background: pairing.theme_color,
            }}
            onClick={() => setShowText(t => !t)}
            title="클릭하여 노트 전환"
          >
            {/* Cover or text overlay */}
            <div className="relative w-full h-full">
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{ opacity: showText ? 0 : 1 }}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt={pairing.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-16 h-16 text-white/20" />
                  </div>
                )}
              </div>
              <div
                className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 transition-opacity duration-500"
                style={{ opacity: showText ? 1 : 0 }}
              >
                <p className="text-white/60 text-xs text-center leading-relaxed">
                  {noteText || '자켓을 클릭하면 노트가 표시됩니다'}
                </p>
              </div>
            </div>
            {/* Jacket hint */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="text-white/30 text-xs">{showText ? '커버 보기' : '노트 보기'}</span>
            </div>
          </div>

          {/* Tonearm */}
          <div
            className="absolute"
            style={{
              width: 120,
              height: 4,
              right: -20,
              top: 60,
              zIndex: 3,
              transformOrigin: 'right center',
              transform: isSlid ? 'rotate(28deg)' : 'rotate(10deg)',
              transition: 'transform 0.8s ease-out',
            }}
          >
            <div className="w-full h-full bg-gradient-to-r from-zinc-400 to-zinc-600 rounded-full shadow-lg" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-300 shadow" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-1 bg-zinc-500 rounded-full" style={{ transform: 'rotate(-30deg)' }} />
          </div>

          {/* Spin toggle */}
          <button
            onClick={() => setIsSpinning(s => !s)}
            className="absolute bottom-0 right-0 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white text-xs transition-all"
          >
            <RotateCcw className={`w-3 h-3 ${isSpinning ? 'animate-spin' : ''}`} />
            {isSpinning ? '정지' : '재생'}
          </button>
        </div>

        {/* Right panel: info + note editor */}
        <div className="flex-1 min-w-0 w-full lg:max-w-md">
          {/* Title area */}
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">바이닐 포커스 모드</p>
            <h2 className="text-white text-3xl font-bold tracking-tight mb-1">{pairing.name}</h2>
            {pairing.character_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {pairing.character_tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-white/20 text-white/50">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Note editor — glassmorphism card */}
          <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-white/50 text-xs font-medium uppercase tracking-wider">대화 로그 / 가사 노트</span>
              <span className="text-white/30 text-xs">{noteText.length}자</span>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              className="w-full bg-transparent px-4 py-4 text-white/80 text-sm leading-relaxed resize-none focus:outline-none placeholder-white/20"
              rows={12}
              placeholder={"이 페어링을 위한 대화 로그, 가사, 또는 메모를 자유롭게 남겨보세요...\n\n브라우저에만 저장되며 외부로 공유되지 않습니다."}
            />
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-white/25 text-xs">자켓 이미지를 클릭하면 노트 미리보기</span>
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  saved
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-white text-black hover:bg-white/90 active:scale-95'
                }`}
              >
                <Save className="w-4 h-4" />
                {saved ? '저장됨' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
