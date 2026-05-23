import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Disc3, ExternalLink, Music2 } from 'lucide-react';
import { resolveCoverUrl } from '../lib/localDb';
import { Pairing, Track } from '../lib/types';

interface Props {
  pairing: Pairing;
  tracks: Track[];
  initialTrackIndex: number;
  resolvedPairingCover: string;
  onBack: () => void;
  onOpenVinyl: () => void;
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '26,26,46';
  return `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}`;
}

export default function TrackViewPage({ pairing, tracks, initialTrackIndex, resolvedPairingCover, onBack, onOpenVinyl }: Props) {
  const [activeIdx, setActiveIdx] = useState(initialTrackIndex);
  const [trackCovers, setTrackCovers] = useState<Record<string, string>>({});
  const lyricsRef = useRef<HTMLDivElement>(null);

  const track = tracks[activeIdx];
  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const coverUrl = (track && trackCovers[track.id]) || resolvedPairingCover;

  // resolve all track covers
  useEffect(() => {
    tracks.forEach(async t => {
      if (t.cover_id) {
        const url = await resolveCoverUrl(`local-cover://${t.cover_id}`);
        if (url) setTrackCovers(prev => ({ ...prev, [t.id]: url }));
      }
    });
  }, [tracks]);

  // scroll lyrics to top when track changes
  useEffect(() => {
    lyricsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeIdx]);

  if (!track) return null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a]">

      {/* ── Blurred background from track cover ── */}
      <div className="absolute inset-0 transition-all duration-700">
        {coverUrl && (
          <img
            key={coverUrl}
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(100px)', transform: 'scale(1.25)', opacity: 0.85 }}
          />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(6,6,8,0.58)' }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 30% 60%, transparent 25%, rgba(0,0,0,0.65) 100%)',
        }} />
      </div>

      {/* ── Floating blobs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-20 animate-blob1"
          style={{ background: pairing.theme_color, top: '-15%', right: '-10%' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-12 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-10%', left: '-5%' }} />
      </div>

      {/* ── Top navigation ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-8 pt-7">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/12 hover:border-white/25 text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold truncate max-w-[160px]">{pairing.name}</span>
        </button>

        <button
          onClick={onOpenVinyl}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-white text-sm font-bold border transition-all hover:scale-[1.02] active:scale-95 backdrop-blur-md"
          style={{
            background: `rgba(${rgb},0.28)`,
            borderColor: `rgba(${rgb},0.55)`,
            boxShadow: `0 0 28px rgba(${rgb},0.25)`,
          }}
        >
          <Disc3 className="w-4 h-4" style={{ animation: 'vinyl-spin 3s linear infinite' }} />
          바이닐 모드
        </button>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="relative z-20 flex h-full" style={{ paddingTop: 76, paddingBottom: 16 }}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 px-8"
          style={{ width: 'clamp(380px, 42vw, 520px)' }}>

          {/* Album jacket — bare image, no wrapper box */}
          <div className="mb-7 flex-shrink-0" style={{ width: 420 }}>
            {coverUrl
              ? <img src={coverUrl} alt={track.title}
                  className="w-full rounded-3xl object-cover transition-opacity duration-500"
                  style={{ aspectRatio: '1', display: 'block' }} />
              : (
                <div className="w-full rounded-3xl flex items-center justify-center"
                  style={{ aspectRatio: '1', background: pairing.theme_color }}>
                  <Music2 className="w-20 h-20 text-white/20" />
                </div>
              )
            }
          </div>

          {/* Track title + meta */}
          <div className="w-full text-left px-1" style={{ width: 420 }}>
            <h1 className="text-white font-bold leading-tight mb-1.5"
              style={{ fontSize: 'clamp(20px, 2.4vw, 30px)' }}>
              {track.title}
            </h1>
            {track.description && (
              <p className="text-white/50 text-sm leading-relaxed mb-3">{track.description}</p>
            )}

            {/* Media controls mock bar */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-white/30 text-xs">
                <span>0:00</span>
                <span>—:——</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-full rounded-full w-0 transition-all"
                  style={{ background: pairing.theme_color, boxShadow: `0 0 8px rgba(${rgb},0.8)` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-3">
                  {track.youtube_url && (
                    <a href={track.youtube_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.04] active:scale-95"
                      style={{
                        background: 'rgba(239,68,68,0.18)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        color: '#f87171',
                      }}>
                      <ExternalLink className="w-3.5 h-3.5" />
                      YouTube
                    </a>
                  )}
                </div>
                <span className="text-white/25 text-xs">{activeIdx + 1} / {tracks.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN: Lyrics ═══ */}
        <div className="flex-1 flex flex-col min-w-0 pr-10 overflow-hidden">
          {/* Track list pills (top) */}
          <div className="flex-shrink-0 flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none"
            style={{ scrollbarWidth: 'none' }}>
            {tracks.map((t, i) => {
              const tCover = trackCovers[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveIdx(i)}
                  className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 text-left"
                  style={{
                    background: i === activeIdx ? `rgba(${rgb},0.35)` : 'rgba(255,255,255,0.05)',
                    borderColor: i === activeIdx ? `rgba(${rgb},0.65)` : 'rgba(255,255,255,0.1)',
                    boxShadow: i === activeIdx ? `0 0 16px rgba(${rgb},0.3)` : 'none',
                  }}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-white/10"
                    style={{ background: pairing.theme_color }}>
                    {tCover
                      ? <img src={tCover} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Music2 className="w-3.5 h-3.5 text-white/30" />
                        </div>
                    }
                  </div>
                  <div>
                    <p className={`text-xs font-semibold truncate max-w-[120px] ${i === activeIdx ? 'text-white' : 'text-white/55'}`}>
                      {t.title}
                    </p>
                    <p className="text-white/25 text-[10px]">{i + 1}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lyrics / log body */}
          <div ref={lyricsRef} className="flex-1 overflow-y-auto pr-2"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {track.lyrics ? (
              <div className="py-2">
                <p className="text-white/75 leading-[2.1] whitespace-pre-wrap"
                  style={{ fontSize: 'clamp(15px, 1.6vw, 19px)' }}>
                  {track.lyrics}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
                <Music2 className="w-12 h-12 text-white/25" />
                <p className="text-white/35 text-sm text-center">
                  가사가 없습니다.<br />
                  <span className="text-xs text-white/20">편집 메뉴에서 가사를 추가해보세요.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
