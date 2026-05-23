import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Pencil, Save, X, Upload, RotateCcw } from 'lucide-react';
import {
  getVinylData, saveVinylData, VinylData,
  saveCover, resolveCoverUrl,
} from '../lib/localDb';
import { Pairing } from '../lib/types';

interface Props {
  pairing: Pairing;
  resolvedCover: string; // jacket cover resolved URL from PlaylistPage
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
    return {
      title: d.title || pairing.name,
      note: d.note,
      jacketCoverId: d.jacketCoverId,
      diskCoverId: d.diskCoverId,
    };
  });

  const [jacketUrl, setJacketUrl] = useState('');
  const [diskUrl, setDiskUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(vinylData.title);
  const [editNote, setEditNote] = useState(vinylData.note);
  const [isSpinning, setIsSpinning] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const jacketInputRef = useRef<HTMLInputElement>(null);
  const diskInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resolveImages = useCallback(async (data: VinylData) => {
    // Jacket: prefer custom, fallback to pairing cover
    if (data.jacketCoverId) {
      const url = await resolveCoverUrl(`local-cover://${data.jacketCoverId}`);
      setJacketUrl(url || resolvedCover);
    } else {
      setJacketUrl(resolvedCover);
    }
    // Disk label
    if (data.diskCoverId) {
      const url = await resolveCoverUrl(`local-cover://${data.diskCoverId}`);
      setDiskUrl(url);
    } else {
      setDiskUrl('');
    }
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
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedFlash(false), 2200);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'jacket' | 'disk'
  ) => {
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
  const bgImage = jacketUrl || resolvedCover;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* ── Blurred background ── */}
      <div className="absolute inset-0">
        {bgImage && (
          <img
            src={bgImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ filter: 'blur(80px)', transform: 'scale(1.15)' }}
          />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'rgba(4,4,4,0.72)' }} />
      </div>

      {/* ── Animated mesh blobs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-25 animate-blob1"
          style={{ background: pairing.theme_color, top: '-15%', left: '-10%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-15 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-10%', right: '-10%' }} />
        <div className="absolute w-[350px] h-[350px] rounded-full blur-3xl opacity-10 animate-blob3"
          style={{ background: pairing.theme_color, top: '45%', left: '40%' }} />
      </div>

      {/* ── Top nav ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-8 pt-8 pb-4">
        <button
          onClick={onBack}
          className="group flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/10 hover:border-white/25 text-white backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-95"
        >
          <ChevronLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">돌아가기</span>
        </button>

        <div className="flex items-center gap-3">
          {savedFlash && (
            <span className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium backdrop-blur-sm animate-fade-in">
              저장됨
            </span>
          )}
          {isEditing ? (
            <>
              <button
                onClick={() => { setIsEditing(false); setEditTitle(vinylData.title); setEditNote(vinylData.note); }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/10 text-white/70 hover:text-white text-sm font-semibold backdrop-blur-sm transition-all"
              >
                <X className="w-4 h-4" />
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: pairing.theme_color,
                  boxShadow: `0 0 24px rgba(${rgb},0.5)`,
                  color: 'white',
                }}
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </>
          ) : (
            <button
              onClick={() => { setIsEditing(true); setEditTitle(vinylData.title); setEditNote(vinylData.note); }}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black/30 hover:bg-black/50 border border-white/10 hover:border-white/25 text-white text-sm font-semibold backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-95"
            >
              <Pencil className="w-4 h-4 text-white/70" />
              편집
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-20 flex h-full items-center justify-center px-8 pt-24 pb-10 gap-12 lg:gap-20">

        {/* ═══ LEFT: Turntable ═══ */}
        <div className="flex-shrink-0 relative hidden md:flex items-center justify-center"
          style={{ width: 380, height: 380 }}>

          {/* LP Disc — behind jacket */}
          <div
            className="absolute rounded-full"
            style={{
              width: 300,
              height: 300,
              right: -60,
              top: 40,
              zIndex: 1,
            }}
          >
            <div
              className="w-full h-full rounded-full relative overflow-hidden"
              style={{
                background: `conic-gradient(
                  from 0deg,
                  #0e0e0e 0deg, #1c1c1c 12deg, #0e0e0e 24deg, #181818 36deg,
                  #0e0e0e 48deg, #1c1c1c 60deg, #0e0e0e 72deg, #181818 84deg,
                  #0e0e0e 96deg, #1c1c1c 108deg, #0e0e0e 120deg, #181818 132deg,
                  #0e0e0e 144deg, #1c1c1c 156deg, #0e0e0e 168deg, #181818 180deg,
                  #0e0e0e 192deg, #1c1c1c 204deg, #0e0e0e 216deg, #181818 228deg,
                  #0e0e0e 240deg, #1c1c1c 252deg, #0e0e0e 264deg, #181818 276deg,
                  #0e0e0e 288deg, #1c1c1c 300deg, #0e0e0e 312deg, #181818 324deg,
                  #0e0e0e 336deg, #1c1c1c 348deg, #0e0e0e 360deg
                )`,
                animation: isSpinning ? 'vinyl-spin 2.4s linear infinite' : 'none',
                boxShadow: `0 0 60px rgba(0,0,0,0.9), 0 0 120px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
              }}
            >
              {/* Groove rings */}
              <div className="absolute inset-0 rounded-full" style={{
                background: 'repeating-radial-gradient(circle, transparent, transparent 5px, rgba(255,255,255,0.025) 5px, rgba(255,255,255,0.025) 6px)',
              }} />
              {/* Disk center label */}
              <div
                className="absolute rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  width: 88,
                  height: 88,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: pairing.theme_color,
                }}
              >
                {diskUrl ? (
                  <img src={diskUrl} alt="" className="w-full h-full object-cover" />
                ) : jacketUrl ? (
                  <img src={jacketUrl} alt="" className="w-full h-full object-cover opacity-70" />
                ) : null}
                {/* Spindle hole */}
                <div className="absolute w-5 h-5 rounded-full bg-black/80" />
              </div>
            </div>

            {/* Disk rim reflection */}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
            }} />
          </div>

          {/* Jacket image */}
          <div
            className="absolute rounded-2xl overflow-hidden shadow-2xl"
            style={{
              width: 260,
              height: 260,
              left: 0,
              top: 60,
              zIndex: 2,
              background: pairing.theme_color,
              boxShadow: `0 32px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)`,
            }}
          >
            {jacketUrl ? (
              <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-white/10" />
              </div>
            )}
            {/* Upload overlay in edit mode */}
            {isEditing && (
              <button
                onClick={() => jacketInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm transition-opacity hover:bg-black/70 text-white"
              >
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">자켓 변경</span>
              </button>
            )}
          </div>

          {/* Tonearm */}
          <div
            className="absolute"
            style={{
              width: 130,
              height: 4,
              right: -30,
              top: 55,
              zIndex: 4,
              transformOrigin: 'right center',
              transform: 'rotate(30deg)',
              transition: 'transform 0.8s ease-out',
            }}
          >
            <div className="w-full h-full bg-gradient-to-r from-zinc-300/70 to-zinc-500/70 rounded-full shadow-lg" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-200/80 shadow" />
            <div className="absolute left-2 top-1/2 w-6 h-1 bg-zinc-400/60 rounded-full"
              style={{ transform: 'translateY(-50%) rotate(-25deg)' }} />
          </div>

          {/* Spin toggle */}
          <button
            onClick={() => setIsSpinning(s => !s)}
            className="absolute bottom-2 right-0 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white/60 hover:text-white text-xs backdrop-blur-sm transition-all"
          >
            <RotateCcw className={`w-3 h-3 ${isSpinning ? 'animate-spin' : ''}`} />
            {isSpinning ? '정지' : '재생'}
          </button>

          {/* Disk label upload (edit mode) */}
          {isEditing && (
            <button
              onClick={() => diskInputRef.current?.click()}
              className="absolute bottom-2 left-0 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white/60 hover:text-white text-xs backdrop-blur-sm transition-all"
            >
              <Upload className="w-3 h-3" />
              디스크 라벨
            </button>
          )}
        </div>

        {/* ═══ RIGHT: Text area ═══ */}
        <div className="flex-1 min-w-0 max-w-xl flex flex-col h-full max-h-[calc(100vh-140px)]">

          {/* Title */}
          <div className="mb-6 flex-shrink-0">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full bg-transparent text-white text-4xl sm:text-5xl font-bold tracking-tight focus:outline-none border-b border-white/20 pb-2 placeholder-white/20"
                placeholder="제목을 입력하세요"
              />
            ) : (
              <h1 className="text-white text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                {vinylData.title || pairing.name}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {pairing.character_tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/15 text-white/45"
                  style={{ background: `rgba(${rgb},0.15)` }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex-shrink-0 h-px mb-6" style={{ background: `linear-gradient(to right, rgba(${rgb},0.6), transparent)` }} />

          {/* Note / lyrics area — scrollable */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {isEditing ? (
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                className="w-full h-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white/80 text-base leading-[1.85] resize-none focus:outline-none focus:border-white/20 placeholder-white/20 backdrop-blur-sm"
                placeholder={"대화 로그, 가사, 또는 메모를 자유롭게 남겨보세요...\n\n이 공간은 오직 나만의 아카이브입니다."}
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
              />
            ) : (
              <div
                className="h-full overflow-y-auto pr-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
              >
                {vinylData.note ? (
                  <p className="text-white/65 text-base leading-[1.9] whitespace-pre-wrap">
                    {vinylData.note}
                  </p>
                ) : (
                  <p className="text-white/20 text-base italic">
                    [편집] 버튼을 눌러 가사나 대화 로그를 기록해보세요
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={jacketInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleImageUpload(e, 'jacket')}
      />
      <input
        ref={diskInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleImageUpload(e, 'disk')}
      />
    </div>
  );
}
