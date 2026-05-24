import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, Upload, AlignCenter, AlignLeft, AlignRight,
  RotateCw, Maximize2, Download, Pencil, Check, X,
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

/* ── drag hook (mouse + touch) ── */

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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const t = e.touches[0];
    active.current = true;
    last.current = { x: t.clientX, y: t.clientY };

    const move = (te: TouchEvent) => {
      if (!active.current) return;
      const tt = te.touches[0];
      onMove(tt.clientX - last.current.x, tt.clientY - last.current.y);
      last.current = { x: tt.clientX, y: tt.clientY };
    };
    const up = () => {
      active.current = false;
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
  }, [enabled, onMove]);

  return { onMouseDown, onTouchStart };
}

/* ── PNG export ── */

async function imgToBase64(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

async function exportToPng(
  sceneEl: HTMLElement,
  note: string,
  title: string,
  themeColor: string,
) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const W = Math.round(sceneRect.width);
  const H = Math.round(sceneRect.height);

  // Clone DOM and inline all external image src as base64 to avoid canvas tainting
  const clone = sceneEl.cloneNode(true) as HTMLElement;
  const imgs = clone.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(async (img) => {
    const b64 = await imgToBase64(img.src);
    if (b64) img.src = b64;
    img.crossOrigin = 'anonymous';
  }));
  // Also replace background-image url() in inline styles
  clone.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    // skip — handled by image elements above
  });

  const NOTE_W = note.trim() ? 420 : 0;
  const TOTAL_W = W + NOTE_W;
  const TOTAL_H = H;

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = TOTAL_W * dpr;
  canvas.height = TOTAL_H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <foreignObject width="${W}" height="${H}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;overflow:hidden;">
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>`;
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(svgBlob);
  const img  = new Image();
  await new Promise<void>((res) => {
    img.onload = () => res();
    img.onerror = () => res(); // proceed even if SVG render fails
    img.src = url;
  });
  ctx.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);

  if (NOTE_W > 0 && note.trim()) {
    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(W, 0, NOTE_W, TOTAL_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W, 0);
    ctx.lineTo(W, TOTAL_H);
    ctx.stroke();

    const PAD = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px system-ui';
    ctx.fillText('VINYL LOG', W + PAD, PAD + 14);
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W + PAD, PAD + 28);
    ctx.lineTo(W + NOTE_W - PAD, PAD + 28);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(title, W + PAD, PAD + 56, NOTE_W - PAD * 2);
    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    const lines = note.split('\n');
    let y = PAD + 90;
    const lineH = 26;
    const maxW = NOTE_W - PAD * 2;
    for (const line of lines) {
      if (y > TOTAL_H - PAD) break;
      const chars = line.split('');
      let row = '';
      for (const ch of chars) {
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

  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `vinyl_${title.replace(/\s+/g, '_') || 'export'}.png`;
    link.href = dataUrl;
    link.click();
  } catch {
    // Canvas still tainted (e.g. CORS image) — fallback: open in new tab
    canvas.toBlob(blob => {
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      }
    });
  }
}

/* ── main component ── */

interface Props {
  pairing: Pairing;
  track?: Track;
  resolvedCover: string;
  onBack: () => void;
}

function VinylPage({ pairing, track, resolvedCover, onBack }: Props) {
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
  const [bgUrl,     setBgUrl]     = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  const [editingLog,  setEditingLog]  = useState(false);
  const [logDraft,    setLogDraft]    = useState('');
  const [exporting,   setExporting]   = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState('');
  const [jacketOff,    setJacketOff]    = useState({ x: 0, y: 0 });
  const [diskOff,      setDiskOff]      = useState({ x: 0, y: 0 });
  const [panelPos,     setPanelPos]     = useState<{ x: number; y: number } | null>(null);
  const [isMobile,     setIsMobile]     = useState(false);
  const panelDragging  = useRef(false);
  const panelLast      = useRef({ x: 0, y: 0 });

  const jacketInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef     = useRef<HTMLInputElement>(null);
  const sceneRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setJacketOff({ x: vd.jacketTransform.x, y: vd.jacketTransform.y });
    setDiskOff({ x: vd.diskTransform.x, y: vd.diskTransform.y });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing.id]);

  const resolveImages = useCallback(async (data: VinylData) => {
    const baseUrl = resolvedCover.startsWith('local-cover://')
      ? (await resolveCoverUrl(resolvedCover)) || ''
      : resolvedCover;
    setJacketUrl(data.jacketCoverId
      ? (await resolveCoverUrl(`local-cover://${data.jacketCoverId}`)) || baseUrl
      : baseUrl
    );
    setBgUrl(data.bgCoverId
      ? (await resolveCoverUrl(`local-cover://${data.bgCoverId}`)) || ''
      : ''
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

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const coverId = `vinyl_bg_${pairing.id}`;
    await saveCover(coverId, file);
    update({ bgCoverId: coverId });
    e.target.value = '';
  };

  const clearBg = () => update({ bgCoverId: '' });

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

  const onPanelMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('textarea,button,input,a')) return;
    e.preventDefault();
    panelDragging.current = true;
    panelLast.current = { x: e.clientX, y: e.clientY };
    // On first drag, convert from right-anchored to left/top absolute
    setPanelPos(prev => {
      if (prev) return prev;
      const w = showCustom ? 340 : 420;
      return { x: window.innerWidth - 28 - w, y: 80 };
    });
    const move = (me: MouseEvent) => {
      if (!panelDragging.current) return;
      const dx = me.clientX - panelLast.current.x;
      const dy = me.clientY - panelLast.current.y;
      setPanelPos(prev => prev ? { x: prev.x + dx, y: prev.y + dy } : prev);
      panelLast.current = { x: me.clientX, y: me.clientY };
    };
    const up = () => { panelDragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [showCustom]);

  const onPanelTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('textarea,button,input,a')) return;
    const t = e.touches[0];
    panelDragging.current = true;
    panelLast.current = { x: t.clientX, y: t.clientY };
    setPanelPos(prev => {
      if (prev) return prev;
      const w = showCustom ? 340 : 420;
      return { x: window.innerWidth - 28 - w, y: 80 };
    });
    const move = (te: TouchEvent) => {
      if (!panelDragging.current) return;
      const tt = te.touches[0];
      const dx = tt.clientX - panelLast.current.x;
      const dy = tt.clientY - panelLast.current.y;
      setPanelPos(prev => prev ? { x: prev.x + dx, y: prev.y + dy } : prev);
      panelLast.current = { x: tt.clientX, y: tt.clientY };
    };
    const up = () => { panelDragging.current = false; window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
  }, [showCustom]);

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

  const diskDrag = useDrag(true, useCallback((dx, dy) => {
    setDiskOff(prev => {
      const next = { x: prev.x + dx, y: prev.y + dy };
      setVd(v => {
        const updated = { ...v, diskTransform: { ...v.diskTransform, x: next.x, y: next.y } };
        saveVinylData(pairing.id, updated);
        return updated;
      });
      return next;
    });
  }, [pairing.id]));

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const bgImg = bgUrl || jacketUrl || resolvedCover;
  const bgBlur = vd.bgBlur ?? 90;
  const bgOpacity = (vd.bgOpacity ?? 88) / 100;
  const displayTitle = vd.title || (track ? track.title : pairing.name);
  const diskGradient = buildGradient(vd.gradientColors, vd.patternTheme);
  const ls = vd.labelStyle;
  const hasNote = !!vd.note?.trim();

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0">
          {bgImg && (
            <img src={bgImg} alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: `blur(${bgBlur}px)`, transform: 'scale(1.3)', opacity: bgOpacity }} />
          )}
          <div className="absolute inset-0" style={{ background: 'rgba(4,4,6,0.65)' }} />
        </div>

        {/* Top nav */}
        <div className="relative z-40 flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 border border-white/12 text-white backdrop-blur-md active:scale-95">
            <ChevronLeft className="w-4 h-4 text-white/60" />
            <span className="text-sm font-semibold">돌아가기</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-white text-sm backdrop-blur-md active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowLog(v => !v); setShowCustom(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-white text-sm backdrop-blur-md active:scale-95"
              style={showLog
                ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)` }
                : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowCustom(v => !v); setShowLog(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-white text-sm backdrop-blur-md active:scale-95"
              style={showCustom
                ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)` }
                : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <span style={{ fontSize: 16 }}>🎨</span>
            </button>
          </div>
        </div>

        {/* Vinyl scene */}
        <div ref={sceneRef} className="relative z-20 flex-shrink-0 flex items-center justify-center"
          style={{ height: '46vw', minHeight: 160, maxHeight: 260 }}>
          <div className="relative flex items-center" style={{ width: '80vw', height: '100%' }}>
            {/* Jacket */}
            <div
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                width: '42%', aspectRatio: '1',
                left: '2%', top: '50%', zIndex: 4,
                transform: `translateY(-50%) translate(${jacketOff.x}px, ${jacketOff.y}px) scale(${vd.jacketTransform.scale}) rotate(${vd.jacketTransform.rotate}deg)`,
                userSelect: 'none',
              }}
              {...jacketDrag}
            >
              <div className="w-full h-full rounded-xl overflow-hidden relative"
                style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)` }}>
                {jacketUrl
                  ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                  : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${pairing.theme_color}, #111)` }} />
                }
              </div>
            </div>
            {/* Disc */}
            <div className="absolute cursor-grab active:cursor-grabbing"
              style={{
                width: '60%', aspectRatio: '1',
                right: '0%', top: '50%', zIndex: 3,
                transform: `translateY(-50%) translate(${diskOff.x}px, ${diskOff.y}px) scale(${vd.diskTransform.scale}) rotate(${vd.diskTransform.rotate}deg)`,
                userSelect: 'none',
              }}
              {...diskDrag}
            >
              <div className="w-full h-full rounded-full relative overflow-hidden"
                style={{ animation: 'vinyl-spin 4s linear infinite', boxShadow: `0 20px 60px rgba(0,0,0,0.88)` }}>
                <div className="absolute inset-0 rounded-full" style={{ background: diskGradient }} />
                <DiskPattern id={vd.patternTheme as PatternId} color="rgba(255,255,255,0.9)" />
                <div className="absolute rounded-full overflow-hidden"
                  style={{ width: '30%', height: '30%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, #1e1e1e, #0a0a0a)', boxShadow: '0 0 0 2px rgba(255,255,255,0.2)', zIndex: 2 }}>
                  <div className="w-full h-full flex items-center justify-center px-1 py-1">
                    <p className="leading-tight break-words w-full"
                      style={{ fontSize: Math.max(6, ls.fontSize * 0.7), color: ls.color, fontFamily: ls.fontFamily, fontWeight: 700, textAlign: ls.textAlign as 'center' | 'left' | 'right', wordBreak: 'break-word' }}>
                      {ls.text || displayTitle}
                    </p>
                  </div>
                  <div className="absolute w-[13%] h-[13%] rounded-full bg-zinc-200/70"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 3 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="relative z-20 flex-shrink-0 px-5 pt-3 pb-2">
          <p className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-0.5">Now Playing</p>
          {editingTitle ? (
            <form onSubmit={e => { e.preventDefault(); update({ title: titleDraft }); setEditingTitle(false); }}
              className="flex items-center gap-2">
              <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                onBlur={() => { update({ title: titleDraft }); setEditingTitle(false); }}
                onKeyDown={e => e.key === 'Escape' && setEditingTitle(false)}
                className="flex-1 bg-transparent border-b text-white text-xl font-bold tracking-tight focus:outline-none"
                style={{ borderColor: `rgba(${rgb},0.6)`, caretColor: pairing.theme_color }} />
            </form>
          ) : (
            <div className="flex items-center gap-2" onClick={() => { setTitleDraft(displayTitle); setEditingTitle(true); }}>
              <h1 className="text-white text-xl font-bold tracking-tight leading-tight">{displayTitle}</h1>
              <Pencil className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            </div>
          )}
        </div>

        {/* Scrollable content area */}
        <div className="relative z-20 flex-1 min-h-0 overflow-y-auto px-5 pb-6"
          style={{ scrollbarWidth: 'none' }}>

          {/* Log panel */}
          {showLog && (
            <div className="flex flex-col gap-3 pt-2">
              {editingLog ? (
                <>
                  <textarea autoFocus value={logDraft} onChange={e => setLogDraft(e.target.value)}
                    placeholder="가사나 대화 로그를 기록해보세요..."
                    className="w-full rounded-2xl px-4 py-3.5 text-white/80 text-sm leading-[1.9] resize-none focus:outline-none"
                    rows={8}
                    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(${rgb},0.35)`, caretColor: pairing.theme_color }} />
                  <button onClick={saveLog}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold active:scale-95"
                    style={{ background: `rgba(${rgb},0.45)`, border: `1px solid rgba(${rgb},0.7)` }}>
                    <Check className="w-4 h-4" /> 저장
                  </button>
                </>
              ) : (
                <>
                  {hasNote && (
                    <p className="text-white/75 whitespace-pre-wrap leading-[2.0] text-sm"
                      style={{ fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif' }}>
                      {vd.note}
                    </p>
                  )}
                  <button onClick={() => setEditingLog(true)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-white/60 text-sm font-semibold border border-white/10 active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Pencil className="w-3.5 h-3.5" />
                    {hasNote ? '로그 편집' : '로그 작성'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Custom panel */}
          {showCustom && (
            <div className="pt-2 space-y-6">
              <CustomPanel
                vd={vd} update={update} updateJacket={updateJacket} updateDisk={updateDisk}
                rgb={rgb} onJacketUpload={() => jacketInputRef.current?.click()}
                onBgUpload={() => bgInputRef.current?.click()} onClearBg={clearBg} bgUrl={bgUrl} />
            </div>
          )}

          {/* Default ambient note */}
          {!showLog && !showCustom && hasNote && (
            <div className="pt-2">
              <p className="whitespace-pre-wrap leading-[2.0] text-sm"
                style={{ color: 'rgba(255,255,255,0.42)', fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif' }}>
                {vd.note}
              </p>
            </div>
          )}
          {!showLog && !showCustom && !hasNote && (
            <p className="text-white/18 text-sm pt-2">로그 버튼으로 이 LP에 대한 기록을 남겨보세요.</p>
          )}
        </div>

        <input ref={jacketInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
      </div>
    );
  }

  /* ── DESKTOP LAYOUT ── */
  return (
    <div className="fixed inset-0 bg-[#0a0a0a]">

      {/* Background */}
      <div className="absolute inset-0">
        {bgImg && (
          <img src={bgImg} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: `blur(${bgBlur}px)`, transform: 'scale(1.25)', opacity: bgOpacity }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(4,4,6,0.60)' }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 15%, rgba(0,0,0,0.60) 100%)',
        }} />
      </div>

      {/* blobs */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-15 animate-blob1"
          style={{ background: pairing.theme_color, top: '-20%', left: '-15%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-10 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-15%', right: '-10%' }} />
      </div>

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-7 pt-6">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/12 hover:border-white/25 text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">가사로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <Download className="w-4 h-4" />
            {exporting ? '저장 중...' : 'PNG 저장'}
          </button>

          <button
            onClick={() => { setPanelPos(null); setShowLog(v => !v); setShowCustom(false); setEditingLog(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showLog
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <Pencil className="w-3.5 h-3.5 text-white/70" />
            로그 {showLog ? '닫기' : '열기'}
          </button>

          <button
            onClick={() => { setPanelPos(null); setShowCustom(v => !v); setShowLog(false); setEditingLog(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showCustom
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: 14 }}>🎨</span>
            LP 커스텀
          </button>
        </div>
      </div>

      {/* Vinyl scene — full screen, centered */}
      <div
        ref={sceneRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 10, paddingTop: 72 }}>

        <div className="relative flex items-center"
          style={{ width: 'min(68%, 800px)', aspectRatio: '1.55' }}>

          {/* JACKET */}
          <div
            className="absolute cursor-grab active:cursor-grabbing"
            style={{
              width: '46%', aspectRatio: '1',
              left: '2%', top: '50%', zIndex: 4,
              transform: `translateY(-50%) translate(${jacketOff.x}px, ${jacketOff.y}px) scale(${vd.jacketTransform.scale}) rotate(${vd.jacketTransform.rotate}deg)`,
              userSelect: 'none',
            }}
            {...jacketDrag}
          >
            <div className="w-full h-full rounded-2xl relative" style={{ boxShadow: `0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08), 0 0 50px rgba(${rgb},0.2)` }}>
              {jacketUrl
                ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover rounded-2xl pointer-events-none" draggable={false} />
                : <div className="w-full h-full rounded-2xl" style={{ background: `linear-gradient(135deg, ${pairing.theme_color}, #111)` }} />
              }
              <div className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)' }} />
            </div>
            {showCustom && (
              <button
                onClick={() => jacketInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl text-white opacity-0 hover:opacity-100 transition-opacity z-10"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
                onMouseDown={e => e.stopPropagation()}>
                <Upload className="w-5 h-5" />
                <span className="text-xs font-semibold">자켓 사진 변경</span>
              </button>
            )}
          </div>

          {/* LP DISC */}
          <div className="absolute cursor-grab active:cursor-grabbing"
            style={{
              width: '65%', aspectRatio: '1',
              right: '0%', top: '50%', zIndex: 3,
              transform: `translateY(-50%) translate(${diskOff.x}px, ${diskOff.y}px) scale(${vd.diskTransform.scale}) rotate(${vd.diskTransform.rotate}deg)`,
              userSelect: 'none',
            }}
            {...diskDrag}
          >
            <div className="w-full h-full rounded-full relative"
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
              <div className="absolute rounded-full" style={{ width: '30%', height: '30%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, #1e1e1e, #0a0a0a)', boxShadow: '0 0 0 2.5px rgba(255,255,255,0.2)', zIndex: 2 }}>
                <div className="w-full h-full flex items-center justify-center px-1.5 py-1.5">
                  <p className="leading-tight break-words w-full"
                    style={{ fontSize: ls.fontSize, color: ls.color, fontFamily: ls.fontFamily, fontWeight: 700, textAlign: ls.textAlign as 'center' | 'left' | 'right', wordBreak: 'break-word' }}>
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

      {/* NOW PLAYING — title + note, right side overlay */}
      {!showLog && (
        <div className="absolute z-20" style={{ right: 56, top: '50%', transform: 'translateY(-50%)', maxWidth: 360, paddingTop: 36 }}>
          <p className="text-white/30 text-[10px] uppercase tracking-[0.25em] mb-3 select-none">Now Playing</p>
          <div className="flex items-center gap-2 group" style={{ cursor: 'text' }}
            onClick={() => { setTitleDraft(displayTitle); setEditingTitle(true); }}>
            {editingTitle ? (
              <form onSubmit={e => { e.preventDefault(); update({ title: titleDraft }); setEditingTitle(false); }}
                onClick={e => e.stopPropagation()}>
                <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                  onBlur={() => { update({ title: titleDraft }); setEditingTitle(false); }}
                  onKeyDown={e => e.key === 'Escape' && setEditingTitle(false)}
                  className="bg-transparent border-b text-white font-bold tracking-tight focus:outline-none"
                  style={{ fontSize: 'clamp(24px, 2.8vw, 44px)', borderColor: `rgba(${rgb},0.6)`, caretColor: pairing.theme_color, width: '12ch' }} />
              </form>
            ) : (
              <>
                <h1 className="text-white font-bold tracking-tight leading-none"
                  style={{ fontSize: 'clamp(24px, 2.8vw, 44px)' }}>
                  {displayTitle}
                </h1>
                <Pencil className="w-3.5 h-3.5 text-white/0 group-hover:text-white/35 transition-colors flex-shrink-0" />
              </>
            )}
          </div>
          {hasNote && (
            <p className="mt-5 text-white/50 leading-[1.95] whitespace-pre-wrap"
              style={{ fontSize: 'clamp(12px, 1.05vw, 15px)', fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif' }}>
              {vd.note}
            </p>
          )}
        </div>
      )}

      {/* ── LOG floating draggable panel ── */}
      {showLog && (
        <div
          className="absolute z-30 rounded-2xl"
          style={{
            width: 420,
            top: panelPos ? panelPos.y : 80,
            left: panelPos ? panelPos.x : undefined,
            right: panelPos ? undefined : 40,
            background: 'rgba(8,8,10,0.72)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
          }}
          onMouseDown={onPanelMouseDown}
          onTouchStart={onPanelTouchStart}
        >
          {/* drag handle — only this area drags */}
          <div
            className="flex items-center justify-between px-5 pt-4 pb-3 select-none cursor-grab active:cursor-grabbing"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-[0.2em] select-none">LOG</span>
            </div>
            <div className="flex items-center gap-3 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
              {editingTitle ? (
                <form onSubmit={e => { e.preventDefault(); update({ title: titleDraft }); setEditingTitle(false); }}>
                  <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                    onBlur={() => { update({ title: titleDraft }); setEditingTitle(false); }}
                    onKeyDown={e => e.key === 'Escape' && setEditingTitle(false)}
                    className="bg-transparent border-b text-white text-sm font-bold tracking-tight focus:outline-none"
                    style={{ borderColor: `rgba(${rgb},0.6)`, caretColor: pairing.theme_color, width: 160 }} />
                </form>
              ) : (
                <button onClick={() => { setTitleDraft(displayTitle); setEditingTitle(true); }}
                  className="group flex items-center gap-1.5">
                  <span className="text-white/60 text-sm font-semibold truncate max-w-[160px]">{displayTitle}</span>
                  <Pencil className="w-3 h-3 text-white/0 group-hover:text-white/40 transition-colors" />
                </button>
              )}
              <button onClick={() => { setShowLog(false); setEditingLog(false); }}
                className="text-white/25 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* body — not draggable */}
          <div onMouseDown={e => e.stopPropagation()}>
            {editingLog ? (
              <div className="px-5 py-4 flex flex-col gap-3">
                <textarea autoFocus value={logDraft} onChange={e => setLogDraft(e.target.value)}
                  placeholder="가사나 대화 로그를 자유롭게 기록해보세요..."
                  rows={10}
                  className="w-full rounded-xl px-4 py-3 text-white/80 text-sm leading-[1.9] resize-none focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(${rgb},0.30)`, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent', caretColor: pairing.theme_color }} />
                <button onClick={saveLog}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95"
                  style={{ background: `rgba(${rgb},0.42)`, border: `1px solid rgba(${rgb},0.65)` }}>
                  <Check className="w-4 h-4" /> 저장
                </button>
              </div>
            ) : (
              <div className="px-5 py-4 flex flex-col gap-3">
                <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                  {hasNote ? (
                    <p className="text-white/75 whitespace-pre-wrap leading-[2.1]"
                      style={{ fontSize: 'clamp(13px, 1.15vw, 16px)', fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif' }}>
                      {vd.note}
                    </p>
                  ) : (
                    <p className="text-white/20 text-sm italic py-2">아직 작성된 로그가 없습니다.</p>
                  )}
                </div>
                <button onClick={() => setEditingLog(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white/50 text-sm font-semibold transition-all hover:text-white/80 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Pencil className="w-3.5 h-3.5" />
                  {hasNote ? '로그 편집' : '로그 작성'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CUSTOMIZE floating panel ── */}
      {showCustom && (
        <div
          className="absolute z-30 rounded-2xl"
          style={{
            width: 340,
            top: panelPos ? panelPos.y : 80,
            left: panelPos ? panelPos.x : undefined,
            right: panelPos ? undefined : 40,
            background: 'rgba(8,8,10,0.72)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
          }}
          onMouseDown={onPanelMouseDown}
          onTouchStart={onPanelTouchStart}
        >
          <div
            className="flex items-center justify-between px-5 pt-4 pb-3 select-none cursor-grab active:cursor-grabbing"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-[0.2em] select-none">CUSTOMIZE</span>
            </div>
            <button onClick={() => setShowCustom(false)} onMouseDown={e => e.stopPropagation()}
              className="text-white/25 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
            <div className="px-4 py-4 space-y-6">
              <CustomPanel vd={vd} update={update} updateJacket={updateJacket} updateDisk={updateDisk}
                rgb={rgb} onJacketUpload={() => jacketInputRef.current?.click()}
                onBgUpload={() => bgInputRef.current?.click()} onClearBg={clearBg} bgUrl={bgUrl} />
            </div>
          </div>
        </div>
      )}

      <input ref={jacketInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
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
  onBgUpload: () => void;
  onClearBg: () => void;
  bgUrl: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.18em] mb-2.5">{children}</p>;
}

function CustomPanel({ vd, update, updateJacket, updateDisk, rgb, onJacketUpload, onBgUpload, onClearBg, bgUrl }: CPProps) {
  const setColor = (idx: number, hex: string) => {
    const next = [...vd.gradientColors];
    next[idx] = hex;
    update({ gradientColors: next });
  };

  const setLabel = (partial: Partial<typeof vd.labelStyle>) =>
    update({ labelStyle: { ...vd.labelStyle, ...partial } });

  return (
    <>
      {/* ── Background section ── */}
      <div>
        <SectionTitle>배경 이미지</SectionTitle>
        <div className="space-y-3">
          {/* Preview + upload/clear */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/12 relative"
              style={{ background: bgUrl ? 'transparent' : 'rgba(255,255,255,0.05)' }}>
              {bgUrl
                ? <img src={bgUrl} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/20 text-[10px] text-center leading-tight px-1">앨범<br/>커버</span>
                  </div>
              }
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <button onClick={onBgUpload}
                className="flex items-center justify-center gap-2 py-2 rounded-xl text-white/70 text-xs font-medium active:scale-95 transition-all hover:text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Upload className="w-3.5 h-3.5" /> 배경 사진 선택
              </button>
              {bgUrl && (
                <button onClick={onClearBg}
                  className="flex items-center justify-center gap-2 py-2 rounded-xl text-white/40 text-xs transition-all hover:text-red-400 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <X className="w-3.5 h-3.5" /> 기본값으로 (앨범 커버)
                </button>
              )}
            </div>
          </div>

          {/* Blur slider */}
          <SliderRow
            icon={<span className="text-[11px]">흐림</span>}
            label=""
            min={0} max={120} step={2}
            value={vd.bgBlur ?? 90}
            onChange={v => update({ bgBlur: v })}
            unit="px"
          />

          {/* Opacity slider */}
          <SliderRow
            icon={<span className="text-[11px]">밝기</span>}
            label=""
            min={0} max={100} step={1}
            value={vd.bgOpacity ?? 88}
            onChange={v => update({ bgOpacity: v })}
            unit="%"
          />
        </div>
      </div>

      <div>
        <SectionTitle>패턴 테마</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {PATTERN_THEMES.map(t => (
            <button key={t.id} onClick={() => update({ patternTheme: t.id })}
              className="relative rounded-xl overflow-hidden transition-all active:scale-95"
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
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-white/25 hover:text-red-400 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
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

      <div>
        <SectionTitle>라벨 텍스트 편집</SectionTitle>
        <textarea value={vd.labelStyle.text} onChange={e => setLabel({ text: e.target.value })}
          rows={2} placeholder="중앙 라벨 텍스트 (비우면 곡 제목 표시)"
          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-white/22 placeholder-white/18 mb-3" />
        <div className="flex gap-1.5 mb-3">
          {FONT_OPTIONS.map(f => (
            <button key={f.value} onClick={() => setLabel({ fontFamily: f.value })}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
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

      <div>
        <SectionTitle>자켓 편집</SectionTitle>
        <div className="space-y-2.5">
          <button onClick={onJacketUpload}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white/70 text-xs font-medium transition-all hover:text-white active:scale-95"
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

export default VinylPage;