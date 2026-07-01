/* ============================================================================
   车主运营 Owner Operations — C 端经营月报
   叙事：车主互动讲「机制为什么有效」，本页讲「做得怎么样」——
   活跃盘 → 留存证据 → 权益经济 → 保险转化 → 分群差异 → 服务体验
   口径：全国接入 1,286,000 车主 · App 激活 579,000 · 与地图省级月活咬合
   v2 · 克制入场动画（数字滚动 / 柱状升起 / 折线描绘 / 擦除揭示）+ 既有联动
   ============================================================================ */
const DOp = window.DATA;
const OPSD = DOp.OPS;
const { useState: useStateOp, useEffect: useEffectOp, useRef: useRefOp } = React;

/* ---- 自包含动画工具 ---- */
function OpMounted(){
  const [m, setM] = useStateOp(false);
  useEffectOp(() => { const a = requestAnimationFrame(() => requestAnimationFrame(() => setM(true))); return () => cancelAnimationFrame(a); }, []);
  return m;
}
function OpCount({ value, dur = 950, dp = 0, comma = false, prefix = "", suffix = "" }){
  const [v, setV] = useStateOp(0);
  useEffectOp(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3); setV(value * e); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  const out = comma ? Math.round(v).toLocaleString("en-US") : v.toFixed(dp);
  return <span>{prefix}{out}{suffix}</span>;
}
function opNum(str){
  const m = String(str).match(/^([^\d.-]*?)(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { prefix:"", num:0, dp:0, suffix:str };
  return { prefix:m[1], num:parseFloat(m[2]), dp:m[2].includes(".") ? 1 : 0, suffix:m[3] };
}
/* 左→右擦除揭示（完成后转为 none，不影响内部 tooltip） */
function RevealWipe({ children, dur = 900, delay = 120 }){
  const [phase, setPhase] = useStateOp(0);
  useEffectOp(() => {
    const a = requestAnimationFrame(() => requestAnimationFrame(() => setPhase(1)));
    const t = setTimeout(() => setPhase(2), delay + dur + 80);
    return () => { cancelAnimationFrame(a); clearTimeout(t); };
  }, []);
  const clip = phase === 0 ? "inset(0 100% 0 0)" : phase === 1 ? "inset(0 0 0 0)" : "none";
  return <div style={{ clipPath: clip, transition: phase === 2 ? "none" : `clip-path ${dur}ms cubic-bezier(.4,1,.4,1) ${delay}ms` }}>{children}</div>;
}

/* ---- 通用悬停提示（跟随光标）---- */
function ChartTip({ tip }){
  if (!tip) return null;
  return (
    <div style={{ position:"absolute", left:tip.x, top:tip.y, transform:"translate(-50%,-120%)",
      background:"var(--ink)", color:"var(--bg)", borderRadius:9, padding:"8px 12px", fontSize:11.5, fontWeight:600,
      whiteSpace:"nowrap", boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:30, lineHeight:1.6 }}>{tip.content}</div>
  );
}
function useChartTip(){
  const ref = useRefOp(null);
  const [tip, setTip] = useStateOp(null);
  const move = (content) => (e) => { if (!ref.current) return; const r = ref.current.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content }); };
  const clear = () => setTip(null);
  return { ref, tip, move, clear };
}

/* ---- 同期群留存曲线：有权益任务 vs 无（描绘入场）---- */
function RetentionChart({ h = 200 }){
  const mounted = OpMounted();
  const [hi, setHi] = useStateOp(null);
  const W = 560, P = { l: 38, r: 14, t: 14, b: 26 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const n = OPSD.retention.withPerk.length;
  const x = (i) => P.l + i / (n - 1) * iw;
  const y = (v) => P.t + ih - v / 100 * ih;
  const series = [
    { k:"有权益任务组", data:OPSD.retention.withPerk, color:"var(--accent)" },
    { k:"无权益对照组", data:OPSD.retention.without, color:"var(--ink-3)", dash:"5 4" }
  ];
  const tipLeft = hi == null ? 0 : Math.max(12, Math.min(88, x(hi) / W * 100));
  return (
    <div style={{ position:"relative" }}>
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block", overflow:"visible" }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={P.l - 5} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">{v}%</text>
        </g>
      ))}
      {Array.from({ length: n }).map((_, i) =>
        <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9.5" fontWeight={hi===i?800:400} fill={hi===i?"var(--ink)":"var(--ink-3)"}>W{i}</text>)}
      {hi != null && <line x1={x(hi)} y1={P.t} x2={x(hi)} y2={P.t + ih} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />}
      {series.map((s, si) => (
        <g key={si}>
          <path d={s.data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("")}
            fill="none" stroke={s.color} strokeWidth="2.6" strokeDasharray={s.dash || "none"} strokeLinecap="round" strokeLinejoin="round"
            pathLength="100" style={{ strokeDasharray: s.dash ? s.dash : "100", strokeDashoffset: mounted ? 0 : 100, transition:`stroke-dashoffset 1.05s cubic-bezier(.4,1,.4,1) ${si*0.12}s` }} />
          {s.data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={hi === i ? 4 : 2.4} fill={s.color} opacity={mounted?1:0} style={{ transition:`r .12s, opacity .4s ${0.5+si*0.12}s` }} />)}
        </g>
      ))}
      {/* gap annotation at W8 */}
      <g opacity={mounted?1:0} style={{ transition:"opacity .5s .9s" }}>
        <line x1={x(n-1) + 7} y1={y(OPSD.retention.withPerk[n-1])} x2={x(n-1) + 7} y2={y(OPSD.retention.without[n-1])} stroke="var(--band-low)" strokeWidth="1.6" />
        <text x={x(n-1) - 2} y={(y(OPSD.retention.withPerk[n-1]) + y(OPSD.retention.without[n-1])) / 2 + 4} textAnchor="end" fontSize="11.5" fontWeight="800" fill="var(--band-low)">2.0×</text>
      </g>
      {Array.from({ length: n }).map((_, i) => <rect key={"hz"+i} x={x(i) - iw/(n-1)/2} y={0} width={iw/(n-1)} height={h} fill="transparent"
        onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ cursor:"crosshair" }} />)}
    </svg>
    {hi != null && (
      <div style={{ position:"absolute", left:tipLeft+"%", top:-6, transform:"translate(-50%,-100%)",
        background:"var(--ink)", color:"var(--bg)", borderRadius:8, padding:"7px 11px", whiteSpace:"nowrap",
        fontSize:12, fontWeight:700, boxShadow:"var(--shadow)", pointerEvents:"none", zIndex:5 }}>
        W{hi} · 权益组 {OPSD.retention.withPerk[hi]}% · 对照组 {OPSD.retention.without[hi]}%
      </div>
    )}
    <div style={{ display:"flex", gap:14, fontSize:11.5, color:"var(--ink-2)", marginTop:2, flexWrap:"wrap" }}>
      {series.map(s => (
        <span key={s.k} style={{ display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
          <span style={{ width:14, height:0, borderTop:`2.6px ${s.dash?"dashed":"solid"} ${s.color}` }} />{s.k}
        </span>
      ))}
      <span style={{ marginLeft:"auto", color:"var(--ink-3)", whiteSpace:"nowrap" }}>2026-03 新激活同期群 · 周留存</span>
    </div>
    </div>
  );
}

/* ---- 转化漏斗（升起 + 数字滚动 + 悬停揭示）---- */
function OpsFunnel(){
  const F = OPSD.funnel;
  const top = F[0].v;
  const mounted = OpMounted();
  const { ref, tip, move, clear } = useChartTip();
  const [hi, setHi] = useStateOp(null);
  return (
    <div ref={ref} style={{ position:"relative", display:"flex", flexDirection:"column", gap:0 }}>
      {F.map((s, i) => {
        const prev = i > 0 ? F[i-1].v : null;
        const conv = prev ? s.v / prev : null;
        const drop = prev ? prev - s.v : null;
        const ofTop = Math.round(s.v / top * 100);
        const active = hi === i;
        const content = (
          <span><b>{s.k}</b> · {s.v.toLocaleString("en-US")} 人<br/>占月活 {ofTop}%{conv != null ? " · 转化 " + Math.round(conv*100) + "%" : ""}{drop ? <><br/>本层流失 {drop.toLocaleString("en-US")} 人</> : null}</span>
        );
        return (
          <React.Fragment key={s.k}>
            {i > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:9, margin:"5px 0 5px 97px", fontSize:10.5, fontWeight:700 }}>
                <span style={{ color:"var(--band-high)" }}>▼ 流失 {drop.toLocaleString("en-US")}</span>
                <span style={{ color:"var(--ink-3)" }}>转化 <b style={{ color:"var(--ink-2)" }}>{Math.round(conv*100)}%</b></span>
              </div>
            )}
            <div onMouseMove={move(content)} onMouseEnter={() => setHi(i)} onMouseLeave={() => { setHi(null); clear(); }}
              style={{ display:"flex", alignItems:"center", gap:11, cursor:"pointer", opacity: hi != null && !active ? 0.5 : 1, transition:"opacity .15s" }}>
              <div style={{ width:86, fontSize:12.5, fontWeight:800, color:"var(--ink)", textAlign:"right", flex:"0 0 auto" }}>{s.k}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ width:mounted ? (16 + s.v / top * 84) + "%" : "0%", height:30, borderRadius:8,
                  background:`color-mix(in srgb, var(--accent) ${22 + i * 26}%, var(--surface-2))`,
                  boxShadow: active ? "0 3px 12px color-mix(in srgb, var(--accent) 32%, transparent)" : "none",
                  transition:`width .85s cubic-bezier(.3,1,.4,1) ${i*0.08}s, box-shadow .15s` }} />
                <div style={{ fontSize:10.5, color:"var(--ink-3)", marginTop:4 }}>{s.d}</div>
              </div>
              <div style={{ width:94, flex:"0 0 auto", textAlign:"right" }}>
                <div style={{ fontSize:15.5, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums", lineHeight:1.1 }}>{mounted ? <OpCount value={s.v} comma dur={900} /> : 0}</div>
                <div style={{ fontSize:10, color:"var(--ink-3)", marginTop:1 }}>占月活 {ofTop}%</div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ marginTop:10, padding:"10px 13px", borderRadius:10, background:"var(--accent-soft)", fontSize:12, color:"var(--ink)", lineHeight:1.6 }}>
        本月 App 内成交 <b>13,860 单</b>，获客成本约为电销渠道的 <b>1/4</b> —— 漏斗每一层都来自真实活跃，而非投放。
      </div>
      <ChartTip tip={tip} />
    </div>
  );
}

/* ---- 权益经济（升起 + 数字滚动）---- */
function PerkEconomy(){
  const P = OPSD.perks;
  const mounted = OpMounted();
  const { ref: cRef, tip: cTip, move: cMove, clear: cClear } = useChartTip();
  const [cHi, setCHi] = useStateOp(null);
  const roi = (P.benefitPerCar / P.costPerCar);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10 }}>
        {[["积分发放", P.issuedWan, "本月 · 任务+行为奖励"], ["积分核销", P.redeemedWan, "核销率 " + Math.round(P.redeemedWan/P.issuedWan*100) + "% · 健康区间"]].map(([t, num, d]) => (
          <div key={t} style={{ flex:1, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 13px" }}>
            <div style={{ fontSize:19, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{mounted ? <OpCount value={num} comma dur={1000} suffix=" 万" /> : 0}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--ink)", marginTop:1 }}>{t}</div>
            <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>{d}</div>
          </div>
        ))}
      </div>
      <div ref={cRef} style={{ position:"relative" }}>
        <div style={{ fontSize:12.5, fontWeight:800, color:"var(--ink)", marginBottom:8 }}>权益券使用率</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {P.coupons.map((c, i) => {
            const healthy = c.use >= 60;
            const active = cHi === i;
            const content = <span><b>{c.k}</b> · 使用率 {c.use}%<br/>{healthy ? "状态健康 · 核销顺畅" : "低于健康线 60% · 待优化"}</span>;
            return (
            <div key={c.k} onMouseMove={cMove(content)} onMouseEnter={() => setCHi(i)} onMouseLeave={() => { setCHi(null); cClear(); }}
              style={{ display:"grid", gridTemplateColumns:"86px 1fr 40px", alignItems:"center", gap:10, cursor:"pointer", opacity: cHi != null && !active ? 0.5 : 1, transition:"opacity .15s" }}>
              <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)" }}>{c.k}</span>
              <div style={{ height:10, borderRadius:5, background:"var(--surface-2)", overflow:"hidden" }}>
                <div style={{ width:mounted ? c.use + "%" : "0%", height:"100%", borderRadius:5,
                  background:`color-mix(in srgb, ${healthy ? "var(--band-low)" : "var(--band-mid)"} ${active ? 100 : 78}%, var(--surface-2))`, transition:`width .85s cubic-bezier(.3,1,.4,1) ${i*0.1}s, background .15s` }} />
              </div>
              <span style={{ fontSize:12.5, fontWeight:800, color:"var(--ink)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{c.use}%</span>
            </div>
            );
          })}
        </div>
        <div style={{ fontSize:11, color:"var(--ink-3)", marginTop:5 }}>续保立减券使用率偏低 —— 档位门槛偏高，下月 A/B 降档测试</div>
        <ChartTip tip={cTip} />
      </div>
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:12, display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:"var(--ink-3)" }}>权益成本 / 活跃车主·月</div>
          <div style={{ fontSize:20, fontWeight:800, color:"var(--ink)" }}>{mounted ? <OpCount value={P.costPerCar} dp={1} prefix="¥" /> : "¥0"}</div>
        </div>
        <div style={{ fontSize:18, color:"var(--ink-3)" }}>→</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:"var(--ink-3)" }}>归因收益（赔付改善+转化）</div>
          <div style={{ fontSize:20, fontWeight:800, color:"var(--band-low)" }}>{mounted ? <OpCount value={P.benefitPerCar} dp={1} prefix="¥" /> : "¥0"}</div>
        </div>
        <div style={{ flex:"0 0 auto", textAlign:"center", background:"var(--accent-soft)", borderRadius:10, padding:"9px 16px" }}>
          <div style={{ fontSize:22, fontWeight:900, color:"var(--accent)" }}>{mounted ? <OpCount value={roi} dp={2} suffix="×" dur={1100} /> : "0×"}</div>
          <div style={{ fontSize:10.5, color:"var(--ink-2)", fontWeight:700 }}>投入产出比</div>
        </div>
      </div>
    </div>
  );
}

/* ---- 分群活跃差异（切换维度重新升起 + 悬停揭示）---- */
function SegBarList({ rows }){
  const mounted = OpMounted();
  const { ref, tip, move, clear } = useChartTip();
  const [hi, setHi] = useStateOp(null);
  const avg = rows.reduce((s, r) => s + r.v, 0) / rows.length;
  return (
    <div ref={ref} style={{ position:"relative", display:"flex", flexDirection:"column", gap:9 }}>
      {rows.map((r, i) => {
        const active = hi === i;
        const d = Math.round(r.v - avg);
        const content = <span><b>{r.k}</b> · 月活率 {r.v}%<br/>较维度均值 {d >= 0 ? "+" : ""}{d}pt</span>;
        return (
          <div key={r.k} onMouseMove={move(content)} onMouseEnter={() => setHi(i)} onMouseLeave={() => { setHi(null); clear(); }}
            style={{ display:"grid", gridTemplateColumns:"92px 1fr 44px", alignItems:"center", gap:10, cursor:"pointer", opacity: hi != null && !active ? 0.5 : 1, transition:"opacity .15s" }}>
            <span style={{ fontSize:12.5, fontWeight:700, color:"var(--ink-2)" }}>{r.k}</span>
            <div style={{ height:12, borderRadius:6, background:"var(--surface-2)", overflow:"hidden" }}>
              <div style={{ width:mounted ? (r.v / 60 * 100) + "%" : "0%", height:"100%", borderRadius:6,
                background: active ? "var(--accent)" : "color-mix(in srgb, var(--accent) 76%, var(--surface-2))", transition:`width .8s cubic-bezier(.3,1,.4,1) ${i*0.06}s, background .15s` }} />
            </div>
            <span style={{ fontSize:13, fontWeight:800, color:"var(--ink)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{mounted ? <OpCount value={r.v} suffix="%" dur={800} /> : "0%"}</span>
          </div>
        );
      })}
      <ChartTip tip={tip} />
    </div>
  );
}
function SegmentBars(){
  const groups = [
    { key:"brand", label:"按品牌", note:"新能源功能密度差异", rows:OPSD.segments.brand },
    { key:"lifecycle", label:"按车龄", note:"新车蜜月期效应", rows:OPSD.segments.lifecycle },
    { key:"band", label:"按风险等级", note:"深评试点口径", rows:OPSD.segments.band }
  ];
  const [g, setG] = useStateOp("brand");
  const cur = groups.find(x => x.key === g);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:4, background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:9, padding:3, alignSelf:"flex-start" }}>
        {groups.map(x => (
          <button key={x.key} onClick={() => setG(x.key)}
            style={{ border:"none", cursor:"pointer", padding:"5px 12px", borderRadius:7, fontSize:12, fontWeight:700, fontFamily:"inherit", whiteSpace:"nowrap",
              background: g === x.key ? "var(--surface)" : "transparent",
              color: g === x.key ? "var(--ink)" : "var(--ink-3)",
              boxShadow: g === x.key ? "var(--shadow)" : "none" }}>{x.label}</button>
        ))}
      </div>
      <SegBarList key={g} rows={cur.rows} />
      <div style={{ fontSize:11.5, color:"var(--ink-3)", lineHeight:1.6 }}>
        {g === "brand" && "红旗 / 奥迪车主活跃最高（高阶智驾 + 电池报告功能密度大）；捷达燃油车可用功能少 —— OBD 口径上线油耗报告后预计 +8pt。"}
        {g === "lifecycle" && "新车 1 年内活跃 58%，3 年以上滑落至 36% —— 老车主权益（保养券加码、置换评估）是下季度运营重点。"}
        {g === "band" && "低风险车主活跃高于高风险 11pt：平稳驾驶者更愿意看自己的好成绩 —— 对高风险群体需用「改善任务」而非「成绩单」切入。"}
      </div>
    </div>
  );
}

/* ---- 服务体验（数字滚动）---- */
function ServiceQuality(){
  const S = OPSD.service;
  const mounted = OpMounted();
  const items = [
    { n:S.videoSurveyMin + " 分钟", t:"在线视频查勘平均时长", d:"报案后 App 内直连查勘员" },
    { n:S.smallClaimHrs + " 小时", t:"小额案件平均赔付", d:"≤5,000 元 · 影像定损直赔" },
    { n:S.ticket24h + "%", t:"服务工单 24h 解决率", d:"含理赔咨询 · 权益问题" },
    { n:S.claimNodes + " 个", t:"理赔进度推送节点", d:"报案→查勘→定损→核赔→支付全透明" }
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {items.map((it, i) => { const p = opNum(it.n); return (
          <div key={it.t} style={{ background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:10, padding:"11px 13px",
            opacity:mounted?1:0, transform:mounted?"none":"translateY(6px)", transition:`opacity .45s ${i*0.07}s, transform .45s ${i*0.07}s` }}>
            <div style={{ fontSize:20, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{mounted ? <OpCount value={p.num} dp={p.dp} suffix={p.suffix} dur={950} /> : 0}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--ink)", marginTop:2 }}>{it.t}</div>
            <div style={{ fontSize:10.5, color:"var(--ink-3)", marginTop:1 }}>{it.d}</div>
          </div>
        ); })}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:14, borderTop:"1px solid var(--border)", paddingTop:12 }}>
        <div style={{ flex:"0 0 auto", textAlign:"center" }}>
          <div style={{ fontSize:30, fontWeight:900, color:"var(--band-low)" }}>{mounted ? <OpCount value={OPSD.nps.overall} dur={1000} /> : 0}</div>
          <div style={{ fontSize:11, color:"var(--ink-3)", fontWeight:700 }}>整体 NPS</div>
        </div>
        <div style={{ flex:1, fontSize:12.5, color:"var(--ink-2)", lineHeight:1.6 }}>
          高活跃车主 NPS <b style={{ color:"var(--band-low)" }}>{OPSD.nps.high}</b>，低活跃仅 <b style={{ color:"var(--band-mid)" }}>{OPSD.nps.low}</b> ——
          体验过理赔透明化与电池报告的车主，推荐意愿接近翻倍。服务体验本身就是最强的留存器。
        </div>
      </div>
    </div>
  );
}

/* ---- 场景嵌入服务卡（错峰入场）---- */
function ServiceBlueprint(){
  const mounted = OpMounted();
  const rows = [
    { t:"理赔全程可视", d:"报案即生成进度卡，6 节点推送 · 视频查勘 18 分钟接通", m:"理赔 NPS +21" },
    { t:"保单管家", d:"续保倒计时 + 权益档位进度条 + 一键续保（预填从车风险分折扣）", m:"续保决策前置 90 天" },
    { t:"场景嵌入", d:"充电中推送电池月报 · 长途前推送车况检查与救援卡入口", m:"推送打开率 64%" },
    { t:"增值服务入口", d:"道路救援 / 代驾 / 取送车保养 —— 与一汽售后网络共履约", m:"月均调用 0.3 次/车" }
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--gap)" }}>
      {rows.map((r, i) => (
        <div key={r.t} className="row-hover" style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"15px 16px",
          display:"flex", flexDirection:"column", gap:7,
          opacity:mounted?1:0, transform:mounted?"none":"translateY(8px)", transition:`opacity .5s ${i*0.08}s, transform .5s ${i*0.08}s` }}>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--accent)", letterSpacing:".06em" }}>0{i+1}</div>
          <div style={{ fontSize:14.5, fontWeight:800, color:"var(--ink)" }}>{r.t}</div>
          <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.55, flex:1 }}>{r.d}</div>
          <div style={{ fontSize:11.5, fontWeight:800, color:"var(--band-low)" }}>{r.m}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- 授权撤回预警 · 挽留任务队列 ----
   口径：连续 30 天未活跃且关闭推送 = 预警入队；原因分布合计 412 */
const REVOKE_SEGMENTS = [
  { k:"推送关闭 + 长期沉默", n:187, c:"var(--band-mid)" },
  { k:"换机 / 卸载迹象", n:96, c:"var(--band-high)" },
  { k:"权益过期未使用", n:78, c:"#1E96D0" },
  { k:"理赔 / 服务不满", n:51, c:"var(--band-crit)" }
];
const REVOKE_ROWS = [
  { id:"沪A·**32", brand:"大众", model:"纯电紧凑SUV", prov:"上海", silent:64, reason:"理赔 / 服务不满", renewDays:23, tier:"高", action:"服务总监外呼回访 + 理赔开通绿色通道", status:"待处理" },
  { id:"鲁B·**87", brand:"奥迪", model:"纯电中型SUV", prov:"山东", silent:48, reason:"换机 / 卸载迹象", renewDays:41, tier:"高", action:"短信唤回 + 新机登录送 500 积分", status:"已触达" },
  { id:"苏D·**15", brand:"大众", model:"纯电中型轿车", prov:"江苏", silent:37, reason:"权益过期未使用", renewDays:65, tier:"中", action:"充电券重发（14 天有效）+ 电池月报推送", status:"待处理" },
  { id:"豫A·**61", brand:"捷达", model:"燃油SUV", prov:"河南", silent:71, reason:"推送关闭 + 长期沉默", renewDays:18, tier:"高", action:"续保专员外呼（续保窗口 18 天）", status:"待处理" },
  { id:"浙A·**90", brand:"大众", model:"纯电紧凑SUV", prov:"浙江", silent:33, reason:"权益过期未使用", renewDays:102, tier:"中", action:"任务难度降档 + 保养券提醒", status:"已触达" },
  { id:"冀B·**44", brand:"大众", model:"纯电中大型SUV", prov:"河北", silent:52, reason:"推送关闭 + 长期沉默", renewDays:77, tier:"中", action:"冬季续航报告短信（带个人化数据钩子）", status:"已挽回" },
  { id:"吉A·**28", brand:"奥迪", model:"纯电中大型轿车", prov:"吉林", silent:45, reason:"换机 / 卸载迹象", renewDays:9, tier:"高", action:"续保专员外呼 + 智驾权益包唤回", status:"待处理" },
  { id:"粤B·**73", brand:"大众", model:"纯电中型轿车", prov:"广东", silent:39, reason:"理赔 / 服务不满", renewDays:55, tier:"中", action:"NPS 回访工单 + 服务补偿券", status:"已触达" },
  { id:"川A·**56", brand:"捷达", model:"燃油轿车", prov:"四川", silent:68, reason:"推送关闭 + 长期沉默", renewDays:130, tier:"低", action:"油耗报告上线后首批邀请", status:"观察" },
  { id:"京A·**19", brand:"奥迪", model:"纯电中型SUV", prov:"北京", silent:31, reason:"权益过期未使用", renewDays:88, tier:"高", action:"积分即将清零提醒 + 续保立减升档", status:"已挽回" }
];
const REVOKE_STATUS_STYLE = {
  "待处理": { c:"var(--band-high)" }, "已触达": { c:"#1E96D0" },
  "已挽回": { c:"var(--band-low)" }, "观察": { c:"var(--ink-3)" }
};

function RevokeQueue(){
  const mounted = OpMounted();
  const [seg, setSeg] = useStateOp(null);
  const rows = seg == null ? REVOKE_ROWS : REVOKE_ROWS.filter(r => r.reason === REVOKE_SEGMENTS[seg].k);
  return (
    <Card title="授权撤回预警 · 挽留任务队列" sub="连续 30 天未活跃且关推送 · 按续保窗口与价值分层排序 · 上月触达挽回率 38%"
      right={<span style={{ fontSize:12, fontWeight:700, color:"var(--ink-3)", whiteSpace:"nowrap" }}>展示前 10 / 412 人</span>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* 原因分布 · 可点击筛选 */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {REVOKE_SEGMENTS.map((s, i) => {
            const active = seg === i;
            return (
              <button key={s.k} onClick={() => setSeg(active ? null : i)}
                style={{ border:`1px solid ${active ? s.c : "var(--border)"}`, cursor:"pointer", fontFamily:"inherit",
                  background: active ? `color-mix(in srgb, ${s.c} 10%, var(--surface))` : "var(--surface-2)",
                  borderRadius:9, padding:"7px 12px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:s.c }} />
                <span style={{ fontSize:12, fontWeight:700, color:"var(--ink)", whiteSpace:"nowrap" }}>{s.k}</span>
                <span style={{ fontSize:12.5, fontWeight:800, color:s.c, fontVariantNumeric:"tabular-nums" }}>{mounted ? <OpCount value={s.n} dur={850} /> : 0}</span>
              </button>
            );
          })}
          <div style={{ marginLeft:"auto", fontSize:11.5, color:"var(--ink-3)", alignSelf:"center", whiteSpace:"nowrap" }}>点击筛选 · 续保 90 天内 128 人优先</div>
        </div>
        {/* 任务表 */}
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
            <thead>
              <tr style={{ textAlign:"left", color:"var(--ink-3)", fontSize:11 }}>
                {["车主","品牌 · 车型","省份","沉默","续保窗口","价值","流失信号","建议动作","状态"].map(hd =>
                  <th key={hd} style={{ padding:"6px 10px", borderBottom:"1px solid var(--border)", fontWeight:700, whiteSpace:"nowrap" }}>{hd}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const st = REVOKE_STATUS_STYLE[r.status];
                const urgent = r.renewDays <= 30;
                return (
                  <tr key={r.id} className="row-hover" style={{ opacity:mounted?1:0, transition:`opacity .4s ${Math.min(ri*0.05,0.4)}s` }}>
                    <td style={{ padding:"8px 10px", fontWeight:800, color:"var(--ink)", whiteSpace:"nowrap" }}>{r.id}</td>
                    <td style={{ padding:"8px 10px", color:"var(--ink-2)", whiteSpace:"nowrap" }}>{r.brand} · {r.model}</td>
                    <td style={{ padding:"8px 10px", color:"var(--ink-2)" }}>{r.prov}</td>
                    <td style={{ padding:"8px 10px", fontVariantNumeric:"tabular-nums", color: r.silent >= 60 ? "var(--band-high)" : "var(--ink-2)", whiteSpace:"nowrap" }}>{r.silent} 天</td>
                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>
                      <span style={{ fontSize:11, fontWeight:800, fontVariantNumeric:"tabular-nums",
                        color: urgent ? "var(--band-crit)" : "var(--ink-2)",
                        background: urgent ? "color-mix(in srgb, var(--band-crit) 10%, transparent)" : "var(--surface-2)",
                        border: urgent ? "1px solid color-mix(in srgb, var(--band-crit) 40%, transparent)" : "1px solid var(--border)",
                        padding:"3px 8px", borderRadius:999 }}>{r.renewDays} 天</span>
                    </td>
                    <td style={{ padding:"8px 10px", fontWeight:800, color: r.tier === "高" ? "var(--accent)" : "var(--ink-2)" }}>{r.tier}</td>
                    <td style={{ padding:"8px 10px", color:"var(--ink-2)", whiteSpace:"nowrap" }}>{r.reason}</td>
                    <td style={{ padding:"8px 10px", color:"var(--ink-2)", minWidth:200, lineHeight:1.45 }}>{r.action}</td>
                    <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>
                      <span style={{ fontSize:11, fontWeight:800, color:st.c, border:`1px solid color-mix(in srgb, ${st.c} 42%, transparent)`,
                        background:`color-mix(in srgb, ${st.c} 9%, transparent)`, padding:"3px 9px", borderRadius:999 }}>{r.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", borderTop:"1px solid var(--border)", paddingTop:12, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.6, flex:"1 1 360px" }}>
            挽留逻辑：续保窗口 ≤30 天的高价值车主走<b>人工外呼</b>；其余按流失信号自动化触达（短信携个人化数据钩子 · 权益重发）。
            授权一旦撤回，评分连续性中断、车主退出可运营池 —— 挽留成本远低于重新获客。
          </div>
          <div style={{ display:"flex", gap:18, flex:"0 0 auto" }}>
            {[["128","续保 90 天内"],["38%","上月挽回率"],["86","近 90 天实际撤回"]].map(([n,l]) => (
              <div key={l} style={{ textAlign:"right" }}>
                <div style={{ fontSize:18, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{n}</div>
                <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function OwnerOpsScreen(){
  const [showQueue, setShowQueue] = useStateOp(false);
  const queueRef = useRefOp(null);
  useEffectOp(() => {
    if(showQueue && queueRef.current){
      const canvas = queueRef.current.closest(".canvas");
      if(canvas) canvas.scrollTo({ top: queueRef.current.offsetTop - 70, behavior:"smooth" });
    }
  }, [showQueue]);
  const labels = DOp.PLATFORM_MONTHLY.map(r => r.label);
  const mauRate = Math.round(OPSD.mau / DOp.NATIONAL.vehicles * 100);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--gap)" }}>
        <KPI label="App 激活车主" value={<OpCount value={OPSD.appActivated} comma />} unit="人" accent sub={`占接入车辆 ${Math.round(OPSD.appActivated/DOp.NATIONAL.vehicles*100)}% · 交付即引导激活`} />
        <KPI label="月活车主 MAU" value={<OpCount value={OPSD.mau} comma />} unit="人" sub={`激活口径 ${Math.round(OPSD.mau/OPSD.appActivated*100)}% · 接入口径 ${mauRate}% 与省级月活咬合`} spark={OPSD.mauMonthly} />
        <div onClick={() => setShowQueue(v => !v)} style={{ cursor:"pointer", position:"relative" }}>
          <KPI label="授权撤回预警" value={<OpCount value={OPSD.revokeWatch} comma />} unit="人" sub={`连续 30 天未活跃且关推送 · 点击${showQueue ? "收起" : "展开"}挽留队列 ↓`} sparkColor="var(--band-mid)" />
          <span style={{ position:"absolute", top:14, right:16, fontSize:11, fontWeight:800, whiteSpace:"nowrap",
            color:"var(--accent)", background:"var(--accent-soft)", padding:"3px 9px", borderRadius:999 }}>{showQueue ? "收起" : "下钻"}</span>
        </div>
        <KPI label="整体 NPS" value={<OpCount value={OPSD.nps.overall} />} sub="高活跃 57 · 低活跃 31 · 体验即留存" />
      </div>

      {showQueue && <div ref={queueRef}><RevokeQueue /></div>}

      <div style={{ display:"grid", gridTemplateColumns:"1.25fr 1fr", gap:"var(--gap)" }}>
        <Card title="月活走势 · 冬季是车主最需要你的季节" sub="MAU · 近 12 个月 · 与接入增长和续航焦虑双因素叠加">
          <RevealWipe>
            <MonthLines labels={labels} yMax={400000}
              series={[{ color:"var(--accent)", data:OPSD.mauMonthly, fill:true, unit:" 人" }]}
              annotate={[{ i:7, t:"冬季续航焦虑 · 活跃率 49%", anchor:"end", dx:-4 }]} />
          </RevealWipe>
          <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:6, lineHeight:1.6 }}>
            12–1 月活跃率升至 48–49%（电池报告 / 充电规划成为刚需），与电池健康页低温告警峰完全同步 —— 功能价值和季节痛点咬合，才是真实的粘性。
          </div>
        </Card>
        <Card title="留存证据 · 权益任务组 vs 对照组" sub="同期群周留存 · W8 差距 2.0×">
          <RetentionChart />
        </Card>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.25fr", gap:"var(--gap)" }}>
        <Card title="权益经济 · 积分是负债，核销才是资产" sub="本月发放 / 核销 / 使用率 / 投入产出">
          <PerkEconomy />
        </Card>
        <Card title="保险转化漏斗 · 活跃如何变成保单" sub="2026-05 · 全国 App 口径 · 层间转化率">
          <OpsFunnel />
        </Card>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.25fr", gap:"var(--gap)" }}>
        <Card title="分群活跃差异 · 下一步运营从哪切入" sub="月活率 % · 切换维度查看">
          <SegmentBars />
        </Card>
        <Card title="服务体验 · 理赔与工单时效" sub="服务即留存 · NPS 按活跃分层">
          <ServiceQuality />
        </Card>
      </div>

      <div>
        <div style={{ fontSize:15, fontWeight:900, color:"var(--ink)", padding:"2px 2px 10px" }}>C 端服务蓝图 · 四个抓手</div>
        <ServiceBlueprint />
      </div>
    </div>
  );
}
window.OwnerOpsScreen = OwnerOpsScreen;
