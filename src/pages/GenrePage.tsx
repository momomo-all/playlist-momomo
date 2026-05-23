import { useState, useEffect, useCallback } from 'react';
import { Plus, Star, Search, MoreHorizontal, Trash2, CreditCard as Edit2, Music2 } from 'lucide-react';
import { getPairingsByGenre, updatePairing as updatePairingDb, deletePairing as removePairing, getTracksByPairing } from '../lib/localDb';
import { resolveCoverUrl } from '../lib/localDb';
import { Genre, Pairing, Track } from '../lib/types';
import Layout from '../components/Layout';
import PairingModal from '../components/PairingModal';

interface Props {
  genre: Genre;
  onBack: () => void;
  onSelectPairing: (pairing: Pairing) => void;
}

export default function GenrePage({ genre, onBack, onSelectPairing }: Props) {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [resolvedCovers, setResolvedCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPairing, setEditingPairing] = useState<Pairing | null>(null);
  const [editingTracks, setEditingTracks] = useState<Track[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);

  const loadPairings = useCallback(async () => {
    setLoading(true);
    const data = await getPairingsByGenre(genre.id);
    // Attach track counts
    const withCounts = await Promise.all(data.map(async p => {
      const tracks = await getTracksByPairing(p.id);
      return { ...p, track_count: tracks.length };
    }));
    setPairings(withCounts);

    // Resolve cover URLs
    const covers: Record<string, string> = {};
    for (const p of withCounts) {
      if (p.cover_url) {
        covers[p.id] = await resolveCoverUrl(p.cover_url);
      }
    }
    setResolvedCovers(covers);
    setLoading(false);
  }, [genre.id]);

  useEffect(() => { loadPairings(); }, [loadPairings]);

  const toggleFavorite = async (p: Pairing, e: React.MouseEvent) => {
    e.stopPropagation();
    await updatePairingDb({ ...p, is_favorite: !p.is_favorite });
    loadPairings();
  };

  const handleDeletePairing = async (id: string) => {
    if (!confirm('이 페어링을 삭제할까요?')) return;
    await removePairing(id);
    loadPairings();
    setMenuId(null);
  };

  const openEdit = async (p: Pairing) => {
    const tracks = await getTracksByPairing(p.id);
    setEditingTracks(tracks);
    setEditingPairing(p);
    setMenuId(null);
  };

  const filtered = pairings.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.character_tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchFav = !favoritesOnly || p.is_favorite;
    return matchSearch && matchFav;
  });

  return (
    <Layout
      onBack={onBack}
      backLabel="라이브러리"
      title={genre.name}
      actions={
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-rose-500/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">페어링 추가</span>
        </button>
      }
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-1">{genre.name}</h1>
        <p className="text-zinc-500 text-sm">{pairings.length}개의 페어링</p>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-all"
            placeholder="페어링 또는 캐릭터 검색..."
          />
        </div>
        <button
          onClick={() => setFavoritesOnly(p => !p)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            favoritesOnly
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-[#141414] border-white/8 text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <Star className={`w-4 h-4 ${favoritesOnly ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-[#141414] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#141414] flex items-center justify-center mb-4">
            <Music2 className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium mb-1">
            {search || favoritesOnly ? '검색 결과가 없습니다' : '아직 페어링이 없습니다'}
          </p>
          <p className="text-zinc-600 text-sm">
            {!search && !favoritesOnly && '"페어링 추가" 버튼으로 시작해보세요'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map(pairing => (
            <div
              key={pairing.id}
              className="group relative cursor-pointer"
              onClick={() => onSelectPairing(pairing)}
            >
              {/* Album Art */}
              <div
                className="aspect-square rounded-2xl overflow-hidden mb-3 relative shadow-lg transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-xl"
                style={{ background: pairing.theme_color || '#1a1a2e' }}
              >
                {resolvedCovers[pairing.id] ? (
                  <img src={resolvedCovers[pairing.id]} alt={pairing.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-10 h-10 text-white/20" />
                  </div>
                )}

                {/* Overlay buttons */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                  <button
                    onClick={e => toggleFavorite(pairing, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-all"
                  >
                    <Star className={`w-3.5 h-3.5 ${pairing.is_favorite ? 'text-amber-400 fill-amber-400' : 'text-white'}`} />
                  </button>
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === pairing.id ? null : pairing.id); }}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-all"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-white" />
                    </button>
                    {menuId === pairing.id && (
                      <div className="absolute bottom-8 right-0 bg-[#222] border border-white/10 rounded-xl shadow-2xl py-1.5 w-32 z-20">
                        <button
                          onClick={() => openEdit(pairing)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          수정
                        </button>
                        <button
                          onClick={() => handleDeletePairing(pairing.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fav badge */}
                {pairing.is_favorite && (
                  <div className="absolute top-2 right-2">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div>
                <p className="text-white text-sm font-medium leading-tight mb-1 truncate">{pairing.name}</p>
                {pairing.character_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pairing.character_tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-zinc-500 text-xs">#{tag}</span>
                    ))}
                  </div>
                )}
                <p className="text-zinc-600 text-xs mt-0.5">{pairing.track_count || 0}곡</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PairingModal
          genres={[genre]}
          defaultGenreId={genre.id}
          onClose={() => setShowModal(false)}
          onSaved={loadPairings}
        />
      )}
      {editingPairing && (
        <PairingModal
          pairing={editingPairing}
          genres={[genre]}
          defaultGenreId={genre.id}
          initialTracks={editingTracks}
          onClose={() => { setEditingPairing(null); setEditingTracks([]); }}
          onSaved={loadPairings}
        />
      )}

      {menuId && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
      )}
    </Layout>
  );
}
