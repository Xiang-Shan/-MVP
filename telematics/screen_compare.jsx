/* ============================================================================
   实时推演 — 两辆车 A/B · 同一套 12 特征模型 · 5 维度对比 + 相对风险
   ============================================================================ */
const DC = window.DATA;
const { useState: useStateC, useEffect: useEffectC, useMemo: useMemoC } = React;

const CSLIDE = {};
DC.FEATURES12.forEach(f=>{ if(f.locked) return; const s=f.stat;
  const lo = f.pctv ? 0 : Math.max(0, Math.floor(s.min));
  const hi = f.pctv ? Math.min(1, +(s.max).toFixed(3)) : Math.ceil(s.max);
  const span = hi-lo||1;
  CSLIDE[f.key] = { lo, hi, step: f.pctv ? Math.max(0.001,+(span/300).toFixed(3)) : (f.key==="mileage"||f.key==="mileageStd"?10:+(span/200).toFixed(2)) };
});
const CURATED = ["mileage","night","speeding","fatigue","hardDecel"];

function CompactSlider({ f, value, onChange, accent }){
  const cfg = CSLIDE[f.key];
  const pct = ((value - cfg.lo)/(cfg.hi - cfg.lo))*100;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap" }}>{f.name}</span>
        <span style={{ fontSize:15.5, fontWeight:800, color:accent, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{f.fmt(value)}<span style={{ fontSize:10, color:"var(--ink-3)", fontWeight:600 }}>{f.unit?(" "+f.unit):""}</span></span>
      </div>
      <input type="range" min={cfg.lo} max={cfg.hi} step={cfg.step} value={value}
        onChange={e=>onChange(f.key, Number(e.target.value))} className="detail-slider" style={{ "--pct": pct+"%", "--track-accent":accent }} />
    </div>
  );
}

function CarColumn({ tag, color, vehicle, vals, onChange, onPick }){
  const ctx = { isEV:vehicle.isEV, isADAS:vehicle.isADAS, cv:vehicle.cv };
  const { score } = DC.computeScore12(vals, ctx);
  const band = DC.bandOf(score);
  return (
    <div className="card" style={{ padding:"var(--card-pad)", display:"flex", flexDirection:"column", gap:15, borderTop:`3px solid ${color}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ width:30, height:30, borderRadius:8, background:color, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:15, flex:"0 0 auto" }}>{tag}</span>
        <select value={vehicle.id} onChange={e=>onPick(e.target.value)} style={{ flex:1, height:36, borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink)", fontSize:13, fontWeight:700, padding:"0 10px", fontFamily:"inherit", cursor:"pointer", minWidth:0 }}>
          {DC.FLEET.slice().sort((a,b)=>b.score-a.score).map(v => <option key={v.id} value={v.id}>{v.plate} · {v.brand.replace("一汽","")} · {v.score}</option>)}
        </select>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Gauge score={score} size={150} />
        <div style={{ flex:1, textAlign:"center" }}>
          <ScoreText score={score} size={54} />
          <div style={{ marginTop:8 }}><RiskBadge band={band} size="sm" /></div>
          <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:7 }}>{vehicle.brand} · {vehicle.energy}</div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:13, borderTop:"1px solid var(--border)", paddingTop:14 }}>
        {CURATED.map(k => <CompactSlider key={k} f={DC.FEAT_OF[k]} value={vals[k]} onChange={onChange} accent={color} />)}
      </div>
    </div>
  );
}

function CompareScreen(){
  const hi = useMemoC(() => [...DC.FLEET].sort((a,b)=>b.score-a.score)[2], []);
  const lo = useMemoC(() => [...DC.FLEET].sort((a,b)=>a.score-b.score)[2], []);
  const [aId, setAId] = useStateC(hi.id);
  const [bId, setBId] = useStateC(lo.id);
  const vA = DC.FLEET.find(v=>v.id===aId), vB = DC.FLEET.find(v=>v.id===bId);
  const [valsA, setValsA] = useStateC(vA.f);
  const [valsB, setValsB] = useStateC(vB.f);
  useEffectC(()=>{ setValsA(DC.FLEET.find(v=>v.id===aId).f); }, [aId]);
  useEffectC(()=>{ setValsB(DC.FLEET.find(v=>v.id===bId).f); }, [bId]);

  const A_COL = "var(--accent)", B_COL = "#3C4A56";
  const ctxA = { isEV:vA.isEV, isADAS:vA.isADAS, cv:vA.cv };
  const ctxB = { isEV:vB.isEV, isADAS:vB.isADAS, cv:vB.cv };
  const scoreA = DC.computeScore12(valsA, ctxA).score, scoreB = DC.computeScore12(valsB, ctxB).score;
  const rr = DC.relativeRisk(scoreA, scoreB);

  // 5-dim axis values for A/B
  const dimVal = (v, vals, ctx, d) => {
    if(d.cond==="ev" && !ctx.isEV) return null;
    if(d.cond==="adas" && !ctx.isADAS) return null;
    if(d.key==="adas") return Math.round(DC.pctOf("autonomy", vals.autonomy));
    return DC.dimRisk(d.key, vals, ctx);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      <div className="card" style={{ padding:"var(--card-pad)", display:"flex", alignItems:"center", justifyContent:"center", gap:32, flexWrap:"wrap" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:12.5, color:"var(--ink-3)" }}>同一套 12 特征模型 · 两车相对风险</div>
          <div style={{ fontSize:16, fontWeight:800, color:"var(--ink)" }}>车 A 相对车 B</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:30, fontWeight:800, color: rr>=1.03?"var(--band-crit)":rr<=0.97?"var(--band-low)":"var(--ink-3)" }}>{rr>=1.03?"▲":rr<=0.97?"▼":"＝"}</span>
          <span style={{ fontSize:58, fontWeight:800, color: rr>=1.03?"var(--band-crit)":rr<=0.97?"var(--band-low)":"var(--ink-3)", fontVariantNumeric:"tabular-nums" }}>{rr.toFixed(2)}×</span>
        </div>
        <div style={{ fontSize:14, color:"var(--ink-2)", maxWidth:240 }}>
          {rr>=1.03 ? `车 A 事中相对风险约为车 B 的 ${rr.toFixed(2)} 倍（高 ${Math.round((rr-1)*100)}%）` :
           rr<=0.97 ? `车 A 事中相对风险约为车 B 的 ${rr.toFixed(2)} 倍（低 ${Math.round((1-rr)*100)}%）` : "两车相对风险相当"}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
        <CarColumn tag="A" color={A_COL} vehicle={vA} vals={valsA} onChange={(k,v)=>setValsA(p=>({...p,[k]:v}))} onPick={setAId} />
        <CarColumn tag="B" color={B_COL} vehicle={vB} vals={valsB} onChange={(k,v)=>setValsB(p=>({...p,[k]:v}))} onPick={setBId} />
      </div>

      <Card title="5 维度 · A vs B" sub="各维度风险 0–100 · 越长风险越高（智驾为使用度·保护因子）">
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {DC.DIMS.map(d => {
            const a = dimVal(vA, valsA, ctxA, d), b = dimVal(vB, valsB, ctxB, d);
            return (
              <div key={d.key}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13.5, fontWeight:700, color:"var(--ink)", marginBottom:7 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:7 }}><span style={{ width:9, height:9, borderRadius:3, background:d.color }} />{d.name} <span style={{ fontSize:11, color:"var(--ink-3)", fontWeight:700 }}>· 权重 {Math.round(d.w*100)}%</span></span>
                  <span style={{ fontSize:12.5, color:"var(--ink-3)", fontWeight:600 }}>A {a==null?"不适用":a} · B {b==null?"不适用":b}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5 }}>
                  <span style={{ width:22, fontSize:11, fontWeight:800, color:"#fff", textAlign:"center", borderRadius:4, background:A_COL, lineHeight:"18px" }}>A</span>
                  <div style={{ flex:1, height:14, background:"var(--surface-2)", borderRadius:4, overflow:"hidden" }}>{a!=null && <div style={{ width:a+"%", height:"100%", background:A_COL, transition:"width .25s" }} />}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ width:22, fontSize:11, fontWeight:800, color:"#fff", textAlign:"center", borderRadius:4, background:B_COL, lineHeight:"18px" }}>B</span>
                  <div style={{ flex:1, height:14, background:"var(--surface-2)", borderRadius:4, overflow:"hidden" }}>{b!=null && <div style={{ width:b+"%", height:"100%", background:B_COL, transition:"width .25s" }} />}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
window.CompareScreen = CompareScreen;
