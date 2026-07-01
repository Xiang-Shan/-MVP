/* ============================================================================
   车队管理 Fleet Management — B 端车队风险管理驾驶舱
   思路：同一套 12 特征，既帮车队「看见风险、管理风险、降本」，也帮鑫安「定价、风控」。
   参考 Targa Telematics 等车队远程信息(telematics)方案：
   风险评分榜 · 驾驶行为教练 · 事故还原/责任认定/FNOL · 电池与充电优化 ·
   人机共驾安全 · 用途/路线合规与异常预警 · 风险减量→保费/TCO 降本测算
   ============================================================================ */
const DFM = window.DATA;
const { useState: useStateFM } = React;

const fmMean = (a)=> a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
const fmWan = (x)=> (x/10000).toFixed(1);

function MiniStat({ label, value, unit, color, sub }){
  return (
    <div style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:10, padding:"11px 13px" }}>
      <div style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:600 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4, marginTop:3 }}>
        <span style={{ fontSize:21, fontWeight:800, color:color||"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{value}</span>
        {unit && <span style={{ fontSize:11, color:"var(--ink-3)", fontWeight:600 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:10.5, color:"var(--ink-3)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function FleetMgmtScreen({ onOpenVehicle }){
  const groups = DFM.FLEET_GROUPS;
  const [sel, setSel] = useStateFM(groups[0].id);
  const fleet = groups.find(g=>g.id===sel) || groups[0];
  const [toast, setToast] = useStateFM(null);
  const fireFM = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null), 2800); };
  const [pickOpen, setPickOpen] = useStateFM(false);
  const [pickQ, setPickQ] = useStateFM("");
  const [rq, setRq] = useStateFM("");
  const [rsort, setRsort] = useStateFM({ key:"score", dir:"desc" });
  const [dispatched, setDispatched] = useStateFM({});
  const vs = fleet.vehicles;
  const n = vs.length;
  const avgScore = Math.round(fmMean(vs.map(v=>v.score)));
  const aBand = DFM.bandOf(avgScore);
  const bands = { crit:0, high:0, mid:0, low:0 }; vs.forEach(v=>bands[v.band.key]++);
  const highN = bands.crit + bands.high;
  const adasV = vs.filter(v=>v.isADAS);
  const adasShare = adasV.length ? Math.round(fmMean(adasV.map(v=>v.adas.share))) : 0;
  const hpV = adasV.filter(v=>v.adas.tier==="hp");
  const takeover = hpV.length ? +(fmMean(hpV.map(v=>v.adas.takeoverPer1k||0))).toFixed(1) : 0;
  const evs = vs.filter(v=>v.isEV);
  const sohAvg = evs.length ? +(fmMean(evs.map(v=>v.battery.soh))).toFixed(1) : null;
  const fastAvg = evs.length ? Math.round(fmMean(evs.map(v=>v.vals.fast))) : 0;
  const rangeAvg = evs.length ? Math.round(fmMean(evs.map(v=>v.battery.rangeAchieve))) : 0;
  const cellDevAvg = evs.length ? Math.round(fmMean(evs.map(v=>v.battery.cellDev))) : 0;
  const driftL2 = vs.filter(v=>v.drift.level===2).length;
  const driftL1 = vs.filter(v=>v.drift.level===1).length;
  const driftVs = vs.filter(v=>v.drift.level>0).sort((a,b)=> (b.drift.level-a.drift.level) || (b.drift.drift-a.drift.drift)).slice(0,5);

  // 全车队对比榜
  const groupAgg = groups.map(g=>{
    const gv=g.vehicles, gAvg=Math.round(fmMean(gv.map(v=>v.score)));
    const gb={crit:0,high:0,mid:0,low:0}; gv.forEach(v=>gb[v.band.key]++);
    const gAdas=gv.filter(v=>v.isADAS);
    return { id:g.id, code:g.code, name:g.name, short:g.short, color:g.color, n:g.n, avg:gAvg,
      bands:gb, adasShare: gAdas.length?Math.round(fmMean(gAdas.map(v=>v.adas.share))):0,
      drift: gv.filter(v=>v.drift.level>0).length };
  }).sort((a,b)=>b.avg-a.avg);

  // 驾驶行为画像（车队均值分位 vs 组合中位 50）
  const behFeats = [
    { key:"hardDecel", label:"急减速" }, { key:"hardTurn", label:"急转弯" },
    { key:"speeding", label:"超速" }, { key:"fatigue", label:"疲劳驾驶" }, { key:"night", label:"夜间行驶" }
  ];
  const beh = behFeats.map(f=>({ ...f, p: Math.round(fmMean(vs.map(v=>DFM.pctOf(f.key, v.f[f.key])))) })).sort((a,b)=>b.p-a.p);
  const worstBeh = beh[0];
  const coachN = vs.filter(v=>DFM.pctOf(worstBeh.key, v.f[worstBeh.key])>=70).length;

  // 车辆花名册 · 风险处置
  const topDimOf = (v)=> DFM.DIMS.filter(d=>v.subs[d.key]!=null).sort((a,b)=>v.subs[b.key]-v.subs[a.key])[0];
  const isHigh = (v)=> v.band.key==="crit" || v.band.key==="high";
  const rosterRows = (function(){
    let r = vs.filter(v=> !rq || (v.plate+" "+v.brand+" "+v.series+" "+(v.model||"")).toLowerCase().includes(rq.toLowerCase()));
    const dir = rsort.dir==="asc"?1:-1;
    return [...r].sort((a,b)=>{
      switch(rsort.key){
        case "plate": return a.plate.localeCompare(b.plate)*dir;
        case "drift": return ((a.drift.drift||0)-(b.drift.drift||0))*dir;
        case "mileage": return ((a.f.mileage||0)-(b.f.mileage||0))*dir;
        default: return (a.score-b.score)*dir;
      }
    });
  })();
  const dispatchOne = (v)=>{ setDispatched(d=>({ ...d, [v.id]:true })); fireFM("已向 "+v.plate+" 派发整改任务 · 教练计划 4 周"); };
  const dispatchAll = ()=>{ const hi=vs.filter(isHigh); if(!hi.length){ fireFM("本车队暂无高风险车辆"); return; } setDispatched(d=>{ const nx={...d}; hi.forEach(v=>nx[v.id]=true); return nx; }); fireFM("已批量派发整改 · "+hi.length+" 辆高风险车辆已进入教练计划"); };
  const RTh = function({ k, children, align }){
    const active = rsort.key===k;
    return (
      <th onClick={k?()=>setRsort(s=>({ key:k, dir: s.key===k&&s.dir==="desc"?"asc":"desc" })):undefined}
        style={{ textAlign:align||"left", padding:"0 12px", height:38, fontSize:11.5, fontWeight:700, color: active?"var(--accent)":"var(--ink-2)",
          cursor:k?"pointer":"default", whiteSpace:"nowrap", userSelect:"none", position:"sticky", top:0, background:"var(--surface-2)", zIndex:1, borderBottom:"1px solid var(--border)" }}>
        {children}{k && <span style={{ marginLeft:4, opacity: active?1:.3 }}>{active?(rsort.dir==="desc"?"↓":"↑"):"↕"}</span>}
      </th>
    );
  };

  // 风险减量 → 降本测算（模拟示意）
  const perVeh = 6200;
  const factorNow = DFM.relativeRisk(avgScore, DFM.PORTFOLIO_MEAN);
  const improve = Math.min(54, Math.round((highN/Math.max(1,n))*72 + 12));
  const targetScore = Math.max(DFM.SCORE_MIN, avgScore - improve);
  const factorTgt = DFM.relativeRisk(targetScore, DFM.PORTFOLIO_MEAN);
  const premiumNow = Math.round(n*perVeh*factorNow);
  const premiumTgt = Math.round(n*perVeh*factorTgt);
  const premiumSave = Math.max(0, premiumNow - premiumTgt);
  const batterySave = evs.length * 900;
  const totalSave = premiumSave + batterySave;

  const levers = [
    { ic:"M3 12h4l2.5-6 4 12L16 12h5", t:"驾驶行为教练", d:`急减速/超速/疲劳分位偏高 → 平稳挑战 4 周拉低 ~15pt`, m:"出险频度 −9%" },
    { ic:"M5 17h14M6 17l1.5-6h9L18 17", t:"人机共驾·智驾减损", d:`高速领航里程视作低风险里程，接管下降 → 风险分下行`, m:"保费系数 ↓" },
    { ic:"M4 11h16M8 11V8a4 4 0 018 0v3", t:"充电优化·电池养护", d:`降快充依赖、夜间慢充为主 → 衰减放缓、残值与延保受益`, m:"纯电 TCO ↓" }
  ];

  const incident = [
    { t:"T−30s", e:"智驾巡航 · 系统控车", c:"var(--band-low)" },
    { t:"T−4.2s", e:"接管请求 · 前车加塞", c:"var(--band-mid)" },
    { t:"T−2.8s", e:"驾驶员接管", c:"var(--band-high)" },
    { t:"T−0.5s", e:"AEB 触发", c:"var(--band-crit)" },
    { t:"T0", e:"低速碰撞", c:"var(--band-crit)" }
  ];
  const fnol = ["EDR + 智驾日志全量存证","责任认定：人接管后操作","FNOL 自动报案 · 进度可视","视频查勘 18min · 小额直赔 4.2h"];

  const scenes = [
    { k:"高速领航", share:66, col:"var(--band-low)", note:"低风险里程" },
    { k:"城区辅助", share:29, col:"var(--band-mid)", note:"接管最密集" },
    { k:"泊车辅助", share:5, col:"var(--band-high)", note:"小额高频" }
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      {/* 叙事头 */}
      <div className="card" style={{ padding:"calc(var(--card-pad) + 2px)", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap",
        background:"linear-gradient(120deg, var(--surface) 58%, var(--accent-soft))" }}>
        <div style={{ flex:"1 1 440px", minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:".04em" }}>B 端车队 · 风险管理驾驶舱</div>
          <div style={{ fontSize:21, fontWeight:800, color:"var(--ink)", marginTop:5, lineHeight:1.4 }}>同一套 12 特征，既帮车队<span style={{ color:"var(--accent)" }}>看见风险、管理风险、降本</span>，也帮鑫安把承保做准、做大</div>
          <div style={{ fontSize:13, color:"var(--ink-2)", marginTop:8, lineHeight:1.6 }}>
            车队主拿到一个可下钻的风险驾驶舱：评分榜、行为教练、事故还原与快赔、电池与充电优化、人机共驾安全、用途合规预警；
            鑫安拿到更准的车队级风险画像与续保策略 —— 风险减量与保险经营，第一次落在同一份数据上。
          </div>
        </div>
        <div style={{ display:"flex", gap:24, flex:"0 0 auto" }}>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:30, fontWeight:900, color:"var(--ink)" }}>{groups.length}</div><div style={{ fontSize:11.5, color:"var(--ink-3)" }}>在管车队</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:30, fontWeight:900, color:"var(--accent)", fontVariantNumeric:"tabular-nums" }}>{fmt(groups.reduce((s,g)=>s+g.n,0))}</div><div style={{ fontSize:11.5, color:"var(--ink-3)" }}>运营车辆</div></div>
        </div>
      </div>

      {/* 车队筛选：下拉选择（全部车队对比见下方评分榜） */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)", whiteSpace:"nowrap" }}>车队筛选</span>
          <div style={{ position:"relative" }}>
            <button onClick={()=>{ setPickOpen(o=>!o); setPickQ(""); }} style={{ display:"flex", alignItems:"center", gap:10, minWidth:308, cursor:"pointer", fontFamily:"inherit",
              border:"1px solid var(--border)", background:"var(--surface)", borderRadius:10, padding:"9px 13px", boxShadow:"var(--shadow)" }}>
              <span style={{ width:9, height:9, borderRadius:"50%", background:fleet.color, flex:"0 0 auto" }} />
              <span style={{ fontFamily:"var(--mono, ui-monospace, monospace)", fontSize:12, fontWeight:800, color:fleet.color, letterSpacing:".02em" }}>{fleet.code}</span>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fleet.name}</span>
              <span style={{ marginLeft:"auto", fontSize:11.5, color:"var(--ink-3)", fontWeight:700, whiteSpace:"nowrap" }}>{fleet.n} 辆</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.4" style={{ flex:"0 0 auto", transform: pickOpen?"rotate(180deg)":"none", transition:"transform .15s" }}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {pickOpen && (
              <React.Fragment>
                <div onClick={()=>setPickOpen(false)} style={{ position:"fixed", inset:0, zIndex:30 }} />
                <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:31, width:372, maxWidth:"86vw",
                  background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, boxShadow:"0 14px 40px rgba(0,0,0,.18)", padding:8 }}>
                  <div style={{ position:"relative", marginBottom:6 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
                    <input autoFocus value={pickQ} onChange={e=>setPickQ(e.target.value)} placeholder="搜索车队编码 / 名称…"
                      style={{ width:"100%", height:36, padding:"0 12px 0 32px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--ink)", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                  </div>
                  <div style={{ maxHeight:288, overflow:"auto", display:"flex", flexDirection:"column", gap:2 }}>
                    {groups.filter(g=> !pickQ || (g.code+" "+g.name+" "+g.short).toLowerCase().includes(pickQ.toLowerCase())).map(g=>{
                      const on=g.id===sel; const gAvg=Math.round(fmMean(g.vehicles.map(v=>v.score)));
                      return (
                        <button key={g.id} onClick={()=>{ setSel(g.id); setPickOpen(false); }} className="row-hover" style={{ display:"flex", alignItems:"center", gap:11, textAlign:"left", cursor:"pointer", fontFamily:"inherit",
                          border:"none", background: on?"var(--accent-soft)":"transparent", borderRadius:9, padding:"9px 11px", width:"100%" }}>
                          <span style={{ width:10, height:10, borderRadius:"50%", background:g.color, flex:"0 0 auto" }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontFamily:"var(--mono, ui-monospace, monospace)", fontSize:11.5, fontWeight:800, color:g.color }}>{g.code}</span>
                              <span style={{ fontSize:13, fontWeight: on?800:700, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.short}</span>
                            </div>
                            <div style={{ fontSize:11, color:"var(--ink-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.name}</div>
                          </div>
                          <div style={{ textAlign:"right", flex:"0 0 auto" }}>
                            <div style={{ fontSize:13.5, fontWeight:800, color:DFM.bandOf(gAvg).hex, fontVariantNumeric:"tabular-nums" }}>{gAvg}</div>
                            <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>{g.n} 辆</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>
          <span style={{ marginLeft:"auto", fontSize:12, color:"var(--ink-3)", whiteSpace:"nowrap" }}>全部车队对比见下方<b style={{ color:"var(--ink-2)" }}>评分榜</b></span>
      </div>

      {/* 车队档案 */}
      <div className="card" style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0, flex:"0 0 auto" }}>
          <span style={{ width:42, height:42, borderRadius:11, flex:"0 0 auto", display:"grid", placeItems:"center",
            background:"color-mix(in srgb, "+fleet.color+" 14%, transparent)", color:fleet.color }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h2l1-5h12l1 5h2M5 12l1.5-5h11L19 12M7 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>
          </span>
          <div style={{ minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontFamily:"var(--mono, ui-monospace, monospace)", fontSize:12, fontWeight:800, color:fleet.color, letterSpacing:".02em" }}>{fleet.code}</span>
              <span style={{ fontSize:10.5, fontWeight:800, color:"var(--band-low)", background:"color-mix(in srgb, var(--band-low) 12%, transparent)", borderRadius:5, padding:"1px 7px" }}>承保中</span>
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:"var(--ink)", marginTop:2, whiteSpace:"nowrap" }}>{fleet.name}</div>
          </div>
        </div>
        <div style={{ width:1, height:38, background:"var(--border)", flex:"0 0 auto" }} />
        <div style={{ display:"flex", gap:"14px 26px", flexWrap:"wrap", flex:1, minWidth:0 }}>
          {[
            ["负责人", fleet.profile.owner+"  ·  "+fleet.profile.role],
            ["联系方式", fleet.profile.phone],
            ["保单号", fleet.profile.policy],
            ["合同期", fleet.profile.term],
            ["运营基地", fleet.profile.base],
            ["入网时间", fleet.profile.since]
          ].map(([k,val])=>(
            <div key={k} style={{ minWidth:0 }}>
              <div style={{ fontSize:11, color:"var(--ink-3)", fontWeight:600 }}>{k}</div>
              <div style={{ fontSize:13, color:"var(--ink)", fontWeight:700, marginTop:2, whiteSpace:"nowrap" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"var(--gap)" }}>
        <div className="card" style={{ padding:"var(--card-pad)" }}>
          <div style={{ fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>平均从车风险分</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:6 }}>
            <span style={{ fontSize:32, fontWeight:800, color:aBand.hex, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{avgScore}</span>
            <RiskBadge band={aBand} size="sm" />
          </div>
          <div style={{ fontSize:12, color:"var(--ink-3)", marginTop:6 }}>组合均值 {DFM.PORTFOLIO_MEAN} · 越高越险</div>
        </div>
        <KPI label="高风险占比" value={Math.round(highN/n*100)+"%"} sub={highN+" 辆需重点干预"} sparkColor="var(--band-crit)" />
        <KPI label="智驾里程占比" value={adasShare+"%"} sub={adasV.length+" 辆 L2+ · "+hpV.length+" 辆城市NOA"} />
        <KPI label="纯电 SOH 均值" value={sohAvg?sohAvg+"%":"—"} sub={evs.length?(evs.length+" 辆纯电 · 快充 "+fastAvg+"%"):"无纯电车辆"} sparkColor="#0E8A6E" />
        <KPI label="行为漂移预警" value={driftL1+driftL2} unit="辆" sub={"L2 "+driftL2+" · L1 "+driftL1+" · 早识别用途/驾驶人变更"} sparkColor="var(--band-high)" />
      </div>

      {/* 评分榜 + 行为教练 */}
      <div style={{ display:"grid", gridTemplateColumns:"1.32fr 1fr", gap:"var(--gap)" }}>
        <Card title="车队风险评分榜" sub="按平均从车风险分排序 · 点击切换车队 · 越高越险">
          <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums" }}>
            <thead>
              <tr style={{ fontSize:11.5, color:"var(--ink-2)", fontWeight:700, textAlign:"left" }}>
                <th style={{ padding:"4px 8px" }}>车队</th>
                <th style={{ padding:"4px 8px", textAlign:"right" }}>车辆</th>
                <th style={{ padding:"4px 8px", textAlign:"right" }}>平均风险分</th>
                <th style={{ padding:"4px 8px", width:"30%" }}>风险等级构成</th>
                <th style={{ padding:"4px 8px", textAlign:"right" }}>智驾</th>
                <th style={{ padding:"4px 8px", textAlign:"right" }}>漂移</th>
              </tr>
            </thead>
            <tbody>
              {groupAgg.map(g=>(
                <tr key={g.id} onClick={()=>setSel(g.id)} className="row-hover" style={{ cursor:"pointer", borderTop:"1px solid var(--border)",
                  background: g.id===sel?"var(--accent-soft)":"transparent" }}>
                  <td style={{ padding:"10px 8px" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:9, height:9, borderRadius:"50%", background:g.color, flex:"0 0 auto" }} />
                      <span style={{ minWidth:0 }}>
                        <span style={{ display:"block", fontSize:13, fontWeight: g.id===sel?800:700, color:"var(--ink)", whiteSpace:"nowrap" }}>{g.short}</span>
                        <span style={{ display:"block", fontFamily:"var(--mono, ui-monospace, monospace)", fontSize:10, color:"var(--ink-3)", fontWeight:700, letterSpacing:".02em", marginTop:1 }}>{g.code}</span>
                      </span>
                    </span>
                  </td>
                  <td style={{ padding:"10px 8px", textAlign:"right", color:"var(--ink-2)", fontWeight:600 }}>{g.n}</td>
                  <td style={{ padding:"10px 8px", textAlign:"right", fontSize:16, fontWeight:800, color:DFM.bandOf(g.avg).hex }}>{g.avg}</td>
                  <td style={{ padding:"10px 8px" }}><StackBar bands={g.bands} /></td>
                  <td style={{ padding:"10px 8px", textAlign:"right", color:"var(--ink-2)" }}>{g.adasShare}%</td>
                  <td style={{ padding:"10px 8px", textAlign:"right", fontWeight:700, color: g.drift>0?"var(--band-high)":"var(--ink-3)" }}>{g.drift}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display:"flex", gap:14, fontSize:11, color:"var(--ink-3)", marginTop:12, borderTop:"1px solid var(--border)", paddingTop:11 }}>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><BandDot band={DFM.BANDS[3]} size={8}/>低</span>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><BandDot band={DFM.BANDS[2]} size={8}/>中</span>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><BandDot band={DFM.BANDS[1]} size={8}/>中高</span>
            <span style={{ display:"flex", alignItems:"center", gap:5 }}><BandDot band={DFM.BANDS[0]} size={8}/>高</span>
            <span style={{ marginLeft:"auto" }}>全职网约风险最高 —— 高里程 + 随机路线 + 夜间营运同时出现</span>
          </div>
        </Card>

        <Card title="驾驶行为安全教练" sub={fleet.short+" · 车队均值分位 vs 组合中位 50"}>
          <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
            {beh.map(b=>{
              const col = b.p>=70?"var(--band-crit)":b.p>=55?"var(--band-high)":b.p>=45?"var(--band-mid)":"var(--band-low)";
              return (
                <div key={b.key}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                    <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink)" }}>{b.label}</span>
                    <span style={{ fontSize:13.5, fontWeight:800, color:col, fontVariantNumeric:"tabular-nums" }}>{b.p}</span>
                  </div>
                  <div style={{ height:8, borderRadius:5, background:"var(--surface-2)", overflow:"hidden", position:"relative" }}>
                    <div style={{ position:"absolute", left:"50%", top:0, width:1, height:"100%", background:"var(--border)" }} />
                    <div style={{ width:b.p+"%", height:"100%", borderRadius:5, background:col }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:13, padding:"11px 13px", borderRadius:10, background:"var(--accent-soft)", fontSize:12, color:"var(--ink-2)", lineHeight:1.6 }}>
            最该先教练：<b style={{ color:"var(--ink)" }}>{worstBeh.label}</b> —— <b style={{ color:"var(--accent)" }}>{coachN}</b> 辆车处于高分位（≥70）。
            平稳起步 / 跟车挑战可在 4 周把该分位拉低 ~15pt，预计出险频度 <b style={{ color:"var(--band-low)" }}>−9%</b>。
          </div>
        </Card>
      </div>

      {/* 车辆花名册 · 风险处置 */}
      <Card title={"车辆花名册 · "+fleet.short} sub={"该车队 "+n+" 辆在管车辆 · 搜索 / 排序 / 点击进车辆详情 · 高风险可一键派发整改"}
        right={
          <button onClick={dispatchAll} style={{ border:"none", cursor:"pointer", fontFamily:"inherit", background:"var(--accent)", color:"#fff",
            fontSize:12.5, fontWeight:700, borderRadius:9, padding:"8px 13px", display:"flex", alignItems:"center", gap:7, whiteSpace:"nowrap" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            一键派发教练 · 高风险 {highN} 辆
          </button>
        }>
        <div style={{ position:"relative", marginBottom:10, maxWidth:280 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)" }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
          <input value={rq} onChange={e=>setRq(e.target.value)} placeholder="搜索车牌 / 品牌 / 车型…"
            style={{ width:"100%", height:36, padding:"0 12px 0 33px", borderRadius:9, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--ink)", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
        </div>
        <div style={{ maxHeight:428, overflow:"auto", border:"1px solid var(--border)", borderRadius:11 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums" }}>
            <thead>
              <tr>
                <RTh k="plate">车牌 / 车型</RTh>
                <RTh align="left">主要风险</RTh>
                <RTh k="mileage" align="right">月均里程</RTh>
                <RTh k="drift" align="center">漂移</RTh>
                <RTh k="score" align="right">从车风险分</RTh>
                <RTh align="center">等级</RTh>
                <RTh align="right">风险处置</RTh>
              </tr>
            </thead>
            <tbody>
              {rosterRows.map(v=>{
                const td = topDimOf(v);
                const dl = v.drift.level;
                const driftTag = dl===2?{t:"L2",c:"var(--band-crit)"}:dl===1?{t:"L1",c:"var(--band-high)"}:null;
                const hi = isHigh(v);
                const done = dispatched[v.id];
                return (
                  <tr key={v.id} onClick={()=>onOpenVehicle(v.id)} className="row-hover" style={{ cursor:"pointer", borderTop:"1px solid var(--border)" }}>
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"var(--ink)" }}>{v.plate}</div>
                      <div style={{ fontSize:11, color:"var(--ink-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><span style={{ width:7, height:7, borderRadius:"50%", background:v.brandColor }} />{v.brand} · {v.series} · {v.energy}</span>
                      </div>
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      {td ? <span style={{ fontSize:11, fontWeight:700, color:td.color, background:"color-mix(in srgb, "+td.color+" 12%, transparent)", borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap" }}>{td.name} {v.subs[td.key]}</span> : <span style={{ color:"var(--ink-3)" }}>—</span>}
                    </td>
                    <td style={{ padding:"9px 12px", textAlign:"right", fontSize:12.5, color:"var(--ink-2)", fontWeight:600, whiteSpace:"nowrap" }}>{fmt(v.f.mileage)}<span style={{ fontSize:10.5, color:"var(--ink-3)" }}> km</span></td>
                    <td style={{ padding:"9px 12px", textAlign:"center" }}>
                      {driftTag ? <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:driftTag.c, borderRadius:5, padding:"2px 7px" }}>{driftTag.t}</span> : <span style={{ fontSize:11, color:"var(--ink-3)" }}>稳定</span>}
                    </td>
                    <td style={{ padding:"9px 12px", textAlign:"right" }}><span style={{ fontSize:17, fontWeight:800, color:v.band.hex }}>{v.score}</span></td>
                    <td style={{ padding:"9px 12px", textAlign:"center" }}><RiskBadge band={v.band} size="sm" /></td>
                    <td style={{ padding:"9px 12px", textAlign:"right" }}>
                      {hi ? (
                        <button onClick={(e)=>{ e.stopPropagation(); if(!done) dispatchOne(v); }} disabled={done} style={{ border:"none", cursor:done?"default":"pointer", fontFamily:"inherit",
                          background: done?"color-mix(in srgb, var(--band-low) 14%, transparent)":"var(--accent-soft)", color: done?"var(--band-low)":"var(--accent)",
                          fontSize:11.5, fontWeight:800, borderRadius:7, padding:"5px 10px", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:5 }}>
                          {done ? (<React.Fragment><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>已派发</React.Fragment>) : "派发整改"}
                        </button>
                      ) : <span style={{ fontSize:11, color:"var(--ink-3)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 风险减量 → 降本测算 */}
      <Card title="风险减量 → 保费 / TCO 降本测算" sub={fleet.short+" · 模拟测算 / 示意目标 · 风险减量与保险经营对齐同一份数据"}>
        <div style={{ display:"grid", gridTemplateColumns:"1.05fr 1fr", gap:"calc(var(--gap) + 6px)", alignItems:"stretch" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
            {levers.map((l,i)=>(
              <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", border:"1px solid var(--border)", borderRadius:11, padding:"12px 13px" }}>
                <div style={{ width:34, height:34, borderRadius:9, flex:"0 0 auto", display:"grid", placeItems:"center",
                  background:"var(--accent-soft)", color:"var(--accent)" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={l.ic} /></svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{l.t}</span>
                    <span style={{ fontSize:11.5, fontWeight:800, color:"var(--band-low)", whiteSpace:"nowrap" }}>{l.m}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:"var(--ink-2)", marginTop:3, lineHeight:1.55 }}>{l.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:12, padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ textAlign:"center", flex:1 }}>
                <div style={{ fontSize:11.5, color:"var(--ink-3)" }}>当前组合风险分</div>
                <div style={{ fontSize:30, fontWeight:800, color:aBand.hex, fontVariantNumeric:"tabular-nums" }}>{avgScore}</div>
              </div>
              <svg width="34" height="20" viewBox="0 0 34 20" fill="none" stroke="var(--ink-3)" strokeWidth="2"><path d="M2 10h28M24 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div style={{ textAlign:"center", flex:1 }}>
                <div style={{ fontSize:11.5, color:"var(--ink-3)" }}>干预后目标</div>
                <div style={{ fontSize:30, fontWeight:800, color:DFM.bandOf(targetScore).hex, fontVariantNumeric:"tabular-nums" }}>{targetScore}</div>
              </div>
            </div>
            <div style={{ height:1, background:"var(--border)" }} />
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {[
                ["保费系数", factorNow.toFixed(2)+"x → "+factorTgt.toFixed(2)+"x", "var(--ink)"],
                ["年度保费可节省", "¥ "+fmWan(premiumSave)+" 万", "var(--band-low)"],
                [evs.length?"电池/残值 TCO 收益":"事故减损收益", "¥ "+fmWan(batterySave>0?batterySave:n*500)+" 万", "var(--band-low)"],
                ["出险频度（改善组）", "−9.2%", "var(--band-low)"]
              ].map(([k,val,c],i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                  <span style={{ fontSize:12.5, color:"var(--ink-2)" }}>{k}</span>
                  <span style={{ fontSize:14.5, fontWeight:800, color:c, fontVariantNumeric:"tabular-nums" }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:2, background:"var(--accent-soft)", borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, color:"var(--ink-2)", fontWeight:700 }}>预计年度风险减量收益</div>
                <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>保费节省 + TCO 收益 · {n} 辆口径</div>
              </div>
              <div style={{ fontSize:26, fontWeight:900, color:"var(--accent)", fontVariantNumeric:"tabular-nums" }}>¥{fmWan(totalSave + (evs.length?0:n*500))} 万</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 电池TCO + 人机共驾 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
        <Card title="电池健康与充电优化 · 纯电车队 TCO" sub={evs.length?(evs.length+" 辆纯电 · SOH / 快充 / 续航达成"):"本车队无纯电车辆"}>
          {evs.length ? (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                <MiniStat label="SOH 均值" value={sohAvg} unit="%" color="var(--band-low)" sub="电池健康度" />
                <MiniStat label="快充占比均值" value={fastAvg} unit="%" color={fastAvg>=45?"var(--band-high)":"var(--ink)"} sub={fastAvg>=45?"偏高 · 建议夜充":"健康区间"} />
                <MiniStat label="续航达成率" value={rangeAvg} unit="%" color="var(--ink)" sub="实测 / 标称" />
                <MiniStat label="电芯压差均值" value={cellDevAvg} unit="mV" color={cellDevAvg>=62?"var(--band-high)":"var(--ink)"} sub={cellDevAvg>=62?"偏大 · 均衡充电":"均衡良好"} />
              </div>
              <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.6, borderTop:"1px solid var(--border)", paddingTop:11 }}>
                把快充依赖从 {fastAvg}% 降到 35% 以内、夜间慢充为主，预计 8 年 SOH 仍 &gt;88% ——
                <b style={{ color:"var(--ink)" }}>电池是运营车队最大的折旧项</b>，养护即降本，并直接支撑三电延保与残值。
              </div>
            </div>
          ) : (
            <div style={{ fontSize:12.5, color:"var(--ink-3)", padding:"20px 0", textAlign:"center" }}>本车队以燃油 / 混动为主，电池与充电维度暂不适用。</div>
          )}
        </Card>

        <Card title="人机共驾安全 · 智驾里程与接管" sub={adasV.length?(adasV.length+" 辆 L2+ · 智驾里程作为保护因子"):"本车队无 L2+ 车辆"}>
          {adasV.length ? (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                <MiniStat label="智驾里程占比" value={adasShare} unit="%" color="var(--accent)" sub="车队均值" />
                <MiniStat label="城市NOA 车辆" value={hpV.length} unit="辆" color="var(--ink)" sub="司南级 · 高阶" />
                <MiniStat label="接管率" value={takeover||"—"} unit="次/千km" color={takeover>=3?"var(--band-high)":"var(--ink)"} sub="高阶领航口径" />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {scenes.map(s=>(
                  <div key={s.k} style={{ display:"grid", gridTemplateColumns:"76px 1fr 64px", alignItems:"center", gap:9 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-2)" }}>{s.k}</span>
                    <div style={{ height:8, borderRadius:5, background:"var(--surface-2)", overflow:"hidden" }}>
                      <div style={{ width:s.share+"%", height:"100%", borderRadius:5, background:"color-mix(in srgb, "+s.col+" 80%, var(--surface-2))" }} />
                    </div>
                    <span style={{ fontSize:10.5, color:s.col, fontWeight:700, textAlign:"right" }}>{s.note}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.6, borderTop:"1px solid var(--border)", paddingTop:10 }}>
                智驾里程越高 → <b style={{ color:"#2A6FDB" }}>人机共驾</b>子分越低 → 拉低从车风险分。接管热点（匝道 / 施工区）回流一汽研发，闭环另一半价值。
              </div>
            </div>
          ) : (
            <div style={{ fontSize:12.5, color:"var(--ink-3)", padding:"20px 0", textAlign:"center" }}>本车队暂无 L2+ 智驾车辆。</div>
          )}
        </Card>
      </div>

      {/* 事故还原/FNOL + 合规预警 */}
      <div style={{ display:"grid", gridTemplateColumns:"1.15fr 1fr", gap:"var(--gap)" }}>
        <Card title="事故还原 · 责任认定 · 快速理赔(FNOL)" sub="EDR + 智驾日志全量存证 · 人机责任一键厘清 · 样例事件">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:4, marginBottom:6 }}>
            {incident.map((e,i)=>(
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", position:"relative" }}>
                {i<incident.length-1 && <div style={{ position:"absolute", top:7, left:"50%", width:"100%", height:2, background:"var(--border)" }} />}
                <div style={{ width:15, height:15, borderRadius:"50%", background:e.c, border:"3px solid var(--surface)", boxShadow:"0 0 0 1.5px "+e.c, position:"relative", zIndex:1 }} />
                <div style={{ fontSize:11, fontWeight:800, color:"var(--ink)", marginTop:6, fontVariantNumeric:"tabular-nums" }}>{e.t}</div>
                <div style={{ fontSize:10, color:"var(--ink-3)", marginTop:2, lineHeight:1.35 }}>{e.e}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginTop:8 }}>
            {fnol.map((f,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--ink-2)", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:9, padding:"8px 11px" }}>
                <span style={{ width:18, height:18, borderRadius:6, flex:"0 0 auto", display:"grid", placeItems:"center", background:"var(--accent-soft)", color:"var(--accent)", fontSize:10.5, fontWeight:800 }}>{i+1}</span>
                <span style={{ lineHeight:1.4 }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:18, marginTop:12, borderTop:"1px solid var(--border)", paddingTop:11 }}>
            {[["−40%","争议案件查勘时效"],["18min","视频查勘接通"],["4.2h","小额案件直赔"]].map(([nx,l])=>(
              <div key={l} style={{ textAlign:"left" }}>
                <div style={{ fontSize:17, fontWeight:800, color:"var(--band-low)", fontVariantNumeric:"tabular-nums" }}>{nx}</div>
                <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="用途 / 路线合规 · 异常用车预警" sub={"行为漂移检测 · 营运/驾驶人变更早识别 · "+(driftL1+driftL2)+" 辆预警"}>
          {driftVs.length ? (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {driftVs.map(v=>{
                const dl=v.drift.level;
                const tag = dl===2?{t:"L2 预警",c:"var(--band-crit)"}:{t:"L1 关注",c:"var(--band-high)"};
                return (
                  <button key={v.id} onClick={()=>onOpenVehicle(v.id)} className="row-hover" style={{ display:"flex", alignItems:"center", gap:11, textAlign:"left", cursor:"pointer", fontFamily:"inherit",
                    border:"1px solid var(--border)", background:"var(--surface)", borderRadius:10, padding:"9px 12px" }}>
                    <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:tag.c, borderRadius:5, padding:"3px 7px", whiteSpace:"nowrap", flex:"0 0 auto" }}>{tag.t}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"var(--ink)" }}>{v.plate} <span style={{ fontSize:11, fontWeight:600, color:"var(--ink-3)" }}>· {v.brand} {v.series}</span></div>
                      <div style={{ fontSize:11, color:"var(--ink-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.drift.reason}</div>
                    </div>
                    <span style={{ fontSize:17, fontWeight:800, color:v.band.hex, fontVariantNumeric:"tabular-nums" }}>{v.score}</span>
                  </button>
                );
              })}
              <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginTop:4 }}>
                {["地理围栏外营运","夜间营运超限","路线随机性突增","急减速强度突变"].map(c=>(
                  <span key={c} style={{ fontSize:11, color:"var(--ink-2)", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:999, padding:"4px 10px" }}>{c}</span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize:12.5, color:"var(--ink-3)", padding:"20px 0", textAlign:"center" }}>本车队连续 12 周行为稳定，无显著漂移。</div>
          )}
        </Card>
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:60,
          background:"var(--ink)", color:"var(--surface)", padding:"12px 20px", borderRadius:10, fontSize:14, fontWeight:700,
          boxShadow:"0 8px 30px rgba(0,0,0,.3)", display:"flex", alignItems:"center", gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--band-low)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          {toast}
        </div>
      )}
    </div>
  );
}
window.FleetMgmtScreen = FleetMgmtScreen;
