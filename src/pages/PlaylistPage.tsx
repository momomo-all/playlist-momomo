import { useState, useEffect, useCallback } from 'react';
import { Star, ExternalLink, Music2, Hash, ChevronLeft, Pencil, Play } from 'lucide-react';
import { getPairing, getTracksByPairing, updatePairing as updatePairingDb, resolveCoverUrl } from '../lib/localDb';
import { Pairing, Track, Genre } from '../lib/types';
import PairingModal from '../components/PairingModal';

interface Props {
  pairing: Pairing;
  genre: Genre;
  onBack: () => void;
  onUpdated: (pairing: Pairing) => void;
  onOpenTrack: (pairing: Pairing, tracks: Track[], trackIndex: number, resolvedCover: string) => void;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '26,26,46';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export default function PlaylistPage({ pairing: initialPairing, genre, onBack, onUpdated, onOpenTrack }: Props) {
  const [pairing, setPairing] = useState(initialPairing);
  const [resolvedCover, setResolvedCover] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackCovers, setTrackCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    const data = await getTracksByPairing(pairing.id);
    setTracks(data);
    const cover = await resolveCoverUrl(pairing.cover_url);
    setResolvedCover(cover);
    setLoading(false);
    // resolve track covers
    const coverMap: Record<string, string> = {};
    for (const t of data) {
      if (t.cover_id) {
        const url = await resolveCoverUrl(`local-cover://${t.cover_id}`);
        if (url) coverMap[t.id] = url;
      }
    }
    setTrackCovers(coverMap);
  }, [pairing.id, pairing.cover_url]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const toggleFavorite = async () => {
    const updated = { ...pairing, is_favorite: !pairing.is_favorite };
    await updatePairingDb(updated);
    setPairing(updated);
    onUpdated(updated);
  };

  const handleSaved = async () => {
    const fresh = await getPairing(pairing.id);
    if (fresh) {
      setPairing(fresh);
      onUpdated(fresh);
    }
    loadTracks();
  };

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: '#080808' }}>

      {/* ── ANIMATED MESH GRADIENT BACKGROUND ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-30 animate-blob1"
          style={{ background: pairing.theme_color, top: '-10%', left: '-5%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-20 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-5%', right: '-5%' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-10 animate-blob3"
          style={{ background: pairing.theme_color, top: '40%', left: '35%' }} />
        <div className="absolute inset-0" style={{ background: 'rgba(8,8,8,0.75)' }} />
      </div>

      {/* ── HEADER ── */}
      <header className="relative z-30 flex items-center justify-between px-6 sm:px-10 pt-8 pb-4">
        <button
          onClick={onBack}
          className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/10 hover:border-white/25 text-white transition-all duration-200 hover:scale-[1.02] active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">{genre.name}</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFavorite}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
              pairing.is_favorite
                ? 'bg-amber-500/20 border-amber-500/35 text-amber-400 hover:bg-amber-500/30'
                : 'bg-white/8 border-white/10 text-white/70 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Star className={`w-4 h-4 ${pairing.is_favorite ? 'fill-amber-400' : ''}`} />
            <span className="hidden sm:inline">{pairing.is_favorite ? '즐겨찾기됨' : '즐겨찾기'}</span>
          </button>

          <button
            onClick={() => setShowEdit(true)}
            className="group flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/10 hover:border-white/25 text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95"
          >
            <Pencil className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
            <span>편집</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-10 py-8">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">

          {/* ── LEFT: Album Cover + Meta ── */}
          <div className="w-full lg:w-auto flex-shrink-0 flex flex-col items-center lg:items-start">
            <div
              className="relative rounded-3xl overflow-hidden shadow-2xl mb-6"
              style={{
                width: 'clamp(260px, 35vw, 420px)',
                height: 'clamp(260px, 35vw, 420px)',
                background: pairing.theme_color,
                boxShadow: `0 40px 80px rgba(${rgb},0.5), 0 0 0 1px rgba(255,255,255,0.05)`,
              }}
            >
              {resolvedCover ? (
                <img src={resolvedCover} alt={pairing.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-24 h-24 text-white/15" />
                </div>
              )}
              <div className="absolute inset-0 rounded-3xl" style={{
                boxShadow: `inset 0 0 40px rgba(${rgb},0.3)`,
              }} />
            </div>

            {/* Title + Description + Tags */}
            <div className="text-center lg:text-left max-w-sm">
              <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">플레이리스트</p>
              <h1 className="text-white text-3xl sm:text-4xl font-bold tracking-tight mb-3 leading-tight">{pairing.name}</h1>
              {pairing.description && (
                <p className="text-white/55 text-sm leading-relaxed mb-4">{pairing.description}</p>
              )}
              {pairing.character_tags.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  {pairing.character_tags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/55"
                      style={{ background: `rgba(${rgb},0.12)` }}
                    >
                      <Hash className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-white/30 text-xs mt-4">{genre.name} · {tracks.length}곡</p>
            </div>
          </div>

          {/* ── RIGHT: Track List ── */}
          <div className="flex-1 min-w-0 w-full">
            <div
              className="rounded-3xl overflow-hidden backdrop-blur-xl border border-white/10"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between">
                <h2 className="text-white font-semibold text-base">트랙 목록</h2>
                <span className="text-white/35 text-sm">{tracks.length}곡</span>
              </div>

              {loading ? (
                <div>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 border-b border-white/5 last:border-0 animate-pulse"
                      style={{ background: `rgba(255,255,255,${0.02 + i * 0.005})` }} />
                  ))}
                </div>
              ) : tracks.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: `rgba(${rgb},0.2)` }}>
                    <Music2 className="w-8 h-8 text-white/25" />
                  </div>
                  <p className="text-white/40 text-sm mb-1">아직 트랙이 없습니다</p>
                  <p className="text-white/25 text-xs">편집 버튼을 눌러 트랙을 추가하세요</p>
                </div>
              ) : (
                <div>
                  {tracks.map((track, idx) => {
                    const tCover = trackCovers[track.id];
                    const isHovered = hoveredTrack === track.id;
                    return (
                      <div
                        key={track.id}
                        className="flex items-center gap-4 px-5 py-3.5 border-b border-white/5 last:border-0 transition-all duration-150 cursor-pointer group"
                        style={{ background: isHovered ? `rgba(${rgb},0.14)` : 'transparent' }}
                        onMouseEnter={() => setHoveredTrack(track.id)}
                        onMouseLeave={() => setHoveredTrack(null)}
                        onClick={() => onOpenTrack(pairing, tracks, idx, resolvedCover)}
                      >
                        {/* Index / play icon */}
                        <div className="w-7 flex items-center justify-center flex-shrink-0">
                          {isHovered
                            ? <Play className="w-4 h-4 text-white fill-white" />
                            : <span className="text-white/30 text-sm tabular-nums">{idx + 1}</span>
                          }
                        </div>

                        {/* Track thumbnail */}
                        <div
                          className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 transition-transform duration-150"
                          style={{ background: pairing.theme_color, transform: isHovered ? 'scale(1.06)' : 'scale(1)' }}
                        >
                          {tCover
                            ? <img src={tCover} alt={track.title} className="w-full h-full object-cover" />
                            : resolvedCover
                              ? <img src={resolvedCover} alt="" className="w-full h-full object-cover opacity-60" />
                              : <div className="w-full h-full flex items-center justify-center">
                                  <Music2 className="w-4 h-4 text-white/20" />
                                </div>
                          }
                        </div>

                        {/* Title + description */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-tight truncate transition-colors duration-150 ${isHovered ? 'text-white' : 'text-white/80'}`}>
                            {track.title}
                          </p>
                          {track.description && (
                            <p className="text-white/35 text-xs truncate mt-0.5">{track.description}</p>
                          )}
                        </div>

                        {/* Lyrics indicator */}
                        {track.lyrics && (
                          <span className="hidden sm:flex items-center text-white/20 text-xs gap-1 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            가사
                          </span>
                        )}

                        {/* YouTube link */}
                        <div className="flex items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
                          {track.youtube_url ? (
                            <a
                              href={track.youtube_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 border"
                              style={{
                                background: isHovered ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)',
                                borderColor: 'rgba(239,68,68,0.3)',
                                color: '#f87171',
                              }}
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="hidden sm:inline">YouTube</span>
                            </a>
                          ) : (
                            <span className="text-white/15 text-xs w-16 text-center">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <PairingModal
          pairing={pairing}
          genres={[genre]}
          defaultGenreId={genre.id}
          initialTracks={tracks}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
