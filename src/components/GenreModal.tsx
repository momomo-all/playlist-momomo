import { useState } from 'react';
import { X } from 'lucide-react';
import { addGenre, updateGenre } from '../lib/localDb';
import { Genre } from '../lib/types';

interface Props {
  genre?: Genre | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function GenreModal({ genre, onClose, onSaved }: Props) {
  const [name, setName] = useState(genre?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (genre) {
        await updateGenre({ ...genre, name: name.trim() });
      } else {
        await addGenre(name.trim());
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold">{genre ? '장르 수정' : '새 장르 추가'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5">장르명 (예: Fearless)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#222] border border-white/8 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/25 transition-all"
              placeholder="장르명을 입력하세요"
              required
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 text-sm transition-all">취소</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-sm font-medium transition-all">
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
