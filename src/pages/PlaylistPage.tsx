import { useState, useEffect, useCallback } from 'react';
import { Star, ExternalLink, Music2, CreditCard as Edit2, Hash } from 'lucide-react';
import { getPairing, getTracksByPairing, updatePairing as updatePairingDb, resolveCoverUrl } from '../lib/localDb';
import { Pairing, Track, Genre } from '../lib/types';
import Layout from '../components/Layout';
import PairingModal from '../components/PairingModal';

interface Props {
  pairing: Pairing;
  genre: Genre;
  onBack: () => void;
  onUpdated: (pairing: Pairing) => void;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0,0,0';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export default function PlaylistPage({ pairing: initialPairing, genre, onBack, onUpdated }: Props) {
  const [pairing, setPairing] = useState(initialPairing);
  const [resolvedCover, setResolvedCover] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
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
    <Layout onBack={onBack} backLabel={genre.name} title={pairing.name}>
      {/* Hero background */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, rgba(${rgb},1) 0%, rgba(${rgb},0.7) 50%, rgba(10,10,10,0.95) 100%)`,
          }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(10,10,10,0.8) 100%)' }} />

        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
          {/* Album Cover */}
          <div
            className="w-36 h-36 sm:w-48 sm:h-48 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: pairing.theme_color }}
          >
            {resolvedCover ? (
              <img src={resolvedCover} alt={pairing.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music2 className="w-14 h-14 text-white/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <span className="text-xs font-medium uppercase tracking-widest text-white/50 mb-2 block">플레이리스트</span>
            <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight mb-2 leading-tight">{pairing.name}</h1>
            {pairing.description && (
              <p className="text-white/60 text-sm leading-relaxed mb-3 max-w-md">{pairing.description}</p>
            )}
            {pairing.character_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {pairing.character_tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-white/10 text-white/70 text-xs px-2.5 py-1 rounded-full">
                    <Hash className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-white/40 text-xs mb-5">{genre.name} · {tracks.length}곡</p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFavorite}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  pairing.is_favorite
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                    : 'bg-white/10 border border-white/10 text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Star className={`w-4 h-4 ${pairing.is_favorite ? 'fill-amber-400' : ''}`} />
                {pairing.is_favorite ? '즐겨찾기됨' : '즐겨찾기'}
              </button>
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white/70 hover:bg-white/15 hover:text-white text-sm font-medium transition-all"
              >
                <Edit2 className="w-4 h-4" />
                편집
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_auto] sm:grid-cols-[40px_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-white/5">
          <div className="text-zinc-600 text-xs font-medium text-center">#</div>
          <div className="text-zinc-600 text-xs font-medium">제목</div>
          <div className="text-zinc-600 text-xs font-medium hidden sm:block">설명</div>
          <div className="text-zinc-600 text-xs font-medium text-right">링크</div>
        </div>

        {loading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-white/3 border-b border-white/5 animate-pulse" />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-zinc-500 text-sm">아직 트랙이 없습니다</p>
            <p className="text-zinc-600 text-xs mt-1">편집 버튼을 눌러 트랙을 추가하세요</p>
          </div>
        ) : (
          <div>
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                className={`grid grid-cols-[40px_1fr_auto] sm:grid-cols-[40px_1fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-white/5 last:border-0 transition-colors ${
                  hoveredTrack === track.id ? 'bg-white/5' : ''
                }`}
                onMouseEnter={() => setHoveredTrack(track.id)}
                onMouseLeave={() => setHoveredTrack(null)}
              >
                <div className="flex items-center justify-center">
                  <span className="text-zinc-500 text-sm tabular-nums">{idx + 1}</span>
                </div>
                <div className="min-w-0 flex items-center">
                  <div>
                    <p className={`text-sm font-medium leading-tight truncate transition-colors ${
                      hoveredTrack === track.id ? 'text-rose-400' : 'text-white'
                    }`}>{track.title}</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center min-w-0">
                  <p className="text-zinc-500 text-sm truncate">{track.description || '—'}</p>
                </div>
                <div className="flex items-center justify-end">
                  {track.youtube_url ? (
                    <a
                      href={track.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden sm:inline">YouTube</span>
                    </a>
                  ) : (
                    <span className="text-zinc-700 text-xs">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
    </Layout>
  );
}
