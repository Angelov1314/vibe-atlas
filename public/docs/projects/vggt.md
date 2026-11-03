# VGGT

从一组图像估计相机、深度和三维点结构。

## 项目信息

- 类型：本地模型
- 分类：多视图重建 / 深度估计 / 相机姿态重建
- GitHub：https://github.com/facebookresearch/vggt
- 官网：https://github.com/facebookresearch/vggt
- 代码许可：VGGT License
- 权重许可：VGGT License; checkpoint-specific
- 权重分类：restricted-open-weights

## 许可说明

新商业版 checkpoint 与原始非商业权重不同；存在用途限制，须固定 checkpoint。

## 本地部署

使用隔离 Python 环境，按官方 README 安装与下载指定权重；安装前审阅依赖和许可证。

以上是官方安装方向，不代表已在本机执行或验证。详情页可下载包含完整检查步骤的 Codex 部署任务。

## 硬件条件

尚未在本站实测；显存受模型版本、精度、分辨率、序列长度和卸载设置影响。

## 数据快照

- GitHub Stars：14590
- 采集时间：2026-11-02T08:41:19.783803+00:00
- 最近推送：2026-05-19T03:39:39Z
- X：尚未接入完整授权观察窗口。

起始热度依据已有仓库指标；缺失信号不补造。模型变体可共享同一仓库星数。热度不能解释为质量榜或全网第一。评分权重、覆盖率、社区后验与风控见评分政策。

## 图片与归属

- 展示图：https://opengraph.githubassets.com/00d3d2f91b6e0d4f927b5807d2f42664137b61150418658593b8537992d57747/facebookresearch/vggt
- 来源：https://github.com/facebookresearch/vggt
- 归属：VGGT 官方项目 / 仓库
- 图片说明：VGGT 官方仓库预览，非本站生成效果样本

## 可追溯来源

- https://github.com/facebookresearch/vggt
- https://github.com/facebookresearch/vggt/blob/main/LICENSE.txt
- https://huggingface.co/facebook/VGGT-1B-Commercial

## 原始记录

```json
{
  "id": "vggt",
  "name": "VGGT",
  "description": "从一组图像估计相机、深度和三维点结构。",
  "modalities": [
    "multiview-to-3d",
    "depth-estimation",
    "camera-reconstruction"
  ],
  "tags": [
    "multiview-to-3d",
    "depth-estimation",
    "camera-reconstruction"
  ],
  "github": "https://github.com/facebookresearch/vggt",
  "repo": "facebookresearch/vggt",
  "huggingface": "https://huggingface.co/facebook/VGGT-1B-Commercial",
  "homepage": "https://github.com/facebookresearch/vggt",
  "previewImage": "https://opengraph.githubassets.com/00d3d2f91b6e0d4f927b5807d2f42664137b61150418658593b8537992d57747/facebookresearch/vggt",
  "previewKind": "official-repository-social-preview",
  "previewAlt": "VGGT 官方仓库预览，非本站生成效果样本",
  "license": {
    "code": "VGGT License",
    "weights": "VGGT License; checkpoint-specific",
    "classification": "restricted-open-weights",
    "summary": "新商业版 checkpoint 与原始非商业权重不同；存在用途限制，须固定 checkpoint。",
    "source": "https://github.com/facebookresearch/vggt/blob/main/LICENSE.txt"
  },
  "hardware": {
    "vramGb": null,
    "estimate": false,
    "notes": "尚未在本站实测；显存受模型版本、精度、分辨率、序列长度和卸载设置影响。",
    "source": "https://github.com/facebookresearch/vggt"
  },
  "localReadiness": "official-local-inference",
  "deploy": {
    "kind": "python",
    "commandHint": "使用隔离 Python 环境，按官方 README 安装与下载指定权重；安装前审阅依赖和许可证。",
    "docs": "https://github.com/facebookresearch/vggt"
  },
  "sources": [
    "https://github.com/facebookresearch/vggt",
    "https://github.com/facebookresearch/vggt/blob/main/LICENSE.txt",
    "https://huggingface.co/facebook/VGGT-1B-Commercial"
  ],
  "researchDate": "2026-11-02",
  "stars": 14590,
  "starsSource": "https://api.github.com/repos/facebookresearch/vggt",
  "starsObservedAt": "2026-11-02T08:41:19.783803+00:00",
  "arena": {
    "status": "cold-start",
    "score": null,
    "votes": 0
  },
  "notes": "",
  "githubMetadata": {
    "ok": true,
    "source": "https://api.github.com/repos/facebookresearch/vggt",
    "observedAt": "2026-11-02T08:41:19.783803+00:00",
    "fullName": "facebookresearch/vggt",
    "url": "https://github.com/facebookresearch/vggt",
    "stars": 14590,
    "forks": 1569,
    "archived": false,
    "pushedAt": "2026-05-19T03:39:39Z",
    "createdAt": "2025-02-18T18:32:14Z",
    "licenseSpdx": "NOASSERTION",
    "homepage": ""
  },
  "previewSource": "https://github.com/facebookresearch/vggt"
}
```
