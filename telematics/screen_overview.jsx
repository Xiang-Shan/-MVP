/* ============================================================================
   承保总览 — 鑫安在保书（Xinan book）· 风险分布 · 5 维度画像 · 重点关注
   ============================================================================ */
const DO = window.DATA;

function OverviewScreen({ t, onOpenVehicle }){
  const xinan = DO.INSURERS.find(o=>o.key==="xinan");
  const total = xinan.n;
  const bands = xinan.bands;
  const critPct = Math.round((bands.crit+bands.high)/total*100);
  const sample = DO.FLEET;

  // 在保组合 5 维平均画像（维度子分制 200–997）
  const dimAvg = DO.DIMS.map(d=>{
    const xs = sample.map(v => v.subs ? v.subs[d.key] : null).filter(x=>x!=null);
    return { dim:d, avg: xs.length ? Math.round(xs.reduce((s,x)=>s+x,0)/xs.length) : null, n:xs.length };
  });
  const ringDims = dimAvg.map(({dim,avg})=>({ key:dim.key, name:dim.name, color:dim.color, weight:dim.w, protective:dim.protective, sub:avg, na:avg==null }));
  const portScore = (function(){ let sw=0,acc=0; dimAvg.forEach(({dim,avg})=>{ if(avg!=null){ acc+=dim.w*avg; sw+=dim.w; } }); return sw? Math.round(acc/sw):xinan.avgScore; })();
  const portBand = DO.bandOf(portScore);

  // 在保品牌构成（样本）
  const brandMix = {};
  sample.forEach(v=>{ if(!brandMix[v.brand]) brandMix[v.brand]={n:0,sum:0,color:v.brandColor}; brandMix[v.brand].n++; brandMix[v.brand].sum+=v.score; });
  const brands = Object.entries(brandMix).map(([name,o])=>({ name, n:o.n, color:o.color, avg:Math.round(o.sum/o.n) })).sort((a,b)=>b.n-a.n);
  const bMax = Math.max(...brands.map(b=>b.n));

  // 评分趋势（锚定真实书均值）
  const trend = (function(){ const r=makeRngLocal(2026); const a=[]; let b=xinan.avgScore-9; for(let i=0;i<8;i++){ b+=Math.round((r()-0.42)*7); a.push(b); } a[7]=xinan.avgScore; return a; })();

  // 重点关注：漂移预警 + 高风险
  const watch = [...sample].sort((a,b)=> (b.drift.level-a.drift.level) || (b.drift.drift-a.drift.drift) || (b.score-a.score)).slice(0,6);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--gap)" }}>
        <KPI label="鑫安在保车辆" value={fmt(total)} unit="辆" accent sub="上海试点 · 集团关联险企" />
        <KPI label="在保平均评分" value={xinan.avgScore} unit="/ 997" sub="低于全市场基准 = 风险更优" spark={trend} />
        <KPI label="中高风险占比" value={critPct + "%"} sub={`${bands.crit+bands.high} 辆纳入事中监控`} sparkColor="var(--band-high)" />
        <KPI label="在保新能源占比" value={Math.round(xinan.nevShare*100) + "%"} sub="6 家最高 · 三电延保交叉销售" sparkColor="#0E8A6E" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"0.85fr 1.15fr", gap:"var(--gap)" }}>
        <Card title="风险等级分布" sub={`鑫安在保 ${fmt(total)} 辆`}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative" }}>
              <Donut counts={bands} size={150} />
              <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none" }}>
                <div><div style={{ fontSize:23, fontWeight:800, color:"var(--band-crit)" }}>{critPct}%</div><div style={{ fontSize:10.5, color:"var(--ink-3)" }}>中高风险</div></div>
              </div>
            </div>
            <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:5 }}>
              {DO.BANDS.map(b=>{ const n=bands[b.key]; return (
                <div key={b.key} style={{ display:"flex", alignItems:"center", gap:9, fontSize:12.5 }}>
                  <BandDot band={b} size={9} /><span style={{ flex:1, color:"var(--ink)", fontWeight:600 }}>{b.label}</span>
                  <span style={{ fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{fmt(n)}</span>
                  <span style={{ width:38, textAlign:"right", color:"var(--ink-3)", fontVariantNumeric:"tabular-nums" }}>{Math.round(n/total*100)}%</span>
                </div>
              );})}
            </div>
          </div>
        </Card>

        <Card title="组合评分趋势" sub="近 8 周平均从车风险分">
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between", height:"100%", minHeight:210 }}>
            <LineChart data={trend} labels={["W1","W2","W3","W4","W5","W6","W7","本周"]} w={520} h={170} color="var(--accent)" unit=" 分" />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11.5, color:"var(--ink-3)" }}><span>W1</span><span>本周 · {xinan.avgScore}</span></div>
          </div>
        </Card>
      </div>

      <Card title="在保组合 · 5 维度画像" sub="鑫安在保车辆组合平均 · 每维一个 200–997 子分 · 环越长风险越高 · 加权得从车风险分">
        <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:40, alignItems:"center" }}>
          <RiskRings dims={ringDims} score={portScore} band={portBand} size={262} centerLabel="从车风险分" />
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <RingLegend dims={ringDims} />
            <div style={{ fontSize:12, color:"var(--ink-3)", lineHeight:1.65, borderTop:"1px solid var(--border)", paddingTop:12 }}>
              从车风险分 = 5 维度子分按权重加权平均，与总分同一刻度、可加总。<b style={{ color:"#2A6FDB" }}>人机共驾</b>为保护因子：智驾里程越高 → 子分越低 → 拉低风险分。
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"0.95fr 1.4fr", gap:"var(--gap)" }}>
        <Card title="在保品牌构成" sub="代表性样本 · 规模 × 平均评分">
          <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
            {brands.map(b=>(
              <div key={b.name} style={{ display:"flex", alignItems:"center", gap:11 }}>
                <BrandMark name={b.name} color={b.color} size={24} />
                <span style={{ width:88, fontSize:12.5, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.name}</span>
                <div style={{ flex:1, height:16, background:"var(--surface-2)", borderRadius:5, overflow:"hidden" }}>
                  <div style={{ width:(b.n/bMax*100)+"%", height:"100%", background:b.color, opacity:.85, borderRadius:5 }} />
                </div>
                <span style={{ width:30, textAlign:"right", fontSize:14, fontWeight:800, color:DO.bandOf(b.avg).hex }}>{b.avg}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:13, lineHeight:1.5, borderTop:"1px solid var(--border)", paddingTop:11 }}>
            数字 = 平均评分。12/12 特征全就绪 ——「电池温度异常」由 BMS 温度采样接入，电池维度已可独立预警热风险。
          </div>
        </Card>

        <Card title="重点关注车辆" sub="行为漂移预警 + 高风险 · 点击进入车辆详情" right={
          <span style={{ fontSize:12, color:"var(--ink-3)" }}>共 <b style={{ color:"var(--ink)" }}>{sample.filter(v=>v.drift.level>0).length}</b> 辆出现漂移</span>
        }>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {watch.map(v=>{
              const dl = v.drift.level;
              const tag = dl===2 ? {t:"漂移预警 L2",c:"var(--band-crit)"} : dl===1 ? {t:"漂移关注 L1",c:"var(--band-high)"} : {t:"高风险",c:v.band.hex};
              return (
                <button key={v.id} onClick={()=>onOpenVehicle(v.id)} className="row-hover" style={{ display:"flex", alignItems:"center", gap:12, textAlign:"left",
                  border:"1px solid var(--border)", background:"var(--surface)", borderRadius:10, padding:"10px 13px", cursor:"pointer", fontFamily:"inherit" }}>
                  <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:tag.c, borderRadius:5, padding:"3px 7px", whiteSpace:"nowrap", flex:"0 0 auto" }}>{tag.t}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{v.plate} <span style={{ fontSize:11.5, fontWeight:600, color:"var(--ink-3)" }}>· {v.brand} {v.series}</span></div>
                    <div style={{ fontSize:11.5, color:"var(--ink-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.drift.reason}</div>
                  </div>
                  <div style={{ textAlign:"right", flex:"0 0 auto" }}>
                    <div style={{ fontSize:19, fontWeight:800, color:v.band.hex, fontVariantNumeric:"tabular-nums" }}>{v.score}</div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex:"0 0 auto" }}><path d="M9 6l6 6-6 6"/></svg>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function makeRngLocal(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

window.OverviewScreen = OverviewScreen;
