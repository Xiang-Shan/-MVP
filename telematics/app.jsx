/* ============================================================================
   App shell v4 — 双视角（一汽集团 ↔ 鑫安车险）· sidebar · topbar · router
   ============================================================================ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ED1C24",
  "font": "sans",
  "theme": "light",
  "density": "regular",
  "overviewLayout": "analytic"
}/*EDITMODE-END*/;

const { useState, useEffect } = React;

const NAV_FAW = [
  { sec:"一汽集团 · 平台视角", en:"PLATFORM", items:[
    { id:"group",     label:"集团风险总览", icon:"grid" },
    { id:"market",    label:"保险市场份额", icon:"pie" },
    { id:"structure", label:"品牌与车型结构", icon:"layers" }
  ]},
  { sec:"车主价值 · 风险减量", en:"OWNERS", items:[
    { id:"driver",   label:"车主互动", icon:"heart" },
    { id:"ownerops", label:"车主运营", icon:"pulse" }
  ]}
];
const NAV_XINAN = [
  { sec:"经营总览", en:"PORTFOLIO", items:[
    { id:"overview", label:"承保总览", icon:"grid" }
  ]},
  { sec:"专项监控", en:"MONITORING", items:[
    { id:"fleetmgmt", label:"车队管理", icon:"fleet" },
    { id:"drivermon", label:"驾驶人变化监测", icon:"drift" },
    { id:"battery",   label:"电池健康", icon:"battery" },
    { id:"adas",      label:"智驾风险", icon:"adas" }
  ]},
  { sec:"核保分析", en:"UNDERWRITING", items:[
    { id:"fleet",    label:"承保车辆", icon:"list" },
    { id:"detail",   label:"车辆详情", icon:"car" },
    { id:"trips",    label:"行程与充电", icon:"map" },
    { id:"compare",  label:"实时推演", icon:"compare" }
  ]},
  { sec:"数据 → 精算定价", en:"ACTUARIAL", items:[
    { id:"pipeline", label:"数据接入", icon:"flow" },
    { id:"pricing",  label:"定价数据集", icon:"export" }
  ]},
  { sec:"随身工具", en:"FIELD", items:[
    { id:"mobile",   label:"移动端", icon:"phone" }
  ]}
];
const FAW_IDS = ["group","market","structure","driver","ownerops"];

function NavIcon({ k }){
  const c = { width:18, height:18, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", strokeLinejoin:"round" };
  switch(k){
    case "grid": return <svg {...c}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case "list": return <svg {...c}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case "car": return <svg {...c}><path d="M5 17h14M6 17l1.5-6h9L18 17M5 11l1-3a2 2 0 012-2h8a2 2 0 012 2l1 3"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>;
    case "compare": return <svg {...c}><path d="M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4"/></svg>;
    case "flow": return <svg {...c}><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="14" width="6" height="6" rx="1"/><path d="M9 7h4a2 2 0 012 2v6"/></svg>;
    case "map": return <svg {...c}><path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>;
    case "heart": return <svg {...c}><path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1L12 21.5l8.8-8.8a5 5 0 000-7.1z"/></svg>;
    case "battery": return <svg {...c}><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="M10 9l-2.2 3H11l-2.2 3"/></svg>;
    case "adas": return <svg {...c}><path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4z"/><circle cx="12" cy="11" r="2.5"/><path d="M12 13.5V16"/></svg>;
    case "pulse": return <svg {...c}><path d="M3 12h4l2.5-6 4 12L16 12h5"/></svg>;
    case "drift": return <svg {...c}><path d="M3 17c3 0 3-6 6-6s3 4 6 4 3-8 6-8"/><circle cx="15" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>;
    case "fleet": return <svg {...c}><path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="17" r="1.5"/><circle cx="17.5" cy="17" r="1.5"/></svg>;
    case "pie": return <svg {...c}><path d="M12 3v9l8 4"/><circle cx="12" cy="12" r="9"/></svg>;
    case "layers": return <svg {...c}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>;
    case "export": return <svg {...c}><path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/></svg>;
    case "phone": return <svg {...c}><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>;
    default: return null;
  }
}

function ViewToggle({ view, onChange }){
  const opts = [
    { id:"faw",   cn:"一汽集团", en:"FAW" },
    { id:"xinan", cn:"鑫安车险", en:"XIN'AN" }
  ];
  return (
    <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,.06)", padding:4, borderRadius:11, margin:"0 2px 16px" }}>
      {opts.map(o => {
        const on = view===o.id;
        return (
          <button key={o.id} onClick={()=>onChange(o.id)} style={{ flex:1, border:"none", cursor:"pointer", fontFamily:"inherit",
            padding:"8px 6px", borderRadius:8, background: on?"var(--accent)":"transparent", textAlign:"center",
            boxShadow: on?"0 3px 10px color-mix(in srgb, var(--accent) 40%, transparent)":"none", transition:"all .15s" }}>
            <div style={{ fontSize:13, fontWeight:800, color: on?"#fff":"var(--sidebar-ink)", lineHeight:1.15 }}>{o.cn}</div>
            <div style={{ fontSize:8.5, fontWeight:700, letterSpacing:"1.5px", color: on?"rgba(255,255,255,.7)":"var(--sidebar-ink-3)", marginTop:1 }}>{o.en}</div>
          </button>
        );
      })}
    </div>
  );
}

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState(() => localStorage.getItem("demo_view") || "faw");
  const [screen, setScreen] = useState(() => localStorage.getItem("demo_screen") || "group");
  useEffect(() => { localStorage.setItem("demo_screen", screen); }, [screen]);
  useEffect(() => { localStorage.setItem("demo_view", view); }, [view]);
  const [vehicleId, setVehicleId] = useState(DATA.FLEET.find(v=>v.band.key==="crit")?.id || DATA.FLEET[0].id);

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = t.theme;
    r.dataset.density = t.density;
    r.style.setProperty("--accent", t.accent);
    r.style.setProperty("--accent-soft", `color-mix(in srgb, ${t.accent} 11%, transparent)`);
    const fonts = {
      sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      system: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", system-ui, sans-serif',
      serif: '"Noto Serif SC", "Songti SC", serif'
    };
    r.style.setProperty("--font", fonts[t.font] || fonts.sans);
  }, [t]);

  const switchView = (nv) => {
    setView(nv);
    setScreen(nv === "faw" ? "group" : "overview");
  };
  const openVehicle = (id) => { setVehicleId(id); setView("xinan"); setScreen("detail"); };

  const NAV = view === "faw" ? NAV_FAW : NAV_XINAN;

  const titles = {
    group:["集团风险总览","全国接入百万级 × 上海 5 万深度评分 · 一汽集团口径"],
    market:["保险市场份额","一汽车主在保结构 · 各保险公司份额 × 风险画像"],
    structure:["品牌与车型结构","6 大品牌 × 能源 × 用途 · 风险结构全景"],
    overview:["承保总览","鑫安在保组合 · 风险分布 · 5 维度画像"],
    fleet:["承保车辆","鑫安在保 · 按品牌 / 能源 / 等级筛选 · 点击进入车辆详情"],
    detail:["车辆详情","可解释从车风险分 · 5 维 12 特征 · 拖动即时推演"],
    trips:["行程与充电","GPS 轨迹 + 充电桩 · 行为如何喂入风险指标"],
    compare:["实时推演","同一套模型 · 两辆车的相对风险对比"],
    fleetmgmt:["车队管理","B 端车队风控驾驶舱 · 12 特征帮车队控风险、帮鑫安定价"],
    battery:["电池健康","纯电专项 · SOH 诊断 · 热失控前兆预警"],
    adas:["智驾风险","L2+ 专项 · 辅助驾驶正在改变风险曲线"],
    drivermon:["驾驶人变化监测","行为漂移检测 · 用途变更 / 换驾驶人早识别"],
    pipeline:["数据接入","OEM 原始信号 → 可解释风险指标"],
    pricing:["定价数据集","交付给保险公司的可定价、可验证数据"],
    driver:["车主互动","集团车主价值 · 风险减量 · 安全行驶 · 鑫安数据驱动的车主经营"],
    ownerops:["车主运营","集团车主活跃 · 权益 · 风险减量与服务体验全景"],
    mobile:["移动端","核保主管与现场查勘的随身视图"]
  };
  const cur = DATA.FLEET.find(v=>v.id===vehicleId);
  const isFaw = view === "faw";

  const Screen = () => {
    switch(screen){
      case "group":    return <GroupScreen t={t} onOpenVehicle={openVehicle} />;
      case "market":   return <MarketScreen />;
      case "structure":return <StructureScreen />;
      case "overview": return <OverviewScreen t={t} onOpenVehicle={openVehicle} />;
      case "fleet":    return <FleetScreen onOpenVehicle={openVehicle} />;
      case "detail":   return <DetailScreen vehicleId={vehicleId} />;
      case "trips":    return <TripsScreen />;
      case "compare":  return <CompareScreen />;
      case "fleetmgmt":return <FleetMgmtScreen onOpenVehicle={openVehicle} />;
      case "battery":  return <BatteryScreen onOpenVehicle={openVehicle} />;
      case "adas":     return <AdasScreen onOpenVehicle={openVehicle} />;
      case "drivermon":return <DriverMonScreen onOpenVehicle={openVehicle} />;
      case "pipeline": return <PipelineScreen />;
      case "pricing":  return <PricingScreen />;
      case "driver":   return <DriverScreen dark={t.theme==="dark"} />;
      case "ownerops": return <OwnerOpsScreen />;
      case "mobile":   return <MobileScreen dark={t.theme==="dark"} />;
      default: return null;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker" />
          <div>
            <div className="brand-cn">从车风险数据平台</div>
            <div className="brand-en">一汽集团 × 鑫安车险</div>
          </div>
        </div>
        <ViewToggle view={view} onChange={switchView} />
        <nav className="nav">
          {NAV.map(group => (
            <div key={group.sec} className="nav-group">
              <div className="nav-sec"><span className="nav-sec-cn">{group.sec}</span>{group.en ? <span className="nav-sec-en">{group.en}</span> : null}</div>
              {group.items.map(it => (
                <button key={it.id} className={"nav-item" + (screen===it.id?" active":"")} onClick={()=>setScreen(it.id)}>
                  <NavIcon k={it.icon} /><span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        {!isFaw && (
          <div className="sidebar-foot" style={{ borderTop:"1px solid rgba(255,255,255,.08)", marginTop:14 }}>
            <div className="nav-sec" style={{ padding:"10px 10px 6px", fontSize:10.5, fontWeight:700, letterSpacing:".12em", color:"var(--sidebar-ink-3)" }}>战略交付物</div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {[["product-deck.html","产品说明 PPT"],["strategy-map.html","数据战略地图"],["ad-risk-training.html","智驾风险模型"]].map(([href,label])=>(
                <a key={href} href={href} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px",
                  borderRadius:8, color:"var(--sidebar-ink)", textDecoration:"none", fontSize:13, fontWeight:600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="sidebar-foot">
          <div className="foot-platform">{isFaw ? "一汽集团 · 数据资产视图" : "鑫安车险 · 承保经营视图"}</div>
          <div className="foot-note">技术引擎：律商风险 LexisNexis Risk Solutions</div>
          <div className="foot-note">案例示意 · 模拟数据 · 非真实客户数据</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="top-title">{titles[screen][0]}{screen==="detail" && cur ? <span className="top-vehicle"> · {cur.plate}</span> : null}</div>
            <div className="top-sub">{titles[screen][1]}</div>
          </div>
          <div className="top-right">
            <div className="pill"><span className="dot" />实时同步 · 一汽集团 6 大品牌</div>
            <div className="period">近 30 天</div>
            <div className="userchip">
              <div className="avatar" style={{ background: isFaw ? "#37424E" : "var(--accent)" }}>{isFaw ? "汽" : "王"}</div>
              <div>
                <div className="un">{isFaw ? "李总监" : "王经理"}</div>
                <div className="ur">{isFaw ? "一汽集团 · 数据合作部" : "鑫安核保部 · 主管"}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="canvas">
          <Screen />
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="主题" />
        <TweakRadio label="明暗" value={t.theme} options={[{value:"light",label:"浅色"},{value:"dark",label:"深色"}]} onChange={v=>setTweak("theme",v)} />
        <TweakColor label="品牌强调色" value={t.accent} options={["#ED1C24","#2A6FDB","#00778B","#3C4A56"]} onChange={v=>setTweak("accent",v)} />
        <TweakSection label="排版" />
        <TweakRadio label="字体" value={t.font} options={[{value:"sans",label:"无衬线"},{value:"system",label:"系统"},{value:"serif",label:"衬线"}]} onChange={v=>setTweak("font",v)} />
        <TweakRadio label="信息密度" value={t.density} options={[{value:"compact",label:"紧凑"},{value:"regular",label:"标准"},{value:"comfy",label:"宽松"}]} onChange={v=>setTweak("density",v)} />
        <TweakSection label="布局" />
        <TweakRadio label="总览版式" value={t.overviewLayout} options={[{value:"analytic",label:"分析型"},{value:"editorial",label:"叙事型"}]} onChange={v=>setTweak("overviewLayout",v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
requestAnimationFrame(() => {
  const sp = document.getElementById("splash");
  if(sp){ sp.style.opacity = "0"; setTimeout(() => sp.remove(), 360); }
});
