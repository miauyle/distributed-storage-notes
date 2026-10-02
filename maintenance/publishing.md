# GitHub Pages 文档站维护

## 实现来源与内容边界

本站迁移自 `miauyle/ai-systems-notes` 的 master（基准提交 `5bb1629fec8530c23a48dcdc578f342e96d69054`），使用 Jekyll / DocSteer 1.1.1，同步 aqua、深浅色、skin、搜索、导航与 27 寸宽屏规则。

现有 `docs/<section>/*.md` 是唯一正文源，不添加 `_docs` 副本。`navigation.json` 维护十二个专题、实际文章、自然标签、摘要与顺序。生成器创建内存中的 Jekyll documents，按原始路径生成 `/docs/<section>/<article>/`；专题 `README.md` 使用 `/docs/<section>/`。`/docs/` 目录页由同一导航生成，无额外正文源。

GitHub Markdown 保持原文件相对链接。网站在构建时重写相对链接，所有资源支持 `/distributed-storage-notes`；Edit this page 指向 `master` 中原始源文件。首页明确显示现有文章数量，尚无正文的章节标记为专题入口；核心专题只链接真实正文。

## 构建、预览与验证

CI 使用 Ruby 3.3、Bundler 2.5.22、Node 22。Gemfile / lock 沿用基准仓库；资源脚本固定 KaTeX 0.16.22、Mermaid 11.6.0、Playwright 1.51.1 的直接版本。浏览器运行时使用本地资源，包括字体。

```sh
bundle install
SITE_DEPS_DIR=/tmp/distributed-storage-site-deps bash tools/prepare_site_assets.sh
python tools/check_docs.py
JEKYLL_ENV=production bundle exec jekyll build --baseurl /distributed-storage-notes
python tools/check_site.py
/tmp/distributed-storage-site-deps/node_modules/.bin/playwright install --with-deps chromium
NODE_PATH=/tmp/distributed-storage-site-deps/node_modules node tools/check_site_ui.cjs
bundle exec jekyll serve --baseurl /distributed-storage-notes
```

预览地址：`http://127.0.0.1:4000/distributed-storage-notes/`。生成物 `_site`、第三方资源和 `site-qa` 截图均不提交。

检查涵盖源目录、路由、baseurl、锚点、完整搜索、源文件编辑链接、全部正文的 Mermaid / TOC / pager，以及 2560×1440、1280×900、390×844、320×720 下的 overflow。检查主题持久化、skin 渐变 Logo、搜索快捷键、移动抽屉与 TOC。KaTeX 用浏览器临时 fixture 验证，不向知识正文添加公式。Chromium 拦截外部运行时请求，确保不依赖公共 CDN。`site-qa/report.json` 与截图作为 Actions evidence 保存。

宽屏（≥1440px）使用 17px root、1640px shell、300px Sidebar、248px TOC、900px content、76ch measure 和 1480px 首页。手机保持主题 drawer 和本地 mobile TOC；正文阅读行长与图表可用宽度分开控制。

## 发布

`.github/workflows/pages.yml` 对 PR 与 master 构建并验证，失败不部署。PR 只构建；仅 master push 的构建通过后发布 Pages，deploy job 使用 `pages: write` 与 OIDC。手动触发只用于验证。

首次发布的 GitHub Pages Source 应设置为 **GitHub Actions**。合并前核对准确 head SHA 的 CI 和实际 diff；部署是否成功以 master workflow 的 deploy 作业及正式站点响应为准，不能把合并成功当成上线。
