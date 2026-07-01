/* ============================================================================
   承保车辆 — 鑫安在保书 · 5 维画像 · 品牌/能源/等级筛选 · 漂移状态
   ============================================================================ */
const DF = window.DATA;
const { useState: useStateF, useMemo: useMemoF } = React;

function DimBars({ v, w = 84 }){
  return (
    <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:24, width:w }} title="用车强度 / 激进度 / 规律性 / 电池 / 人机共驾 · 越高越险">
      {DF.DIMS.map(d=>{
        const na = (d.cond==="ev"&&!v.isEV) || (d.cond==="adas"&&!v.isADAS);
        const val = na ? null : v.dims[d.key];
        return (
          <div key={d.key} style={{ flex:1, display:"flex", alignItems:"flex-end", height:"100%" }}>
            {na
              ? <div style={{ width:"100%", height:"14%", borderRadius:2, background:"var(--border)" }} />
              : <div style={{ width:"100%", height:Math.max(8, val)+"%", borderRadius:2, background:d.color, opacity: val>=60?0.95:0.6 }} />}
          </div>
        );
      })}
    </div>
  );
}

function FleetScreen({ onOpenVehicle }){
  const xinan = DF.INSURERS.find(o=>o.key==="xinan");
  const [q, setQ] = useStateF("");
  const [brand, setBrand] = useStateF("all");
  const [energy, setEnergy] = useStateF("all");
  const [band, setBand] = useStateF("all");
  const [sort, setSort] = useStateF({ key:"score", dir:"desc" });

  const brandOpts = useMemoF(()=>{ const s=[...new Set(DF.FLEET.map(v=>v.brand))]; return s; }, []);

  const rows = useMemoF(() => {
    let r = DF.FLEET.filter(v => {
      if(brand !== "all" && v.brand !== brand) return false;
      if(energy !== "all" && v.energy !== energy) return false;
      if(band !== "all" && v.band.key !== band) return false;
      if(q){ const s = (v.plate + v.brand + v.series + v.model + v.usageLabel).toLowerCase(); if(!s.includes(q.toLowerCase())) return false; }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    r = [...r].sort((a,b) => {
      switch(sort.key){
        case "score": return (a.score-b.score)*dir;
        case "mileage": return (a.f.mileage-b.f.mileage)*dir;
        case "drift": return (a.drift.drift-b.drift.drift)*dir;
        case "plate": return a.plate.localeCompare(b.plate)*dir;
        default: return (a.score-b.score)*dir;
      }
    });
    return r;
  }, [q, brand, energy, band, sort]);

  const Th = ({ k, children, align }) => {
    const active = sort.key === k;
    return (
      <th onClick={k ? () => setSort(s => ({ key:k, dir: s.key===k && s.dir==="desc" ? "asc" : "desc" })) : undefined}
        style={{ textAlign: align||"left", padding:"0 13px", height:40, fontSize:12, fontWeight:700, color: active?"var(--accent)":"var(--ink-2)",
          cursor: k?"pointer":"default", whiteSpace:"nowrap", userSelect:"none", position:"sticky", top:0, background:"var(--surface-2)", zIndex:1, borderBottom:"1px solid var(--border)" }}>
        {children}{k && <span style={{ marginLeft:4, opacity: active?1:.3 }}>{active ? (sort.dir==="desc"?"↓":"↑") : "↕"}</span>}
      </th>
    );
  };
  const Seg = ({ value, set, opts }) => (
    <div style={{ display:"flex", gap:3, background:"var(--surface-2)", padding:4, borderRadius:9, border:"1px solid var(--border)", flexWrap:"wrap" }}>
      {opts.map(o => (
        <button key={o.v} onClick={() => set(o.v)} style={{ border:"none", cursor:"pointer", fontSize:12.5, fontWeight:700,
          padding:"5px 11px", borderRadius:6, background: value===o.v ? "var(--surface)" : "transparent",
          color: value===o.v ? "var(--ink)" : "var(--ink-3)", boxShadow: value===o.v ? "0 1px 2px rgba(0,0,0,.08)" : "none",
          display:"flex", alignItems:"center", gap:6, fontFamily:"inherit" }}>
          {o.dot && <BandDot band={DF.BANDS.find(b=>b.key===o.v)} size={8} />}{o.l}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)", height:"100%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:"0 0 auto" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索车牌 / 品牌 / 车型…"
            style={{ width:220, height:38, padding:"0 12px 0 34px", borderRadius:9, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink)", fontSize:13.5, outline:"none", fontFamily:"inherit" }} />
        </div>
        <Seg value={brand} set={setBrand} opts={[{v:"all",l:"全部品牌"},...brandOpts.map(b=>({v:b,l:b.replace("一汽","")}))]} />
        <Seg value={energy} set={setEnergy} opts={[{v:"all",l:"全能源"},{v:"纯电",l:"纯电"},{v:"插电混合",l:"插混"},{v:"油电混合",l:"油混"},{v:"燃油",l:"燃油"}]} />
        <Seg value={band} set={setBand} opts={[{v:"all",l:"全部等级"},...DF.BANDS.map(b=>({v:b.key,l:b.label,dot:true}))]} />
        <div style={{ marginLeft:"auto", fontSize:13, color:"var(--ink-3)", whiteSpace:"nowrap" }}>鑫安在保 <b style={{ color:"var(--ink)" }}>{fmt(xinan.n)}</b> 辆 · 代表性样本 <b style={{ color:"var(--ink)" }}>{rows.length}</b></div>
      </div>

      <div className="card" style={{ padding:0, overflow:"auto", flex:1 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums" }}>
          <thead>
            <tr>
              <Th k="plate">车牌 / 车型</Th>
              <Th>用途</Th>
              <Th align="center">5 维画像</Th>
              <Th k="mileage" align="right">月均里程</Th>
              <Th align="center">智驾</Th>
              <Th k="drift" align="center">行为漂移</Th>
              <Th k="score" align="right">从车风险分</Th>
              <Th align="center">风险等级</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(v => {
              const dl = v.drift.level;
              const driftTag = dl===2 ? {t:"L2 预警",c:"var(--band-crit)"} : dl===1 ? {t:"L1 关注",c:"var(--band-high)"} : {t:"稳定",c:"var(--ink-3)"};
              return (
                <tr key={v.id} onClick={() => onOpenVehicle(v.id)} className="row-hover" style={{ cursor:"pointer", borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"10px 13px" }}>
                    <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{v.plate}</div>
                    <div style={{ fontSize:11.5, color:"var(--ink-3)" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><span style={{ width:7, height:7, borderRadius:"50%", background:v.brandColor }} />{v.brand} · {v.series} · {v.energy}</span>
                    </div>
                  </td>
                  <td style={{ padding:"10px 13px", fontSize:12.5, color:"var(--ink-2)" }}>{v.usageLabel}</td>
                  <td style={{ padding:"10px 13px" }}><div style={{ display:"flex", justifyContent:"center" }}><DimBars v={v} /></div></td>
                  <td style={{ padding:"10px 13px", textAlign:"right", fontSize:13.5, color:"var(--ink)", fontWeight:600 }}>{fmt(v.f.mileage)}<span style={{ fontSize:11, color:"var(--ink-3)" }}> km</span></td>
                  <td style={{ padding:"10px 13px", textAlign:"center", fontSize:12, color: v.isADAS?"var(--ink-2)":"var(--ink-3)" }}>{v.isADAS? (v.adas.share+"%") : "—"}</td>
                  <td style={{ padding:"10px 13px", textAlign:"center" }}>
                    <span style={{ fontSize:11, fontWeight:800, color: dl>0?"#fff":"var(--ink-3)", background: dl>0?driftTag.c:"transparent", border: dl>0?"none":"1px solid var(--border)", borderRadius:6, padding:"3px 8px", whiteSpace:"nowrap" }}>{driftTag.t}</span>
                  </td>
                  <td style={{ padding:"10px 13px", textAlign:"right" }}><span style={{ fontSize:20, fontWeight:800, color:v.band.hex }}>{v.score}</span></td>
                  <td style={{ padding:"10px 13px", textAlign:"center" }}><RiskBadge band={v.band} size="sm" /></td>
                  <td style={{ padding:"10px 13px", textAlign:"right", color:"var(--ink-3)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.FleetScreen = FleetScreen;
