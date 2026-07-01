# 鑫安 × 一汽 · 从车风险数据合作材料站

鑫安汽车保险（一汽集团子公司）与律商风险（LexisNexis Risk Solutions）从车风险数据合作的全套演示与汇报材料。**纯静态站点**，无需构建、无需后端，可直接部署到 Netlify / GitHub Pages / 任意静态托管。

> 所有数据为模拟示意（演示环境），规划与里程碑为建议方案，落地以双方数据合规评审与商务约定为准。

## 站点结构

| 文件 | 内容 | 用途 |
|---|---|---|
| `index.html` | 材料门户 | 入口页，含建议汇报动线 ①→⑥ |
| `platform.html` | 从车风险数据平台 | 可交互演示（React，浏览器内运行） |
| `product-deck.html` | UBI 产品说明 PPT（5 页） | 全屏演示，← / → 翻页 |
| `strategy-map.html` | 数据战略地图 | 一页总图 + 24 项能力全景 + P0–P3 路线 |
| `strategy-onepager.html` | 数据战略一页汇报图 | 16:9 投屏 / Ctrl+P 打印单页 |
| `ad-risk-training.html` | 智驾风险评价模型训练体系 | 准 L3+ 专题（P3） |
| `data-features.html` | 数据特征需求清单 | 特征出域模板，31 项 / 6 域 |
| `telematics/` | 平台源码（JSX/JS/数据） | `platform.html` 的依赖 |
| `screenshots/ppt/` | 平台界面截图 | `product-deck.html` 第 3 页引用 |

## 部署

**Netlify**：仓库根目录即站点根目录（Publish directory = `/`，无构建命令）。拖拽整个文件夹到 Netlify Drop 也可以。

**GitHub Pages**：仓库 Settings → Pages → 选择分支根目录即可。

## 性能与注意事项

- **React 已用生产版**（`react.production.min.js` / `react-dom.production.min.js`，版本锁定 18.3.1），相比开发版体积更小、运行更快、无告警。
- 已对 `fonts.gstatic.com` 与 `unpkg.com` 预连接（`preconnect`），加快字体与脚本握手。
- **需要联网**：页面从 Google Fonts 加载思源黑体；`platform.html` 从 unpkg 加载 React 与 Babel。内网/离线环境需自行内联资源。
- `platform.html` 仍在浏览器内用 Babel 转译 JSX（首次约 1–3 秒，已有启动屏过渡；刷新后走浏览器缓存显著加快）。如需进一步去除 Babel、追求极致首屏，可做一次「预编译」改造（需配套测试，详见与开发者的沟通记录）。
- 平台的当前页签、主题等状态存在浏览器 `localStorage`，不同访客互不影响。
- 司南智驾等一汽公开信息整理自 2026 年 6 月公开资料，发布前建议与一汽智驾部门核对。

## 内容口径（统一约定）

- 数据分层：全国接入 **128.6 万** → 上海试点 **5 万（50,000）深度评分** → 鑫安在保 **7,998**（其中纯电 ≈28%）→ 深度评分明细样本 ≈320。
- 阶段时间（建议区间，允许交叠）：P0 0–6 个月 · P1 6–24 个月 · P2 12–36 个月 · P3 24–48 个月
- 评分尺度 200–997；示意数字（3.9×、−50% 等）均标注「模拟测算 / 示意目标」
- 数据原则：原始数据不出主机厂域；出域仅限评分指数 / 聚合统计 / 脱敏事件包三种形态
