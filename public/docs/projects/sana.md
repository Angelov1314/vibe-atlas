# SANA

围绕高分辨率与低显存优化的高效图像生成系列。

## 项目信息

- 类型：本地模型
- 分类：文生图
- GitHub：https://github.com/NVlabs/Sana
- 官网：https://github.com/NVlabs/Sana
- 代码许可：Apache-2.0
- 权重许可：Apache-2.0
- 权重分类：permissive-open-weights

## 许可说明

已核对的 Sana_1600M_1024px_BF16 权重和代码采用 Apache-2.0；其他 checkpoint 须单独核对。

## 本地部署

使用隔离 Python 环境，按官方 README 安装与下载指定权重；安装前审阅依赖和许可证。

以上是官方安装方向，不代表已在本机执行或验证。详情页可下载包含完整检查步骤的 Codex 部署任务。

## 硬件条件

官方给出特定 4-bit/卸载配置可用 8GB 的示例；这不是所有 SANA 模型的最低配置，也不是本站实测。

参考显存：8 GB；仍受版本、精度和工作流影响。

## 数据快照

- GitHub Stars：9753
- 采集时间：2026-11-02T08:41:19.783803+00:00
- 最近推送：2026-10-30T07:01:25Z
- X：尚未接入完整授权观察窗口。

起始热度依据已有仓库指标；缺失信号不补造。模型变体可共享同一仓库星数。热度不能解释为质量榜或全网第一。评分权重、覆盖率、社区后验与风控见评分政策。

## 图片与归属

- 展示图：https://opengraph.githubassets.com/a3570d1e8f2a33df94f433294369cc7fca47ad68aa273bf5a9bb6d9de0ef1611/NVlabs/Sana
- 来源：https://github.com/NVlabs/Sana
- 归属：SANA 官方项目 / 仓库
- 图片说明：SANA 官方仓库预览，非本站生成效果样本

## 可追溯来源

- https://github.com/NVlabs/Sana
- https://huggingface.co/Efficient-Large-Model/Sana_1600M_1024px_BF16

## 原始记录

```json
{
  "id": "sana",
  "name": "SANA",
  "description": "围绕高分辨率与低显存优化的高效图像生成系列。",
  "modalities": [
    "text-to-image"
  ],
  "tags": [
    "text-to-image"
  ],
  "github": "https://github.com/NVlabs/Sana",
  "repo": "NVlabs/Sana",
  "huggingface": "https://huggingface.co/Efficient-Large-Model/Sana_1600M_1024px_BF16",
  "homepage": "https://github.com/NVlabs/Sana",
  "previewImage": "https://opengraph.githubassets.com/a3570d1e8f2a33df94f433294369cc7fca47ad68aa273bf5a9bb6d9de0ef1611/NVlabs/Sana",
  "previewKind": "official-repository-social-preview",
  "previewAlt": "SANA 官方仓库预览，非本站生成效果样本",
  "license": {
    "code": "Apache-2.0",
    "weights": "Apache-2.0",
    "classification": "permissive-open-weights",
    "summary": "已核对的 Sana_1600M_1024px_BF16 权重和代码采用 Apache-2.0；其他 checkpoint 须单独核对。",
    "source": "https://huggingface.co/Efficient-Large-Model/Sana_1600M_1024px_BF16"
  },
  "hardware": {
    "vramGb": 8,
    "estimate": true,
    "notes": "官方给出特定 4-bit/卸载配置可用 8GB 的示例；这不是所有 SANA 模型的最低配置，也不是本站实测。",
    "source": "https://github.com/NVlabs/Sana"
  },
  "localReadiness": "official-local-inference",
  "deploy": {
    "kind": "comfyui",
    "commandHint": "使用隔离 Python 环境，按官方 README 安装与下载指定权重；安装前审阅依赖和许可证。",
    "docs": "https://github.com/NVlabs/Sana"
  },
  "sources": [
    "https://github.com/NVlabs/Sana",
    "https://huggingface.co/Efficient-Large-Model/Sana_1600M_1024px_BF16"
  ],
  "researchDate": "2026-11-02",
  "stars": 9753,
  "starsSource": "https://api.github.com/repos/NVlabs/Sana",
  "starsObservedAt": "2026-11-02T08:41:19.783803+00:00",
  "arena": {
    "status": "cold-start",
    "score": null,
    "votes": 0
  },
  "notes": "",
  "githubMetadata": {
    "ok": true,
    "source": "https://api.github.com/repos/NVlabs/Sana",
    "observedAt": "2026-11-02T08:41:19.783803+00:00",
    "fullName": "NVlabs/Sana",
    "url": "https://github.com/NVlabs/Sana",
    "stars": 9753,
    "forks": 790,
    "archived": false,
    "pushedAt": "2026-10-30T07:01:25Z",
    "createdAt": "2024-10-11T20:19:45Z",
    "licenseSpdx": "Apache-2.0",
    "homepage": "https://nvlabs.github.io/Sana/docs/"
  },
  "previewSource": "https://github.com/NVlabs/Sana"
}
```
