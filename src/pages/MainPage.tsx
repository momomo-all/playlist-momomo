import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Star, FolderOpen, ChevronRight, MoreHorizontal, Trash2, CreditCard as Edit2, Music } from 'lucide-react';
import { getGenres, deleteGenre as removeGenre, getFavoriteGenreIds, getPairingsByGenre } from '../lib/localDb';
import { Genre } from '../lib/types';
import Layout from '../components/Layout';
import GenreModal from '../components/GenreModal';

interface Props {
  onSelectGenre: (genre: Genre) => void;
}

export default function MainPage({ onSelectGenre }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [menuGenreId, setMenuGenreId] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favGenreIds, setFavGenreIds] = useState<Set<string>>(new Set());

  const loadGenres = useCallback(async () => {
    setLoading(true);
    const data = await getGenres();
    // Attach pairing counts
    const withCounts = await Promise.all(data.map(async g => {
      const pairings = await getPairingsByGenre(g.id);
      return { ...g, pairing_count: pairings.length };
    }));
    setGenres(withCounts);
    const favIds = await getFavoriteGenreIds();
    setFavGenreIds(favIds);
    setLoading(false);
  }, []);

  useEffect(() => { loadGenres(); }, [loadGenres]);

  const handleDeleteGenre = async (id: string) => {
    if (!confirm('이 장르와 모든 페어링을 삭제할까요?')) return;
    await removeGenre(id);
    loadGenres();
    setMenuGenreId(null);
  };

  const filtered = genres.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
    const matchFav = !favoritesOnly || favGenreIds.has(g.id);
    return matchSearch && matchFav;
  });

  return (
    <Layout
      actions={
        <button
          onClick={() => setShowGenreModal(true)}
          className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-rose-500/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">장르 추가</span>
        </button>
      }
    >
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-1">나의 라이브러리</h1>
        <p className="text-zinc-500 text-sm">{genres.length}개의 장르 · 나만의 드림 페어링 아카이브</p>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all"
            placeholder="장르 검색..."
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
          <span className="hidden sm:inline">즐겨찾기</span>
        </button>
      </div>

      {/* Genre List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-[#141414] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#141414] flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium mb-1">
            {search || favoritesOnly ? '검색 결과가 없습니다' : '아직 장르가 없습니다'}
          </p>
          <p className="text-zinc-600 text-sm">
            {!search && !favoritesOnly && '"장르 추가" 버튼으로 시작해보세요'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(genre => (
            <div
              key={genre.id}
              className="group relative flex items-center gap-4 bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 cursor-pointer transition-all"
              onClick={() => onSelectGenre(genre)}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-600/20 border border-rose-500/10 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{genre.name}</p>
                <p className="text-zinc-500 text-xs">{genre.pairing_count || 0}개의 페어링</p>
              </div>
              {favGenreIds.has(genre.id) && (
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
              )}
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />

              {/* Context Menu */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuGenreId(menuGenreId === genre.id ? null : genre.id); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuGenreId === genre.id && (
                  <div className="absolute right-0 top-8 bg-[#222] border border-white/10 rounded-xl shadow-2xl py-1.5 w-36 z-20">
                    <button
                      onClick={() => { setEditingGenre(genre); setMenuGenreId(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteGenre(genre.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showGenreModal && (
        <GenreModal onClose={() => setShowGenreModal(false)} onSaved={loadGenres} />
      )}
      {editingGenre && (
        <GenreModal genre={editingGenre} onClose={() => setEditingGenre(null)} onSaved={loadGenres} />
      )}

      {/* Click outside to close menu */}
      {menuGenreId && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuGenreId(null)} />
      )}
    </Layout>
  );
}
