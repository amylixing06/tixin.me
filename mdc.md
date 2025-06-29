# 提醒我 - 全局悬浮便签项目逻辑文档

## 1. 核心功能

### 1.1 全局悬浮便签（画中画窗口）
- **文件位置**: `floaty.js` 中的 `openFloatyNote()` 函数
- **实现原理**: 
  - 使用 `documentPictureInPicture.requestWindow()` API 创建独立的悬浮窗口
  - 动态创建 `<textarea>` 元素，实现基础文本输入
  - 实现自动高度调整，最大高度为窗口的 88%
  - 提供颜色切换功能，支持多种预定义颜色
  - 通过 localStorage 实现数据持久化和窗口间同步

### 1.2 内联便签（备用方案）
- **文件位置**: `floaty.js` 中的 `showInlineNote()` 函数
- **实现原理**:
  - 当浏览器不支持画中画 API 时使用
  - 在主页面中央显示模态窗口
  - 功能与全局悬浮便签相同，但不能在切换应用时保持显示

### 1.3 便签列表
- **文件位置**: `floaty.js` 中的 `updateAllNotes()` 函数
- **实现原理**:
  - 从 localStorage 读取保存的便签列表
  - 动态生成便签 HTML 元素
  - 提供编辑、删除功能
  - 显示便签创建/更新时间

## 2. 数据同步

### 2.1 本地存储
- **文件位置**: `floaty.js` 中的 `getNotes()` 和 `saveNotes()` 函数
- **实现原理**:
  - 使用 localStorage 存储便签数据
  - 通过 StorageEvent 实现同一浏览器不同标签页之间的数据同步
  - 数据格式为 JSON 数组，每个便签包含 id、content、color、createdAt、updatedAt 字段

### 2.2 云端同步
- **文件位置**: 
  - `floaty.js` 中的 `syncNotesToCloud()` 和 `loadNotesFromCloud()` 函数
  - `firebase.js` 中的同名函数
- **实现原理**:
  - 使用 Firebase Firestore 存储用户便签数据
  - 登录后自动同步本地便签到云端
  - 提供同步状态指示器，显示同步中、同步成功、同步失败状态
  - 实现错误处理和自动重试机制
  - 网络断开时监听网络恢复事件，自动重新同步
  - 合并本地和云端数据，解决冲突

### 2.3 自动同步
- **文件位置**: `floaty.js` 中的 `setupAutoSync()` 函数
- **实现原理**:
  - 定期自动同步（每 5 分钟）
  - 页面关闭前使用 sendBeacon API 确保数据同步
  - 网络状态变化时自动触发同步

## 3. 用户认证

### 3.1 登录/注册
- **文件位置**: `firebase.js` 中的认证相关函数
- **实现原理**:
  - 使用 Firebase Authentication 实现邮箱密码登录和 Google 登录
  - 登录状态持久化，使用 localStorage 和 sessionStorage
  - 登录后自动同步本地数据到云端

### 3.2 用户状态管理
- **文件位置**: `firebase.js` 中的 `authStateListener` 函数
- **实现原理**:
  - 监听用户登录状态变化
  - 在 localStorage 和 sessionStorage 中存储用户信息
  - 优先从本地存储读取用户信息，确保页面加载时立即显示登录状态

## 4. 离线支持

### 4.1 Service Worker
- **文件位置**: `service-worker.js`
- **实现原理**:
  - 缓存核心文件，支持离线访问
  - 对不同类型的请求采用不同的缓存策略
  - HTML 文件优先使用网络响应，网络失败时使用缓存
  - 其他资源优先使用缓存，缓存不存在时使用网络
  - 不缓存 Firebase 认证相关请求
  - 清理旧版本缓存和已移除文件的缓存

### 4.2 离线数据处理
- **文件位置**: `floaty.js` 中的 `syncNotesToCloud()` 函数
- **实现原理**:
  - 检测网络状态，离线时延迟同步
  - 网络恢复时自动重试同步
  - 本地优先策略，确保离线时也能正常使用

## 5. 用户界面

### 5.1 响应式设计
- **文件位置**: `index.html` 中的 CSS 和 `index.js` 中的 `checkMobileView()` 函数
- **实现原理**:
  - 根据屏幕尺寸调整布局
  - 移动端显示底部新建便签按钮
  - 自适应便签容器大小

### 5.2 便签编辑界面
- **文件位置**: `floaty.js` 中的 `openFloatyNote()` 和 `showInlineNote()` 函数
- **实现原理**:
  - 提供纯文本输入框
  - 自动保存功能，输入停止 1 秒后保存
  - 颜色选择器，支持多种预定义颜色
  - 编辑已有便签时预填充内容和颜色

### 5.3 同步状态指示器
- **文件位置**: `floaty.js` 中的 `updateSyncStatus()` 函数
- **实现原理**:
  - 显示同步中、同步成功、同步失败状态
  - 同步成功后显示时间，几秒后自动消失
  - 同步失败时显示错误信息和重试按钮

## 6. 性能优化

### 6.1 资源加载优化
- **文件位置**: `index.html` 和 `service-worker.js`
- **实现原理**:
  - 使用 Service Worker 缓存静态资源
  - 动态导入 Firebase SDK，减少初始加载时间
  - 优先显示界面，延迟加载非关键资源

### 6.2 数据处理优化
- **文件位置**: `floaty.js` 中的各数据处理函数
- **实现原理**:
  - 使用防抖函数，避免频繁保存和同步
  - 批量处理便签更新
  - 优化合并算法，减少冲突

## 7. 安全性

### 7.1 数据安全
- **文件位置**: `firebase.js` 和 `floaty.js`
- **实现原理**:
  - 使用 Firebase Authentication 进行用户认证
  - 数据存储在用户私有空间，确保隔离
  - 本地数据使用 localStorage 存储，仅在用户浏览器中可见

### 7.2 错误处理
- **文件位置**: 各函数中的 try-catch 块
- **实现原理**:
  - 全面的错误捕获和处理
  - 友好的错误提示
  - 自动重试机制
  - 日志记录 