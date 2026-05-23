// SVG pattern overlays for LP disc surface.
// Each component renders an SVG that fills its container (100% x 100%).
// They are composited above the gradient layer via mix-blend-mode overlay.

interface PatternProps {
  opacity?: number;
  color?: string;
}

export type PatternId = 'wave' | 'supernova' | 'mandala' | 'radial' | 'aurora' | 'none';

export const PATTERN_THEMES: { id: PatternId; label: string }[] = [
  { id: 'none',      label: 'Classic' },
  { id: 'radial',    label: 'Radial' },
  { id: 'wave',      label: 'Wave' },
  { id: 'supernova', label: 'Supernova' },
  { id: 'mandala',   label: 'Mandala' },
  { id: 'aurora',    label: 'Aurora' },
];

/* ── Classic (groove rings only, no extra pattern) ── */
export function PatternNone() {
  return null;
}

/* ── Radial — spoke lines radiating from center ── */
export function PatternRadial({ opacity = 0.55, color = 'white' }: PatternProps) {
  const spokes = 36;
  const lines = Array.from({ length: spokes }, (_, i) => {
    const angle = (i / spokes) * 360;
    return (
      <line
        key={i}
        x1="50" y1="50"
        x2="50" y2="3"
        stroke={color}
        strokeWidth="0.4"
        strokeLinecap="round"
        transform={`rotate(${angle} 50 50)`}
      />
    );
  });

  const rings = [10, 18, 27, 36, 44].map(r => (
    <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="0.25" />
  ));

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ opacity }}>
      {rings}
      {lines}
    </svg>
  );
}

/* ── Wave — concentric sine-wave rings ── */
export function PatternWave({ opacity = 0.5, color = 'white' }: PatternProps) {
  function sineRing(radius: number, amp: number, freq: number, phase: number) {
    const pts = 240;
    const points = Array.from({ length: pts + 1 }, (_, i) => {
      const t = (i / pts) * Math.PI * 2;
      const r = radius + Math.sin(t * freq + phase) * amp;
      const x = 50 + r * Math.cos(t);
      const y = 50 + r * Math.sin(t);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return points.join(' ') + 'Z';
  }

  const rings = [
    { r: 8,  amp: 1.2, freq: 6,  phase: 0 },
    { r: 14, amp: 1.5, freq: 8,  phase: 0.4 },
    { r: 20, amp: 1.8, freq: 9,  phase: 0.9 },
    { r: 26, amp: 1.5, freq: 10, phase: 1.4 },
    { r: 32, amp: 1.2, freq: 11, phase: 2.0 },
    { r: 38, amp: 1.0, freq: 12, phase: 0.2 },
    { r: 43, amp: 0.8, freq: 14, phase: 1.1 },
  ];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ opacity }}>
      {rings.map((r, i) => (
        <path key={i} d={sineRing(r.r, r.amp, r.freq, r.phase)}
          fill="none" stroke={color} strokeWidth="0.45" />
      ))}
    </svg>
  );
}

/* ── Supernova — burst / starburst shards ── */
export function PatternSupernova({ opacity = 0.52, color = 'white' }: PatternProps) {
  const shards = 24;
  const paths = Array.from({ length: shards }, (_, i) => {
    const angle = (i / shards) * Math.PI * 2;
    const spread = 0.06;
    const inner = 6 + (i % 3) * 2;
    const outer = 35 + Math.sin(i * 1.7) * 12;
    const x0 = 50 + inner * Math.cos(angle - spread);
    const y0 = 50 + inner * Math.sin(angle - spread);
    const x1 = 50 + outer * Math.cos(angle);
    const y1 = 50 + outer * Math.sin(angle);
    const x2 = 50 + inner * Math.cos(angle + spread);
    const y2 = 50 + inner * Math.sin(angle + spread);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  });

  const midShards = Array.from({ length: shards }, (_, i) => {
    const angle = ((i + 0.5) / shards) * Math.PI * 2;
    const inner = 5;
    const outer = 18 + Math.cos(i * 2.3) * 5;
    const x0 = 50 + inner * Math.cos(angle - 0.04);
    const y0 = 50 + inner * Math.sin(angle - 0.04);
    const x1 = 50 + outer * Math.cos(angle);
    const y1 = 50 + outer * Math.sin(angle);
    const x2 = 50 + inner * Math.cos(angle + 0.04);
    const y2 = 50 + inner * Math.sin(angle + 0.04);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  });

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ opacity }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill={color} fillOpacity="0.12" stroke={color} strokeWidth="0.3" />
      ))}
      {midShards.map((d, i) => (
        <path key={`m${i}`} d={d} fill={color} fillOpacity="0.06" stroke={color} strokeWidth="0.2" />
      ))}
    </svg>
  );
}

/* ── Mandala — layered geometric petal ring ── */
export function PatternMandala({ opacity = 0.5, color = 'white' }: PatternProps) {
  function petalRing(count: number, r: number, size: number, rotOffset = 0) {
    return Array.from({ length: count }, (_, i) => {
      const angle = ((i / count) * 360 + rotOffset) * (Math.PI / 180);
      const cx = 50 + r * Math.cos(angle);
      const cy = 50 + r * Math.sin(angle);
      const rot = ((i / count) * 360 + rotOffset + 90);
      return (
        <ellipse key={i} cx={cx.toFixed(2)} cy={cy.toFixed(2)}
          rx={size} ry={size * 0.38}
          fill={color} fillOpacity="0.07"
          stroke={color} strokeWidth="0.3"
          transform={`rotate(${rot} ${cx.toFixed(2)} ${cy.toFixed(2)})`} />
      );
    });
  }

  const hexRing = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return `${(50 + 20 * Math.cos(a)).toFixed(2)},${(50 + 20 * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

  const hexRing2 = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return `${(50 + 32 * Math.cos(a)).toFixed(2)},${(50 + 32 * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ opacity }}>
      <polygon points={hexRing} fill="none" stroke={color} strokeWidth="0.4" />
      <polygon points={hexRing2} fill="none" stroke={color} strokeWidth="0.35" />
      {[8, 16, 24, 32, 40].map(r => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="0.2" />
      ))}
      {petalRing(12, 12, 3.5, 0)}
      {petalRing(12, 22, 4.5, 15)}
      {petalRing(16, 34, 5, 0)}
      {petalRing(8, 42, 3.5, 22)}
    </svg>
  );
}

/* ── Aurora — flowing diagonal arcs ── */
export function PatternAurora({ opacity = 0.48, color = 'white' }: PatternProps) {
  function arc(startAngle: number, sweep: number, r: number) {
    const s = startAngle * (Math.PI / 180);
    const e = (startAngle + sweep) * (Math.PI / 180);
    const x1 = (50 + r * Math.cos(s)).toFixed(2);
    const y1 = (50 + r * Math.sin(s)).toFixed(2);
    const x2 = (50 + r * Math.cos(e)).toFixed(2);
    const y2 = (50 + r * Math.sin(e)).toFixed(2);
    const large = sweep > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  const arcs = [
    { a: -30, sw: 80, r: 10 },
    { a: -20, sw: 90, r: 16 },
    { a: 0,   sw: 100, r: 22 },
    { a: 10,  sw: 95, r: 28 },
    { a: 150, sw: 80, r: 14 },
    { a: 160, sw: 90, r: 20 },
    { a: 170, sw: 100, r: 26 },
    { a: 180, sw: 95, r: 33 },
    { a: -10, sw: 70, r: 38 },
    { a: 5,   sw: 75, r: 43 },
  ];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ opacity }}>
      {arcs.map((a, i) => (
        <path key={i} d={arc(a.a, a.sw, a.r)}
          fill="none" stroke={color} strokeWidth="0.55" strokeLinecap="round" />
      ))}
      {[7, 18, 30, 41].map(r => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="0.2" strokeDasharray="1.2 2.4" />
      ))}
    </svg>
  );
}

export function DiskPattern({ id, color }: { id: PatternId; color: string }) {
  const props = { color, opacity: 0.52 };
  switch (id) {
    case 'wave':      return <PatternWave {...props} />;
    case 'supernova': return <PatternSupernova {...props} />;
    case 'mandala':   return <PatternMandala {...props} />;
    case 'radial':    return <PatternRadial {...props} />;
    case 'aurora':    return <PatternAurora {...props} />;
    default:          return null;
  }
}
