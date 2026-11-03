# Vibe Atlas 本地部署与问答

此 companion 把网页中的明确部署计划交给你的电脑执行。它是一个可审阅的 Python 文件，只用标准库，不需要 pip 安装依赖。要求 **Python 3.10 或更新**。Docker 配方另需已启动的 Docker Desktop / 本机 Docker Engine；生成式问答另需已启动的 Ollama 和已经下载的本地权重。

## 1. 启动与配对

在网站的“本地部署”页下载 `atlas_companion.py`，在该文件所在目录打开终端。复制网页显示的命令，其中 Origin 自动使用你当前网站地址。

macOS / Linux：

```sh
python3 atlas_companion.py --origin "https://你的实际网站域名"
```

Windows PowerShell：

```powershell
py -3 atlas_companion.py --origin "https://你的实际网站域名"
```

Origin 必须与浏览器地址栏的协议、主机和端口完全一致；不要加末尾斜杠、路径或查询参数。本地开发允许 `http://localhost:端口` 或 `http://127.0.0.1:端口`。服务固定监听 `127.0.0.1:4317`。

终端会显示随机配对令牌。只把它粘贴到指定 Origin 的 Vibe Atlas 页面，点击“连接并探测”。令牌保留在页面内存，不写 localStorage，不放 URL，不发送到网站服务器。刷新网页后重新配对；重新启动 companion 会生成新令牌。

若浏览器询问本地网络访问，请允许该站点连接本机。若连接仍失败，检查 companion 是否运行、Origin 是否一致、4317 是否被占用，以及浏览器是否允许 HTTPS 页面访问 loopback。某些浏览器策略会阻止这种连接；网页会显示失败，不会假装已连接。可以使用支持 loopback / Private Network Access 的浏览器，或在本机运行网站后以本机 Origin 配对。

## 2. 查看真实硬件与运行时

连接会探测操作系统、`nvidia-smi` 的 GPU 名称/显存/驱动、本机 Docker daemon、Ollama 本地模型列表。未发现 NVIDIA 不代表没有 Apple 或 AMD GPU；这些设备的显存在当前版本不自动探测。

Docker 只允许 Unix socket / Windows named pipe 指向的本机 context。远程或 TCP Docker context 会被拒绝，避免把“本地部署”送到其他机器。

## 3. 三个可执行配方

| 配方 | 首次拉取的官方镜像 | 本机端口 | 数据卷 |
|---|---|---|---|
| Open WebUI | `ghcr.io/open-webui/open-webui:main` | `127.0.0.1:3000` → 8080 | `atlas_open_webui_data` |
| n8n 核心工作流编辑器 | `n8nio/n8n:latest` | `127.0.0.1:5678` → 5678 | `atlas_n8n_data` |
| Qdrant | `qdrant/qdrant:latest` | `127.0.0.1:6333` → 6333 | `atlas_qdrant_data` |

先点击“生成可检查的部署计划”，阅读原始完整参数、许可、端口、卷、浮动 tag 与未知下载大小的说明。计划包含 SHA-256，10 分钟内有效。确认框与部署按钮只提交此计划 ID 和 hash；浏览器不能自行替换镜像、挂载目录、命令或环境变量。

确认后 companion 检查同名容器，再 pull 官方 tag，使用 `docker image inspect` 读取 RepoDigest，并只接受该官方仓库的 `sha256` digest。实际 `docker run` 使用这个固定 digest，回执保留真实参数。首次拉取的浮动 tag 不是预先审计过的固定版本，用户应理解此边界。

已有同名容器时，companion 只返回状态，不删除、覆盖或自动启动。端口冲突或健康检查失败会如实显示；`docker run` 返回成功本身不会被当作服务健康。健康检查分别访问 `/health`、`/healthz`、`/readyz`。

Open WebUI 密钥在本地随机生成并写入 `~/.vibe-atlas/open-webui.secret`，POSIX 权限为 0600；目录权限为 0700。Windows 使用当前用户文件夹与平台权限语义，请保持用户目录私有。密钥仅通过内部进程环境传给 Docker，网页计划、请求、回执及日志都没有密钥值。Docker 管理员仍能读取容器环境，这是本机管理员的权限边界。

Open WebUI 的容器使用 `host.docker.internal` 连接 Ollama。Docker Desktop 通常提供该宿主机接口；Linux 上只绑定回环的 Ollama 不一定能从 Docker 网关访问。当前 companion 不修改 Ollama 的监听地址；Atlas 自带的本地问答直接连接 `127.0.0.1:11434`。

n8n 配方部署核心工作流编辑器，**不包含**新版 n8n Assistant 的可选 sandbox 服务。Qdrant 初始实例用于本机试用，不配置公网生产鉴权。三个配方都不绑定 `0.0.0.0`，不挂载 Docker socket，也不请求 privileged 权限。

任务在 companion 后台线程运行。关闭网页后任务继续；按 Ctrl+C 停止 companion 不会删除已创建容器或数据卷。若在 Docker 命令执行中停止 companion，重新启动后不会恢复旧任务轮询，应先在 Docker Desktop 中检查实际状态。已有容器使用 `unless-stopped` 重启策略，可在 Docker Desktop 中手动停止。无密钥回执写入 `~/.vibe-atlas/receipts/`。

## 4. 使用本地 Ollama 问答

从 [Ollama 官方下载页](https://ollama.com/download) 安装并启动 Ollama。先在本机选择、审阅和下载一个本地模型，例如官方 [Qwen3 模型页](https://ollama.com/library/qwen3) 的具体版本。companion 不会自动下载权重或创建云端请求。

重新探测，选择“已安装的本地模型”。网页先从 Vibe Atlas 的真实目录检索最多 6 条匹配结果，将说明、许可、官方来源与部署提示发送给本机模型。没有匹配结果时不发送无来源问题。返回答案显示来源链接。

companion 拒绝含 cloud 的模型名称、远程描述符、没有实际文件体积/digest 的模型，并通过 `/api/show` 检查本地 sha256 权重 blob。调用固定的回环 `/api/chat`，没有工具调用或 shell 执行通道。来源文本只作为数据，回答不会直接触发安装。模型仍可能误解来源；最终决策应核对链接与计划。

## 5. 接口边界

- 只接受精确 Host、指定 Origin 和随机 Bearer 令牌；拒绝缺失/重复身份头、跨站请求与 URL 令牌。
- CORS 只向指定 Origin 返回允许头；PNA 预检仍需匹配 Origin 与 Host。
- POST 只接受有大小限制的 JSON；字段集合严格匹配。
- subprocess 固定 `shell=False`。仅三种配方，没有任意命令、URL、下载路径、端口或环境变量接口。
- 本机 HTTP 请求不使用代理、不跟随重定向；云模型和远程 Docker context 均拒绝。
- 计划 hash 绑定服务器保存的计划，一次使用、10 分钟到期；同配方并行部署被拒绝。
- 不在日志记录请求正文、问题、令牌或密钥。

## 官方来源

- [Open WebUI Quick Start](https://docs.openwebui.com/getting-started/quick-start/)
- [n8n Docker 安装](https://docs.n8n.io/hosting/installation/docker/)
- [n8n 新版完整 Compose 与可选 Assistant sandbox](https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose.md)
- [Qdrant Quickstart](https://qdrant.tech/documentation/quickstart/)
- [Ollama API](https://docs.ollama.com/api)

本版本经过模拟 Docker/Ollama 的安全与流程测试，未在你的实际电脑执行部署、下载权重或测量性能。真实成功由你的本机探针和服务健康检查确认。
