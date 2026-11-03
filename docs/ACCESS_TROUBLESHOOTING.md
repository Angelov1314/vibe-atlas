# 本地访问排查

先完成 `npm run install:ci`、`pnpm setup:local`，再运行 `pnpm dev`，使用终端实际返回的地址。此应用使用 Worker 运行时，不能用普通 `next start`。

本机文件事件反复触发刷新时，可把项目放在不经云盘同步的本地目录，并使用 `CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=1000 pnpm dev --host 127.0.0.1`。

GitHub 预览图可能被上游限流；界面会显示图片回退，不影响目录文本与来源链接。托管部署的认证、域名和访问范围由部署所有者单独配置。
