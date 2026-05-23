import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Upload, ChevronDown, ChevronUp, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import {
  getVinylData, saveVinylData, VinylData,
  saveCover, resolveCoverUrl,
} from '../lib/localDb';
import { DiskPattern, PATTERN_THEMES, PatternId } from '../components/VinylPatterns';
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

function buildGradient(colors: string[], pattern: PatternId): string {
  if (colors.length < 2) return colors[0] || '#1a1a2e';
  const c = colors;
  if (pattern === 'supernova') {
    return `conic-gradient(from 0deg at 50% 50%, ${c[0]}, ${c[1]}, ${c[2] || c[0]}, ${c[0]})`;
  }
  if (pattern === 'aurora') {
    return `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 50%, ${c[2] || c[0]} 100%)`;
  }
  return `radial-gradient(circle at 50% 50%, ${c[0]} 0%, ${c[1]} 55%, ${c[2] || '#000'} 100%)`;
}

export default function VinylPage({ pairing, track, resolvedCover, onBack }: Props) {
  const [vd, setVd] = useState<VinylData>(() => getVinylData(pairing.id));
  const [jacketUrl, setJacketUrl] = useState('');
  const [diskUrl, setDiskUrl] = useState('');

  // UI panels
  const [showCustom, setShowCustom] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logDraft, setLogDraft] = useState('');

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

  useEffect(() => { resolveImages(vd); }, [vd, resolveImages]);

  // sync logDraft with saved note
  useEffect(() => { setLogDraft(vd.note || ''); }, [vd.note]);

  const update = useCallback((partial: Partial<VinylData>) => {
    setVd(prev => {
      const next = { ...prev, ...partial };
      saveVinylData(pairing.id, next);
      return next;
    });
  }, [pairing.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'jacket' | 'disk') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const coverId = `vinyl_${type}_${pairing.id}`;
    await saveCover(coverId, file);
    update(type === 'jacket' ? { jacketCoverId: coverId } : { diskCoverId: coverId });
    e.target.value = '';
  };

  const saveLog = () => {
    update({ note: logDraft });
  };

  const rgb = hexToRgb(pairing.theme_color || '#1a1a2e');
  const bgImg = jacketUrl || resolvedCover;
  const displayTitle = track ? track.title : (vd.title || pairing.name);
  const diskGradient = buildGradient(vd.gradientColors, vd.patternTheme as PatternId);

  // If log panel open, shift vinyl scene left
  const sceneShift = showLog ? '-translate-x-[8%]' : 'translate-x-0';

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

      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-18 animate-blob1"
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
          {/* Log button */}
          <button
            onClick={() => { setShowLog(v => !v); setShowCustom(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showLog
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }
            }
          >
            <span className="text-white/70" style={{ fontSize: 13 }}>✏</span>
            로그 {showLog ? '닫기' : '열기'}
          </button>

          {/* Custom button */}
          <button
            onClick={() => { setShowCustom(v => !v); setShowLog(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-white text-sm font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95"
            style={showCustom
              ? { background: `rgba(${rgb},0.38)`, borderColor: `rgba(${rgb},0.65)`, boxShadow: `0 0 20px rgba(${rgb},0.3)` }
              : { background: 'rgba(0,0,0,0.38)', borderColor: 'rgba(255,255,255,0.12)' }
            }
          >
            <span style={{ fontSize: 14 }}>🎨</span>
            LP 커스텀
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-20 flex h-full" style={{ paddingTop: 68, paddingBottom: 12 }}>

        {/* ════ VINYL SCENE ════ */}
        <div className={`flex items-center justify-center transition-transform duration-500 ease-out flex-shrink-0 ${sceneShift}`}
          style={{ width: showLog ? '58%' : '65%', minWidth: 0 }}>

          <div className="relative flex items-center"
            style={{
              width: 'min(90%, 820px)',
              aspectRatio: showLog ? '1.6' : '1.5',
            }}>

            {/* ── JACKET (left, large) ── */}
            <div className="absolute"
              style={{
                width: showLog ? '40%' : '46%',
                aspectRatio: '1',
                left: showLog ? '0%' : '2%',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 4,
                transition: 'all 0.5s ease',
              }}>
              <div className="w-full h-full rounded-2xl overflow-hidden relative"
                style={{
                  boxShadow: `0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08), 0 0 50px rgba(${rgb},0.2)`,
                }}>
                {jacketUrl
                  ? <img src={jacketUrl} alt={pairing.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${pairing.theme_color}, #111)` }} />
                }
                <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-black/60 border border-white/10" />
                {/* glossy sheen */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)' }} />
              </div>
              {showCustom && (
                <button onClick={() => jacketInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/65 backdrop-blur-sm text-white transition-all hover:bg-black/75 z-10">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-semibold">자켓 사진</span>
                </button>
              )}
            </div>

            {/* ── LP DISC ── */}
            <div className="absolute"
              style={{
                width: '65%',
                aspectRatio: '1',
                right: '0%',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 3,
                transition: 'all 0.5s ease',
              }}>

              {/* Spinning disc wrapper */}
              <div className="w-full h-full rounded-full relative overflow-hidden"
                style={{
                  animation: 'vinyl-spin 4s linear infinite',
                  boxShadow: `0 30px 100px rgba(0,0,0,0.88), 0 0 0 2px rgba(255,255,255,0.07), 0 0 50px rgba(${rgb},0.18)`,
                }}>

                {/* ① Gradient layer */}
                <div className="absolute inset-0 rounded-full" style={{ background: diskGradient }} />

                {/* ② Translucent shimmer */}
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 45%, rgba(255,255,255,0.04) 65%, transparent 100%)',
                  mixBlendMode: 'screen',
                }} />

                {/* ③ Groove rings */}
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 7px, rgba(0,0,0,0.10) 7px, rgba(0,0,0,0.10) 8px)',
                }} />

                {/* ④ SVG Pattern overlay */}
                <DiskPattern id={vd.patternTheme as PatternId} color="rgba(255,255,255,0.9)" />

                {/* ⑤ Edge darkening vignette */}
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                  background: 'radial-gradient(circle at 50% 50%, transparent 60%, rgba(0,0,0,0.45) 100%)',
                }} />

                {/* ⑥ Center label */}
                <div className="absolute rounded-full overflow-hidden"
                  style={{
                    width: '28%', height: '28%',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                    background: '#0c0c0c',
                    boxShadow: '0 0 0 2.5px rgba(255,255,255,0.2)',
                    zIndex: 2,
                  }}>
                  {diskUrl
                    ? <img src={diskUrl} alt="" className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center px-1.5 py-1.5"
                        style={{ background: `radial-gradient(circle, #1a1a1a, #0a0a0a)` }}>
                        <p
                          className="leading-tight break-words w-full"
                          style={{
                            fontSize: Math.min(vd.labelFontSize, 14),
                            color: 'rgba(255,255,255,0.75)',
                            fontWeight: 700,
                            textAlign: vd.labelTextAlign as 'center' | 'left' | 'right',
                            letterSpacing: '0.01em',
                            wordBreak: 'break-word',
                          }}>
                          {vd.labelText || displayTitle}
                        </p>
                      </div>
                    )
                  }
                  {/* spindle */}
                  <div className="absolute w-[13%] h-[13%] rounded-full bg-zinc-200/70"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 3 }} />

                  {/* label upload in custom mode */}
                  {showCustom && (
                    <button onClick={() => diskInputRef.current?.click()}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-semibold transition-all hover:bg-black/75 rounded-full z-10">
                      <Upload className="w-3.5 h-3.5" />
                      라벨
                    </button>
                  )}
                </div>
              </div>

              {/* Rim highlight */}
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                background: 'linear-gradient(130deg, rgba(255,255,255,0.08) 0%, transparent 45%)',
              }} />
            </div>

            {/* ── Tonearm ── */}
            <div className="absolute pointer-events-none"
              style={{ right: '-4%', top: '2%', width: '26%', height: '46%', zIndex: 6 }}>
              <div className="absolute top-0 right-0 rounded-full border border-white/20"
                style={{ width: 36, height: 36, background: 'radial-gradient(circle at 35% 35%, #5a5a5a, #1a1a1a)', boxShadow: '0 4px 14px rgba(0,0,0,0.7)' }} />
              <div className="absolute origin-top-right"
                style={{ width: '130%', height: 4, top: 16, right: 18, transform: 'rotate(30deg)', background: 'linear-gradient(to bottom, #c0bdb8, #7a7874, #4a4845)', borderRadius: 999, boxShadow: '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)' }} />
              <div className="absolute"
                style={{ width: 15, height: 8, bottom: '12%', left: '-4%', background: 'linear-gradient(135deg, #888, #444)', borderRadius: '3px 3px 6px 6px', boxShadow: '0 2px 6px rgba(0,0,0,0.7)', transform: 'rotate(-10deg)' }} />
            </div>
          </div>
        </div>

        {/* ════ RIGHT COLUMN ════ */}
        <div className="flex flex-col flex-1 min-w-0 justify-center overflow-hidden"
          style={{ paddingRight: showCustom || showLog ? 0 : 40, transition: 'padding 0.4s' }}>

          {/* Title block — moves up when log is open */}
          <div className={`transition-all duration-500 ${showLog ? 'mb-3 mt-0' : 'mb-6'}`}>
            <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-1.5">Now Playing</p>
            <h1 className={`text-white font-bold tracking-tight leading-tight transition-all duration-500 ${showLog ? 'text-xl' : ''}`}
              style={{ fontSize: showLog ? undefined : 'clamp(18px, 2.5vw, 34px)' }}>
              {displayTitle}
            </h1>
            {pairing.character_tags.length > 0 && !showLog && (
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

          {/* ══ CUSTOM PANEL ══ */}
          {showCustom && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-4 space-y-5"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
              <CustomPanel vd={vd} update={update} rgb={rgb} />
            </div>
          )}

          {/* ══ LOG PANEL ══ */}
          {showLog && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <textarea
                value={logDraft}
                onChange={e => setLogDraft(e.target.value)}
                onBlur={saveLog}
                placeholder={'가사나 대화 로그를 자유롭게 기록해보세요...\n\n저장은 자동으로 됩니다.'}
                className="flex-1 min-h-0 w-full rounded-2xl px-5 py-4 text-white/80 text-sm leading-[1.95] resize-none focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                  caretColor: pairing.theme_color,
                }}
              />
              <button onClick={saveLog}
                className="flex-shrink-0 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95"
                style={{ background: `rgba(${rgb},0.45)`, border: `1px solid rgba(${rgb},0.7)` }}>
                저장
              </button>
            </div>
          )}

          {/* hint when nothing open */}
          {!showCustom && !showLog && (
            <p className="text-white/20 text-xs mt-2">
              상단 버튼으로 LP를 꾸미거나 로그를 기록하세요
            </p>
          )}
        </div>
      </div>

      {/* hidden inputs */}
      <input ref={jacketInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleImageUpload(e, 'jacket')} />
      <input ref={diskInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleImageUpload(e, 'disk')} />
    </div>
  );
}

/* ──────────────────────────────────────────────────
   CustomPanel — pattern + color + label editor
────────────────────────────────────────────────── */
interface CustomPanelProps {
  vd: VinylData;
  update: (p: Partial<VinylData>) => void;
  rgb: string;
}

function CustomPanel({ vd, update, rgb }: CustomPanelProps) {
  const [expandColors, setExpandColors] = useState(true);

  const setColor = (idx: number, hex: string) => {
    const next = [...vd.gradientColors];
    next[idx] = hex;
    update({ gradientColors: next });
  };

  const addColor = () => {
    if (vd.gradientColors.length < 3) update({ gradientColors: [...vd.gradientColors, '#888888'] });
  };

  const removeColor = (idx: number) => {
    if (vd.gradientColors.length <= 2) return;
    update({ gradientColors: vd.gradientColors.filter((_, i) => i !== idx) });
  };

  return (
    <>
      {/* Pattern theme selector */}
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2.5">패턴 테마</p>
        <div className="grid grid-cols-3 gap-2">
          {PATTERN_THEMES.map(t => (
            <button key={t.id} onClick={() => update({ patternTheme: t.id })}
              className="relative rounded-xl overflow-hidden transition-all hover:scale-[1.04] active:scale-95"
              style={{
                aspectRatio: '1',
                background: vd.patternTheme === t.id ? `rgba(${rgb},0.35)` : 'rgba(255,255,255,0.05)',
                border: vd.patternTheme === t.id ? `1.5px solid rgba(${rgb},0.7)` : '1.5px solid rgba(255,255,255,0.1)',
                boxShadow: vd.patternTheme === t.id ? `0 0 14px rgba(${rgb},0.35)` : 'none',
              }}>
              {/* Mini disc preview */}
              <div className="absolute inset-2 rounded-full overflow-hidden"
                style={{ background: buildGradient(vd.gradientColors, t.id as PatternId) }}>
                <DiskPattern id={t.id as PatternId} color="rgba(255,255,255,0.85)" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 pb-1 text-center">
                <span className={`text-[9px] font-bold ${vd.patternTheme === t.id ? 'text-white' : 'text-white/40'}`}>{t.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Gradient colors */}
      <div>
        <button className="flex items-center justify-between w-full mb-2.5"
          onClick={() => setExpandColors(v => !v)}>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">색상 조합</p>
          {expandColors ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </button>
        {expandColors && (
          <div className="space-y-2">
            {vd.gradientColors.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl border border-white/15 overflow-hidden" style={{ background: c }}>
                    <input type="color" value={c} onChange={e => setColor(i, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                </div>
                <input type="text" value={c}
                  onChange={e => e.target.value.match(/^#[0-9a-fA-F]{0,6}$/) && setColor(i, e.target.value)}
                  className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-white/25"
                  maxLength={7} />
                <span className="text-white/25 text-xs w-4">{i + 1}</span>
                {vd.gradientColors.length > 2 && (
                  <button onClick={() => removeColor(i)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-white/25 hover:text-red-400 transition-all text-xs">
                    ×
                  </button>
                )}
              </div>
            ))}
            {vd.gradientColors.length < 3 && (
              <button onClick={addColor}
                className="w-full py-2 rounded-xl border border-dashed border-white/15 text-white/30 text-xs hover:border-white/30 hover:text-white/50 transition-all">
                + 색상 추가
              </button>
            )}
          </div>
        )}
      </div>

      {/* Label text editor */}
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2.5">라벨 텍스트</p>
        <textarea
          value={vd.labelText}
          onChange={e => update({ labelText: e.target.value })}
          rows={2}
          placeholder="중앙 라벨에 표시될 텍스트..."
          className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-white/22 placeholder-white/18"
        />
        <div className="flex items-center gap-3 mt-2">
          <span className="text-white/30 text-xs">크기</span>
          <input type="range" min={8} max={16} value={vd.labelFontSize}
            onChange={e => update({ labelFontSize: Number(e.target.value) })}
            className="flex-1 accent-white/50" />
          <span className="text-white/40 text-xs w-6">{vd.labelFontSize}</span>

          <div className="flex gap-1 ml-2">
            {(['left', 'center', 'right'] as const).map(align => {
              const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
              return (
                <button key={align} onClick={() => update({ labelTextAlign: align })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                  style={vd.labelTextAlign === align
                    ? { background: `rgba(${rgb},0.4)`, border: `1px solid rgba(${rgb},0.6)` }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                  }>
                  <Icon className="w-3.5 h-3.5 text-white/60" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

