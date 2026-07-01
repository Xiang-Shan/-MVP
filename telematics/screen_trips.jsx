/* ============================================================================
   行程与充电 Trips & Charging — 真实感上海底图 + 用途时序对比
   ============================================================================ */
const DT = window.DATA;
const { useState, useMemo } = React;

const KIND_TAG = {
  commute:{ t:"通勤", c:"var(--ink-3)" },
  transit:{ t:"机场/车站", c:"var(--band-high)" },
  family:{ t:"家庭", c:"var(--accent)" },
  leisure:{ t:"休闲", c:"var(--band-low)" },
  operate:{ t:"载客", c:"var(--accent)" }
};
const RIVER = "#3E78C8";

function tripPathStr(pts){
  if(pts.length < 3) return pts.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ");
  let d = "M"+pts[0].x.toFixed(2)+" "+pts[0].y.toFixed(2);
  for(let i=1;i<pts.length-1;i++){ const xc=(pts[i].x+pts[i+1].x)/2, yc=(pts[i].y+pts[i+1].y)/2; d+=` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${xc.toFixed(2)} ${yc.toFixed(2)}`; }
  const last=pts[pts.length-1]; d+=` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}

function ShanghaiMap({ trips, activeIdx, chargers, pois, home, kmPerUnit, activeCharger, ghost }){
  const active = trips[activeIdx];
  const scaleUnits = 5 / kmPerUnit;
  return (
    <svg viewBox="0 0 100 94" style={{ display:"block", width:"100%", borderRadius:12, border:"1px solid var(--border)", overflow:"hidden" }}>
      <SHBase />

      {/* all trips faint */}
      {trips.map((tp,i) => i!==activeIdx ? (
        <path key={"f"+i} d={tripPathStr(tp.path)} fill="none" stroke={ghost?"var(--band-crit)":"var(--ink-2)"} strokeWidth="0.55"
          strokeLinecap="round" strokeLinejoin="round" opacity={ghost?0.4:0.45} strokeDasharray={ghost?"1.2 0.8":null} />
      ) : null)}

      {/* POIs */}
      {pois.map((l,i)=>(
        <g key={"p"+i}>
          <circle cx={l.x} cy={l.y} r="0.65" fill="var(--ink-2)" />
          <text x={l.x+1.1} y={l.y+0.8} fontSize="2.0" fill="var(--ink)" fontWeight="700" paintOrder="stroke" stroke="var(--surface-2)" strokeWidth="0.55">{l.name}</text>
        </g>
      ))}

      {/* home marker */}
      <g>
        <circle cx={home.x} cy={home.y} r="1.6" fill="var(--ink)" stroke="var(--surface)" strokeWidth="0.4" />
        <text x={home.x} y={home.y+0.75} fontSize="1.9" fill="var(--surface)" textAnchor="middle" fontWeight="800">家</text>
      </g>

      {/* charging stations */}
      {chargers.map((c,i)=>{
        const on = activeCharger === c.name;
        const col = c.fast ? "var(--band-high)" : "var(--band-low)";
        return (
          <g key={"c"+i}>
            {on && <circle cx={c.x} cy={c.y} r="3.0" fill="none" stroke={col} strokeWidth="0.55" opacity="0.65" />}
            <rect x={c.x-1.3} y={c.y-1.3} width="2.6" height="2.6" rx="0.5" fill={col} stroke="var(--surface)" strokeWidth="0.4"
              transform={`rotate(45 ${c.x} ${c.y})`} />
            <text x={c.x} y={c.y+0.75} fontSize="1.8" fill="#fff" textAnchor="middle" fontWeight="800">⚡</text>
          </g>
        );
      })}

      {/* active trip bold */}
      <path d={tripPathStr(active.path)} fill="none" stroke="var(--surface)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d={tripPathStr(active.path)} fill="none" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <g>
        <circle cx={active.path[0].x} cy={active.path[0].y} r="1.9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.0" />
        <text x={active.path[0].x} y={active.path[0].y+0.8} fontSize="2.1" fill="var(--accent)" textAnchor="middle" fontWeight="800">起</text>
      </g>
      <g>
        <circle cx={active.path[active.path.length-1].x} cy={active.path[active.path.length-1].y} r="2.0" fill="var(--accent)" />
        <text x={active.path[active.path.length-1].x} y={active.path[active.path.length-1].y+0.8} fontSize="2.1" fill="#fff" textAnchor="middle" fontWeight="800">终</text>
      </g>

      {/* scale bar */}
      <g>
        <rect x="7.4" y="84.6" width={scaleUnits+3.2} height="4.6" rx="0.8" fill="var(--surface)" opacity="0.82" />
        <line x1="9" y1="88" x2={9+scaleUnits} y2="88" stroke="var(--ink-2)" strokeWidth="0.6" />
        <line x1="9" y1="86.8" x2="9" y2="89.2" stroke="var(--ink-2)" strokeWidth="0.6" />
        <line x1={9+scaleUnits} y1="86.8" x2={9+scaleUnits} y2="89.2" stroke="var(--ink-2)" strokeWidth="0.6" />
        <text x={9+scaleUnits/2} y="86.2" fontSize="2.0" fill="var(--ink-2)" textAnchor="middle" fontWeight="700">5 km</text>
      </g>
    </svg>
  );
}

/* 出行时段分布 (24h heat strip) — derived from trip labels */
function HourStrip({ trips }){
  const heat = Array.from({length:24}, ()=>0);
  trips.forEach(t => {
    const m = t.when.match(/(\d{1,2}):(\d{2})/);
    if(m){ const h = +m[1]; heat[h] += 1; const h2 = Math.min(23, h + Math.max(1, Math.round(t.dur/60))); heat[h2] += 0.5; }
  });
  const max = Math.max(...heat, 1);
  return (
    <div>
      <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:34 }}>
        {heat.map((v,i)=>(
          <div key={i} title={i+":00"} style={{ flex:1, height:Math.max(8, v/max*100)+"%", borderRadius:2,
            background: v>0 ? "var(--accent)" : "var(--surface-2)", opacity: v>0 ? 0.25+0.75*(v/max) : 1,
            border: v>0?"none":"1px solid var(--border)" }} />
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:"var(--ink-3)", marginTop:3 }}>
        <span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>24时</span>
      </div>
    </div>
  );
}

function EntropyMeter({ value }){
  const col = value>=0.65 ? "var(--band-crit)" : value>=0.4 ? "var(--band-mid)" : "var(--band-low)";
  const label = value>=0.65 ? "高度随机 · 典型营运特征" : value>=0.4 ? "中等 · 存在非通勤出行" : "低 · 规律通勤";
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>路线随机性指数</span>
        <b style={{ fontSize:20, color:col, fontVariantNumeric:"tabular-nums" }}>{value.toFixed(2)}</b>
      </div>
      <div style={{ height:8, borderRadius:4, background:"var(--surface-2)", border:"1px solid var(--border)", position:"relative" }}>
        <div style={{ position:"absolute", left:0, top:0, bottom:0, width:(value*100)+"%", borderRadius:4, background:`linear-gradient(90deg, var(--band-low), var(--band-mid), var(--band-crit))`, opacity:.85 }} />
        <div style={{ position:"absolute", left:`calc(${value*100}% - 5px)`, top:-3, width:10, height:14, borderRadius:3, background:"var(--surface)", border:`2px solid ${col}` }} />
      </div>
      <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:5 }}>{label} · 基于 OD 对重复率 + 时段离散度</div>
    </div>
  );
}

function TripsScreen(){
  /* 候选车辆：充电口径仅纯电有意义 → 本页聚焦纯电；按用途故事线排序 */
  const candidates = useMemo(() => {
    const order = ["rh_full","rh_part","priv","biz","family"];
    const ev = DT.FLEET.filter(v=>v.isEV);
    const pool = ev.length ? ev : DT.FLEET;
    const list = [];
    order.forEach(k => {
      const grp = pool.filter(v=>v.usageKey===k).sort((a,b)=>b.score-a.score);
      list.push(...grp.slice(0, k==="rh_full" ? 6 : 4));
    });
    return list.length ? list : pool.slice(0, 10);
  }, []);
  const [vid, setVid] = useState(candidates[0].id);
  const v = DT.FLEET.find(x=>x.id===vid);
  const [mode, setMode] = useState("now");
  const data = useMemo(() => DT.tripsFor(v, { mode: mode==="past" ? "past" : "now" }), [vid, mode]);
  const [tripIdx, setTripIdx] = useState(0);
  const trip = data.trips[Math.min(tripIdx, data.trips.length-1)];

  const totalHardAcc = data.trips.reduce((s,x)=>s+x.hardAcc,0);
  const crossCount = data.trips.filter(t=>t.crossed).length;
  const isExit = v.usageKey === "rh_exit";
  const entropy = mode==="past" ? 0.86 : v.routeEntropy;

  const switchV = (id) => { setVid(id); setTripIdx(0); setMode("now"); };
  const switchMode = (m) => { setMode(m); setTripIdx(0); };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1.45fr 1fr", gap:"var(--gap)", alignItems:"start" }}>
      {/* map */}
      <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      <Card pad={false}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"var(--card-pad)", paddingBottom:12, borderBottom:"1px solid var(--border)" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--ink)" }}>行程轨迹 · 上海 <span style={{ fontSize:12.5, fontWeight:700, color:"var(--accent)" }}>{data.periodLabel}</span></div>
            <div style={{ fontSize:12.5, color:"var(--ink-3)", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.usageLabel} · 家在{data.home.area} · 评分 <b style={{color:v.band.hex}}>{v.score}</b>（{v.band.label}）</div>
          </div>
          {isExit && (
            <div style={{ display:"flex", gap:0, border:"1px solid var(--border)", borderRadius:9, overflow:"hidden", flex:"0 0 auto" }}>
              {[["now","本周"],["past","8 周前"]].map(([k,l])=>(
                <button key={k} onClick={()=>switchMode(k)} style={{ border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12.5, fontWeight:700,
                  padding:"8px 13px", background: mode===k?"var(--accent)":"var(--surface)", color: mode===k?"#fff":"var(--ink-2)" }}>{l}</button>
              ))}
            </div>
          )}
          <select value={vid} onChange={e=>switchV(e.target.value)} style={{ height:36, borderRadius:8, border:"1px solid var(--border)",
            background:"var(--surface)", color:"var(--ink)", fontSize:13, fontWeight:700, padding:"0 10px", fontFamily:"inherit", cursor:"pointer", maxWidth:210, flex:"0 0 auto" }}>
            {candidates.map(c => <option key={c.id} value={c.id}>{c.plate} · {c.usageLabel}</option>)}
          </select>
        </div>
        <div style={{ padding:"var(--card-pad)" }}>
          {mode==="past" && (
            <div style={{ marginBottom:10, fontSize:12.5, fontWeight:700, color:"var(--band-crit)", background:"color-mix(in srgb, var(--band-crit) 9%, transparent)",
              border:"1px dashed var(--band-crit)", borderRadius:9, padding:"8px 13px" }}>
              时序回放 · 8 周前该车仍为全职网约：单日 10 段载客、跨区随机路线、月均约 2550km — 当时评分约 805（高风险）
            </div>
          )}
          <ShanghaiMap trips={data.trips} activeIdx={Math.min(tripIdx, data.trips.length-1)} chargers={data.chargers}
            pois={data.pois} home={data.home} kmPerUnit={data.kmPerUnit}
            activeCharger={data.sessions.find(s=>s.fast)?.charger} ghost={mode==="past"} />
          <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:13, fontSize:12.5, color:"var(--ink-2)" }}>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}><span style={{ width:18, height:3, background:"var(--accent)", borderRadius:2 }} />当前轨迹</span>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}><span style={{ width:18, height:2, background:"var(--ink-3)", borderRadius:2, opacity:.6 }} />其余行程</span>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}><span style={{ width:14, height:3, background:RIVER, borderRadius:2, opacity:.6 }} />黄浦江 / 苏州河</span>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}><span style={{ width:10, height:10, background:"var(--band-low)", borderRadius:2, transform:"rotate(45deg)" }} />慢充桩</span>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}><span style={{ width:10, height:10, background:"var(--band-high)", borderRadius:2, transform:"rotate(45deg)" }} />快充桩</span>
          </div>
        </div>
      </Card>

      <Card title="出行行为画像" sub="时段分布 + 路线随机性 — 用途识别的两个核心特征">
        <div style={{ display:"grid", gridTemplateColumns:"1.25fr 1fr", gap:22, alignItems:"start" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)", marginBottom:8 }}>出行时段分布 <span style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:500 }}>本展示窗口</span></div>
            <HourStrip trips={data.trips} />
            <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:8, lineHeight:1.5 }}>
              {v.usageKey==="rh_full" || mode==="past" ? "全天连续出行、无固定通勤峰 — 营运特征显著。" :
               v.usageKey==="rh_part" ? "早晚通勤峰之外叠加晚间 19–23 时载客时段 — 兼职营运特征。" :
               "集中于早晚高峰 — 规律通勤特征。"}
            </div>
          </div>
          <EntropyMeter value={entropy} />
        </div>
      </Card>
      </div>

      {/* side panel */}
      <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
          <KPI label="展示窗口轨迹" value={data.shownKm} unit="km" sub={data.trips.length + " 段 · " + crossCount + " 次过江 · 与里程口径校准"} />
          <KPI label="月均里程（评分口径）" value={fmt(data.monthlyKm)} unit="km" accent sub={"折合每周约 " + fmt(data.weeklyKm) + " km"} />
          <KPI label="急加速（窗口合计）" value={totalHardAcc} unit="次" sub={"全月口径 " + (mode==="past"?23:v.vals.acc) + " 次/百km"} sparkColor="var(--band-crit)" />
          <KPI label="快充占比（评分口径）" value={data.fastSessShare + "%"} sub={"近一周 " + data.sessions.length + " 次充电会话"} sparkColor="var(--band-high)" />
        </div>

        <Card title="行程明细" sub="点击查看对应轨迹">
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:296, overflowY:"auto" }}>
            {data.trips.map((tp,i) => {
              const tag = KIND_TAG[tp.kind] || KIND_TAG.commute;
              const on = Math.min(tripIdx, data.trips.length-1)===i;
              return (
                <button key={i} onClick={()=>setTripIdx(i)} style={{ textAlign:"left", border: on?"1px solid var(--accent)":"1px solid var(--border)",
                  background: on?"var(--accent-soft)":"var(--surface)", borderRadius:10, padding:"10px 13px", cursor:"pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      <span style={{ fontSize:13.5, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:"0 1 auto" }}>{tp.from} → {tp.to}</span>
                      <span style={{ fontSize:10.5, fontWeight:700, color:tag.c, background:"var(--surface-2)", border:"1px solid var(--border)", padding:"1px 7px", borderRadius:999, flex:"0 0 auto", whiteSpace:"nowrap" }}>{tag.t}</span>
                      {tp.crossed && <span style={{ fontSize:10.5, fontWeight:700, color:RIVER, background:"color-mix(in srgb, "+RIVER+" 13%, transparent)", padding:"1px 7px", borderRadius:999, flex:"0 0 auto", whiteSpace:"nowrap" }}>过江</span>}
                    </div>
                    <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tp.when} · {tp.dur}分钟</div>
                  </div>
                  <div style={{ textAlign:"right", flex:"0 0 auto" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{tp.dist} <span style={{ fontSize:11, color:"var(--ink-3)" }}>km</span></div>
                    <div style={{ fontSize:11, color: tp.hardAcc>=3?"var(--band-crit)":"var(--ink-3)", whiteSpace:"nowrap" }}>急加速 {tp.hardAcc} · 峰速 {tp.maxSpeed}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="充电会话" sub="充电桩 · 功率 · SOC 区间">
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {data.sessions.map((s,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 13px", border:"1px solid var(--border)", borderRadius:10, background:"var(--surface-2)" }}>
                <div style={{ width:34, height:34, borderRadius:8, display:"grid", placeItems:"center", flex:"0 0 auto",
                  background: s.fast?"color-mix(in srgb, var(--band-high) 16%, transparent)":"color-mix(in srgb, var(--band-low) 16%, transparent)",
                  color: s.fast?"var(--band-high)":"var(--band-low)", fontSize:16 }}>⚡</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:"var(--ink)" }}>{s.charger} <span style={{ fontSize:11.5, fontWeight:700, color: s.fast?"var(--band-high)":"var(--band-low)" }}>{s.kw}kW {s.fast?"快充":"慢充"}</span></div>
                  <div style={{ fontSize:11.5, color:"var(--ink-3)" }}>{s.when} · {s.soc} · {s.dur}分钟</div>
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{s.kwh}<span style={{ fontSize:10.5, color:"var(--ink-3)" }}>kWh</span></div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, color:"var(--ink-3)", marginTop:12, lineHeight:1.55, borderTop:"1px solid var(--border)", paddingTop:12 }}>
            评分使用<b style={{ color:"var(--ink-2)" }}>全月遥测数据</b>（月均 {fmt(data.monthlyKm)}km、快充 {data.fastSessShare}%）；本页轨迹与充电为代表性<b style={{ color:"var(--ink-2)" }}>节选窗口</b>，用于解释行为如何映射到 4 项风险指标。
          </div>
        </Card>
      </div>
    </div>
  );
}
window.TripsScreen = TripsScreen;
