# TripoSR

把单张物体图像快速重建为可导出的三维网格。

## 项目信息

- 类型：本地模型
- 分类：单图转3D / 纹理网格
- GitHub：https://github.com/VAST-AI-Research/TripoSR
- 官网：https://github.com/VAST-AI-Research/TripoSR
- 代码许可：MIT
- 权重许可：MIT
- 权重分类：permissive-open-weights

## 许可说明

官方说明 MIT 同时覆盖代码和预训练模型。

## 本地部署

在隔离环境中按 README 安装后，用 python run.py <image> --output-dir output/ 执行单图重建。

以上是官方安装方向，不代表已在本机执行或验证。详情页可下载包含完整检查步骤的 Codex 部署任务。

## 硬件条件

官方默认单图推理约 6GB 显存；输入、纹理烘焙和硬件实现会影响用量，本站未实测。

参考显存：6 GB；仍受版本、精度和工作流影响。

## 数据快照

- GitHub Stars：7276
- 采集时间：2026-11-02T08:41:19.783803+00:00
- 最近推送：2026-06-04T07:11:09Z
- X：尚未接入完整授权观察窗口。

起始热度依据已有仓库指标；缺失信号不补造。模型变体可共享同一仓库星数。热度不能解释为质量榜或全网第一。评分权重、覆盖率、社区后验与风控见评分政策。

## 图片与归属

- 展示图：https://opengraph.githubassets.com/7858332e7122dec82856dab496ac93bac6a1a20d70dcfcafe7b275e8c9592aee/VAST-AI-Research/TripoSR
- 来源：https://github.com/VAST-AI-Research/TripoSR
- 归属：TripoSR 官方项目 / 仓库
- 图片说明：TripoSR 官方仓库预览，非本站生成效果样本

## 可追溯来源

- https://github.com/VAST-AI-Research/TripoSR
- https://huggingface.co/stabilityai/TripoSR

## 原始记录

```json
{
  "id": "triposr",
  "name": "TripoSR",
  "description": "把单张物体图像快速重建为可导出的三维网格。",
  "modalities": [
    "image-to-3d",
    "textured-mesh"
  ],
  "tags": [
    "image-to-3d",
    "textured-mesh"
  ],
  "github": "https://github.com/VAST-AI-Research/TripoSR",
  "repo": "VAST-AI-Research/TripoSR",
  "huggingface": "https://huggingface.co/stabilityai/TripoSR",
  "homepage": "https://github.com/VAST-AI-Research/TripoSR",
  "previewImage": "https://opengraph.githubassets.com/7858332e7122dec82856dab496ac93bac6a1a20d70dcfcafe7b275e8c9592aee/VAST-AI-Research/TripoSR",
  "previewKind": "official-repository-social-preview",
  "previewAlt": "TripoSR 官方仓库预览，非本站生成效果样本",
  "license": {
    "code": "MIT",
    "weights": "MIT",
    "classification": "permissive-open-weights",
    "summary": "官方说明 MIT 同时覆盖代码和预训练模型。",
    "source": "https://github.com/VAST-AI-Research/TripoSR"
  },
  "hardware": {
    "vramGb": 6,
    "estimate": true,
    "notes": "官方默认单图推理约 6GB 显存；输入、纹理烘焙和硬件实现会影响用量，本站未实测。",
    "source": "https://github.com/VAST-AI-Research/TripoSR"
  },
  "localReadiness": "official-local-inference",
  "deploy": {
    "kind": "python",
    "commandHint": "在隔离环境中按 README 安装后，用 python run.py <image> --output-dir output/ 执行单图重建。",
    "docs": "https://github.com/VAST-AI-Research/TripoSR"
  },
  "sources": [
    "https://github.com/VAST-AI-Research/TripoSR",
    "https://huggingface.co/stabilityai/TripoSR"
  ],
  "researchDate": "2026-11-02",
  "stars": 7276,
  "starsSource": "https://api.github.com/repos/VAST-AI-Research/TripoSR",
  "starsObservedAt": "2026-11-02T08:41:19.783803+00:00",
  "arena": {
    "status": "cold-start",
    "score": null,
    "votes": 0
  },
  "notes": "",
  "githubMetadata": {
    "ok": true,
    "source": "https://api.github.com/repos/VAST-AI-Research/TripoSR",
    "observedAt": "2026-11-02T08:41:19.783803+00:00",
    "fullName": "VAST-AI-Research/TripoSR",
    "url": "https://github.com/VAST-AI-Research/TripoSR",
    "stars": 7276,
    "forks": 938,
    "archived": false,
    "pushedAt": "2026-06-04T07:11:09Z",
    "createdAt": "2024-02-07T10:31:04Z",
    "licenseSpdx": "MIT",
    "homepage": "https://www.tripo3d.ai/research/triposr"
  },
  "previewSource": "https://github.com/VAST-AI-Research/TripoSR"
}
```
