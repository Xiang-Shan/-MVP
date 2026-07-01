/* ============================================================================
   数据接入 OEM Ingestion / Pipeline — raw signals → 4 indicators
   ============================================================================ */
const DP = window.DATA;

function PipelineFlow(){
  return (
    <div style={{ display:"flex", alignItems:"stretch", gap:0, overflowX:"auto" }}>
      {DP.PIPELINE_STAGES.map((s,i) => (
        <React.Fragment key={s.key}>
          <div style={{ flex:"1 1 0", minWidth:130, display:"flex", flexDirection:"column", gap:8,
            background: i===4?"var(--accent-soft)":"var(--surface-2)", border:"1px solid var(--border)",
            borderRadius:12, padding:"16px 15px", position:"relative" }}>
            <div style={{ fontSize:11, fontWeight:700, color: i===4?"var(--accent)":"var(--ink-3)", letterSpacing:".04em" }}>0{i+1}</div>
            <div style={{ fontSize:15.5, fontWeight:800, color:"var(--ink)" }}>{s.name}</div>
            <div style={{ fontSize:12, color:"var(--ink-3)", lineHeight:1.4, minHeight:32 }}>{s.sub}</div>
            <div style={{ marginTop:"auto", paddingTop:8 }}>
              <span style={{ fontSize:22, fontWeight:800, color: i===4?"var(--accent)":"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{s.metric}</span>
              <span style={{ fontSize:11.5, color:"var(--ink-3)", marginLeft:5 }}>{s.unit}</span>
            </div>
            {s.loss>0 && <div style={{ fontSize:11, color:"var(--band-high)" }}>过滤 {s.loss}% 噪声/缺失</div>}
          </div>
          {i<DP.PIPELINE_STAGES.length-1 && (
            <div style={{ flex:"0 0 26px", display:"grid", placeItems:"center", color:"var(--ink-3)", fontSize:20 }}>→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function MappingTable(){
  return (
    <div style={{ overflow:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontVariantNumeric:"tabular-nums" }}>
        <thead>
          <tr style={{ borderBottom:"1px solid var(--border)" }}>
            {["原始信号","采样","原始字段","日数据量","映射到 · 5 维度 / 12 特征"].map((h,i)=>(
              <th key={i} style={{ textAlign: i===4?"left":"left", padding:"0 12px 11px", fontSize:12, fontWeight:700, color:"var(--ink-2)", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DP.RAW_SIGNALS.map((r,i) => {
            const d = r.dim ? DP.DIM_OF[r.dim] : null;
            return (
              <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"12px", fontSize:14, fontWeight:700, color:"var(--ink)" }}>{r.sig}</td>
                <td style={{ padding:"12px", fontSize:13, color:"var(--ink-2)" }}>{r.hz}</td>
                <td style={{ padding:"12px", fontSize:12.5, color:"var(--ink-3)", fontFamily:"var(--mono)" }}>{r.field}</td>
                <td style={{ padding:"12px", fontSize:13, color:"var(--ink-2)" }}>{r.vol}</td>
                <td style={{ padding:"12px" }}>
                  {d ? (
                    <span style={{ display:"inline-flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:12.5, fontWeight:800, color:"#fff", background:d.color, padding:"3px 9px", borderRadius:999, whiteSpace:"nowrap" }}>{d.name}</span>
                      <span style={{ fontSize:12, color:"var(--ink-3)" }}>{r.feats}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize:12.5, color:"var(--ink-3)" }}>{r.feats}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QualityRing({ label, value, color }){
  const r=30, C=2*Math.PI*r;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <div style={{ position:"relative", width:76, height:76 }}>
        <svg width="76" height="76" viewBox="0 0 76 76">
          <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
          <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(value/100*C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 38 38)" />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:1, whiteSpace:"nowrap", lineHeight:1 }}>
            <span style={{ fontSize:21, fontWeight:800, color:"var(--ink)", fontVariantNumeric:"tabular-nums" }}>{value}</span>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--ink-3)" }}>%</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize:12.5, color:"var(--ink-2)", textAlign:"center", fontWeight:600 }}>{label}</div>
    </div>
  );
}

function OemFeedRow({ o }){
  const cars = DP.FLEET.filter(v=>v.oem===o.id).length;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", border:"1px solid var(--border)", borderRadius:11, background:"var(--surface)" }}>
      <span style={{ width:9, height:9, borderRadius:"50%", background:"var(--band-low)", boxShadow:"0 0 0 3px color-mix(in srgb, var(--band-low) 22%, transparent)", flex:"0 0 auto" }} />
      <div style={{ width:40, height:40, borderRadius:9, background:o.color, color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:o.avatar.length>1?13:18, flex:"0 0 auto" }}>{o.avatar}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14.5, fontWeight:800, color:"var(--ink)" }}>{o.name}</div>
        <div style={{ fontSize:12, color:"var(--ink-3)", fontFamily:"var(--mono)" }}>{o.protocol}</div>
      </div>
      {[["全国接入",fmt(o.national),"var(--ink)"],["试点评分", o.pilot ? cars : "—", o.pilot ? "var(--accent)" : "var(--ink-3)"],["平均延迟",o.latency,"var(--ink)"],["链路在线",o.uptime+"%","var(--band-low)"]].map((m,i)=>(
        <div key={i} style={{ textAlign:"right", minWidth:64 }}>
          <div style={{ fontSize:16, fontWeight:800, color:m[2], fontVariantNumeric:"tabular-nums" }}>{m[1]}</div>
          <div style={{ fontSize:11, color:"var(--ink-3)" }}>{m[0]}</div>
        </div>
      ))}
      {o.pilot
        ? <span style={{ fontSize:12, fontWeight:700, color:"var(--band-low)", background:"color-mix(in srgb, var(--band-low) 12%, transparent)", padding:"5px 11px", borderRadius:999 }}>实时同步中</span>
        : <span style={{ fontSize:12, fontWeight:700, color:"var(--band-mid)", background:"color-mix(in srgb, var(--band-mid) 12%, transparent)", padding:"5px 11px", borderRadius:999 }}>OBD 口径适配中</span>}
    </div>
  );
}

function PipelineScreen(){
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--gap)" }}>
      <Card title="数据加工链路" sub="从 OEM 原始信号到评分就绪 · 每一步可追溯">
        <PipelineFlow />
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:"var(--gap)" }}>
        <Card title="信号 → 特征 映射" sub="原始车端字段如何转化为 12 特征 / 5 维度可解释风险">
          <MappingTable />
        </Card>
        <Card title="数据质量门禁" sub="入模前的质量校验">
          <div style={{ display:"flex", justifyContent:"space-around", marginBottom:18 }}>
            <QualityRing label="字段完整度" value={98} color="var(--band-low)" />
            <QualityRing label="时序对齐率" value={99} color="var(--band-low)" />
            <QualityRing label="单调性达标" value={96} color="var(--band-mid)" />
          </div>
          <div style={{ fontSize:13, color:"var(--ink-2)", lineHeight:1.6, borderTop:"1px solid var(--border)", paddingTop:14 }}>
            未达门禁的车辆不进入评分，避免“脏数据”污染定价。所有规则版本化留痕，可向监管与再保方复核。
          </div>
        </Card>
      </div>

      <Card title="OEM 数据源接入状态" sub="一汽集团 6 大品牌 · 车云直连 · 试点深度评分覆盖纯电/插混">
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {DP.OEMS.map(o => <OemFeedRow key={o.id} o={o} />)}
        </div>
      </Card>
    </div>
  );
}
window.PipelineScreen = PipelineScreen;
