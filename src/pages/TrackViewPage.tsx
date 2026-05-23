import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Disc3, ExternalLink, Music2, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [showTrackList, setShowTrackList] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const track = tracks[activeIdx];
  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const coverUrl = (track && trackCovers[track.id]) || resolvedPairingCover;

  useEffect(() => {
    tracks.forEach(async t => {
      if (t.cover_id) {
        const url = await resolveCoverUrl(`local-cover://${t.cover_id}`);
        if (url) setTrackCovers(prev => ({ ...prev, [t.id]: url }));
      }
    });
  }, [tracks]);

  useEffect(() => {
    lyricsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeIdx]);

  const goPrev = () => setActiveIdx(i => Math.max(0, i - 1));
  const goNext = () => setActiveIdx(i => Math.min(tracks.length - 1, i + 1));

  if (!track) return null;

  const hasLyrics = !!track.lyrics?.trim();

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#070709' }}>

      {/* ── Full-screen blurred album art background ── */}
      <div className="absolute inset-0 transition-all duration-1000">
        {coverUrl && (
          <img
            key={coverUrl}
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(120px)', transform: 'scale(1.4)', opacity: 0.75 }}
          />
        )}
        {/* deep dark overlay */}
        <div className="absolute inset-0" style={{ background: 'rgba(5,5,8,0.68)' }} />
        {/* vignette */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 40% 40%, transparent 20%, rgba(0,0,0,0.72) 100%)',
        }} />
        {/* bottom fade for lyrics readability */}
        <div className="absolute bottom-0 left-0 right-0 h-48" style={{
          background: 'linear-gradient(to top, rgba(5,5,8,0.95) 0%, transparent 100%)',
        }} />
      </div>

      {/* ── Top nav ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-7 pt-7">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/10 hover:border-white/22 text-white backdrop-blur-xl transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/55 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">{pairing.name}</span>
        </button>

        <div className="flex items-center gap-2.5">
          {tracks.length > 1 && (
            <button
              onClick={() => setShowTrackList(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-semibold border backdrop-blur-xl transition-all hover:scale-[1.02] active:scale-95"
              style={showTrackList
                ? { background: `rgba(${rgb},0.35)`, borderColor: `rgba(${rgb},0.6)` }
                : { background: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.10)' }}>
              <Music2 className="w-4 h-4" />
              트랙 목록
            </button>
          )}
          <button
            onClick={onOpenVinyl}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-bold border backdrop-blur-xl transition-all hover:scale-[1.02] active:scale-95"
            style={{
              background: `rgba(${rgb},0.28)`,
              borderColor: `rgba(${rgb},0.55)`,
              boxShadow: `0 0 22px rgba(${rgb},0.22)`,
            }}>
            <Disc3 className="w-4 h-4" style={{ animation: 'vinyl-spin 3s linear infinite' }} />
            바이닐 모드
          </button>
        </div>
      </div>

      {/* ── Track list dropdown overlay ── */}
      {showTrackList && (
        <div
          className="absolute top-[72px] right-7 z-50 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-2xl"
          style={{ background: 'rgba(10,10,14,0.92)', minWidth: 240, maxHeight: 360, overflowY: 'auto' }}>
          {tracks.map((t, i) => {
            const tCover = trackCovers[t.id] || resolvedPairingCover;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveIdx(i); setShowTrackList(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                style={{
                  background: i === activeIdx ? `rgba(${rgb},0.28)` : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                  {tCover
                    ? <img src={tCover} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full" style={{ background: pairing.theme_color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${i === activeIdx ? 'text-white' : 'text-white/60'}`}>{t.title}</p>
                  <p className="text-white/30 text-xs">{i + 1} / {tracks.length}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="relative z-20 flex h-full items-stretch justify-center" style={{ paddingTop: 80, paddingBottom: 24 }}>

        {/* LEFT: cover + track info */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 select-none"
          style={{ width: 'clamp(320px, 36vw, 480px)', padding: '0 40px 0 48px' }}>

          {/* bare album cover */}
          <div className="w-full mb-8">
            {coverUrl
              ? <img
                  key={coverUrl}
                  src={coverUrl}
                  alt={track.title}
                  className="w-full rounded-3xl object-cover"
                  style={{
                    aspectRatio: '1',
                    display: 'block',
                    boxShadow: `0 40px 100px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.06)`,
                    transition: 'opacity 0.5s',
                  }} />
              : <div className="w-full rounded-3xl flex items-center justify-center"
                  style={{ aspectRatio: '1', background: pairing.theme_color }}>
                  <Music2 className="w-24 h-24 text-white/20" />
                </div>
            }
          </div>

          {/* track title + meta */}
          <div className="w-full text-left">
            <h2 className="text-white mb-2" style={{
              fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", -apple-system, sans-serif',
              fontSize: 'clamp(22px, 2.6vw, 32px)',
              fontWeight: 900,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              wordBreak: 'keep-all',
            }}>
              {track.title}
            </h2>
            {track.description && (
              <p className="mb-4" style={{
                fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
                fontSize: 13,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.42)',
                lineHeight: 1.6,
              }}>{track.description}</p>
            )}

            {/* youtube + counter */}
            <div className="flex items-center gap-3 mt-4">
              {track.youtube_url && (
                <a href={track.youtube_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.04] active:scale-95"
                  style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.32)', color: '#f87171' }}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  YouTube
                </a>
              )}
              <span className="text-white/25 text-xs ml-auto">{activeIdx + 1} / {tracks.length}</span>
            </div>

            {/* prev / next */}
            {tracks.length > 1 && (
              <div className="flex gap-2 mt-5">
                <button
                  onClick={goPrev}
                  disabled={activeIdx === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-30 hover:enabled:scale-[1.02] active:enabled:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                  <ChevronUp className="w-3.5 h-3.5" /> 이전 곡
                </button>
                <button
                  onClick={goNext}
                  disabled={activeIdx === tracks.length - 1}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-30 hover:enabled:scale-[1.02] active:enabled:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                  다음 곡 <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: lyrics / log */}
        <div className="flex flex-col overflow-hidden" style={{ width: 'clamp(320px, 44vw, 600px)', paddingLeft: 48, paddingRight: 48 }}>

          {/* section label */}
          <div className="flex-shrink-0 mb-8">
            <p style={{
              fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", -apple-system, sans-serif',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.28)',
              textTransform: 'uppercase',
            }}>
              {hasLyrics ? 'Lyrics' : 'Log'}
            </p>
            <div className="mt-2.5 h-px" style={{ background: `rgba(${rgb},0.3)` }} />
          </div>

          {/* lyrics body */}
          <div
            ref={lyricsRef}
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}>
            {hasLyrics ? (
              <div className="pb-16">
                {track.lyrics!.split('\n').map((line, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", -apple-system, sans-serif',
                      fontSize: 'clamp(22px, 2.2vw, 30px)',
                      fontWeight: 700,
                      lineHeight: 2.05,
                      letterSpacing: '0.01em',
                      color: line.trim() === '' ? 'transparent' : 'rgba(255,255,255,0.88)',
                      marginBottom: line.trim() === '' ? '0.9em' : 0,
                      transition: 'color 0.3s',
                      wordBreak: 'keep-all',
                      overflowWrap: 'break-word',
                    }}>
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start justify-center h-full gap-3 pt-8">
                <p style={{
                  fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.18)',
                }}>가사가 없습니다.</p>
                <p style={{
                  fontFamily: '"Noto Sans KR", -apple-system, sans-serif',
                  fontSize: 14,
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.10)',
                  lineHeight: 1.7,
                }}>편집 메뉴에서 가사를 추가하거나,<br/>바이닐 모드에서 로그를 작성해보세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default TrackViewPage