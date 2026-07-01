/* ============================================================================
   驾驶人变化监测 — 行为漂移检测（夜间/里程/路线随机性/急减速突变）
   v2 · 漂移指数主线（偏离自身 12 周基线的综合幅度）+ 四维信号副图
        + 选中车辆「处置建议 / 一键动作」+ 含迷你走势的预警名单
   ============================================================================ */
const DM = window.DATA;
const { useState: useStateM, useMemo: useMemoM } = React;

const SIGNALS = [
  { key:"mileage", label:"里程强度",   color:"#ED1C24" },
  { key:"night",   label:"夜间占比",   color:"#8A5CD0" },
  { key:"entropy", label:"路线随机性", color:"#E1A300" },
  { key:"accel",   label:"急减速强度", color:"#2E9CCB" }
];
const KIND_META = {
  onset:  { t:"疑似转营运 / 换驾驶人", c:"var(--band-crit)" },
  driver: { t:"疑似更换驾驶人",        c:"var(--band-high)" },
  exit:   { t:"营运回落 · 用途回归",   c:"var(--band-low)" },
  stable: { t:"行为稳定",              c:"var(--ink-3)" }
};
const L1_TH = 40, L2_TH = 70;   // 与 data 模型一致：drift≥40 关注 / ≥70 预警

const meanA = a => a.reduce((s,x)=>s+x,0)/a.length;
const sigDelta = arr => Math.round(meanA(arr.slice(8)) - meanA(arr.slice(0,4)));
const sigBase  = arr => Math.round(meanA(arr.slice(0,4)));

/* 漂移指数序列：每周四维信号偏离各自 12 周前基线的绝对幅度之和 → 0..~150 */
function driftIndexOf(drift){
  const base = {}; SIGNALS.forEach(s=>{ base[s.key] = meanA(drift.series[s.key].slice(0,4)); });
  const N = drift.series.mileage.length, out = [];
  for(let t=0;t<N;t++){ let s=0; SIGNALS.forEach(g=>{ s += Math.abs(drift.series[g.key][t] - base[g.key]); }); out.push(Math.round(s)); }
  return out;
}

/* 处置策略（按漂移类型）—— 决定一键动作与优先级 */
const ACTIONS = {
  onset:  { pri:"触发重新核保 · 上浮系数", sec:["安排实地核查","告知如实告知义务"], prio:"高",  pc:"var(--band-crit)", dispatch:"重新核保工单已派发 · 待核保" },
  driver: { pri:"核实主要驾驶人变更",       sec:["更新风险画像","标记持续观察"],   prio:"中",  pc:"var(--band-high)", dispatch:"核实任务已派发 · 待回访" },
  exit:   { pri:"续保下调系数",            sec:["纳入优质转化","标记持续观察"],   prio:"低",  pc:"var(--band-low)",  dispatch:"已纳入优质转化池" },
  stable: { pri:"维持常规承保",            sec:["纳入稳定档"],                   prio:"常规", pc:"var(--ink-3)",     dispatch:"已确认 · 维持常规" }
};

/* ───────────────────────── 漂移指数主线（hero）───────────────────────── */
function DriftIndexChart({ idx, cp, level, w = 580, h = 236 }){
  const [hi, setHi] = useStateM(null);
  const padL = 38, padR = 18, padT = 18, padB = 28;
  const iw = w-padL-padR, ih = h-padT-padB, N = idx.length;
  const maxV = Math.max(90, Math.ceil((Math.max(...idx)+14)/10)*10);
  const X = i => padL + (i/(N-1))*iw;
  const Y = v => padT + ih - (v/maxV)*ih;
  const lineCol = level===2?"var(--band-crit)":level===1?"var(--band-high)":"var(--ink-3)";
  const path = idx.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" ");
  const area = path+` L ${X(N-1).toFixed(1)} ${(padT+ih).toFixed(1)} L ${X(0).toFixed(1)} ${(padT+ih).toFixed(1)} Z`;
  const gid = useMemoM(()=>"di"+Math.random().toString(36).slice(2,7),[]);
  const colW = iw/(N-1);
  const labels = []; for(let i=0;i<N;i++) labels.push(i===N-1?"本周":"W-"+(N-1-i));
  const thresholds = [{ v:L1_TH, c:"var(--band-high)", t:"L1 关注" }, { v:L2_TH, c:"var(--band-crit)", t:"L2 预警" }];
  const tipLeft = hi==null ? 0 : Math.max(10, Math.min(90, X(hi)/w*100));
  return (
    <div style={{ position:"relative" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display:"block", overflow:"visible" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lineCol} stopOpacity="0.20" /><stop offset="1" stopColor={lineCol} stopOpacity="0" />
        </linearGradient></defs>
        {/* 0 基线 + 顶线 */}
        <line x1={padL} y1={Y(0)} x2={w-padR} y2={Y(0)} stroke="var(--border)" strokeWidth="1.2" />
        <text x={padL-7} y={Y(0)+3} fontSize="9.5" fill="var(--ink-3)" textAnchor="end">0</text>
        <text x={padL-7} y={Y(maxV)+3} fontSize="9.5" fill="var(--ink-3)" textAnchor="end">{maxV}</text>
        {/* L1 / L2 阈值带 */}
        {thresholds.map(th => th.v<maxV && (
          <g key={th.v}>
            <line x1={padL} y1={Y(th.v)} x2={w-padR} y2={Y(th.v)} stroke={th.c} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.55" />
            <text x={w-padR} y={Y(th.v)-5} fontSize="9.5" fontWeight="800" fill={th.c} textAnchor="end" opacity="0.95">{th.t} · {th.v}</text>
          </g>
        ))}
        {/* 变点 */}
        {cp>=0 && (
          <g>
            <rect x={X(cp)} y={padT} width={w-padR-X(cp)} height={ih} fill="var(--accent)" opacity="0.05" />
            <line x1={X(cp)} y1={padT} x2={X(cp)} y2={padT+ih} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="4 3" />
            <text x={X(cp)+5} y={padT+9} fontSize="10" fontWeight="800" fill="var(--accent)">变点 · 第{cp+1}周</text>
          </g>
        )}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={lineCol} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {hi!=null && <line x1={X(hi)} y1={padT} x2={X(hi)} y2={padT+ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
        {idx.map((v,i)=> <circle key={i} cx={X(i)} cy={Y(v)} r={hi===i?4.6:(i===N-1?3.6:0)} fill={lineCol} stroke="var(--surface)" strokeWidth="1.4" style={{ transition:"r .12s" }} />)}
        {labels.map((l,i)=> (i%2===1||i===N-1) ? <text key={i} x={X(i)} y={h-7} fontSize="9.5" fill={hi===i?"var(--ink)":"var(--ink-3)"} fontWeight={hi===i?800:400} textAnchor="middle">{l}</text> : null)}
        {idx.map((v,i)=> <rect key={"hz"+i} x={X(i)-colW/2} y={0} width={colW} height={h} fill="transparent" onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(null)} style={{ cursor:"crosshair" }} />)}
      </svg>
      {hi!=null && (
        <div style={{ position:"absolute", left:tipLeft+"%", top:6, transform:"translate(-50%,-100%)",
          background:"var(--ink)", color:"var(--bg)", borderRadius:8, padding:"6px 10px", whiteSpace:"nowrap",
          fontSize:11.5, fontWeight:700, boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:5 }}>
          {labels[hi]} · 漂移指数 {idx[hi]}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── 单信号迷你走势（含基线参考）───────────────────────── */
function SignalSpark({ arr, color, w = 150, h = 40 }){
  const padT = 5, padB = 5, ih = h-padT-padB, N = arr.length;
  const base = meanA(arr.slice(0,4));
  const X = i => (i/(N-1))*w;
  const Y = v => padT + ih - (v/100)*ih;
  const line = arr.map((v,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:"block", overflow:"visible" }}>
      <line x1="0" y1={Y(base)} x2={w} y2={Y(base)} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(N-1)} cy={Y(arr[N-1])} r="2.8" fill={color} />
    </svg>
  );
}

function SignalTile({ sig, arr, moved }){
  const d = sigDelta(arr), base = sigBase(arr), cur = arr[arr.length-1];
  const hot = Math.abs(d) >= 15;
  const dc = hot ? (d>0?"var(--band-crit)":"var(--band-low)") : "var(--ink-3)";
  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:10, padding:"11px 12px 9px",
      background: moved ? "color-mix(in srgb, "+sig.color+" 5%, var(--surface))" : "var(--surface)",
      display:"flex", flexDirection:"column", gap:6, minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap" }}>
          <span style={{ width:9, height:9, borderRadius:3, background:sig.color, flex:"0 0 auto" }} />{sig.label}
        </span>
        <b style={{ fontSize:13, color:dc, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{d>0?"▲ +":d<0?"▼ ":"– "}{d!==0?Math.abs(d):0}</b>
      </div>
      <SignalSpark arr={arr} color={sig.color} />
      <div style={{ fontSize:10.5, color:"var(--ink-3)", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
        基线 {base} → 现 <b style={{ color:"var(--ink-2)" }}>{cur}</b>
      </div>
    </div>
  );
}

/* ───────────────────────── 主屏 ───────────────────────── */
function DriverMonScreen({ onOpenVehicle }){
  const fleet = DM.FLEET;
  const alerts = useMemoM(()=> [...fleet].sort((a,b)=> (b.drift.level-a.drift.level)||(b.drift.drift-a.drift.drift)), []);
  const idxCache = useMemoM(()=>{ const m={}; fleet.forEach(v=>{ m[v.id]=driftIndexOf(v.drift); }); return m; }, []);
  const l2 = fleet.filter(v=>v.drift.level===2).length;
  const l1 = fleet.filter(v=>v.drift.level===1).length;
  const kinds = { onset:0, driver:0, exit:0, stable:0 }; fleet.forEach(v=>{ kinds[v.drift.kind]=(kinds[v.drift.kind]||0)+1; });
  const [selId, setSelId] = useStateM(alerts[0].id);
  const [handled, setHandled] = useStateM({});
  const [lvlF, setLvlF] = useStateM("all");
  const [kindF, setKindF] = useStateM("all");
  const [q, setQ] = useStateM("");
  const [shown, setShown] = useStateM(13);
  const resetShown = ()=>setShown(13);
  const sel = fleet.find(v=>v.id===selId) || alerts[0];
  const km = KIND_META[sel.drift.kind] || KIND_META.stable;
  const act = ACTIONS[sel.drift.kind] || ACTIONS.stable;
  const selIdx = idxCache[sel.id];
  const movedSet = new Set(sel.drift.moved);
  const movedChips = sel.drift.moved.map(k=>{ const s=SIGNALS.find(g=>g.key===k); return { label:s.label, color:s.color, d:sigDelta(sel.drift.series[k]) }; });
  const drifted = alerts.filter(v=>v.drift.level>0);
  const filtered = drifted.filter(v=>{
    if(lvlF==="l2" && v.drift.level!==2) return false;
    if(lvlF==="l1" && v.drift.level!==1) return false;
    if(kindF!=="all" && v.drift.kind!==kindF) return false;
    if(q){ const s=(v.plate+" "+v.brand+" "+v.series+" "+v.usageLabel).toLowerCase(); if(!s.includes(q.toLowerCase())) return false; }
    return true;
  });
  const listView = filtered.slice(0, shown);

  const kpiSpark = (end)=>{ const a=[]; for(let i=0;i<8;i++){ const f=i/7; a.push(Math.max(0, Math.round(end*(0.6+0.4*f) + Math.sin(i*1.7)*end*0.05))); } a[7]=end; return a; };
  const sparkL2 = useMemoM(()=>kpiSpark(l2), [l2]);
  const sparkL1 = useMemoM(()=>kpiSpark(l1), [l1]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>

      {/* ① KPI 概览 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--gap)" }}>
        <KPI label="行为指纹监测车辆" value={fmt(DM.INSURERS.find(o=>o.key==="xinan").n)} unit="辆" sub="鑫安在保 · 4 维行为指纹逐周比对" />
        <KPI label="漂移预警 L2" value={l2} unit="辆" accent sub="疑似换驾驶人 / 转营运 · 优先处置" spark={sparkL2} sparkColor="var(--band-crit)" />
        <KPI label="漂移关注 L1" value={l1} unit="辆" sub="行为偏移，持续观察" spark={sparkL1} sparkColor="var(--band-high)" />
        <KPI label="疑似转营运 / 换人" value={kinds.onset} unit="辆" sub="最高优先级漂移类别" />
      </div>

      {/* ② 漂移类型分布 */}
      <div className="card" style={{ padding:"13px 18px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
        <span style={{ fontSize:13, fontWeight:800, color:"var(--ink)", whiteSpace:"nowrap" }}>漂移类型分布</span>
        <div style={{ flex:1, display:"flex", height:13, borderRadius:7, overflow:"hidden", minWidth:220, background:"var(--surface-2)" }}>
          {[["stable","var(--ink-3)"],["exit","var(--band-low)"],["driver","var(--band-high)"],["onset","var(--band-crit)"]].map(([k,c])=>{
            const w=(kinds[k]||0)/(fleet.length||1)*100; if(!w) return null;
            return <div key={k} title={k+" "+(kinds[k]||0)} style={{ width:w+"%", background:c }} />;
          })}
        </div>
        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
          {[["onset","var(--band-crit)","转营运/换人"],["driver","var(--band-high)","换驾驶人"],["exit","var(--band-low)","营运回落"],["stable","var(--ink-3)","稳定"]].map(([k,c,l])=>(
            <span key={k} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, color:"var(--ink-2)" }}>
              <span style={{ width:9, height:9, borderRadius:3, background:c }} />{l} <b style={{ color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{kinds[k]||0}</b>
            </span>
          ))}
        </div>
      </div>

      {/* ③ 漂移诊断（左：指数主线 + 四信号副图） / 处置（右：建议 + 一键动作） */}
      <div style={{ display:"grid", gridTemplateColumns:"1.62fr 1fr", gap:"var(--gap)", alignItems:"stretch" }}>

        <Card title="行为漂移诊断 · 12 周" sub={sel.plate + " · " + sel.brand + " " + sel.series + " · " + sel.usageLabel} right={
          <span style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, fontWeight:800, color:"#fff", background:km.c, borderRadius:6, padding:"4px 10px", whiteSpace:"nowrap" }}>{km.t}</span>
          </span>
        }>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4 }}>
            <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>漂移指数</span>
            <span style={{ fontSize:11.5, color:"var(--ink-3)" }}>四维行为指纹偏离自身基线的综合幅度</span>
            <span style={{ marginLeft:"auto", fontSize:12, color:"var(--ink-3)" }}>当前 <b style={{ fontSize:18, color:sel.drift.level===2?"var(--band-crit)":sel.drift.level===1?"var(--band-high)":"var(--ink-2)", fontVariantNumeric:"tabular-nums" }}>{sel.drift.drift}</b></span>
          </div>
          <DriftIndexChart idx={selIdx} cp={sel.drift.cp} level={sel.drift.level} />

          <div style={{ fontSize:13, fontWeight:800, color:"var(--ink)", margin:"16px 0 9px" }}>四维行为指纹 · 副图</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(132px,1fr))", gap:10 }}>
            {SIGNALS.map(s=> <SignalTile key={s.key} sig={s} arr={sel.drift.series[s.key]} moved={movedSet.has(s.key)} />)}
          </div>
          <div style={{ fontSize:11, color:"var(--ink-3)", lineHeight:1.55, marginTop:13, borderTop:"1px solid var(--border)", paddingTop:11 }}>
            漂移指数 = 四维偏离 12 周前基线的幅度之和；<b style={{ color:"var(--band-high)" }}>≥{L1_TH} 关注 (L1)</b> · <b style={{ color:"var(--band-crit)" }}>≥{L2_TH} 预警 (L2)</b>。多信号在同一周同步阶跃 → 标记变点，判定漂移类型。
          </div>
        </Card>

        {/* 处置建议 + 一键动作 */}
        <Card title="处置建议" sub="选中车辆 · 一键动作" right={
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:11, fontWeight:800, color:act.pc, border:"1px solid "+act.pc, borderRadius:6, padding:"3px 9px", whiteSpace:"nowrap" }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:act.pc }} />优先级 {act.prio}
          </span>
        }>
          <div style={{ display:"flex", flexDirection:"column", gap:13, height:"100%" }}>
            {/* 现象 */}
            <div style={{ borderLeft:"4px solid "+km.c, paddingLeft:12 }}>
              <div style={{ fontSize:13.5, color:"var(--ink)", lineHeight:1.55, fontWeight:600 }}>{sel.drift.reason}。</div>
            </div>

            {/* 偏移信号 chips */}
            <div>
              <div style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:700, marginBottom:7 }}>主要偏移信号</div>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                {movedChips.length ? movedChips.map(c=>(
                  <span key={c.label} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, color:"var(--ink-2)",
                    background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:7, padding:"4px 9px" }}>
                    <span style={{ width:8, height:8, borderRadius:3, background:c.color }} />{c.label}
                    <b style={{ color:c.d>0?"var(--band-crit)":"var(--band-low)", fontVariantNumeric:"tabular-nums" }}>{c.d>0?"+":""}{c.d}</b>
                  </span>
                )) : <span style={{ fontSize:12, color:"var(--ink-3)" }}>无显著信号偏移</span>}
              </div>
            </div>

            {/* 关键指标 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, background:"var(--surface-2)", borderRadius:10, padding:"11px 13px" }}>
              {[["当前风险分", sel.score, sel.band.hex],["漂移幅度", sel.drift.drift, "var(--ink)"],["变点", sel.drift.cp>=0?("第"+(sel.drift.cp+1)+"周"):"无", "var(--ink)"]].map(([l,v,c])=>(
                <div key={l}>
                  <div style={{ fontSize:11, color:"var(--ink-3)", marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:19, fontWeight:800, color:c, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* 一键动作 */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:"auto" }}>
              {handled[sel.id] ? (
                <div style={{ display:"flex", alignItems:"center", gap:9, background:"color-mix(in srgb,"+act.pc+" 12%, var(--surface))", border:"1px solid "+act.pc, borderRadius:9, padding:"11px 13px" }}>
                  <span style={{ width:20, height:20, borderRadius:"50%", background:act.pc, color:"#fff", display:"grid", placeItems:"center", fontSize:13, fontWeight:900, flex:"0 0 auto" }}>✓</span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink)" }}>{act.dispatch}</span>
                  <button onClick={()=>setHandled(h=>{ const n={...h}; delete n[sel.id]; return n; })} style={{ marginLeft:"auto", border:"none", background:"transparent", color:"var(--ink-3)", fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>撤销</button>
                </div>
              ) : (
                <button onClick={()=>setHandled(h=>({...h, [sel.id]:1}))} style={{ border:"none", background:act.pc, color:"#fff", fontWeight:800, fontSize:13.5, padding:"11px 14px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>{act.pri}</button>
              )}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {act.sec.map(s=>(
                  <button key={s} className="dl-btn" style={{ flex:"1 1 auto", justifyContent:"center" }}>{s}</button>
                ))}
              </div>
              <button onClick={()=>onOpenVehicle(sel.id)} style={{ border:"none", background:"transparent", color:"var(--accent)", fontWeight:800, fontSize:12.5, padding:"4px 0 0", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>进入车辆详情 →</button>
            </div>
          </div>
        </Card>
      </div>

      {/* ④ 行为漂移预警名单 */}
      <Card title="行为漂移预警名单" sub="按漂移幅度排序 · 可筛选 / 搜索 · 点击查看完整指纹" right={
        <span style={{ fontSize:12, color:"var(--ink-3)" }}>共 <b style={{ color:"var(--ink)" }}>{l1+l2}</b> 辆出现漂移 · 筛选后 <b style={{ color:"var(--ink)" }}>{filtered.length}</b> · 显示 {listView.length}</span>
      }>
        {/* 筛选工具条 */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:13 }}>
          <div style={{ display:"flex", gap:3, background:"var(--surface-2)", padding:4, borderRadius:9, border:"1px solid var(--border)" }}>
            {[["all","全部",l1+l2],["l2","L2 预警",l2],["l1","L1 关注",l1]].map(([k,l,c])=>(
              <button key={k} onClick={()=>{ setLvlF(k); resetShown(); }} style={{ border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, padding:"5px 12px", borderRadius:6, fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6,
                background: lvlF===k?"var(--surface)":"transparent", color: lvlF===k?"var(--ink)":"var(--ink-3)", boxShadow: lvlF===k?"0 1px 2px rgba(0,0,0,.08)":"none" }}>
                {l} <span style={{ fontSize:11, color:"var(--ink-3)", fontVariantNumeric:"tabular-nums" }}>{c}</span>
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:3, background:"var(--surface-2)", padding:4, borderRadius:9, border:"1px solid var(--border)", flexWrap:"wrap" }}>
            {[["all","全部类型"],["onset","转营运/换人"],["driver","换驾驶人"],["exit","营运回落"]].map(([k,l])=>(
              <button key={k} onClick={()=>{ setKindF(k); resetShown(); }} style={{ border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700, padding:"5px 11px", borderRadius:6, fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6,
                background: kindF===k?"var(--surface)":"transparent", color: kindF===k?"var(--ink)":"var(--ink-3)", boxShadow: kindF===k?"0 1px 2px rgba(0,0,0,.08)":"none" }}>
                {k!=="all" && <span style={{ width:8, height:8, borderRadius:"50%", background:(KIND_META[k]||KIND_META.stable).c, flex:"0 0 auto" }} />}{l}
              </button>
            ))}
          </div>
          <div style={{ position:"relative", flex:"0 0 auto" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
            <input value={q} onChange={e=>{ setQ(e.target.value); resetShown(); }} placeholder="搜索车牌 / 车型…"
              style={{ width:190, height:34, padding:"0 12px 0 32px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink)", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums", minWidth:880 }}>
            <thead>
              <tr style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:700, textAlign:"left", letterSpacing:".02em" }}>
                <th style={{ padding:"4px 12px 10px" }}>车牌 / 车型</th>
                <th style={{ padding:"4px 12px 10px" }}>漂移类型</th>
                <th style={{ padding:"4px 12px 10px", width:120 }}>近 12 周走势</th>
                <th style={{ padding:"4px 12px 10px" }}>变化信号</th>
                <th style={{ padding:"4px 12px 10px", textAlign:"center" }}>变点</th>
                <th style={{ padding:"4px 12px 10px", textAlign:"right" }}>漂移幅度</th>
                <th style={{ padding:"4px 12px 10px", textAlign:"right" }}>风险分</th>
                <th style={{ padding:"4px 12px 10px", textAlign:"center" }}>等级</th>
              </tr>
            </thead>
            <tbody>
              {listView.map(v=>{
                const k = KIND_META[v.drift.kind] || KIND_META.stable;
                const on = v.id===selId;
                const lvlCol = v.drift.level===2?"var(--band-crit)":v.drift.level===1?"var(--band-high)":"var(--ink-3)";
                const movedTxt = v.drift.moved.map(m=>({mileage:"里程",night:"夜间",entropy:"路线",accel:"急减速"}[m])).join(" · ") || "—";
                return (
                  <tr key={v.id} onClick={()=>setSelId(v.id)} className="row-hover"
                    style={{ cursor:"pointer", borderTop:"1px solid var(--border)", background: on?"var(--accent-soft)":"transparent", boxShadow: on?"inset 3px 0 0 var(--accent)":"none" }}>
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{v.plate}</div>
                      <div style={{ fontSize:11.5, color:"var(--ink-3)" }}>{v.brand} · {v.series} · {v.usageLabel}</div>
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12.5, color:"var(--ink-2)", fontWeight:600, whiteSpace:"nowrap" }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:k.c, flex:"0 0 auto" }} />{k.t}</span>
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ width:104 }}><Sparkline data={idxCache[v.id]} w={104} h={30} color={lvlCol} fill={false} /></div>
                    </td>
                    <td style={{ padding:"9px 12px", fontSize:12, color:"var(--ink-3)", whiteSpace:"nowrap" }}>{movedTxt}</td>
                    <td style={{ padding:"9px 12px", textAlign:"center" }}>
                      {v.drift.cp>=0
                        ? <span style={{ fontSize:11.5, fontWeight:700, color:"var(--ink-2)", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>第 {v.drift.cp+1} 周</span>
                        : <span style={{ fontSize:12, color:"var(--ink-3)" }}>—</span>}
                    </td>
                    <td style={{ padding:"9px 12px", textAlign:"right" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                        <div style={{ width:46, height:6, borderRadius:3, background:"var(--surface-2)", overflow:"hidden" }}>
                          <div style={{ width:Math.min(100,v.drift.drift)+"%", height:"100%", background:lvlCol }} />
                        </div>
                        <b style={{ fontSize:13, color:"var(--ink)" }}>{v.drift.drift}</b>
                      </span>
                    </td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontSize:16, fontWeight:800, color:v.band.hex }}>{v.score}</td>
                    <td style={{ padding:"9px 12px", textAlign:"center" }}>
                      <span style={{ fontSize:11, fontWeight:800, color: v.drift.level>0?"#fff":"var(--ink-3)", background: v.drift.level===2?"var(--band-crit)":v.drift.level===1?"var(--band-high)":"transparent", border: v.drift.level>0?"none":"1px solid var(--border)", borderRadius:6, padding:"3px 9px", whiteSpace:"nowrap" }}>{v.drift.level===2?"L2":v.drift.level===1?"L1":"稳定"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && (
          <div style={{ padding:"26px 0", textAlign:"center", fontSize:13, color:"var(--ink-3)" }}>无匹配车辆 · 调整筛选或搜索条件</div>
        )}
        {filtered.length > listView.length && (
          <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:14 }}>
            <button onClick={()=>setShown(s=>s+25)} style={{ border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink)", fontSize:13, fontWeight:700, padding:"8px 16px", borderRadius:9, cursor:"pointer", fontFamily:"inherit" }}>显示更多（还有 {filtered.length-listView.length} 辆）</button>
            <button onClick={()=>setShown(filtered.length)} style={{ border:"none", background:"var(--accent-soft)", color:"var(--accent)", fontSize:13, fontWeight:800, padding:"8px 16px", borderRadius:9, cursor:"pointer", fontFamily:"inherit" }}>显示全部 {filtered.length} 辆</button>
          </div>
        )}
        {listView.length>13 && filtered.length<=listView.length && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:14 }}>
            <button onClick={resetShown} style={{ border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink-2)", fontSize:13, fontWeight:700, padding:"8px 16px", borderRadius:9, cursor:"pointer", fontFamily:"inherit" }}>收起</button>
          </div>
        )}
      </Card>
    </div>
  );
}
window.DriverMonScreen = DriverMonScreen;
