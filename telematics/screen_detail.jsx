/* ============================================================================
   车辆详情 — 5 维雷达 · 12 特征评分推演 · 可解释 · 含锁定的「电池温度异常」
   ============================================================================ */
const DD = window.DATA;
const { useState: useStateD, useEffect: useEffectD, useMemo: useMemoD } = React;

const SLIDER = {}; // 每特征滑杆区间（基于 50k 分布）
DD.FEATURES12.forEach(f=>{
  if(f.locked) return;
  const s = f.stat;
  const lo = f.pctv ? 0 : Math.max(0, Math.floor(s.min));
  const hi = f.pctv ? Math.min(1, +(s.max).toFixed(3)) : Math.ceil(s.max);
  const span = hi - lo || 1;
  const step = f.pctv ? Math.max(0.001, +(span/300).toFixed(3)) : (f.key==="mileage"||f.key==="mileageStd" ? 10 : +(span/200).toFixed(2));
  SLIDER[f.key] = { lo, hi, step };
});

function buildReading(score){
  if(score >= 760) return { head:"高风险车辆", advice:"建议事中预警 + 续保复核 + 上浮系数" };
  if(score >= 620) return { head:"中高风险车辆", advice:"纳入事中监控，按月跟踪出险率变化" };
  if(score >= 480) return { head:"中等风险车辆", advice:"维持常规承保，关注关键指标走势" };
  return { head:"低风险车辆", advice:"可给予优质客户优惠，作为续保优先对象" };
}

/* ---- 单特征推演行 ---- */
function FeatRow({ f, value, contrib, onChange, disabled }){
  const cfg = SLIDER[f.key];
  const pct = ((value - cfg.lo)/(cfg.hi - cfg.lo))*100;
  const dim = DD.DIM_OF[f.dim];
  const c = contrib || 0;
  const cCol = c > 0.5 ? "var(--band-crit)" : c < -0.5 ? "var(--band-low)" : "var(--ink-3)";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"160px 1fr 86px 58px", alignItems:"center", gap:12, opacity: disabled?0.45:1 }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.name}</div>
        <div style={{ fontSize:11, color:"var(--ink-3)" }}>权重 {Math.round(f.w*100)}%{f.dir<0?" · 保护":""}</div>
      </div>
      <input type="range" min={cfg.lo} max={cfg.hi} step={cfg.step} value={value} disabled={disabled}
        onChange={e=>onChange(f.key, Number(e.target.value))} className="detail-slider"
        style={{ "--pct": pct+"%", "--track-accent": dim.color }} />
      <div style={{ textAlign:"right", fontSize:16, fontWeight:800, color:dim.color, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
        {f.fmt ? f.fmt(value) : value}<span style={{ fontSize:10.5, color:"var(--ink-3)", fontWeight:600 }}>{f.unit?(" "+f.unit):""}</span>
      </div>
      <div style={{ textAlign:"right", fontSize:14, fontWeight:800, color:cCol, fontVariantNumeric:"tabular-nums" }}>
        {c>0?"+":""}{Math.round(c)}
      </div>
    </div>
  );
}

function DimGroup({ dim, vals, ctx, contribs, onChange }){
  const feats = DD.DIM_FEATS[dim.key];
  const na = (dim.cond==="ev" && !ctx.isEV) || (dim.cond==="adas" && !ctx.isADAS);
  const naMsg = dim.cond==="ev" ? "非纯电车型 · 电池与充电维度不计入评分" : "未配备 / 未启用 L2+ 智驾 · 该维度不计入评分";
  const idx = na ? null : DD.dimRisk(dim.key, vals, ctx);
  const sub = idx==null ? null : DD.dimSubScore(idx);
  return (
    <div style={{ border:"1px solid var(--border)", borderRadius:11, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"var(--surface-2)", borderBottom: na?"none":"1px solid var(--border)" }}>
        <span style={{ width:11, height:11, borderRadius:3, background: na?"var(--ink-3)":dim.color, flex:"0 0 auto" }} />
        <span style={{ fontSize:14.5, fontWeight:800, color: na?"var(--ink-3)":"var(--ink)" }}>{dim.name}</span>
        <span style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:700 }}>维度权重 {Math.round(dim.w*100)}%</span>
        {dim.protective && !na && <span style={{ fontSize:10.5, color:"#2A6FDB", fontWeight:800, border:"1px solid color-mix(in srgb,#2A6FDB 40%,transparent)", borderRadius:5, padding:"0 5px" }}>保护因子</span>}
        <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          {!na && <React.Fragment>
            <span style={{ fontSize:11, color:"var(--ink-3)" }}>子分</span>
            <span style={{ fontSize:16, fontWeight:800, color: sub==null?"var(--ink-3)":DD.bandOf(sub).hex, fontVariantNumeric:"tabular-nums" }}>{sub==null?"—":sub}</span>
          </React.Fragment>}
        </span>
      </div>
      {na ? (
        <div style={{ padding:"12px 14px", fontSize:12.5, color:"var(--ink-3)" }}>{naMsg}</div>
      ) : (
        <div style={{ padding:"13px 14px", display:"flex", flexDirection:"column", gap:14 }}>
          {feats.map(f => f.locked
            ? <LockTile key={f.key} title="电池温度异常" sub="次/月 · BMS 温度越限告警"
                note="该特征需一汽真实 BMS 温度采样，当前数据缺失、暂不计入评分。接入后可识别热失控前兆，并显著增强「电池与充电」维度权重。" />
            : <FeatRow key={f.key} f={f} value={vals[f.key]} contrib={contribs[f.key]} onChange={onChange} disabled={false} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---- 用途时序识别（保留）---- */
function UsageTimeline({ v }){
  const tl = v.usageTimeline || [];
  if(!tl.length) return null;
  const maxKm = Math.max(...tl.map(w=>w.km), 1);
  const stateOf = k => DD.USAGE_STATES[k] || DD.USAGE_STATES.priv;
  const labels = tl.map((_,i)=> i===tl.length-1 ? "本周" : "W-"+(tl.length-1-i));
  const seen = [...new Set(tl.map(w=>w.state))];
  const dk = v.drift.kind;
  const reading = dk==="onset"
    ? "近几周夜间 / 里程 / 路线随机性同步抬升 —— 疑似转入网约营运或更换主要驾驶人，评分随行为上行。详见「驾驶人变化监测」。"
    : dk==="exit"
    ? "营运特征逐周回落，用途回归私家通勤，评分随之下行 —— 静态标签会误判，时序数据不会。"
    : v.usageKey==="rh_full" ? "连续 12 周全时段营运：高里程 + 随机路线同时出现，评分持续高位 —— 行为导致的风险，不是「网约」标签本身。"
    : v.usageKey==="rh_part" ? "通勤为主 + 晚间少量载客：里程与时段仅中度抬升，评分落在中段。"
    : "连续 12 周行为稳定，评分随实测指标小幅波动。";
  return (
    <Card title="用途画像 · 时序识别" sub="连续 12 周出行时段 / 路线随机性 —— 识别用途状态，而非依赖静态标签" right={
      <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)", background:"var(--surface-2)", border:"1px solid var(--border)", padding:"5px 12px", borderRadius:999, whiteSpace:"nowrap" }}>当前识别：{v.usageLabel}</span>
    }>
      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:24, alignItems:"start" }}>
        <div>
          <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:64 }}>
            {tl.map((w,i)=>(
              <div key={i} title={labels[i]+" · "+w.km+"km · "+stateOf(w.state).label} style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"flex-end", height:"100%" }}>
                <div style={{ height:Math.max(6,(w.km/maxKm)*100)+"%", borderRadius:"3px 3px 0 0", background:stateOf(w.state).hex, opacity:.8 }} />
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:4, marginTop:4 }}>
            {tl.map((w,i)=>(<div key={i} style={{ flex:1, height:9, borderRadius:3, background:stateOf(w.state).hex }} />))}
          </div>
          <div style={{ display:"flex", gap:4, marginTop:4 }}>
            {labels.map((l,i)=>(<div key={i} style={{ flex:1, fontSize:9.5, color: i===tl.length-1?"var(--ink)":"var(--ink-3)", fontWeight: i===tl.length-1?800:500, textAlign:"center", whiteSpace:"nowrap" }}>{i%2===1||i===tl.length-1?l:""}</div>))}
          </div>
          <div style={{ display:"flex", gap:16, marginTop:10, flexWrap:"wrap" }}>
            {seen.map(k=>(<span key={k} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--ink-2)" }}>
              <span style={{ width:10, height:10, borderRadius:3, background:stateOf(k).hex, display:"inline-block" }} />{stateOf(k).label}</span>))}
            <span style={{ fontSize:12, color:"var(--ink-3)" }}>柱高 = 周里程 km</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>路线随机性指数</span>
            <b style={{ fontSize:19, fontVariantNumeric:"tabular-nums", color: v.routeEntropy>=0.65?"var(--band-crit)":v.routeEntropy>=0.4?"var(--band-mid)":"var(--band-low)" }}>{v.routeEntropy.toFixed(2)}</b>
          </div>
          <div style={{ fontSize:13, color:"var(--ink-2)", lineHeight:1.65 }}>{reading}</div>
        </div>
      </div>
    </Card>
  );
}

function DetailScreen({ vehicleId }){
  const vehicle = useMemoD(() => DD.FLEET.find(v => v.id === vehicleId) || DD.FLEET[0], [vehicleId]);
  const ctx = { isEV: vehicle.isEV, isADAS: vehicle.isADAS, cv: vehicle.cv };
  const [vals, setVals] = useStateD(vehicle.f);
  const [dirty, setDirty] = useStateD(false);
  useEffectD(() => { setVals(vehicle.f); setDirty(false); }, [vehicleId]);

  const onChange = (k, v) => { setVals(p => ({ ...p, [k]: v })); setDirty(true); };
  const reset = () => { setVals(vehicle.f); setDirty(false); };

  const { score, subs, contribs, weights } = DD.computeScore12(vals, ctx);
  const band = DD.bandOf(score);
  const rr = DD.relativeRisk(score, DD.PORTFOLIO_MEAN);
  const reading = buildReading(score);
  const dKindLabel = { onset:"疑似转营运 / 换驾驶人", driver:"疑似更换驾驶人", exit:"营运回落 · 用途回归" }[vehicle.drift.kind] || "行为漂移";

  // 维度圆环数据（子分制 200–997）
  const ringDims = DD.DIMS.map(d=>({ key:d.key, name:d.name, color:d.color, weight: weights[d.key]||0, protective:d.protective,
    sub: subs[d.key], na: subs[d.key]==null, naLabel: d.cond==="ev"?"非纯电":"无智驾" }));
  // 维度相对中位的偏移（求和 + 中位基准 = 从车风险分）
  const dimContribs = DD.DIMS.map(d=>{
    const na = subs[d.key]==null;
    const sum = DD.DIM_FEATS[d.key].reduce((s,f)=> s + (contribs[f.key]||0), 0);
    return { dim:d, c: na?0:Math.round(sum), na };
  });
  const weeks = ["W1","W2","W3","W4","W5","W6","W7","本周"];
  const topFeats = DD.FEATURES12.filter(f=>!f.locked && vehicle.featTrend[f.key]).map(f=>{
    const arr = vehicle.featTrend[f.key]; return { f, arr, delta:+(arr[7]-arr[0]) };
  }).sort((a,b)=>Math.abs(b.delta/(b.f.stat.std||1))-Math.abs(a.delta/(a.f.stat.std||1))).slice(0,4);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      {/* hero: radar + score */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.05fr", gap:"var(--gap)", alignItems:"stretch" }}>
        <Card title="5 维度风险画像" sub="每维一个 200–997 子分 · 环越长风险越高 · 加权得从车风险分">
          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
            <RiskRings dims={ringDims} score={score} band={band} size={258} centerLabel="从车风险分" />
            <div style={{ flex:1, minWidth:0 }}>
              <RingLegend dims={ringDims} />
            </div>
          </div>
        </Card>

        <Card pad={false}>
          <div style={{ display:"flex", alignItems:"center", padding:"var(--card-pad)", gap:8 }}>
            <div style={{ flex:"0 0 210px", textAlign:"center" }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)" }}>从车风险分 <span style={{ color:"var(--ink-3)", fontWeight:500 }}>200–997</span></div>
              <div style={{ fontSize:11, color:"var(--ink-3)", marginBottom:4 }}>分越高 = 风险越高</div>
              <Gauge score={score} size={196} />
            </div>
            <div style={{ flex:1, textAlign:"center" }}>
              <ScoreText score={score} size={76} />
              <div style={{ fontSize:12.5, color:"var(--ink-3)", marginTop:6 }}>从车风险分{dirty && <span style={{ color:"var(--accent)" }}> · 模拟中</span>}</div>
              <div style={{ marginTop:9 }}><RiskBadge band={band} size="lg" /></div>
            </div>
            <div style={{ width:1, alignSelf:"stretch", background:"var(--border)", margin:"8px 0" }} />
            <div style={{ flex:"0 0 122px", textAlign:"center" }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)" }}>相对风险</div>
              <div style={{ fontSize:11, color:"var(--ink-3)" }}>vs 均值 {DD.PORTFOLIO_MEAN}</div>
              <div style={{ marginTop:10, fontSize:46, fontWeight:800, color: rr>=1.03?"var(--band-crit)":rr<=0.97?"var(--band-low)":"var(--ink-3)", fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{rr.toFixed(1)}×</div>
              <div style={{ fontSize:12.5, color:"var(--ink-2)", marginTop:6 }}>{rr>=1.03?"高 "+Math.round((rr-1)*100)+"%":rr<=0.97?"低 "+Math.round((1-rr)*100)+"%":"与均值相当"}</div>
            </div>
          </div>
          <div style={{ borderTop:"1px solid var(--border)", padding:"var(--card-pad)" }}>
            <div style={{ borderLeft:"5px solid var(--accent)", background:"var(--accent-soft)", padding:"13px 16px", borderRadius:"0 10px 10px 0" }}>
              <div style={{ fontSize:16, color:"var(--ink)", lineHeight:1.55 }}>
                <b style={{ color:"var(--accent)" }}>{reading.head}</b>：{reading.advice}。
              </div>
              <div style={{ fontSize:12.5, color:"var(--ink-2)", marginTop:6 }}>
                {vehicle.brand} · {vehicle.series} · {vehicle.energy} · {vehicle.usageLabel} · {vehicle.isADAS?vehicle.adas.tierLabel:"无智驾"}
              </div>
            </div>
            {vehicle.drift.level>0 && (
              <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:9, flexWrap:"wrap",
                background: vehicle.drift.level===2?"color-mix(in srgb, var(--band-crit) 8%, transparent)":"color-mix(in srgb, var(--band-high) 8%, transparent)",
                border:"1px solid "+(vehicle.drift.level===2?"color-mix(in srgb, var(--band-crit) 32%, transparent)":"color-mix(in srgb, var(--band-high) 32%, transparent)"),
                borderRadius:10, padding:"9px 13px" }}>
                <span style={{ fontSize:11, fontWeight:800, color:"#fff", background: vehicle.drift.level===2?"var(--band-crit)":"var(--band-high)", borderRadius:6, padding:"3px 9px", whiteSpace:"nowrap" }}>{vehicle.drift.level===2?"L2 漂移预警":"L1 漂移关注"}</span>
                <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap" }}>{dKindLabel}</span>
                <span style={{ fontSize:12, color:"var(--ink-3)" }}>·</span>
                <span style={{ fontSize:12.5, color:"var(--ink-2)", whiteSpace:"nowrap" }}>变点 <b style={{ color:"var(--ink)" }}>{vehicle.drift.cp>=0?("第"+(vehicle.drift.cp+1)+"周"):"无"}</b></span>
                <span style={{ fontSize:12.5, color:"var(--ink-2)", whiteSpace:"nowrap" }}>漂移幅度 <b style={{ color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{vehicle.drift.drift}</b></span>
                <span style={{ marginLeft:"auto", fontSize:11.5, color:"var(--ink-3)", whiteSpace:"nowrap" }}>详见「驾驶人变化监测」</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* what-if */}
      <Card title="风险分推演 · 12 项动态特征" sub="拖动任一指标 → 上方风险分、圆环、相对风险即时联动（按权重 × 偏离度 × 方向）" right={
        dirty ? <button onClick={reset} style={{ border:"1px solid var(--border)", background:"var(--surface)", color:"var(--ink-2)", fontSize:12.5, fontWeight:700, padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>↺ 还原实测值</button> : null
      }>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[DD.DIMS[0], DD.DIMS[1]].map(d=><DimGroup key={d.key} dim={d} vals={vals} ctx={ctx} contribs={contribs} onChange={onChange} />)}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[DD.DIMS[2], DD.DIMS[3], DD.DIMS[4]].map(d=><DimGroup key={d.key} dim={d} vals={vals} ctx={ctx} contribs={contribs} onChange={onChange} />)}
          </div>
        </div>
      </Card>

      {/* explainability */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
        <Card title="可解释 · 从车风险分怎么来" sub="从车风险分 = 中位基准 + Σ（各维度相对中位的偏移）">
          <div style={{ fontFamily:"var(--mono)", fontSize:13, color:"var(--ink-2)", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:9, padding:"11px 14px", marginBottom:14, lineHeight:1.5 }}>
            <span style={{ color:"var(--accent)", fontWeight:800 }}>{score}</span> = {DD.NEUTRAL_SCORE} 中位基准 + Σ 维度偏移
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {dimContribs.map(({dim,c,na})=>{
              const w = Math.min(Math.abs(c), 150)/150*46;
              const pos = c>=0;
              const col = na ? "var(--ink-3)" : (pos ? "var(--band-crit)" : "var(--band-low)");
              return (
                <div key={dim.key} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:96, display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ width:9, height:9, borderRadius:3, background: na?"var(--ink-3)":dim.color, flex:"0 0 auto" }} />
                    <span style={{ fontSize:13, fontWeight:700, color: na?"var(--ink-3)":"var(--ink)", whiteSpace:"nowrap" }}>{dim.name}</span>
                  </div>
                  <div style={{ flex:1, height:20, background:"var(--surface-2)", borderRadius:5, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", left:"50%", top:0, width:2, height:"100%", background:"var(--border)" }} />
                    {!na && <div style={{ position:"absolute", top:4, height:12, borderRadius:3, transition:"all .25s ease", left: pos?"50%":`${50-w}%`, width:`${w}%`, background:col }} />}
                  </div>
                  <div style={{ width:48, textAlign:"right", fontSize:16, fontWeight:800, color:col, fontVariantNumeric:"tabular-nums" }}>{na?"—":(pos?"+":"")+c}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:12, color:"var(--ink-3)", marginTop:14, lineHeight:1.5, display:"flex", gap:18, flexWrap:"wrap" }}>
            <span><span style={{ color:"var(--band-crit)", fontWeight:800 }}>■</span> 推高风险分</span>
            <span><span style={{ color:"var(--band-low)", fontWeight:800 }}>■</span> 拉低风险分</span>
            <span style={{ color:"var(--ink-3)" }}>中位基准 = 全维处于组合中位的车</span>
          </div>
        </Card>

        <Card title="从车风险分趋势" sub="近 8 周 · 实测数据（不受上方模拟影响）" right={
          <span style={{ fontSize:12.5, color:"var(--ink-3)" }}>本周 <b style={{ color:vehicle.band.hex, fontSize:15 }}>{vehicle.score}</b></span>
        }>
          <LineChart data={vehicle.trend} labels={weeks} bands w={560} h={170}
            yMin={Math.max(200, Math.min(...vehicle.trend)-40)} yMax={Math.min(997, Math.max(...vehicle.trend)+40)}
            baseline={DD.PORTFOLIO_MEAN} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:14 }}>
            {topFeats.map(({f,arr,delta})=>{
              const up = delta>0;
              return (
                <div key={f.key} style={{ border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px", background:"var(--surface-2)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                    <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap" }}>{f.short}</span>
                    <DeltaPill delta={+ (f.pctv? (delta*100).toFixed(1) : delta.toFixed(f.key==="mileage"||f.key==="mileageStd"?0:2)) } unit={f.pctv?"%":""} invert={f.dir<0} />
                  </div>
                  <Sparkline data={arr} w={200} h={32} color={up===(f.dir>0)?"var(--band-crit)":"var(--band-low)"} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <UsageTimeline v={vehicle} />
    </div>
  );
}
window.DetailScreen = DetailScreen;
