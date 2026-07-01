/* ============================================================================
   移动端 Mobile Companion — 鑫安「随身核保」现场工作台（showpiece）
   三屏故事线：锁屏实时推送 → 可交互核保 App（5 工作流）→ 续保报价单
   口径与平台一致：12 特征 / 5 维度模型 · 鑫安在保 7,998 · 上海深评试点 50,000
   交互：底部原生 Tab 导航 · 预警转核保 · 风险减量→费率 实时推演（computeScore12）
   ============================================================================ */
const DM = window.DATA;
const { useState: useStateM, useEffect: useEffectM, useMemo: useMemoM, useRef: useRefM } = React;

/* ---------- 主题色（iOS 原生质感，随 dark 切换）---------- */
function mc(dark){
  return dark
    ? { bg:"#000", wall:"linear-gradient(165deg,#10243f 0%,#0a0f15 60%,#05070a 100%)",
        card:"#1C1C1E", card2:"#2C2C2E", text:"#fff", sec:"rgba(235,235,245,.62)", ter:"rgba(235,235,245,.32)", sep:"rgba(84,84,88,.55)", hair:"rgba(120,120,128,.28)" }
    : { bg:"#F2F2F7", wall:"linear-gradient(165deg,#1f4e8a 0%,#163a66 55%,#0f253f 100%)",
        card:"#fff", card2:"#F2F2F7", text:"#0A0A0C", sec:"rgba(60,60,67,.6)", ter:"rgba(60,60,67,.3)", sep:"rgba(60,60,67,.12)", hair:"rgba(60,60,67,.1)" };
}
const RED = "#ED1C24";
const fmtY = (n) => "¥" + Math.round(n).toLocaleString("en-US");

/* ---------- 费率乘数：取自精算分层（ACT_TIERS），与定价页同口径 ---------- */
function tierMult(bandKey){ const t=(window.ACT_TIERS||[]).find(x=>x.key===bandKey); return t? t.mult : (bandKey==="crit"?1.6:bandKey==="high"?1.25:bandKey==="mid"?1.0:0.78); }
function basePremium(v){ let b=4200; if(v.energy==="纯电") b+=900; if(v.vClass && /中大型|中型|SUV/.test(v.vClass)) b+=600; return b; }
const COMPULSORY = 950; // 交强险（示意）

/* ---------- 小动画 hooks ---------- */
function useCountUp(target, dur, deps){
  const [val,setVal]=useStateM(0);
  useEffectM(()=>{ let raf; const t0=performance.now();
    const tick=(t)=>{ const p=Math.min(1,(t-t0)/(dur||900)); setVal(target*(1-Math.pow(1-p,3))); if(p<1) raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick); return ()=>cancelAnimationFrame(raf);
  }, deps||[]); return val;
}
function useTicker(start, step, interval){
  const [n,setN]=useStateM(start);
  useEffectM(()=>{ const id=setInterval(()=>setN(x=> x + step*(0.5+Math.random())), interval||1700); return ()=>clearInterval(id); },[]);
  return n;
}

/* ---------- 图标 ---------- */
function MIcon({ k, size=22, c="currentColor", w=2 }){
  const p={ width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke:c, strokeWidth:w, strokeLinecap:"round", strokeLinejoin:"round" };
  switch(k){
    case "gauge": return <svg {...p}><path d="M12 13l4-4"/><path d="M3.5 16a9 9 0 1117 0"/><circle cx="12" cy="13" r="1.4" fill={c} stroke="none"/></svg>;
    case "bell": return <svg {...p}><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg>;
    case "scan": return <svg {...p}><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M4 12h16"/></svg>;
    case "shield": return <svg {...p}><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>;
    case "receipt": return <svg {...p}><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3z"/><path d="M9 8h6M9 12h6"/></svg>;
    case "battery": return <svg {...p}><rect x="2" y="7" width="16" height="10" rx="2"/><path d="M21 11v2"/><path d="M9 9l-2 3h3l-2 3"/></svg>;
    case "adas": return <svg {...p}><path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4z"/><circle cx="12" cy="11" r="2.2"/></svg>;
    case "drift": return <svg {...p}><path d="M3 16c3 0 3-6 6-6s3 4 6 4 3-7 6-7"/></svg>;
    case "flag": return <svg {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>;
    case "bolt": return <svg {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>;
    case "chev": return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case "check": return <svg {...p}><path d="M20 6L9 17l-5-5"/></svg>;
    case "pin": return <svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>;
    case "send": return <svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case "cam": return <svg {...p}><path d="M3 8a2 2 0 012-2h2l1.5-2h7L18 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.2"/></svg>;
    case "user": return <svg {...p}><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/></svg>;
    case "spark": return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></svg>;
    default: return null;
  }
}

/* ---------- 数据派生 ---------- */
function useFieldData(){
  return useMemoM(()=>{
    const xinan = DM.INSURERS.find(o=>o.key==="xinan") || { n:DM.XINAN_N, avgScore:501, bands:DM.bandDistribution(DM.FLEET), nevShare:0.28 };
    const book = xinan.n;
    const bands = xinan.bands;
    const critPct = Math.round((bands.crit+bands.high)/book*100);
    const watch = [...DM.FLEET].sort((a,b)=> (b.drift.level-a.drift.level) || (b.score-a.score));
    // 预警事件流
    const TIMES = ["刚刚","2 分钟前","6 分钟前","11 分钟前","18 分钟前","27 分钟前","41 分钟前","56 分钟前","1 小时前","2 小时前","3 小时前"];
    const ev=[];
    DM.FLEET.forEach((v)=>{
      if(v.drift.level===2) ev.push({ sev:"crit", kind:"行为漂移 L2", icon:"drift", v, msg:v.drift.reason });
      if(v.isEV && v.battery && v.battery.warnLevel===2) ev.push({ sev:"crit", kind:"电池热风险", icon:"battery", v, msg:"电芯温差 "+v.battery.cellDev+"mV · 热失控前兆信号" });
      if(v.isADAS && v.adas.tier==="hp" && v.adas.takeoverPer1k>5.2) ev.push({ sev:"high", kind:"智驾接管激增", icon:"adas", v, msg:"高阶 NOA 接管 "+v.adas.takeoverPer1k+" 次/千公里" });
      if(v.drift.kind==="onset") ev.push({ sev:"high", kind:"疑似转营运", icon:"flag", v, msg:"夜间 / 里程 / 路线随机性同步抬升" });
      if(v.isEV && v.battery && v.battery.warnLevel===1) ev.push({ sev:"mid", kind:"电池关注", icon:"battery", v, msg:"SOH "+v.battery.soh+"% · 建议复检" });
    });
    const order={crit:0,high:1,mid:2};
    ev.sort((a,b)=> (order[a.sev]-order[b.sev]) || (b.v.score-a.v.score));
    ev.forEach((e,i)=> e.time = TIMES[Math.min(i,TIMES.length-1)]);
    const alerts = ev.slice(0, 9);
    const critN = alerts.filter(a=>a.sev==="crit").length;
    return { xinan, book, bands, critPct, watch, alerts, critN };
  }, []);
}
function vehDims(v){
  return DM.DIMS.map(d=>{ const na=(d.cond==="ev"&&!v.isEV)||(d.cond==="adas"&&!v.isADAS);
    return { key:d.key, name:d.name, short:d.short, color:d.color, weight:d.w, protective:d.protective, na, val: na?null:v.dims[d.key], sub: v.subs?v.subs[d.key]:null }; });
}

/* ============================================================================
   PHONE 1 · 锁屏实时推送
   ============================================================================ */
function LockAlerts({ dark }){
  const C = mc(dark);
  const D = useFieldData();
  const sevColor = { crit:RED, high:"#FF8200", mid:"#E1A300" };
  const now = new Date();
  const wk = ["周日","周一","周二","周三","周四","周五","周六"][5];
  return (
    <div style={{ position:"absolute", inset:0, background:C.wall, overflow:"hidden" }}>
      {/* 顶部锁与时间 */}
      <div style={{ position:"absolute", top:62, left:0, right:0, textAlign:"center", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.7"><rect x="5" y="11" width="14" height="9" rx="2.4"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>
        </div>
        <div style={{ fontSize:15, fontWeight:600, letterSpacing:".06em", color:"rgba(255,255,255,.85)" }}>{wk} · 6月27日</div>
        <div style={{ fontSize:74, fontWeight:600, lineHeight:1.05, letterSpacing:"-.02em", fontFamily:'-apple-system,system-ui', marginTop:-2 }}>9:41</div>
      </div>
      {/* 通知栈 */}
      <div style={{ position:"absolute", left:12, right:12, bottom:42, display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, padding:"0 8px 2px", color:"rgba(255,255,255,.7)" }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:RED, animation:"gBlink 1.3s infinite" }} />
          <span style={{ fontSize:12.5, fontWeight:700, letterSpacing:".04em" }}>鑫安风控 · {D.critN} 条高危待处理</span>
        </div>
        {D.alerts.slice(0,4).map((a,i)=>(
          <div key={i} style={{ position:"relative", borderRadius:20, overflow:"hidden", animation:`mIn .5s ${i*0.09}s both` }}>
            <div style={{ position:"absolute", inset:0, backdropFilter:"blur(18px) saturate(160%)", WebkitBackdropFilter:"blur(18px) saturate(160%)",
              background: dark? "rgba(40,42,48,.52)":"rgba(255,255,255,.42)", border:"0.5px solid rgba(255,255,255,.18)" }} />
            <div style={{ position:"relative", display:"flex", gap:11, padding:"12px 13px", alignItems:"flex-start" }}>
              <div style={{ width:34, height:34, borderRadius:9, background:sevColor[a.sev], color:"#fff", display:"grid", placeItems:"center", flex:"0 0 auto",
                boxShadow:"0 2px 8px "+sevColor[a.sev]+"66" }}>
                <MIcon k={a.icon} size={19} c="#fff" w={2.1} />
              </div>
              <div style={{ flex:1, minWidth:0, color:"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:800, letterSpacing:"-.01em" }}>{a.kind}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,.7)", flex:"0 0 auto" }}>{a.time}</span>
                </div>
                <div style={{ fontSize:12.5, color:"rgba(255,255,255,.92)", marginTop:2, fontWeight:600 }}>{a.v.plate} · {a.v.brand.replace("一汽","")} {a.v.series}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.78)", marginTop:2, lineHeight:1.45, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.msg}</div>
              </div>
            </div>
          </div>
        ))}
        <div style={{ textAlign:"center", fontSize:12, color:"rgba(255,255,255,.6)", fontWeight:600, marginTop:1 }}>↑ 上滑查看全部 {D.alerts.length} 条</div>
      </div>
    </div>
  );
}

/* ============================================================================
   PHONE 2 · 可交互核保 App
   ============================================================================ */
function StatusChip({ dark, on, label, color, onClick }){
  const C=mc(dark);
  return <button onClick={onClick} style={{ border:"none", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
    fontSize:12.5, fontWeight:700, padding:"6px 12px", borderRadius:999,
    background: on? color : (dark?"rgba(120,120,128,.24)":"#fff"), color: on?"#fff":C.sec,
    boxShadow: on?"none":"0 1px 2px rgba(0,0,0,.05)" }}>{label}</button>;
}
function MiniDims({ v, dark, compact }){
  const C=mc(dark); const ds=vehDims(v);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:compact?7:9 }}>
      {ds.map(d=>(
        <div key={d.key}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, fontWeight:600, color:C.text }}>
              <span style={{ width:7, height:7, borderRadius:2, background:d.na?C.ter:d.color }} />{d.name}
              {d.protective && <span style={{ fontSize:9.5, fontWeight:800, color:"#2A6FDB" }}>保护</span>}
            </span>
            <span style={{ fontSize:12.5, fontWeight:800, color:d.na?C.ter:d.color, fontVariantNumeric:"tabular-nums" }}>{d.na?"—":d.val}</span>
          </div>
          <div style={{ height:6, borderRadius:4, background:dark?"rgba(120,120,128,.24)":"#ECECF1", overflow:"hidden" }}>
            {!d.na && <div style={{ width:d.val+"%", height:"100%", background:d.color, borderRadius:4, transition:"width .5s cubic-bezier(.34,1.2,.4,1)" }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/* —— 总览 Tab —— */
function HomeTab({ dark, D, go }){
  const C=mc(dark);
  const signals = useTicker(63.7, 0.04, 1500);
  const avg = D.xinan.avgScore;
  const cu = useCountUp(D.book, 1100, [D.book]);
  return (
    <div style={{ padding:"0 16px 16px", color:C.text }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"2px 0 14px" }}>
        <div>
          <div style={{ fontSize:31, fontWeight:800, letterSpacing:"-.02em" }}>风险驾驶舱</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#00AF66", animation:"gBlink 1.4s infinite" }} />
            <span style={{ fontSize:12.5, color:C.sec, fontWeight:600 }}>实时同步 · 今日 {signals.toFixed(1)} 亿信号接入</span>
          </div>
        </div>
        <div style={{ width:40, height:40, borderRadius:12, background:RED, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:15, boxShadow:"0 4px 12px "+RED+"55" }}>王</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11, marginBottom:11 }}>
        <div style={{ background:C.card, borderRadius:18, padding:"15px 15px" }}>
          <div style={{ fontSize:12.5, color:C.sec, fontWeight:600 }}>鑫安在保</div>
          <div style={{ fontSize:27, fontWeight:800, fontVariantNumeric:"tabular-nums", marginTop:3 }}>{Math.round(cu).toLocaleString("en-US")}</div>
          <div style={{ fontSize:11, color:C.ter, marginTop:1 }}>上海试点 · 辆</div>
        </div>
        <div style={{ background:C.card, borderRadius:18, padding:"15px 15px" }}>
          <div style={{ fontSize:12.5, color:C.sec, fontWeight:600 }}>组合平均分</div>
          <div style={{ fontSize:27, fontWeight:800, color:RED, fontVariantNumeric:"tabular-nums", marginTop:3 }}>{avg}</div>
          <div style={{ fontSize:11, color:C.ter, marginTop:1 }}>低于基准 = 更优</div>
        </div>
      </div>

      <div style={{ background:C.card, borderRadius:18, padding:16, display:"flex", alignItems:"center", gap:15, marginBottom:11 }}>
        <div style={{ position:"relative", flex:"0 0 auto" }}>
          <Donut counts={D.bands} size={104} thickness={16} />
          <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center", pointerEvents:"none" }}>
            <div><div style={{ fontSize:19, fontWeight:800, color:RED }}>{D.critPct}%</div><div style={{ fontSize:9, color:C.ter }}>中高风险</div></div>
          </div>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:7 }}>
          {DM.BANDS.map(b=>(
            <div key={b.key} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:b.hex }} />
              <span style={{ flex:1, color:C.sec, fontWeight:600 }}>{b.label}</span>
              <b style={{ fontVariantNumeric:"tabular-nums", color:C.text }}>{D.bands[b.key].toLocaleString("en-US")}</b>
            </div>
          ))}
        </div>
      </div>

      <button onClick={()=>go("alerts")} style={{ width:"100%", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
        background:"linear-gradient(110deg,"+RED+" 0%,#c41019 100%)", color:"#fff", borderRadius:18, padding:"14px 16px",
        display:"flex", alignItems:"center", gap:13, marginBottom:14, boxShadow:"0 6px 18px "+RED+"40" }}>
        <span style={{ width:42, height:42, borderRadius:12, background:"rgba(255,255,255,.18)", display:"grid", placeItems:"center", flex:"0 0 auto", animation:"mPing 2s infinite" }}>
          <MIcon k="bell" size={22} c="#fff" />
        </span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15.5, fontWeight:800 }}>{D.critN} 条高危预警待处理</div>
          <div style={{ fontSize:12, opacity:.9, marginTop:1 }}>行为漂移 · 电池热风险 · 智驾接管</div>
        </div>
        <MIcon k="chev" size={20} c="rgba(255,255,255,.8)" />
      </button>

      <div style={{ fontSize:13.5, fontWeight:800, color:C.text, margin:"2px 4px 9px" }}>重点跟进</div>
      <div style={{ background:C.card, borderRadius:18, overflow:"hidden" }}>
        {D.watch.slice(0,4).map((v,i)=>(
          <button key={v.id} onClick={()=>go("underwrite", v.id)} style={{ width:"100%", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
            background:"transparent", display:"flex", alignItems:"center", gap:11, padding:"12px 15px",
            borderBottom: i<3?("0.5px solid "+C.sep):"none" }}>
            <span style={{ width:9, height:9, borderRadius:"50%", background:v.band.hex, flex:"0 0 auto" }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14.5, fontWeight:700, color:C.text }}>{v.plate}
                {v.drift.level>0 && <span style={{ fontSize:10, fontWeight:800, color:"#fff", background: v.drift.level===2?RED:"#FF8200", borderRadius:5, padding:"1px 5px", marginLeft:7 }}>{v.drift.level===2?"L2":"L1"}</span>}
              </div>
              <div style={{ fontSize:11.5, color:C.ter, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.brand.replace("一汽","")} {v.series} · {v.usageLabel}</div>
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:v.band.hex, fontVariantNumeric:"tabular-nums" }}>{v.score}</div>
            <MIcon k="chev" size={16} c={C.ter} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* —— 预警 Tab —— */
function AlertsTab({ dark, D, go }){
  const C=mc(dark);
  const [filter,setFilter]=useStateM("all");
  const sevColor={ crit:RED, high:"#FF8200", mid:"#E1A300" };
  const sevLabel={ crit:"高危", high:"关注", mid:"提示" };
  const FILT=[["all","全部"],["crit","高危"],["battery","电池"],["adas","智驾"],["drift","漂移"]];
  const list = D.alerts.filter(a=> filter==="all" ? true : filter==="crit" ? a.sev==="crit" : a.icon===filter || (filter==="drift"&&a.icon==="flag"));
  return (
    <div style={{ padding:"0 16px 16px", color:C.text }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", margin:"2px 0 12px" }}>
        <div style={{ fontSize:31, fontWeight:800, letterSpacing:"-.02em" }}>实时预警</div>
        <span style={{ fontSize:12.5, color:C.sec, fontWeight:700 }}>{D.alerts.length} 条 · 今日</span>
      </div>
      <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:12, marginBottom:2 }}>
        {FILT.map(([k,l])=>(<StatusChip key={k} dark={dark} on={filter===k} label={l} color={RED} onClick={()=>setFilter(k)} />))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {list.map((a,i)=>(
          <div key={i} style={{ background:C.card, borderRadius:16, overflow:"hidden", display:"flex", animation:`mIn .4s ${i*0.05}s both` }}>
            <div style={{ width:4, background:sevColor[a.sev], flex:"0 0 auto" }} />
            <div style={{ flex:1, padding:"13px 14px", minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:7 }}>
                <span style={{ width:30, height:30, borderRadius:8, background:sevColor[a.sev]+"1f", color:sevColor[a.sev], display:"grid", placeItems:"center", flex:"0 0 auto" }}><MIcon k={a.icon} size={17} /></span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>{a.kind}</div>
                  <div style={{ fontSize:11, color:C.ter }}>{a.v.plate} · {a.v.brand.replace("一汽","")} {a.v.series} · {a.time}</div>
                </div>
                <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:sevColor[a.sev], borderRadius:6, padding:"3px 7px", flex:"0 0 auto" }}>{sevLabel[a.sev]}</span>
              </div>
              <div style={{ fontSize:12.5, color:C.sec, lineHeight:1.5, marginBottom:11 }}>{a.msg}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>go("survey", a.v.id)} style={{ flex:1, border:"0.5px solid "+C.sep, background:"transparent", color:C.text, fontFamily:"inherit",
                  fontSize:12.5, fontWeight:700, padding:"8px 0", borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <MIcon k="scan" size={15} c={C.sec} />派单查勘</button>
                <button onClick={()=>go("underwrite", a.v.id)} style={{ flex:1, border:"none", background:RED, color:"#fff", fontFamily:"inherit",
                  fontSize:12.5, fontWeight:700, padding:"8px 0", borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <MIcon k="shield" size={15} c="#fff" />转核保</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* —— 查勘 Tab（现场查勘）—— */
function SurveyTab({ dark, v }){
  const C=mc(dark);
  const [checks,setChecks]=useStateM({ vin:true, odo:false, ev:false, body:false, adas:false });
  const ITEMS=[["vin","铭牌 VIN 核验"],["odo","里程表读数"],["body","外观与出险痕迹"],["ev","三电系统状态"],["adas","智驾硬件完好"]];
  const done=Object.values(checks).filter(Boolean).length;
  const [shot,setShot]=useStateM([false,false,false]);
  return (
    <div style={{ padding:"0 16px 16px", color:C.text }}>
      <div style={{ fontSize:31, fontWeight:800, letterSpacing:"-.02em", margin:"2px 0 3px" }}>现场查勘</div>
      <div style={{ display:"flex", alignItems:"center", gap:6, color:C.sec, fontSize:12.5, marginBottom:13 }}>
        <MIcon k="pin" size={14} c={RED} /> 上海 · {v.city||"浦东"} · 工单 #SV{String(v.id).replace(/\D/g,"").slice(-4)||"2071"}
      </div>

      <div style={{ background:C.card, borderRadius:18, padding:16, marginBottom:11 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:21, fontWeight:800 }}>{v.plate}</div>
            <div style={{ fontSize:12, color:C.ter, marginTop:2 }}>{v.brand.replace("一汽","")} {v.series} · {v.energy} · {v.year}款</div>
          </div>
          <RiskBadge band={v.band} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginTop:8 }}>
          <Gauge score={v.score} size={150} />
          <div>
            <div style={{ fontSize:38, fontWeight:800, color:v.band.hex, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{v.score}</div>
            <div style={{ fontSize:11.5, color:C.ter, marginTop:3 }}>从车风险分 · 200–997</div>
          </div>
        </div>
      </div>

      <div style={{ background:C.card, borderRadius:18, padding:16, marginBottom:11 }}>
        <div style={{ fontSize:13, fontWeight:800, marginBottom:12 }}>5 维风险画像</div>
        <MiniDims v={v} dark={dark} />
      </div>

      <div style={{ background:C.card, borderRadius:18, padding:"6px 16px", marginBottom:11 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0 3px" }}>
          <span style={{ fontSize:13, fontWeight:800 }}>查勘清单</span>
          <span style={{ fontSize:12, fontWeight:700, color: done===ITEMS.length?"#00AF66":C.sec }}>{done}/{ITEMS.length} 已核</span>
        </div>
        {ITEMS.map(([k,l],i)=>(
          <button key={k} onClick={()=>setChecks(s=>({...s,[k]:!s[k]}))} style={{ width:"100%", border:"none", background:"transparent", cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:11, padding:"11px 0", borderBottom: i<ITEMS.length-1?("0.5px solid "+C.sep):"none" }}>
            <span style={{ width:23, height:23, borderRadius:"50%", flex:"0 0 auto", display:"grid", placeItems:"center",
              background: checks[k]?"#00AF66":"transparent", border: checks[k]?"none":("1.7px solid "+C.ter) }}>
              {checks[k] && <MIcon k="check" size={14} c="#fff" w={3} />}
            </span>
            <span style={{ flex:1, textAlign:"left", fontSize:14.5, fontWeight:600, color:C.text }}>{l}</span>
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:9, marginBottom:13 }}>
        {shot.map((s,i)=>(
          <button key={i} onClick={()=>setShot(a=>a.map((x,j)=>j===i?!x:x))} style={{ flex:1, aspectRatio:"1", borderRadius:14, cursor:"pointer", fontFamily:"inherit",
            border: s?"none":("1.5px dashed "+C.ter), background: s? "linear-gradient(135deg,#2A6FDB,#1b4f9e)":"transparent",
            display:"grid", placeItems:"center", color: s?"#fff":C.ter }}>
            <MIcon k="cam" size={22} c={s?"#fff":C.ter} />
          </button>
        ))}
      </div>

      <button style={{ width:"100%", border:"none", background: done===ITEMS.length?"#00AF66":RED, color:"#fff", fontFamily:"inherit",
        fontSize:15, fontWeight:800, padding:"14px 0", borderRadius:14, cursor:"pointer", boxShadow:"0 6px 16px rgba(0,0,0,.14)" }}>
        提交查勘报告
      </button>
    </div>
  );
}

/* —— 核保 Tab（核保审批 + 风险减量推演）—— */
function UnderwriteTab({ dark, v, go }){
  const C=mc(dark);
  const [improve,setImprove]=useStateM(0);
  const [decision,setDecision]=useStateM("approve");
  const sim = useMemoM(()=>{
    const vals=Object.assign({}, v.f);
    ["speeding","hardDecel","hardTurn","fatigue","night"].forEach(k=>{ if(vals[k]!=null) vals[k]=vals[k]*(1-improve/100); });
    const ctx={ isEV:v.isEV, isADAS:v.isADAS, cv:v.cv };
    const sc=DM.computeScore12(vals, ctx); const band=DM.bandOf(sc.score);
    return { score:sc.score, band, mult:tierMult(band.key) };
  }, [v.id, improve]);
  const base=basePremium(v);
  const mult0=tierMult(v.band.key);
  const prem0=COMPULSORY + base*mult0;
  const prem1=COMPULSORY + base*sim.mult;
  const saving=prem0-prem1;
  const DEC=[["approve","批准承保","#00AF66"],["refer","转人工","#E1A300"],["decline","拒保","#ED1C24"]];
  return (
    <div style={{ padding:"0 16px 16px", color:C.text }}>
      <div style={{ fontSize:31, fontWeight:800, letterSpacing:"-.02em", margin:"2px 0 3px" }}>核保审批</div>
      <div style={{ fontSize:12.5, color:C.sec, marginBottom:13 }}>{v.plate} · {v.brand.replace("一汽","")} {v.series} · {v.usageLabel}</div>

      <div style={{ background:C.card, borderRadius:18, padding:16, marginBottom:11 }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          {[["从车风险分",v.score,v.band.hex],["风险等级",v.band.label,v.band.hex],["费率乘数","×"+mult0.toFixed(2),C.text]].map((x,i)=>(
            <div key={i} style={{ textAlign: i===0?"left":"center" }}>
              <div style={{ fontSize:11.5, color:C.ter, marginBottom:3 }}>{x[0]}</div>
              <div style={{ fontSize: i===1?18:22, fontWeight:800, color:x[2], fontVariantNumeric:"tabular-nums", lineHeight:1.1 }}>{x[1]}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11.5, color:C.ter, marginTop:12, paddingTop:11, borderTop:"0.5px solid "+C.sep, lineHeight:1.5 }}>
          相对风险 {DM.relativeRisk(v.score, DM.PORTFOLIO_MEAN).toFixed(2)}× · 乘数取自精算分层（信度封顶 0.55–1.75）
        </div>
      </div>

      {/* 风险减量推演 */}
      <div style={{ background: dark?"rgba(42,111,219,.12)":"#EEF4FF", borderRadius:18, padding:16, marginBottom:11, border:"0.5px solid "+(dark?"rgba(42,111,219,.3)":"#D5E3FB") }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
          <MIcon k="spark" size={16} c="#2A6FDB" />
          <span style={{ fontSize:13.5, fontWeight:800, color:C.text }}>风险减量推演</span>
        </div>
        <div style={{ fontSize:11.5, color:C.sec, marginBottom:14 }}>若激进驾驶行为改善，实时重算从车风险分与费率</div>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:14, marginBottom:12 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:30, fontWeight:800, color:v.band.hex, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{v.score}</div>
            <div style={{ fontSize:10.5, color:C.ter, marginTop:3 }}>当前</div>
          </div>
          <MIcon k="chev" size={18} c={C.ter} />
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:38, fontWeight:800, color:sim.band.hex, fontVariantNumeric:"tabular-nums", lineHeight:1, transition:"color .3s" }}>{sim.score}</div>
            <div style={{ fontSize:10.5, color:sim.band.hex, marginTop:3, fontWeight:700 }}>{sim.band.label}</div>
          </div>
        </div>
        <input type="range" min="0" max="40" value={improve} onChange={e=>setImprove(+e.target.value)} className="detail-slider"
          style={{ "--pct": (improve/40*100)+"%", "--track-accent":"#2A6FDB" }} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11.5, color:C.sec, marginTop:7, fontWeight:600 }}>
          <span>急加速 / 超速 / 夜行改善</span><span style={{ color:"#2A6FDB", fontWeight:800 }}>−{improve}%</span>
        </div>
      </div>

      {/* 保费联动 */}
      <div style={{ background:C.card, borderRadius:18, padding:16, marginBottom:11 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:800 }}>年保费推算<span style={{ fontSize:10.5, color:C.ter, fontWeight:600 }}> · 示意</span></span>
          {saving>1 && <span style={{ fontSize:11.5, fontWeight:800, color:"#00AF66" }}>风险减量 −{fmtY(saving)}</span>}
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
          {saving>1 && <span style={{ fontSize:16, color:C.ter, textDecoration:"line-through", fontVariantNumeric:"tabular-nums" }}>{fmtY(prem0)}</span>}
          <span style={{ fontSize:33, fontWeight:800, color: saving>1?"#00AF66":C.text, fontVariantNumeric:"tabular-nums", transition:"color .3s" }}>{fmtY(prem1)}</span>
        </div>
        <div style={{ fontSize:11, color:C.ter, marginTop:6 }}>交强 {fmtY(COMPULSORY)} + 商业 {fmtY(base)} × {sim.mult.toFixed(2)}</div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:11 }}>
        {DEC.map(([k,l,col])=>(
          <button key={k} onClick={()=>setDecision(k)} style={{ flex:1, border: decision===k?"none":("0.5px solid "+C.sep), cursor:"pointer", fontFamily:"inherit",
            background: decision===k?col:"transparent", color: decision===k?"#fff":C.sec, fontSize:13, fontWeight:800, padding:"11px 0", borderRadius:11 }}>{l}</button>
        ))}
      </div>
      <button onClick={()=>go("quote", v.id, improve)} style={{ width:"100%", border:"none", background:RED, color:"#fff", fontFamily:"inherit",
        fontSize:15, fontWeight:800, padding:"14px 0", borderRadius:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 6px 16px "+RED+"38" }}>
        出具续保报价 <MIcon k="chev" size={18} c="#fff" />
      </button>
    </div>
  );
}

/* —— 报价 Tab（续保报价单）—— */
function QuoteTab({ dark, v, improve }){
  const C=mc(dark);
  const base=basePremium(v);
  const imp=improve||0;
  const vals=Object.assign({}, v.f);
  ["speeding","hardDecel","hardTurn","fatigue","night"].forEach(k=>{ if(vals[k]!=null) vals[k]=vals[k]*(1-imp/100); });
  const sc=DM.computeScore12(vals, { isEV:v.isEV, isADAS:v.isADAS, cv:v.cv });
  const band=DM.bandOf(sc.score); const mult=tierMult(band.key);
  const commercial=base*mult;
  const reduce = Math.max(0, base*tierMult(v.band.key) - commercial);
  const total=COMPULSORY+commercial;
  const [sent,setSent]=useStateM(false);
  const LINES=[
    ["交强险", COMPULSORY, false],
    ["商业险基准", base, false],
    ["风险系数 ×"+mult.toFixed(2)+"（"+band.label+"）", base*(mult-1), true]
  ];
  return (
    <div style={{ padding:"0 16px 16px", color:C.text }}>
      <div style={{ fontSize:31, fontWeight:800, letterSpacing:"-.02em", margin:"2px 0 3px" }}>续保报价单</div>
      <div style={{ fontSize:12.5, color:C.sec, marginBottom:13 }}>{v.plate} · {v.brand.replace("一汽","")} {v.series} · 保期 12 个月</div>

      <div style={{ background:"linear-gradient(150deg,"+(dark?"#1C1C1E":"#fff")+" 60%,"+(band.hex)+"14)", borderRadius:20, padding:"20px 18px", marginBottom:11, border:"0.5px solid "+C.sep }}>
        <div style={{ fontSize:12.5, color:C.sec, fontWeight:600 }}>年度保费合计 · 示意</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:4, marginTop:4 }}>
          <span style={{ fontSize:44, fontWeight:800, fontVariantNumeric:"tabular-nums", letterSpacing:"-.02em" }}>{fmtY(total)}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:700, color:band.hex, background:band.hex+"1c", borderRadius:999, padding:"4px 10px" }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:band.hex }} />从车风险分 {sc.score} · {band.label}
          </span>
        </div>
      </div>

      <div style={{ background:C.card, borderRadius:18, padding:"4px 16px", marginBottom:11 }}>
        {LINES.map((l,i)=>(
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0", borderBottom: "0.5px solid "+C.sep, fontSize:14 }}>
            <span style={{ color:C.sec }}>{l[0]}</span>
            <b style={{ fontVariantNumeric:"tabular-nums", color: l[2]&&l[1]<0?"#00AF66":C.text }}>{l[1]<0?"−":""}{fmtY(Math.abs(l[1]))}</b>
          </div>
        ))}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", fontSize:15 }}>
          <b>合计</b><b style={{ fontVariantNumeric:"tabular-nums", fontSize:18 }}>{fmtY(total)}</b>
        </div>
      </div>

      {reduce>1 && (
        <div style={{ background: dark?"rgba(0,175,102,.14)":"#E7F7EE", borderRadius:16, padding:"13px 15px", marginBottom:11, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:700, color:"#00AF66" }}><MIcon k="spark" size={16} c="#00AF66" />行为改善 −{imp}% · 较改善前</span>
          <span style={{ fontSize:17, fontWeight:800, color:"#00AF66", fontVariantNumeric:"tabular-nums" }}>省 {fmtY(reduce)}/年</span>
        </div>
      )}
      <div style={{ background: dark?"rgba(120,120,128,.16)":"#F2F2F7", borderRadius:16, padding:"13px 15px", marginBottom:14, display:"flex", gap:10, alignItems:"flex-start" }}>
        <MIcon k="shield" size={18} c={C.sec} />
        <div style={{ fontSize:12.5, color:C.sec, lineHeight:1.5 }}>该报价由 <b style={{color:C.text}}>从车风险分</b> 直接驱动，每一分都可回溯到 12 项行为特征 —— 做得到的减量，看得见的降费。</div>
      </div>

      <button onClick={()=>setSent(true)} style={{ width:"100%", border:"none", background: sent?"#00AF66":RED, color:"#fff", fontFamily:"inherit",
        fontSize:15, fontWeight:800, padding:"14px 0", borderRadius:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 6px 16px rgba(0,0,0,.14)", transition:"background .3s" }}>
        {sent ? <><MIcon k="check" size={18} c="#fff" w={3} />已发送给车主</> : <><MIcon k="send" size={17} c="#fff" />发送报价给车主</>}
      </button>
    </div>
  );
}

/* —— App 外壳：底部原生 Tab —— */
function FieldApp({ dark }){
  const C=mc(dark);
  const D=useFieldData();
  const [tab,setTab]=useStateM("home");
  const [vid,setVid]=useStateM(()=> (D.watch[0]&&D.watch[0].id) || DM.FLEET[0].id);
  const [improve,setImprove]=useStateM(0);
  const v = DM.FLEET.find(x=>x.id===vid) || DM.FLEET[0];
  const go=(t, id, imp)=>{ if(id!=null) setVid(id); if(imp!=null) setImprove(imp); setTab(t); };
  const TABS=[["home","总览","gauge"],["alerts","预警","bell"],["survey","查勘","scan"],["underwrite","核保","shield"],["quote","报价","receipt"]];
  return (
    <div style={{ position:"absolute", inset:0, background:C.bg, display:"flex", flexDirection:"column" }}>
      <div key={tab} style={{ flex:1, overflow:"auto", paddingTop:58, WebkitOverflowScrolling:"touch", animation:"mIn .32s both" }}>
        {tab==="home" && <HomeTab dark={dark} D={D} go={go} />}
        {tab==="alerts" && <AlertsTab dark={dark} D={D} go={go} />}
        {tab==="survey" && <SurveyTab dark={dark} v={v} />}
        {tab==="underwrite" && <UnderwriteTab dark={dark} v={v} go={go} />}
        {tab==="quote" && <QuoteTab dark={dark} v={v} improve={improve} />}
      </div>
      {/* 底部 Tab 栏（玻璃质感） */}
      <div style={{ position:"relative", flex:"0 0 auto", paddingBottom:26 }}>
        <div style={{ position:"absolute", inset:0, backdropFilter:"blur(20px) saturate(180%)", WebkitBackdropFilter:"blur(20px) saturate(180%)",
          background: dark?"rgba(22,22,24,.78)":"rgba(255,255,255,.82)", borderTop:"0.5px solid "+C.sep }} />
        <div style={{ position:"relative", display:"flex", padding:"8px 6px 2px" }}>
          {TABS.map(([k,l,ic])=>{
            const on=tab===k; const badge = k==="alerts" ? D.critN : 0;
            return (
              <button key={k} onClick={()=>setTab(k)} style={{ flex:1, border:"none", background:"transparent", cursor:"pointer", fontFamily:"inherit",
                display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"4px 0", position:"relative" }}>
                <span style={{ position:"relative" }}>
                  <MIcon k={ic} size={23} c={on?RED:C.ter} w={on?2.2:2} />
                  {badge>0 && <span style={{ position:"absolute", top:-4, right:-8, minWidth:15, height:15, borderRadius:999, background:RED, color:"#fff",
                    fontSize:9.5, fontWeight:800, display:"grid", placeItems:"center", padding:"0 3px", border:"1.5px solid "+(dark?"#161618":"#fff") }}>{badge}</span>}
                </span>
                <span style={{ fontSize:10, fontWeight:on?800:600, color:on?RED:C.ter, letterSpacing:".01em" }}>{l}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   MobileScreen — 三屏故事线
   ============================================================================ */
function PhoneFrame({ children, dark }){
  return (
    <div style={{ width:384, height:832, borderRadius:46, overflow:"hidden", position:"relative", flex:"0 0 auto",
      background: dark?"#000":"#F2F2F7", boxShadow:"0 40px 80px rgba(0,0,0,.20), 0 0 0 1px rgba(0,0,0,.1)", fontFamily:'-apple-system, system-ui, sans-serif', WebkitFontSmoothing:"antialiased" }}>
      <div style={{ position:"absolute", top:11, left:"50%", transform:"translateX(-50%)", width:120, height:35, borderRadius:22, background:"#000", zIndex:50 }} />
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:40 }}><IOSStatusBar dark={dark} /></div>
      {children}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:60, height:30, display:"flex", justifyContent:"center", alignItems:"flex-end", paddingBottom:8, pointerEvents:"none" }}>
        <div style={{ width:128, height:5, borderRadius:100, background: dark?"rgba(255,255,255,.7)":"rgba(0,0,0,.25)" }} />
      </div>
    </div>
  );
}

function MobileScreen({ dark }){
  const phones=[
    { cap:"锁屏推送 · 实时风险", sub:"夜勤 / 离线也不漏报", node:<LockAlerts dark={dark} />, d:dark },
    { cap:"核保驾驶舱 · 可交互", sub:"5 工作流 · 点击底部切换", node:<FieldApp dark={dark} />, d:dark },
    { cap:"续保报价单 · 数据驱动", sub:"风险分 → 费率，可回溯", node:<QuotePhone dark={dark} />, d:dark }
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div className="card" style={{ padding:"18px 20px", display:"flex", alignItems:"center", gap:18, flexWrap:"wrap",
        background:"linear-gradient(115deg, var(--surface) 60%, var(--accent-soft))" }}>
        <div style={{ flex:"1 1 320px", minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:800, color:"var(--accent)", letterSpacing:".06em" }}>随身核保 · 现场工作台</div>
          <div style={{ fontSize:20, fontWeight:800, color:"var(--ink)", marginTop:5, lineHeight:1.4 }}>把驾驶舱装进口袋：预警、查勘、核保、报价，一条线走完</div>
          <div style={{ fontSize:12.5, color:"var(--ink-3)", marginTop:7, lineHeight:1.6 }}>核保主管与现场查勘的随身视图 · 与平台同一套 12 特征 / 5 维度模型、同一份在保口径</div>
        </div>
        <div style={{ display:"flex", gap:22 }}>
          {[["7,998","在保跟进"],["实时","预警推送"],["1 滑","减量→费率"]].map((x,i)=>(
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{x[0]}</div>
              <div style={{ fontSize:11.5, color:"var(--ink-3)", fontWeight:600, marginTop:2 }}>{x[1]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:26, justifyContent:"center", alignItems:"flex-start", flexWrap:"wrap", padding:"4px 0 26px" }}>
        {phones.map((p,i)=>(
          <div key={i} style={{ textAlign:"center" }}>
            <PhoneFrame dark={p.d}>{p.node}</PhoneFrame>
            <div style={{ marginTop:15, fontSize:14, fontWeight:800, color:"var(--ink)" }}>{p.cap}</div>
            <div style={{ marginTop:2, fontSize:12, color:"var(--ink-3)" }}>{p.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 第三屏：独立报价（默认演示一辆代表车 + 已减量 18%） */
function QuotePhone({ dark }){
  const C=mc(dark);
  const v = useMemoM(()=>{
    const s=[...DM.FLEET].sort((a,b)=>b.score-a.score);
    const crosses = s.find(x=>{ if(x.band.key==="low") return false;
      const vals=Object.assign({}, x.f); ["speeding","hardDecel","hardTurn","fatigue","night"].forEach(k=>{ if(vals[k]!=null) vals[k]*=0.78; });
      const sc=DM.computeScore12(vals, { isEV:x.isEV, isADAS:x.isADAS, cv:x.cv });
      return DM.bandOf(sc.score).key !== x.band.key; });
    return crosses || s.find(x=>x.drift.kind==="exit") || s[Math.floor(s.length*0.3)];
  }, []);
  return (
    <div style={{ position:"absolute", inset:0, background:C.bg }}>
      <div style={{ height:"100%", overflow:"auto", paddingTop:58 }}>
        <QuoteTab dark={dark} v={v} improve={22} />
      </div>
    </div>
  );
}

window.MobileScreen = MobileScreen;
