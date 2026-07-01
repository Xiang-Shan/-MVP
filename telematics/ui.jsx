/* ============================================================================
   律商风险平台 — 共享 UI 组件 (theme-aware via CSS vars)
   Exposes to window: Gauge, RiskBadge, BandDot, Sparkline, Donut, Histogram,
   IndicatorBars, ContribBars, KPI, Card, ScoreText, fmt
   ============================================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.DATA;

const fmt = (n) => n.toLocaleString("en-US");

/* ---- animated count-up（保留前后缀与千分位）· 入场/切屏时数字滚动 ---- */
function CountUp({ value, dur = 950 }){
  const str = String(value);
  const m = str.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  const target = m ? parseFloat(m[2].replace(/,/g,"")) : NaN;
  const [v, setV] = useState(0);
  useEffect(() => {
    if(!m || isNaN(target)) return;
    let raf; const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t-t0)/dur); setV(target*(1-Math.pow(1-p,3))); if(p<1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  if(!m || isNaN(target)) return value;
  const dec = (m[2].split(".")[1]||"").length;
  let disp = dec ? v.toFixed(dec) : Math.round(v).toString();
  if(m[2].includes(",")) disp = Number(disp).toLocaleString("en-US");
  return m[1] + disp + m[3];
}

/* ---- half-circle gauge (ported from the original, refined) ---- */
function Gauge({ score, size = 240 }){
  const w = size, h = size * 0.62;
  const cx = w/2, cy = h*0.94, r = w*0.42;
  const ns = "http://www.w3.org/2000/svg";
  const startA = 180, endA = 0;
  const polar = (ang, rad) => { const a = ang*Math.PI/180; return { x: cx + rad*Math.cos(a), y: cy - rad*Math.sin(a) }; };
  const arcPath = (a0, a1, rad) => {
    const p0 = polar(a0, rad), p1 = polar(a1, rad);
    const large = Math.abs(a1-a0) > 180 ? 1 : 0, sweep = a1 < a0 ? 1 : 0;
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${rad} ${rad} 0 ${large} ${sweep} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  };
  const segs = [
    { from:0.00, to:0.35, col:"var(--band-low)" },
    { from:0.35, to:0.55, col:"var(--band-mid)" },
    { from:0.55, to:0.75, col:"var(--band-high)" },
    { from:0.75, to:1.00, col:"var(--band-crit)" }
  ];
  const frac = Math.max(0, Math.min(1, (score - D.SCORE_MIN)/(D.SCORE_MAX - D.SCORE_MIN)));
  const tip = polar(startA + (endA-startA)*frac, r-2);
  const sw = w*0.075;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:"block" }}>
      {segs.map((s,i) => (
        <path key={i} d={arcPath(startA+(endA-startA)*s.from, startA+(endA-startA)*s.to, r)}
              fill="none" stroke={s.col} strokeWidth={sw} strokeLinecap="butt" />
      ))}
      {[["200",0],["低",0.18],["高",0.82],["997",1]].map((t,i) => {
        const pt = polar(startA+(endA-startA)*t[1], r - sw - 9);
        return <text key={i} x={pt.x} y={pt.y} fontSize={w*0.055} fontWeight="700"
                     fill="var(--ink-3)" textAnchor="middle" dominantBaseline="middle">{t[0]}</text>;
      })}
      <line x1={cx} y1={cy} x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
            stroke="var(--ink)" strokeWidth={w*0.018} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={w*0.04} fill="var(--ink)" />
    </svg>
  );
}

/* ---- risk band pill ---- */
function RiskBadge({ band, size = "md" }){
  const pad = size === "sm" ? "3px 9px" : size === "lg" ? "7px 18px" : "4px 13px";
  const fs  = size === "sm" ? 12 : size === "lg" ? 16 : 13;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:pad,
      borderRadius:999, background:band.hex, color:"#fff", fontWeight:800, fontSize:fs,
      letterSpacing:".02em", whiteSpace:"nowrap", lineHeight:1.1 }}>{band.label}</span>
  );
}
function BandDot({ band, size = 9 }){
  return <span style={{ width:size, height:size, borderRadius:"50%", background:band.hex,
    display:"inline-block", flex:"0 0 auto" }} />;
}

/* ---- sparkline ---- */
function Sparkline({ data, w = 120, h = 34, color = "var(--accent)", fill = true }){
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v,i) => [ (i/(data.length-1))*w, h - ((v-min)/rng)*(h-6) - 3 ]);
  const line = pts.map((p,i) => (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const gid = useMemo(() => "sg"+Math.random().toString(36).slice(2,8), []);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:"block", overflow:"visible" }}>
      {fill && <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.22" />
        <stop offset="1" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>}
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.6" fill={color} />
    </svg>
  );
}

/* ---- donut (band distribution) · 支持受控 hover ---- */
function Donut({ counts, size = 168, thickness = 26, hover, onHover }){
  const [hkU, setHkU] = useState(null);
  const hk = hover !== undefined ? hover : hkU;
  const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
  const order = ["crit","high","mid","low"];
  const r = (size-thickness)/2, cx = size/2, cy = size/2, C = 2*Math.PI*r;
  let acc = 0;
  const set = (k) => { setHkU(k); onHover && onHover(k); };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:"visible" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
      {order.map(k => {
        const band = D.BANDS.find(b=>b.key===k);
        const frac = counts[k]/total;
        const dash = `${(frac*C).toFixed(2)} ${C.toFixed(2)}`;
        const off = -acc*C;
        acc += frac;
        const active = hk === k;
        return <circle key={k} cx={cx} cy={cy} r={r} fill="none" stroke={band.hex}
          strokeWidth={active ? thickness + 7 : thickness} strokeDasharray={dash} strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"
          opacity={hk && !active ? 0.32 : 1}
          style={{ transition:"opacity .16s, stroke-width .16s", cursor:"pointer" }}
          onMouseEnter={() => set(k)} onMouseLeave={() => set(null)} />;
      })}
    </svg>
  );
}

/* ---- histogram · hover 显示区间明细 ---- */
function Histogram({ buckets, h = 130 }){
  const [hi, setHi] = useState(null);
  const max = Math.max(...buckets.map(b=>b.n)) || 1;
  const total = buckets.reduce((s,b)=>s+b.n,0) || 1;
  const tipLeft = hi == null ? 0 : Math.max(9, Math.min(91, (hi + 0.5) / buckets.length * 100));
  return (
    <div style={{ position:"relative" }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:h }}>
        {buckets.map((b,i) => {
          const band = D.bandOf((b.lo+b.hi)/2);
          const active = hi === i;
          return (
            <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5, height:"100%", justifyContent:"flex-end", cursor:"pointer" }}>
              <div style={{ fontSize:11, fontWeight: active?800:700, color: active?"var(--ink)":"var(--ink-2)", fontVariantNumeric:"tabular-nums" }}>{b.n}</div>
              <div style={{ width:"100%", height:`${(b.n/max)*100}%`, minHeight:3,
                background:band.hex, borderRadius:"4px 4px 0 0",
                opacity: hi == null ? .88 : (active ? 1 : .3),
                transform: active ? "scaleY(1.02)" : "none", transformOrigin:"bottom",
                transition:"opacity .15s" }} />
            </div>
          );
        })}
      </div>
      {hi != null && (
        <div style={{ position:"absolute", left:tipLeft+"%", top:-10, transform:"translate(-50%,-100%)",
          background:"var(--ink)", color:"var(--bg)", borderRadius:8, padding:"7px 11px", whiteSpace:"nowrap",
          fontSize:12, fontWeight:700, boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:5 }}>
          {buckets[hi].lo}–{buckets[hi].hi} 分 · {buckets[hi].n} 辆 · {Math.round(buckets[hi].n/total*100)}%
        </div>
      )}
    </div>
  );
}

/* ---- four-indicator mini bars (table cell) ---- */
function IndicatorBars({ vals, w = 92 }){
  return (
    <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:22, width:w }}>
      {D.FACTORS.map(f => {
        const frac = Math.max(0.06, Math.min(1, (vals[f.key]-f.lo)/(f.hi-f.lo)));
        const hot = frac > 0.6;
        return <div key={f.key} title={`${f.short} ${vals[f.key]}${f.unit}`} style={{ flex:1, display:"flex", alignItems:"flex-end", height:"100%" }}>
          <div style={{ width:"100%", height:`${frac*100}%`, borderRadius:2,
            background: hot ? "var(--accent)" : "var(--ink-3)", opacity: hot?.9:.5 }} />
        </div>;
      })}
    </div>
  );
}

/* ---- contribution bars (explainability, diverging) ---- */
function ContribBars({ contribs }){
  const maxAbs = 130;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      {D.FACTORS.map(f => {
        const c = contribs[f.key];
        const wpct = Math.min(Math.abs(c), maxAbs)/maxAbs * 46;
        const pos = c >= 0;
        const col = pos ? "var(--accent)" : "var(--band-low)";
        return (
          <div key={f.key} style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:108, fontSize:14, fontWeight:700, color:"var(--ink)" }}>{f.name}</div>
            <div style={{ width:52, fontSize:12, color:"var(--ink-3)", fontVariantNumeric:"tabular-nums" }}>w={f.w}</div>
            <div style={{ flex:1, height:22, background:"var(--surface-2)", borderRadius:5, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", left:"50%", top:0, width:2, height:"100%", background:"var(--border)" }} />
              <div style={{ position:"absolute", top:4, height:14, borderRadius:3, transition:"all .25s ease",
                left: pos ? "50%" : `${50-wpct}%`, width:`${wpct}%`, background:col }} />
            </div>
            <div style={{ width:58, textAlign:"right", fontSize:18, fontWeight:800, color:col, fontVariantNumeric:"tabular-nums" }}>
              {pos?"+":""}{Math.round(c)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- KPI stat card ---- */
function KPI({ label, value, unit, sub, accent, spark, sparkColor }){
  return (
    <div className="card" style={{ padding:"var(--card-pad)", display:"flex", flexDirection:"column", gap:6, minWidth:0 }}>
      <div style={{ fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
        <div style={{ fontSize:32, fontWeight:800, lineHeight:1, color: accent?"var(--accent)":"var(--ink)", fontVariantNumeric:"tabular-nums" }}><CountUp value={value} /></div>
        {unit && <div style={{ fontSize:14, color:"var(--ink-3)", fontWeight:600 }}>{unit}</div>}
      </div>
      {spark && <div style={{ marginTop:2 }}><Sparkline data={spark} w={150} h={30} color={sparkColor||"var(--accent)"} /></div>}
      {sub && <div style={{ fontSize:12, color:"var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

/* ---- generic card + heading ---- */
function Card({ title, sub, right, children, pad = true, style }){
  return (
    <div className="card" style={{ display:"flex", flexDirection:"column", ...style }}>
      {(title || right) && (
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12,
          padding:"var(--card-pad)", paddingBottom: sub?10:14, borderBottom: children?"1px solid var(--border)":"none" }}>
          <div>
            {title && <div style={{ fontSize:16, fontWeight:800, color:"var(--ink)", letterSpacing:".01em", whiteSpace:"nowrap" }}>{title}</div>}
            {sub && <div style={{ fontSize:12.5, color:"var(--ink-3)", marginTop:3, whiteSpace:"nowrap" }}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: pad ? "var(--card-pad)" : 0, flex:1, minHeight:0 }}>{children}</div>
    </div>
  );
}

/* ---- big score number with band color ---- */
function ScoreText({ score, size = 88 }){
  const band = D.bandOf(score);
  return <span style={{ fontSize:size, fontWeight:800, lineHeight:.9, color:band.hex, fontVariantNumeric:"tabular-nums" }}>{score}</span>;
}

/* ---- labeled line chart (time series, band-aware) · hover 查看单点 ---- */
function LineChart({ data, labels, w = 520, h = 180, bands = false, color = "var(--accent)", yMin, yMax, unit = "", baseline }){
  const [hi, setHi] = useState(null);
  const padL = 34, padB = 22, padT = 10, padR = 8;
  const iw = w - padL - padR, ih = h - padT - padB;
  const lo = yMin != null ? yMin : Math.min(...data);
  const vHi = yMax != null ? yMax : Math.max(...data);
  const rng = (vHi - lo) || 1;
  const X = i => padL + (i/(data.length-1))*iw;
  const Y = v => padT + ih - ((v-lo)/rng)*ih;
  const pts = data.map((v,i) => [X(i), Y(v)]);
  const line = pts.map((p,i) => (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area = line + ` L ${pts[pts.length-1][0]} ${padT+ih} L ${pts[0][0]} ${padT+ih} Z`;
  const gid = useMemo(() => "lc"+Math.random().toString(36).slice(2,8), []);
  const last = data[data.length-1];
  const lastCol = bands ? D.bandOf(last).hex : color;
  const ticks = 3;
  const colW = iw / (data.length - 1);
  const tipLeft = hi == null ? 0 : Math.max(10, Math.min(90, X(hi) / w * 100));
  return (
    <div style={{ position:"relative" }}>
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:"block", overflow:"visible" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={lastCol} stopOpacity="0.20" />
        <stop offset="1" stopColor={lastCol} stopOpacity="0" />
      </linearGradient></defs>
      {/* y grid + labels */}
      {Array.from({length:ticks}).map((_,i) => {
        const val = lo + (rng)*(i/(ticks-1));
        const y = Y(val);
        return <g key={i}>
          <line x1={padL} y1={y} x2={w-padR} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 3" />
          <text x={padL-6} y={y+3} fontSize="10.5" fill="var(--ink-3)" textAnchor="end">{Math.round(val)}</text>
        </g>;
      })}
      {baseline != null && (
        <g>
          <line x1={padL} y1={Y(baseline)} x2={w-padR} y2={Y(baseline)} stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="5 3" opacity="0.7" />
          <text x={w-padR} y={Y(baseline)-4} fontSize="10" fill="var(--ink-3)" textAnchor="end">均值 {baseline}</text>
        </g>
      )}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={lastCol} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {hi != null && <line x1={X(hi)} y1={padT} x2={X(hi)} y2={padT+ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
      {pts.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r={hi===i?4.4:(i===pts.length-1?3.4:2)} fill={(hi===i||i===pts.length-1)?lastCol:"var(--surface)"} stroke={lastCol} strokeWidth="1.6" style={{ transition:"r .12s" }} />)}
      {/* x labels */}
      {labels && labels.map((l,i) => (i%2===0 || i===labels.length-1) ? <text key={i} x={X(i)} y={h-6} fontSize="10.5" fill={hi===i?"var(--ink)":"var(--ink-3)"} fontWeight={hi===i?800:400} textAnchor="middle">{l}</text> : null)}
      {/* hover hit zones */}
      {data.map((v,i) => <rect key={"hz"+i} x={X(i)-colW/2} y={0} width={colW} height={h} fill="transparent"
        onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor:"crosshair" }} />)}
    </svg>
    {hi != null && (
      <div style={{ position:"absolute", left:tipLeft+"%", top:-4, transform:"translate(-50%,-100%)",
        background:"var(--ink)", color:"var(--bg)", borderRadius:8, padding:"7px 11px", whiteSpace:"nowrap",
        fontSize:12, fontWeight:700, boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:5 }}>
        {labels ? labels[hi] + " · " : ""}{fmt(data[hi])}{unit}
      </div>
    )}
    </div>
  );
}

Object.assign(window, { Gauge, RiskBadge, BandDot, Sparkline, LineChart, Donut, Histogram, IndicatorBars, ContribBars, KPI, Card, ScoreText, fmt, CountUp });
