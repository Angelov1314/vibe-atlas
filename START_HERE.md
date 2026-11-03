# 从这里开始

这是 Vibe Atlas 的 **2026-11-03 UI 交付版完整源码**。界面已整理为简洁目录，说明均保存在 Markdown。将整个解压目录交给 Codex 即可继续开发。

## 先读

1. `docs/CODEX_HANDOFF.md`：启动、代码结构、身份边界、待配置项与继续开发任务。
2. `DESIGN.md`：当前字体、颜色、间距、组件和手机规则。
3. `docs/verification.md`：完成了哪些检查，哪些情况尚未实测。

## 本地启动

推荐 Node.js 24。需要联网安装锁文件中的依赖；ZIP 不包含依赖、真实密钥或数据库。

```text
npm install --global pnpm@11.25.0
npm run install:ci
pnpm setup:local
pnpm dev
```

已安装指定 pnpm 时可跳过第一条。打开终端实际给出的地址，默认 `http://localhost:5173`。Windows 使用 PowerShell，macOS / Linux 使用终端。不要用双击 `index.html` 或普通 `next start` 启动此 Worker 应用。

## 交给 Codex

```text
请接手这个 Vibe Atlas 项目。先阅读 START_HERE.md、
docs/CODEX_HANDOFF.md、DESIGN.md 和 docs/verification.md。
安装并启动本地版本，确认目录、详情、检索助手、Arena 与本地工作台可用。
保留当前的极简 UI；必要说明写入 Markdown。
在当前代码基础上完成我接下来提出的改动，保持真实数据、服务端投票校验、
模型许可区分和本地部署的计划确认。不要插入假评分或伪造生成效果。
```

## 文件与资料

- 完整应用、服务端 API、数据库迁移、测试、锁文件与启动脚本均在本目录。
- 项目说明：`public/docs/projects/`，共 199 份；索引：`public/docs/PROJECTS.md`。
- 数据与算法：`data/`、`lib/ranking.ts`、`docs/ranking-policy.md`。
- 本地配对程序：`public/downloads/atlas_companion.py`。
- 站点打不开时：`docs/ACCESS_TROUBLESHOOTING.md`。

站点的私有访问设置不会影响这套独立本地开发入口。仍需配置的 Turnstile、审核管理员、X 数据源与真实 Arena 样本已在交接文档中逐项记录。
