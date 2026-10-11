# 站点图标维护

四站共用相同生成器、head 模板、主题切换和验证代码。各站图案由 `docsteer.favicon` 的 SVG 决定，导航 Logo 保持透明 SVG + CSS 主题渐变。
静态 SVG、PNG 与 Logo URL 带内容 SHA-256；favicon 脚本同样自动带内容 hash，不使用手动版本号或每次请求的随机时间戳。

## 发布构建

1. 安装现有站点依赖、`cairosvg==2.8.2` 和 Playwright Chromium。
2. 执行原有 Jekyll production build。
3. `NODE_PATH=<site-deps>/node_modules node maintenance/build_theme_icons.cjs /<project-baseurl>`。
4. 执行原有站点与 Chromium 校验；安装 Playwright WebKit 后运行 `node maintenance/check_webkit_icons.cjs /<project-baseurl>`，最后上传完整 `_site`。

CI 已包含这些步骤。仅执行 Jekyll、不运行步骤 3 时保留默认静态图标，不生成主题变体。
生成器从构建页面的实际 skin 控件及实际编译 CSS 读取每种 light/dark 的 `--brand` / `--accent`，不手写第二份配色表。
`render_theme_icons.py` 修改原 SVG 副本中的 `data-theme-color="brand"` / `accent` 渐变标记，生成 64px favicon 和 180px Apple Touch PNG。
文件名为 `theme-<size>-<PNG内容SHA256前12位>.png`，换颜色或图案即换 URL，同一内容继续复用缓存。
生成文件和逐页注入的配色 manifest 仅存在于构建产物，不提交生成 PNG，不修改知识正文。

## 页面行为与回退

`favicon-accent.js` 是带内容 hash 的非 defer head 脚本：读取已恢复的主题与实际 CSS 颜色，选择 manifest 中的同源 HTTP PNG。
同时替换唯一 `rel=icon` 和 `rel=apple-touch-icon` 节点；静态节点保留作回退但移除 rel，避免多个候选争抢。
skin/mode、系统深浅色、返回页面及重新显示时同步。没有 JS、没有 manifest、未知配色或 PNG 解码失败时仍使用原静态图标。
不再依赖 Canvas 或 `data:` URL 作为浏览器图标。

浏览器标签列表、收藏/历史图标的刷新时机仍由浏览器决定。已安装到 iOS 主屏幕的图标不保证随页面主题自动更新。
Chromium 和移动尺寸 WebKit 检查的是资源、声明、PNG 像素、缓存 hash、刷新/跨页、系统主题及回退；不能等同于 iPhone Safari/Chrome 的真实标签栏 UI 验证。

## Safari 初始候选时序

该方案的 Safari 真机效果未通过用户复核。普通站点暂保留原实现；下面的静态文档试点不使用该逻辑。

默认图标的元数据节点初始没有有效 rel；无 JS 时由 noscript 声明默认图标。脚本请求失败时 onerror 恢复默认声明。
首次加载时，带 hash 的同步 head 脚本在解析阶段用 document.write 声明已保存主题对应的 PNG favicon / Apple Touch；严格限制为 parser-inserted、非 async/defer、document.readyState=loading，事件回调绝不调用 document.write。
这是针对默认候选抢先被收集的兼容性修正，不等于保证 Safari 浏览器 UI 支持即时动态更新。不会强制刷新、改页面 URL 或清除用户缓存。Chrome 的后续 DOM 切换逻辑保持不变。

## 静态配色文档试点

入口 `/favicon-pilot/`。仅复用两篇真实文章：存储模型与架构图、I/O 路径与持久化。
支持 aqua / ember 和 light / dark，生成八份 HTML，不新增或复制 Markdown 正文。
配色与 PNG 仍来自实际主题 CSS；试点脚本也使用内容 hash 文件名。
变体地址形如 `/favicon-pilot/aqua/light/docs/.../`，原始 HTML 只声明该配色的 PNG favicon 和 Apple Touch 图标。
试点不运行 `favicon-accent.js`，也不使用 `document.write`。
进入时读取原主题的 `docsteer-skin` / `docsteer-mode`；已保存主题与地址不同时，跳转到相应静态页面。
切色或切换明暗模式只保存主题选择并更新两篇文档的链接，不改当前地址，不自动刷新，不动态修改图标。
手动刷新时若旧配色地址与保存的主题不同，会真正跳转一次到新配色地址；跨页链接直接进入新配色地址。
不使用 `history.replaceState`，避免旧图标可能提前关联到新配色 URL。其他页面保持原地址并退出试点。
其他强调色在试点中暂用 aqua，保持原来的 localStorage 选择，主题菜单只提供这两种已支持配色。
变体保留原正文 canonical / og:url，声明 noindex,nofollow，不进入搜索、目录和 sitemap。
WebKit 自动检查刷新、跨页、保存配色、明暗模式、无 JS 静态声明和退出试点；实际标签栏效果仍需 iPhone / Mac Safari 复核。
