"use strict";
/* ============================================================================
   鑫安汽车保险 · 从车风险数据平台 — 模拟数据与评分引擎 v3
   技术引擎：律商风险（LexisNexis Risk Solutions）
   v3：一汽集团 6 大品牌（大众/奥迪/红旗/丰田/奔腾/捷达，车型脱敏）· 多层口径（全国接入 128.6万
   × 上海深度评分试点 5万/50,000 × 鑫安在保 7,998）· 12 个月季节性 · 电池 SOH 诊断 · 智驾(ADAS)风险
   物理一致性原则：行为决定因子 → 因子决定评分；电池衰减由车龄/快充/温度推导；
   智驾使用与驾驶激进度负相关；捷达为燃油品牌（无在售纯电），不进入电池口径试点
   ============================================================================ */

/* ---------- seeded RNG (mulberry32) ---------- */
function makeRng(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- scoring model ---------- */
const FACTORS = [
  { key:"km",   name:"月均里程",     short:"里程",   unit:"km",      lo:200, hi:3000, w:110, refMean:1400,
    raw:"GPS 轨迹 / 里程表累计", desc:"行驶暴露度。里程越高，单位时间出险机会越大。" },
  { key:"fast", name:"快充占比",     short:"快充",   unit:"%",       lo:0,   hi:90,   w:75, refMean:35,
    raw:"充电会话日志（功率 kW）", desc:"高功率快充占比，关联电池衰减与热风险。" },
  { key:"temp", name:"电池温度异常", short:"温度",   unit:"次/月",   lo:0,   hi:30,   w:85, refMean:8,
    raw:"BMS 温度采样 / 告警", desc:"单月电池温度越限次数，热失控前兆信号。" },
  { key:"acc",  name:"急加速频次",   short:"急加速", unit:"次/百km", lo:0,   hi:40,   w:75, refMean:14,
    raw:"IMU 加速度（g 阈值）", desc:"激进驾驶代理变量，与碰撞/事故率正相关。" }
];
const BASE = 540, SCORE_MIN = 200, SCORE_MAX = 997, RR_DIVISOR = 1162;

function zscore(f, val){ return (val - f.refMean) / ((f.hi - f.lo) / 2); }

function computeScore(vals){
  let s = BASE; const contribs = {};
  FACTORS.forEach(f => { const c = f.w * zscore(f, vals[f.key]); contribs[f.key] = c; s += c; });
  s = Math.round(s);
  s = Math.max(SCORE_MIN, Math.min(SCORE_MAX, s));
  return { score:s, contribs };
}
function relativeRisk(a, b){ return Math.exp((a - b) / RR_DIVISOR); }

const BANDS = [
  { key:"crit", min:760, label:"高风险",   color:"var(--band-crit)", hex:"#ED1C24" },
  { key:"high", min:620, label:"中高风险", color:"var(--band-high)", hex:"#FF8200" },
  { key:"mid",  min:480, label:"中等风险", color:"var(--band-mid)",  hex:"#E1A300" },
  { key:"low",  min:0,   label:"低风险",   color:"var(--band-low)",  hex:"#00AF66" }
];
function bandOf(score){ return BANDS.find(b => score >= b.min); }

/* ---------- 一汽-大众 数据源（品牌真实 · 车型脱敏）----------
   深度评分试点仅覆盖纯电（BEV）：电池因子（快充/温度）口径完整；
   插电混动多为交流慢充、双能源口径，列为下一阶段；
   捷达为燃油品牌（无在售纯电车型），走 OBD/油耗口径，评分模型适配中。 */
const OEMS = [
  { id:"vw",   name:"大众品牌", en:"FAW-VW · VOLKSWAGEN", avatar:"VW", color:"#1E50A0",
    models:["大众 · 纯电紧凑SUV","大众 · 纯电中大型SUV","大众 · 纯电中型轿车"],
    protocol:"T-Box 4G · MQTT", latency:"38s", uptime:99.4,
    pilot:true, national:431000, nev:39000, fleetNote:"ID. 纯电平台 · 全系 L2 辅助驾驶" },
  { id:"audi", name:"奥迪品牌", en:"FAW-AUDI", avatar:"A", color:"#37424E",
    models:["奥迪 · 纯电中型SUV","奥迪 · 纯电中大型轿车"],
    protocol:"车云直连 · Kafka", latency:"52s", uptime:98.7,
    pilot:true, national:182000, nev:17000, fleetNote:"新一代纯电平台 · 部分车型城市 NOA" },
  { id:"hongqi", name:"红旗品牌", en:"HONGQI", avatar:"红旗", color:"#B81C22",
    models:["红旗 · 天巧05 纯电轿车","红旗 · 天巧06 纯电SUV","红旗 · HS6 PHEV"],
    protocol:"车云直连 · Kafka", latency:"44s", uptime:99.0,
    pilot:true, national:96000, nev:30000, fleetNote:"司南智驾（司南100/500/1000）· 城市 NOA 现货化" },
  { id:"toyota", name:"丰田品牌", en:"FAW-TOYOTA", avatar:"T", color:"#E12A2A",
    models:["丰田 · 油电混动SUV","丰田 · 油电混动轿车"],
    protocol:"T-Box 4G · MQTT", latency:"40s", uptime:99.2,
    pilot:true, national:308000, nev:13500, fleetNote:"HEV 为主 · L2 辅助驾驶逐步标配" },
  { id:"bestune", name:"奔腾品牌", en:"BESTUNE", avatar:"奔腾", color:"#C8102E",
    models:["奔腾 · 纯电SUV","奔腾 · 燃油SUV"],
    protocol:"T-Box 4G · MQTT", latency:"43s", uptime:98.9,
    pilot:true, national:108000, nev:20000, fleetNote:"自主品牌 · 纯电与燃油双线" },
  { id:"jetta", name:"捷达品牌", en:"JETTA", avatar:"J", color:"#7A8896",
    models:["捷达 · 燃油SUV","捷达 · 燃油轿车"],
    protocol:"T-Box 4G · MQTT", latency:"41s", uptime:99.1,
    pilot:false, national:161000, nev:0, fleetNote:"燃油车队 · OBD/油耗口径评分适配中" }
];
const PILOT_OEMS = OEMS.filter(o => o.pilot);

/* ---------- usage profiles (行为决定因子，因子决定风险 — 全链路自洽) ----------
   网约·全职：高里程 + 高快充 + 路线随机 → 必然高风险
   网约·兼职：里程/快充居中 → 中等偏上，少量网约 ≠ 高风险
   网约·已转私用：当前行为已回归私家，评分随之回落 — 看的是时序，不是标签 */
const USAGE_PROFILES = [
  { key:"priv",    label:"私家通勤",     share:0.40, km:[650,1650],  fast:[6,32],  temp:[0,9],  acc:[3,17],  entropy:[0.10,0.30] },
  { key:"family",  label:"家庭多用途",   share:0.18, km:[450,1250],  fast:[5,28],  temp:[0,8],  acc:[2,13],  entropy:[0.22,0.42] },
  { key:"biz",     label:"商务用车",     share:0.12, km:[1100,2150], fast:[18,48], temp:[2,12], acc:[5,19],  entropy:[0.30,0.52] },
  { key:"rh_full", label:"网约·全职",    share:0.11, km:[2350,3000], fast:[55,88], temp:[9,26], acc:[13,33], entropy:[0.72,0.93] },
  { key:"rh_part", label:"网约·兼职",    share:0.11, km:[1350,2100], fast:[28,55], temp:[4,15], acc:[8,22],  entropy:[0.48,0.68] },
  { key:"rh_exit", label:"网约·已转私用", share:0.08, km:[600,1250],  fast:[10,32], temp:[1,8],  acc:[4,15],  entropy:[0.14,0.32] }
];
const USAGE_STATES = {
  priv:   { label:"私家使用",  hex:"#00AF66" },
  biz:    { label:"商务用车",  hex:"#00778B" },
  mix:    { label:"私家+兼职网约", hex:"#E1A300" },
  rh:     { label:"网约载客",  hex:"#ED1C24" }
};

/* ============================================================================
   v4 · 5 维 / 12 特征模型 · 上海深度评分试点 50,000 辆 · 鑫安在保 7,998（明细样本 ~320，EV 分层过采样）— 由 sim_core.js 驱动
   ============================================================================ */
const SIM = window.SIM;
const fmtN = (n)=>Number(n).toLocaleString("en-US");
const clampN = (v,a,b)=>Math.max(a,Math.min(b,v));

/* 第 12 特征「电池温度异常」已仿真为有效接入（次/月 · 仅纯电）—— 从快充/夜间曝露推导，进入电池维度与评分 */
SIM.STATS.batteryTemp = { mean:9.6, std:7.4, min:0, max:42, p2:0, p98:34, q:[0,1,2,3,4,5,6,7,8,9,10,12,13,15,17,19,22,26,31,38,42] };
function simBatteryTemp(b){ if(b.energy!=="纯电") return null;
  var h = makeRng((parseInt(String(b.id).replace(/\D/g,""))||7)+7919)();
  return Math.max(0, Math.round((b.f.fastCharge||0)*100*0.18 + (b.f.night||0)*100*0.10 + h*9)); }

const DIMS = [
  { key:"intensity",  name:"用车强度",   short:"强度", color:"#ED1C24", w:0.33 },
  { key:"aggression", name:"驾驶激进度", short:"激进", color:"#F2683C", w:0.43 },
  { key:"regularity", name:"出行规律性", short:"规律", color:"#D9A300", w:0.18 },
  { key:"battery",    name:"电池与充电", short:"电池", color:"#0E8A6E", w:0.03, cond:"ev",   condLabel:"仅纯电计算" },
  { key:"adas",       name:"人机共驾",   short:"人机", color:"#2A6FDB", w:0.03, cond:"adas", condLabel:"仅L2+计算", protective:true }
];
const DIM_OF = {}; DIMS.forEach(function(d){ DIM_OF[d.key]=d; });

const FMETA = {
  mileage:   { name:"月均行驶里程", short:"月均里程", unit:"km", fmt:function(v){return fmtN(Math.round(v));}, raw:"GPS 轨迹 / 里程表", desc:"行驶暴露度，里程越高出险机会越大" },
  night:     { name:"夜间行驶里程占比", short:"夜间里程", unit:"%", pctv:true, fmt:function(v){return (v*100).toFixed(1);}, raw:"GPS 时间戳 0–4 时", desc:"夜间低能见度叠加疲劳，高风险时段暴露" },
  speeding:  { name:"超速驾驶里程占比", short:"超速", unit:"%", pctv:true, fmt:function(v){return (v*100).toFixed(1);}, raw:"车速 vs 路段限速", desc:"直接对应事故发生率与严重度" },
  fatigue:   { name:"疲劳驾驶里程占比", short:"疲劳", unit:"%", pctv:true, fmt:function(v){return (v*100).toFixed(1);}, raw:"连续驾驶时长", desc:"低反应能力与长时间驾驶风险" },
  hardDecel: { name:"百公里急减速次数", short:"急减速", unit:"次/百km", fmt:function(v){return v.toFixed(2);}, raw:"IMU 纵向加速度", desc:"跟车距离与预判不足" },
  hardTurn:  { name:"百公里急转弯次数", short:"急转弯", unit:"次/百km", fmt:function(v){return v.toFixed(2);}, raw:"IMU 横向加速度", desc:"激烈操控与道路场景风险" },
  destEntropy:{ name:"行驶目的地随机性", short:"目的地随机", unit:"", fmt:function(v){return v.toFixed(2);}, raw:"目的地聚类熵", desc:"路线不熟悉度 / 运营场景复杂度" },
  mileageStd:{ name:"月均里程标准差", short:"里程波动", unit:"km", fmt:function(v){return fmtN(Math.round(v));}, raw:"逐月里程序列", desc:"用车强度不稳定性" },
  timeStd:   { name:"分时段行驶里程标准差", short:"时段波动", unit:"", fmt:function(v){return v.toFixed(2);}, raw:"24 时分时里程", desc:"出行时段规律性变化" },
  fastCharge:{ name:"月均快充占比", short:"快充", unit:"%", pctv:true, fmt:function(v){return (v*100).toFixed(1);}, raw:"充电会话功率", desc:"快充依赖，关联电池衰减与热风险" },
  autonomy:  { name:"自动驾驶里程占比", short:"智驾里程", unit:"%", pctv:true, fmt:function(v){return (v*100).toFixed(1);}, raw:"智驾系统控车里程", desc:"系统控车更平顺，按保护因子处理" },
  batteryTemp:{ name:"电池温度异常", short:"温度异常", unit:"次/月", fmt:function(v){return Math.round(v);}, raw:"BMS 温度采样 / 告警", desc:"单月电池温度越限次数，热失控前兆信号" }
};
const FEATURES12 = SIM.FEAT.map(function(f){ return Object.assign({}, f, FMETA[f.key], { stat: SIM.STATS[f.key] }); });
FEATURES12.push(Object.assign({ key:"batteryTemp", dim:"battery", w:0.04, dir:1, scope:"ev", stat: SIM.STATS.batteryTemp }, FMETA.batteryTemp));
const FEAT_OF = {}; FEATURES12.forEach(function(f){ FEAT_OF[f.key]=f; });
const DIM_FEATS = {}; DIMS.forEach(function(d){ DIM_FEATS[d.key]=FEATURES12.filter(function(f){return f.dim===d.key;}); });

function pctOf(key, v){ var q=SIM.STATS[key].q; if(v<=q[0])return 0; if(v>=q[20])return 100;
  for(var i=1;i<=20;i++){ if(v<=q[i]){ var t=(v-q[i-1])/((q[i]-q[i-1])||1); return (i-1+t)*5; } } return 100; }

const MODEL = SIM.MODEL;

/* ============================================================================
   v5 · 单一刻度评分模型（维度子分制）
   原则：每个维度由其特征算出一个 0–100「风险指数」(人机共驾为保护因子，已反向)，
   再线性映射到与总分同尺度的 200–997「维度子分」；
   从车风险分 = 各维度子分按【适用权重】加权平均 —— 总分与维度量纲一致、可加总、方向一致。
   ============================================================================ */

/* 维度 0–100 风险指数（越高越险；人机共驾=保护，智驾里程越高→指数越低） */
function dimRisk(key, vals, ctx){ var d=DIM_OF[key];
  if(d.cond==="ev" && !ctx.isEV) return null; if(d.cond==="adas" && !ctx.isADAS) return null;
  var feats=DIM_FEATS[key].filter(function(f){return !f.locked;}); var sw=0, acc=0;
  feats.forEach(function(f){ var p=pctOf(f.key, vals[f.key]); if(d.protective) p=100-p; acc+=p*f.w; sw+=f.w; });
  return sw? Math.round(acc/sw) : null; }

/* 维度风险指数全集 + 适用权重（条件维度不适用时，权重在其余维度间归一） */
function dimIndexAll(vals, ctx){ var o={}; DIMS.forEach(function(d){ o[d.key]=dimRisk(d.key, vals, ctx); }); return o; }
function appWeights(idx){ var sw=0; DIMS.forEach(function(d){ if(idx[d.key]!=null) sw+=d.w; });
  var w={}; DIMS.forEach(function(d){ w[d.key]= (idx[d.key]!=null && sw>0) ? d.w/sw : 0; }); return w; }
function rTotalOf(idx){ var w=appWeights(idx); var s=0; DIMS.forEach(function(d){ if(idx[d.key]!=null) s+=w[d.key]*idx[d.key]; }); return s; }

/* 标定：让新模型分布对齐原 BOOK 评分（均值/标准差），保持等级分布稳定 */
const SCORE_CALIB = (function(){
  var rs=[], olds=[];
  SIM.BOOK.forEach(function(b){ var ctx={ isEV:b.energy==="纯电", isADAS:(b.f.autonomy||0)>0, cv:b.cv };
    var vals=Object.assign({}, b.f, { batteryTemp: simBatteryTemp(b) }); rs.push(rTotalOf(dimIndexAll(vals, ctx))); olds.push(b.score); });
  function mean(a){ return a.reduce(function(s,x){return s+x;},0)/(a.length||1); }
  function std(a){ var m=mean(a); return Math.sqrt(mean(a.map(function(x){return (x-m)*(x-m);}))); }
  var mR=mean(rs), sR=std(rs)||1, mO=mean(olds), sO=std(olds)||1;
  var c1=sO/sR, c0=mO - c1*mR;
  return { c0:c0, c1:c1, neutral: Math.round(c0 + 50*c1), mR:mR };
})();
const NEUTRAL_SCORE = SCORE_CALIB.neutral;   // 全维中位车的从车风险分（基准）
function dimSubScore(R){ return R==null ? null : Math.round(clampN(SCORE_CALIB.c0 + SCORE_CALIB.c1*R, SCORE_MIN, SCORE_MAX)); }

/* 主评分：返回总分 + 维度子分 + 维度指数 + 适用权重 + 单特征贡献(相对中位偏移，求和=总分−基准) */
function computeScore12(vals, ctx){
  var idx=dimIndexAll(vals, ctx);
  var w=appWeights(idx);
  var subs={}, total=0;
  DIMS.forEach(function(d){ if(idx[d.key]==null){ subs[d.key]=null; return; }
    var s=dimSubScore(idx[d.key]); subs[d.key]=s; total+=w[d.key]*s; });
  total=Math.round(clampN(total, SCORE_MIN, SCORE_MAX));
  var contribs={};
  FEATURES12.forEach(function(f){ if(f.locked || idx[f.dim]==null) return;
    var p=pctOf(f.key, vals[f.key]); if(DIM_OF[f.dim].protective) p=100-p;
    var dimW=0; DIM_FEATS[f.dim].forEach(function(g){ if(!g.locked) dimW+=g.w; });
    contribs[f.key]= w[f.dim]*SCORE_CALIB.c1*(f.w/(dimW||1))*(p-50); });
  return { score: total, subs: subs, idx: idx, weights: w, contribs: contribs };
}

const BRAND_COLOR = { "一汽大众":"#1E50A0", "一汽奥迪":"#37424E", "一汽红旗":"#B81C22", "一汽丰田":"#E12A2A", "一汽奔腾":"#C8102E", "一汽大众捷达":"#7A8896" };
function brandColor(b){ return BRAND_COLOR[b] || "#56636f"; }
function brandKey(b){ return ({ "一汽大众":"vw","一汽奥迪":"audi","一汽红旗":"hongqi","一汽丰田":"toyota","一汽奔腾":"bestune","一汽大众捷达":"jetta" })[b] || "vw"; }
const BRANDS = SIM.AGG.brands.map(function(b){ return Object.assign({}, b, { color: brandColor(b.name), key: brandKey(b.name) }); });
(function(){ var pilotTotal = BRANDS.reduce(function(s,b){return s+b.n;},0);
  var hq = { name:"一汽红旗", avatar:"红旗", n: Math.round(pilotTotal*0.075), avgScore:472, key:"hongqi", color:"#B81C22" };
  hq.nevN = Math.round(hq.n*0.82);
  hq.bands = { low:Math.round(hq.n*0.42), mid:Math.round(hq.n*0.33), high:Math.round(hq.n*0.18) };
  hq.bands.crit = hq.n - hq.bands.low - hq.bands.mid - hq.bands.high;
  BRANDS.push(hq);
  var tot = BRANDS.reduce(function(s,b){return s+b.n;},0);
  BRANDS.forEach(function(b){ b.share = b.n/tot; }); })();
const NATIONAL2 = SIM.NATIONAL;

function genDrift(b, i){
  var rng=makeRng(33101 + i*131);
  var base={ mileage:pctOf("mileage",b.f.mileage), night:pctOf("night",b.f.night), entropy:pctOf("destEntropy",b.f.destEntropy), accel:pctOf("hardDecel",b.f.hardDecel) };
  var roll=rng(); var kind="stable";
  if(b.usage==="否" && (base.entropy>60 || base.night>60) && roll<0.5) kind="onset";
  else if(b.usage!=="否" && roll<0.18) kind="exit";
  else if(roll<0.30) kind="driver";
  var W=12, cp=4+Math.floor(rng()*5); var series={ mileage:[], night:[], entropy:[], accel:[] };
  function seriesOf(level, jump){ var arr=[]; var pre=level-jump; for(var w=0; w<W; w++){ var v=(kind==="stable")?level:(w<cp?pre:(w===cp?(pre+level)/2:level)); v+=(rng()-0.5)*7; arr.push(Math.round(clampN(v,2,99))); } return arr; }
  if(kind==="onset"){ series.mileage=seriesOf(base.mileage,34); series.night=seriesOf(base.night,30); series.entropy=seriesOf(base.entropy,30); series.accel=seriesOf(base.accel,18); }
  else if(kind==="exit"){ series.mileage=seriesOf(base.mileage,-30); series.night=seriesOf(base.night,-26); series.entropy=seriesOf(base.entropy,-28); series.accel=seriesOf(base.accel,-14); }
  else if(kind==="driver"){ series.accel=seriesOf(base.accel,30); series.night=seriesOf(base.night,16); series.mileage=seriesOf(base.mileage,8); series.entropy=seriesOf(base.entropy,12); }
  else { ["mileage","night","entropy","accel"].forEach(function(k){ var arr=[]; for(var w=0;w<W;w++) arr.push(Math.round(clampN(base[k]+(rng()-0.5)*9,2,99))); series[k]=arr; }); cp=-1; }
  function mean(a){return a.reduce(function(s,x){return s+x;},0)/a.length;}
  var sig=["mileage","night","entropy","accel"];
  var deltas=sig.map(function(k){ return mean(series[k].slice(8)) - mean(series[k].slice(0,4)); });
  var drift=Math.round(deltas.reduce(function(s,d){return s+Math.abs(d);},0));
  var signed=Math.round(deltas.reduce(function(s,d){return s+d;},0));
  var level = kind==="stable"?0:(drift>=70?2:drift>=40?1:0);
  var moved = sig.filter(function(k,j){ return Math.abs(deltas[j])>=15; });
  var reason = kind==="onset"?"夜间 / 里程 / 路线随机性同步抬升 — 疑似转入网约营运或更换主要驾驶人"
    : kind==="driver"?"急减速强度与风格突变 — 疑似更换主要驾驶人"
    : kind==="exit"?"营运特征同步回落 — 用途回归私家通勤"
    : "12 周行为稳定，无显著漂移";
  return { series:series, cp:cp, kind:kind, drift:drift, signed:signed, level:level, moved:moved, reason:reason, base:base };
}

function buildFleet(){
  return SIM.BOOK.map(function(b, i){
    var isEV = b.energy==="纯电";
    var isADAS = (b.f.autonomy||0) > 0;
    var ctx = { isEV:isEV, isADAS:isADAS, cv:b.cv };
    var vals = Object.assign({}, b.f, { batteryTemp: simBatteryTemp(b) });
    var sc = computeScore12(vals, ctx);
    var score = sc.score; var band = bandOf(score);
    var legacyVals = { km: Math.round(b.f.mileage), fast: Math.round((b.f.fastCharge||0)*100), temp: 0, acc: +(b.f.hardDecel||0).toFixed(1) };
    var rng = makeRng(4001 + i*97);
    var usageKey, usageLabel;
    if(b.usage==="全职"){ usageKey="rh_full"; usageLabel="网约·全职"; }
    else if(b.usage==="兼职"){ usageKey="rh_part"; usageLabel="网约·兼职"; }
    else { var rr=rng(); usageKey = rr<0.6?"priv":rr<0.82?"family":"biz"; usageLabel = usageKey==="priv"?"私家通勤":usageKey==="family"?"家庭多用途":"商务用车"; }
    var dims = {}; DIMS.forEach(function(d){ dims[d.key]=dimRisk(d.key, vals, ctx); });
    var drift = genDrift(b, i);
    var trend=[]; var tr=makeRng(9001+i*53);
    var preScore = score - ((drift.kind==="onset"||drift.kind==="exit")? Math.round(drift.signed*1.1) : 0);
    var cpW = drift.cp<0? -1 : Math.max(0, drift.cp-4);
    for(var w=0; w<8; w++){ var s; if(drift.cp<0||cpW<0) s = score + Math.round((tr()-0.5)*22);
      else if(w<cpW) s = preScore + Math.round((tr()-0.5)*20); else if(w===cpW) s = Math.round((preScore+score)/2); else s = score + Math.round((tr()-0.5)*18);
      trend.push(clampN(s, SCORE_MIN, SCORE_MAX)); }
    trend[7]=score;
    var featTrend={}; var ft=makeRng(7700+i*41);
    FEATURES12.forEach(function(f){ if(f.locked){ featTrend[f.key]=null; return; } var v0=b.f[f.key]; if(v0==null){ featTrend[f.key]=null; return; }
      var arr=[]; for(var w=0; w<8; w++){ var jig=1+(ft()-0.5)*0.16; arr.push(+(v0*jig).toFixed(f.pctv?4:2)); } arr[7]=v0; featTrend[f.key]=arr; });
    var tl=[]; var wkKm=Math.round(legacyVals.km/4.33); var tlR=makeRng(7321+i*53); var exitWeek=-1;
    var st = usageKey==="rh_full"?"rh":usageKey==="rh_part"?"mix":usageKey==="biz"?"biz":"priv";
    if(drift.kind==="onset"){ exitWeek=drift.cp; for(var w=0;w<12;w++) tl.push({ state: w<exitWeek?"priv":w===exitWeek?"mix":"rh", km: Math.max(20, wkKm + Math.round((tlR()-0.5)*wkKm*0.3)) }); }
    else if(drift.kind==="exit"){ exitWeek=drift.cp; for(var w=0;w<12;w++) tl.push({ state: w<exitWeek?"rh":w===exitWeek?"mix":"priv", km: Math.max(20, wkKm + Math.round((tlR()-0.5)*wkKm*0.3)) }); }
    else { for(var w=0;w<12;w++) tl.push({ state:st, km: Math.max(20, wkKm + Math.round((tlR()-0.5)*wkKm*0.28)) }); }
    return {
      id:b.id, plate:b.plate, city:"上海",
      brand:b.brand, brandName:b.brand, brandColor:brandColor(b.brand), oem:brandKey(b.brand), oemName:b.brand, oemColor:brandColor(b.brand),
      series:b.series, model:b.model, modelName:b.model, year:b.year, energy:b.energy, vClass:b.vClass,
      usageRaw:b.usage, usage:usageLabel, usageKey:usageKey, usageLabel:usageLabel, insurer:"鑫安车险",
      f: vals, isEV:isEV, isADAS:isADAS, cv:b.cv,
      score:score, band:band, contribs:sc.contribs, subs:sc.subs,
      vals:legacyVals, routeEntropy:+(b.f.destEntropy||0).toFixed(2),
      dims:dims, drift:drift, trend:trend, featTrend:featTrend, usageTimeline:tl, exitWeek:exitWeek,
      exposure: Math.round(b.f.mileage*12/1000)/10,
      completeness: Math.min(99, Math.round(88 + rng()*11)),
      synced: (function(){ var d=Math.floor(rng()*3); return d===0?"今天":d+"天前"; })(),
      policy: rng()<0.84?"在保":"待续保"
    };
  });
}
const FLEET = buildFleet();

FLEET.forEach(function(v, i){
  var rng = makeRng(55021 + i*89);
  var maxAge = v.oem==="audi" ? 3 : 4;
  var ageYr = 1 + Math.floor(Math.pow(rng(),1.4)*maxAge); v.ageYr = ageYr;
  var fastPct = v.vals.fast;
  var tempProxy = Math.max(0, Math.round(fastPct*0.12 + ageYr*1.6 + (rng()-0.4)*5));
  var sohRaw = 100 - (1.15*ageYr + 0.6) - fastPct*0.03 - tempProxy*0.085 + (rng()-0.5)*0.9;
  var soh = +Math.max(87, Math.min(99.2, sohRaw)).toFixed(1);
  var cellDev = Math.round(Math.max(14, 18 + tempProxy*2.1 + fastPct*0.26 + (rng()-0.5)*10));
  var cycles = Math.round(v.vals.km*12*ageYr/420*(0.92+rng()*0.16));
  var warnLevel = (tempProxy>=18 && cellDev>=68) ? 2 : (tempProxy>=12 || cellDev>=62 || soh<90.5) ? 1 : 0;
  var rangeAchieve = Math.round(Math.max(70, Math.min(94, 84 + (soh-94.5)*1.6 - v.vals.acc*0.6 + (rng()-0.5)*3)));
  v.battery = { soh:soh, cellDev:cellDev, cycles:cycles, warnLevel:warnLevel, rangeAchieve:rangeAchieve, tempProxy:tempProxy, isEV:v.isEV,
    packKwh: (v.vClass.indexOf("紧凑")>=0||v.vClass.indexOf("微型")>=0||v.vClass.indexOf("小型")>=0)?60:78 };
  var share = Math.round((v.f.autonomy||0)*100);
  var hiTier = share>=24 && rng()<0.7;
  v.adas = { tier: hiTier?"hp":"l2", tierLabel: hiTier?"高阶城市领航（司南级 · 城区+高速 NOA）":"L2 基础辅助（ACC + 车道居中）",
    share:share, adasKm: Math.round(v.vals.km*share/100), enabled:v.isADAS,
    takeoverPer1k: hiTier? +(2.1 + v.vals.acc*0.5 + rng()*0.8).toFixed(1) : null,
    aebPer10k: +Math.max(0.2, 0.5 + v.vals.acc*0.4 + (rng()-0.5)*0.5).toFixed(1) };
});

const EVS = FLEET.filter(function(v){return v.isEV;});
const ADASV = FLEET.filter(function(v){return v.isADAS;});
const XINAN_REF = (SIM.AGG.insurers||[]).find(function(o){return o.key==="xinan";}) || { n:7998, nevShare:0.28 };
const XINAN_N = XINAN_REF.n;
const XINAN_EV_N = Math.round(XINAN_N * (XINAN_REF.nevShare||0.28));
const XINAN_ADAS_N = Math.round(XINAN_N * (FLEET.length? ADASV.length/FLEET.length : 0.6));
const BATTERY_SUMMARY = (function(){ var L=EVS.length||1; var scale=XINAN_EV_N/L;
  var l1=EVS.filter(function(v){return v.battery.warnLevel===1;}).length;
  var l2=EVS.filter(function(v){return v.battery.warnLevel===2;}).length;
  return { sohAvg:+(EVS.reduce(function(s,v){return s+v.battery.soh;},0)/L).toFixed(1),
    l1:l1, l2:l2, l1Full:Math.round(l1*scale), l2Full:Math.round(l2*scale),
    devAvg:Math.round(EVS.reduce(function(s,v){return s+v.battery.cellDev;},0)/L),
    rangeAvg:Math.round(EVS.reduce(function(s,v){return s+v.battery.rangeAchieve;},0)/L),
    n:EVS.length, nFull:XINAN_EV_N }; })();
const ADAS_SUMMARY = (function(){ var L=ADASV.length||1; var hp=ADASV.filter(function(v){return v.adas.tier==="hp";}); var scale=XINAN_ADAS_N/L;
  var km=ADASV.reduce(function(s,v){return s+v.adas.adasKm;},0);
  return { hpCount:hp.length, l2Count:ADASV.length-hp.length,
    hpFull:Math.round(hp.length*scale), l2Full:Math.round((ADASV.length-hp.length)*scale),
    shareAvg:Math.round(ADASV.reduce(function(s,v){return s+v.adas.share;},0)/L),
    kmMonth:km, kmMonthFull:Math.round(km*scale),
    takeoverAvg: hp.length?+(hp.reduce(function(s,v){return s+v.adas.takeoverPer1k;},0)/hp.length).toFixed(1):0,
    aebAvg:+(ADASV.reduce(function(s,v){return s+v.adas.aebPer10k;},0)/L).toFixed(1), n:ADASV.length, nFull:XINAN_ADAS_N }; })();

/* portfolio baseline = 50k 试点真实均值（样本经分层过采样，不能用样本均值） */
const PORTFOLIO_MEAN = SIM.AGG.avgScore;
const BOOK_MEAN = Math.round(FLEET.reduce((s,v)=>s+v.score,0)/FLEET.length);

function bandDistribution(list){
  const counts = { crit:0, high:0, mid:0, low:0 };
  list.forEach(v => counts[v.band.key]++);
  return counts;
}
function scoreHistogram(list){
  const buckets = [];
  for(let lo=200; lo<997; lo+=70){ buckets.push({ lo, hi:lo+70, n:0 }); }
  list.forEach(v => { const b = buckets.find(b => v.score>=b.lo && v.score<b.hi) || buckets[buckets.length-1]; b.n++; });
  return buckets;
}
const PORTFOLIO_TREND = (function(){
  const w = [];
  for(let i=0;i<8;i++){
    const avg = FLEET.reduce((s,v)=>s+v.trend[i],0)/FLEET.length;
    w.push(Math.round(avg));
  }
  return w;
})();

/* ---------- data ingestion / pipeline ----------
   量级按 50,000 辆（上海深度评分试点）· 日均行驶约 3h 校准：
   GPS 1Hz ≈ 50,000×10800 ≈ 5.4亿/日；IMU 10Hz ≈ 54亿/日；
   BMS 0.2Hz ≈ 1.1亿/日；充电 ≈ 0.45次/车日 ≈ 2.2万条/日 */
const RAW_SIGNALS = [
  { sig:"GPS 轨迹点",   hz:"1 Hz",   field:"lat / lon / odometer", vol:"5.4 亿/日", dim:"intensity",  feats:"月均里程 · 夜间占比 · 目的地随机性" },
  { sig:"IMU 加速度",   hz:"10 Hz",  field:"ax / ay / az (g)",     vol:"54 亿/日", dim:"aggression", feats:"百公里急减速 · 急转弯" },
  { sig:"车速 vs 限速", hz:"1 Hz",   field:"speed / road_limit",   vol:"5.4 亿/日", dim:"aggression", feats:"超速里程占比 · 疲劳驾驶" },
  { sig:"充电会话日志", hz:"事件",  field:"power_kw / soc / dur", vol:"2.2 万/日", dim:"battery",    feats:"月均快充占比" },
  { sig:"BMS 温度采样", hz:"0.2 Hz", field:"cell_temp[] / alarm",  vol:"1.1 亿/日", dim:"battery",    feats:"电池温度异常（已接入）" },
  { sig:"智驾系统日志", hz:"段级",  field:"ad_state / takeover",  vol:"段级全量", dim:"adas",       feats:"智驾里程占比 · 接管率" },
  { sig:"整车状态 CAN", hz:"1 Hz",   field:"speed / gear / volt",  vol:"5.4 亿/日", dim:null,        feats:"辅助校验 · 时序对齐" },
  { sig:"故障码 DTC",   hz:"事件",  field:"dtc_code / ts",       vol:"1.6 万/日", dim:null,        feats:"辅助校验 · 数据质量" }
];
const PIPELINE_STAGES = [
  { key:"ingest",  name:"数据接入",   sub:"OEM 直连 · 实时流",   metric:"66 亿",  unit:"信号/日",  loss:0 },
  { key:"clean",   name:"清洗与对齐", sub:"去噪 · 补齐 · 时序对齐", metric:"99.2%", unit:"通过率",   loss:0.8 },
  { key:"feature", name:"特征映射",   sub:"原始信号 → 12 特征 / 5 维度", metric:"12",      unit:"风险特征", loss:0 },
  { key:"quality", name:"质量校验",   sub:"完整度 · 单调性 · 漂移", metric:"98.6%", unit:"达标率",   loss:1.4 },
  { key:"score",   name:"评分就绪",   sub:"从车风险分 200–997",    metric:"50,000",    unit:"车辆已评分", loss:0 }
];

/* ---------- pricing dataset · 12 特征（按 5 维度归组） ---------- */
const PRICING_FACTORS = (function(){
  var iv = { mileage:0.34, night:0.19, speeding:0.27, fatigue:0.21, hardDecel:0.23, hardTurn:0.18, destEntropy:0.16, mileageStd:0.12, timeStd:0.10, fastCharge:0.14, batteryTemp:0.20, autonomy:0.15 };
  var corr = { mileage:0.41, night:0.28, speeding:0.33, fatigue:0.27, hardDecel:0.29, hardTurn:0.22, destEntropy:0.20, mileageStd:0.16, timeStd:0.13, fastCharge:0.18, batteryTemp:0.25, autonomy:-0.17 };
  return FEATURES12.filter(function(f){return !f.locked;}).map(function(f){
    var d=DIM_OF[f.dim]; var dimW=0; DIM_FEATS[f.dim].forEach(function(g){if(!g.locked)dimW+=g.w;});
    return { key:f.key, name:f.name, dim:f.dim, dimName:d.name, dimColor:d.color,
      weight:+(d.w*(f.w/(dimW||1))).toFixed(3),
      dir: f.dir<0?"负向(保护)":"正向", iv:iv[f.key]||0.12, corr:corr[f.key]||0.15, mono:true }; });
})();
const PRICING_DECILES = (function(){
  const sorted = [...FLEET].sort((a,b)=>a.score-b.score);
  const per = Math.ceil(sorted.length/10);
  const rows = [];
  for(let d=0; d<10; d++){
    const grp = sorted.slice(d*per, (d+1)*per);
    if(!grp.length) continue;
    const sLo = grp[0].score, sHi = grp[grp.length-1].score;
    const lossRatio = Math.round((38 + d*d*0.9 + d*4.2) );
    rows.push({ decile:d+1, n:grp.length, sLo, sHi, lossRatio, avgScore:Math.round(grp.reduce((s,v)=>s+v.score,0)/grp.length) });
  }
  /* 每个十分位 = 在保组合的 10% —— 车辆数按鑫安在保 7,998 口径展示；
     ~320 辆代表性样本仅用于估分与赔付率形状，n 保留供内部核对 */
  const perBook = Math.round(XINAN_N / rows.length);
  let accBook = 0;
  rows.forEach(function(r,i){ r.nBook = (i===rows.length-1) ? (XINAN_N - accBook) : perBook; accBook += r.nBook; });
  return rows;
})();
const PRICING_LIFT = +(PRICING_DECILES[PRICING_DECILES.length-1].lossRatio / PRICING_DECILES[0].lossRatio).toFixed(2);
const MODEL_METRICS = [
  { k:"GINI",  v:"0.41",  note:"风险区分度" },
  { k:"AUC",   v:"0.71",  note:"ROC 曲线下面积" },
  { k:"KS",    v:"0.32",  note:"最大区分点" },
  { k:"PSI",   v:"0.06",  note:"近 8 周稳定" }
];

/* ---------- Shanghai geography（与 sh_basemap.jsx 同一坐标系）---------- */
const SH_CENTER = { x:46, y:45 };  // 人民广场
const SH_RINGS = [
  { name:"内环", cx:46.5, cy:43.5, rx:12.6, ry:10.8 },
  { name:"中环", cx:47.0, cy:42.5, rx:18.6, ry:17.6 },
  { name:"外环", cx:48.0, cy:41.5, rx:27.0, ry:26.2 }
];
/* 黄浦江中线 北→南（单值 y，供过江判断） */
const SH_RIVER = [
  { x:59, y:7 }, { x:57, y:17 }, { x:57, y:26 }, { x:59, y:33 }, { x:58, y:39 },
  { x:54, y:43 }, { x:52.5, y:47 }, { x:53, y:53 }, { x:52, y:60 }, { x:49, y:68 },
  { x:46, y:77 }, { x:43, y:90 }
];
const KM_PER_UNIT = 0.5;   // 100 单位 ≈ 50km，内环半径≈6.3km、外环≈13.5km，贴近真实
const SH_POIS = [
  { name:"人民广场", x:46, y:45, kind:"anchor" },
  { name:"陆家嘴",   x:56, y:43, kind:"work" },
  { name:"徐家汇",   x:39, y:53, kind:"work" },
  { name:"静安寺",   x:41, y:44, kind:"work" },
  { name:"张江",     x:70, y:52, kind:"work" },
  { name:"虹桥商务区", x:22, y:47, kind:"work" },
  { name:"五角场",   x:52, y:27, kind:"work" },
  { name:"中山公园", x:35, y:45, kind:"work" },
  { name:"外滩",     x:51, y:42, kind:"leisure" },
  { name:"新天地",   x:45, y:49, kind:"leisure" },
  { name:"世纪公园", x:62, y:51, kind:"leisure" },
  { name:"田子坊",   x:44, y:52, kind:"leisure" },
  { name:"迪士尼",   x:76, y:62, kind:"leisure" },
  { name:"大宁公园", x:44, y:32, kind:"leisure" },
  { name:"虹桥枢纽", x:17, y:46, kind:"transit" },
  { name:"浦东机场", x:88, y:58, kind:"transit" },
  { name:"上海站",   x:45, y:33, kind:"transit" },
  { name:"上海南站", x:39, y:59, kind:"transit" },
  { name:"莘庄",     x:33, y:66, kind:"resid" },
  { name:"嘉定",     x:26, y:20, kind:"resid" },
  { name:"临港",     x:86, y:82, kind:"resid" },
  { name:"三林",     x:54, y:62, kind:"resid" },
  { name:"花木",     x:63, y:55, kind:"resid" },
  { name:"周浦",     x:66, y:72, kind:"resid" },
  { name:"顾村",     x:43, y:20, kind:"resid" },
  { name:"金桥",     x:64, y:36, kind:"resid" }
];
function riverXAt(y){
  const r = SH_RIVER;
  if(y <= r[0].y) return r[0].x;
  if(y >= r[r.length-1].y) return r[r.length-1].x;
  for(let i=1;i<r.length;i++){ if(y <= r[i].y){ const t=(y-r[i-1].y)/(r[i].y-r[i-1].y); return r[i-1].x + (r[i].x-r[i-1].x)*t; } }
  return r[r.length-1].x;
}

/* ---------- trips simulation (per vehicle, deterministic) ----------
   opts.mode === "past" 时，对「网约·已转私用」车辆重放 8 周前的网约轨迹 */
function tripsFor(v, opts){
  const past = !!(opts && opts.mode === "past");
  const rng = makeRng(parseInt(v.id.slice(1)) * 17 + (past ? 919 : 101));
  const C = SH_CENTER;
  const pick = (arr)=>arr[Math.floor(rng()*arr.length)];
  const rr = (p)=>Math.hypot(p.x-C.x, p.y-C.y);
  const side = (p)=> p.x < riverXAt(p.y) ? "puxi" : "pudong";
  const pathKm = (pts)=>{ let d=0; for(let i=1;i<pts.length;i++) d+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y); return d*KM_PER_UNIT; };
  function leg(from,to){
    if(Math.hypot(from.x-to.x,from.y-to.y) < 10){
      const mid={x:(from.x+to.x)/2+(rng()-0.5)*3.5, y:(from.y+to.y)/2+(rng()-0.5)*3.5};
      return [{x:from.x,y:from.y}, mid, {x:to.x,y:to.y}];
    }
    const far=Math.max(rr(from),rr(to));
    const ri = far<13?0: far<20?1: 2;
    const rg=SH_RINGS[ri], J=()=>(rng()-0.5)*1.2;
    const ang=(p)=>Math.atan2((p.y-rg.cy)/rg.ry,(p.x-rg.cx)/rg.rx);
    const onR=(a)=>({x:rg.cx+Math.cos(a)*rg.rx+J(), y:rg.cy+Math.sin(a)*rg.ry+J()});
    let a0=ang(from), a1=ang(to), d=a1-a0; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    const pts=[{x:from.x,y:from.y}, onR(a0)];
    const steps=Math.max(1,Math.round(Math.abs(d)/0.5));
    for(let i=1;i<=steps;i++) pts.push(onR(a0+d*(i/steps)));
    pts.push({x:to.x,y:to.y});
    return pts;
  }
  function route(from,to){
    if(side(from)!==side(to)){
      const my=(from.y+to.y)/2;
      const cross={ x:riverXAt(my), y:my };  // 过江：隧道/大桥
      return leg(from,cross).concat(leg(cross,to).slice(1));
    }
    return leg(from,to);
  }
  function trip(from,to,label,kind){
    const path=route(from,to);
    const dist=+pathKm(path).toFixed(1);
    const crossed=side(from)!==side(to);
    const far=Math.max(rr(from),rr(to));
    const highway = kind==="transit" || far>30;
    const avg = highway?(44+rng()*18):(kind==="commute"?20+rng()*8:26+rng()*10);
    const dur=Math.round(dist/avg*60+4);
    const maxSpeed=Math.round(highway?92+rng()*30:58+rng()*36);
    const accBase = past ? 23 : v.vals.acc;
    const hardAcc=Math.max(0,Math.round(accBase/100*dist*(0.5+rng())));
    const kwh=+(dist*0.16).toFixed(1);
    return { when:label, from:from.name, to:to.name, kind, path, dist, dur, maxSpeed, hardAcc, kwh, crossed };
  }
  const resid=SH_POIS.filter(p=>p.kind==="resid");
  const works=SH_POIS.filter(p=>p.kind==="work");
  const leis=SH_POIS.filter(p=>p.kind==="leisure");
  const trans=SH_POIS.filter(p=>p.kind==="transit");
  const homeBase=pick(resid);
  const home={ x:homeBase.x, y:homeBase.y, name:"家", area:homeBase.name };
  const work=pick(works);
  const D=["周一","周二","周三","周四","周五","周六","周日"];
  const trips=[];
  const uk = past ? "rh_full" : (v.usageKey || "priv");
  let periodLabel = "一周 · 节选";

  if(uk==="rh_full"){
    /* 全职网约：单日全天载客，以短途单为主 — 日里程≈月均/26 营运日，口径自洽 */
    periodLabel = past ? "8 周前 · 单日载客回放" : "周二 · 单日全天载客";
    const all=[...works,...leis,...trans];
    const pickNear=(cur)=>{
      const near = all.filter(d=>d.name!==cur.name && Math.hypot(d.x-cur.x,d.y-cur.y) < 17);
      const pool = near.length>=2 ? near : all.filter(d=>d.name!==cur.name);
      return pool[Math.floor(rng()*pool.length)];
    };
    let cur=home;
    const times=["06:50","08:10","09:35","11:00","12:40","14:20","16:05","17:50","19:40","21:30"];
    const n = 9;
    for(let i=0;i<n;i++){
      const dest=pickNear(cur);
      trips.push(trip(cur,dest, times[i]+" 载客", "operate"));
      cur=dest;
    }
    trips.push(trip(cur,home,"23:05 收车回家","operate"));
  } else if(uk==="rh_part"){
    /* 兼职网约：白天通勤 + 晚间载客 + 周末散单 */
    periodLabel = "一周 · 通勤+晚间载客";
    for(let d=0; d<2; d++){ trips.push(trip(home,work,D[d]+" 08:1"+d+" 早高峰通勤","commute")); trips.push(trip(work,home,D[d]+" 18:0"+d+" 晚高峰返程","commute")); }
    const all=[...works,...leis,...trans];
    const pickNear2=(cur)=>{
      const near = all.filter(d=>d.name!==cur.name && Math.hypot(d.x-cur.x,d.y-cur.y) < 17);
      const pool = near.length>=2 ? near : all.filter(d=>d.name!==cur.name);
      return pool[Math.floor(rng()*pool.length)];
    };
    let cur=home;
    const evT=["19:30","20:25","21:40"];
    for(let i=0;i<3;i++){
      const dest=pickNear2(cur);
      trips.push(trip(cur,dest, D[2]+" "+evT[i]+" 晚间载客","operate"));
      cur=dest;
    }
    trips.push(trip(cur,home, D[2]+" 22:50 收车","operate"));
    const m=pick(leis);
    trips.push(trip(home,m, D[5]+" 10:40 周末载客","operate"));
    trips.push(trip(m,home, D[5]+" 12:05 返程","operate"));
  } else if(uk==="biz"){
    for(let d=0; d<2; d++){ trips.push(trip(home,work,D[d]+" 07:5"+d+" 早高峰","commute")); trips.push(trip(work,home,D[d]+" 19:1"+d+" 晚高峰","commute")); }
    const air=pick(trans);
    trips.push(trip(work,air,D[2]+" 13:20 接机","transit"));
    trips.push(trip(air,work,D[2]+" 15:05 返程","transit"));
    const biz=pick(works);
    trips.push(trip(home,biz,D[3]+" 09:10 商务拜访","commute"));
    trips.push(trip(biz,home,D[3]+" 18:30 返回","commute"));
  } else if(uk==="family"){
    const school=pick(leis);
    trips.push(trip(home,school,D[0]+" 07:40 送学/通勤","family"));
    trips.push(trip(school,home,D[0]+" 18:20 接返","family"));
    const mall=pick(leis);
    trips.push(trip(home,mall,D[5]+" 10:30 周末购物","family"));
    trips.push(trip(mall,home,D[5]+" 16:10 返程","family"));
    const out=pick(leis);
    trips.push(trip(home,out,D[6]+" 09:20 郊野休闲","leisure"));
    trips.push(trip(out,home,D[6]+" 17:40 返程","leisure"));
  } else {
    /* 私家通勤 / 网约·已转私用（当前） */
    if(uk==="rh_exit") periodLabel = "本周 · 已回归私家通勤";
    for(let d=0; d<3; d++){ trips.push(trip(home,work,D[d]+" 08:1"+d+" 早高峰","commute")); trips.push(trip(work,home,D[d]+" 19:0"+d+" 晚高峰","commute")); }
    const bar=pick(leis);
    trips.push(trip(home,work,D[3]+" 08:15 早高峰","commute"));
    trips.push(trip(work,bar,D[3]+" 18:50 下班小聚","family"));
    trips.push(trip(bar,home,D[3]+" 21:30 回家","family"));
    const mall=pick(leis);
    trips.push(trip(home,mall,D[5]+" 11:00 周末出行","leisure"));
    trips.push(trip(mall,home,D[5]+" 16:30 返程","leisure"));
  }

  const visitedNames=[...new Set(trips.flatMap(t=>[t.from,t.to]))];
  const visitedPois = SH_POIS.filter(p=>visitedNames.includes(p.name));
  const chargers=[{ x:home.x+1.4, y:home.y-1.2, kw:7, fast:false, name:"家充（慢充）", home:true }];
  visitedPois.filter(p=>p.name!=="人民广场").slice(0,4).forEach((p,i)=>{
    const fast=(i%2===0);
    chargers.push({ x:p.x+(rng()-0.5)*2, y:p.y+(rng()-0.5)*2, kw: fast?[60,120,250][Math.floor(rng()*3)]:7, fast, name:p.name+"充电站" });
  });

  /* 口径统一：月均里程/快充占比以评分输入 vals 为准；
     地图轨迹按里程预算缩放 —— 周视图≈周里程，全职网约单日≈月均/26 营运日 */
  const fastPct = past ? 66 : v.vals.fast;
  const monthlyKm = past ? 2550 : v.vals.km;
  const weeklyKm = Math.round(monthlyKm/4.33);
  const dayKm = Math.round(monthlyKm/26);
  const targetKm = (uk==="rh_full") ? dayKm : weeklyKm;
  const rawTotal = trips.reduce((s,t)=>s+t.dist,0);
  const f = (targetKm>0 && rawTotal>0) ? targetKm/rawTotal : 1;
  trips.forEach(t=>{
    t.dist = +(t.dist*f).toFixed(1);
    t.dur = Math.max(5, Math.round(t.dur*f));
    t.kwh = +(t.dist*0.16).toFixed(1);
    t.hardAcc = Math.max(0, Math.round(t.hardAcc*f));
  });
  const shownKm = +trips.reduce((s,t)=>s+t.dist,0).toFixed(0);
  /* 充电会话：60–75kWh 电池，约每 250–300km 充一次 */
  const nSess = Math.max(1, Math.min(9, Math.round(weeklyKm/270)+1));
  const fastChargers=chargers.filter(c=>c.fast);
  const sessions=[];
  let nFast = Math.round(nSess * fastPct/100);
  for(let i=0;i<nSess;i++){
    const isFast = i < nFast && fastChargers.length>0;
    const ch=isFast?pick(fastChargers):chargers[0];
    const kwh=Math.round(30+rng()*28);
    const dur=isFast?Math.round(kwh/Math.min(ch.kw,140)*60+6):Math.round(kwh/7*60);
    const s0=Math.round(12+rng()*22), s1=Math.min(100, s0+Math.round(50+rng()*35));
    sessions.push({ charger:ch.name, kw:ch.kw, fast:isFast, kwh, dur, soc:s0+"% → "+s1+"%", when:D[Math.floor(rng()*6)]+" "+(isFast?"快充":"慢充") });
  }
  return { home, work, chargers, trips, sessions,
           weeklyKm, monthlyKm, shownKm, periodLabel, past,
           fastSessShare: fastPct,
           rings:SH_RINGS, center:C, river:SH_RIVER, pois:visitedPois, kmPerUnit:KM_PER_UNIT*f };
}

/* ============================================================================
   v3 · 全国双层口径
   第一层：全国接入（一汽集团 6 大品牌 · T-Box 联网且车主已授权）1,286,000 辆（128.6万）
   第二层：上海深度评分试点 50,000 辆（深度遥测 · 200–997 评分）—— 鑫安在保 7,998；明细页为 ~320 分层样本
   ============================================================================ */
const NATIONAL = {
  vehicles: 1286000, nev: 119500, bev: 76500, phev: 43000, hev: 211000, ice: 955500,
  provinces: 31, dailySignals: "173 亿", authRate: 76,
  pilotCity: "上海", pilotN: 50000, scored: 50000
};

/* ---------- 省级分布（31 省区市 · 与一汽-大众市场格局一致）----------
   逻辑：吉林为一汽大本营（万人保有高）；山东/河南/河北为大众基本盘；
   nev = 新能源占比（限牌/限购城市与海南显著更高，东北/西北冬季低温显著更低）；
   engage = 车主端月活率（与新能源占比正相关 —— 充电/续航是高频刚需入口） */
const PROVINCES = (function(){
  const raw = [
    ["山东", 11150, .21, 46], ["广东", 10420, .40, 58], ["江苏", 9330, .33, 53],
    ["河南", 8660, .17, 42],  ["河北", 8120, .18, 43],  ["浙江", 7610, .45, 61],
    ["四川", 7180, .24, 48],  ["吉林", 6890, .12, 39],  ["北京", 5910, .55, 66],
    ["上海", 5420, .62, 71],  ["辽宁", 4880, .13, 38],  ["安徽", 4310, .28, 49],
    ["湖北", 4090, .25, 47],  ["湖南", 3870, .22, 45],  ["陕西", 3420, .20, 44],
    ["山西", 2980, .15, 40],  ["天津", 2840, .38, 56],  ["重庆", 2710, .27, 50],
    ["福建", 2590, .34, 54],  ["江西", 2280, .21, 44],  ["黑龙江", 2210, .08, 35],
    ["云南", 2080, .19, 43],  ["广西", 1990, .20, 44],  ["内蒙古", 1880, .10, 36],
    ["贵州", 1620, .18, 42],  ["新疆", 1490, .09, 34],  ["甘肃", 1310, .11, 37],
    ["海南", 920, .50, 63],   ["宁夏", 690, .12, 38],   ["青海", 510, .10, 36],
    ["西藏", 270, .07, 33]
  ];
  const sum = raw.reduce((s,r)=>s+r[1],0);
  // 归一到全国总量，余数计入最大省
  let acc = 0;
  const rows = raw.map(r => {
    const n = Math.round(r[1] / sum * NATIONAL.vehicles);
    acc += n;
    return { name:r[0], n, nev:r[2], engage:r[3] };
  });
  rows[0].n += NATIONAL.vehicles - acc;
  // 上海口径对齐：接入即全量纳入 5 万深度评分试点，与平台「5 万 / 50,000」一致
  const _sh = rows.find(r => r.name === "上海");
  if(_sh){ rows[0].n += _sh.n - NATIONAL.pilotN; _sh.n = NATIONAL.pilotN; }
  return rows;
})();

/* ---------- 平台月度脉搏（2025-06 → 2026-05 · 季节性物理逻辑）----------
   veh    接入车辆（月末累计，Q4 新车型上量、春节交付放缓）
   km     单车月均里程：2026-02 春节(2/17)通勤坍缩 → 显著低谷；10 月长假长途 → 峰值
   hot    高温热风险告警（进站核查级 · 次/千辆月）：7–8 月峰值
   cold   低温充电受限告警（同口径）：12–2 月峰值
   fast   快充占比%：冬季续航缩水 → 补能频次升 → 快充依赖升
   range  续航达成率%：夏季空调小降、冬季大幅下降（电池低温活性+暖风）*/
const PLATFORM_MONTHLY = [
  { m:"2025-06", label:"6月",  veh:587200,  km:1420, hot:18, cold:1,  fast:33, range:86 },
  { m:"2025-07", label:"7月",  veh:639700,  km:1380, hot:26, cold:0,  fast:35, range:82 },
  { m:"2025-08", label:"8月",  veh:685100,  km:1390, hot:24, cold:0,  fast:35, range:83 },
  { m:"2025-09", label:"9月",  veh:732500,  km:1450, hot:13, cold:1,  fast:33, range:89 },
  { m:"2025-10", label:"10月", veh:795000,  km:1530, hot:6,  cold:2,  fast:34, range:92 },
  { m:"2025-11", label:"11月", veh:852600,  km:1430, hot:3,  cold:9,  fast:37, range:84 },
  { m:"2025-12", label:"12月", veh:920200,  km:1360, hot:2,  cold:18, fast:42, range:71 },
  { m:"2026-01", label:"1月",  veh:969600,  km:1310, hot:2,  cold:24, fast:45, range:66 },
  { m:"2026-02", label:"2月",  veh:992800,  km:960,  hot:2,  cold:19, fast:44, range:68 },
  { m:"2026-03", label:"3月",  veh:1077600, km:1410, hot:4,  cold:6,  fast:38, range:81 },
  { m:"2026-04", label:"4月",  veh:1185500, km:1460, hot:7,  cold:2,  fast:35, range:89 },
  { m:"2026-05", label:"5月",  veh:1286000, km:1480, hot:13, cold:1,  fast:34, range:88 }
];

/* ---------- 车主互动 · 证据链与机制（试点 3 个月观察口径）---------- */
const ENGAGE = {
  funnel: [
    { k:"触达",     v:100, d:"周报/电池月报推送送达" },
    { k:"打开",     v:64,  d:"月活打开（行业短信触达 ≈12%）" },
    { k:"参与",     v:31,  d:"任务 / 挑战 / 报告订阅" },
    { k:"行为改善", v:19,  d:"急加速 ↓ 或 快充占比 ↓ 显著" }
  ],
  outcomes: [
    { k:"出险频度",   v:"−9.2%",  d:"改善组 vs 对照组" },
    { k:"续保意向",   v:"+11.8pt", d:"高活跃车主" },
    { k:"授权留存率", v:"96%",    d:"持续数据授权" }
  ],
  freq: [
    { k:"充电与补能",      n:"18 次/月", role:"hi" },
    { k:"行程回顾",        n:"22 次/月", role:"hi" },
    { k:"电池健康报告",    n:"1 次/月",  role:"anchor" },
    { k:"保养 / 售后",     n:"0.4 次/月", role:"oem" },
    { k:"保险（报价/理赔）", n:"2 次/年",  role:"lo" }
  ]
};

/* ---------- 车主运营（C 端经营月报）----------
   口径：全国接入 1,286,000 车主 · App 激活 579,000（45%）
   一致性：月活率与省级 engage 加权均值呔合（≈5月46%）；
   冬季活跃上升 —— 续航焦虑使电池报告/充电规划成为刚需（与 cold 告警同步） */
const OPS = {
  appActivated: 579000,
  mau: 351600, wau: 187200,
  /* 月活 = 当月接入车辆 × 活跃率（冬升夏稳，与 PLATFORM_MONTHLY 同步） */
  mauMonthly: [143400, 159600, 171000, 178800, 208200, 223200, 262800, 282600, 271800, 275400, 310200, 351600],
  revokeWatch: 2470,   // 授权撤回预警：连续 30 天未活跃且关闭推送
  revoked90d: 516,     // 近 90 天实际撤回
  nps: { overall: 52, high: 57, low: 31 },
  /* 同期群周留存：2026-03 新激活车主，有权益任务 vs 无（对照） */
  retention: {
    withPerk: [100, 87, 79, 74, 71, 69, 67, 66, 65],
    without:  [100, 76, 61, 51, 44, 40, 37, 35, 33]
  },
  perks: {
    issuedWan: 14760, redeemedWan: 11340,           // 积分：万分/月
    coupons: [
      { k:"充电券", use:81 }, { k:"保养代金券", use:64 }, { k:"续保立减券", use:38 }
    ],
    costPerCar: 18.6, benefitPerCar: 31.2          // 元/活跃车主·月
  },
  funnel: [
    { k:"月活车主",     v:351600, d:"5月 · 打开 App 且有行为" },
    { k:"保险服务触达", v:130200, d:"保单管家 / 理赔 / 权益页访问" },
    { k:"报价方案点击", v:41040,  d:"续保报价 · 三电延保方案" },
    { k:"当月成交",     v:13860,  d:"续保 9,900 + 延保/三电 3,960" }
  ],
  segments: {
    brand: [ { k:"红旗品牌", v:56 }, { k:"奥迪品牌", v:52 }, { k:"大众品牌", v:47 }, { k:"捷达品牌", v:33 } ],
    lifecycle: [ { k:"1 年内新车", v:58 }, { k:"1–2 年", v:47 }, { k:"2–3 年", v:41 }, { k:"3 年以上", v:36 } ],
    band: [ { k:"低风险", v:49 }, { k:"中等", v:44 }, { k:"中高", v:41 }, { k:"高风险", v:38 } ]
  },
  service: {
    videoSurveyMin: 18,      // 在线视频查勘平均分钟
    smallClaimHrs: 4.2,      // 小额案件（≤5000元）平均赔付小时
    ticket24h: 91,           // 服务工单 24h 解决率 %
    claimNodes: 6            // 理赔进度推送节点数
  }
};

/* ---------- B 端车队分组（车队管理驾驶舱）----------
   按用途把在保运营车辆归入命名车队；私家通勤不计入 B 端车队口径 */
const FLEET_GROUPS = (function(){
  const defs = [
    { id:"rh-full", code:"XA-2024-017", name:"沪行出行 · 全职网约车队", short:"全职网约", color:"#ED1C24", desc:"24h 营运 · 高里程 · 路线随机", match:function(v){return v.usageKey==="rh_full";},
      profile:{ owner:"周建国", role:"车队运营总监", phone:"138 1729 4410", policy:"XA-CI-2024-0417", term:"2024.03 – 2025.02", since:"2024-03", base:"上海 · 浦东" } },
    { id:"rh-part", code:"XA-2024-023", name:"申程联盟 · 兼职网约车队", short:"兼职网约", color:"#FF8200", desc:"通勤为主 + 晚间载客", match:function(v){return v.usageKey==="rh_part";},
      profile:{ owner:"李明远", role:"平台运力经理", phone:"139 0182 6635", policy:"XA-CI-2024-0523", term:"2024.05 – 2025.04", since:"2024-05", base:"上海 · 闵行" } },
    { id:"biz",     code:"XA-2023-041", name:"锦程商务 · 公商务车队",   short:"商务出行", color:"#00778B", desc:"接驳 / 差旅 · 高速占比高", match:function(v){return v.usageKey==="biz";},
      profile:{ owner:"陈立", role:"行政车辆主管", phone:"137 6621 0088", policy:"XA-CI-2023-1141", term:"2023.11 – 2024.10 · 续保中", since:"2021-11", base:"上海 · 静安" } },
    { id:"lease",   code:"XA-2023-052", name:"东方租赁 · 中长租车队",   short:"中长租赁", color:"#2A6FDB", desc:"多驾驶人 · 多用途", match:function(v){return v.usageKey==="family";},
      profile:{ owner:"吴海涛", role:"资产运营经理", phone:"135 8890 4172", policy:"XA-CI-2023-1252", term:"2023.12 – 2024.11", since:"2022-06", base:"上海 · 嘉定" } }
  ];
  return defs.map(function(d){ var vs=FLEET.filter(d.match); return { id:d.id, code:d.code, name:d.name, short:d.short, color:d.color, desc:d.desc, profile:d.profile, vehicles:vs, n:vs.length }; })
    .filter(function(g){ return g.n>=3; });
})();

window.DATA = {
  FACTORS, BASE, SCORE_MIN, SCORE_MAX, RR_DIVISOR,
  FLEET_GROUPS, XINAN_N, XINAN_EV_N, XINAN_ADAS_N,
  computeScore, relativeRisk, zscore, bandOf, BANDS,
  OEMS, PILOT_OEMS, FLEET, PORTFOLIO_MEAN, PORTFOLIO_TREND,
  bandDistribution, scoreHistogram,
  RAW_SIGNALS, PIPELINE_STAGES,
  PRICING_FACTORS, PRICING_DECILES, PRICING_LIFT, MODEL_METRICS,
  USAGE_PROFILES, USAGE_STATES,
  tripsFor, SH_RINGS, SH_CENTER, SH_POIS, SH_RIVER, KM_PER_UNIT,
  BATTERY_SUMMARY, ADAS_SUMMARY,
  NATIONAL, PROVINCES, PLATFORM_MONTHLY, ENGAGE, OPS,
  SIM, DIMS, DIM_OF, FEATURES12, FEAT_OF, DIM_FEATS, pctOf, computeScore12, dimRisk, MODEL,
  dimSubScore, appWeights, dimIndexAll, NEUTRAL_SCORE, SCORE_CALIB, SCORE_NAME:"从车风险分",
  AGG: SIM.AGG, INSURERS: SIM.AGG.insurers, BRANDS, ENERGY: SIM.AGG.energy, NATIONAL2,
  EVS, ADASV, brandColor, fmtN
};
