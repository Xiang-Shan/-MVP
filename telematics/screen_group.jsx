/* ============================================================================
   一汽集团视角 — 集团风险总览 / 保险市场份额 / 品牌与车型结构
   v2 · 集团风险总览重构：全域感知指挥条 + 可下钻地图 + 风险联动透视
        克制入场动画（数字滚动 / 柱状升起 / 环形扫入 / 折线生长）
   ============================================================================ */
const DG = window.DATA;
const CNM_G = window.CN_MAP;

const INS_COLOR = { picc: "#4F6B8F", pingan: "#E8862E", cpic: "#2E9CCB", xinan: "#ED1C24", cl: "#2BA37A", other: "#9AA6B2" };
const fmtW = (n) => (n / 10000).toFixed(n >= 100000 ? 0 : 1) + " 万";

/* ───────────────── 工具：入场挂载 / 数字滚动 / 种子随机 ───────────────── */
function GUseMounted() {
  const { useState, useEffect } = React;
  const [m, setM] = useState(false);
  useEffect(() => {const a = requestAnimationFrame(() => requestAnimationFrame(() => setM(true)));return () => cancelAnimationFrame(a);}, []);
  return m;
}
function GCountUp({ value, dur = 1000, format }) {
  const { useState, useEffect, useRef } = React;
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    let raf;const t0 = performance.now();const a = from.current,b = value;
    const tick = (t) => {const p = Math.min(1, (t - t0) / dur);const e = 1 - Math.pow(1 - p, 3);setV(a + (b - a) * e);if (p < 1) raf = requestAnimationFrame(tick);else from.current = b;};
    raf = requestAnimationFrame(tick);return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return <span>{format ? format(v) : Math.round(v).toLocaleString("en-US")}</span>;
}
function GSeed(str) {
  let h = 2166136261;for (let i = 0; i < str.length; i++) {h ^= str.charCodeAt(i);h = Math.imul(h, 16777619);}
  return () => {h += 0x6D2B79F5;let t = h;t = Math.imul(t ^ t >>> 15, t | 1);t ^= t + Math.imul(t ^ t >>> 7, t | 61);return ((t ^ t >>> 14) >>> 0) / 4294967296;};
}
function GProvinceProfile(p) {
  const rnd = GSeed(p.name + "·v2");
  const brands = DG.BRANDS.map((b) => ({ name: b.name, color: b.color, w: b.share * (0.6 + rnd() * 0.8) }));
  const tw = brands.reduce((s, b) => s + b.w, 0);brands.forEach((b) => b.w /= tw);brands.sort((a, b) => b.w - a.w);
  const nevN = Math.round(p.n * p.nev),bev = Math.round(nevN * 0.62),phev = nevN - bev,fuel = p.n - nevN;
  const base = { low: 0.34, mid: 0.40, high: 0.18, crit: 0.08 };const bands = {};
  ["low", "mid", "high", "crit"].forEach((k) => {bands[k] = Math.max(0.01, base[k] * (0.78 + rnd() * 0.5));});
  const bt = bands.low + bands.mid + bands.high + bands.crit;
  ["low", "mid", "high", "crit"].forEach((k) => {bands[k] = Math.round(bands[k] / bt * p.n);});
  const avg = Math.round(440 + (bands.high + bands.crit) / p.n * 260);
  return { brands: brands.slice(0, 4), bev, phev, fuel, nevN, bands, avg };
}

/* ───────────────── ① 全域感知 · 指挥条（万物互联 / 把控感）───────────────── */
function GCommandStrip() {
  const { useState, useEffect, useRef } = React;
  const mounted = GUseMounted();
  // 今日实时接入信号（亿）—— 持续微增，营造实时中枢的「活」感
  const SIG_RATE = 173e8 / 86400; // 173 亿/日 ≈ 20 万条/秒（真实吞吐）
  const gToday = () => {const d = new Date();return SIG_RATE * (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());};
  const [sig, setSig] = useState(gToday);
  const acc = useRef(0);
  useEffect(() => {
    acc.current = gToday();let last = performance.now();
    const id = setInterval(() => {const now = performance.now();acc.current += SIG_RATE * (now - last) / 1000;last = now;setSig(acc.current);}, 120);
    return () => clearInterval(id);
  }, []);
  const pipeline = [
  { t: "车联网信号", s: "173 亿/日", c: "#9AA6B2" },
  { t: "清洗 · 对齐", s: "99.2% 通过", c: "#9AA6B2" },
  { t: "12 项风险特征", s: "5 维可解释", c: "#ED1C24" },
  { t: "从车风险分", s: "200–997", c: "#ED1C24" },
  { t: "6 家险企", s: "可定价资产", c: "#2BA37A" }];

  const stats = [
  { n: DG.NATIONAL.vehicles / 10000, f: (v) => v.toFixed(1), u: "万辆", l: "全国接入" },
  { n: 31, f: (v) => Math.round(v), u: "省区市", l: "全域覆盖" },
  { n: 6, f: (v) => Math.round(v), u: "大品牌", l: "一汽集团" },
  { n: 76, f: (v) => Math.round(v) + "%", u: "", l: "数据授权率" }];

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", color: "#fff",
      background: "linear-gradient(120deg,#0c1116 0%, #141d27 58%, #11161b 100%)",
      border: "1px solid #1f2a35", boxShadow: "0 6px 26px rgba(8,12,18,.30)", padding: "18px 22px" }}>
      <div style={{ position: "absolute", inset: 0, opacity: .5, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.05) 1px, transparent 0)", backgroundSize: "22px 22px" }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(230px,0.8fr) 1.55fr", gap: 26, alignItems: "center" }}>
        {/* 实时中枢 */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, letterSpacing: ".10em", color: "#ED1C24" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2BA37A", boxShadow: "0 0 0 4px rgba(43,163,122,.22)", animation: "gBlink 1.8s ease-in-out infinite" }} />
            全域感知 · 实时数据中枢
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 11 }}>
            <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em" }}>{(sig / 1e8).toFixed(3)}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#aeb8c2" }}>亿条</div>
          </div>
          <div style={{ fontSize: 12, color: "#7c8794", marginTop: 5 }}>今日实时接入车联网信号 · 173 亿/日 ≈ 20 万条/秒</div>
          <div style={{ display: "flex", gap: 18, marginTop: 15 }}>
            {stats.map((s, i) =>
            <div key={s.l}>
                <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  {mounted ? <GCountUp value={s.n} dur={900 + i * 120} format={s.f} /> : "0"}<span style={{ fontSize: 11, color: "#7c8794", fontWeight: 700, marginLeft: 2 }}>{s.u}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#6c7884", marginTop: 3 }}>{s.l}</div>
              </div>
            )}
          </div>
        </div>
        {/* 价值流水线 —— 数据标准 + 前端整合的能力具象化 */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7c8794", marginBottom: 11 }}>从原始信号到可定价资产 · 一套数据标准贯通全集团</div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 17, height: 2, background: "#222e3a", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "22%", height: "100%", borderRadius: 2,
                background: "linear-gradient(90deg, transparent, #ED1C24, transparent)", animation: "gScan 3.4s linear infinite" }} />
            </div>
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 6 }}>
              {pipeline.map((n, i) =>
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "1 1 0", minWidth: 0,
                opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(6px)", transition: `opacity .5s ${i * 0.09}s, transform .5s ${i * 0.09}s` }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#11161b", border: `2.5px solid ${n.c}`, boxShadow: `0 0 0 4px ${n.c}22`, flex: "0 0 auto" }} />
                  <div style={{ textAlign: "center", minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", color: "#eef2f6" }}>{n.t}</div>
                    <div style={{ fontSize: 10.5, color: "#7c8794", whiteSpace: "nowrap", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{n.s}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>);

}

/* ───────────────── 折线（生长入场 + 悬停）───────────────── */
function GLine({ data, labels, color = "var(--accent)", unit = "", yMax = null, h = 176, annotate = [] }) {
  const { useState, useEffect, useRef } = React;
  const ref = useRef(null);const drew = useRef(false);
  const [len, setLen] = useState(0);const [drawn, setDrawn] = useState(false);const [hi, setHi] = useState(null);
  const W = 640,P = { l: 46, r: 16, t: 16, b: 26 },iw = W - P.l - P.r,ih = h - P.t - P.b,n = data.length;
  const max = yMax || Math.max(...data) * 1.12,min = 0;
  const x = (i) => P.l + (n <= 1 ? 0 : i / (n - 1)) * iw,y = (v) => P.t + ih - (v - min) / (max - min) * ih;
  const path = data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");
  const area = path + `L${x(n - 1).toFixed(1)} ${(P.t + ih).toFixed(1)}L${x(0).toFixed(1)} ${(P.t + ih).toFixed(1)}Z`;
  const gid = "gl" + useRef(Math.random().toString(36).slice(2, 7)).current;
  const colW = iw / (n - 1 || 1);
  const tipLeft = hi == null ? 0 : Math.max(10, Math.min(90, x(hi) / W * 100));
  useEffect(() => {if (ref.current) {setLen(ref.current.getTotalLength());if (!drew.current) {drew.current = true;requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));}}}, [data]);
  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display: "block", overflow: "visible" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".18" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, .5, 1].map((t) =>
        <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={P.t + ih * t} y2={P.t + ih * t} stroke="var(--border)" strokeDasharray="3 4" strokeWidth="1" />
            <text x={P.l - 6} y={P.t + ih * t + 4} textAnchor="end" fontSize="9.5" fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(max * (1 - t)).toLocaleString("en-US")}</text>
          </g>
        )}
        {labels.map((l, i) => (i % Math.ceil(n / 7) === 0 || i === n - 1) && <text key={i} x={x(i)} y={h - 7} textAnchor="middle" fontSize="9.5" fontWeight={hi === i ? 800 : 400} fill={hi === i ? "var(--ink)" : "var(--ink-3)"}>{l}</text>)}
        {annotate.map((a, i) => <g key={"an" + i}><line x1={x(a.i)} x2={x(a.i)} y1={P.t} y2={P.t + ih} stroke="var(--ink-3)" strokeDasharray="2 3" strokeWidth="1" /><text x={x(a.i) + (a.dx || 4)} y={P.t + 10} fontSize="9.5" fontWeight="700" fill="var(--ink-2)" textAnchor={a.anchor || "start"}>{a.t}</text></g>)}
        <path d={area} fill={`url(#${gid})`} opacity={drawn ? 1 : 0} style={{ transition: "opacity .7s .25s" }} />
        {hi != null && <line x1={x(hi)} y1={P.t} x2={x(hi)} y2={P.t + ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
        <path ref={ref} d={path} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={len || 1} strokeDashoffset={drawn ? 0 : len || 1} style={{ transition: "stroke-dashoffset 1s ease" }} />
        {drawn && data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hi === i ? 4.2 : 2.2} fill={color} stroke="var(--surface)" strokeWidth="1.2" style={{ transition: "r .12s" }} />)}
        {data.map((v, i) => <rect key={"hz" + i} x={x(i) - colW / 2} y={0} width={colW} height={h} fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor: "crosshair" }} />)}
      </svg>
      {hi != null &&
      <div style={{ position: "absolute", left: tipLeft + "%", top: -4, transform: "translate(-50%,-100%)", background: "var(--ink)", color: "var(--bg)", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700, boxShadow: "var(--shadow)", pointerEvents: "none", zIndex: 5 }}>
          {labels[hi]} · {fmt(Math.round(data[hi]))}{unit}
        </div>
      }
    </div>);

}

/* ───────────────── ④ 集团脉搏（时间范围切换 · 多信号）───────────────── */
function GPulseTrend() {
  const { useState, useMemo } = React;
  const [range, setRange] = useState("12m");
  const [metric, setMetric] = useState("veh");
  const M = DG.PLATFORM_MONTHLY;
  const METRICS = {
    veh: { label: "接入车辆", color: "var(--accent)", unit: " 辆", get12: () => M.map((r) => r.veh), yMax: 1.45e6, ann12: [] },
    km: { label: "单车月均里程", color: "#1E50A0", unit: " km", get12: () => M.map((r) => r.km), yMax: 1700, ann12: [{ i: 8, t: "春节 2/17", anchor: "end", dx: -4 }, { i: 4, t: "国庆长途" }] },
    alert: { label: "风险告警(热+冷)", color: "#E1A300", unit: " 次/千辆", get12: () => M.map((r) => r.hot + r.cold), yMax: 30, ann12: [{ i: 6, t: "低温充电受限峰" }] }
  };
  const mm = METRICS[metric];
  const daily = useMemo(() => {
    const rnd = GSeed("daily·" + metric);const base12 = mm.get12();const last = base12[base12.length - 1],prev = base12[base12.length - 2];
    const labels = [],data = [];
    for (let d = 29; d >= 0; d--) {
      const f = (29 - d) / 29;const v = prev + (last - prev) * f;
      const wk = Math.sin((29 - d) / 7 * Math.PI * 2) * (metric === "km" ? 70 : metric === "alert" ? 1.6 : 0);
      const noise = (rnd() - 0.5) * (metric === "veh" ? 9000 : metric === "km" ? 40 : 1.2);
      data.push(Math.max(0, Math.round(v + wk + noise)));
      labels.push(d === 0 ? "今天" : "D-" + d);
    }
    if (metric === "veh") {const tot = DG.NATIONAL.vehicles;const lo = tot - 9000,hi = tot;for (let i = 0; i < 30; i++) data[i] = Math.round(lo + (hi - lo) * (i / 29));}
    return { labels, data };
  }, [metric, range]);
  const series = range === "12m" ? { labels: M.map((r) => r.label), data: mm.get12() } : daily;
  const seg = (opts, val, set) =>
  <div style={{ display: "flex", gap: 3, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: 3 }}>
      {opts.map((o) =>
    <button key={o.k} onClick={() => set(o.k)} style={{ border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
      background: val === o.k ? "var(--surface)" : "transparent", color: val === o.k ? "var(--ink)" : "var(--ink-3)", boxShadow: val === o.k ? "var(--shadow)" : "none" }}>{o.t}</button>
    )}
    </div>;

  return (
    <Card title="集团脉搏 · 接入与风险随时间" sub="地理之外的时间维度 · 切换范围实时重绘" right={seg([{ k: "12m", t: "近 12 月" }, { k: "30d", t: "近 30 天" }], range, setRange)}>
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
        {seg([{ k: "veh", t: "接入车辆" }, { k: "km", t: "单车里程" }, { k: "alert", t: "风险告警" }], metric, setMetric)}
      </div>
      <GLine key={metric + range} data={series.data} labels={series.labels} color={mm.color} unit={mm.unit}
      yMax={range === "12m" ? mm.yMax : null} annotate={range === "12m" ? mm.ann12 : []} />
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 }}>
        {metric === "veh" && "接入规模 12 个月翻倍至 128.6 万 —— 资产基数即议价力；近 30 天日增稳定。"}
        {metric === "km" && "2 月通勤坍缩至 960km、10 月长途推高至 1,530km —— 暴露度随季节迁移，定价窗口随之滚动。"}
        {metric === "alert" && "12–1 月低温充电受限告警达峰，与电池健康页低温预警同源 —— 风险有时令，运营要前置。"}
      </div>
    </Card>);

}

/* ───────────────── ③ 风险等级环（可点击联动）───────────────── */
function GDonut({ sel, onSel, size = 190 }) {
  const mounted = GUseMounted();
  const A = DG.AGG,total = A.scored;
  const order = [["low", "低风险"], ["mid", "中风险"], ["high", "中高风险"], ["crit", "高风险"]];
  const thickness = 28,r = (size - thickness) / 2,cx = size / 2,cy = size / 2,C = 2 * Math.PI * r;
  let acc = 0;
  const curKey = sel || "crit";
  const curBand = DG.BANDS.find((b) => b.key === curKey);
  const curN = A.bands[curKey];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          {order.map(([k]) => {
            const band = DG.BANDS.find((b) => b.key === k);const frac = A.bands[k] / total;const dash = `${(frac * C).toFixed(2)} ${C.toFixed(2)}`;const off = -acc * C;acc += frac;
            const active = sel === k,dim = sel && !active;
            return <circle key={k} cx={cx} cy={cy} r={r} fill="none" stroke={band.hex} strokeWidth={active ? thickness + 7 : thickness}
            strokeDasharray={mounted ? dash : `0 ${C.toFixed(2)}`} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`}
            opacity={dim ? 0.3 : 1} style={{ transition: "stroke-dasharray .9s cubic-bezier(.4,1,.4,1), stroke-width .18s, opacity .18s", cursor: "pointer" }}
            onClick={() => onSel(active ? null : k)} />;
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: curBand.hex, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{Math.round(curN / total * 100)}%</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 3 }}>{sel ? curBand.label : "高风险占比"}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmt(curN)} 辆</div>
          </div>
        </div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
        {order.slice().reverse().map(([k, lbl]) => {const band = DG.BANDS.find((b) => b.key === k);const n = A.bands[k];const active = sel === k;
          return (
            <div key={k} onClick={() => onSel(active ? null : k)} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer",
              padding: "4px 8px", margin: "0 -8px", borderRadius: 8, background: active ? "var(--surface-2)" : "transparent", opacity: sel && !active ? 0.55 : 1, transition: "opacity .15s" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: band.hex, flex: "0 0 auto" }} />
              <span style={{ flex: 1, color: "var(--ink)", fontWeight: active ? 800 : 600 }}>{lbl}</span>
              <span style={{ fontWeight: 800, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(n)}</span>
              <span style={{ width: 42, textAlign: "right", color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{Math.round(n / total * 100)}%</span>
            </div>);

        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>{sel ? "已锁定联动 · 再次点击取消" : "点击等级 → 联动评分分布与结构"}</div>
    </div>);

}

/* ───────────────── ③ 评分分布（柱状升起 + 等级联动）───────────────── */
function GBandHistogram({ sel, h = 210 }) {
  const { useState } = React;
  const mounted = GUseMounted();
  const [hi, setHi] = useState(null);
  const buckets = DG.AGG.hist,total = buckets.reduce((s, b) => s + b.n, 0) || 1;
  const max = Math.max(...buckets.map((b) => b.n)) || 1;
  const tipLeft = hi == null ? 0 : Math.max(9, Math.min(91, (hi + 0.5) / buckets.length * 100));
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: h }}>
        {buckets.map((b, i) => {
          const band = DG.bandOf((b.lo + b.hi) / 2);const inSel = !sel || band.key === sel;const active = hi === i;
          return (
            <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end", cursor: "pointer" }}>
              <div style={{ fontSize: 11, fontWeight: active ? 800 : 700, color: active ? "var(--ink)" : "var(--ink-2)", fontVariantNumeric: "tabular-nums", opacity: inSel ? 1 : 0.35 }}>{fmt(b.n)}</div>
              <div style={{ width: "100%", height: mounted ? `${b.n / max * 100}%` : "0%", minHeight: mounted ? 3 : 0, background: band.hex, borderRadius: "4px 4px 0 0",
                opacity: inSel ? hi == null ? 0.92 : active ? 1 : 0.5 : 0.16, transform: active ? "scaleY(1.02)" : "none", transformOrigin: "bottom",
                transition: `height .8s cubic-bezier(.3,1,.4,1) ${i * 0.025}s, opacity .18s` }} />
            </div>);

        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
        <span>200</span><span>低 ← 风险评分 → 高</span><span>997</span>
      </div>
      {hi != null &&
      <div style={{ position: "absolute", left: tipLeft + "%", top: -8, transform: "translate(-50%,-100%)", background: "var(--ink)", color: "var(--bg)", borderRadius: 8, padding: "7px 11px", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, boxShadow: "var(--shadow)", pointerEvents: "none", zIndex: 5 }}>
          {buckets[hi].lo}–{buckets[hi].hi} 分 · {fmt(buckets[hi].n)} 辆 · {Math.round(buckets[hi].n / total * 100)}%
        </div>
      }
    </div>);

}

/* ───────────────── ⑤ 集团风险结构（维度切换 + 等级联动 + 升起）───────────────── */
function GStack({ bands, total, sel, height = 15 }) {
  const mounted = GUseMounted();
  const order = [["low", "var(--band-low)"], ["mid", "var(--band-mid)"], ["high", "var(--band-high)"], ["crit", "var(--band-crit)"]];
  const tot = (bands.low || 0) + (bands.mid || 0) + (bands.high || 0) + (bands.crit || 0) || 1;
  return (
    <div style={{ display: "flex", width: "100%", height, borderRadius: 6, overflow: "hidden", background: "var(--surface-2)" }}>
      {order.map(([k, c]) => {const f = (bands[k] || 0) / tot;if (f <= 0) return null;const dim = sel && sel !== k;
        return <div key={k} title={`${k} ${Math.round(f * 100)}%`} style={{ width: mounted ? f * 100 + "%" : "0%", background: c, opacity: dim ? 0.28 : 1, transition: `width .9s cubic-bezier(.3,1,.4,1), opacity .18s` }} />;})}
    </div>);

}
function GStructureExplorer({ sel }) {
  const { useState } = React;
  const [dim, setDim] = useState("brand");
  const synthBands = (avg, n) => {const t = Math.max(0, Math.min(1, (avg - 380) / 240));const crit = 0.05 + t * 0.34,high = 0.12 + t * 0.20,mid = 0.31 - t * 0.07;const low = Math.max(0.04, 1 - crit - high - mid);const s = low + mid + high + crit;return { low: Math.round(low / s * n), mid: Math.round(mid / s * n), high: Math.round(high / s * n), crit: Math.round(crit / s * n) };};
  const dims = {
    brand: { label: "按品牌", rows: DG.BRANDS.map((b) => ({ k: b.name, color: b.color, mark: b.name, n: b.n, bands: b.bands, avg: b.avgScore })) },
    energy: { label: "按能源", rows: DG.ENERGY.map((e) => ({ k: e.name, color: "var(--ink-3)", n: e.n, bands: e.bands, avg: e.avgScore })) },
    usage: { label: "按用途", rows: DG.AGG.usage.map((u) => ({ k: u.name, color: "var(--ink-3)", n: u.n, bands: synthBands(u.avgScore, u.n), avg: u.avgScore })) }
  };
  const cur = dims[dim];
  const segOpts = [{ k: "brand", t: "品牌" }, { k: "energy", t: "能源" }, { k: "usage", t: "用途" }];
  const selLabel = sel ? DG.BANDS.find((b) => b.key === sel).label : null;
  return (
    <Card title="集团风险结构 · 多维透视" sub={sel ? `已按「${selLabel}」联动高亮` : "切换维度 · 接入规模 × 等级构成 × 平均评分"}
    right={
    <div style={{ display: "flex", gap: 3, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: 3 }}>
          {segOpts.map((o) =>
      <button key={o.k} onClick={() => setDim(o.k)} style={{ border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
        background: dim === o.k ? "var(--surface)" : "transparent", color: dim === o.k ? "var(--ink)" : "var(--ink-3)", boxShadow: dim === o.k ? "var(--shadow)" : "none" }}>{o.t}</button>
      )}
        </div>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cur.rows.map((r) => {
          const selN = sel ? r.bands[sel] || 0 : null;
          return (
            <div key={r.k} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "3px 6px", margin: "0 -6px", borderRadius: 8 }}>
              {dim === "brand" ? <BrandMark name={r.mark} color={r.color} size={28} /> : <span style={{ width: 10, height: 10, borderRadius: 3, background: dim === "energy" ? { "燃油": "#7A8896", "油电混合": "#2E9CCB", "插电混合": "#8A5CD0", "纯电": "#0E8A6E" }[r.k] || "var(--ink-3)" : { "非营运": "#0E8A6E", "兼职网约": "#E1A300", "全职网约": "#ED1C24" }[r.k] || "var(--accent)", flex: "0 0 auto" }} />}
              <div style={{ width: 118, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.k}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.n)} 辆{sel ? ` · ${selLabel} ${fmt(selN)}` : ""}</div>
              </div>
              <div style={{ flex: 1 }}><GStack bands={r.bands} sel={sel} height={15} /></div>
              <div style={{ width: 48, textAlign: "right" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: DG.bandOf(r.avg).hex, fontVariantNumeric: "tabular-nums" }}>{r.avg}</div>
                <div style={{ fontSize: 10, color: "var(--ink-3)" }}>评分</div>
              </div>
            </div>);

        })}
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--ink-3)", marginTop: 2, flexWrap: "wrap" }}>
          {[["low", "低"], ["mid", "中"], ["high", "中高"], ["crit", "高"]].map(([k, l]) =>
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, opacity: sel && sel !== k ? 0.4 : 1 }}><span style={{ width: 9, height: 9, borderRadius: 2.5, background: `var(--band-${k})` }} />{l}风险</span>
          )}
          <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>数字 = 平均评分（越高风险越大）</span>
        </div>
      </div>
    </Card>);

}

/* ───────────────── ③ 可下钻地图 ───────────────── */
const GMAP_METRICS = [
{ key: "n", label: "接入车辆", base: "var(--accent)", fmtV: (p) => fmt(p.n), of: (p) => p.n, scale: (p) => Math.sqrt(p.n) },
{ key: "nev", label: "新能源占比", base: "#0E8A6E", fmtV: (p) => Math.round(p.nev * 100) + "%", of: (p) => p.nev, scale: (p) => p.nev },
{ key: "engage", label: "互动月活", base: "#1E50A0", fmtV: (p) => p.engage + "%", of: (p) => p.engage, scale: (p) => p.engage }];

function GMapCard() {
  const { useState } = React;
  const mounted = GUseMounted();
  const [metric, setMetric] = useState("n");
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null);
  const mm = GMAP_METRICS.find((m) => m.key === metric);
  const vals = DG.PROVINCES.map((p) => mm.scale(p));const vmax = Math.max(...vals),vmin = Math.min(...vals);
  const byName = {};DG.PROVINCES.forEach((p, i) => byName[p.name] = { p, t: (vals[i] - vmin) / (vmax - vmin || 1) });
  const sh = CNM_G && CNM_G.provinces.find((x) => x.name === "上海");
  const top = [...DG.PROVINCES].sort((a, b) => mm.of(b) - mm.of(a)).slice(0, 8);const topMax = mm.of(top[0]);
  const hp = hover ? DG.PROVINCES.find((p) => p.name === hover) : null;
  const selP = sel ? DG.PROVINCES.find((p) => p.name === sel) : null;
  const prof = selP ? GProvinceProfile(selP) : null;
  return (
    <div className="card" style={{ padding: "var(--card-pad)", display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "calc(var(--gap) + 8px)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>全国接入分布 · 点击省份下钻</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{fmt(DG.NATIONAL.vehicles)} 辆 · 31 省区市 · 截至 2026-05</div>
          </div>
          <div style={{ display: "flex", gap: 3, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: 3 }}>
            {GMAP_METRICS.map((m) =>
            <button key={m.key} onClick={() => setMetric(m.key)} style={{ border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
              background: metric === m.key ? "var(--surface)" : "transparent", color: metric === m.key ? "var(--ink)" : "var(--ink-3)", boxShadow: metric === m.key ? "var(--shadow)" : "none" }}>{m.label}</button>
            )}
          </div>
        </div>
        <div style={{ position: "relative", marginTop: 8 }}>
          <svg viewBox={`0 0 ${CNM_G ? CNM_G.w : 260} ${CNM_G ? CNM_G.h : 188}`} style={{ display: "block", width: "100%" }}>
            {CNM_G && CNM_G.provinces.map((pr, i) => {
              const d = byName[pr.name];const t = d ? d.t : null;
              const fill = t == null ? "color-mix(in srgb, var(--ink-3) 14%, var(--surface-2))" : `color-mix(in srgb, ${mm.base} ${Math.round(10 + t * 74)}%, var(--surface-2))`;
              const isHover = hover === pr.name,isSel = sel === pr.name;
              return <path key={pr.name} d={pr.d} fill={fill}
              stroke={isSel ? "var(--ink)" : isHover ? "var(--ink)" : "var(--surface)"} strokeWidth={isSel ? 1.5 : isHover ? 1.1 : 0.55}
              opacity={mounted ? sel && !isSel ? 0.55 : 1 : 0}
              style={{ cursor: d ? "pointer" : "default", transition: `opacity .5s ${Math.min(i * 7, 420)}ms, fill .25s` }}
              onMouseEnter={() => d && setHover(pr.name)} onMouseLeave={() => setHover(null)} onClick={() => d && setSel(isSel ? null : pr.name)} />;
            })}
            {sh && sh.cp &&
            <g pointerEvents="none">
                <circle cx={sh.cp[0]} cy={sh.cp[1]} r="2.6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="0.85" />
                <circle cx={sh.cp[0]} cy={sh.cp[1]} r="1.4" fill="var(--accent)" />
                <text x={sh.cp[0] + 5.5} y={sh.cp[1] - 3.5} fontSize="4.6" fontWeight="800" fill="var(--ink)">上海 · 试点 5 万</text>
              </g>
            }
          </svg>
          {hp && !sel &&
          <div style={{ position: "absolute", left: "2%", bottom: "4%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", padding: "10px 14px", pointerEvents: "none", minWidth: 150 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>{hp.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 14px", marginTop: 6, fontSize: 11.5 }}>
                <span style={{ color: "var(--ink-3)" }}>接入车辆</span><b style={{ color: "var(--ink)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(hp.n)}</b>
                <span style={{ color: "var(--ink-3)" }}>新能源占比</span><b style={{ color: "#0E8A6E", textAlign: "right" }}>{Math.round(hp.nev * 100)}%</b>
                <span style={{ color: "var(--ink-3)" }}>互动月活</span><b style={{ color: "#1E50A0", textAlign: "right" }}>{hp.engage}%</b>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 700, marginTop: 6 }}>点击下钻明细 →</div>
            </div>
          }
          <div style={{ position: "absolute", right: "1%", bottom: "4%", display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--ink-3)" }}>
            <span>低</span>
            <div style={{ width: 84, height: 8, borderRadius: 4, background: `linear-gradient(90deg, color-mix(in srgb, ${mm.base} 10%, var(--surface-2)), color-mix(in srgb, ${mm.base} 84%, var(--surface-2)))` }} />
            <span>高</span>
          </div>
        </div>
      </div>

      {/* 右栏：Top 榜 ↔ 省份下钻 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        {!selP ?
        <React.Fragment>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>省份 Top 8 · {mm.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {top.map((p) =>
            <div key={p.name} onMouseEnter={() => setHover(p.name)} onMouseLeave={() => setHover(null)} onClick={() => setSel(p.name)}
            style={{ display: "grid", gridTemplateColumns: "44px 1fr 58px", alignItems: "center", gap: 9, cursor: "pointer",
              background: hover === p.name ? "var(--surface-2)" : "transparent", borderRadius: 6, padding: "2px 4px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>{p.name}</span>
                  <div style={{ height: 9, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden" }}>
                    <div style={{ width: mounted ? mm.of(p) / topMax * 100 + "%" : "0%", height: "100%", borderRadius: 5, background: `color-mix(in srgb, ${mm.base} 78%, var(--surface-2))`, transition: "width .9s cubic-bezier(.3,1,.4,1)" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{mm.fmtV(p)}</span>
                </div>
            )}
            </div>
            <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
              {[["纯电 BEV", DG.NATIONAL.bev, "#0E8A6E"], ["插电混动", DG.NATIONAL.phev, "#E1A300"], ["燃油(OBD)", DG.NATIONAL.ice, "#7A8896"]].map(([l, n, c]) =>
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2.5, background: c, flex: "0 0 auto" }} />
                  <span style={{ color: "var(--ink-2)", flex: 1 }}>{l}</span><b style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(n)}</b>
                </div>
            )}
            </div>
          </React.Fragment> :

        <div style={{ display: "flex", flexDirection: "column", gap: 11, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <button onClick={() => setSel(null)} style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-2)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Top 榜</button>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ink)" }}>{selP.name}</div>
              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: "var(--ink-3)", border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px" }}>下钻示意</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["接入车辆", fmt(selP.n), "var(--ink)"], ["平均评分", prof.avg, DG.bandOf(prof.avg).hex], ["新能源占比", Math.round(selP.nev * 100) + "%", "#0E8A6E"], ["互动月活", selP.engage + "%", "#1E50A0"]].map(([l, v, c]) =>
            <div key={l} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>{l}</div>
                </div>
            )}
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", marginBottom: 5 }}>风险等级构成</div>
              <GStack bands={prof.bands} sel={null} height={13} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", marginBottom: 6 }}>品牌结构 Top 4</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {prof.brands.map((b) =>
              <div key={b.name} style={{ display: "grid", gridTemplateColumns: "68px 1fr 36px", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ width: Math.round(b.w * 100) + "%", height: "100%", borderRadius: 4, background: b.color }} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(b.w * 100)}%</span>
                  </div>
              )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.55, borderTop: "1px solid var(--border)", paddingTop: 9 }}>
              {selP.name}接入 {fmt(selP.n)} 辆 · 新能源 {fmt(prof.nevN)} 辆（BEV {fmt(prof.bev)} / PHEV {fmt(prof.phev)}）。{selP.name === "上海" ? "全量纳入 12 特征深度评分试点。" : "深度评分逐省推广中。"}
            </div>
          </div>
        }
      </div>
    </div>);

}

/* ───────────────── ⑥ 数据价值条 ───────────────── */
function GValueBanner() {
  const mounted = GUseMounted();
  return (
    <div className="card" style={{ padding: "calc(var(--card-pad) + 2px)", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
      background: "linear-gradient(135deg, var(--surface) 60%, var(--accent-soft))" }}>
      <div style={{ flex: "1 1 360px", minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--accent)", letterSpacing: ".04em" }}>数据合作的意义 · 我们的角色</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: "var(--ink)", marginTop: 6, lineHeight: 1.45 }}>
          股东车联网数据 → 可定价的风险资产。<br />为鑫安<b style={{ color: "var(--accent)" }}>制定数据标准、整合前端能力</b>，让一汽全集团的数据被一致地驾驭。
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 9, lineHeight: 1.6 }}>
          下一阶段在<b>实时性 · 更多品牌 · 更长历史</b> —— 评分区分度（GINI）与电池热风险识别持续进化，价值最终落到<b style={{ color: "#0E8A6E" }}>更准的定价</b>与<b style={{ color: "#0E8A6E" }}>更好的车主体验</b>。
        </div>
        <div style={{ marginTop: 13, maxWidth: 420 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}><span>评分区分度 GINI</span><span><b style={{ color: "var(--ink)" }}>0.41</b> · 目标 0.45+</span></div>
          <div style={{ position: "relative", height: 8, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ width: mounted ? 0.41 / 0.6 * 100 + "%" : "0%", height: "100%", borderRadius: 5, background: "linear-gradient(90deg, var(--band-high), var(--accent))", transition: "width 1s ease" }} />
            <div style={{ position: "absolute", left: 0.45 / 0.6 * 100 + "%", top: -2, width: 2, height: 12, background: "var(--ink-3)" }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, flex: "0 0 auto", flexWrap: "wrap" }}>
        {[["12", "/12", "特征已就绪", "var(--ink)"], ["0.41", "", "当前 GINI", "var(--accent)"], ["6", "", "家险企在用", "#0E8A6E"], ["−9.2%", "", "改善组出险", "#0E8A6E"]].map(([n, suf, l, c], i) =>
        <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: c, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {mounted && i < 2 ? i === 0 ? <GCountUp value={12} format={(v) => Math.round(v)} /> : <GCountUp value={0.41} dur={1100} format={(v) => v.toFixed(2)} /> : n}<span style={{ fontSize: 16, color: "var(--ink-3)" }}>{suf}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{l}</div>
          </div>
        )}
      </div>
    </div>);

}

/* ───────────────── 集团风险总览 ───────────────── */
function GroupScreen({ onOpenVehicle }) {
  const { useState } = React;
  const A = DG.AGG,total = A.scored;
  const highCritPct = Math.round((A.bands.crit + A.bands.high) / total * 100);
  const vehSpark = DG.PLATFORM_MONTHLY.map((r) => r.veh);
  const [selBand, setSelBand] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--gap) + 2px)" }}>
      <GCommandStrip />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--gap)" }}>
        <KPI label="全国接入车辆" value={<GCountUp value={DG.NATIONAL.vehicles / 10000} format={(v) => v.toFixed(1)} />} unit="万辆" accent sub="一汽集团 6 大品牌 · 31 省区市" spark={vehSpark} />
        <KPI label="新能源接入" value={<GCountUp value={DG.NATIONAL.nev / 10000} format={(v) => v.toFixed(1)} />} unit="万辆" sub={`纯电 ${(DG.NATIONAL.bev / 10000).toFixed(1)}万 · 插混 ${(DG.NATIONAL.phev / 10000).toFixed(1)}万`} sparkColor="#0E8A6E" />
        <KPI label="上海深度评分试点" value={<GCountUp value={total} format={(v) => Math.round(v).toLocaleString("en-US")} />} unit="辆" sub="12 特征全量 · 评分覆盖 100%" />
        <KPI label="试点中高风险占比" value={<GCountUp value={highCritPct} format={(v) => Math.round(v) + "%"} />} sub={`高风险 ${A.bands.crit} 辆需事中干预`} sparkColor="var(--band-crit)" />
      </div>

      <GMapCard />

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "var(--gap)", alignItems: "stretch" }}>
        <GPulseTrend />
        <Card title="风险等级分布" sub={`上海试点 ${fmt(total)} 辆 · 点击联动`}>
          <GDonut sel={selBand} onSel={setSelBand} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: "var(--gap)", alignItems: "stretch" }}>
        <Card title="评分分布" sub={selBand ? `高亮「${DG.BANDS.find((b) => b.key === selBand).label}」区间` : "车辆数 × 评分区间 · 全样本均值 500"}>
          <GBandHistogram sel={selBand} />
        </Card>
        <GStructureExplorer sel={selBand} />
      </div>

      <GValueBanner />
    </div>);

}

/* ---------------- 保险市场份额 ---------------- */
/* ───────────────── 市场份额环（可悬停联动）───────────────── */
function GMarketDonut({ ins, total, hoverKey, onHover, size = 188 }) {
  const mounted = GUseMounted();
  const thickness = 28, r = (size - thickness) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  const hi = ins.find((o) => o.key === hoverKey);
  const xinan = ins.find((o) => o.key === "xinan");
  const center = hi || xinan;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {ins.map((o) => {
          const frac = o.n / total, dash = `${(frac * C).toFixed(2)} ${C.toFixed(2)}`, off = -acc * C;acc += frac;
          const active = hoverKey === o.key, dim = hoverKey && !active;
          return <circle key={o.key} cx={cx} cy={cy} r={r} fill="none" stroke={o.color} strokeWidth={active ? thickness + 7 : thickness}
            strokeDasharray={mounted ? dash : `0 ${C.toFixed(2)}`} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`}
            opacity={dim ? 0.3 : 1} style={{ transition: "stroke-dasharray .9s cubic-bezier(.4,1,.4,1), stroke-width .18s, opacity .18s", cursor: "pointer" }}
            onMouseEnter={() => onHover(o.key)} onMouseLeave={() => onHover(null)} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
        <div>
          <div style={{ fontSize: 27, fontWeight: 900, color: center.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{(center.share * 100).toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: "var(--ink)", fontWeight: 700, marginTop: 4 }}>{center.name.replace("保险公司", "")}{center.key === "xinan" ? " · 第4" : ""}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(center.n)} 辆</div>
        </div>
      </div>
    </div>);
}

/* ---------------- 保险市场份额 ---------------- */
function MarketScreen() {
  const { useState } = React;
  const A = DG.AGG;
  const total = A.scored;
  const ins = DG.INSURERS.map((o) => ({ ...o, color: INS_COLOR[o.key] }));
  const xinan = ins.find((o) => o.key === "xinan");
  const leader = [...ins].sort((a, b) => b.share - a.share)[0];
  const [hoverKey, setHoverKey] = useState(null);
  const avgSpread = (() => {const a = ins.map((o) => o.avgScore);return Math.max(...a) - Math.min(...a);})();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--gap) + 2px)" }}>
      <div className="card" style={{ padding: "calc(var(--card-pad) + 2px)", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", background: "linear-gradient(120deg, var(--surface) 58%, var(--accent-soft))" }}>
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: ".04em" }}>一汽车主 · 上海试点在保结构</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", marginTop: 5, lineHeight: 1.4 }}>六家险企承保同一批车主，平均评分仅相差 {avgSpread} 分 —— 同质红海</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>份额由商务关系决定，区分力由从车数据决定。这一页回答：在评分天然相近的市场里，谁最有条件率先把信号变成差异化费率。</div>
        </div>
        <div style={{ display: "flex", gap: 22, flex: "0 0 auto" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>6</div><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>家承保险企</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{avgSpread}<span style={{ fontSize: 14, color: "var(--ink-3)" }}>分</span></div><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>评分极差 · ≈500</div></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--gap)" }}>
        <KPI label="试点在保车辆" value={<GCountUp value={total} format={(v) => Math.round(v).toLocaleString("en-US")} />} unit="辆" sub="一汽车主 · 上海试点 · 多家承保" />
        <KPI label="承保保险公司" value={<GCountUp value={6} format={(v) => Math.round(v)} />} unit="家" sub={`${leader.name.replace("保险公司", "")}领先 · 鑫安第 4`} />
        <KPI label="鑫安车险份额" value={<GCountUp value={xinan.share * 100} format={(v) => v.toFixed(0) + "%"} />} accent sub={`${fmt(xinan.n)} 辆 · 集团关联险企`} />
        <KPI label="鑫安在保新能源占比" value={<GCountUp value={xinan.nevShare * 100} format={(v) => Math.round(v) + "%"} />} sub="全场最高 · 三电延保交叉销售" sparkColor="#0E8A6E" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.6fr", gap: "var(--gap)", alignItems: "stretch" }}>
        <Card title="各保险公司市场份额" sub="一汽车主在保结构 · 悬停联动">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <GMarketDonut ins={ins} total={total} hoverKey={hoverKey} onHover={setHoverKey} />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
              {ins.map((o) => {
                const active = hoverKey === o.key;
                return (
                  <div key={o.key} onMouseEnter={() => setHoverKey(o.key)} onMouseLeave={() => setHoverKey(null)}
                    style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer",
                      padding: "5px 8px", margin: "0 -8px", borderRadius: 8,
                      background: active ? "var(--surface-2)" : o.key === "xinan" ? "var(--accent-soft)" : "transparent",
                      opacity: hoverKey && !active ? 0.5 : 1, transition: "opacity .15s, background .15s" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: o.color, flex: "0 0 auto" }} />
                    <span style={{ flex: 1, color: "var(--ink)", fontWeight: o.key === "xinan" ? 800 : 600 }}>{o.name}{o.key === "xinan" && <span style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 800, marginLeft: 6 }}>本平台险企</span>}</span>
                    <span style={{ fontWeight: 800, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{(o.share * 100).toFixed(1)}%</span>
                  </div>);
              })}
            </div>
          </div>
        </Card>

        <Card title="保险公司 · 风险画像对比" sub="份额 / 平均评分 / 风险等级构成 / 新能源占比 · 悬停联动份额环">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 700, textAlign: "left" }}>
                  <th style={{ padding: "6px 10px" }}>保险公司</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>在保车辆</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>平均评分</th>
                  <th style={{ padding: "6px 10px", width: "34%" }}>风险等级构成</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>新能源</th>
                </tr>
              </thead>
              <tbody>
                {ins.map((o) => {
                  const active = hoverKey === o.key;
                  return (
                    <tr key={o.key} onMouseEnter={() => setHoverKey(o.key)} onMouseLeave={() => setHoverKey(null)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer",
                        background: active ? "var(--surface-2)" : o.key === "xinan" ? "var(--accent-soft)" : "transparent",
                        opacity: hoverKey && !active ? 0.55 : 1, transition: "opacity .15s, background .15s" }}>
                      <td style={{ padding: "11px 10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: o.color }} />
                          <span style={{ fontSize: 13.5, fontWeight: o.key === "xinan" ? 800 : 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{o.name}</span>
                        </span>
                      </td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>{fmt(o.n)}<span style={{ fontSize: 11, color: "var(--ink-3)" }}> · {(o.share * 100).toFixed(0)}%</span></td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 800, color: DG.bandOf(o.avgScore).hex }}>{o.avgScore}</td>
                      <td style={{ padding: "11px 10px" }}><GStack bands={o.bands} sel={null} height={13} /></td>
                      <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 700, color: o.key === "xinan" ? "#0E8A6E" : "var(--ink-2)" }}>{Math.round(o.nevShare * 100)}%</td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 14, lineHeight: 1.6, borderLeft: "4px solid var(--accent)", background: "var(--accent-soft)", padding: "11px 14px", borderRadius: "0 9px 9px 0" }}>
            <b>读法：</b>六家平均评分仅相差 <b style={{ color: "var(--ink)" }}>{avgSpread} 分</b>（≈500）—— 同一批车主，风险天然相似；<b style={{ color: "var(--accent)" }}>真正的区分能力来自从车数据，而非承保主体</b>。鑫安凭借集团关联，在保<b style={{ color: "#0E8A6E" }}>新能源占比最高（{Math.round(xinan.nevShare * 100)}%）</b>，最有条件率先把一汽真实信号转化为差异化定价。
          </div>
        </Card>
      </div>

      {/* 鑫安结构性机会 · 为什么第4也能赢 */}
      <Card title="鑫安结构性机会 · 第 4 份额，第 1 数据位势" sub="同质市场里，从车数据是唯一护城河 —— 三条结构性优势">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--gap)" }}>
          {[
          { tag: "① 独家数据通道", big: "76%", lbl: "一汽车主数据授权率", c: "var(--accent)",
            body: "集团关联险企 → 直连一汽车联网信号，授权率与数据深度领先第三方采买，是定价能力的源头。" },
          { tag: "② 新能源集中度", big: Math.round(xinan.nevShare * 100) + "%", lbl: "在保新能源占比 · 全场最高", c: "#0E8A6E",
            body: "新能源是电池/充电风险的唯一适用口径，也是三电延保、充电服务的交叉销售入口 —— 高浓度即高客单与高黏性。" },
          { tag: "③ 定价区分度", big: "0.41", lbl: "评分 GINI · 目标 0.45+", c: "#1E50A0",
            body: "把从车信号转化为差异化费率，优质车主留存、高风险车主出清 —— 在评分相近的红海中撬动份额迁移。" }].
          map((p) =>
          <div key={p.tag} className="row-hover" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "16px 17px", display: "flex", flexDirection: "column", gap: 9, background: "var(--surface)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: p.c, letterSpacing: ".02em" }}>{p.tag}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: p.c, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{p.big}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>{p.lbl}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{p.body}</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "var(--gap)", flexWrap: "wrap", background: "var(--surface-2)", borderRadius: 11, padding: "13px 16px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>价值闭环</span>
          {["一汽车联网数据", "数据标准 + 前端整合", "从车风险分", "差异化费率", "份额迁移 + 更优体验"].map((s, i, arr) =>
          <React.Fragment key={s}>
              <span style={{ fontSize: 12.5, fontWeight: i === arr.length - 1 ? 800 : 600, color: i === arr.length - 1 ? "#0E8A6E" : "var(--ink-2)", whiteSpace: "nowrap" }}>{s}</span>
              {i < arr.length - 1 && <span style={{ color: "var(--ink-3)", fontWeight: 700 }}>→</span>}
            </React.Fragment>
          )}
        </div>
      </Card>
    </div>);
}

/* ───────────────── 品牌风险地形（规模 × 风险 × 新能源 气泡矩阵）───────────────── */
function GBubbleMatrix({ brands, hoverKey, onHover }) {
  const mounted = GUseMounted();
  const W = 580, H = 320, P = { l: 52, r: 22, t: 22, b: 40 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const xs = brands.map((b) => b.n), ys = brands.map((b) => b.avgScore), sz = brands.map((b) => b.nevN);
  const xMax = Math.max(...xs) * 1.16;
  const yMin = Math.min(...ys) - 18, yMax = Math.max(...ys) + 18;
  const szMax = Math.max(...sz);
  const X = (v) => P.l + v / xMax * iw;
  const Y = (v) => P.t + ih - (v - yMin) / (yMax - yMin) * ih;
  const R = (v) => 12 + Math.sqrt(v / szMax) * 22;
  const med = ((a) => {const s = [...a].sort((m, n) => m - n), i = Math.floor(s.length / 2);return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;})(xs);
  const yThr = 500;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <line x1={X(med)} y1={P.t} x2={X(med)} y2={P.t + ih} stroke="var(--border)" strokeDasharray="4 4" />
      <line x1={P.l} y1={Y(yThr)} x2={W - P.r} y2={Y(yThr)} stroke="var(--border)" strokeDasharray="4 4" />
      <text x={W - P.r - 2} y={P.t + 11} textAnchor="end" fontSize="9.5" fontWeight="700" fill="var(--band-crit)" opacity="0.72">大而高风险 · 优先减量</text>
      <text x={P.l + 3} y={P.t + 11} textAnchor="start" fontSize="9.5" fontWeight="700" fill="var(--band-high)" opacity="0.6">小而高风险</text>
      <text x={W - P.r - 2} y={P.t + ih - 5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="var(--band-low)" opacity="0.72">大而稳 · 压舱石</text>
      <text x={P.l + 3} y={P.t + ih - 5} textAnchor="start" fontSize="9.5" fontWeight="700" fill="var(--ink-3)" opacity="0.7">小而稳</text>
      <text x={P.l + iw / 2} y={H - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink-3)">接入规模（辆）→</text>
      <text x={15} y={P.t + ih / 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink-3)" transform={`rotate(-90 15 ${P.t + ih / 2})`}>← 平均风险评分（高=风险大）</text>
      {[yMax, yThr, yMin].map((v, i) => <text key={i} x={P.l - 9} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(v)}</text>)}
      {brands.map((b, i) => {
        const cx = X(b.n), cy = Y(b.avgScore), r = R(b.nevN);
        const active = hoverKey === b.name, dim = hoverKey && !active;
        return (
          <g key={b.name} onMouseEnter={() => onHover(b.name)} onMouseLeave={() => onHover(null)} style={{ cursor: "pointer" }} opacity={dim ? 0.38 : 1}>
            <circle cx={cx} cy={cy} r={mounted ? active ? r + 3 : r : 0} fill={b.color} fillOpacity={active ? 0.34 : 0.2} stroke={b.color} strokeWidth={active ? 2.6 : 1.6}
              style={{ transition: `r .7s cubic-bezier(.34,1.3,.5,1) ${i * 0.07}s, fill-opacity .15s, stroke-width .15s` }} />
            <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={b.color} style={{ pointerEvents: "none", opacity: mounted ? 1 : 0, transition: `opacity .4s ${0.35 + i * 0.07}s` }}>{b.name.replace("一汽", "")}</text>
          </g>);

      })}
    </svg>);

}

/* ---------------- 品牌与车型结构 ---------------- */
function StructureScreen() {
  const { useState } = React;
  const A = DG.AGG;
  const brands = DG.BRANDS;
  const energyColor = { "燃油": "#7A8896", "油电混合": "#2E9CCB", "插电混合": "#8A5CD0", "纯电": "#0E8A6E" };
  const usageColor = { "非营运": "#0E8A6E", "兼职网约": "#E1A300", "全职网约": "#ED1C24" };
  const nevPct = Math.round(DG.NATIONAL.nev / DG.NATIONAL.vehicles * 100);
  const opsPct = Math.round(A.usage.filter((u) => u.name !== "非营运").reduce((s, u) => s + u.n, 0) / A.scored * 100);
  const [hoverBrand, setHoverBrand] = useState(null);
  const [sortKey, setSortKey] = useState("n");
  const mounted = GUseMounted();
  const SORTS = {
    n: { t: "规模", of: (b) => b.n, fmt: (b) => fmt(b.n), color: "var(--accent)" },
    score: { t: "风险评分", of: (b) => b.avgScore, fmt: (b) => b.avgScore, color: "var(--band-high)" },
    nev: { t: "新能源", of: (b) => b.nevN, fmt: (b) => fmt(b.nevN), color: "#0E8A6E" }
  };
  const sk = SORTS[sortKey];
  const skMax = Math.max(...brands.map(sk.of));
  const ranked = [...brands].sort((a, b) => sk.of(b) - sk.of(a));
  const usageLadder = [...A.usage].sort((a, b) => a.avgScore - b.avgScore);
  const classes = A.classes;
  const cmax = Math.max(...classes.map((c) => c.n));
  const ctot = classes.reduce((s, c) => s + c.n, 0);
  const top3 = Math.round(classes.slice(0, 3).reduce((s, c) => s + c.n, 0) / ctot * 100);
  const seg = (opts, val, set) =>
  <div style={{ display: "flex", gap: 3, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: 3 }}>
      {opts.map((o) =>
    <button key={o.k} onClick={() => set(o.k)} style={{ border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
      background: val === o.k ? "var(--surface)" : "transparent", color: val === o.k ? "var(--ink)" : "var(--ink-3)", boxShadow: val === o.k ? "var(--shadow)" : "none" }}>{o.t}</button>
    )}
    </div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--gap) + 2px)" }}>
      <div className="card" style={{ padding: "calc(var(--card-pad) + 2px)", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", background: "linear-gradient(120deg, var(--surface) 58%, var(--accent-soft))" }}>
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: ".04em" }}>风险长在结构里</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", marginTop: 5, lineHeight: 1.4 }}>6 大品牌 × 4 类能源 × 用途 —— 风险不在「车」，在车的用法</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 }}>纯电锁定电池维度、营运抬升行为强度、品牌决定规模杠杆 —— 看清结构，才知道减量与定价的优先级该落在哪。</div>
        </div>
        <div style={{ display: "flex", gap: 22, flex: "0 0 auto" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, color: "#0E8A6E", fontVariantNumeric: "tabular-nums" }}>{nevPct}%</div><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>新能源占比</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, color: "var(--band-crit)", fontVariantNumeric: "tabular-nums" }}>{opsPct}%</div><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>试点营运车</div></div>
        </div>
      </div>
      {/* 构成总览 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--gap)" }}>
        <KPI label="接入品牌" value={<GCountUp value={6} format={(v) => Math.round(v)} />} unit="家" accent sub="一汽集团全谱系" />
        <KPI label="能源类型" value={<GCountUp value={4} format={(v) => Math.round(v)} />} unit="类" sub="纯电 / 插混 / 油混 / 燃油" />
        <KPI label="新能源占比" value={<GCountUp value={nevPct} format={(v) => Math.round(v) + "%"} />} sub={`纯电 ${(DG.NATIONAL.bev / 10000).toFixed(1)}万 · 插混 ${(DG.NATIONAL.phev / 10000).toFixed(1)}万`} sparkColor="#0E8A6E" />
        <KPI label="试点营运车占比" value={<GCountUp value={opsPct} format={(v) => Math.round(v) + "%"} />} sub="网约（兼职+全职）· 风险分最高" sparkColor="var(--band-crit)" />
      </div>

      {/* 品牌风险地形 + 排行 */}
      <div className="card" style={{ padding: "var(--card-pad)", display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "calc(var(--gap) + 8px)" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>品牌风险地形 · 规模 × 风险 × 新能源</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>气泡大小 = 新能源辆数 · 悬停联动右侧排行</div>
          <GBubbleMatrix brands={brands} hoverKey={hoverBrand} onHover={setHoverBrand} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>品牌排行</span>
            {seg([{ k: "n", t: "规模" }, { k: "score", t: "评分" }, { k: "nev", t: "新能源" }], sortKey, setSortKey)}
          </div>
          {ranked.map((b, i) => {
            const active = hoverBrand === b.name;
            const valCol = sortKey === "score" ? DG.bandOf(b.avgScore).hex : "var(--ink)";
            return (
              <div key={b.name} onMouseEnter={() => setHoverBrand(b.name)} onMouseLeave={() => setHoverBrand(null)}
                style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", alignItems: "center", gap: 9, padding: "4px 6px", margin: "0 -6px", borderRadius: 8,
                  background: active ? "var(--surface-2)" : "transparent", opacity: hoverBrand && !active ? 0.5 : 1, transition: "opacity .15s, background .15s" }}>
                <BrandMark name={b.name} color={b.color} size={22} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>{b.name}</div>
                  <div style={{ height: 7, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden", marginTop: 3 }}>
                    <div style={{ width: mounted ? sk.of(b) / skMax * 100 + "%" : "0%", height: "100%", borderRadius: 4, background: sortKey === "score" ? DG.bandOf(b.avgScore).hex : sk.color, transition: `width .85s cubic-bezier(.3,1,.4,1) ${i * 0.05}s` }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: valCol, fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: 48 }}>{sk.fmt(b)}</div>
              </div>);

          })}
          <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.55, borderTop: "1px solid var(--border)", paddingTop: 9, marginTop: 2 }}>
            读法：右上象限「大而高风险」是<b style={{ color: "var(--ink-2)" }}>减量优先级</b>，规模与风险同高 —— 行为干预与定价杠杆收益最大。
          </div>
        </div>
      </div>

      {/* 能源 + 用途 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
        <Card title="能源结构 × 风险" sub="规模 · 等级构成 · 平均评分 · 三电适用口径">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DG.ENERGY.map((e) =>
            <div key={e.name} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "3px 6px", margin: "0 -6px", borderRadius: 8 }}>
                <div style={{ width: 92, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: energyColor[e.name] || "var(--ink-3)" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>{e.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{fmt(e.n)} 辆 · {(e.share * 100).toFixed(0)}%</div>
                </div>
                <div style={{ flex: 1 }}><GStack bands={e.bands} sel={null} height={14} /></div>
                <div style={{ width: 34, textAlign: "right", fontSize: 16, fontWeight: 800, color: DG.bandOf(e.avgScore).hex, fontVariantNumeric: "tabular-nums" }}>{e.avgScore}</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 13, lineHeight: 1.55, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            纯电仅占 <b style={{ color: "var(--ink-2)" }}>{nevPct - Math.round(DG.NATIONAL.phev / DG.NATIONAL.vehicles * 100)}%</b>，却是<b style={{ color: "#0E8A6E" }}>电池与充电维度</b>的唯一适用口径；燃油车走行为特征，无三电风险。
          </div>
        </Card>

        <Card title="网约风险阶梯 · 用途即风险" sub="非营运 → 兼职 → 全职 · 行为强度决定风险分">
          <div style={{ display: "flex", flexDirection: "column", gap: 15, paddingTop: 2 }}>
            {usageLadder.map((u, i) => {
              const band = DG.bandOf(u.avgScore);
              const w = (u.avgScore - 200) / (997 - 200) * 100;
              return (
                <div key={u.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: usageColor[u.name] || "var(--accent)" }} />{u.name}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{fmt(u.n)} 辆 · 评分 <b style={{ color: band.hex, fontSize: 17 }}>{u.avgScore}</b></span>
                  </div>
                  <div style={{ height: 11, borderRadius: 6, background: "var(--surface-2)", overflow: "hidden" }}>
                    <div style={{ width: mounted ? w + "%" : "0%", height: "100%", borderRadius: 6, background: band.hex, transition: `width .85s cubic-bezier(.3,1,.4,1) ${i * 0.1}s` }} />
                  </div>
                </div>);

            })}
            <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55, borderTop: "1px solid var(--border)", paddingTop: 11 }}>
              全职网约评分显著高于非营运 —— 平台按<b style={{ color: "var(--ink-2)" }}>实际行为强度</b>计量，而非「网约」静态标签。<b style={{ color: "var(--ink-2)" }}>用途漂移可被监测</b>，定价随真实风险滚动。
            </div>
          </div>
        </Card>
      </div>

      {/* 车型分类 */}
      <Card title="车型分类 · 接入规模 Top 8" sub={`按车辆数 · Top 3 车型占接入 ${top3}%（头部集中）`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingTop: 2 }}>
          {classes.map((c, i) => {
            const share = Math.round(c.n / ctot * 100);
            return (
              <div key={c.name} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "3px 6px", margin: "0 -6px", borderRadius: 8 }}>
                <span style={{ width: 26, fontSize: 11, fontWeight: 800, color: i < 3 ? "var(--accent)" : "var(--ink-3)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <span style={{ width: 110, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                <div style={{ flex: 1, height: 18, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: mounted ? c.n / cmax * 100 + "%" : "0%", height: "100%", background: i < 3 ? "var(--accent)" : "color-mix(in srgb, var(--accent) 55%, transparent)", borderRadius: 5, transition: `width .85s cubic-bezier(.3,1,.4,1) ${i * 0.05}s` }} />
                </div>
                <span style={{ width: 40, textAlign: "right", fontSize: 11.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{share}%</span>
                <span style={{ width: 54, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(c.n)}</span>
              </div>);

          })}
        </div>
      </Card>
    </div>);

}

window.GroupScreen = GroupScreen;
window.MarketScreen = MarketScreen;
window.StructureScreen = StructureScreen;