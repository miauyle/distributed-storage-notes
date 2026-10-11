const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { docs } = require('./build_favicon_pilot.cjs');

async function checkFaviconPilot(browser, root) {
  const base = new URL(root).pathname;
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    try {
      await context.addInitScript(() => {
        if (!localStorage.getItem('docsteer-skin')) {
          localStorage.setItem('docsteer-skin', 'ember');
          localStorage.setItem('docsteer-mode', 'light');
        }
      });
      const page = await context.newPage();
      await page.goto(root + '/favicon-pilot/', { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: /打开文档 1/ }).click();
      await page.waitForURL(root + '/favicon-pilot/ember/light' + docs[0]);
      assert.equal(await page.locator('html').getAttribute('data-skin'), 'ember');
      assert.equal(await page.locator('[data-favicon-script]').count(), 0);
      assert.equal(await page.locator('link[rel="icon"]').count(), 1);
      const loaded = await page.locator('[data-pilot-icon]').getAttribute('href');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      assert.equal(new URL(canonical).pathname, base + docs[0]);
      const script = await page.locator('script[src*="favicon-pilot-"]').getAttribute('src');
      const body = await (await context.request.get(new URL(script, root).href)).body();
      assert.ok(script.endsWith(`-${createHash('sha256').update(body).digest('hex').slice(0, 12)}.js`));
      await page.evaluate(() => { window.pilotDocumentMarker = 'same-document'; });
      // Use the actual theme picker, not only the pilot convenience buttons.
      await page.locator('#skinPicker > .navbar__icon-btn').click();
      await page.locator('[data-skin-set="aqua"]').click();
      await page.waitForURL(root + '/favicon-pilot/aqua/light' + docs[0]);
      assert.equal(await page.evaluate(() => window.pilotDocumentMarker), 'same-document');
      assert.equal(await page.locator('[data-pilot-icon]').getAttribute('href'), loaded, 'No dynamic icon swapping in pilot');
      assert.equal(await page.evaluate(() => localStorage.getItem('docsteer-skin')), 'aqua');
      await page.reload({ waitUntil: 'networkidle' });
      const aqua = await page.locator('[data-pilot-icon]').getAttribute('href');
      assert.notEqual(aqua, loaded, 'Refresh loads static icon for saved skin');
      await page.getByRole('link', { name: '另一篇试点文章', exact: true }).click();
      await page.waitForURL(root + '/favicon-pilot/aqua/light' + docs[1]);
      assert.equal(await page.locator('[data-pilot-icon]').getAttribute('href'), aqua);
      await page.locator('#modeToggle').click();
      await page.waitForURL(root + '/favicon-pilot/aqua/dark' + docs[1]);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'dark');
      // Visiting an old profile URL uses the current saved selection, without loops.
      await page.goto(root + '/favicon-pilot/ember/light' + docs[0], { waitUntil: 'networkidle' });
      await page.waitForURL(root + '/favicon-pilot/aqua/dark' + docs[0]);
      await page.getByRole('link', { name: '返回普通首页', exact: true }).click();
      await page.waitForURL(root + '/');
      assert.equal(await page.locator('html').getAttribute('data-skin'), 'aqua');
      assert.equal(await page.locator('[data-favicon-script]').count(), 1, 'Production logic remains present');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    } finally { await context.close(); }
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await noJS.newPage();
    for (const skin of ['aqua', 'ember']) for (const mode of ['light', 'dark']) {
      const response = await page.goto(root + `/favicon-pilot/${skin}/${mode}` + docs[0]);
      const raw = await response.text();
      assert.ok(raw.includes('data-pilot-icon'));
      assert.ok(!raw.includes('data-favicon-script') && !raw.includes('document.write'));
      assert.equal(await page.locator('html').getAttribute('data-skin'), skin);
      assert.equal(await page.locator('html').getAttribute('data-mode'), mode);
      assert.equal(await page.locator('link[rel="icon"]').count(), 1);
      const href = await page.locator('[data-pilot-icon]').getAttribute('href');
      const png = await noJS.request.get(new URL(href, root).href);
      assert.equal(png.status(), 200);
      assert.ok(href.endsWith(`-${createHash('sha256').update(await png.body()).digest('hex').slice(0, 12)}.png`));
      await page.getByRole('link', { name: '另一篇试点文章', exact: true }).click();
      await page.waitForURL(root + `/favicon-pilot/${skin}/${mode}` + docs[1]);
      assert.equal(await page.locator('[data-pilot-icon]').getAttribute('href'), href);
    }
  } finally { await noJS.close(); }
  console.log('Themed document pilot: saved skins, static icons, reload, cross-page, modes, canonical URLs, script hash and no-JS passed. Real Safari tab UI remains unverified.');
}
module.exports = { checkFaviconPilot };
