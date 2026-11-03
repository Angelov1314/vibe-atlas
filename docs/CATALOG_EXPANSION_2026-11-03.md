# Vibe Atlas 目录扩充 · 2026-11-03

用户要求检查分类遗漏，并通过 Firecrawl、Tavily 等搜索引擎检索 X，再增加 50–100 个仓库。

## 结果

- 原有 84 个工具均有合法分类；84 个分支均有项目，原先每分支 1 个项目。
- 本轮新增 75 个唯一工具仓库，现为 159 工具、40 模型、199 项目。
- 新增 8 个细分分支，现为 14 大类、92 分支；模型继续按 34 种任务模态分类。
- 23 个新增项目有明确 X 发现线索；52 个为同类补充。没有声称 75 个都来自 X。
- 全部新增项目经过 GitHub 主源核验：canonical URL、描述、维护状态、Stars、默认分支 commit 和许可标识 / 文本。个别复杂许可仍保留待核验标注。
- 保留已有项目的历史采集日期；没有把旧指标当作本轮刷新，也没有从 X 搜索结果构造热度。

## 方法与范围

执行 2 次 Firecrawl 和 8 次 Tavily 发现查询。Firecrawl 提取 1 篇 X 帖文，Tavily 提取 4 篇 X 帖文（2 次批量提取）。X 内容用于发现候选，GitHub 主源用于确认仓库和项目事实。公开目录保留每项 GitHub/X 来源链接和采集日期。私有研究响应、内部 QA 回执和本机路径不随公开仓库发布；Tavily 原始搜索正文也未完整保存，不声称全部结果可重放。

GitHub 主源核验覆盖 81 个候选（含被替换项），并补查 6 个复杂许可接口；PySide 返回 404，继续标为许可待核验。最终入库的 75 项以本文名单和 `data/catalog.json` 为准。

取舍：复用现有目录、分类筛选和 Markdown 生成器，没有增加运行依赖。Flowise 与 Kaboom 因已归档未入选；Theatre.js 因本轮优先维护中的项目而由 AutoAnimate 替换。X 的许可或 Stars 声明均不直接当作最终数据。

## 新增分类

- Canvas 图形与编辑：用对象、路径和图层创建可编辑的 Canvas 图形。
- Gaussian Splat 场景编辑：检查、编辑并优化 3D Gaussian Splat 场景。
- 3D 编辑器与 AI 连接：通过受控工具接口连接 AI 客户端与 3D 编辑器。
- 全栈 Web 框架：用不同前端生态构建带服务端渲染、路由和部署适配的 Web 应用。
- 模型 API 网关与路由：统一接入多个模型提供方并处理请求路由、密钥与用量策略。
- LLM 应用可观测性与评估：追踪、评估并排查 LLM 应用与 Agent 的运行质量、延迟和成本。
- 文档检索与 RAG 应用：连接数据源并构建文档检索、RAG pipeline 与知识助手。
- 代码驱动数据网站：用代码、SQL 和 Markdown 发布交互式数据应用与报告。

## 新增仓库

| 项目 | 分类 | 许可标注 | 发现方式 |
| --- | --- | --- | --- |
| [PlayCanvas](https://github.com/playcanvas/engine) | 沉浸式 Web 与 XR | MIT | 同类补充 |
| [A-Frame](https://github.com/aframevr/aframe) | 沉浸式 Web 与 XR | MIT | 同类补充 |
| [SuperSplat](https://github.com/playcanvas/supersplat) | Gaussian Splat 场景编辑 | MIT | X 线索 |
| [Blender MCP](https://github.com/ahujasid/mcp-for-blender) | 3D 编辑器与 AI 连接 | MIT | X 线索 |
| [openFrameworks](https://github.com/openframeworks/openFrameworks) | 生成艺术与创意编程 | MIT | 同类补充 |
| [Cinder](https://github.com/cinder/Cinder) | 生成艺术与创意编程 | BSD-2-Clause | 同类补充 |
| [Paper.js](https://github.com/paperjs/paper.js) | Canvas 图形与编辑 | MIT | 同类补充 |
| [Fabric.js](https://github.com/fabricjs/fabric.js) | Canvas 图形与编辑 | MIT | 同类补充 |
| [Konva](https://github.com/konvajs/konva) | Canvas 图形与编辑 | MIT | 同类补充 |
| [Anime.js](https://github.com/juliangarnier/anime) | 网页交互与滚动动效 | MIT | X 线索 |
| [AutoAnimate](https://github.com/formkit/auto-animate) | 网页交互与滚动动效 | MIT | 同类补充 |
| [Rive Runtimes](https://github.com/rive-app/rive-runtime) | Lottie 与产品动效 | MIT | X 线索 |
| [Tween.js](https://github.com/tweenjs/tween.js) | 网页交互与滚动动效 | MIT | 同类补充 |
| [Defold](https://github.com/defold/defold) | 通用 2D / 3D 游戏 | Defold License 1.0 | 同类补充 |
| [Cocos Engine](https://github.com/cocos/cocos-engine) | 通用 2D / 3D 游戏 | MIT | 同类补充 |
| [Stride](https://github.com/stride3d/stride) | 通用 2D / 3D 游戏 | MIT | 同类补充 |
| [LittleJS](https://github.com/KilledByAPixel/LittleJS) | 浏览器与 H5 游戏 | MIT | X 线索 |
| [KAPLAY](https://github.com/kaplayjs/kaplay) | 浏览器与 H5 游戏 | MIT | X 线索 |
| [Matter.js](https://github.com/liabru/matter-js) | 物理模拟与碰撞 | MIT | 同类补充 |
| [Bullet Physics](https://github.com/bulletphysics/bullet3) | 物理模拟与碰撞 | Zlib（主体；例外待核验） | 同类补充 |
| [Rizin](https://github.com/rizinorg/rizin) | 命令行逆向工具箱 | LGPL-3.0 | 同类补充 |
| [Cutter](https://github.com/rizinorg/cutter) | 二进制分析与反编译 | GPL-3.0 | 同类补充 |
| [ImHex](https://github.com/WerWolv/ImHex) | 二进制分析与反编译 | GPL-2.0 | 同类补充 |
| [x64dbg](https://github.com/x64dbg/x64dbg) | 动态插桩与运行时观察 | 待核验 | 同类补充 |
| [mitmproxy](https://github.com/mitmproxy/mitmproxy) | 协议分析与网络诊断 | MIT | 同类补充 |
| [Nuxt](https://github.com/nuxt/nuxt) | 全栈 Web 框架 | MIT | X 线索 |
| [SvelteKit](https://github.com/sveltejs/kit) | 全栈 Web 框架 | MIT | X 线索 |
| [React Router](https://github.com/remix-run/react-router) | 全栈 Web 框架 | MIT | X 线索 |
| [Qwik](https://github.com/QwikDev/qwik) | 全栈 Web 框架 | MIT | X 线索 |
| [Fresh](https://github.com/freshframework/fresh) | 全栈 Web 框架 | MIT | 同类补充 |
| [Strapi](https://github.com/strapi/strapi) | 内容管理系统 | MIT（有条件）+ Enterprise | 同类补充 |
| [Directus](https://github.com/directus/directus) | 内容管理系统 | MSCL-1.0-GPL | 同类补充 |
| [TinaCMS](https://github.com/tinacms/tinacms) | 内容管理系统 | Apache-2.0 | 同类补充 |
| [Saleor](https://github.com/saleor/saleor) | 电商与交易 | BSD-3-Clause | 同类补充 |
| [Vendure](https://github.com/vendurehq/vendure) | 电商与交易 | GPL-3.0-or-later / Commercial | 同类补充 |
| [Puck](https://github.com/puckeditor/puck) | 可视化网页编辑器 | MIT | 同类补充 |
| [Craft.js](https://github.com/prevwong/craft.js) | 可视化网页编辑器 | MIT | 同类补充 |
| [Onlook](https://github.com/onlook-dev/onlook) | 可视化网页编辑器 | Apache-2.0 | 同类补充 |
| [React Native](https://github.com/react/react-native) | React Native 应用 | MIT | 同类补充 |
| [NativeScript](https://github.com/NativeScript/NativeScript) | 原生跨平台 UI 运行时 | MIT | 同类补充 |
| [Capacitor](https://github.com/ionic-team/capacitor) | Web 技术移动应用 | MIT | 同类补充 |
| [Dioxus](https://github.com/DioxusLabs/dioxus) | 原生跨平台 UI 运行时 | Apache-2.0 | X 线索 |
| [Qt for Python (PySide)](https://github.com/pyside/pyside-setup) | Python 原生桌面 UI | 待核验 | 同类补充 |
| [Lapce](https://github.com/lapce/lapce) | 协作与高性能编辑器 | Apache-2.0 | 同类补充 |
| [Iced](https://github.com/iced-rs/iced) | 轻量 Rust 桌面应用 | MIT | 同类补充 |
| [Observable Framework](https://github.com/observablehq/framework) | 代码驱动数据网站 | ISC | 同类补充 |
| [Apache ECharts](https://github.com/apache/echarts) | 数据驱动 SVG 可视化 | Apache-2.0 | 同类补充 |
| [Vega-Lite](https://github.com/vega/vega-lite) | 数据驱动 SVG 可视化 | BSD-3-Clause | 同类补充 |
| [marimo](https://github.com/marimo-team/marimo) | 交互式笔记本与科研 | Apache-2.0 | 同类补充 |
| [Evidence](https://github.com/evidence-dev/evidence) | 代码驱动数据网站 | MIT | 同类补充 |
| [Huginn](https://github.com/huginn/huginn) | 业务自动化与连接器 | MIT | X 线索 |
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 持久任务与业务编排 | Apache-2.0 | X 线索 |
| [Automatisch](https://github.com/automatisch/automatisch) | 可扩展自动化平台 | AGPL-3.0 + Enterprise | X 线索 |
| [Sim Studio](https://github.com/simstudioai/sim) | LLM 应用平台 | Apache-2.0 | 同类补充 |
| [Langflow](https://github.com/langflow-ai/langflow) | LLM 应用平台 | MIT | X 线索 |
| [CrewAI](https://github.com/crewAIInc/crewAI) | 多智能体协作 | MIT | X 线索 |
| [Kestra](https://github.com/kestra-io/kestra) | 持久任务与业务编排 | Apache-2.0 | X 线索 |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | Agent 状态与编排 | MIT | X 线索 |
| [CopilotKit](https://github.com/CopilotKit/CopilotKit) | LLM 应用平台 | MIT | X 线索 |
| [Context7](https://github.com/upstash/context7) | IDE 编码助手 | MIT | X 线索 |
| [Serena](https://github.com/oraios/serena) | IDE 编码助手 | GPL-3.0-or-later / MIT | X 线索 |
| [GitHub MCP Server](https://github.com/github/github-mcp-server) | 开发者脚本工作流 | MIT | X 线索 |
| [Deep Agents](https://github.com/langchain-ai/deepagents) | Agent 状态与编排 | MIT | X 线索 |
| [smolagents](https://github.com/huggingface/smolagents) | Agent 状态与编排 | Apache-2.0 | 同类补充 |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | Agent 状态与编排 | MIT | 同类补充 |
| [Haystack](https://github.com/deepset-ai/haystack) | 文档检索与 RAG 应用 | Apache-2.0 | 同类补充 |
| [LlamaIndex](https://github.com/run-llama/llama_index) | 文档检索与 RAG 应用 | MIT | 同类补充 |
| [RAGFlow](https://github.com/infiniflow/ragflow) | 文档检索与 RAG 应用 | Apache-2.0 | 同类补充 |
| [FastGPT](https://github.com/labring/FastGPT) | LLM 应用平台 | Apache-2.0 + 附加条款 | 同类补充 |
| [Coze Studio](https://github.com/coze-dev/coze-studio) | LLM 应用平台 | Apache-2.0 | 同类补充 |
| [Cline](https://github.com/cline/cline) | IDE 编码助手 | Apache-2.0 | 同类补充 |
| [OpenCode](https://github.com/anomalyco/opencode) | 终端结对编程 | MIT | 同类补充 |
| [LiteLLM](https://github.com/BerriAI/litellm) | 模型 API 网关与路由 | MIT + Enterprise | 同类补充 |
| [Langfuse](https://github.com/langfuse/langfuse) | LLM 应用可观测性与评估 | MIT + Enterprise | 同类补充 |
| [Semantic Kernel](https://github.com/microsoft/semantic-kernel) | Agent 状态与编排 | MIT | 同类补充 |

## 边界

收录是信息目录维护，不代表已在本机安装、评测或推荐生产采用这些项目。未建立 X 完整观察窗口；没有新增社区评价或 Arena 样本。GitHub 的 SPDX 标识与根 LICENSE 有时不一致，混合企业版、附加条款和自定义许可单独标注，未确认处保持待核验。

## 可追溯线索示例

- [Meta Alchemist 的游戏开发仓库清单](https://x.com/meta_alchemist/status/2113952206546219207)：用于发现 KAPLAY、LittleJS、SuperSplat 和 Blender MCP。
- [Rive 作者的运行时说明](https://x.com/guidorosso/status/2095173984900063715)：用于发现 Rive Runtime；许可取 GitHub 主源。
- [自动化项目线索](https://x.com/hasantoxr/status/2082435235778797919)：用于发现 Huginn、Trigger.dev、Automatisch、Langflow、CrewAI、Kestra。
