// Copies two built documents only; the Markdown remains the single content source.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const skins = ['aqua', 'ember'];
const docs = ['/docs/01-overview/01-storage-models-architecture-map/', '/docs/02-storage-fundamentals/01-io-path-persistence/'];
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

function buildFaviconPilot(site, base, palettes, profiles) {
  const script = fs.readFileSync(path.join(__dirname, 'favicon-pilot.js'), 'utf8');
  const scriptName = `favicon-pilot-${createHash('sha256').update(script).digest('hex').slice(0, 12)}.js`;
  fs.writeFileSync(path.join(site, 'assets/js', scriptName), script);
  const routes = {}, reverse = {};
  for (const skin of skins) for (const mode of ['light', 'dark']) {
    const profile = `${skin}/${mode}`;
    if (!palettes[profiles[profile]]) throw new Error(`Missing pilot profile ${profile}`);
    routes[profile] = {};
    for (const doc of docs) {
      const variant = `${base}/favicon-pilot/${profile}${doc}`;
      routes[profile][base + doc] = variant;
      reverse[variant] = base + doc;
    }
  }
  const write = (route, html) => {
    const directory = path.join(site, route.slice(base.length));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), html);
  };
  for (const skin of skins) for (const mode of ['light', 'dark']) for (const doc of docs) {
    const profile = `${skin}/${mode}`;
    const icons = palettes[profiles[profile]];
    let html = fs.readFileSync(path.join(site, doc, 'index.html'), 'utf8');
    // Remove all production favicon handling in these isolated copies.
    html = html.replace(/<noscript>\s*(?:<link\b[^>]*>\s*)+<\/noscript>/g, '')
      .replace(/<link\b[^>]*data-static-brand-icon[^>]*>\s*/g, '')
      .replace(/<script\b[^>]*id="favicon-palettes"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<script\b[^>]*data-favicon-script[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<script>\s*\(function\s*\(\)\s*\{[\s\S]*?localStorage\.getItem\('docsteer-mode'\)[\s\S]*?<\/script>/, '');
    if (html.includes('data-static-brand-icon') || html.includes('data-favicon-script')) throw new Error('Pilot retained dynamic icon declarations');
    html = html.replace(/<html\b[^>]*>/, tag => tag
      .replace(/\sdata-(?:skin|mode)="[^"]*"/g, '')
      .replace(/>$/, ` data-skin="${skin}" data-mode="${mode}">`));
    // Keep canonical / og:url on the original document; no indexing of pilot copies.
    const config = { skins, skin, mode, canonical: base + doc, routes, reverse };
    html = html.replace('</head>', `<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/png" sizes="64x64" href="${icons.icon}" data-pilot-icon>
<link rel="apple-touch-icon" sizes="180x180" href="${icons.apple}">
<script id="favicon-pilot-config" type="application/json">${json(config)}</script>
<script src="${base}/assets/js/${scriptName}"></script>
</head>`);
    // Only the two supported skins are offered in the pilot's real picker.
    html = html.replace(/<button\b[^>]*data-skin-set="([^"]+)"[^>]*>[\s\S]*?<\/button>/g,
      (button, value) => skins.includes(value) ? button : '');
    const banner = `<aside aria-label="Safari 图标试点" style="padding:12px 20px;border-bottom:1px solid currentColor">
Safari 图标试点（两篇文档）：切换蓝色/红色后刷新，或进入另一篇试点文章。
<button type="button" data-pilot-skin="aqua">蓝色 aqua</button>
<button type="button" data-pilot-skin="ember">红色 ember</button>
<a href="${base + docs.find(value => value !== doc)}">另一篇试点文章</a> · <a href="${base}/">返回普通首页</a>
<small>其他文档会退出试点；本页图标在下次加载时同步。</small></aside>`;
    html = html.replace(/(<body\b[^>]*>)/, '$1' + banner);
    // Rewrite navigation anchors while leaving canonical and resources alone.
    html = html.replace(/<a\b[^>]*>/g, tag => tag.replace(/href="([^"]+)"/, (attribute, href) => {
      const match = href.match(/^([^?#]*)(.*)$/);
      const target = routes[profile][match[1]];
      return target ? `href="${target}${match[2]}"` : attribute;
    }));
    write(routes[profile][base + doc], html);
  }
  const entry = `${base}/favicon-pilot/`;
  write(entry, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Safari 文档图标试点</title></head>
<body style="font:18px/1.7 system-ui;max-width:720px;margin:40px auto;padding:20px"><h1>Safari 文档图标试点</h1>
<p>先在<a href="${base}/">普通首页</a>选择蓝色 aqua 或红色 ember，再打开下面的文档。试点会读取相同的已保存强调色；其他强调色在试点中暂用 aqua，不改写原来的选择。</p>
<p>进入文档后可用原主题控件或试点按钮切色。切色后刷新，或点击“另一篇试点文章”，检查标签图标是否与左上角 Logo 同色。其他文章与普通首页尚未接入。</p>
<p>${docs.map((doc, i) => `<a data-pilot-entry href="${routes['aqua/light'][base + doc]}">打开文档 ${i + 1}：${i === 0 ? '存储模型与架构图' : 'I/O 路径与持久化'}</a>`).join('</p><p>')}</p>
<script>(()=>{let skin='aqua',mode='auto';try{skin=localStorage.getItem('docsteer-skin')||skin;mode=localStorage.getItem('docsteer-mode')||mode;}catch(_){}if(!${json(skins)}.includes(skin))skin='aqua';if(!['light','dark'].includes(mode))mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';const routes=${json(routes)};for(const a of document.querySelectorAll('[data-pilot-entry]')){const canonical=${json(reverse)}[new URL(a.href).pathname];a.href=routes[skin+'/'+mode][canonical];}})();</script>
</body></html>`);
  console.log('Safari document pilot: two skins, two modes, two real documents; original routes unchanged.');
}
module.exports = { buildFaviconPilot, docs };
