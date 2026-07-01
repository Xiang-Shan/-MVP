/* ============================================================================
   车主互动 Driver Engagement — 为什么活跃度本身就是资产
   逻辑链（给一汽集团讲）：
   保险是 2 次/年的低频生意，但数据是 7×24 连续的 ——
   车主持续授权数据的前提，是他每周都能拿回「有感的价值」。
   高频场景（充电/行程/电池报告）养活跃 → 活跃沉淀授权与行为改善 →
   改善反哺赔付率与续保 → 同一套互动同时是一汽的私域与复购抓手。
   v2 · 克制入场动画 + 可悬停联动 + 频率阶梯可视化 + 价值卡片可扫读
   ============================================================================ */
const DDr = window.DATA;
const { useMemo: useMemoDr, useState: useStateDr, useEffect: useEffectDr, useRef: useRefDr } = React;

/* ---- 自包含动画工具：入场挂载 / 数字滚动 / 指标解析 ---- */
function DrMounted(){
  const [m,setM]=useStateDr(false);
  useEffectDr(()=>{ const a=requestAnimationFrame(()=>requestAnimationFrame(()=>setM(true))); return ()=>cancelAnimationFrame(a); },[]);
  return m;
}
function DrCount({ value, dur=950, dp=0, prefix="", suffix="" }){
  const [v,setV]=useStateDr(0);
  useEffectDr(()=>{
    let raf; const t0=performance.now();
    const tick=(t)=>{ const p=Math.min(1,(t-t0)/dur); const e=1-Math.pow(1-p,3); setV(value*e); if(p<1) raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick); return ()=>cancelAnimationFrame(raf);
  },[value,dur]);
  return <span>{prefix}{v.toFixed(dp)}{suffix}</span>;
}
function parseMetric(str){
  const m=String(str).match(/^([^\d.]*?)(\d+(?:\.\d+)?)(.*)$/);
  if(!m) return { prefix:"", num:0, dp:0, suffix:str };
  const dp=m[2].includes(".")?1:0;
  return { prefix:m[1], num:parseFloat(m[2]), dp, suffix:m[3] };
}
function freqPerMonth(n){
  const m=String(n).match(/([\d.]+)/); if(!m) return 0;
  const x=parseFloat(m[1]); return /年/.test(n)? x/12 : x;
}

/* circular health ring (driver-facing: higher = better) · 入场描绘 */
function HealthRing({ value, size = 124 }){
  const mounted=DrMounted();
  const r = (size-16)/2, C = 2*Math.PI*r, cx = size/2;
  const col = value>=80 ? "var(--band-low)" : value>=60 ? "var(--band-mid)" : "var(--band-high)";
  return (
    <div style={{ position:"relative", width:size, height:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(value/100*C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={mounted?0:(value/100*C)}
          transform={`rotate(-90 ${cx} ${cx})`} style={{ transition:"stroke-dashoffset 1.1s cubic-bezier(.4,1,.4,1)" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", textAlign:"center" }}>
        <div>
          <div style={{ fontSize:31, fontWeight:800, color:"var(--ink)", lineHeight:1 }}>{mounted?<DrCount value={value} />:0}</div>
          <div style={{ fontSize:10.5, color:"var(--ink-3)", marginTop:2 }}>驾驶健康分</div>
        </div>
      </div>
    </div>
  );
}

/* ---- 手机①：我的驾驶（任务 · 等级 · 权益商城）---- */
function DriverApp({ v, oem }){
  const health = Math.round(100 - (v.score - DDr.SCORE_MIN)/(DDr.SCORE_MAX - DDr.SCORE_MIN)*64);
  const peer = 100 - Math.round((v.score - DDr.SCORE_MIN)/(DDr.SCORE_MAX - DDr.SCORE_MIN)*70);
  const tasks = [
    { t:"平稳起步挑战", d:"连续 5 天急加速 ≤1 次/日", pts:"+120", done:3, total:5 },
    { t:"夜间慢充任务", d:"本周完成 3 次家充慢充", pts:"+80", done:2, total:3 },
    { t:"电池月报已读", d:"查看 6 月电池健康报告", pts:"+20", done:1, total:1 }
  ];
  return (
    <div style={{ padding:"50px 15px 28px", display:"flex", flexDirection:"column", gap:12, color:"var(--ink)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:oem.color, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:12 }}>{oem.avatar}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:"var(--ink-3)" }}>{oem.name} · 车主端</div>
          <div style={{ fontSize:16, fontWeight:800 }}>我的驾驶</div>
        </div>
        <div style={{ fontSize:11, fontWeight:800, color:"#B8860B", background:"color-mix(in srgb, #E1A300 14%, transparent)", border:"1px solid color-mix(in srgb, #E1A300 40%, transparent)", padding:"4px 10px", borderRadius:999 }}>金卡 Lv.4</div>
      </div>

      <div style={{ background:"var(--surface)", borderRadius:18, padding:"16px 15px", display:"flex", alignItems:"center", gap:15 }}>
        <HealthRing value={health} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:"var(--band-low)" }}>超过 {peer}% 同款车主</div>
          <div style={{ margin:"5px 0 3px" }}>
            <Sparkline data={v.trend.map(s => Math.round(100 - (s - DDr.SCORE_MIN)/(DDr.SCORE_MAX - DDr.SCORE_MIN)*64))} w={110} h={24} color="var(--band-low)" />
          </div>
          <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>近 8 周趋势 · 升级再得 200 分</div>
        </div>
      </div>

      <div style={{ fontSize:12.5, fontWeight:800, color:"var(--ink-2)" }}>本周任务 · 完成得积分</div>
      {tasks.map((tk,i) => (
        <div key={i} style={{ background:"var(--surface)", borderRadius:14, padding:"11px 13px", display:"flex", alignItems:"center", gap:11 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <span style={{ fontSize:13, fontWeight:800 }}>{tk.t}</span>
              <span style={{ fontSize:12, fontWeight:800, color:"var(--accent)" }}>{tk.pts}</span>
            </div>
            <div style={{ fontSize:11, color:"var(--ink-3)", margin:"3px 0 6px" }}>{tk.d}</div>
            <div style={{ height:5, borderRadius:3, background:"var(--surface-2)", overflow:"hidden" }}>
              <div style={{ width:(tk.done/tk.total*100)+"%", height:"100%", borderRadius:3, background: tk.done===tk.total ? "var(--band-low)" : "var(--accent)" }} />
            </div>
          </div>
        </div>
      ))}

      <div style={{ background:"linear-gradient(120deg, var(--accent-soft), transparent)", border:"1px solid var(--border)", borderRadius:14, padding:"13px 15px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:800 }}>积分商城</div>
            <div style={{ fontSize:11, color:"var(--ink-3)", marginTop:2 }}>积分与集团会员体系互通</div>
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:"var(--accent)", fontVariantNumeric:"tabular-nums" }}>1,280</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7, marginTop:10 }}>
          {[["⚡","充电券 ¥20","600 分"],["🔧","保养代金券","900 分"],["🛡","续保立减 5%","1,200 分"]].map(([ic,t,p],i)=>(
            <div key={i} style={{ background:"var(--surface)", borderRadius:11, padding:"9px 6px", textAlign:"center" }}>
              <div style={{ fontSize:16 }}>{ic}</div>
              <div style={{ fontSize:10.5, fontWeight:800, marginTop:3 }}>{t}</div>
              <div style={{ fontSize:9.5, color:"var(--ink-3)", marginTop:1 }}>{p}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- 手机②：电池健康月报（高频信任锚点）---- */
function BatteryReportApp({ v, oem }){
  const b = v.battery;
  const fastHigh = v.vals.fast >= 45;
  return (
    <div style={{ padding:"50px 15px 28px", display:"flex", flexDirection:"column", gap:12, color:"var(--ink)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:oem.color, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:12 }}>{oem.avatar}</div>
        <div>
          <div style={{ fontSize:11, color:"var(--ink-3)" }}>{oem.name} · 车主端</div>
          <div style={{ fontSize:16, fontWeight:800 }}>6 月电池健康报告</div>
        </div>
      </div>

      <div style={{ background:"var(--surface)", borderRadius:18, padding:"17px 16px" }}>
        <div style={{ display:"flex", alignItems:"flex-end", gap:10 }}>
          <div style={{ fontSize:44, fontWeight:900, lineHeight:1, color:"var(--band-low)" }}>{b.soh}%</div>
          <div style={{ paddingBottom:4 }}>
            <div style={{ fontSize:12, fontWeight:800 }}>电池健康度 SOH</div>
            <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>较上月 −0.1% · 属正常衰减</div>
          </div>
        </div>
        <div style={{ height:8, borderRadius:4, background:"var(--surface-2)", overflow:"hidden", margin:"12px 0 6px" }}>
          <div style={{ width:b.soh+"%", height:"100%", borderRadius:4, background:"linear-gradient(90deg, var(--band-low), color-mix(in srgb, var(--band-low) 60%, #fff))" }} />
        </div>
        <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>优于 {Math.min(96, Math.round((b.soh-87)/12*82)+14)}% 同车龄同款 · 已行驶 {b.cycles} 个等效循环</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[["本月续航达成", b.rangeAchieve+"%", "夏季空调小幅折损"],["电芯压差", b.cellDev+" mV", b.cellDev>=62?"偏大 · 建议均衡充电":"均衡 · 状态良好"]].map(([t,n,d],i)=>(
          <div key={i} style={{ background:"var(--surface)", borderRadius:13, padding:"11px 12px" }}>
            <div style={{ fontSize:17, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{n}</div>
            <div style={{ fontSize:10.5, fontWeight:700, marginTop:2 }}>{t}</div>
            <div style={{ fontSize:9.5, color:"var(--ink-3)", marginTop:1 }}>{d}</div>
          </div>
        ))}
      </div>

      <div style={{ background:"var(--surface)", borderRadius:16, padding:"13px 15px" }}>
        <div style={{ fontSize:12.5, fontWeight:800, marginBottom:8 }}>本月充电结构</div>
        <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", gap:2 }}>
          <div style={{ flex:100-v.vals.fast, background:"var(--band-low)", borderRadius:3 }} />
          {v.vals.fast>0 && <div style={{ flex:v.vals.fast, background:"var(--band-high)", borderRadius:3 }} />}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:"var(--ink-3)", marginTop:5 }}>
          <span>慢充 {100-v.vals.fast}%</span><span>快充 {v.vals.fast}%</span>
        </div>
        <div style={{ fontSize:11.5, marginTop:8, lineHeight:1.55, color: fastHigh ? "var(--band-high)" : "var(--band-low)", fontWeight:700 }}>
          {fastHigh ? "快充偏多：长期将加速衰减，建议夜间家充为主，可同时完成「夜间慢充任务」得积分。" : "充电结构健康，按当前习惯，预计 8 年后 SOH 仍 >88%。"}
        </div>
      </div>

      <div style={{ background:"var(--accent-soft)", borderRadius:14, padding:"12px 15px", display:"flex", gap:10, alignItems:"center" }}>
        <div style={{ fontSize:18 }}>🛡️</div>
        <div style={{ fontSize:11.5, color:"var(--ink)", lineHeight:1.55 }}>
          基于本报告，您的爱车符合<b>三电延保优惠</b>与<b>续保立减</b>条件 —— 由鑫安车险提供，点击查看专属报价。
        </div>
      </div>
    </div>
  );
}

/* ---- 证据链漏斗（入场升起 + 悬停 + 流失提示）---- */
function EvidenceFunnel(){
  const F = DDr.ENGAGE.funnel;
  const mounted = DrMounted();
  const [hi,setHi] = useStateDr(null);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {F.map((s, i) => {
        const prev = i>0 ? F[i-1].v : null;
        const keep = prev ? Math.round(s.v/prev*100) : null;
        const active = hi===i;
        return (
          <div key={s.k} onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(null)}
            style={{ display:"flex", alignItems:"center", gap:11, cursor:"default", opacity: hi!=null&&!active?0.55:1, transition:"opacity .15s" }}>
            <div style={{ width:64, fontSize:12.5, fontWeight:800, color:"var(--ink)", textAlign:"right", flex:"0 0 auto" }}>{s.k}</div>
            <div style={{ flex:1 }}>
              <div style={{ width:mounted?(18 + s.v * 0.82)+"%":"0%", height:26, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:9,
                background:`color-mix(in srgb, var(--accent) ${26 + i * 22}%, var(--surface-2))`,
                color: i >= 2 ? "#fff" : "var(--ink)", fontSize:12.5, fontWeight:800, fontVariantNumeric:"tabular-nums",
                transform: active?"scaleX(1.005)":"none", transformOrigin:"left",
                transition:`width .85s cubic-bezier(.3,1,.4,1) ${i*0.08}s` }}>{s.v}%</div>
              <div style={{ fontSize:10.5, color:"var(--ink-3)", marginTop:2 }}>{s.d}</div>
            </div>
            {keep!=null && (
              <div style={{ width:48, flex:"0 0 auto", textAlign:"left", fontSize:10.5, fontWeight:800, color:"var(--ink-3)", fontVariantNumeric:"tabular-nums", opacity:active?1:0.7 }}>↳ {keep}%</div>
            )}
          </div>
        );
      })}
      <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
        {DDr.ENGAGE.outcomes.map((o,i) => { const p=parseMetric(o.v); return (
          <div key={o.k} style={{ flex:"1 1 0", minWidth:108, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:10, padding:"9px 11px",
            opacity:mounted?1:0, transform:mounted?"none":"translateY(6px)", transition:`opacity .5s ${0.5+i*0.1}s, transform .5s ${0.5+i*0.1}s` }}>
            <div style={{ fontSize:17, fontWeight:800, color:"var(--band-low)", fontVariantNumeric:"tabular-nums" }}>
              {mounted ? <DrCount value={p.num} dp={p.dp} prefix={p.prefix} suffix={p.suffix} dur={1000} /> : "0"}
            </div>
            <div style={{ fontSize:11.5, fontWeight:700, color:"var(--ink)" }}>{o.k}</div>
            <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>{o.d}</div>
          </div>
        ); })}
      </div>
    </div>
  );
}

/* ---- 高频带低频 · 频率阶梯（按真实频次成比例可视化）---- */
function FreqLadder(){
  const mounted = DrMounted();
  const [hi,setHi] = useStateDr(null);
  const roleStyle = {
    hi:     { t:"高频入口",  c:"#1E50A0" },
    anchor: { t:"信任锚点",  c:"var(--band-low)" },
    oem:    { t:"一汽触点",  c:"var(--band-mid)" },
    lo:     { t:"低频被带动", c:"var(--accent)" }
  };
  const rows = DDr.ENGAGE.freq.map(f => ({ ...f, pm: freqPerMonth(f.n) }));
  const max = Math.max(...rows.map(r=>r.pm));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {rows.map((f,i) => {
        const r = roleStyle[f.role];
        const active = hi===i;
        const w = Math.max(3, f.pm/max*100);
        return (
          <div key={f.k} onMouseEnter={()=>setHi(i)} onMouseLeave={()=>setHi(null)}
            style={{ display:"flex", alignItems:"center", gap:11, padding:"7px 11px", borderRadius:10,
              background:"var(--surface-2)", border:"1px solid var(--border)", opacity:hi!=null&&!active?0.55:1, transition:"opacity .15s" }}>
            <div style={{ width:96, flex:"0 0 auto", fontSize:13, fontWeight:800, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.k}</div>
            <div style={{ flex:1, height:14, position:"relative", borderRadius:7, background:"var(--surface)", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, width:mounted?w+"%":"0%", borderRadius:7,
                background:`color-mix(in srgb, ${r.c} 78%, var(--surface-2))`, transition:`width .9s cubic-bezier(.3,1,.4,1) ${i*0.07}s` }} />
            </div>
            <div style={{ width:62, flex:"0 0 auto", textAlign:"right", fontSize:12.5, fontWeight:800, color:"var(--ink-2)", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{f.n}</div>
            <span style={{ width:74, flex:"0 0 auto", textAlign:"center", fontSize:10.5, fontWeight:800, color:r.c, border:`1px solid color-mix(in srgb, ${r.c} 40%, transparent)`,
              background:`color-mix(in srgb, ${r.c} 9%, transparent)`, padding:"3px 0", borderRadius:999, whiteSpace:"nowrap" }}>{r.t}</span>
          </div>
        );
      })}
      <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.6, marginTop:2 }}>
        保险本身只有 <b>2 次/年</b>的天然触点（最短一条）。把续保、延保、理赔<b>嵌进</b>充电、行程与电池报告这些每周必来的场景，
        低频生意才第一次拥有了高频的入口。
      </div>
    </div>
  );
}

/* ---- 价值卡片：可扫读的指标行 ---- */
function ValueRows({ items, dot }){
  const mounted = DrMounted();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      {items.map((r,i)=>{
        const p = r.metric ? parseMetric(r.metric) : null;
        return (
          <div key={i} className="row-hover" style={{ display:"flex", gap:13, alignItems:"flex-start", padding:"6px 8px", margin:"0 -8px", borderRadius:10,
            opacity:mounted?1:0, transform:mounted?"none":"translateY(6px)", transition:`opacity .45s ${i*0.07}s, transform .45s ${i*0.07}s` }}>
            <div style={{ flex:"0 0 auto", width:66, textAlign:"right" }}>
              <div style={{ fontSize:19, fontWeight:900, color:dot, fontVariantNumeric:"tabular-nums", lineHeight:1.05 }}>
                {p ? (mounted ? <DrCount value={p.num} dp={p.dp} prefix={p.prefix} suffix={p.suffix} dur={1000} /> : "0") : r.tag}
              </div>
            </div>
            <div style={{ flex:1, minWidth:0, borderLeft:"2px solid var(--border)", paddingLeft:12 }}>
              <b style={{ fontSize:13.5, color:"var(--ink)" }}>{r.t}</b>
              <div style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.55, marginTop:2 }}>{r.d}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DriverScreen({ dark }){
  const mounted = DrMounted();
  const v = useMemoDr(() => {
    const sorted = [...DDr.FLEET].filter(x=>x.oem==="vw").sort((a,b)=>a.score-b.score);
    return sorted[Math.floor(sorted.length*0.55)];
  }, []);
  const oem = DDr.OEMS.find(o=>o.id===v.oem);
  const proof = [
    { v:"−9.2%", l:"改善组出险频度", tag:"风控", c:"var(--band-low)" },
    { v:"96%",   l:"数据授权留存率", tag:"数据", c:"var(--accent)" },
    { v:"+23%",  l:"车主 App 月活", tag:"主业", c:"#1E50A0" }
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"calc(var(--gap) + 2px)" }}>
      {/* 叙事头：为什么活跃度本身就是资产 */}
      <div className="card" style={{ padding:"calc(var(--card-pad) + 4px)", background:"linear-gradient(120deg, var(--surface) 52%, var(--accent-soft))" }}>
        <div style={{ display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ flex:"1 1 440px", minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:".04em" }}>站在集团大局 · 车主价值与风险减量</div>
            <div style={{ fontSize:23, fontWeight:800, color:"var(--ink)", marginTop:6, lineHeight:1.4 }}>让每一位一汽车主，<br/>都被看见、被服务、更安全</div>
            <div style={{ fontSize:13.5, color:"var(--ink-2)", marginTop:11, lineHeight:1.65, maxWidth:560 }}>
              鑫安以律商风险的标准特征库，把每周的用车数据，变成车主<b>看得懂的驾驶健康分、关乎钱包的电池报告、做得到的省钱任务</b>。
              行为因此改善、安全被正向激励、数据授权持续留存 —— 同一套互动，既服务好集团车主，也反哺鑫安的定价与风控。
            </div>
          </div>
          {/* 三个证据点 */}
          <div style={{ flex:"0 0 auto", display:"flex", gap:14, flexWrap:"wrap" }}>
            {proof.map((s,i)=>{ const p=parseMetric(s.v); return (
              <div key={s.l} style={{ minWidth:118, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:13, padding:"14px 15px",
                opacity:mounted?1:0, transform:mounted?"none":"translateY(8px)", transition:`opacity .5s ${0.2+i*0.12}s, transform .5s ${0.2+i*0.12}s` }}>
                <span style={{ fontSize:10, fontWeight:800, color:s.c, border:`1px solid color-mix(in srgb, ${s.c} 40%, transparent)`, background:`color-mix(in srgb, ${s.c} 9%, transparent)`, padding:"2px 7px", borderRadius:999 }}>{s.tag}</span>
                <div style={{ fontSize:30, fontWeight:900, color:s.c, fontVariantNumeric:"tabular-nums", lineHeight:1, marginTop:9 }}>
                  {mounted ? <DrCount value={p.num} dp={p.dp} prefix={p.prefix} suffix={p.suffix} dur={1100} /> : "0"}
                </div>
                <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:4 }}>{s.l}</div>
              </div>
            ); })}
          </div>
        </div>
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", gap:"calc(var(--gap) + 4px)", alignItems:"flex-start" }}>
        <div style={{ display:"flex", gap:22, alignItems:"flex-start", flexWrap:"wrap", flex:"0 1 auto" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <IOSDevice dark={dark}><DriverApp v={v} oem={oem} /></IOSDevice>
            <div style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)", textAlign:"center", maxWidth:290 }}>机制：任务 · 等级 · 积分商城（充电/保养/续保权益）</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <IOSDevice dark={dark}><BatteryReportApp v={v} oem={oem} /></IOSDevice>
            <div style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)", textAlign:"center", maxWidth:290 }}>信任锚点：电池健康月报 → 自然带出延保与续保</div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)", flex:"1 1 300px", minWidth:300 }}>
          <Card title="高频带低频 · 触点频率阶梯" sub="把 2 次/年的保险，嵌进每月数十次的用车场景">
            <FreqLadder />
          </Card>
          <Card title="证据链 · 活跃如何变成钱" sub="试点 3 个月 · 改善组 vs 对照组">
            <EvidenceFunnel />
          </Card>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
        <Card title="对鑫安的价值" sub="低频险企第一次拥有经营「过程」的能力">
          <ValueRows dot="var(--accent)" items={[
            { metric:"96%",   t:"授权留存 = 数据资产安全", d:"活跃车主授权留存率，数据连续性是评分模型 PSI 稳定的前提。" },
            { metric:"−9.2%", t:"事中干预降赔付", d:"高风险行为当周触达劝导，改善组出险频度下降 —— 赔付率改善先于定价兑现。" },
            { metric:"90天",  t:"续保从「比价」变「留存」", d:"权益进度（续保立减档位）让续保决策前置，摆脱单一价格战。" },
            { tag:"新", t:"新险种获客通道", d:"电池月报直连三电延保报价，转化成本远低于电销。" }
          ]} />
        </Card>
        <Card title="对一汽集团的价值" sub="同一套互动，反哺整车主业">
          <ValueRows dot="#1E50A0" items={[
            { metric:"+23%", t:"私域运营抓手", d:"驾驶健康分、电池报告、任务体系激活车主 App（接入后 3 个月）。" },
            { metric:"1.8×", t:"置换与复购", d:"高活跃车主置换留存率为低活跃组倍数 —— 电池健康档案支撑认证二手车残值。" },
            { metric:"+14%", t:"售后回厂", d:"预警工单 + 保养券权益引导回厂，对冲独立售后分流。" },
            { tag:"通", t:"会员体系打通", d:"安全积分与集团会员积分互通，保险权益成为会员体系中最「值钱」的一档。" }
          ]} />
        </Card>
      </div>
    </div>
  );
}
window.DriverScreen = DriverScreen;
