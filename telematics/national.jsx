/* ============================================================================
   全国分布地图 + 平台月度脉搏（季节性）组件
   依赖：cn_map.js (window.CN_MAP) · data.js (window.DATA)
   ============================================================================ */
const DN = window.DATA;
const CNM = window.CN_MAP;

/* ---------- generic multi-line month chart (shared with battery screen) · hover 查看单月 ---------- */
function MonthLines({ series, labels, h = 150, unit = "", yMax = null, annotate = [] }){
  const [hi, setHi] = React.useState(null);
  const W = 560, P = { l: 34, r: 10, t: 12, b: 22 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const max = yMax || Math.max(...series.flatMap(s => s.data)) * 1.12;
  const x = (i) => P.l + i / (labels.length - 1) * iw;
  const y = (v) => P.t + ih - v / max * ih;
  const colW = iw / (labels.length - 1);
  const tipLeft = hi == null ? 0 : Math.max(12, Math.min(88, x(hi) / W * 100));
  return (
    <div style={{ position:"relative" }}>
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block", overflow:"visible" }}>
      {[0, .5, 1].map(t => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={P.t + ih * t} y2={P.t + ih * t} stroke="var(--border)" strokeDasharray="3 4" strokeWidth="1" />
          <text x={P.l - 5} y={P.t + ih * t + 4} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">{Math.round(max * (1 - t))}</text>
        </g>
      ))}
      {labels.map((l, i) => (i % 2 === 0 || i === labels.length - 1) &&
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="9.5" fontWeight={hi===i?800:400} fill={hi===i?"var(--ink)":"var(--ink-3)"}>{l}</text>)}
      {hi != null && <line x1={x(hi)} y1={P.t} x2={x(hi)} y2={P.t + ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
      {series.map((s, si) => (
        <g key={si}>
          <path d={s.data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("")}
            fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          {s.fill && <path d={s.data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("")
            + `L${x(s.data.length - 1)} ${P.t + ih}L${x(0)} ${P.t + ih}Z`} fill={s.color} opacity="0.08" />}
          {s.data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hi === i ? 4.2 : 2.4} fill={s.color} style={{ transition:"r .12s" }} />)}
        </g>
      ))}
      {annotate.map((a, i) => (
        <g key={"a" + i}>
          <line x1={x(a.i)} x2={x(a.i)} y1={P.t} y2={P.t + ih} stroke="var(--ink-3)" strokeDasharray="2 3" strokeWidth="1" />
          <text x={x(a.i) + (a.dx||4)} y={P.t + 10} fontSize="9.5" fontWeight="700" fill="var(--ink-2)" textAnchor={a.anchor||"start"}>{a.t}</text>
        </g>
      ))}
      {labels.map((l, i) => <rect key={"hz"+i} x={x(i) - colW/2} y={0} width={colW} height={h} fill="transparent"
        onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor:"crosshair" }} />)}
    </svg>
    {hi != null && (
      <div style={{ position:"absolute", left:tipLeft+"%", top:-6, transform:"translate(-50%,-100%)",
        background:"var(--ink)", color:"var(--bg)", borderRadius:8, padding:"7px 11px", whiteSpace:"nowrap",
        fontSize:12, fontWeight:700, boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:5 }}>
        {labels[hi]}{series.map((s, si) => <span key={si} style={{ marginLeft:8 }}>{s.label ? s.label + " " : ""}{fmt(s.data[hi])}{s.unit != null ? s.unit : unit}</span>)}
      </div>
    )}
    </div>
  );
}

/* ---------- vehicle growth bars · hover 查看月度明细 ---------- */
function GrowthBars({ h = 150 }){
  const [hi, setHi] = React.useState(null);
  const M = DN.PLATFORM_MONTHLY;
  const W = 560, P = { l: 8, r: 8, t: 16, b: 22 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const max = M[M.length - 1].veh * 1.06;
  const bw = iw / M.length;
  const tipLeft = hi == null ? 0 : Math.max(14, Math.min(86, (P.l + hi * bw + bw / 2) / W * 100));
  const mom = hi == null || hi === 0 ? null : ((M[hi].veh / M[hi-1].veh - 1) * 100).toFixed(1);
  return (
    <div style={{ position:"relative" }}>
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block", overflow:"visible" }}>
      {M.map((r, i) => {
        const bh = r.veh / max * ih;
        const last = i === M.length - 1;
        const active = hi === i;
        return (
          <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor:"pointer" }}>
            <rect x={P.l + i * bw} y={0} width={bw} height={h} fill="transparent" />
            <rect x={P.l + i * bw + bw * 0.16} y={P.t + ih - bh} width={bw * 0.68} height={bh} rx="3.5"
              fill={(last || active) ? "var(--accent)" : "var(--accent-soft)"}
              opacity={hi != null && !active && !last ? 0.55 : 1}
              stroke={(last || active) ? "none" : "color-mix(in srgb, var(--accent) 28%, transparent)"} strokeWidth="1"
              style={{ transition:"fill .15s, opacity .15s" }} />
            {(i % 2 === 0 || last) && <text x={P.l + i * bw + bw / 2} y={h - 6} textAnchor="middle" fontSize="9.5"
              fontWeight={active ? 800 : 400} fill={active ? "var(--ink)" : "var(--ink-3)"}>{r.label}</text>}
            {(last || i === 0) && hi !== i && <text x={P.l + i * bw + bw / 2} y={P.t + ih - bh - 5} textAnchor="middle" fontSize="10" fontWeight="800"
              fill={last ? "var(--accent)" : "var(--ink-3)"}>{(r.veh / 10000).toFixed(1)}万</text>}
          </g>
        );
      })}
    </svg>
    {hi != null && (
      <div style={{ position:"absolute", left:tipLeft+"%", top:-6, transform:"translate(-50%,-100%)",
        background:"var(--ink)", color:"var(--bg)", borderRadius:8, padding:"7px 11px", whiteSpace:"nowrap",
        fontSize:12, fontWeight:700, boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:5 }}>
        {M[hi].m} · {fmt(M[hi].veh)} 辆{mom ? ` · 环比 +${mom}%` : ""}
      </div>
    )}
    </div>
  );
}

/* ---------- choropleth ---------- */
const MAP_METRICS = [
  { key:"n",      label:"接入车辆",   fmtV:(p)=>fmt(p.n),              base:"var(--accent)" },
  { key:"nev",    label:"新能源占比", fmtV:(p)=>Math.round(p.nev*100)+"%", base:"#00AF66" },
  { key:"engage", label:"互动月活",   fmtV:(p)=>p.engage+"%",          base:"#1E50A0" }
];

function ChinaMap({ metric, hover, setHover }){
  const mm = MAP_METRICS.find(m => m.key === metric);
  const vals = DN.PROVINCES.map(p => metric === "n" ? Math.sqrt(p.n) : metric === "nev" ? p.nev : p.engage);
  const vmax = Math.max(...vals), vmin = Math.min(...vals);
  const byName = {}; DN.PROVINCES.forEach((p, i) => byName[p.name] = { p, t: (vals[i] - vmin) / (vmax - vmin) });
  const sh = CNM.provinces.find(x => x.name === "上海");
  return (
    <svg viewBox={`0 0 ${CNM.w} ${CNM.h}`} style={{ display:"block", width:"100%" }}>
      {CNM.provinces.map(pr => {
        const d = byName[pr.name];
        const t = d ? d.t : null;
        const fill = t == null
          ? "color-mix(in srgb, var(--ink-3) 14%, var(--surface-2))"
          : `color-mix(in srgb, ${mm.base} ${Math.round(10 + t * 74)}%, var(--surface-2))`;
        const isHover = hover === pr.name;
        return (
          <path key={pr.name} d={pr.d} fill={fill}
            stroke={isHover ? "var(--ink)" : "var(--surface)"} strokeWidth={isHover ? 1.1 : 0.55}
            style={{ cursor: d ? "pointer" : "default", transition:"fill .25s" }}
            onMouseEnter={() => d && setHover(pr.name)} onMouseLeave={() => setHover(null)} />
        );
      })}
      {/* 上海试点标记 */}
      {sh && sh.cp && (
        <g pointerEvents="none">
          <circle cx={sh.cp[0]} cy={sh.cp[1]} r="3.4" fill="none" stroke="var(--accent)" strokeWidth="1.1">
            <animate attributeName="r" values="2.6;5;2.6" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;.25;1" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle cx={sh.cp[0]} cy={sh.cp[1]} r="1.7" fill="var(--accent)" />
          <text x={sh.cp[0] + 5.5} y={sh.cp[1] - 3.5} fontSize="4.6" fontWeight="800" fill="var(--ink)">上海 · 试点 5 万</text>
        </g>
      )}
    </svg>
  );
}

function NationalMapCard(){
  const { useState } = React;
  const [metric, setMetric] = useState("n");
  const [hover, setHover] = useState(null);
  const mm = MAP_METRICS.find(m => m.key === metric);
  const hp = hover ? DN.PROVINCES.find(p => p.name === hover) : null;
  const top = [...DN.PROVINCES].sort((a, b) =>
    metric === "n" ? b.n - a.n : metric === "nev" ? b.nev - a.nev : b.engage - a.engage).slice(0, 8);
  const topMax = metric === "n" ? top[0].n : metric === "nev" ? top[0].nev : top[0].engage;
  return (
    <div className="card" style={{ padding:"var(--card-pad)", display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"calc(var(--gap) + 6px)" }}>
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:15.5, fontWeight:800, color:"var(--ink)" }}>全国接入分布 · 一汽集团 6 大品牌</div>
            <div style={{ fontSize:12, color:"var(--ink-3)", marginTop:2 }}>{fmt(DN.NATIONAL.vehicles)} 辆 · 31 省区市 · 截至 2026-05</div>
          </div>
          <div style={{ display:"flex", gap:4, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:9, padding:3 }}>
            {MAP_METRICS.map(m => (
              <button key={m.key} onClick={() => setMetric(m.key)}
                style={{ border:"none", cursor:"pointer", padding:"5px 11px", borderRadius:7, fontSize:12, fontWeight:700, fontFamily:"inherit", whiteSpace:"nowrap",
                  background: metric === m.key ? "var(--surface)" : "transparent",
                  color: metric === m.key ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: metric === m.key ? "var(--shadow)" : "none" }}>{m.label}</button>
            ))}
          </div>
        </div>
        <div style={{ position:"relative", marginTop:6 }}>
          <ChinaMap metric={metric} hover={hover} setHover={setHover} />
          {hp && (
            <div style={{ position:"absolute", left:"2%", bottom:"4%", background:"var(--surface)", border:"1px solid var(--border)",
              borderRadius:10, boxShadow:"var(--shadow)", padding:"10px 14px", pointerEvents:"none", minWidth:150 }}>
              <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{hp.name}</div>
              <div style={{ display:"grid", gridTemplateColumns:"auto auto", gap:"3px 14px", marginTop:6, fontSize:11.5 }}>
                <span style={{ color:"var(--ink-3)" }}>接入车辆</span><b style={{ color:"var(--ink)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{fmt(hp.n)}</b>
                <span style={{ color:"var(--ink-3)" }}>新能源占比</span><b style={{ color:"#00AF66", textAlign:"right" }}>{Math.round(hp.nev*100)}%</b>
                <span style={{ color:"var(--ink-3)" }}>互动月活</span><b style={{ color:"#1E50A0", textAlign:"right" }}>{hp.engage}%</b>
              </div>
            </div>
          )}
          <div style={{ position:"absolute", right:"1%", bottom:"4%", display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:"var(--ink-3)" }}>
            <span>低</span>
            <div style={{ width:84, height:8, borderRadius:4,
              background:`linear-gradient(90deg, color-mix(in srgb, ${mm.base} 10%, var(--surface-2)), color-mix(in srgb, ${mm.base} 84%, var(--surface-2)))` }} />
            <span>高</span>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"var(--ink)" }}>省份 Top 8 · {mm.label}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {top.map(p => {
            const v = metric === "n" ? p.n : metric === "nev" ? p.nev : p.engage;
            return (
              <div key={p.name} style={{ display:"grid", gridTemplateColumns:"44px 1fr 58px", alignItems:"center", gap:9,
                  background: hover === p.name ? "var(--surface-2)" : "transparent", borderRadius:6, padding:"1px 4px" }}
                onMouseEnter={() => setHover(p.name)} onMouseLeave={() => setHover(null)}>
                <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)" }}>{p.name}</span>
                <div style={{ height:9, borderRadius:5, background:"var(--surface-2)", overflow:"hidden" }}>
                  <div style={{ width:(v / topMax * 100) + "%", height:"100%", borderRadius:5,
                    background:`color-mix(in srgb, ${mm.base} 78%, var(--surface-2))` }} />
                </div>
                <span style={{ fontSize:12, fontWeight:800, color:"var(--ink)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{mm.fmtV(p)}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:"auto", borderTop:"1px solid var(--border)", paddingTop:11, display:"flex", flexDirection:"column", gap:7 }}>
          {[["纯电 BEV", DN.NATIONAL.bev, "#00AF66"], ["插电混动", DN.NATIONAL.phev, "#E1A300"], ["燃油（OBD 口径）", DN.NATIONAL.ice, "#7A8896"]].map(([l, n, c]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
              <span style={{ width:8, height:8, borderRadius:2.5, background:c, flex:"0 0 auto" }} />
              <span style={{ color:"var(--ink-2)", flex:1 }}>{l}</span>
              <b style={{ color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{fmt(n)}</b>
            </div>
          ))}
          <div style={{ fontSize:11, color:"var(--ink-3)", lineHeight:1.55 }}>
            新能源授权率高于燃油；上海接入 {fmt((DN.PROVINCES.find(function(p){return p.name==="上海";})||{n:0}).n)} 辆，其中 {fmt(DN.NATIONAL.pilotN)} 辆纳入深度评分试点（12 特征全量）。
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 平台月度脉搏（季节性双卡）---------- */
function SeasonalityCards(){
  const M = DN.PLATFORM_MONTHLY;
  const labels = M.map(r => r.label);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
      <Card title="接入规模增长" sub="月末累计接入车辆 · 近 12 个月">
        <GrowthBars />
        <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:6 }}>Q4 新车型批量上量 · 2 月春节交付放缓 · 5 月达 128.6 万</div>
      </Card>
      <Card title="单车月均里程 · 季节性" sub="km / 车·月 · 春节低谷与长假峰值清晰可辨">
        <MonthLines labels={labels} yMax={1700}
          series={[{ color:"var(--accent)", data:M.map(r => r.km), fill:true, unit:" km/车" }]}
          annotate={[{ i:8, t:"春节 2/17", anchor:"end", dx:-4 }, { i:4, t:"国庆长途" }]} />
        <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:6 }}>2 月通勤坍缩至 960 km；10 月长途出行推高至 1,530 km — 暴露度随季节迁移，定价窗口随之滚动</div>
      </Card>
    </div>
  );
}

Object.assign(window, { ChinaMap, NationalMapCard, MonthLines, GrowthBars, SeasonalityCards });
