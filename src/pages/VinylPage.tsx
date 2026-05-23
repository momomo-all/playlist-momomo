import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Pencil, Save, X, Upload } from 'lucide-react';
import {
  getVinylData, saveVinylData, VinylData,
  saveCover, resolveCoverUrl,
} from '../lib/localDb';
import { Pairing } from '../lib/types';

interface Props {
  pairing: Pairing;
  resolvedCover: string;
  onBack: () => void;
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '26,26,46';
  return `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}`;
}

export default function VinylPage({ pairing, resolvedCover, onBack }: Props) {
  const [vinylData, setVinylData] = useState<VinylData>(() => {
    const d = getVinylData(pairing.id);
    return { title: d.title || pairing.name, note: d.note, jacketCoverId: d.jacketCoverId, diskCoverId: d.diskCoverId };
  });

  const [jacketUrl, setJacketUrl] = useState('');
  const [diskUrl, setDiskUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(vinylData.title);
  const [editNote, setEditNote] = useState(vinylData.note);
  const [savedFlash, setSavedFlash] = useState(false);
  const jacketInputRef = useRef<HTMLInputElement>(null);
  const diskInputRef = useRef<HTMLInputElement>(null);

  const resolveImages = useCallback(async (data: VinylData) => {
    setJacketUrl(data.jacketCoverId
      ? (await resolveCoverUrl(`local-cover://${data.jacketCoverId}`)) || resolvedCover
      : resolvedCover
    );
    setDiskUrl(data.diskCoverId
      ? (await resolveCoverUrl(`local-cover://${data.diskCoverId}`)) || ''
      : ''
    );
  }, [resolvedCover]);

  useEffect(() => { resolveImages(vinylData); }, [vinylData, resolveImages]);

  const handleSave = () => {
    const updated: VinylData = {
      title: editTitle.trim() || pairing.name,
      note: editNote,
      jacketCoverId: vinylData.jacketCoverId,
      diskCoverId: vinylData.diskCoverId,
    };
    saveVinylData(pairing.id, updated);
    setVinylData(updated);
    setIsEditing(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'jacket' | 'disk') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const coverId = `vinyl_${type}_${pairing.id}`;
    await saveCover(coverId, file);
    const updated: VinylData = {
      ...vinylData,
      jacketCoverId: type === 'jacket' ? coverId : vinylData.jacketCoverId,
      diskCoverId:   type === 'disk'   ? coverId : vinylData.diskCoverId,
    };
    saveVinylData(pairing.id, updated);
    setVinylData(updated);
    e.target.value = '';
  };

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const bgImg = jacketUrl || resolvedCover;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#111]">

      {/* ── Blurred background ── */}
      <div className="absolute inset-0">
        {bgImg && (
          <img src={bgImg} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(90px)', transform: 'scale(1.18)', opacity: 0.9 }} />
        )}
        {/* deep vignette */}
        <div className="absolute inset-0" style={{ background: 'rgba(6,6,8,0.60)' }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,0.55) 100%)',
        }} />
      </div>

      {/* ── Floating blobs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-20 animate-blob1"
          style={{ background: pairing.theme_color, top: '-20%', left: '-15%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-12 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-15%', right: '-10%' }} />
      </div>

      {/* ── Top nav ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-8 pt-8">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/12 hover:border-white/25 text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">돌아가기</span>
        </button>

        <div className="flex items-center gap-2.5">
          {savedFlash && (
            <span className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
              저장됨
            </span>
          )}
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); setEditTitle(vinylData.title); setEditNote(vinylData.note); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/12 text-white/60 hover:text-white text-sm font-semibold backdrop-blur-md transition-all">
                <X className="w-4 h-4" /> 취소
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
                style={{ background: pairing.theme_color, boxShadow: `0 0 24px rgba(${rgb},0.5)` }}>
                <Save className="w-4 h-4" /> 저장
              </button>
            </>
          ) : (
            <button onClick={() => { setIsEditing(true); setEditTitle(vinylData.title); setEditNote(vinylData.note); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/12 hover:border-white/25 text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
              <Pencil className="w-4 h-4 text-white/60" /> 편집
            </button>
          )}
        </div>
      </div>

      {/* ── Main scene ── */}
      <div className="relative z-20 flex h-full items-center justify-center" style={{ paddingTop: 80, paddingBottom: 20 }}>

        {/* ══ VINYL SCENE (left 55%) ══ */}
        <div className="flex-shrink-0 relative" style={{ width: '55%', maxWidth: 760, height: '100%', minHeight: 0 }}>

          {/* Jacket — positioned left, taking up ~55% of scene width */}
          <div className="absolute" style={{
            width: '48%',
            aspectRatio: '1',
            left: '3%',
            top: '50%',
            transform: 'translateY(-53%)',
            zIndex: 3,
          }}>
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl relative"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.07)' }}>
              {jacketUrl
                ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full" style={{ background: pairing.theme_color }} />
              }
              {/* corner hole punch detail */}
              <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-black/60 border border-white/10" />
            </div>

            {/* Edit overlay */}
            {isEditing && (
              <button onClick={() => jacketInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/65 backdrop-blur-sm text-white transition-all hover:bg-black/75">
                <Upload className="w-6 h-6" />
                <span className="text-xs font-semibold">자켓 변경</span>
              </button>
            )}
          </div>

          {/* LP Disc — positioned right, ~68% of scene width, overlapping jacket */}
          <div className="absolute" style={{
            width: '68%',
            aspectRatio: '1',
            right: '0%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
          }}>
            {/* Disc body */}
            <div className="w-full h-full rounded-full relative overflow-hidden"
              style={{
                animation: 'vinyl-spin 3s linear infinite',
                boxShadow: '0 30px 100px rgba(0,0,0,0.8), 0 0 0 1.5px rgba(255,255,255,0.08)',
              }}>

              {/* Clear vinyl base with subtle color tint */}
              <div className="absolute inset-0 rounded-full" style={{
                background: `radial-gradient(circle at 50% 50%,
                  rgba(${rgb},0.45) 0%,
                  rgba(${rgb},0.25) 30%,
                  rgba(30,22,18,0.7) 55%,
                  rgba(10,8,6,0.85) 100%)`,
              }} />

              {/* Translucent clear-vinyl shimmer */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 40%, rgba(255,255,255,0.04) 60%, transparent 100%)',
                mixBlendMode: 'screen',
              }} />

              {/* Groove rings */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 7px, rgba(255,255,255,0.03) 7px, rgba(255,255,255,0.03) 8px)',
              }} />

              {/* Splatter/marble texture overlay */}
              <div className="absolute inset-0 rounded-full overflow-hidden opacity-30" style={{ mixBlendMode: 'overlay' }}>
                <div style={{
                  width: '100%', height: '100%',
                  background: `radial-gradient(ellipse 120% 80% at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%),
                               radial-gradient(ellipse 80% 120% at 70% 75%, rgba(255,255,255,0.4) 0%, transparent 50%)`,
                }} />
              </div>

              {/* Center label */}
              <div className="absolute rounded-full overflow-hidden"
                style={{
                  width: '28%', height: '28%',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: '#111',
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.18)',
                }}>
                {diskUrl
                  ? <img src={diskUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full rounded-full flex items-center justify-center"
                      style={{ background: '#0f0f0f' }}>
                      <div className="text-center px-2 select-none">
                        <p className="text-white/70 font-bold leading-tight"
                          style={{ fontSize: 'clamp(7px, 1.4vw, 14px)', letterSpacing: '0.02em' }}>
                          {vinylData.title || pairing.name}
                        </p>
                      </div>
                    </div>
                }
                {/* spindle */}
                <div className="absolute w-[14%] h-[14%] rounded-full bg-zinc-300/80 shadow-md"
                  style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>
            </div>

            {/* Disc rim light */}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 45%)',
            }} />

            {/* Edit overlay for disk label */}
            {isEditing && (
              <button onClick={() => diskInputRef.current?.click()}
                className="absolute rounded-full overflow-hidden flex flex-col items-center justify-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold transition-all hover:bg-black/65"
                style={{
                  width: '28%', height: '28%',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  zIndex: 10,
                }}>
                <Upload className="w-4 h-4" />
                <span>라벨</span>
              </button>
            )}
          </div>

          {/* Tonearm */}
          <ToneArm rgb={rgb} themeColor={pairing.theme_color} />
        </div>

        {/* ══ RIGHT: text panel ══ */}
        <div className="flex flex-col flex-1 min-w-0 pr-10 h-full max-h-[calc(100vh-120px)]"
          style={{ maxWidth: 400 }}>

          {/* Title */}
          <div className="flex-shrink-0 mb-5 mt-4">
            {isEditing ? (
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full bg-transparent text-white font-bold tracking-tight focus:outline-none border-b border-white/20 pb-1 placeholder-white/20"
                style={{ fontSize: 'clamp(22px, 3.2vw, 42px)' }}
                placeholder="제목을 입력하세요" />
            ) : (
              <h1 className="text-white font-bold tracking-tight leading-tight"
                style={{ fontSize: 'clamp(22px, 3.2vw, 42px)' }}>
                {vinylData.title || pairing.name}
              </h1>
            )}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {pairing.character_tags.map(tag => (
                <span key={tag}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/12 text-white/40"
                  style={{ background: `rgba(${rgb},0.12)` }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex-shrink-0 h-px mb-5"
            style={{ background: `linear-gradient(to right, rgba(${rgb},0.7), transparent)` }} />

          {/* Note */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {isEditing ? (
              <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                className="w-full h-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white/75 text-sm leading-[1.9] resize-none focus:outline-none focus:border-white/22 placeholder-white/18 backdrop-blur-sm"
                placeholder={"대화 로그, 가사, 메모를 자유롭게 남겨보세요..."}
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }} />
            ) : (
              <div className="h-full overflow-y-auto pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }}>
                {vinylData.note
                  ? <p className="text-white/55 text-sm leading-[1.95] whitespace-pre-wrap">{vinylData.note}</p>
                  : <p className="text-white/18 text-sm italic">[편집] 버튼으로 가사나 대화 로그를 기록해보세요</p>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={jacketInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleImageUpload(e, 'jacket')} />
      <input ref={diskInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleImageUpload(e, 'disk')} />
    </div>
  );
}

/* ── Tonearm component ── */
function ToneArm({ themeColor, rgb }: { themeColor: string; rgb: string }) {
  return (
    <div className="absolute pointer-events-none"
      style={{ right: '-2%', top: '4%', width: '28%', height: '50%', zIndex: 5 }}>
      {/* Pivot base */}
      <div className="absolute top-0 right-0 rounded-full border border-white/20"
        style={{
          width: 40, height: 40,
          background: 'radial-gradient(circle at 35% 35%, #5a5a5a, #1a1a1a)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
        }} />

      {/* Arm rod */}
      <div className="absolute origin-top-right"
        style={{
          width: '130%',
          height: 5,
          top: 18,
          right: 20,
          transform: 'rotate(30deg)',
          background: 'linear-gradient(to bottom, #c0bdb8, #7a7874, #4a4845)',
          borderRadius: 999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)',
        }} />

      {/* Headshell (cartridge tip) */}
      <div className="absolute"
        style={{
          width: 18, height: 10,
          bottom: '12%',
          left: '-4%',
          background: 'linear-gradient(135deg, #888, #444)',
          borderRadius: '3px 3px 6px 6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.7)',
          transform: 'rotate(-10deg)',
        }} />
    </div>
  );
}


export default VinylPage