/* ============================================================================
   定价数据集 Pricing Dataset — lift value (提升度) + real downloadable exports
   ============================================================================ */
const DPr = window.DATA;
const { useState } = React;

/* ---- real client-side download helpers ---- */
function downloadText(filename, text, mime){
  const blob = new Blob(["\uFEFF" + text], { type: (mime||"text/plain") + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
}
const csvCell = (s) => { const v = String(s); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
function buildScoresCSV(){
  const feats = DPr.FEATURES12.filter(f=>!f.locked);
  const head = ["车辆ID","车牌","品牌","车型","能源","用途", ...feats.map(f=>f.short||f.name),
    ...DPr.DIMS.map(d=>d.name+"_子分"), "从车风险分","风险等级","数据完整度_pct"];
  const lines = [head.join(",")];
  DPr.FLEET.forEach(v => {
    const fc = feats.map(f=>{ const val=v.f[f.key]; return f.fmt?f.fmt(val):val; });
    const dc = DPr.DIMS.map(d=> v.subs[d.key]==null?"NA":v.subs[d.key]);
    lines.push([v.id,v.plate,v.brand,v.model,v.energy,v.usageLabel,...fc,...dc,v.score,v.band.label,v.completeness].map(csvCell).join(","));
  });
  return lines.join("\n");
}
function buildFactorsCSV(){
  const head = ["风险维度","定价因子","维度×因子权重","方向","信息值IV","与赔付相关","单调性"];
  const lines = [head.join(",")];
  DPr.PRICING_FACTORS.forEach(f => lines.push([f.dimName,f.name,(f.weight*100).toFixed(1)+"%",f.dir,f.iv.toFixed(2),f.corr.toFixed(2),f.mono?"通过":"不通过"].map(csvCell).join(",")));
  lines.push(["# 评分口径","从车风险分 = Σ(维度子分 × 适用权重)；维度子分由其特征分位线性映射到 200–997","","","","",""].map(csvCell).join(","));
  return lines.join("\n");
}
function buildRelativityCSV(){
  const dec = DPr.PRICING_DECILES;
  const N = DPr.XINAN_N;                                   // 鑫安在保口径 7,998
  const meanLR = dec.reduce((s,r)=>s+(r.nBook||r.n)*r.lossRatio,0)/N;
  const head = ["十分位","评分下限","评分上限","车辆数","承保占比_pct","观测赔付率_pct","相对系数","建议费率乘数(封顶0.55-1.75)","风险等级"];
  const lines = [head.join(",")];
  dec.forEach(r=>{
    const nB = r.nBook||r.n;
    const rel = r.lossRatio/meanLR;
    const mult = Math.max(0.55, Math.min(1.75, rel));
    lines.push([r.decile, r.sLo, r.sHi, nB, (nB/N*100).toFixed(1), r.lossRatio, rel.toFixed(3), mult.toFixed(2), DPr.bandOf(r.avgScore).label].map(csvCell).join(","));
  });
  lines.push("");
  lines.push("# 风险分层汇总（与 Lift 图同口径、同配色）");
  lines.push(["风险层","评分下限","评分上限","车辆数","承保占比_pct","加权赔付率_pct","相对系数","建议费率乘数","十分位"].map(csvCell).join(","));
  (window.ACT_TIERS||[]).forEach(t=>{
    const tBook = (t.deciles||[]).reduce((s,dn)=>{ const rr=dec.find(x=>x.decile===dn); return s+(rr?(rr.nBook||rr.n):0); }, 0);
    lines.push([t.name,t.sLo,t.sHi,tBook,(tBook/N*100).toFixed(1),t.lr,t.rel.toFixed(2),t.mult.toFixed(2),"D"+t.deciles[0]+(t.deciles.length>1?"-D"+t.deciles[t.deciles.length-1]:"")].map(csvCell).join(","));
  });
  lines.push("");
  lines.push("# 相对系数 = 该层赔付率 ÷ 组合均值赔付率("+Math.round(meanLR)+"%)；建议乘数封顶 0.55–1.75（信度调整）");
  return lines.join("\n");
}
function buildApiJSON(){
  const v = [...DPr.FLEET].sort((a,b)=>b.score-a.score)[5];
  const subs = {}; DPr.DIMS.forEach(d => { subs[d.key] = v.subs[d.key]; });
  const obj = {
    endpoint: "POST /v1/vehicle-risk/score",
    request: { vin: "LX" + v.id + "MOCKVIN0001", brand: v.brand, window_days: 30 },
    response: {
      vehicle_id: v.id, score: v.score, band: v.band.label, score_range: [DPr.SCORE_MIN, DPr.SCORE_MAX],
      dimension_subscores: subs, neutral_baseline: DPr.NEUTRAL_SCORE,
      relative_risk: +DPr.relativeRisk(v.score, DPr.PORTFOLIO_MEAN).toFixed(2),
      model_version: "v5.0.0", scored_at: "2026-06-09T08:00:00+08:00", data_completeness: v.completeness
    }
  };
  return JSON.stringify(obj, null, 2);
}
function buildModelCard(){
  const m = Object.fromEntries(DPr.MODEL_METRICS.map(x=>[x.k,x.v]));
  return [
"# 从车风险分 · 模型卡 (Model Card)",
"",
"- 模型名称：从车风险评分模型 v5.0.0（维度子分制）",
"- 适用范围：从车维度风险定价 / 事中监控",
"- 评分区间：" + DPr.SCORE_MIN + " – " + DPr.SCORE_MAX + "（分越高风险越高）",
"- 样本：上海深度评分试点 50,000 辆（鑫安在保 7,998）· 一汽集团 6 大品牌",
"",
"## 输入特征（12 项 · 归入 5 维度）",
...DPr.DIMS.map(function(d){ var fs=DPr.DIM_FEATS[d.key].filter(function(f){return !f.locked;}).map(function(f){return f.name;}).join(" · "); return "- " + d.name + "（权重 " + Math.round(d.w*100) + "%）：" + fs; }),
"",
"## 评分公式",
"从车风险分 = Σ ( 维度子分 × 适用权重 )；维度子分由其特征分位线性映射到 200–997，可加总、逐项可复核。",
"人机共驾为保护因子（负向）：智驾里程越高，子分越低、拉低风险分。",
"",
"## 性能与稳定性",
"- GINI：" + m.GINI + "（风险区分度）",
"- AUC：" + m.AUC,
"- KS：" + m.KS,
"- PSI：" + m.PSI + "（近 8 周稳定）",
"- 提升度 Lift：" + DPr.PRICING_LIFT + "×（最高/最低十分位赔付率比）",
"",
"## 治理",
"- 所有清洗 / 映射 / 评分规则版本化留痕，可向监管与再保方复核。",
"- 未达数据质量门禁的车辆不进入评分。",
"",
"_本模型卡为案例示意，非真实客户数据。_"
  ].join("\n");
}

function LiftChart(){
  const rows = DPr.PRICING_DECILES;
  const max = Math.max(...rows.map(r=>r.lossRatio));
  const MAXBAR = 140; // px height of the tallest bar; columns are content-height & bottom-aligned
  const [sel, setSel] = useState(null);
  const cur = sel!=null ? rows.find(r=>r.decile===sel) : null;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:7, height:182 }}>
        {rows.map(r => {
          const band = DPr.bandOf(r.avgScore);
          const edge = r.decile===1 || r.decile===rows.length;
          const active = sel===r.decile;
          return (
            <div key={r.decile} onClick={()=>setSel(active?null:r.decile)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, justifyContent:"flex-end", cursor:"pointer" }}>
              <div style={{ fontSize:12, fontWeight:800, color: (edge||active)?band.hex:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{r.lossRatio}%</div>
              <div style={{ width:"100%", height:`${(r.lossRatio/max)*MAXBAR}px`, minHeight:4, flexShrink:0, background:band.hex, opacity: sel!=null&&!active?0.4:1,
                borderRadius:"5px 5px 0 0", transition:"height .3s, opacity .15s", outline: (edge||active)?"2px solid color-mix(in srgb, "+band.hex+" 45%, transparent)":"none", outlineOffset:2 }} />
              <div style={{ fontSize:11, color: (edge||active)?"var(--ink)":"var(--ink-3)", fontWeight: (edge||active)?800:400, fontVariantNumeric:"tabular-nums" }}>D{r.decile}</div>
            </div>
          );
        })}
      </div>
      {cur ? (
        <div style={{ display:"flex", gap:18, marginTop:12, borderTop:"1px solid var(--border)", paddingTop:10, flexWrap:"wrap", fontSize:12.5 }}>
          <span style={{ fontWeight:800, color:"var(--ink)" }}>D{cur.decile}</span>
          <span style={{ color:"var(--ink-2)" }}>评分区间 <b style={{ color:"var(--ink)" }}>{cur.sLo}–{cur.sHi}</b></span>
          <span style={{ color:"var(--ink-2)" }}>车辆 <b style={{ color:"var(--ink)" }}>{(cur.nBook!=null?cur.nBook:cur.n).toLocaleString("en-US")}</b></span>
          <span style={{ color:"var(--ink-2)" }}>平均分 <b style={{ color:DPr.bandOf(cur.avgScore).hex }}>{cur.avgScore}</b></span>
          <span style={{ color:"var(--ink-2)" }}>观测赔付率 <b style={{ color:"var(--band-crit)" }}>{cur.lossRatio}%</b></span>
        </div>
      ) : (
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--ink-3)", marginTop:12, borderTop:"1px solid var(--border)", paddingTop:10 }}>
          <span>← 低评分（低风险）</span><span style={{ fontWeight:700, color:"var(--ink-2)" }}>点击柱条查看分组明细</span><span>高评分（高风险）→</span>
        </div>
      )}
    </div>
  );
}

function FactorTable(){
  const byDim = {}; DPr.PRICING_FACTORS.forEach(f=>{ (byDim[f.dim]=byDim[f.dim]||[]).push(f); });
  const order = DPr.DIMS.map(d=>d.key).filter(k=>byDim[k]);
  return (
    <div style={{ overflow:"auto" }}>
    <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums" }}>
      <thead>
        <tr style={{ borderBottom:"1px solid var(--border)" }}>
          {["定价因子","权重","方向","信息值 IV","与赔付相关","单调性"].map((h,i)=>(
            <th key={i} style={{ textAlign: i===0?"left":"right", padding:"0 12px 10px", fontSize:12, fontWeight:700, color:"var(--ink-2)", whiteSpace:"nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {order.map(dk=>{
          const d = DPr.DIM_OF[dk]; const fs = byDim[dk]; const dimW = fs.reduce((s,f)=>s+f.weight,0);
          return (
            <React.Fragment key={dk}>
              <tr style={{ background:"var(--surface-2)" }}>
                <td colSpan={6} style={{ padding:"7px 12px" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:9, height:9, borderRadius:3, background:d.color }} />
                    <span style={{ fontSize:12.5, fontWeight:800, color:"var(--ink)" }}>{d.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--ink-3)" }}>维度权重 {Math.round(dimW*100)}%</span>
                    {d.protective && <span style={{ fontSize:10, color:"#2A6FDB", fontWeight:800, border:"1px solid color-mix(in srgb,#2A6FDB 40%,transparent)", borderRadius:5, padding:"0 5px" }}>保护因子</span>}
                  </span>
                </td>
              </tr>
              {fs.map((f,i)=>{
                const neg = f.dir.indexOf("负")>=0;
                return (
                  <tr key={f.key} style={{ borderBottom:"1px solid var(--border)" }}>
                    <td style={{ padding:"14px 12px 14px 28px" }}>
                      <div style={{ fontSize:13.5, fontWeight:600, color:"var(--ink)" }}>{f.name}</div>
                      <div style={{ fontSize:11, color:"var(--ink-3)", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:200 }}>来源 · {(DPr.FEAT_OF[f.key]||{}).raw || "OEM 信号"}</div>
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>{(f.weight*100).toFixed(1)}%</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontSize:12.5, fontWeight:700, color: neg?"#2A6FDB":"var(--ink-2)" }}>{f.dir}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                        <span style={{ width:48, height:6, borderRadius:3, background:"var(--surface-2)", overflow:"hidden", display:"inline-block" }}>
                          <span style={{ display:"block", width:Math.min(100,f.iv/0.4*100)+"%", height:"100%", background:d.color }} />
                        </span>
                        <b style={{ fontSize:13, color:"var(--ink)" }}>{f.iv.toFixed(2)}</b>
                      </span>
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontSize:13, color:"var(--ink-2)", fontWeight:600 }}>{f.corr.toFixed(2)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"var(--band-low)", whiteSpace:"nowrap" }}>✓ 通过</span>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
    <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid var(--border)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
        <span style={{ fontSize:12.5, fontWeight:800, color:"var(--ink)" }}>风险维度权重构成</span>
        <span style={{ fontSize:11, color:"var(--ink-3)", fontWeight:600 }}>12 因子 → 5 维度 · 加总 100%</span>
      </div>
      <div style={{ display:"flex", height:11, borderRadius:6, overflow:"hidden", background:"var(--surface-2)" }}>
        {order.map(dk => { const w = byDim[dk].reduce((s,f)=>s+f.weight,0); return (
          <span key={dk} title={DPr.DIM_OF[dk].name+" "+Math.round(w*100)+"%"} style={{ flex:w, background:DPr.DIM_OF[dk].color }} />
        ); })}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"7px 16px", marginTop:11 }}>
        {order.map(dk => { const d = DPr.DIM_OF[dk]; const w = byDim[dk].reduce((s,f)=>s+f.weight,0); return (
          <span key={dk} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <span style={{ width:9, height:9, borderRadius:3, background:d.color, flex:"0 0 auto" }} />
            <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-2)", whiteSpace:"nowrap" }}>{d.name}</span>
            <span style={{ fontSize:12.5, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{Math.round(w*100)}%</span>
            {d.protective && <span style={{ fontSize:10, color:"#2A6FDB", fontWeight:800 }}>保护</span>}
          </span>
        ); })}
      </div>
      <div style={{ marginTop:13, paddingTop:12, borderTop:"1px dashed var(--border)", display:"flex", gap:9, alignItems:"flex-start" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" style={{ flex:"0 0 auto", marginTop:1 }}><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        <span style={{ fontSize:11.5, color:"var(--ink-3)", lineHeight:1.55 }}>模型 v5.0.0 · 清洗 / 映射 / 评分规则版本化留痕，可向监管与再保方复核；未达数据质量门禁的车辆不进入评分。</span>
      </div>
    </div>
    </div>
  );
}

function SubHead({ label, hint, right }){
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:13 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
        <span style={{ width:4, height:14, borderRadius:2, background:"var(--accent)", flex:"0 0 auto" }} />
        <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)", whiteSpace:"nowrap" }}>{label}</span>
        {hint && <span style={{ fontSize:11.5, color:"var(--ink-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{hint}</span>}
      </div>
      {right}
    </div>
  );
}
function DownloadBtn({ label, onClick, sm }){
  return (
    <button className={"dl-btn"+(sm?" sm":"")} onClick={onClick}>
      <svg width={sm?13:14} height={sm?13:14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>
      {label}
    </button>
  );
}
const SDivider = () => <div style={{ height:1, background:"var(--border)", margin:"18px 0" }} />;

function ValidationScorecard({ onExportRates }){
  return (
    <Card title="模型验证 · 精算记分卡" sub="区分 · 增益 · 校准 · 稳定 · 费率 —— 一屏可向再保 / 监管复核" right={
      <div style={{ textAlign:"right" }}>
        <div style={{ fontSize:24, fontWeight:800, color:"var(--band-crit)", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{DPr.PRICING_LIFT.toFixed(2)}×</div>
        <div style={{ fontSize:11, color:"var(--ink-3)", marginTop:3, whiteSpace:"nowrap" }}>提升度 D10÷D1</div>
      </div>
    }>
      <SubHead label="风险分组提升 · Lift" hint="按评分十分位 · 观测赔付率单调上升" />
      <LiftChart />
      <SDivider/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <div>
          <SubHead label="区分能力" hint="ROC / 基尼" />
          <RocGiniChart size={224} />
        </div>
        <div>
          <SubHead label="累计增益" hint="赔付捕获" />
          <GainsCurveChart size={224} mark={0.2} />
        </div>
      </div>
      <SDivider/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <div>
          <SubHead label="预测校准" hint="实际 vs 预测" />
          <AEChart size={224} />
        </div>
        <div>
          <SubHead label="稳定性 · PSI" hint="近 8 周" />
          <PsiPanel size={224} />
        </div>
      </div>
      <SDivider/>
      <SubHead label="费率相对系数" hint="风险分层 → 建议费率乘数" right={<DownloadBtn sm label="导出 CSV" onClick={onExportRates} />} />
      <RelativityTable />
    </Card>
  );
}

function PricingScreen(){
  const [toast, setToast] = useState(null);
  const fire = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 2600); };
  const rows = DPr.PRICING_DECILES;
  const d1 = rows[0].lossRatio, d10 = rows[rows.length-1].lossRatio;

  const exports = [
    { name:"评分明细", desc:"车辆 × 12 特征 × 5 维度子分 × 从车风险分", fmt:"CSV", n:"代表性样本 " + DPr.FLEET.length + " 行",
      run:()=>{ downloadText("从车风险分明细_"+DPr.FLEET.length+"辆.csv", buildScoresCSV(), "text/csv"); fire("已导出 评分明细.csv（"+DPr.FLEET.length+" 行）"); } },
    { name:"定价因子表", desc:"权重 · IV · 单调性 · 版本号", fmt:"CSV", n:DPr.PRICING_FACTORS.length + " 因子",
      run:()=>{ downloadText("定价因子表.csv", buildFactorsCSV(), "text/csv"); fire("已导出 定价因子表.csv"); } },
    { name:"费率相对系数表", desc:"风险分层 → 相对赔付率 → 建议费率乘数", fmt:"CSV", n:"10 档 + 分层汇总",
      run:()=>{ downloadText("费率相对系数表.csv", buildRelativityCSV(), "text/csv"); fire("已导出 费率相对系数表.csv"); } },
    { name:"实时评分 API", desc:"按 VIN 查询 · 毫秒级响应", fmt:"JSON", n:"请求 / 响应样例",
      run:()=>{ downloadText("评分API样例.json", buildApiJSON(), "application/json"); fire("已导出 评分API样例.json"); } },
    { name:"模型卡 Model Card", desc:"口径 · 性能 · 稳定性 · 可解释", fmt:"Markdown", n:"含 GINI/AUC/Lift",
      run:()=>{ downloadText("从车风险分_模型卡.md", buildModelCard(), "text/markdown"); fire("已导出 模型卡.md"); } }
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)", position:"relative" }}>
      {/* value banner */}
      <div className="card" style={{ padding:"calc(var(--card-pad) + 4px)", display:"flex", alignItems:"center", gap:28, flexWrap:"wrap",
        background:"linear-gradient(120deg, var(--surface) 55%, var(--accent-soft))" }}>
        <div style={{ flex:"1 1 320px", minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:".04em" }}>交付给保险公司的，不是数据，是定价能力</div>
          <div style={{ fontSize:22, fontWeight:800, color:"var(--ink)", marginTop:6, lineHeight:1.4 }}>把 OEM 数据，正确转化为<br/>可解释、可验证、可直接入费率的定价数据集</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px 10px", marginTop:14 }}>
            {["每个因子可解释 · 单调 · 可复核","十分位赔付率单调上升","近 8 周 PSI 稳定 · 校准 A/E 1.00"].map((t,i)=>(
              <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, color:"var(--ink-2)",
                background:"var(--surface)", border:"1px solid var(--border)", borderRadius:999, padding:"5px 11px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--band-low)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:26 }}>
          {DPr.MODEL_METRICS.map(m => (
            <div key={m.k} style={{ textAlign:"center" }}>
              <div style={{ fontSize:30, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{m.v}</div>
              <div style={{ fontSize:12.5, fontWeight:700, color:"var(--accent)" }}>{m.k}</div>
              <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>{m.note}</div>
            </div>
          ))}
          <div style={{ textAlign:"center", paddingLeft:22, borderLeft:"1px solid var(--border)" }}>
            <div style={{ fontSize:30, fontWeight:800, color:"var(--band-crit)", fontVariantNumeric:"tabular-nums" }}>{DPr.PRICING_LIFT.toFixed(2)}×</div>
            <div style={{ fontSize:12.5, fontWeight:700, color:"var(--accent)" }}>提升度 Lift</div>
            <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>头尾十分位比</div>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.32fr 1fr", gap:"var(--gap)", alignItems:"start" }}>
        <ValidationScorecard onExportRates={()=>{ downloadText("费率相对系数表.csv", buildRelativityCSV(), "text/csv"); fire("已导出 费率相对系数表.csv（10 档 + 分层汇总）"); }} />
        <Card title="定价因子表" sub="12 因子 · 可解释、单调、可复核" right={
          <DownloadBtn sm label="导出 CSV" onClick={()=>{ downloadText("定价因子表.csv", buildFactorsCSV(), "text/csv"); fire("已导出 定价因子表.csv"); }} />
        }>
          <FactorTable />
        </Card>
      </div>

      <Card title="数据集交付" sub="多格式交付保险公司精算与核保系统 · 点击即可下载真实样例">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:14 }}>
          {exports.map((e,i) => (
            <div key={i} style={{ border:"1px solid var(--border)", borderRadius:11, padding:"16px", background:"var(--surface-2)", display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/></svg>
                <span style={{ fontSize:10.5, fontWeight:700, color:"var(--ink-3)", background:"var(--surface)", border:"1px solid var(--border)", padding:"2px 8px", borderRadius:999 }}>{e.fmt}</span>
              </div>
              <div style={{ fontSize:14.5, fontWeight:800, color:"var(--ink)" }}>{e.name}</div>
              <div style={{ fontSize:12, color:"var(--ink-3)", lineHeight:1.5, flex:1 }}>{e.desc}</div>
              <div style={{ fontSize:11, color:"var(--ink-3)", fontWeight:600 }}>{e.n}</div>
              <button onClick={e.run} style={{ marginTop:2, border:"none", background:"var(--accent)", color:"#fff", fontSize:13, fontWeight:700,
                padding:"9px 0", borderRadius:8, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:7, whiteSpace:"nowrap" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>
                导出
              </button>
            </div>
          ))}
        </div>
      </Card>

      {toast && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:50,
          background:"var(--ink)", color:"var(--surface)", padding:"12px 20px", borderRadius:10, fontSize:14, fontWeight:700,
          boxShadow:"0 8px 30px rgba(0,0,0,.3)", display:"flex", alignItems:"center", gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--band-low)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          {toast}
        </div>
      )}
    </div>
  );
}
window.PricingScreen = PricingScreen;
