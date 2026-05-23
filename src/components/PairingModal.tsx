import { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { addPairing, updatePairing, addTrack, updateTrack, deleteTrack, saveCover, resolveCoverUrl } from '../lib/localDb';
import { Pairing, Genre, Track } from '../lib/types';
import { compressImage } from '../lib/imageUtils';

interface Props {
  pairing?: Pairing | null;
  genres: Genre[];
  defaultGenreId?: string;
  initialTracks?: Track[];
  onClose: () => void;
  onSaved: () => void;
}

interface TrackDraft {
  id?: string;
  title: string;
  description: string;
  youtube_url: string;
  order_index: number;
}

const PRESET_COLORS = [
  '#1a1a2e', '#0f3460', '#16213e', '#1b1b2f',
  '#2d1b33', '#1a2e1a', '#2e1a1a', '#1a2a2e',
  '#2e2a1a', '#1e1e1e',
];

export default function PairingModal({ pairing, genres, defaultGenreId, initialTracks = [], onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [genreId, setGenreId] = useState(pairing?.genre_id || defaultGenreId || genres[0]?.id || '');
  const [name, setName] = useState(pairing?.name || '');
  const [description, setDescription] = useState(pairing?.description || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(pairing?.character_tags || []);
  const [themeColor, setThemeColor] = useState(pairing?.theme_color || '#1a1a2e');
  const [coverUrl] = useState(pairing?.cover_url || '');
  const [coverPreview, setCoverPreview] = useState('');
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (pairing?.cover_url) {
      resolveCoverUrl(pairing.cover_url).then(url => { if (url) setCoverPreview(url); });
    }
  }, [pairing?.cover_url]);

  const [tracks, setTracks] = useState<TrackDraft[]>(
    initialTracks.length > 0
      ? initialTracks.map(t => ({ id: t.id, title: t.title, description: t.description, youtube_url: t.youtube_url, order_index: t.order_index }))
      : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setCoverBlob(compressed);
    setCoverPreview(URL.createObjectURL(compressed));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const addTrackItem = () => {
    setTracks(prev => [...prev, { title: '', description: '', youtube_url: '', order_index: prev.length }]);
  };

  const updateTrackField = (idx: number, field: keyof TrackDraft, value: string) => {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTrackItem = (idx: number) => {
    setTracks(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, order_index: i })));
  };

  const moveTrack = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= tracks.length) return;
    setTracks(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((t, i) => ({ ...t, order_index: i }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !genreId) return;
    setLoading(true);
    setError('');

    try {
      let finalCoverUrl = coverUrl;

      if (coverBlob) {
        const coverId = crypto.randomUUID();
        finalCoverUrl = await saveCover(coverId, coverBlob);
      }

      let pairingId = pairing?.id;

      if (pairing) {
        await updatePairing({
          ...pairing,
          genre_id: genreId,
          name: name.trim(),
          description,
          character_tags: tags,
          cover_url: finalCoverUrl,
          theme_color: themeColor,
        });
      } else {
        const created = await addPairing({
          genre_id: genreId,
          name: name.trim(),
          description,
          character_tags: tags,
          cover_url: finalCoverUrl,
          theme_color: themeColor,
          is_favorite: false,
        });
        pairingId = created.id;
      }

      // sync tracks — only save tracks with non-empty titles
      const validTracks = tracks.filter(t => t.title.trim());
      if (pairing) {
        const existingIds = initialTracks.map(t => t.id);
        const keepIds = validTracks.filter(t => t.id).map(t => t.id!);
        const toDelete = existingIds.filter(id => !keepIds.includes(id));
        for (const id of toDelete) {
          await deleteTrack(id);
        }
        for (const t of validTracks.filter(t => t.id)) {
          await updateTrack({ id: t.id!, user_id: 'local', pairing_id: pairingId!, title: t.title.trim(), description: t.description, youtube_url: t.youtube_url, order_index: t.order_index, created_at: '' });
        }
        const newTracks = validTracks.filter(t => !t.id);
        for (const t of newTracks) {
          await addTrack({ pairing_id: pairingId!, title: t.title.trim(), description: t.description, youtube_url: t.youtube_url, order_index: t.order_index });
        }
      } else {
        for (const t of validTracks) {
          await addTrack({ pairing_id: pairingId!, title: t.title.trim(), description: t.description, youtube_url: t.youtube_url, order_index: t.order_index });
        }
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161616] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#161616]/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-white font-semibold">{pairing ? '페어 수정' : '새 페어 추가'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cover + Basic Info */}
          <div className="flex gap-5">
            {/* Cover Image */}
            <div
              className="w-28 h-28 flex-shrink-0 rounded-xl border border-white/10 overflow-hidden cursor-pointer relative group"
              style={{ background: themeColor }}
              onClick={() => fileRef.current?.click()}
            >
              {coverPreview ? (
                <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <ImageIcon className="w-6 h-6 text-white/30" />
                  <span className="text-white/30 text-xs">커버</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            {/* Name & Genre */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1">페어 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/50 transition-all"
                  placeholder="예: A x B"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1">장르</label>
                <select
                  value={genreId}
                  onChange={e => setGenreId(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500/50 transition-all"
                  required
                >
                  {genres.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5">설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/50 transition-all resize-none"
              placeholder="이 페어에 대한 짧은 설명..."
            />
          </div>

          {/* Character Tags */}
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5">페어 태그</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1 bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/50 transition-all"
                placeholder="캐릭터 이름 입력 후 Enter"
              />
              <button type="button" onClick={addTag} className="px-4 py-2.5 bg-[#1e1e1e] border border-white/8 hover:border-white/20 rounded-xl text-zinc-400 hover:text-white text-sm transition-all">추가</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/25 text-rose-300 text-xs px-2.5 py-1 rounded-full">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-white transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Theme Color */}
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5">테마 색상</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${themeColor === c ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`}
                  style={{ background: c }}
                />
              ))}
              <div className="flex items-center gap-2 bg-[#1e1e1e] border border-white/8 rounded-xl px-3 py-1.5">
                <input
                  type="color"
                  value={themeColor}
                  onChange={e => setThemeColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-none outline-none"
                />
                <input
                  type="text"
                  value={themeColor}
                  onChange={e => setThemeColor(e.target.value)}
                  className="w-20 bg-transparent text-white text-xs font-mono focus:outline-none"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Tracks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-zinc-400 text-xs font-medium">트랙 목록</label>
              <button type="button" onClick={addTrackItem} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" />
                트랙 추가
              </button>
            </div>
            {tracks.length === 0 && (
              <p className="text-zinc-600 text-sm text-center py-4">아직 트랙이 없습니다</p>
            )}
            <div className="space-y-3">
              {tracks.map((track, idx) => (
                <div key={idx} className="bg-[#1e1e1e] border border-white/8 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveTrack(idx, -1)} disabled={idx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveTrack(idx, 1)} disabled={idx === tracks.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-zinc-600 text-xs w-5">{idx + 1}</span>
                    <input
                      type="text"
                      value={track.title}
                      onChange={e => updateTrackField(idx, 'title', e.target.value)}
                      className="flex-1 bg-[#272727] border border-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-all"
                      placeholder="곡 제목"
                      required
                    />
                    <button type="button" onClick={() => removeTrackItem(idx)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={track.description}
                    onChange={e => updateTrackField(idx, 'description', e.target.value)}
                    className="w-full bg-[#272727] border border-white/5 rounded-lg px-3 py-2 text-zinc-400 text-xs placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-all"
                    placeholder="곡 설명 (선택)"
                  />
                  <input
                    type="url"
                    value={track.youtube_url}
                    onChange={e => updateTrackField(idx, 'youtube_url', e.target.value)}
                    className="w-full bg-[#272727] border border-white/5 rounded-lg px-3 py-2 text-zinc-400 text-xs placeholder-zinc-600 focus:outline-none focus:border-rose-500/40 transition-all"
                    placeholder="YouTube 링크"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 text-sm transition-all">취소</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-lg shadow-rose-500/20">
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
