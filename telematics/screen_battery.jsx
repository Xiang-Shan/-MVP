/* ============================================================================
   电池健康 Battery Health — SOH 诊断 · 热失控前兆预警 · 季节性风险迁移
   口径：鑫安在保纯电（BEV）· 明细样本按在保规模缩放；季节性曲线为全国接入口径
   ============================================================================ */
const DB = window.DATA;

/* ---- SOH histogram (88–100, 1% bins) ---- */
function SohHistogram({ h = 168 }){
  const bins = [];
  for(let lo = 87; lo < 100; lo += 1) bins.push({ lo, n: 0 });
  DB.EVS.forEach(v => {
    const b = bins.find(b => v.battery.soh >= b.lo && v.battery.soh < b.lo + 1) || bins[bins.length - 1];
    b.n++;
  });
  const max = Math.max(...bins.map(b => b.n));
  const W = 560, P = { l: 8, r: 8, t: 14, b: 22 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const bw = iw / bins.length;
  const colOf = (lo) => lo >= 95 ? "var(--band-low)" : lo >= 91 ? "var(--band-mid)" : "var(--band-high)";
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block" }}>
      {bins.map((b, i) => {
        const bh = b.n / max * ih;
        return (
          <g key={i}>
            <rect x={P.l + i * bw + bw * 0.14} y={P.t + ih - bh} width={bw * 0.72} height={Math.max(bh, b.n ? 2 : 0)} rx="3"
              fill={`color-mix(in srgb, ${colOf(b.lo)} 72%, var(--surface-2))`} />
            {b.n > 0 && bh > 14 && <text x={P.l + i * bw + bw / 2} y={P.t + ih - bh - 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--ink-3)">{b.n}</text>}
            {i % 2 === 0 && <text x={P.l + i * bw + bw / 2} y={h - 6} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">{b.lo}%</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ---- SOH vs 车龄 scatter, colored by 快充强度 ---- */
function SohScatter({ h = 196 }){
  const W = 560, P = { l: 36, r: 14, t: 12, b: 26 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const x = (age, jit) => P.l + ((age - 0.5 + jit) / 4.2) * iw;
  const y = (soh) => P.t + ih - (soh - 87) / 12.5 * ih;
  const colOf = (f) => f >= 50 ? "var(--band-crit)" : f >= 28 ? "var(--band-mid)" : "var(--band-low)";
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block" }}>
        {[88, 92, 96, 99].map(s => (
          <g key={s}>
            <line x1={P.l} x2={W - P.r} y1={y(s)} y2={y(s)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={P.l - 5} y={y(s) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">{s}%</text>
          </g>
        ))}
        {[1, 2, 3, 4].map(a => <text key={a} x={x(a, 0)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{a} 年</text>)}
        {DB.EVS.map((v, i) => {
          const jit = ((i * 37) % 100) / 100 * 0.56 - 0.28;
          return <circle key={v.id} cx={x(v.ageYr, jit)} cy={y(v.battery.soh)} r="3.1"
            fill={colOf(v.vals.fast)} opacity="0.62" />;
        })}
      </svg>
      <div style={{ display:"flex", gap:16, fontSize:11.5, color:"var(--ink-2)", marginTop:4, flexWrap:"wrap" }}>
        {[["家充为主（快充<28%）","var(--band-low)"],["混合补能（28–50%）","var(--band-mid)"],["快充依赖（≥50%）","var(--band-crit)"]].map(([l,c]) => (
          <span key={l} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:c }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- 季节性：高温/低温告警 + 续航达成率 ---- */
function SeasonalAlarms({ h = 190 }){
  const M = DB.PLATFORM_MONTHLY;
  const W = 560, P = { l: 30, r: 36, t: 14, b: 22 };
  const iw = W - P.l - P.r, ih = h - P.t - P.b;
  const maxA = 30;
  const bw = iw / M.length;
  const x = (i) => P.l + i * bw;
  const yA = (v) => P.t + ih - v / maxA * ih;
  const yR = (v) => P.t + ih - (v - 55) / 45 * ih;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display:"block" }}>
        {[0, 10, 20, 30].map(v => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={yA(v)} y2={yA(v)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={P.l - 5} y={yA(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--ink-3)">{v}</text>
          </g>
        ))}
        {[60, 80, 100].map(v => <text key={v} x={W - P.r + 5} y={yR(v) + 3.5} fontSize="9.5" fill="#1E50A0">{v}%</text>)}
        {M.map((r, i) => (
          <g key={i}>
            <rect x={x(i) + bw * 0.14} y={yA(r.hot)} width={bw * 0.32} height={ih - (yA(r.hot) - P.t)} rx="2"
              fill="color-mix(in srgb, var(--band-crit) 70%, var(--surface-2))" />
            <rect x={x(i) + bw * 0.52} y={yA(r.cold)} width={bw * 0.32} height={ih - (yA(r.cold) - P.t)} rx="2"
              fill="color-mix(in srgb, #1E96D0 70%, var(--surface-2))" />
            {i % 2 === 0 && <text x={x(i) + bw / 2} y={h - 6} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">{r.label}</text>}
          </g>
        ))}
        <path d={M.map((r, i) => (i ? "L" : "M") + (x(i) + bw / 2).toFixed(1) + " " + yR(r.range).toFixed(1)).join("")}
          fill="none" stroke="#1E50A0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {M.map((r, i) => <circle key={"c" + i} cx={x(i) + bw / 2} cy={yR(r.range)} r="2.3" fill="#1E50A0" />)}
      </svg>
      <div style={{ display:"flex", gap:16, fontSize:11.5, color:"var(--ink-2)", marginTop:4, flexWrap:"wrap" }}>
        {[["高温热风险告警 · 次/千辆月","var(--band-crit)"],["低温充电受限 · 次/千辆月","#1E96D0"],["续航达成率（右轴）","#1E50A0"]].map(([l,c]) => (
          <span key={l} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:2.5, background:c }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- 预警列表 ---- */
function WarnTable({ onOpenVehicle }){
  const rows = [...DB.EVS].filter(v => v.battery.warnLevel > 0)
    .sort((a, b) => b.battery.warnLevel - a.battery.warnLevel || a.battery.soh - b.battery.soh)
    .slice(0, 9);
  const lv = (w) => w === 2
    ? { t:"L2 进站核查", c:"var(--band-crit)" }
    : { t:"L1 关注", c:"var(--band-high)" };
  const action = (v) => v.battery.warnLevel === 2
    ? "热风险前兆 · 推送进站检测工单"
    : v.battery.cellDev >= 62 ? "压差偏大 · 建议均衡充电" : "快充/温度偏高 · 推送慢充建议";
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ textAlign:"left", color:"var(--ink-3)", fontSize:11.5 }}>
            {["车辆","品牌 · 车型","SOH","电芯压差","温度异常","等级","建议动作"].map(hd =>
              <th key={hd} style={{ padding:"7px 12px", borderBottom:"1px solid var(--border)", fontWeight:700, whiteSpace:"nowrap" }}>{hd}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(v => {
            const L = lv(v.battery.warnLevel);
            return (
              <tr key={v.id} className="row-hover" style={{ cursor:"pointer" }} onClick={() => onOpenVehicle && onOpenVehicle(v.id)}>
                <td style={{ padding:"9px 12px", fontWeight:800, whiteSpace:"nowrap", color:"var(--ink)" }}>{v.plate}</td>
                <td style={{ padding:"9px 12px", color:"var(--ink-2)", whiteSpace:"nowrap" }}>{v.model} · {v.ageYr} 年车龄</td>
                <td style={{ padding:"9px 12px", fontWeight:800, color: v.battery.soh < 91 ? "var(--band-high)" : "var(--ink)", fontVariantNumeric:"tabular-nums" }}>{v.battery.soh}%</td>
                <td style={{ padding:"9px 12px", fontVariantNumeric:"tabular-nums", color: v.battery.cellDev >= 62 ? "var(--band-high)" : "var(--ink-2)" }}>{v.battery.cellDev} mV</td>
                <td style={{ padding:"9px 12px", fontVariantNumeric:"tabular-nums", color: v.f.batteryTemp>=18?"var(--band-crit)":v.f.batteryTemp>=12?"var(--band-high)":"var(--ink-2)" }}>{Math.round(v.f.batteryTemp)} 次/月</td>
                <td style={{ padding:"9px 12px", whiteSpace:"nowrap" }}>
                  <span style={{ fontSize:11, fontWeight:800, color:L.c, border:`1px solid color-mix(in srgb, ${L.c} 45%, transparent)`,
                    background:`color-mix(in srgb, ${L.c} 10%, transparent)`, padding:"3px 9px", borderRadius:999 }}>{L.t}</span>
                </td>
                <td style={{ padding:"9px 12px", fontSize:12, color:"var(--ink-2)" }}>{action(v)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BatteryScreen({ onOpenVehicle }){
  const S = DB.BATTERY_SUMMARY;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"var(--gap)" }}>
        <KPI label="纯电车队平均 SOH" value={S.sohAvg + "%"} accent sub={`鑫安在保 ${fmt(S.nFull)} 辆纯电 · 样本 ${S.n}`} />
        <KPI label="预警车辆" value={fmt(S.l1Full + S.l2Full)} unit="辆" sub={`L1 关注 ${fmt(S.l1Full)} · L2 进站核查 ${fmt(S.l2Full)}`} sparkColor="var(--band-crit)" />
        <KPI label="平均电芯压差" value={S.devAvg} unit="mV" sub="满电静置工况 · 热失控前兆维度" />
        <KPI label="本月续航达成率" value={S.rangeAvg + "%"} sub="6 月 · 夏季空调负荷小幅折损" />
      </div>

      <div className="card" style={{ padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", background:"linear-gradient(120deg, var(--surface) 60%, color-mix(in srgb, var(--band-low) 10%, transparent))" }}>
        <div style={{ width:34, height:34, borderRadius:9, flex:"0 0 auto", display:"grid", placeItems:"center", background:"color-mix(in srgb, var(--band-low) 14%, transparent)", color:"var(--band-low)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ flex:1, minWidth:260 }}>
          <div style={{ fontSize:14.5, fontWeight:800, color:"var(--ink)" }}>电池温度异常 · 已接入 BMS 采样，12/12 特征全就绪</div>
          <div style={{ fontSize:12.5, color:"var(--ink-2)", marginTop:3, lineHeight:1.55 }}>「电池与充电」维度由<b>快充占比 + 温度异常</b>双指标驱动，热失控前兆从「事后推断」前移到「事前直测」。下一步数据合作价值在<b>实时性 · 更多品牌 · 更长历史</b>。</div>
        </div>
        <div style={{ textAlign:"center", flex:"0 0 auto" }}><div style={{ fontSize:25, fontWeight:900, color:"var(--band-low)" }}>12<span style={{ fontSize:14, color:"var(--ink-3)" }}>/12</span></div><div style={{ fontSize:11, color:"var(--ink-3)" }}>特征已就绪</div></div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--gap)" }}>
        <Card title="SOH 分布" sub={`代表性样本 ${DB.BATTERY_SUMMARY.n} 辆 · 在保全量 ${fmt(DB.BATTERY_SUMMARY.nFull)} · 1% 分箱`}>
          <SohHistogram />
          <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:4 }}>≥95% 健康 · 91–95% 正常衰减 · &lt;91% 重点关注（与快充/温度暴露强相关）</div>
        </Card>
        <Card title="衰减归因 · SOH × 车龄 × 补能结构" sub="同车龄下，快充依赖车辆 SOH 系统性偏低">
          <SohScatter />
        </Card>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.25fr 1fr", gap:"var(--gap)" }}>
        <Card title="季节性 · 电池风险随气温迁移" sub="全国接入口径 · 近 12 个月 · 进站核查级告警">
          <SeasonalAlarms />
          <div style={{ fontSize:11.5, color:"var(--ink-3)", marginTop:6, lineHeight:1.6 }}>
            7–8 月高温热风险峰值；12–2 月低温充电受限、续航达成率跌至 66%（低温活性 + 暖风负荷）。
            注：本图为进站核查级告警；试点「温度异常因子」为 BMS 采样级越限，量级口径不同。
          </div>
        </Card>
        <Card title="保险视角 · 电池数据的三重价值" sub="从定价到减损到延保">
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            {[
              ["三电险与延保定价", "SOH 衰减曲线 + 循环数 → 电池险/延保的科学费率，替代单一车龄定价。"],
              ["热失控前兆减损", "温度异常 × 电芯压差双指标预警，进站核查前置 —— 把大额赔案拦在发生前。"],
              ["残值与置换支撑", "电池健康档案 = 二手车残值定价依据，反哺一汽认证二手车与置换业务。"]
            ].map((r, i) => (
              <div key={i} style={{ display:"flex", gap:11 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", marginTop:7, flex:"0 0 auto" }} />
                <div><b style={{ fontSize:14, color:"var(--ink)" }}>{r[0]}</b>
                  <div style={{ fontSize:12.5, color:"var(--ink-2)", lineHeight:1.55, marginTop:2 }}>{r[1]}</div></div>
              </div>
            ))}
            <div style={{ marginTop:2, padding:"11px 13px", borderRadius:10, background:"var(--accent-soft)", fontSize:12.5, color:"var(--ink)", lineHeight:1.6 }}>
              同一份诊断，双向交付：对内进核保与预警工单，对外化为车主端「电池健康月报」——见
              <b> 车主互动</b>。
            </div>
          </div>
        </Card>
      </div>

      <Card title="热失控前兆预警 · 工单队列" sub="规则：温度异常 + 压差 + 快充强度 + 车龄综合判定 · 代表性样本 · 点击行进入车辆详情">
        <WarnTable onOpenVehicle={onOpenVehicle} />
      </Card>
    </div>
  );
}
window.BatteryScreen = BatteryScreen;
