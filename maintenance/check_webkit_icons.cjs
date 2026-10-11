// WebKit engine regression, not a claim about real Safari/Chrome tab UI.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { webkit } = require('playwright');
const { checkBrandIcons } = require('./check_brand_icons.cjs');
const { checkFaviconPilot } = require('./check_favicon_pilot.cjs');

(async () => {
  const base = process.argv[2];
  if (!/^\/[a-z0-9-]+$/.test(base || '')) throw new Error('Provide project baseurl');
  const site = path.resolve('_site');
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!url.startsWith(base + '/')) { res.writeHead(404).end(); return; }
    let file = path.resolve(site, '.' + url.slice(base.length));
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(site + path.sep)) { res.writeHead(404).end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3, hasTouch: true });
    const page = await context.newPage();
    const root = `http://127.0.0.1:${server.address().port}${base}`;
    await checkFaviconPilot(browser, root);
    // Validate static declarations without JS; Safari's tab UI is not exposed here.
    const probeContext = await browser.newContext({ javaScriptEnabled: false });
    try {
      const probe = await probeContext.newPage();
      const icons = [];
      for (const name of ['a', 'b']) {
        const response = await probe.goto(`${root}/favicon-check/${name}/`);
        assert.equal(response.status(), 200);
        assert.equal(await probe.locator('script').count(), 0);
        assert.equal(await probe.locator('link[rel="icon"]').count(), 1);
        const href = await probe.locator('link[rel="icon"]').getAttribute('href');
        const png = await probeContext.request.get(new URL(href, root).href);
        assert.equal(png.status(), 200);
        const hash = createHash('sha256').update(await png.body()).digest('hex').slice(0, 12);
        assert.ok(href.endsWith(`-${hash}.png`));
        assert.equal(await probe.locator('img').getAttribute('src'), href);
        icons.push(href);
        await probe.reload();
        assert.equal(await probe.locator('link[rel="icon"]').getAttribute('href'), href);
      }
      assert.notEqual(icons[0], icons[1]);
      await probe.getByRole('link', { name: '进入 A 页', exact: true }).click();
      await probe.waitForURL(`${root}/favicon-check/a/`);
      assert.equal(await probe.locator('link[rel="icon"]').getAttribute('href'), icons[0]);
      console.log('Static A/B probe declarations, PNG content hashes and navigation passed; actual Safari tab icons remain unverified.');
    } finally { await probeContext.close(); }
    await page.goto(root + '/', { waitUntil: 'networkidle' });
    await checkBrandIcons(page, root);
    console.log('Mobile WebKit icon resource and theme regression passed (browser UI requires real-device confirmation).');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
