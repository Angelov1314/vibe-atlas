# Vibe Atlas

**给下一个作品，找对 AI 工具。**

A searchable atlas of AI tools and local models. Find projects by task, filter by license, and compare tools for your next build.

Vibe Atlas 是面向独立开发者和 AI 创作者的工具地图。搜索你想完成的任务，比较候选项目，再沿着仓库、官方资料和部署说明继续动手。

**159 个工具 · 40 个本地模型 · 92 个工具分类 · 199 份项目文档**

[本地启动](#本地启动) · [使用指南](docs/USER_GUIDE.md) · [浏览项目索引](public/docs/PROJECTS.md) · [评分方法](docs/ranking-policy.md)

源码公开、仅限非商用（source-available），采用 [PolyForm Noncommercial 1.0.0](LICENSE)。目录中各项目沿用自身许可证。

## 用它找到下一步

- **从任务出发。** 支持中英文搜索和任务关键词扩展，覆盖 AI 编程、图像、视频、3D、语音等 14 个工具大类；模型目录另按 34 种任务整理。
- **把候选放在一起看。** 按分类和许可筛选，最多同时对比 3 个项目；查看用途、仓库热度和来源，收藏你的候选清单。收藏保存在当前浏览器。
- **沿着来源深入。** 每个条目都有独立 Markdown 文档，保留仓库、官方资料及安装方向。许可、硬件条件和数据缺口有明确说明，方便回到原始资料判断。
- **接上本地工作流。** 可选 Python 伴侣提供 Open WebUI、n8n、Qdrant 三套 Docker 配方。生成计划后，先检查镜像、端口、数据卷、许可和命令，再确认执行。其他项目可导出带官方资料与验证要求的 Codex 部署任务。

例如，搜索“RAG”找到候选，按许可缩小范围，把几个项目加入对比，再打开项目文档继续研究。macOS 可用 Command+K、Windows / Linux 可用 Ctrl+K 聚焦搜索。

“问 Atlas”默认根据目录资料和任务约束检索项目。需要生成式解释时，可通过已配对的伴侣连接电脑上已有的 Ollama 模型；它不会自动下载模型权重或执行回答中的命令。

## 本地启动

推荐 Node.js 24，项目最低要求为 Node.js 22.13.0；使用 pnpm 11.25.0。首次安装依赖需要联网。

```sh
git clone https://github.com/Angelov1314/vibe-atlas.git
cd vibe-atlas
npm install --global pnpm@11.25.0
npm run install:ci
pnpm setup:local
pnpm dev
```

已有指定版本的 pnpm 时可跳过全局安装。`setup:local` 创建本地密钥并应用本地 D1 迁移，保留已有的本地配置。打开终端实际给出的地址，默认是 `http://localhost:5173`。

完整说明见 [START_HERE.md](START_HERE.md)。本地伴侣是单独、可选的安装步骤，见 [本地配对与部署指南](public/downloads/LOCAL_SETUP.md)。浏览器需要经过配对与计划确认才能调用受支持的部署配方。

## 评分与 Arena 的当前状态

Vibe Atlas 将仓库热度、社区评价和生成结果对战分开呈现，各自使用不同证据。

| 部分 | 已提供的流程 | 当前数据与边界 |
| --- | --- | --- |
| 仓库热度 | 按可用信号排序，展示数据覆盖率；GitHub Stars 可独立排序 | 指标保留采集日期；尚无完整星数增长历史，X API 未接入。搜索引擎线索不等于 X 提及数，也不代表全网排名 |
| 社区评价 | 服务端登录校验、每账号每项目更新评价、原子限流、风险权重与申诉；数据写入 D1 | 从零真实评价开始。身份验证不能保证一个人只有一个账号；启发式风控不能保证识别所有协同刷票 |
| Arena | 私有 R2 样本提交、管理员审核、左右盲配及按协议隔离的暂定 Elo | 从零已核验输出开始。样本须由配置好的管理员核验协议、来源与展示权；项目宣传图不能作为对战样本 |

Turnstile 尚待运营者配置。正常的已认证请求受限流等规则约束；需要挑战的操作会在挑战不可用时被拒绝。协同活动检测和使用证明仍是扩展点，未形成完整服务；当前不引入原始 IP 追踪。

本地伴侣仅使用 Python 标准库、绑定回环地址，并校验精确 Origin 与配对令牌。它只运行已审核的配方 ID；部署需单独安装伴侣并明确确认计划。硬件要求来自官方的条件说明或标为未知，不能视为本机实测结果，也不能保证任意分辨率、量化或工作流都适配。

具体规则见 [评分方法](docs/ranking-policy.md) 和 [Arena 指南](docs/ARENA_LOCAL_GUIDE.md)。

## 技术与部署

React 19 · Vinext · TypeScript · Cloudflare Workers · D1 · R2。

公开仓库包含应用源码、199 份项目文档、数据库迁移、测试和本地伴侣；不含用户数据库、真实密钥、已安装依赖或原托管站点身份。`.openai/hosting.json` 仅保留 `DB` / `BUCKET` 绑定名。部署到 Sites 时，创建自己的平台项目，并通过 Sites 环境工具配置生产密钥。

| 配置项 | 何时需要 | 用途 |
| --- | --- | --- |
| `IDENTITY_HMAC_SECRET` | 已认证的社区写操作 | 至少 32 字符的随机服务端密钥，不能暴露给浏览器 |
| `SITE_ORIGIN` | 生产部署 | 精确站点来源，用于同源写操作校验 |
| `TURNSTILE_SECRET_KEY` | 可选挑战验证 | 服务端挑战验证密钥 |
| `TURNSTILE_SITE_KEY` | 可选挑战验证 | 社区评价与 Arena 使用的公开组件密钥 |
| `ADMIN_USER_ID` | 内容审核 | 明确指定的 Sites 已验证用户 subject，不自动将首个用户设为管理员 |

本地开发与托管预览使用不同入口：托管环境通过 `sites-preview start <checkout>` 启动，其中 `<checkout>` 是仓库的绝对路径。`dev` 和 `build` 会自动准备公开 Markdown 下载文件。

绑定分别为 `DB`（D1）和 `BUCKET`（R2）。迁移位于 `drizzle/`，部署后不要改写迁移历史；本地迁移与托管迁移应分别执行。公开源码不会改变既有托管站点的访问设置。

## 开发与验证

```sh
pnpm typecheck
pnpm test:catalog
pnpm test
python3 -m unittest tests/companion_test.py -q
pnpm build
python3 scripts/verify-publication.py
```

现有检查覆盖目录完整性、TypeScript、排名／社区／Arena／检索逻辑及伴侣边界。生产构建和验证范围见 [验证记录](docs/verification.md)；这些检查不代表完成了生产认证、实际 Docker 安装或 GPU 推理验收。

`RELEASE_MANIFEST.json` 记录公开文件的大小和 SHA-256；最后一条命令核对完整受跟踪文件集。准备继续开发时，可从 [开发交接](docs/CODEX_HANDOFF.md) 进入。

## 文档导航

| 想了解什么 | 文档 |
| --- | --- |
| 启动与使用 | [快速开始](START_HERE.md) · [使用指南](docs/USER_GUIDE.md) · [访问排查](docs/ACCESS_TROUBLESHOOTING.md) |
| 项目与数据来源 | [199 个项目索引](public/docs/PROJECTS.md) · [工具来源](docs/catalog-sources.md) · [模型来源](docs/model-sources.md) |
| 评分与对战 | [评分方法](docs/ranking-policy.md) · [Arena 指南](docs/ARENA_LOCAL_GUIDE.md) |
| 连接电脑与本地部署 | [伴侣安装、配对与部署](public/downloads/LOCAL_SETUP.md) |
| 开发与验收 | [开发交接](docs/CODEX_HANDOFF.md) · [验证记录](docs/verification.md) · [公开快照范围](PUBLICATION.md) |
| 界面与设计依据 | [设计规范](DESIGN.md) · [设计迭代与署名](docs/UNSLOP_REVIEW.md) |

## 来源、素材与许可

项目图片引用上游 URL，不在仓库中打包第三方展示位图。远程图片可能受到限流，页面提供加载失败回退；图片的可用性与展示权归其所有者，不能用作 Arena 评测输出。素材来源见 [PROVENANCE.json](public/assets/PROVENANCE.json)。

界面采用白色平面目录、系统字体与克制的层级，完整解释和算法保留在 Markdown。设计迭代参考 unslop 与 Impeccable，依据和署名保留在 [设计说明](docs/UNSLOP_REVIEW.md)。

本项目原创应用代码采用完整的 [PolyForm Noncommercial 1.0.0](LICENSE)：**源码公开、仅限非商用（source-available），不是 OSI 定义的开源许可。** 第三方代码与依赖保留原许可和署名，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。目录条目不会改变所列软件或模型权重的许可证；选型与使用时应分别核对。
