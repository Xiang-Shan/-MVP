/* ============================================================================
   智驾风险 ADAS Risk — 辅助驾驶正在改变风险曲线
   设计思路（给鑫安 CEO 向一汽集团讲的故事）：
   ① 智驾里程占比已不可忽视 → 风险主体正从「人」向「人机共驾」迁移
   ② 智驾开启段风险事件显著更低，但接管瞬间风险高度集中 → 新的风险形态
   ③ 风险随 OTA 版本漂移 → 传统年度定价失效，需要持续重校准
   ④ 结论：智驾里程占比成为第 5 因子；智驾日志存证重塑责任认定与理赔
   ============================================================================ */
const DA = window.DATA;

/* ---- 人驾 vs 智驾开启 风险事件对比（每百km · 试点智驾车辆段级统计）---- */
const ADAS_VS = [
  { k:"急加速",     human:1.6, adas:0.3 },
  { k:"急减速",     human:1.9, adas:0.5 },
  { k:"前碰预警 FCW", human:0.8, adas:0.3 },
  { k:"车道偏离",   human:1.1, adas:0.1 }
];
function VsBars({ h = 196 }){
  const W = 560, P = { l: 98, r: 46, t: 10, b: 8 };
  const iw = W - P.l - P.r;
  const max = 2.1, rowH = (h - P.t - P.b) / ADAS_VS.length;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block" }}>
        {ADAS_VS.map((r, i) => {
          const y0 = P.t + i * rowH;
          return (
            <g key={r.k}>
              <text x={P.l - 8} y={y0 + rowH / 2 + 4} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--ink-2)">{r.k}</text>
              <rect x={P.l} y={y0 + rowH * 0.16} width={r.human / max * iw} height={rowH * 0.27} rx="3"
                fill="color-mix(in srgb, var(--ink-3) 52%, var(--surface-2))" />
              <text x={P.l + r.human / max * iw + 6} y={y0 + rowH * 0.16 + rowH * 0.22} fontSize="10.5" fontWeight="800" fill="var(--ink-2)">{r.human}</text>
              <rect x={P.l} y={y0 + rowH * 0.52} width={Math.max(r.adas / max * iw, 3)} height={rowH * 0.27} rx="3"
                fill="color-mix(in srgb, var(--band-low) 80%, var(--surface-2))" />
              <text x={P.l + r.adas / max * iw + 6} y={y0 + rowH * 0.52 + rowH * 0.22} fontSize="10.5" fontWeight="800" fill="var(--band-low)">{r.adas}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display:"flex", gap:16, fontSize:11.5, color:"var(--ink-2)", marginTop:2 }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}><span style={{ width:8, height:8, borderRadius:2.5, background:"color-mix(in srgb, var(--ink-3) 52%, var(--surface-2))" }} />人驾路段</span>
        <span style={{ display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}><span style={{ width:8, height:8, borderRadius:2.5, background:"var(--band-low)" }} />智驾开启路段</span>
        <span style={{ marginLeft:"auto", color:"var(--ink-3)", whiteSpace:"nowrap" }}>次 / 百km</span>
      </div>
    </div>
  );
}

/* ---- 场景分解 ---- */
const SCENES = [
  { k:"高速领航", share:68, ev:"风险事件最低", note:"封闭路权 · 车道线清晰", col:"var(--band-low)" },
  { k:"城区辅助", share:27, ev:"接管最密集", note:"加塞 · 行人 · 施工区", col:"var(--band-mid)" },
  { k:"泊车辅助", share:5,  ev:"低速剐蹭高频低损", note:"单均赔付小 · 频度高", col:"var(--band-high)" }
];

/* ---- 接管原因 ---- */
const TAKEOVER_REASONS = [
  { k:"加塞 / 近距离切入", v:31 },
  { k:"施工区 · 车道线缺失", v:22 },
  { k:"大曲率匝道 / 汇流", v:17 },
  { k:"雨雾等恶劣天气", v:14 },
  { k:"系统降级 · 其他", v:16 }
];

/* ---- OTA 版本 vs 接管率 ---- */
const OTA_TREND = [
  { ver:"v3.1", m:"2025-09", takeover:5.4, aebFalse:0.9 },
  { ver:"v3.2", m:"2025-12", takeover:4.6, aebFalse:0.7 },
  { ver:"v3.3", m:"2026-03", takeover:4.0, aebFalse:0.5 },
  { ver:"v3.4", m:"2026-05", takeover:3.4, aebFalse:0.4 }
];
function OtaChart({ h = 170 }){
  const W = 560, P = { l: 34, r: 14, t: 16, b: 30 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const x = (i) => P.l + (i + 0.5) / OTA_TREND.length * iw;
  const y = (v) => P.t + ih - v / 6 * ih;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block" }}>
      {[0, 2, 4, 6].map(v => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={P.l - 5} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">{v}</text>
        </g>
      ))}
      <path d={OTA_TREND.map((r, i) => (i ? "L" : "M") + x(i) + " " + y(r.takeover)).join("")}
        fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {OTA_TREND.map((r, i) => (
        <g key={r.ver}>
          <circle cx={x(i)} cy={y(r.takeover)} r="3.4" fill="var(--accent)" />
          <text x={x(i)} y={y(r.takeover) - 9} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink)">{r.takeover}</text>
          <text x={x(i)} y={h - 16} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink-2)">{r.ver}</text>
          <text x={x(i)} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{r.m}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---- 智驾占比 × 评分 mini scatter（第5因子证据）---- */
function AdasScatter({ h = 150 }){
  const W = 250, P = { l: 30, r: 8, t: 8, b: 22 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const x = (s) => P.l + s / 50 * iw;
  const y = (sc) => P.t + ih - (sc - 250) / 700 * ih;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block" }}>
      {[300, 600, 900].map(s => (
        <g key={s}>
          <line x1={P.l} x2={W - P.r} y1={y(s)} y2={y(s)} stroke="var(--border)" strokeDasharray="2 3" />
          <text x={P.l - 4} y={y(s) + 3} textAnchor="end" fontSize="8.5" fill="var(--ink-3)">{s}</text>
        </g>
      ))}
      {[0, 25, 50].map(s => <text key={s} x={x(s)} y={h - 5} textAnchor="middle" fontSize="8.5" fill="var(--ink-3)">{s}%</text>)}
      {DA.ADASV.map(v => (
        <circle key={v.id} cx={x(Math.min(v.adas.share, 50))} cy={y(v.score)} r="2.2"
          fill={v.adas.tier === "hp" ? "var(--accent)" : "var(--ink-3)"} opacity="0.55" />
      ))}
    </svg>
  );
}

function AdasScreen({ onOpenVehicle }){
  const S = DA.ADAS_SUMMARY;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      {/* 叙事头 */}
      <div className="card" style={{ padding:"calc(var(--card-pad) + 2px)", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap",
        background:"linear-gradient(120deg, var(--surface) 58%, var(--accent-soft))" }}>
        <div style={{ flex:"1 1 380px", minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--accent)", letterSpacing:".04em" }}>风险主体正从「人」迁移到「人机共驾」</div>
          <div style={{ fontSize:21, fontWeight:800, color:"var(--ink)", marginTop:5, lineHeight:1.4 }}>试点车队 {S.shareAvg}% 的里程由辅助驾驶完成 —— 这部分风险，传统保单看不见</div>
          <div style={{ fontSize:13, color:"var(--ink-2)", marginTop:8, lineHeight:1.6 }}>
            红旗「司南」把城市 NOA 做成出厂标配，人机共驾正成为一汽新车的常态。智驾开启段事件率显著更低、但接管瞬间风险高度集中，且随 OTA 每季度漂移 ——
            谁先量化这条新风险曲线，谁先拿到下一代车险的定价权。
          </div>
        </div>
        <div style={{ display:"flex", gap:22, flex:"0 0 auto" }}>
          {[["高阶城市 NOA", S.hpFull + " 辆", "司南级 · 城区+高速 · 红旗天工 / 新一代纯电平台"], ["L2 基础辅助", S.l2Full + " 辆", "ACC + 车道居中 · 大众 ID. / 奥迪 / 奔腾"]].map(([t, n, d]) => (
            <div key={t} style={{ textAlign:"left" }}>
              <div style={{ fontSize:26, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{n}</div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)" }}>{t}</div>
              <div style={{ fontSize:11, color:"var(--ink-3)", maxWidth:170 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--gap)" }}>
        <KPI label="智驾里程占比" value={S.shareAvg + "%"} accent sub="车队均值 · 司南级车辆达 35%+" />
        <KPI label="月度智驾里程" value={fmt(S.kmMonthFull)} unit="km" sub={`${fmt(S.nFull)} 辆 L2+ · 样本 ${S.n}`} />
        <KPI label="平均接管率 · 次/千km" value={S.takeoverAvg} sub="高阶城市 NOA · 智驾里程口径" />
        <KPI label="AEB 触发 · 次/万km" value={S.aebAvg} sub="自动紧急制动 · 与激进驾驶正相关" />
      </div>

      <Card title="红旗『司南』· 一汽集团高阶智驾基准" sub="技术现货化 · 天巧 05/06/08 已量产 · 卓驾(原大疆)成行平台 · 高通 SA8650P">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
          {[
            { n:"司南 100", t:"高速 NOA + 通勤记忆领航", d:"7 摄像头纯视觉 · 基础 L2+ · 全系标配 AEB", lv:"L2+", col:"var(--band-mid)" },
            { n:"司南 500", t:"全场景城市 NOA + 车位到车位", d:"城区 100% 覆盖 · 进阶版加激光雷达 · 百公里接管 <0.25", lv:"L3-ready", col:"var(--band-high)" },
            { n:"司南 1000", t:"端到端大模型 + VLA 语音/手势", d:"1000+ TOPS · 全冗余架构 · 特定区域 L4", lv:"L3/L4", col:"var(--accent)" }
          ].map(s=>(
            <div key={s.n} style={{ border:"1px solid var(--border)", borderRadius:11, padding:"13px 14px", background:"var(--surface-2)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:15, fontWeight:900, color:"var(--ink)" }}>{s.n}</span>
                <span style={{ fontSize:10.5, fontWeight:800, color:"#fff", background:s.col, borderRadius:5, padding:"2px 8px" }}>{s.lv}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:"var(--ink)", marginTop:8 }}>{s.t}</div>
              <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:4, lineHeight:1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:18, marginTop:14, flexWrap:"wrap", alignItems:"center", borderTop:"1px solid var(--border)", paddingTop:12 }}>
          <div style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.65, flex:"1 1 320px" }}>
            <b>渗透率对照：</b>试点 {S.n}/{DA.FLEET.length} 辆（{Math.round(S.n/DA.FLEET.length*100)}%）已搭载 L2+，其中 {fmt(S.hpFull)} 辆城市 NOA · 代表性样本 {S.n}/{DA.FLEET.length} ——
            与 2025 年行业新能源 L2 渗透（≈70%）、城市 NOA（≈15%）同区间。智驾不是少数派，而是<b style={{ color:"var(--ink)" }}>正在成为出厂默认</b>。
          </div>
          <div style={{ display:"flex", gap:22 }}>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:26, fontWeight:900, color:"var(--accent)", fontVariantNumeric:"tabular-nums" }}>{Math.round(S.n/DA.FLEET.length*100)}%</div><div style={{ fontSize:11, color:"var(--ink-3)" }}>试点 L2+ 渗透</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:26, fontWeight:900, color:"var(--ink)" }}>100%</div><div style={{ fontSize:11, color:"var(--ink-3)" }}>司南城区覆盖率</div></div>
          </div>
        </div>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"1.25fr 1fr", gap:"var(--gap)" }}>
        <Card title="人驾 vs 智驾开启 · 风险事件率" sub="同车同路段配对统计 · 次/百km">
          <VsBars />
          <div style={{ marginTop:8, padding:"10px 13px", borderRadius:10, background:"var(--surface-2)", fontSize:12.5, color:"var(--ink-2)", lineHeight:1.6 }}>
            智驾开启段平均事件率 <b style={{ color:"var(--band-low)" }}>−72%</b>；但<b style={{ color:"var(--ink)" }}>接管前后 ±5 秒</b>的事件密度是平稳巡航段的
            <b style={{ color:"var(--band-crit)" }}> 3.2 倍</b> —— 风险没有消失，而是向「人机交接瞬间」集中。
          </div>
        </Card>
        <Card title="场景分解 · 智驾里程去哪了" sub="段级日志按场景归并">
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            {SCENES.map(s => (
              <div key={s.k}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                  <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)" }}>{s.k}
                    <span style={{ fontSize:11.5, fontWeight:600, color:"var(--ink-3)", marginLeft:8 }}>{s.note}</span></span>
                  <span style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{s.share}%</span>
                </div>
                <div style={{ height:9, borderRadius:5, background:"var(--surface-2)", overflow:"hidden" }}>
                  <div style={{ width:s.share + "%", height:"100%", borderRadius:5, background:`color-mix(in srgb, ${s.col} 78%, var(--surface-2))` }} />
                </div>
                <div style={{ fontSize:11.5, color:s.col, fontWeight:700, marginTop:4 }}>{s.ev}</div>
              </div>
            ))}
            <div style={{ fontSize:11.5, color:"var(--ink-3)", lineHeight:1.55, borderTop:"1px solid var(--border)", paddingTop:10 }}>
              定价含义：高速领航里程可视作「低风险里程」给予折扣；城区辅助需按接管密度单独定价；泊车场景适合「小额高频」附加险。
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.25fr", gap:"var(--gap)" }}>
        <Card title="接管原因分布" sub="高阶领航 · 近 30 天 · 人工标注抽样">
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {TAKEOVER_REASONS.map(r => (
              <div key={r.k} style={{ display:"grid", gridTemplateColumns:"1fr 130px 34px", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:12.5, fontWeight:600, color:"var(--ink-2)" }}>{r.k}</span>
                <div style={{ height:9, borderRadius:5, background:"var(--surface-2)", overflow:"hidden" }}>
                  <div style={{ width:r.v / 31 * 100 + "%", height:"100%", borderRadius:5, background:"color-mix(in srgb, var(--accent) 70%, var(--surface-2))" }} />
                </div>
                <span style={{ fontSize:12.5, fontWeight:800, color:"var(--ink)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{r.v}%</span>
              </div>
            ))}
            <div style={{ fontSize:11.5, color:"var(--ink-3)", lineHeight:1.55, marginTop:2 }}>
              接管热点路段（匝道/施工区）回流一汽研发，用于场景库与下一版 OTA 标定 —— 数据闭环的另一半价值。
            </div>
          </div>
        </Card>
        <Card title="风险随 OTA 版本漂移" sub="接管率 · 次/千km 智驾里程 · 版本发布节奏">
          <OtaChart />
          <div style={{ marginTop:6, padding:"10px 13px", borderRadius:10, background:"var(--surface-2)", fontSize:12.5, color:"var(--ink-2)", lineHeight:1.6 }}>
            三个版本接管率下降 <b style={{ color:"var(--band-low)" }}>−37%</b>。车辆的风险水平不再固定于投保时点，而是<b style={{ color:"var(--ink)" }}>随软件推送逐季漂移</b>
            —— 年度一口价定价失效，模型需按版本持续重校准（PSI 监控已纳入定价数据集）。
          </div>
        </Card>
      </div>

      <Card title="对鑫安的定价与理赔含义" sub="从「看见智驾」到「定价智驾」三步走">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1.1fr", gap:"calc(var(--gap) + 4px)", alignItems:"start" }}>
          <div>
            <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)", marginBottom:6 }}>① 人机共驾因子（第 5 维）</div>
            <div style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.6 }}>
              「智驾里程占比」与从车风险分负相关（下图，每点一辆车）——这正是「人机共驾」维度作为保护因子的实证。
              高占比 + 低接管车辆可获保费系数下浮至 <b style={{ color:"var(--band-low)" }}>0.92</b>。
            </div>
            <AdasScatter />
            <div style={{ fontSize:10.5, color:"var(--ink-3)" }}>横轴：智驾里程占比 · 纵轴：从车风险分（高=险）· 红点为高阶城市 NOA</div>
          </div>
          <div>
            <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)", marginBottom:6 }}>② 责任认定与理赔提效</div>
            <div style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.6 }}>
              事故前 30 秒智驾状态、接管信号、AEB 动作全量存证（EDR + 智驾日志）。
              人驾/智驾责任一键厘清，争议案件查勘时效预计 <b style={{ color:"var(--band-low)" }}>−40%</b>，
              并为「智驾责任险」提供承保事实基础。
            </div>
          </div>
          <div>
            <div style={{ fontSize:13.5, fontWeight:800, color:"var(--ink)", marginBottom:6 }}>③ 与一汽共建新险种</div>
            <div style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.6 }}>
              智驾责任险 / 接管空窗保障 / 泊车小额险 —— 由真实接管率与场景事件率定价，
              随新车型与 OTA 同步上新。保险从「事后赔付」变成<b style={{ color:"var(--ink)" }}>随整车智能化一起迭代的产品线</b>，
              这是股东数据独有的护城河。
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
window.AdasScreen = AdasScreen;
