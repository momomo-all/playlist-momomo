import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, Upload, AlignCenter, AlignLeft, AlignRight,
  RotateCw, Maximize2, Download, Pencil, Check,
} from 'lucide-react';
import {
  getVinylData, saveVinylData, VinylData, ElementTransform,
  DEFAULT_TRANSFORM, DEFAULT_LABEL,
  saveCover, resolveCoverUrl,
} from '../lib/localDb';
import { DiskPattern, PATTERN_THEMES, PatternId } from '../components/VinylPatterns';
import { Pairing, Track } from '../lib/types';

/* ── helpers ── */

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return '26,26,46';
  return `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}`;
}

function buildGradient(colors: string[], pattern: string): string {
  const c = colors.length >= 2 ? colors : [colors[0] || '#1a1a2e', '#000'];
  if (pattern === 'supernova')
    return `conic-gradient(from 0deg at 50% 50%, ${c[0]}, ${c[1]}, ${c[2] || c[0]}, ${c[0]})`;
  if (pattern === 'aurora')
    return `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 50%, ${c[2] || c[0]} 100%)`;
  return `radial-gradient(circle at 50% 50%, ${c[0]} 0%, ${c[1]} 55%, ${c[2] || '#000'} 100%)`;
}

const FONT_OPTIONS = [
  { label: 'Sans',  value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono',  value: '"Courier New", monospace' },
  { label: 'Round', value: '"Trebuchet MS", sans-serif' },
];

/* ── drag hook ── */

function useDrag(enabled: boolean, onMove: (dx: number, dy: number) => void) {
  const active = useRef(false);
  const last   = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    active.current = true;
    last.current = { x: e.clientX, y: e.clientY };

    const move = (me: MouseEvent) => {
      if (!active.current) return;
      onMove(me.clientX - last.current.x, me.clientY - last.current.y);
      last.current = { x: me.clientX, y: me.clientY };
    };
    const up = () => {
      active.current = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [enabled, onMove]);

  return { onMouseDown };
}

/* ── PNG export ── */

async function exportToPng(
  sceneEl: HTMLElement,
  note: string,
  title: string,
  themeColor: string,
) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const W = Math.round(sceneRect.width);
  const H = Math.round(sceneRect.height);

  // right panel width for composite
  const NOTE_W = note.trim() ? 420 : 0;
  const TOTAL_W = W + NOTE_W;
  const TOTAL_H = H;

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = TOTAL_W * dpr;
  canvas.height = TOTAL_H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

  // draw scene as a snapshot via html2canvas-like approach:
  // we use a temporary foreignObject inside SVG → rasterise
  // This works only for same-origin content (all local here)
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <foreignObject width="${W}" height="${H}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;overflow:hidden;">
          ${sceneEl.outerHTML}
        </div>
      </foreignObject>
    </svg>`;
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const img  = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej();
    img.src = url;
  });
  ctx.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);

  // right panel with note text
  if (NOTE_W > 0 && note.trim()) {
    // panel bg
    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(W, 0, NOTE_W, TOTAL_H);
    // divider
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W, TOTAL_H);
    ctx.stroke();

    const PAD = 36;
    // title
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px system-ui';
    ctx.fillText('VINYL LOG', W + PAD, PAD + 14);
    // theme accent line
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W + PAD, PAD + 28);
    ctx.lineTo(W + NOTE_W - PAD, PAD + 28);
    ctx.stroke();
    // title
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(title, W + PAD, PAD + 56, NOTE_W - PAD * 2);
    // note body
    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    const lines = note.split('\n');
    let y = PAD + 90;
    const lineH = 26;
    const maxW = NOTE_W - PAD * 2;
    for (const line of lines) {
      if (y > TOTAL_H - PAD) break;
      // word-wrap
      const words = line.split('');
      let row = '';
      for (const ch of words) {
        const test = row + ch;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(row, W + PAD, y);
          row = ch;
          y += lineH;
          if (y > TOTAL_H - PAD) break;
        } else {
          row = test;
        }
      }
      if (row && y <= TOTAL_H - PAD) ctx.fillText(row, W + PAD, y);
      y += lineH;
    }
  }

  const link = document.createElement('a');
  link.download = `vinyl_${title.replace(/\s+/g, '_') || 'export'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/* ── main component ── */

interface Props {
  pairing: Pairing;
  track?: Track;
  resolvedCover: string;
  onBack: () => void;
}

export default function VinylPage({ pairing, track, resolvedCover, onBack }: Props) {
  const [vd, setVd] = useState<VinylData>(() => {
    const d = getVinylData(pairing.id);
    return {
      ...d,
      jacketTransform: d.jacketTransform ?? { ...DEFAULT_TRANSFORM },
      diskTransform:   d.diskTransform   ?? { ...DEFAULT_TRANSFORM },
      labelStyle:      d.labelStyle      ?? { ...DEFAULT_LABEL },
    };
  });

  const [jacketUrl, setJacketUrl] = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  const [editingLog,  setEditingLog]  = useState(false);
  const [logDraft,    setLogDraft]    = useState('');
  const [exporting,   setExporting]   = useState(false);
  const [jacketOff,   setJacketOff]   = useState({ x: 0, y: 0 });

  const jacketInputRef = useRef<HTMLInputElement>(null);
  const sceneRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJacketOff({ x: vd.jacketTransform.x, y: vd.jacketTransform.y });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing.id]);

  const resolveImages = useCallback(async (data: VinylData) => {
    setJacketUrl(data.jacketCoverId
      ? (await resolveCoverUrl(`local-cover://${data.jacketCoverId}`)) || resolvedCover
      : resolvedCover
    );
  }, [resolvedCover]);

  useEffect(() => { resolveImages(vd); }, [vd, resolveImages]);
  useEffect(() => { setLogDraft(vd.note || ''); }, [vd.note]);

  const update = useCallback((partial: Partial<VinylData>) => {
    setVd(prev => {
      const next = { ...prev, ...partial };
      saveVinylData(pairing.id, next);
      return next;
    });
  }, [pairing.id]);

  const updateJacket = useCallback((t: Partial<ElementTransform>) => {
    setVd(prev => {
      const next = { ...prev, jacketTransform: { ...prev.jacketTransform, ...t } };
      saveVinylData(pairing.id, next);
      return next;
    });
  }, [pairing.id]);

  const updateDisk = useCallback((t: Partial<ElementTransform>) => {
    setVd(prev => {
      const next = { ...prev, diskTransform: { ...prev.diskTransform, ...t } };
      saveVinylData(pairing.id, next);
      return next;
    });
  }, [pairing.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const coverId = `vinyl_jacket_${pairing.id}`;
    await saveCover(coverId, file);
    update({ jacketCoverId: coverId });
    e.target.value = '';
  };

  const saveLog = () => {
    update({ note: logDraft });
    setEditingLog(false);
  };

  const handleExport = async () => {
    if (!sceneRef.current) return;
    setExporting(true);
    try {
      await exportToPng(sceneRef.current, vd.note || '', displayTitle, pairing.theme_color || '#888');
    } finally {
      setExporting(false);
    }
  };

  const jacketDrag = useDrag(true, useCallback((dx, dy) => {
    setJacketOff(prev => {
      const next = { x: prev.x + dx, y: prev.y + dy };
      setVd(v => {
        const updated = { ...v, jacketTransform: { ...v.jacketTransform, x: next.x, y: next.y } };
        saveVinylData(pairing.id, updated);
        return updated;
      });
      return next;
    });
  }, [pairing.id]));

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const bgImg = jacketUrl || resolvedCover;
  const displayTitle = track ? track.title : (vd.title || pairing.name);
  const diskGradient = buildGradient(vd.gradientColors, vd.patternTheme);
  const ls = vd.labelStyle;
  const hasNote = !!vd.note?.trim();

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a]">

      {/* ── Background ── */}
      <div className="absolute inset-0">
        {bgImg && (
          <img src={bgImg} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(90px)', transform: 'scale(1.25)', opacity: 0.88 }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(4,4,6,0.60)' }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 15%, rgba(0,0,0,0.60) 100%)',
        }} />
      </div>

      {/* blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-15 animate-blob1"
          style={{ background: pairing.theme_color, top: '-20%', left: '-15%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-10 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-15%', right: '-10%' }} />
      </div>

      {/* ── Top nav ── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-7 pt-6">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/12 hover:border-white/25 text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">가사로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          {/* PNG 저장 */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <Download className="w-4 h-4" />
            {exporting ? '저장 중...' : 'PNG 저장'}
          </button>

          {/* 로그 */}
          <button
            onClick={() => { setShowLog(v => !v); setShowCustom(false); if (showLog) setEditingLog(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showLog
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <Pencil className="w-3.5 h-3.5 text-white/70" />
            로그 {showLog ? '닫기' : '열기'}
          </button>

          {/* LP 커스텀 */}
          <button
            onClick={() => { setShowCustom(v => !v); setShowLog(false); setEditingLog(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showCustom
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: 14 }}>🎨</span>
            LP 커스텀
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-20 flex h-full" style={{ paddingTop: 68, paddingBottom: 12 }}>

        {/* ══ LEFT: vinyl scene ══ */}
        <div
          ref={sceneRef}
          className={`flex items-center justify-center transition-all duration-500 ease-out flex-shrink-0 ${showLog ? '-translate-x-[4%]' : 'translate-x-0'}`}
          style={{ width: showLog || showCustom ? '58%' : '65%', minWidth: 0 }}>

          <div className="relative flex items-center"
            style={{ width: 'min(90%, 820px)', aspectRatio: showLog ? '1.6' : '1.5' }}>

            {/* JACKET */}
            <div
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                width: showLog ? '40%' : '46%',
                aspectRatio: '1',
                left: showLog ? '0%' : '2%',
                top: '50%',
                zIndex: 4,
                transform: `translateY(-50%) translate(${jacketOff.x}px, ${jacketOff.y}px) scale(${vd.jacketTransform.scale}) rotate(${vd.jacketTransform.rotate}deg)`,
                transition: 'width 0.5s ease, left 0.5s ease',
                userSelect: 'none',
              }}
              {...jacketDrag}
            >
              <div className="w-full h-full rounded-2xl overflow-hidden relative"
                style={{ boxShadow: `0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08), 0 0 50px rgba(${rgb},0.2)` }}>
                {jacketUrl
                  ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                  : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${pairing.theme_color}, #111)` }} />
                }
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)' }} />
              </div>
              {showCustom && (
                <button
                  onClick={() => jacketInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/65 backdrop-blur-sm text-white opacity-0 hover:opacity-100 transition-opacity z-10"
                  onMouseDown={e => e.stopPropagation()}>
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-semibold">자켓 사진 변경</span>
                </button>
              )}
            </div>

            {/* LP DISC */}
            <div className="absolute"
              style={{
                width: '65%', aspectRatio: '1',
                right: '0%', top: '50%', zIndex: 3,
                transform: `translateY(-50%) translate(${vd.diskTransform.x}px, ${vd.diskTransform.y}px) scale(${vd.diskTransform.scale}) rotate(${vd.diskTransform.rotate}deg)`,
                transition: 'all 0.5s ease',
              }}>
              <div className="w-full h-full rounded-full relative overflow-hidden"
                style={{
                  animation: 'vinyl-spin 4s linear infinite',
                  boxShadow: `0 30px 100px rgba(0,0,0,0.88), 0 0 0 2px rgba(255,255,255,0.07), 0 0 50px rgba(${rgb},0.18)`,
                }}>
                <div className="absolute inset-0 rounded-full" style={{ background: diskGradient }} />
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 45%, rgba(255,255,255,0.04) 65%, transparent 100%)',
                  mixBlendMode: 'screen',
                }} />
                <DiskPattern id={vd.patternTheme as PatternId} color="rgba(255,255,255,0.9)" />
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                  background: 'radial-gradient(circle at 50% 50%, transparent 60%, rgba(0,0,0,0.45) 100%)',
                }} />
                {/* center label */}
                <div className="absolute rounded-full overflow-hidden"
                  style={{
                    width: '30%', height: '30%', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                    background: 'radial-gradient(circle, #1e1e1e, #0a0a0a)',
                    boxShadow: '0 0 0 2.5px rgba(255,255,255,0.2)', zIndex: 2,
                  }}>
                  <div className="w-full h-full flex items-center justify-center px-1.5 py-1.5">
                    <p className="leading-tight break-words w-full"
                      style={{
                        fontSize: ls.fontSize, color: ls.color, fontFamily: ls.fontFamily,
                        fontWeight: 700, textAlign: ls.textAlign as 'center' | 'left' | 'right',
                        wordBreak: 'break-word',
                      }}>
                      {ls.text || displayTitle}
                    </p>
                  </div>
                  <div className="absolute w-[13%] h-[13%] rounded-full bg-zinc-200/70"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 3 }} />
                </div>
              </div>
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                background: 'linear-gradient(130deg, rgba(255,255,255,0.08) 0%, transparent 45%)',
              }} />
            </div>
          </div>
        </div>

        {/* ══ RIGHT: panels ══ */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden"
          style={{ paddingRight: showCustom || showLog ? 0 : 40, paddingTop: 8, transition: 'padding 0.4s' }}>

          {/* ── title block ── */}
          <div className={`flex-shrink-0 transition-all duration-500 ${showLog ? 'mb-2' : 'mb-5'}`}>
            <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-1">Now Playing</p>
            <h1 className="text-white font-bold tracking-tight leading-tight"
              style={{ fontSize: showLog ? '1.1rem' : 'clamp(18px, 2.5vw, 32px)' }}>
              {displayTitle}
            </h1>
            {pairing.character_tags.length > 0 && !showLog && !showCustom && (
              <div className="flex flex-wrap gap-1.5 mt-2">
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

          {/* ── CUSTOM PANEL ── */}
          {showCustom && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-4 space-y-6"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
              <CustomPanel
                vd={vd}
                update={update}
                updateJacket={updateJacket}
                updateDisk={updateDisk}
                rgb={rgb}
                onJacketUpload={() => jacketInputRef.current?.click()}
              />
            </div>
          )}

          {/* ── LOG PANEL ── */}
          {showLog && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {editingLog ? (
                /* edit mode */
                <>
                  <textarea
                    autoFocus
                    value={logDraft}
                    onChange={e => setLogDraft(e.target.value)}
                    placeholder={'가사나 대화 로그를 자유롭게 기록해보세요...\n\n저장은 버튼을 누르면 됩니다.'}
                    className="flex-1 min-h-0 w-full rounded-2xl px-5 py-4 text-white/80 text-sm leading-[1.95] resize-none focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid rgba(${rgb},0.35)`,
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                      caretColor: pairing.theme_color,
                    }}
                  />
                  <button
                    onClick={saveLog}
                    className="flex-shrink-0 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95"
                    style={{ background: `rgba(${rgb},0.45)`, border: `1px solid rgba(${rgb},0.7)` }}>
                    <Check className="w-4 h-4" /> 저장
                  </button>
                </>
              ) : (
                /* view mode */
                <div className="flex-1 min-h-0 flex flex-col">
                  <div
                    className="flex-1 overflow-y-auto rounded-2xl px-5 py-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255,255,255,0.08) transparent',
                    }}>
                    {hasNote ? (
                      <p
                        className="text-white/80 whitespace-pre-wrap leading-[2.0]"
                        style={{
                          fontSize: 'clamp(14px, 1.4vw, 17px)',
                          fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
                        }}>
                        {vd.note}
                      </p>
                    ) : (
                      <p className="text-white/18 text-sm italic">아직 작성된 로그가 없습니다.</p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingLog(true)}
                    className="flex-shrink-0 flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl text-white/60 text-sm font-semibold border border-white/10 hover:border-white/22 hover:text-white transition-all hover:scale-[1.01] active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Pencil className="w-3.5 h-3.5" />
                    {hasNote ? '로그 편집' : '로그 작성'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── DEFAULT STATE: show saved log as ambient text ── */}
          {!showCustom && !showLog && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {hasNote ? (
                <div
                  className="h-full overflow-y-auto"
                  style={{ scrollbarWidth: 'none' }}>
                  <p
                    className="whitespace-pre-wrap leading-[2.1] tracking-wide"
                    style={{
                      fontSize: 'clamp(15px, 1.5vw, 19px)',
                      color: 'rgba(255,255,255,0.45)',
                      fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
                    }}>
                    {vd.note}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-white/18 text-sm">
                    [로그 열기]로 이 LP에 대한 기록을 남겨보세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input ref={jacketInputRef} type="file" accept="image/*" className="hidden"
        onChange={handleImageUpload} />
    </div>
  );
}

/* ─── CustomPanel ─── */

interface CPProps {
  vd: VinylData;
  update: (p: Partial<VinylData>) => void;
  updateJacket: (t: Partial<ElementTransform>) => void;
  updateDisk: (t: Partial<ElementTransform>) => void;
  rgb: string;
  onJacketUpload: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.18em] mb-2.5">{children}</p>;
}

function CustomPanel({ vd, update, updateJacket, updateDisk, rgb, onJacketUpload }: CPProps) {
  const setColor = (idx: number, hex: string) => {
    const next = [...vd.gradientColors];
    next[idx] = hex;
    update({ gradientColors: next });
  };

  const setLabel = (partial: Partial<typeof vd.labelStyle>) =>
    update({ labelStyle: { ...vd.labelStyle, ...partial } });

  return (
    <>
      {/* pattern themes */}
      <div>
        <SectionTitle>패턴 테마</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {PATTERN_THEMES.map(t => (
            <button key={t.id} onClick={() => update({ patternTheme: t.id })}
              className="relative rounded-xl overflow-hidden transition-all hover:scale-[1.04] active:scale-95"
              style={{
                aspectRatio: '1',
                background: vd.patternTheme === t.id ? `rgba(${rgb},0.35)` : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${vd.patternTheme === t.id ? `rgba(${rgb},0.7)` : 'rgba(255,255,255,0.1)'}`,
                boxShadow: vd.patternTheme === t.id ? `0 0 14px rgba(${rgb},0.35)` : 'none',
              }}>
              <div className="absolute inset-2 rounded-full overflow-hidden"
                style={{ background: buildGradient(vd.gradientColors, t.id) }}>
                <DiskPattern id={t.id as PatternId} color="rgba(255,255,255,0.85)" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 pb-1 text-center">
                <span className={`text-[9px] font-bold ${vd.patternTheme === t.id ? 'text-white' : 'text-white/40'}`}>{t.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* gradient colors */}
      <div>
        <SectionTitle>색상 조합</SectionTitle>
        <div className="space-y-2">
          {vd.gradientColors.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl border border-white/15 overflow-hidden flex-shrink-0" style={{ background: c }}>
                <input type="color" value={c} onChange={e => setColor(i, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
              <input type="text" value={c}
                onChange={e => e.target.value.match(/^#[0-9a-fA-F]{0,6}$/) && setColor(i, e.target.value)}
                className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-white/25"
                maxLength={7} />
              {vd.gradientColors.length > 2 && (
                <button onClick={() => update({ gradientColors: vd.gradientColors.filter((_, j) => j !== i) })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-white/25 hover:text-red-400 transition-all">×</button>
              )}
            </div>
          ))}
          {vd.gradientColors.length < 3 && (
            <button onClick={() => update({ gradientColors: [...vd.gradientColors, '#888888'] })}
              className="w-full py-2 rounded-xl border border-dashed border-white/15 text-white/30 text-xs hover:border-white/30 hover:text-white/50 transition-all">
              + 색상 추가
            </button>
          )}
        </div>
      </div>

      {/* label editor */}
      <div>
        <SectionTitle>라벨 텍스트 편집</SectionTitle>
        <textarea
          value={vd.labelStyle.text}
          onChange={e => setLabel({ text: e.target.value })}
          rows={2}
          placeholder="중앙 라벨 텍스트 (비우면 곡 제목 표시)"
          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-white/22 placeholder-white/18 mb-3"
        />
        <div className="flex gap-1.5 mb-3">
          {FONT_OPTIONS.map(f => (
            <button key={f.value} onClick={() => setLabel({ fontFamily: f.value })}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: vd.labelStyle.fontFamily === f.value ? `rgba(${rgb},0.4)` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${vd.labelStyle.fontFamily === f.value ? `rgba(${rgb},0.7)` : 'rgba(255,255,255,0.08)'}`,
                color: vd.labelStyle.fontFamily === f.value ? '#fff' : 'rgba(255,255,255,0.4)',
                fontFamily: f.value,
              }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-white/30 text-xs flex-shrink-0">크기</span>
          <input type="range" min={8} max={18} value={vd.labelStyle.fontSize}
            onChange={e => setLabel({ fontSize: Number(e.target.value) })}
            className="flex-1 accent-white/50" />
          <span className="text-white/40 text-xs w-5 flex-shrink-0">{vd.labelStyle.fontSize}</span>
          {(['left', 'center', 'right'] as const).map(align => {
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
            return (
              <button key={align} onClick={() => setLabel({ textAlign: align })}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                style={vd.labelStyle.textAlign === align
                  ? { background: `rgba(${rgb},0.4)`, border: `1px solid rgba(${rgb},0.6)` }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon className="w-3.5 h-3.5 text-white/60" />
              </button>
            );
          })}
          <div className="relative w-7 h-7 rounded-lg border border-white/15 overflow-hidden flex-shrink-0" style={{ background: vd.labelStyle.color }}>
            <input type="color" value={vd.labelStyle.color} onChange={e => setLabel({ color: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
      </div>

      {/* jacket controls */}
      <div>
        <SectionTitle>자켓 편집</SectionTitle>
        <div className="space-y-2.5">
          <button onClick={onJacketUpload}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white/70 text-xs font-medium transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Upload className="w-3.5 h-3.5" /> 자켓 사진 교체
          </button>
          <SliderRow icon={<RotateCw className="w-3.5 h-3.5" />} label="회전"
            min={-180} max={180} value={vd.jacketTransform.rotate}
            onChange={v => updateJacket({ rotate: v })} unit="°" />
          <SliderRow icon={<Maximize2 className="w-3.5 h-3.5" />} label="크기"
            min={0.3} max={2.5} step={0.05} value={vd.jacketTransform.scale}
            onChange={v => updateJacket({ scale: v })} unit="x" decimals={2} />
          <button onClick={() => updateJacket({ ...DEFAULT_TRANSFORM })}
            className="text-white/25 text-xs hover:text-white/50 transition-colors">
            위치/크기 초기화
          </button>
        </div>
      </div>

      {/* disk controls */}
      <div>
        <SectionTitle>디스크 편집</SectionTitle>
        <div className="space-y-2.5">
          <SliderRow icon={<RotateCw className="w-3.5 h-3.5" />} label="기울기"
            min={-180} max={180} value={vd.diskTransform.rotate}
            onChange={v => updateDisk({ rotate: v })} unit="°" />
          <SliderRow icon={<Maximize2 className="w-3.5 h-3.5" />} label="크기"
            min={0.3} max={2.5} step={0.05} value={vd.diskTransform.scale}
            onChange={v => updateDisk({ scale: v })} unit="x" decimals={2} />
          <button onClick={() => updateDisk({ ...DEFAULT_TRANSFORM })}
            className="text-white/25 text-xs hover:text-white/50 transition-colors">
            위치/크기 초기화
          </button>
        </div>
      </div>
    </>
  );
}

interface SliderRowProps {
  icon: React.ReactNode;
  label: string;
  min: number; max: number; step?: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string; decimals?: number;
}

function SliderRow({ icon, label, min, max, step = 1, value, onChange, unit = '', decimals = 0 }: SliderRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-white/30 flex-shrink-0">{icon}</span>
      <span className="text-white/30 text-xs w-10 flex-shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-white/50" />
      <span className="text-white/40 text-xs w-12 text-right flex-shrink-0">
        {decimals > 0 ? value.toFixed(decimals) : value}{unit}
      </span>
    </div>
  );
}


export default VinylPage