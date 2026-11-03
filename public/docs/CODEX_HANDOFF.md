# Vibe Atlas · Codex 交接

## 交付范围

这是一套可继续开发的 React / Vinext / TypeScript 应用。服务端运行在 Cloudflare Workers，社区数据使用 D1，Arena 文件使用 R2。目录有 92 个工具分支、159 个工具和 40 个模型；实际内容以 `data/` 为准。

本次交付重点是界面精简与排版。解释性内容放在 Markdown；产品界面保留名称、用途、必要状态、许可入口和操作。请延续当前视觉体系，修改前先读 `DESIGN.md` 和用户最新要求。

## 从 ZIP 启动

推荐使用 **Node.js 24**、**pnpm 11.25.0**。本地配对助手和 Python 测试需要 Python 3.10 或以上。依赖必须按锁文件安装；ZIP 不包含 `node_modules`。

在解压后的项目根目录执行。以下命令适用于 macOS 终端和 Windows PowerShell：

```text
npm install --global pnpm@11.25.0
npm run install:ci
pnpm setup:local
pnpm dev
```

已有正确 pnpm 版本时跳过第一条。开发地址为 `http://localhost:5173`；以终端实际输出为准。需要 5173 端口可用。

`install:ci` 在普通电脑使用固定版本 pnpm；在受管理的 Sites 环境继续使用原有安装流程。不会要求 Windows 安装 bash、flock 或 GNU timeout。

`setup:local` 做两件事：

1. 若不存在 `.dev.vars`，生成本机专用随机身份哈希密钥；已有文件保持不变。
2. 使用 `wrangler.local.jsonc` 和明确的 `--local` 参数应用 D1 迁移。迁移有记录表，重复执行会跳过已完成的迁移。

不要把别人的 `.dev.vars`、数据库或运行目录复制进此项目。若已有 `.dev.vars` 是手动创建的空文件，应先自行补齐有效配置；初始化命令不会覆盖已有密钥。生产 `SITE_ORIGIN` 不应沿用到本地，因为会导致提交来源不匹配。

## 本地身份与生产身份

普通本地开发沿用 starter 的测试登录：点击应用内登录入口后得到一个本地测试身份。该逻辑只在 Vite 开发服务器运行，检查回环地址，并删除客户端伪造的身份头。它不进入生产构建。

生产身份由站点平台验证并注入。不得通过接收浏览器自报 userId、启用生产假身份或自动把首位访客设为管理员来解决登录问题。

`pnpm start` 用于预览已构建的 Worker，不提供开发服务器的测试登录。需要联调登录和写入时使用 `pnpm dev`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 热更新开发服务器 |
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm docs:prepare` | 同步 Markdown 说明并生成 199 个项目文档 |
| `pnpm test:catalog` | 检查目录 ID、图片来源与分类完整性 |
| `pnpm test` | 评分、社区、Arena、采集器和检索约束测试 |
| `pnpm db:generate` | 按 `db/schema.ts` 生成新迁移 |
| `pnpm db:migrate:local` | 只应用本地尚未执行的迁移 |
| `pnpm build` | 构建生产 Worker 与客户端 |
| `pnpm start` | 启动本地生产构建预览 |

`dev` 和 `build` 启动前都会执行文档同步；开发中单独修改 Markdown 后，可运行 `pnpm docs:prepare` 更新下载文件。说明来源在 `docs/`、`DESIGN.md` 和目录数据中，`public/docs/` 是生成的可下载副本。

Python 边界测试：

```text
# macOS / Linux
python3 -m unittest tests/companion_test.py -q

# Windows
py -3 -m unittest tests/companion_test.py -q
```

不要改写已发布的迁移历史。若之前用 `d1 execute --file` 手工建过表、却没有迁移记录表，新的迁移命令可能报告表已存在：保留数据库，先检查旧迁移状态；不要删除用户数据来让命令变绿。新的 ZIP 解压目录不包含旧数据库。

## 关键文件

| 位置 | 职责 |
| --- | --- |
| `app/Atlas.tsx`、`app/globals.css` | 应用状态、主目录、收藏与对比 |
| `components/AtlasUI.tsx`、`ProjectDetail.tsx`、`AtlasChat.tsx`、`Documents.tsx` | 公共组件、项目详情、检索助手与文档入口 |
| `components/Arena.tsx`、`components/arena.css` | 盲评、提交与审核界面 |
| `components/LocalStudio.tsx`、`components/local.css` | 配对、本地部署与本地模型问答 |
| `lib/catalog.ts`、`data/` | 目录归一化与来源数据 |
| `lib/retrieval-intent.ts` | 明确任务与许可约束 |
| `lib/ranking.ts` | 热度、社区后验、风险权重、暂定 Elo |
| `lib/community.ts`、`app/api/` | 持久化、限流、投票、样本与媒体权限 |
| `db/schema.ts`、`drizzle/` | 数据模型与迁移 |
| `public/downloads/atlas_companion.py` | 本机 Python 配对助手 |
| `scripts/collect-metrics.mjs` | GitHub 快照及严格的 X 数据导入 |
| `scripts/prepare-docs.mjs` | 生成供界面下载的说明与项目文档 |
| `.openai/hosting.json` | 既有站点身份与 D1 / R2 绑定名称 |

## 当前事实与待配置项

- X 尚未接入完整授权窗口，30 日 GitHub 增长仍需要实际快照积累；不可补造热度。
- 社区分依赖真实评价。未评分保持空白，不能插入演示用户当作真实参与者。
- Arena 只使用通过审核的真实成对输出。首发没有质量榜；`ADMIN_USER_ID` 必须显式配置。
- Turnstile 前后端已接线，但部署密钥仍待配置。要求验证时按失败关闭策略处理。
- 目录助手可直接检索；生成式解释需要配对本机已有的 Ollama 模型。
- 可执行本地配方为 Open WebUI、n8n、Qdrant；其他项目提供官方来源及部署任务。实际 GPU 推理没有在用户电脑上验证。
- 站点目前是用户自己的私有站点。访问问题的已知证据和排查顺序见 `ACCESS_TROUBLESHOOTING.md`。

## 配置边界

参考 `.dev.vars.example`，不要在仓库或聊天中填写生产密钥。生产需要 `IDENTITY_HMAC_SECRET`、精确的 `SITE_ORIGIN`，按需配置 `ADMIN_USER_ID` 和 Turnstile 密钥。D1 绑定名为 `DB`，R2 绑定名为 `BUCKET`。

这个项目依赖 Worker 运行时，不能用普通 `next start` 替代。若迁往其他主机，需要迁移持久化与身份适配层。公开版 `.openai/hosting.json` 只含本地绑定名；部署到 Sites 时关联自己的项目身份，已有部署不要重复创建。`wrangler.local.jsonc` 只用于本地迁移，不能作为生产发布配置。

## 验收重点

先运行已有检查，再验证搜索、筛选、收藏、对比、手机导航和详情页。检索测试应覆盖“图片转 3D + 商业许可”不会返回普通图片生成模型。社区测试应覆盖身份、同源、唯一票、风控与撤销样本后不再计分。

修改本地助手时保持固定回环端点、Origin / Host / token 校验、配方白名单、计划确认和真实健康状态。不得开放任意 shell、远程 Docker context、任意模型提供商 URL，或把模型输出作为可执行命令。

## 验证记录

现有 19 项社区与排名测试、7 项检索测试、22 项 Python 测试记录见 `verification.md`。交付脚本另外验证了：独立临时目录创建新本地密钥、重复保留密钥、全新 D1 迁移成功、第二次迁移无操作。脚本语法通过检查。

跨平台分支已移除对 Linux shell 工具的依赖，但未声称在实体 Windows / macOS 上运行过本轮交付脚本，也未在当前受限网络中重新从公共 registry 完整下载依赖。请在目标电脑保留首次安装输出，按实际错误处理。

## 可直接交给 Codex 的任务

```text
读取 docs/CODEX_HANDOFF.md、DESIGN.md 和最新用户需求。
先运行项目并复现目标问题，再修改。保持目录真实来源、三类评分分离、
服务端身份、投票约束和本地助手执行边界。界面只保留任务所需内容，
解释写入 Markdown。优先复用现有模块与依赖，完成后运行相关检查、
查看桌面和窄屏实际界面，并报告改动、验证和仍需配置的部分。
```
