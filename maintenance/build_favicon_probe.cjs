// Temporary real-Safari probe. No theme scripts, redirects, or storage changes.
const fs = require('node:fs');
const path = require('node:path');

function buildFaviconProbe(site, base, palettes) {
  const entries = Object.entries(palettes);
  const first = entries[0];
  const rgb = key => key.match(/\d+(?:\.\d+)?/g).map(Number);
  const distance = key => rgb(key).reduce((sum, n, i) => sum + (n - rgb(first[0])[i]) ** 2, 0);
  const second = entries.filter(([, value]) => value.icon !== first[1].icon)
    .sort((a, b) => distance(b[0]) - distance(a[0]))[0];
  if (!second) throw new Error('Favicon probe requires two distinct palettes');
  for (const [i, [key, variant]] of [first, second].entries()) {
    const name = i === 0 ? 'a' : 'b';
    const other = i === 0 ? 'b' : 'a';
    const [brand, accent] = key.split('|');
    const directory = path.join(site, 'favicon-check', name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>图标验证 ${name.toUpperCase()}</title>
<link rel="icon" type="image/png" sizes="64x64" href="${variant.icon}">
<link rel="apple-touch-icon" sizes="180x180" href="${variant.apple}">
<style>
body{font:18px/1.7 system-ui,sans-serif;max-width:650px;margin:40px auto;padding:0 20px;color:#222;background:#fff}
.sample{display:flex;align-items:center;gap:16px;padding:20px;border-radius:12px;background:linear-gradient(140deg,${brand},${accent});color:white}
img{width:64px;height:64px}a{display:inline-block;margin:10px 14px 10px 0}
</style></head><body>
<h1>Safari 图标验证 ${name.toUpperCase()}</h1>
<div class="sample"><img src="${variant.icon}" alt="本页预期图标"><strong>标签栏图标应与这张图片同色</strong></div>
<p>本页直接在 HTML 中声明静态图标，不运行 JavaScript，不修改你的主题设置。页面中的图片只是对照，请观察浏览器自己的标签图标。</p>
<ol>
<li>从 A 跳到 B，观察图标是否变成 B 的颜色。</li>
<li>在 B 手动刷新，再观察一次。</li>
<li>切到其他标签页后返回，观察是否变化。</li>
<li>关闭测试标签，直接重新打开 B 的地址，再观察一次。</li>
<li>返回 A，检查能否再次变回 A 的颜色。</li>
</ol>
<p><a href="${base}/favicon-check/${other}/">进入 ${other.toUpperCase()} 页</a><a href="${base}/favicon-check/${name}/">重新进入本页</a><a href="${base}/">返回站点</a></p>
<p>请分别记录 iPhone Safari 与 Mac Safari：跨页、刷新、切回标签、重新打开是否生效。即使测试通过，也只说明这个静态页面实验有效，尚不能证明正常文档的动态切色有效。</p>
</body></html>\n`);
  }
}

module.exports = { buildFaviconProbe };
