import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Save, Upload } from 'lucide-react';
import {
  getVinylData, saveVinylData, VinylData,
  saveCover, resolveCoverUrl,
} from '../lib/localDb';
import { Pairing, Track } from '../lib/types';

interface Props {
  pairing: Pairing;
  track?: Track;
  resolvedCover: string;
  onBack: () => void;
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '26,26,46';
  return `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}`;
}

export default function VinylPage({ pairing, track, resolvedCover, onBack }: Props) {
  const [vinylData, setVinylData] = useState<VinylData>(() => {
    const d = getVinylData(pairing.id);
    return { title: d.title || pairing.name, note: d.note, jacketCoverId: d.jacketCoverId, diskCoverId: d.diskCoverId };
  });

  const [jacketUrl, setJacketUrl] = useState('');
  const [diskUrl, setDiskUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
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
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    e.target.value = '';
  };

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const bgImg = jacketUrl || resolvedCover;
  const displayTitle = track ? track.title : (vinylData.title || pairing.name);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a]">

      {/* ── Blurred background ── */}
      <div className="absolute inset-0">
        {bgImg && (
          <img src={bgImg} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(90px)', transform: 'scale(1.18)', opacity: 0.9 }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(5,5,7,0.62)' }} />
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
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-8 pt-7">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/12 hover:border-white/25 text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">가사로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2.5">
          {savedFlash && (
            <span className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
              저장됨
            </span>
          )}
          <button
            onClick={() => setIsEditing(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/35 hover:bg-black/55 border border-white/12 hover:border-white/25 text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={isEditing ? { background: `rgba(${rgb},0.35)`, borderColor: `rgba(${rgb},0.6)` } : {}}
          >
            <Save className="w-4 h-4 text-white/60" />
            {isEditing ? '편집 완료' : 'LP 커스텀'}
          </button>
        </div>
      </div>

      {/* ── Main vinyl scene ── */}
      <div className="relative z-20 flex h-full items-center justify-center" style={{ paddingTop: 72, paddingBottom: 24 }}>

        {/* VINYL SCENE */}
        <div className="flex-shrink-0 relative" style={{ width: 'min(60vw, 700px)', height: '100%' }}>

          {/* Jacket */}
          <div className="absolute" style={{
            width: '46%',
            aspectRatio: '1',
            left: '3%',
            top: '50%',
            transform: 'translateY(-52%)',
            zIndex: 3,
          }}>
            <div className="w-full h-full rounded-2xl overflow-hidden relative"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07)' }}>
              {jacketUrl
                ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full" style={{ background: pairing.theme_color }} />
              }
              <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-black/60 border border-white/10" />
            </div>

            {isEditing && (
              <button onClick={() => jacketInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/65 backdrop-blur-sm text-white transition-all hover:bg-black/75">
                <Upload className="w-6 h-6" />
                <span className="text-xs font-semibold">자켓 사진 변경</span>
              </button>
            )}
          </div>

          {/* LP Disc */}
          <div className="absolute" style={{
            width: '68%',
            aspectRatio: '1',
            right: '0%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
          }}>
            <div className="w-full h-full rounded-full relative overflow-hidden"
              style={{
                animation: 'vinyl-spin 3s linear infinite',
                boxShadow: '0 30px 100px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(255,255,255,0.08)',
              }}>
              {/* Clear vinyl tint */}
              <div className="absolute inset-0 rounded-full" style={{
                background: `radial-gradient(circle at 50% 50%,
                  rgba(${rgb},0.45) 0%,
                  rgba(${rgb},0.22) 30%,
                  rgba(30,22,18,0.72) 55%,
                  rgba(8,6,4,0.88) 100%)`,
              }} />
              {/* Shimmer */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 40%, rgba(255,255,255,0.04) 60%, transparent 100%)',
                mixBlendMode: 'screen',
              }} />
              {/* Grooves */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 7px, rgba(255,255,255,0.03) 7px, rgba(255,255,255,0.03) 8px)',
              }} />
              {/* Splatter */}
              <div className="absolute inset-0 rounded-full overflow-hidden opacity-28" style={{ mixBlendMode: 'overlay' }}>
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
                  background: '#0e0e0e',
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.18)',
                }}>
                {diskUrl
                  ? <img src={diskUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full rounded-full flex items-center justify-center px-1">
                      <p className="text-white/65 font-bold text-center leading-tight select-none"
                        style={{ fontSize: 'clamp(6px, 1.2vw, 12px)' }}>
                        {displayTitle}
                      </p>
                    </div>
                }
                {/* spindle */}
                <div className="absolute w-[14%] h-[14%] rounded-full bg-zinc-300/80"
                  style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              </div>
            </div>

            {/* Disc edit overlay */}
            {isEditing && (
              <button onClick={() => diskInputRef.current?.click()}
                className="absolute rounded-full overflow-hidden flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-sm text-white text-xs font-semibold transition-all hover:bg-black/70"
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
          <ToneArm />
        </div>

        {/* RIGHT: minimal typography */}
        <div className="flex flex-col flex-1 min-w-0 pl-2 pr-12 justify-center gap-4" style={{ maxWidth: 340 }}>
          <div>
            <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-2">Now Playing</p>
            <h1 className="text-white font-bold tracking-tight leading-tight mb-2"
              style={{ fontSize: 'clamp(20px, 2.8vw, 36px)' }}>
              {displayTitle}
            </h1>
            {pairing.character_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pairing.character_tags.map(tag => (
                  <span key={tag}
                    className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-white/35"
                    style={{ background: `rgba(${rgb},0.12)` }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Edit hint */}
          {isEditing && (
            <div className="rounded-2xl border border-white/10 px-4 py-3 text-white/40 text-xs leading-relaxed backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="font-semibold text-white/60 mb-1">LP 커스텀 모드</p>
              왼쪽 자켓을 클릭해서 앨범 사진을 바꾸고,<br />
              LP 중앙 라벨을 클릭해서 디스크 이미지를 넣으세요.
            </div>
          )}
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

function ToneArm() {
  return (
    <div className="absolute pointer-events-none"
      style={{ right: '-2%', top: '4%', width: '28%', height: '50%', zIndex: 5 }}>
      <div className="absolute top-0 right-0 rounded-full border border-white/20"
        style={{
          width: 38, height: 38,
          background: 'radial-gradient(circle at 35% 35%, #5a5a5a, #1a1a1a)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
        }} />
      <div className="absolute origin-top-right"
        style={{
          width: '130%', height: 4,
          top: 17, right: 19,
          transform: 'rotate(30deg)',
          background: 'linear-gradient(to bottom, #c0bdb8, #7a7874, #4a4845)',
          borderRadius: 999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)',
        }} />
      <div className="absolute"
        style={{
          width: 16, height: 9,
          bottom: '12%', left: '-4%',
          background: 'linear-gradient(135deg, #888, #444)',
          borderRadius: '3px 3px 6px 6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.7)',
          transform: 'rotate(-10deg)',
        }} />
    </div>
  );
}
