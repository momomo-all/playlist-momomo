import {
  useState, useEffect, useRef, useCallback, useLayoutEffect,
} from 'react';
import {
  ChevronLeft, Upload, AlignCenter, AlignLeft, AlignRight,
  RotateCw, Maximize2,
} from 'lucide-react';
import {
  getVinylData, saveVinylData, VinylData, ElementTransform,
  DEFAULT_TRANSFORM, DEFAULT_LABEL,
  saveCover, resolveCoverUrl,
} from '../lib/localDb';
import { DiskPattern, PATTERN_THEMES, PatternId } from '../components/VinylPatterns';
import { Pairing, Track } from '../lib/types';

/* ─────────────────────────────── helpers ──────────────────────────────── */

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

function transformStyle(t: ElementTransform, extra = ''): React.CSSProperties {
  return {
    transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale}) rotate(${t.rotate}deg) ${extra}`,
  };
}

const FONT_OPTIONS = [
  { label: 'Sans', value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: '"Courier New", monospace' },
  { label: 'Round', value: '"Trebuchet MS", sans-serif' },
];

/* ─────────────────────────────── drag hook ─────────────────────────────── */

function useDrag(
  enabled: boolean,
  onMove: (dx: number, dy: number) => void,
) {
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };

    const onMouseMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      onMove(me.clientX - last.current.x, me.clientY - last.current.y);
      last.current = { x: me.clientX, y: me.clientY };
    };
    const onMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [enabled, onMove]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    dragging.current = true;
    last.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    const onTouchMove = (te: TouchEvent) => {
      if (!dragging.current) return;
      onMove(te.touches[0].clientX - last.current.x, te.touches[0].clientY - last.current.y);
      last.current = { x: te.touches[0].clientX, y: te.touches[0].clientY };
    };
    const onTouchEnd = () => {
      dragging.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  }, [enabled, onMove]);

  return { onMouseDown, onTouchStart };
}

/* ──────────────────────────────── main ────────────────────────────────── */

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
      diskTransform: d.diskTransform ?? { ...DEFAULT_TRANSFORM },
      labelStyle: d.labelStyle ?? { ...DEFAULT_LABEL },
    };
  });

  const [jacketUrl, setJacketUrl] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logDraft, setLogDraft] = useState('');

  const jacketInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneSize, setSceneSize] = useState({ w: 800, h: 600 });

  // track scene size for % ↔ px conversion
  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSceneSize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    update({ jacketTransform: { ...vd.jacketTransform, ...t } });
  }, [update, vd.jacketTransform]);

  const updateDisk = useCallback((t: Partial<ElementTransform>) => {
    update({ diskTransform: { ...vd.diskTransform, ...t } });
  }, [update, vd.diskTransform]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const coverId = `vinyl_jacket_${pairing.id}`;
    await saveCover(coverId, file);
    update({ jacketCoverId: coverId });
    e.target.value = '';
  };

  // drag handlers for jacket and disk
  const jacketDrag = useDrag(showCustom, useCallback((dx, dy) => {
    updateJacket({ x: vd.jacketTransform.x + dx, y: vd.jacketTransform.y + dy });
  }, [updateJacket, vd.jacketTransform.x, vd.jacketTransform.y]));

  const diskDrag = useDrag(showCustom, useCallback((dx, dy) => {
    updateDisk({ x: vd.diskTransform.x + dx, y: vd.diskTransform.y + dy });
  }, [updateDisk, vd.diskTransform.x, vd.diskTransform.y]));

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const bgImg = jacketUrl || resolvedCover;
  const displayTitle = track ? track.title : (vd.title || pairing.name);
  const diskGradient = buildGradient(vd.gradientColors, vd.patternTheme);
  const ls = vd.labelStyle;

  // jacket default size: 38% of scene width
  const jacketDefaultPx = sceneSize.w * 0.38;
  // disk default size: 52% of scene width
  const diskDefaultPx = sceneSize.w * 0.52;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0a]">

      {/* ── Blurred background ── */}
      <div className="absolute inset-0">
        {bgImg && (
          <img src={bgImg} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(90px)', transform: 'scale(1.25)', opacity: 0.88 }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(4,4,6,0.62)' }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 15%, rgba(0,0,0,0.60) 100%)',
        }} />
      </div>

      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-15 animate-blob1"
          style={{ background: pairing.theme_color, top: '-20%', left: '-15%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-10 animate-blob2"
          style={{ background: pairing.theme_color, bottom: '-15%', right: '-10%' }} />
      </div>

      {/* ── Top nav ── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-7 pt-6">
        <button onClick={onBack}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/12 hover:border-white/25 text-white backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95">
          <ChevronLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          <span className="text-sm font-semibold">가사로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowLog(v => !v); setShowCustom(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showLog
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }
            }>
            <span className="text-white/70" style={{ fontSize: 13 }}>✏</span>
            로그 {showLog ? '닫기' : '열기'}
          </button>

          <button
            onClick={() => { setShowCustom(v => !v); setShowLog(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showCustom
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }
            }>
            <span style={{ fontSize: 14 }}>🎨</span>
            LP 커스텀
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-20 h-full" style={{ paddingTop: 68, paddingBottom: 12 }}>

        {/* ════ SCENE (free-layout canvas — always fills full screen) ════ */}
        <div
          ref={sceneRef}
          className="relative w-full h-full overflow-hidden"
        >
          {/* ── JACKET layer ── */}
          <div
            className={`absolute ${showCustom ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{
              width: jacketDefaultPx * vd.jacketTransform.scale,
              height: jacketDefaultPx * vd.jacketTransform.scale,
              left: '18%',
              top: '50%',
              marginTop: -(jacketDefaultPx * vd.jacketTransform.scale) / 2,
              zIndex: 4,
              ...transformStyle(vd.jacketTransform, ''),
              transition: showCustom ? 'none' : 'all 0.5s ease',
            }}
            {...jacketDrag}
          >
            <div className="w-full h-full rounded-2xl overflow-hidden relative select-none"
              style={{
                boxShadow: `0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08), 0 0 50px rgba(${rgb},0.18)`,
              }}>
              {jacketUrl
                ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${pairing.theme_color}, #111)` }} />
              }
              <div className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)' }} />
            </div>

            {/* edit handles */}
            {showCustom && (
              <>
                {/* upload overlay */}
                <button
                  onClick={() => jacketInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-black/55 backdrop-blur-sm text-white opacity-0 hover:opacity-100 transition-opacity z-10"
                  onMouseDown={e => e.stopPropagation()}>
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-semibold">자켓 사진 변경</span>
                </button>
                {/* corner resize handle (bottom-right) */}
                <div
                  className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-white border-2 border-white/80 shadow-lg z-20 cursor-se-resize"
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const startX = e.clientX;
                    const startScale = vd.jacketTransform.scale;
                    const onMove = (me: MouseEvent) => {
                      const delta = (me.clientX - startX) / jacketDefaultPx;
                      updateJacket({ scale: Math.max(0.3, Math.min(3, startScale + delta)) });
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
                {/* dashed border */}
                <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-white/40 pointer-events-none" />
              </>
            )}
          </div>

          {/* ── DISK layer ── */}
          <div
            className={`absolute ${showCustom ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{
              width: diskDefaultPx * vd.diskTransform.scale,
              height: diskDefaultPx * vd.diskTransform.scale,
              right: '8%',
              top: '50%',
              marginTop: -(diskDefaultPx * vd.diskTransform.scale) / 2,
              zIndex: 3,
              ...transformStyle(vd.diskTransform, ''),
              transition: showCustom ? 'none' : 'all 0.5s ease',
            }}
            {...diskDrag}
          >
            {/* spinning disc */}
            <div className="w-full h-full rounded-full relative overflow-hidden select-none"
              style={{
                animation: 'vinyl-spin 4s linear infinite',
                boxShadow: `0 30px 100px rgba(0,0,0,0.9), 0 0 0 2px rgba(255,255,255,0.07), 0 0 50px rgba(${rgb},0.2)`,
              }}>

              {/* gradient */}
              <div className="absolute inset-0 rounded-full" style={{ background: diskGradient }} />

              {/* shimmer */}
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 45%, rgba(255,255,255,0.03) 65%, transparent 100%)',
                mixBlendMode: 'screen',
              }} />

              {/* SVG pattern */}
              <DiskPattern id={vd.patternTheme as PatternId} color="rgba(255,255,255,0.9)" />

              {/* edge vignette */}
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                background: 'radial-gradient(circle at 50% 50%, transparent 58%, rgba(0,0,0,0.50) 100%)',
              }} />

              {/* ── Center label ── */}
              <div className="absolute rounded-full overflow-hidden"
                style={{
                  width: '30%', height: '30%',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  background: 'radial-gradient(circle, #1e1e1e, #0a0a0a)',
                  boxShadow: '0 0 0 2.5px rgba(255,255,255,0.22)',
                  zIndex: 2,
                }}>
                <div className="w-full h-full flex items-center justify-center px-2 py-2">
                  <p className="w-full leading-tight break-words"
                    style={{
                      fontSize: ls.fontSize,
                      color: ls.color,
                      fontFamily: ls.fontFamily,
                      fontWeight: 700,
                      textAlign: ls.textAlign as 'center' | 'left' | 'right',
                      wordBreak: 'break-word',
                    }}>
                    {ls.text || displayTitle}
                  </p>
                </div>
                {/* spindle */}
                <div className="absolute w-[14%] h-[14%] rounded-full bg-zinc-200/70"
                  style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 3 }} />
              </div>
            </div>

            {/* edit handles for disk */}
            {showCustom && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/30 pointer-events-none" />
                {/* resize handle */}
                <div
                  className="absolute bottom-[6%] right-[6%] w-5 h-5 rounded-full bg-white border-2 border-white/80 shadow-lg z-20 cursor-se-resize"
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const startX = e.clientX;
                    const startScale = vd.diskTransform.scale;
                    const onMove = (me: MouseEvent) => {
                      const delta = (me.clientX - startX) / diskDefaultPx;
                      updateDisk({ scale: Math.max(0.3, Math.min(2.5, startScale + delta)) });
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
              </>
            )}
          </div>

          {/* title overlay — shown when no panel open */}
          {!showCustom && !showLog && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <p className="text-white/20 text-xs uppercase tracking-[0.25em]">Now Playing</p>
              <h1 className="text-white font-bold mt-1 leading-tight"
                style={{ fontSize: 'clamp(16px, 2vw, 28px)' }}>
                {displayTitle}
              </h1>
            </div>
          )}

          {/* ════ RIGHT OVERLAY PANEL — sits over the scene on the right ════ */}
          {(showCustom || showLog) && (
            <div
              className="absolute top-0 right-0 bottom-0 flex flex-col overflow-hidden"
              style={{
                width: 'clamp(300px, 34%, 420px)',
                background: 'rgba(6,6,8,0.72)',
                backdropFilter: 'blur(28px)',
                borderLeft: '1px solid rgba(255,255,255,0.07)',
                zIndex: 30,
                padding: '20px 20px 16px 20px',
              }}
            >
              {/* panel title */}
              <div className="flex-shrink-0 mb-4">
                <p className="text-white/25 text-[10px] uppercase tracking-[0.2em] mb-0.5">Now Playing</p>
                <h1 className="text-white font-bold leading-tight text-base">{displayTitle}</h1>
              </div>

              {/* ── CUSTOM PANEL ── */}
              {showCustom && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1"
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
                  <textarea
                    value={logDraft}
                    onChange={e => setLogDraft(e.target.value)}
                    onBlur={() => update({ note: logDraft })}
                    placeholder={'가사나 대화 로그를 자유롭게 기록해보세요...\n\n저장은 자동으로 됩니다.'}
                    className="flex-1 min-h-0 w-full rounded-2xl px-5 py-4 text-white/80 text-sm leading-[1.95] resize-none focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                      caretColor: pairing.theme_color,
                    }}
                  />
                  <button
                    onClick={() => update({ note: logDraft })}
                    className="flex-shrink-0 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95"
                    style={{ background: `rgba(${rgb},0.45)`, border: `1px solid rgba(${rgb},0.7)` }}>
                    저장
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* hidden file input */}
      <input ref={jacketInputRef} type="file" accept="image/*" className="hidden"
        onChange={handleImageUpload} />
    </div>
  );
}

/* ─────────────────────────── CustomPanel ───────────────────────────── */

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

  const setLabel = (partial: Partial<typeof vd.labelStyle>) => {
    update({ labelStyle: { ...vd.labelStyle, ...partial } });
  };

  return (
    <>
      {/* ── Pattern themes ── */}
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

      {/* ── Gradient colors ── */}
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
                  <span className="text-sm">×</span>
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

      {/* ── Label text editor ── */}
      <div>
        <SectionTitle>라벨 텍스트 편집</SectionTitle>
        <textarea
          value={vd.labelStyle.text}
          onChange={e => setLabel({ text: e.target.value })}
          rows={2}
          placeholder="중앙 라벨 텍스트 (비우면 곡 제목 표시)"
          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-white/22 placeholder-white/18 mb-3"
        />
        {/* Font family */}
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
        {/* Font size, align, color row */}
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-xs flex-shrink-0">크기</span>
          <input type="range" min={8} max={18} value={vd.labelStyle.fontSize}
            onChange={e => setLabel({ fontSize: Number(e.target.value) })}
            className="flex-1 accent-white/50" />
          <span className="text-white/40 text-xs w-5 flex-shrink-0">{vd.labelStyle.fontSize}</span>
          {/* text align */}
          {(['left', 'center', 'right'] as const).map(align => {
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
            return (
              <button key={align} onClick={() => setLabel({ textAlign: align })}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                style={vd.labelStyle.textAlign === align
                  ? { background: `rgba(${rgb},0.4)`, border: `1px solid rgba(${rgb},0.6)` }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                }>
                <Icon className="w-3.5 h-3.5 text-white/60" />
              </button>
            );
          })}
          {/* text color */}
          <div className="relative w-7 h-7 rounded-lg border border-white/15 overflow-hidden flex-shrink-0" style={{ background: vd.labelStyle.color }}>
            <input type="color" value={vd.labelStyle.color}
              onChange={e => setLabel({ color: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
      </div>

      {/* ── Jacket transform controls ── */}
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

      {/* ── Disk transform controls ── */}
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

/* ── slider row helper ── */
interface SliderRowProps {
  icon: React.ReactNode;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  decimals?: number;
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