/* ============================================================================
   上海矢量底图 SHBase — stylised-but-faithful Shanghai basemap (viewBox 0 0 100 94)
   Geography: 黄浦江 (陆家嘴湾), 苏州河, 长江口/东海岸线, 内/中/外环 (真实形态),
   高架与射线高速, 公园绿地, 两机场, 区名. Theme-aware via CSS vars.
   Exposes: window.SHBase (svg <g>), window.SH_GEO (nav data used by data.js)
   ============================================================================ */

/* ---- navigational geometry (kept single-valued in y for crossing logic) ---- */
const SH_GEO = {
  /* 黄浦江中线 北→南 (for 浦西/浦东 side tests) */
  riverNav: [
    { x:59, y:7 }, { x:57, y:17 }, { x:57, y:26 }, { x:59, y:33 }, { x:58, y:39 },
    { x:54, y:43 }, { x:52.5, y:47 }, { x:53, y:53 }, { x:52, y:60 }, { x:49, y:68 },
    { x:46, y:77 }, { x:43, y:90 }
  ],
  /* ring approximations for routing (cx/cy per ring) */
  rings: [
    { name:"内环", cx:46.5, cy:43.5, rx:12.6, ry:10.8 },
    { name:"中环", cx:47.0, cy:42.5, rx:18.6, ry:17.6 },
    { name:"外环", cx:48.0, cy:41.5, rx:27.0, ry:26.2 }
  ]
};

/* ---- drawable geometry ---- */
const SHG = (() => {
  const river = [ // 黄浦江 南→北, 带陆家嘴急弯
    [42,94],[44,86],[46,79],[49,71],[52,64],[53.5,58],[53.5,53],[52.6,49],
    [52.2,46],[52.6,43.6],[54.5,42.2],[57,41.4],[59,40.2],[60,37.6],[60,34],
    [58.6,30],[57.6,26],[57.2,21],[57.6,15],[59,9],[60.2,5]
  ];
  const suzhou = [ // 苏州河 西→东, 汇入外白渡桥
    [14,38.5],[20,40.4],[25,38.8],[30,40.8],[35,39.6],[39,41.2],[43,40.6],[47,41.8],[51.6,42.4]
  ];
  const innerRing = [
    [40,33.5],[46,32.5],[51,33.5],[55,35.8],[57.6,37.6],[59,40.6],[59.6,44],[58.6,47.6],
    [56,50.6],[52.8,51.6],[49,53.6],[44.5,54],[39.5,52.6],[35.8,49.6],[34,45.6],[34.2,41],[36.6,36.8]
  ];
  const midRing = [
    [38,25.5],[45,24],[51,25],[56,27.5],[60,31],[63.6,35],[65.6,39.6],[66,44.6],[65,49.6],
    [62.6,54],[58,57.6],[52,59.6],[46,60],[40,58.6],[34.6,55.6],[30.6,51],[28.8,45.6],
    [29.2,39],[31.6,33],[34.6,28.5]
  ];
  const outerRing = [
    [44,15],[52,15.5],[59,18],[65,22],[70,27],[73.6,33],[75,40],[74.6,47],[72,54],
    [67.6,60],[61,64.6],[53,67],[45,67.6],[37,65.6],[30,61.6],[24.6,55.6],[21.6,48.6],
    [21,41],[23,33.5],[27,26.5],[33,20],[38.6,16.5]
  ];
  const expressways = [
    { name:"延安高架", pts:[[10,47.6],[17,46.6],[24,46],[31,45.6],[38,45],[44,44.3],[49,43.6],[51.6,42.9]] },
    { name:"南北高架", pts:[[44,14],[44,22],[44.2,30],[44.6,37],[45,44],[45.6,50],[46.6,57],[47.6,64],[48,70]] },
    { name:"沪闵高架", pts:[[44.6,49],[41,53],[37.6,58],[34.6,62.6],[31,68],[27,74]] },
    { name:"迎宾高速", pts:[[54,45.6],[60,48],[66,50.6],[72,53],[79,55.6],[87,57.8]] },
    { name:"京沪高速", pts:[[40,33.5],[36,29],[32,25],[28.6,21.6],[24,17]] },
    { name:"S2沪芦",   pts:[[53,59.6],[58,64],[64,69],[71,74.6],[80,80],[88,83.6]] },
    { name:"逸仙高架", pts:[[51,33.5],[53,27],[54.6,21],[55,15]] }
  ];
  const parks = [
    { name:"世纪公园", x:62.5, y:51.5, rx:2.3, ry:1.7 },
    { name:"共青森林", x:57,   y:24,   rx:1.9, ry:2.5 },
    { name:"顾村公园", x:41,   y:19,   rx:2.3, ry:1.8 },
    { name:"滨江森林", x:60.5, y:8,    rx:2.2, ry:1.6 },
    { name:"大宁公园", x:44,   y:31.5, rx:1.5, ry:1.1 },
    { name:"中山公园", x:35,   y:45,   rx:1.2, ry:1.0 }
  ];
  const districts = [
    { t:"嘉定",   x:27, y:21 }, { t:"宝山", x:48, y:17 }, { t:"杨浦", x:53.5, y:30 },
    { t:"浦东新区", x:70, y:40 }, { t:"闵行", x:31, y:65 }, { t:"徐汇", x:40.5, y:57.5 },
    { t:"普陀", x:34, y:38 }, { t:"奉贤", x:55, y:84 }, { t:"青浦", x:14, y:55 }
  ];
  const bridges = [
    { name:"杨浦大桥", x:57.6, y:37.6 }, { name:"南浦大桥", x:52.8, y:51.4 },
    { name:"延安东路隧道", x:52.2, y:43.0, tunnel:true }
  ];
  const coast = "M97,12 L100,12 L100,94 L84,94 L86.5,86 L90,76 L93,64 L94.6,52 L95.8,38 L96.6,24 Z";
  const yangtze = "M55,0 L100,0 L100,9 L84,7.4 L72,5.6 L63,3.8 L58,2.2 Z";
  return { river, suzhou, innerRing, midRing, outerRing, expressways, parks, districts, bridges, coast, yangtze };
})();

function shPath(pts, close){
  let d = pts.map((p,i)=>(i?"L":"M")+p[0]+","+p[1]).join(" ");
  return close ? d+" Z" : d;
}
function shSmooth(pts, close){
  if(pts.length<3) return shPath(pts, close);
  let d = "M"+pts[0][0]+","+pts[0][1];
  const n = pts.length;
  const lim = close? n+1 : n-1;
  const at = (i)=>pts[((i%n)+n)%n];
  for(let i=1;i<lim;i++){
    const p=at(i), q=at(i+1);
    d += ` Q ${p[0]},${p[1]} ${(p[0]+q[0])/2},${(p[1]+q[1])/2}`;
  }
  if(!close){ const l=pts[n-1]; d += ` L ${l[0]},${l[1]}`; } else d += " Z";
  return d;
}

/* double-stroke road */
function SHRoad({ d, w=1.5, core="var(--surface)", casing, dash, op=1 }){
  return (
    <g opacity={op}>
      <path d={d} fill="none" stroke={casing||"color-mix(in srgb, var(--ink-3) 42%, transparent)"} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={core} strokeWidth={Math.max(0.3, w-0.55)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
    </g>
  );
}

function SHBase({ showLabels=true, dim=false }){
  const G = SHG;
  const WATER = "color-mix(in srgb, #3E78C8 30%, var(--surface-2))";
  const WATER_LINE = "color-mix(in srgb, #3E78C8 55%, var(--surface-2))";
  const PARK = "color-mix(in srgb, #00AF66 16%, var(--surface-2))";
  const URBAN = "color-mix(in srgb, var(--ink-3) 7%, transparent)";
  const riverD = shSmooth(G.river);
  return (
    <g style={dim?{opacity:.55}:null}>
      {/* land */}
      <rect x="0" y="0" width="100" height="94" fill="var(--surface-2)" />
      {/* urban fabric: faint street grid within 中环 */}
      <defs>
        <pattern id="sh-grid" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
          <path d="M0 0H2.6M0 0V2.6" stroke="var(--ink-3)" strokeWidth="0.16" opacity="0.5" />
        </pattern>
        <radialGradient id="sh-fade" cx="0.47" cy="0.46" r="0.62">
          <stop offset="0.45" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="sh-fade-m"><rect x="0" y="0" width="100" height="94" fill="url(#sh-fade)" /></mask>
      </defs>
      <g mask="url(#sh-fade-m)">
        <path d={shSmooth(G.midRing,true)} fill={URBAN} />
        <path d={shSmooth(G.midRing,true)} fill="url(#sh-grid)" opacity="0.55" />
      </g>

      {/* parks */}
      {G.parks.map((p,i)=>(
        <ellipse key={"pk"+i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={PARK} />
      ))}

      {/* 长江口 + 东海岸线 */}
      <path d={G.yangtze} fill={WATER} />
      <path d={G.coast} fill={WATER} />
      <path d="M97,12 C96.6,24 95.8,38 94.6,52 C93,64 90,76 86.5,86 L84,94" fill="none" stroke={WATER_LINE} strokeWidth="0.45" opacity="0.7" />

      {/* ring roads */}
      <SHRoad d={shSmooth(G.outerRing,true)} w={1.45} core="color-mix(in srgb, #E1A300 26%, var(--surface))" />
      <SHRoad d={shSmooth(G.midRing,true)}   w={1.25} core="color-mix(in srgb, #E1A300 20%, var(--surface))" />
      <SHRoad d={shSmooth(G.innerRing,true)} w={1.15} core="color-mix(in srgb, #E1A300 32%, var(--surface))" />

      {/* radial expressways */}
      {G.expressways.map((e,i)=>(
        <SHRoad key={"ex"+i} d={shSmooth(e.pts)} w={1.0} core="var(--surface)" op={0.95} />
      ))}

      {/* 苏州河 */}
      <path d={shSmooth(G.suzhou)} fill="none" stroke={WATER_LINE} strokeWidth="0.85" strokeLinecap="round" opacity="0.9" />

      {/* 黄浦江 */}
      <path d={riverD} fill="none" stroke={WATER} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={riverD} fill="none" stroke={WATER_LINE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* bridges / tunnel */}
      {G.bridges.map((b,i)=>(
        <g key={"br"+i}>
          {b.tunnel
            ? <path d={`M${b.x-1.8},${b.y} L${b.x+1.8},${b.y}`} stroke="var(--ink-3)" strokeWidth="0.5" strokeDasharray="0.7 0.5" opacity="0.85" />
            : <path d={`M${b.x-1.6},${b.y-0.9} L${b.x+1.6},${b.y+0.9}`} stroke="var(--ink-2)" strokeWidth="0.62" opacity="0.9" />}
        </g>
      ))}

      {/* airports */}
      <g opacity="0.9">
        <rect x="13.2" y="44.3" width="4.6" height="0.7" rx="0.3" fill="var(--ink-3)" transform="rotate(-12 15.5 44.6)" />
        <rect x="13.2" y="46.1" width="4.6" height="0.7" rx="0.3" fill="var(--ink-3)" transform="rotate(-12 15.5 46.4)" />
        <rect x="85.6" y="55.4" width="5.2" height="0.7" rx="0.3" fill="var(--ink-3)" transform="rotate(-18 88 55.7)" />
        <rect x="86.4" y="57.6" width="5.2" height="0.7" rx="0.3" fill="var(--ink-3)" transform="rotate(-18 89 57.9)" />
      </g>

      {showLabels && (
        <g>
          {G.districts.map((d,i)=>(
            <text key={"ds"+i} x={d.x} y={d.y} fontSize="2.6" fontWeight="800" fill="var(--ink-3)" opacity="0.34" textAnchor="middle" style={{letterSpacing:".18em"}}>{d.t}</text>
          ))}
          <text x="36" y="78" fontSize="2.0" fill={WATER_LINE} fontWeight="700" opacity="0.95" transform="rotate(64 36 78)">黄浦江</text>
          <text x="22" y="37.2" fontSize="1.7" fill={WATER_LINE} fontWeight="600" opacity="0.85">苏州河</text>
          <text x="80" y="4.4" fontSize="2.1" fill={WATER_LINE} fontWeight="700" opacity="0.8">长江口</text>
          <text x="96.8" y="78" fontSize="2.0" fill={WATER_LINE} fontWeight="700" opacity="0.8" transform="rotate(78 96.8 78)">东海</text>
          {/* ring labels on the road */}
          <text x="46" y="31.6" fontSize="1.75" fill="var(--ink-2)" textAnchor="middle" opacity="0.8" fontWeight="700">内环</text>
          <text x="46" y="23.1" fontSize="1.75" fill="var(--ink-2)" textAnchor="middle" opacity="0.75" fontWeight="700">中环</text>
          <text x="45" y="14.2" fontSize="1.75" fill="var(--ink-2)" textAnchor="middle" opacity="0.7" fontWeight="700">外环 S20</text>
          {/* airports */}
          <text x="15.5" y="49.6" fontSize="1.8" fill="var(--ink-2)" textAnchor="middle" opacity="0.85">✈ 虹桥机场</text>
          <text x="88" y="61.4" fontSize="1.8" fill="var(--ink-2)" textAnchor="middle" opacity="0.85">✈ 浦东机场</text>
          {/* bridges */}
          <text x="60" y="37.2" fontSize="1.55" fill="var(--ink-3)" opacity="0.85">杨浦大桥</text>
          <text x="54.4" y="52.8" fontSize="1.55" fill="var(--ink-3)" opacity="0.85">南浦大桥</text>
        </g>
      )}
    </g>
  );
}

window.SHBase = SHBase;
window.SH_GEO = SH_GEO;
