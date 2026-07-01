/* ============================================================================
   共享可视化（v4）— 雷达 / 维度计 / 堆叠风险带 / 份额环 / 锁定特征位
   Exposes: Radar, DimMeter, StackBar, ShareDonut, LockTile, DeltaPill,
            BrandMark, FeatureRow, dimAxisVal
   依赖 window.DATA(D) 与 ui.jsx 的 Card/BandDot 等
   ============================================================================ */
const DS = window.DATA;
const { useState: useStateS } = React;

/* 维度轴值：返回风险指数 0–100（人机共驾已反向）；条件维度不适用返回 null */
function dimAxisVal(dimKey, v){
  const d = DS.DIM_OF[dimKey];
  if(d.cond === "ev" && !v.isEV) return null;
  if(d.cond === "adas" && !v.isADAS) return null;
  return v.dims[dimKey];
}

/* ---- 维度同心圆环（Apple Watch 风格）— 每环 = 一个维度子分 200–997，环越长风险越高 ---- */
function RiskRings({ dims, score, band, size = 260, centerLabel = "从车风险分", thickness, gap }){
  const [hi, setHi] = useStateS(null);
  const t = thickness || Math.max(11, Math.round(size*0.05));
  const g = gap != null ? gap : Math.max(5, Math.round(t*0.4));
  const cx = size/2, cy = size/2;
  const outerR = size/2 - t/2 - 2;
  const step = t + g;
  const frac = sub => sub==null ? 0 : Math.max(0, Math.min(1, (sub - 200)/(997 - 200)));
  const rOf = i => outerR - i*step;
  const innerR = Math.max(t, outerR - (dims.length-1)*step - t/2);
  const holeW = Math.max(44, innerR*2 - 8);
  const numF = Math.min(Math.round(size*0.155), Math.floor(holeW/1.8));
  const subF = Math.min(Math.round(size*0.145), Math.floor(holeW/1.9));
  const nameF = Math.min(Math.round(size*0.062), Math.floor(holeW/5.4));
  const labF = Math.max(9.5, Math.min(Math.round(size*0.046), Math.floor(holeW/5.4)));
  return (
    <div style={{ position:"relative", width:size, height:size, flex:"0 0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block", overflow:"visible" }}>
        {dims.map((d,i)=>{
          const r = rOf(i); if(r < t*0.55) return null;
          const C = 2*Math.PI*r;
          const na = d.na || d.sub==null;
          const f = frac(d.sub);
          const active = hi===i;
          return (
            <g key={d.key}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={na?"var(--ink-3)":d.color}
                strokeOpacity={na?0.35:0.15} strokeWidth={t} strokeDasharray={na?"1.5 6":undefined} strokeLinecap="round" />
              {!na && <circle cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={active?t+2.5:t}
                strokeLinecap="round" strokeDasharray={`${(f*C).toFixed(1)} ${C.toFixed(1)}`}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition:"stroke-dasharray .55s cubic-bezier(.34,1.2,.4,1), stroke-width .15s" }} />}
            </g>
          );
        })}
        {dims.map((d,i)=>{ const r=rOf(i); if(r<t*0.55) return null;
          return <circle key={"hit"+d.key} cx={cx} cy={cy} r={r} fill="none" stroke="transparent" strokeWidth={step}
            style={{ cursor:"pointer", pointerEvents:"stroke" }} onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(null)} />; })}
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none" }}>
        {hi==null ? (
          <div style={{ maxWidth:holeW }}>
            <div style={{ fontSize: numF, fontWeight:800, lineHeight:1, color: band?band.hex:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{score}</div>
            <div style={{ fontSize: labF, color:"var(--ink-3)", marginTop:4, fontWeight:600, whiteSpace:"nowrap" }}>{centerLabel}</div>
          </div>
        ) : (
          <div style={{ maxWidth:holeW }}>
            <div style={{ fontSize: nameF, fontWeight:800, color: dims[hi].color, lineHeight:1.15, whiteSpace:"nowrap" }}>{dims[hi].name}</div>
            <div style={{ fontSize: subF, fontWeight:800, lineHeight:1, marginTop:3, fontVariantNumeric:"tabular-nums",
              color: dims[hi].sub==null?"var(--ink-3)":DS.bandOf(dims[hi].sub).hex }}>{dims[hi].sub==null?"—":dims[hi].sub}</div>
            <div style={{ fontSize: Math.max(9,Math.round(size*0.04)), color:"var(--ink-3)", marginTop:3, whiteSpace:"nowrap" }}>权重 {Math.round(dims[hi].weight*100)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- 环图图例：维度·权重·子分(按等级上色) ---- */
function RingLegend({ dims }){
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      {dims.map(d=>{
        const na = d.na || d.sub==null;
        const col = na ? "var(--ink-3)" : DS.bandOf(d.sub).hex;
        return (
          <div key={d.key} style={{ display:"flex", alignItems:"center", gap:9 }}>
            <span style={{ width:11, height:11, borderRadius:3, background: na?"var(--ink-3)":d.color, flex:"0 0 auto" }} />
            <span style={{ fontSize:13.5, fontWeight:800, color: na?"var(--ink-3)":"var(--ink)", whiteSpace:"nowrap" }}>{d.name}</span>
            <span style={{ fontSize:11, color:"var(--ink-3)", fontWeight:700, whiteSpace:"nowrap" }}>权重 {Math.round(d.weight*100)}%</span>
            {d.protective && !na && <span style={{ fontSize:10, color:"#2A6FDB", fontWeight:800, border:"1px solid color-mix(in srgb,#2A6FDB 40%,transparent)", borderRadius:5, padding:"0 5px", whiteSpace:"nowrap" }}>保护</span>}
            <span style={{ marginLeft:"auto", fontSize:18, fontWeight:800, color:col, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{na ? (d.naLabel||"—") : d.sub}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- 多轴雷达 ---- */
function Radar({ axes, size = 300, rings = 4 }){
  const [hi, setHi] = useStateS(null);
  const cx = size/2, cy = size/2, R = size*0.32;
  const N = axes.length;
  const A = i => -Math.PI/2 + i*2*Math.PI/N;
  const P = (i, frac) => [ cx + Math.cos(A(i))*R*frac, cy + Math.sin(A(i))*R*frac ];
  const ptStr = (i, frac) => P(i, frac).map(n=>n.toFixed(1)).join(",");
  const valFrac = a => (a.value==null ? 0 : Math.max(0, Math.min(100, a.value)))/100;
  const polyStr = axes.map((a,i)=> ptStr(i, valFrac(a))).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block", overflow:"visible" }}>
      {/* rings */}
      {Array.from({length:rings}).map((_,k)=>{
        const f=(k+1)/rings;
        const pts = axes.map((_,i)=>ptStr(i,f)).join(" ");
        return <polygon key={k} points={pts} fill="none" stroke="var(--border)" strokeWidth="1"
          opacity={ (k+1)===rings ? 0.9 : 0.55 } />;
      })}
      {/* baseline 50 ring */}
      <polygon points={axes.map((_,i)=>ptStr(i,0.5)).join(" ")} fill="none" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      {/* spokes */}
      {axes.map((a,i)=>{
        const [x,y]=P(i,1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
      })}
      {/* value polygon */}
      <polygon points={polyStr} fill="var(--accent)" fillOpacity="0.14" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {/* vertices */}
      {axes.map((a,i)=>{
        if(a.value==null) return null;
        const [x,y]=P(i, valFrac(a));
        return <circle key={i} cx={x} cy={y} r={hi===i?5:3.4} fill={a.color||"var(--accent)"} stroke="var(--surface)" strokeWidth="1.5"
          onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(null)} style={{ cursor:"pointer" }} />;
      })}
      {/* labels */}
      {axes.map((a,i)=>{
        const [x,y]=P(i,1.18);
        const anchor = Math.abs(Math.cos(A(i)))<0.3 ? "middle" : (Math.cos(A(i))>0 ? "start" : "end");
        const na = a.value==null;
        return (
          <g key={i} style={{ cursor:"default" }} onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(null)}>
            <text x={x} y={y-3} fontSize="12.5" fontWeight="800" textAnchor={anchor}
              fill={na?"var(--ink-3)":"var(--ink)"}>{a.label}</text>
            <text x={x} y={y+12} fontSize="12" fontWeight="700" textAnchor={anchor}
              fill={na?"var(--ink-3)":(a.color||"var(--ink-2)")} style={{ fontVariantNumeric:"tabular-nums" }}>
              {na ? (a.naLabel||"不适用") : a.value}{a.protective && !na ? " ·保护" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---- 维度风险计（0–100 横条）---- */
function DimMeter({ label, value, color, weight, na, naLabel, sub, protective }){
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8 }}>
        <span style={{ display:"flex", alignItems:"center", gap:7, minWidth:0 }}>
          <span style={{ width:9, height:9, borderRadius:3, background: na?"var(--ink-3)":color, flex:"0 0 auto" }} />
          <span style={{ fontSize:13.5, fontWeight:800, color: na?"var(--ink-3)":"var(--ink)", whiteSpace:"nowrap" }}>{label}</span>
          {weight!=null && <span style={{ fontSize:11, color:"var(--ink-3)", fontWeight:700 }}>权重 {Math.round(weight*100)}%</span>}
          {protective && <span style={{ fontSize:10.5, color:"#2A6FDB", fontWeight:800, border:"1px solid color-mix(in srgb,#2A6FDB 40%,transparent)", borderRadius:5, padding:"0 5px" }}>保护因子</span>}
        </span>
        <span style={{ fontSize:15, fontWeight:800, color: na?"var(--ink-3)":color, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
          {na ? (naLabel||"不适用") : value}{na?"":""}</span>
      </div>
      <div style={{ height:8, borderRadius:5, background:"var(--surface-2)", overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", left:"50%", top:0, width:1, height:"100%", background:"var(--border)" }} />
        {!na && <div style={{ width:value+"%", height:"100%", background:color, borderRadius:5, transition:"width .3s ease" }} />}
      </div>
      {sub && <div style={{ fontSize:11.5, color:"var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

/* ---- 堆叠风险带（低/中/中高/高 比例条）---- */
function StackBar({ bands, height = 12, radius = 6, showPct = false }){
  const total = (bands.crit||0)+(bands.high||0)+(bands.mid||0)+(bands.low||0) || 1;
  const order = [["low","var(--band-low)"],["mid","var(--band-mid)"],["high","var(--band-high)"],["crit","var(--band-crit)"]];
  return (
    <div style={{ display:"flex", width:"100%", height, borderRadius:radius, overflow:"hidden", background:"var(--surface-2)" }}>
      {order.map(([k,c])=>{
        const f=(bands[k]||0)/total;
        if(f<=0) return null;
        return <div key={k} title={k+" "+Math.round(f*100)+"%"} style={{ width:(f*100)+"%", background:c, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {showPct && f>0.08 && <span style={{ fontSize:10, fontWeight:800, color:"#fff" }}>{Math.round(f*100)}</span>}
        </div>;
      })}
    </div>
  );
}

/* ---- 份额环（任意分片）---- */
function ShareDonut({ slices, size = 150, thickness = 22, centerBig, centerSmall, hoverable = true }){
  const [hi, setHi] = useStateS(null);
  const total = slices.reduce((s,x)=>s+x.value,0) || 1;
  const r=(size-thickness)/2, cx=size/2, cy=size/2, C=2*Math.PI*r;
  let acc=0;
  const cur = hi!=null ? slices[hi] : null;
  return (
    <div style={{ position:"relative", width:size, height:size, flex:"0 0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:"visible" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {slices.map((s,i)=>{
          const f=s.value/total; const dash=`${(f*C).toFixed(2)} ${C.toFixed(2)}`; const off=-acc*C; acc+=f;
          const active=hi===i;
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={active?thickness+6:thickness}
            strokeDasharray={dash} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`}
            opacity={hi!=null&&!active?0.35:1} style={{ transition:"opacity .15s, stroke-width .15s", cursor: hoverable?"pointer":"default" }}
            onMouseEnter={hoverable?()=>setHi(i):undefined} onMouseLeave={hoverable?()=>setHi(null):undefined} />;
        })}
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none" }}>
        <div>
          <div style={{ fontSize: size>150?22:19, fontWeight:800, color: cur?cur.color:"var(--ink)" }}>{cur?cur.label:centerBig}</div>
          <div style={{ fontSize:11, color:"var(--ink-3)" }}>{cur? (Math.round(cur.value/total*100)+"% · "+(cur.sub||"")) : centerSmall}</div>
        </div>
      </div>
    </div>
  );
}

/* ---- 锁定特征位（电池温度异常 · 待接入真实数据）---- */
function LockTile({ title, sub, note }){
  return (
    <div style={{ border:"1.5px dashed color-mix(in srgb, var(--accent) 45%, var(--border))", borderRadius:10,
      padding:"12px 14px", background:"color-mix(in srgb, var(--accent) 5%, var(--surface-2))", display:"flex", gap:12, alignItems:"flex-start" }}>
      <div style={{ width:30, height:30, borderRadius:8, flex:"0 0 auto", display:"grid", placeItems:"center",
        background:"color-mix(in srgb, var(--accent) 12%, transparent)", color:"var(--accent)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
      </div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{title}</span>
          <span style={{ fontSize:10.5, fontWeight:800, color:"var(--accent)", border:"1px solid color-mix(in srgb, var(--accent) 40%, transparent)", borderRadius:5, padding:"1px 6px" }}>待接入</span>
        </div>
        {sub && <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:2 }}>{sub}</div>}
        {note && <div style={{ fontSize:12, color:"var(--ink-2)", marginTop:6, lineHeight:1.5 }}>{note}</div>}
      </div>
    </div>
  );
}

/* ---- 涨跌药丸 ---- */
function DeltaPill({ delta, unit = "", up = "var(--band-crit)", down = "var(--band-low)", flat = "var(--ink-3)", invert = false }){
  const pos = delta > 0, neg = delta < 0;
  const col = delta===0 ? flat : (pos ? (invert?down:up) : (invert?up:down));
  return <span style={{ fontSize:12, fontWeight:800, color:col, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
    {delta>0?"▲":delta<0?"▼":"—"} {pos?"+":""}{delta}{unit}</span>;
}

/* ---- 品牌标记 ---- */
function BrandMark({ name, color, size = 26 }){
  const ch = name.replace("一汽","").slice(0,2);
  return <span style={{ width:size, height:size, borderRadius:7, background:color, color:"#fff",
    display:"grid", placeItems:"center", fontWeight:800, fontSize:size*0.42, flex:"0 0 auto", letterSpacing:"-.02em" }}>{ch}</span>;
}

Object.assign(window, { Radar, RiskRings, RingLegend, DimMeter, StackBar, ShareDonut, LockTile, DeltaPill, BrandMark, dimAxisVal });
