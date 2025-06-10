# 全局悬浮便签（PWA）

极简、纯净的全局悬浮便签应用，支持PWA安装、纯文本输入、颜色分类，适配桌面端和移动端。

## 主要特性
- 一键创建全局悬浮便签（画中画窗口，支持多浏览器）
- 纯文本输入，自动保存
- 便签颜色分类，极简切换
- 极致自适应布局，窗口大小可调，最小200x150
- 支持PWA安装，离线可用
- 支持移动端添加到主屏幕

## 快速开始
1. 克隆本仓库：
   ```bash
   git clone <your-repo-url>
   ```
2. 本地启动静态服务器（如python/http-server等），或直接部署到静态托管平台。
3. 访问 `index.html`，点击“创建悬浮便签”按钮。

## PWA支持
- 已内置manifest.json和service-worker.js，支持离线访问和主屏幕安装。

## 兼容性
- 推荐使用最新版Chrome/Edge/Opera等支持Document Picture-in-Picture的浏览器。
- Safari/Firefox暂不支持全局悬浮。

## 目录结构
- index.html         主页面入口
- floaty.js          悬浮便签核心逻辑
- manifest.json      PWA配置
- service-worker.js  PWA离线支持

## License
MIT
