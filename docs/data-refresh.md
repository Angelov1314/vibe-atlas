# 数据维护与可重现验证

此版本把编辑目录、公开热度快照、社区评价和 Arena 结果分别存储。采集器只读取公共数据并写新的来源快照；不会自动修改项目说明、模型许可、用户评价或模型盲评成绩。

## 1. 运行环境与凭据

采集器不依赖额外npm包。建议 Node.js 24.14+；当前验证使用 Node 24.22.1。社区集成测试使用Node内置SQLite、TypeScript strip与`module.registerHooks`，需要Node24。

可选`GITHUB_TOKEN`只能从当前进程环境注入，建议交给密码管理器、CI secrets或任务运行时配置。脚本不会打印token、请求头、完整环境或GitHub原始响应。公共仓库读取不需要写权限，不应为本采集器授予仓库写权限。

如果运行环境已有HTTP_PROXY／HTTPS_PROXY，采集器使用Node官方`setGlobalProxyFromEnv()`遵循继承配置；保留CA验证，不绕过网络策略。旧版支持代理的Node可用`NODE_USE_ENV_PROXY=1`启动。脚本不会清空代理或关闭TLS验证，也不会将代理地址写入快照。

## 2. 采集GitHub公开元数据

在项目目录执行：

```bash
node scripts/collect-metrics.mjs --catalog data/catalog.json --models data/models.json
```

只采集工具目录：

```bash
node scripts/collect-metrics.mjs --catalog data/catalog.json
```

默认写入新的`metrics/snapshots/<ISO时间>.json`；不会覆盖旧快照。可指定输出路径和历史目录：

```bash
node scripts/collect-metrics.mjs --catalog data/catalog.json --history metrics/snapshots --output metrics/manual-2026-11-02.json
```

显式输出路径已存在时，会在发送网络请求前退出，防止重跑浪费API额度。快照写入使用排他创建，保留旧文件。

### 请求与字段

数据来自GitHub官方`GET https://api.github.com/repos/{owner}/{repo}`。同一仓库对应多个目录条目或模型变体时只请求一次；保存该仓库关联的所有itemIds。记录canonical仓库名、URL、精确stars、forks、最后push、创建日期、归档状态、SPDX代码许可证、官方许可证URL、主页、采集时间与API速率限制状态。

GitHub识别到的标准SPDX许可可以补充**代码许可**，不能替代模型权重许可、依赖许可、商用限制或法律审查。`NOASSERTION`保留为null并提示人工查阅LICENSE，不自动归入开源或可商用。

请求逐个执行，遇到429、明确primary/secondary rate limit、剩余额度0或网络失败立即停止。成功结果保留；尚未请求的仓库记录`not_attempted_after_stop`和停止原因，不补旧值冒充新数据，不更换身份/IP绕过限额。下一次合法运行应等官方reset时间或有已授权的token。

未认证GitHub公共请求一般共享较低的IP速率预算；大目录可能无法单次完成。脚本会读取最近历史快照，把上次缺失项目优先安排到下一次运行，防止总是只刷新字母序靠前的仓库。没有历史文件时采用固定顺序。是否自动调度由运营者决定，此项目没有自行创建定时任务。

### 快照结构

```json
{
  "schemaVersion": 1,
  "collectedAt": "2026-11-02T00:00:00Z",
  "completedAt": "2026-11-02T00:00:20Z",
  "requestedRepositories": 84,
  "repositories": {
    "owner/repo": {
      "ok": true,
      "source": "https://api.github.com/repos/owner/repo",
      "observedAt": "2026-11-02T00:00:01Z",
      "stars": 1234,
      "licenseSpdx": "MIT",
      "pushedAt": "2026-10-30T00:00:00Z",
      "growth": {"starsGained30d": null, "reason": "no_real_30_to_31_day_baseline"}
    }
  },
  "stoppedReason": null,
  "x": null
}
```

这里的示例数字只说明文件格式；不能复制成项目实际数据。

## 3. 增长只能来自真实历史

`starsGained30d`只有在当前成功快照与历史成功快照之间**实际间隔至少30天、最多31天**时才计算。额外1天容忍每日采集时间的小幅变化，输出必须保留`windowDays`，这不是精确到同一秒的自然月统计。只有不足30天的记录、历史间隔太长、仓库无法对应或数据缺失时保持null。

同时保留`netStarChange`原始净变化；若stars下降，净变化可以为负，给增长热度分使用的`starsGained30d`下限为0。不会把项目累计stars除以年龄当作月增长，也不会推算一个不存在的历史基线。

`contributors90d`目前没有采集器，保持null。日后必须基于实际90日窗口核验，不能以总贡献者人数替代。

## 4. X导入与完整性声明

目前没有自动调用X付费搜索接口，也没有用网页搜索命中数替代社媒热度。可以导入用户已获得、允许使用的官方X API导出JSON，附带明确的查询清单。

示例命令：

```bash
node scripts/collect-metrics.mjs --catalog data/catalog.json --offline --x-import imports/threejs-posts.json --x-manifest imports/threejs-manifest.json
```

`--offline`跳过GitHub网络采集，只验证并汇总导入；被跳过的GitHub项明确为missing。

导出文件支持：

- 一个官方响应：`{"data":[...],"meta":{...}}`。
- 按请求顺序拼接的分页响应：`{"pages":[{"data":[...],"meta":{...}}, ...]}`。
- 用户明确提供的帖子数组；仍必须有相应manifest。

每条帖子需要`id`、`author_id`、`text`、`created_at`；请求官方API时还应获取`referenced_tweets`和`entities`，以便识别转推与展开链接。避免以屏幕名代替稳定作者ID。

manifest示例：

```json
{
  "provider": "x-official-api-export",
  "repository": "mrdoob/three.js",
  "query": "url:github.com/mrdoob/three.js -is:retweet",
  "startTime": "2026-10-01T00:00:00Z",
  "endTime": "2026-11-01T00:00:00Z",
  "nextTokenExhausted": true,
  "queryCoverageComplete": true
}
```

**这些布尔值是操作者声明，不是脚本凭空证明的全网完整性。** 只有真正确认所有分页已获取、请求字段与查询范围完整后才可置true。脚本还检查末页不能继续含`next_token`，时间窗须覆盖至少30天，窗口终点不能在未来，必要帖子字段不可缺失。缺少任何条件时`xWindowComplete=false`且`xUniqueAuthors30d=null`，只保留诊断计数。

指标实际衡量的是：**在声明的查询结果及最后30天窗口中，对精确仓库URL发表原创且不同文案内容的独立作者数量。** 数据处理包括：

1. 按post ID去重。
2. 排除retweeted引用与明显RT形式转推。
3. 严格截取 `[endTime−30天, endTime)`。
4. 只保留正文或expanded/unwound URL能归属到该精确仓库的帖子。
5. 对文本进行NFKC、大小写、URL和空白/标点归一化，过滤完全重复文案。
6. 对剩余作者ID去重，每个作者对这个窗口贡献最多一次。

这是保守、可复现的“链接原创作者”指标，会漏掉没有贴仓库URL的讨论，也可能对复制文案去重产生误删。它既不是X全网声量，也不是人类用户证明。脚本不依据蓝标、粉丝数或未经验证的特征制造bot probability；`botDetection`明确是`not_performed`。需要反bot审查时，应另外接入有证据的风险信号并记录来源与误报申诉，不修改原始导出。

快照只保存聚合计数与剔除原因，不保存作者ID或帖子全文。原始导出应留在访问受控的imports目录，不能直接放进public或提交带有隐私数据的原始文件。

## 5. 应用更新与审核

采集脚本**不会自动修改data/catalog.json**。维护者检查成功记录、来源日期、仓库转移、许可证差异与明显异常后，再应用到编辑数据。失败记录不能覆盖已核验的旧值；旧值仍须保留其原始日期，而非伪装成今天更新。

建议为数据更新建立单独的reviewable提交：列出变更仓库、stars变化、许可变更、归档状态、来源与时间。许可重大变化可能需要将安装建议暂时标为需审核。只有真正确认的新值才改变公开目录。

在存储快照时注意源码大小和运行时用途：公共聚合快照可以版本化；原始X语料、平台身份、投票明细与密钥不能放入public静态目录或普通Git历史。

## 6. 社区与Arena验证

在项目根目录执行：

```bash
node --experimental-strip-types tests/ranking.test.mjs
```

测试直接引用`lib/ranking.ts`和`lib/community.ts`生产实现；测试专用resolve hook只补Node对无扩展名TypeScript import的解析，没有复制或替换生产模块。`tests/schema.sql`用于真实SQLite内存数据库，正式部署仍由Drizzle迁移生成。

当前19项测试通过，包括唯一票、HMAC身份、原子限速、挑战缺配置失败关闭、Origin、虚假客户端权重、隔离与申诉、真实可比样本、审核撤销、禁止上传者自评、流式8KiB限额，以及采集去重、实际30日基线、429停止和X完整性规则。

更改正式schema时应同步检查`tests/schema.sql`并运行测试；不要只改测试副本。生成迁移后还应由主构建流程执行类型检查、打包与部署验证。

## 7. 官方参考

- GitHub REST仓库接口：https://docs.github.com/en/rest/repos/repos#get-a-repository
- GitHub REST速率限制：https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- X官方分页文档：https://docs.x.com/xdks/python/pagination
- X官方全文档索引：https://docs.x.com/llms.txt
- Node官方代理与企业网络：https://nodejs.org/learn/http/enterprise-network-configuration
- Node HTTP代理配置接口：https://nodejs.org/api/http.html#httpsetglobalproxyfromenvproxyenv

文档说明接口和边界；本项目的指标权重、30–31日容忍窗、文本去重与异常门槛是可审计的产品实现选择，不是官方对排名质量的认证。
