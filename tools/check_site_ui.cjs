/* Real Chromium checks against the Jekyll artifact, never a substitute renderer. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const nav = require('../navigation.json');
const siteRoot = path.resolve(__dirname, '../_site');
const evidence = path.resolve(__dirname, '../site-qa');
fs.mkdirSync(evidence, { recursive: true });
// Serve the production subpath without copying the site to a second source tree.
const server = spawn('python', ['-c', `
from http.server import HTTPServer, SimpleHTTPRequestHandler
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=${JSON.stringify(siteRoot)}, **kwargs)
    def do_GET(self):
        if not self.path.startswith('/distributed-storage-notes/'):
            self.send_error(404)
            return
        self.path = self.path[len('/distributed-storage-notes'):]
        super().do_GET()
HTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
`], { stdio: 'ignore' });
const root = 'http://127.0.0.1:8765/distributed-storage-notes';
const report = { checks: [], errors: [] };

(async () => {
  let browser;
  try {
    for (let retry = 0; retry < 100; retry++) {
      try { if ((await fetch(root + '/')).ok) break; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === new URL(root).origin) return route.continue();
      report.errors.push('Unexpected external runtime request: ' + route.request().url());
      return route.abort();
    });
    page.on('pageerror', error => report.errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    async function open(url) {
      const response = await page.goto(root + url, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, url);
      await page.waitForFunction(() => [...document.querySelectorAll('.mermaid')].every(node => node.dataset.rendered === 'true'), { timeout: 30000 });
      assert.equal(await page.locator('.render-error, .katex-error').count(), 0, url);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflow: ' + url);
    }
    await open('/');
    assert.equal(await page.locator('.knowledge-group').count(), 12);
    assert.equal(await page.locator('.knowledge-topic').count(), 8);
    assert.equal(await page.locator('.knowledge-overview a').count(), 12);
    assert.deepEqual(await page.locator('.knowledge-group h3').allTextContents(), nav.groups.map(g => g.title));
    const brandLogo = page.locator('.navbar .brand__logo');
    assert.match(await brandLogo.getAttribute('src'), /logo-theme\.svg$/);
    const favicon = page.locator('link[rel="icon"]');
    assert.equal(await favicon.count(), 1);
    assert.match(await favicon.getAttribute('href'), /favicon-storage\.svg$/);
    const aquaLogoBackground = await brandLogo.evaluate(node => getComputedStyle(node).backgroundImage);
    await page.locator('#skinPicker > .navbar__icon-btn').click();
    await page.locator('[data-skin-set="violet"]').click();
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'violet');
    const violetLogoBackground = await brandLogo.evaluate(node => getComputedStyle(node).backgroundImage);
    assert.notEqual(violetLogoBackground, aquaLogoBackground, 'Brand logo follows active skin');
    await page.locator('#skinPicker > .navbar__icon-btn').click();
    await page.locator('[data-skin-set="aqua"]').click();
    report.checks.push('brand logo uses cache-busted asset and follows skin accent');
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'home-desktop-light.png'), fullPage: true });
    report.checks.push('home: twelve sections, eight topics, production baseurl');
    await page.locator('#modeToggle').click();
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'dark');
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'home-desktop-dark.png'), fullPage: true });
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'dark');
    await page.locator('#modeToggle').click();
    await page.keyboard.press('/');
    await page.locator('#searchInput').fill('Replication');
    await page.waitForFunction(() => document.querySelectorAll('.search-result').length > 0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/docs/**');
    await page.keyboard.press('Control+k');
    await page.locator('#searchInput').fill('修复');
    await page.waitForFunction(() => [...document.querySelectorAll('.search-result')].some(node => /恢复|Repair/.test(node.textContent)));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#searchModal').getAttribute('aria-hidden'), 'true');
    report.checks.push('mode persistence; search hotkeys, Chinese/English, keyboard result navigation');
    await open('/docs/');
    assert.equal(await page.locator('.sidebar__group').count(), 12);
    assert.equal(await page.locator('.doc-head__edit').getAttribute('href'), 'https://github.com/miauyle/distributed-storage-notes/edit/master/navigation.json');
    await open('/docs/03-object-storage/');
    const sidebarLabels = await page.locator('#sidebar .sidebar__nav .sidebar__link').allTextContents();
    assert.ok(sidebarLabels.every(label => !/^\s*\d+\s*·/.test(label)), 'Sidebar labels must not expose document number prefixes');
    const inactiveGroup = page.locator('#sidebar .sidebar__group.is-collapsed').first();
    await inactiveGroup.locator('.sidebar__group-title').click();
    assert.ok(await page.locator('#sidebar.is-sticky').count());
    report.checks.push('sidebar uses topic labels without misleading document number prefixes');
    // Visit every knowledge page so no diagram or formula is hidden by sampling.
    const pages = nav.groups.flatMap(group => group.pages).concat(nav.reference_pages);
    for (const [index, item] of pages.entries()) {
      await open('/' + item.path.replace(/README\.md$/, '').replace(/\.md$/, '/'));
      const source = fs.readFileSync(path.resolve(__dirname, '..', item.path), 'utf8');
      const math = (source.match(/^```math\s*$|\$`[^`]+`\$/gm) || []).length;
      assert.equal(await page.locator('[data-tex] .katex').count(), math, item.path);
      assert.equal(await page.locator('.mermaid svg').count(), (source.match(/```mermaid/g) || []).length, item.path);
      assert.equal(await page.locator('#sidebar .sidebar__nav .sidebar__link.is-active').count(), 1, item.path);
      const headings = (source.match(/^#{2,3} /gm) || []).length;
      assert.equal(await page.locator('#tocNav a').count(), headings >= 2 ? headings : 0, item.path);
      const href = p => '/distributed-storage-notes/' + p.path.replace(/README\.md$/, '').replace(/\.md$/, '/');
      const expectedPager = [pages[index - 1], pages[index + 1]].filter(Boolean).map(href);
      assert.deepEqual(await page.locator('.doc-pager a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), expectedPager, item.path + ': reading order');
      assert.equal(await page.locator('.doc-head__edit').getAttribute('href'), 'https://github.com/miauyle/distributed-storage-notes/edit/master/' + item.path);

    }
    report.checks.push('all 30 source documents: formula/diagram rendering, active sidebar, TOC, pager');
    await open('/docs/03-object-storage/03-read-write-path/');
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'read-write-desktop-light.png'), fullPage: true });
    const diagramBefore = await page.locator('.mermaid svg').first().getAttribute('id');
    await page.locator('#modeToggle').click();
    await page.waitForFunction(before => document.querySelector('.mermaid svg').id !== before, diagramBefore);
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'read-write-desktop-dark.png'), fullPage: true });
    report.checks.push('Mermaid rerenders after dark-mode toggle');
    await page.locator('#modeToggle').click();
    await page.setViewportSize({ width: 2560, height: 1440 });
    await open('/');
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'home-wide.png'), fullPage: true });
    const homeWidth = await page.locator('.knowledge-home').evaluate(node => node.getBoundingClientRect().width);
    assert.ok(homeWidth >= 1470 && homeWidth <= 1481, 'wide homepage uses desktop space');
    await open('/docs/03-object-storage/');
    assert.ok(await page.locator('.page-shell').evaluate(node => node.getBoundingClientRect().width >= 1600), 'wide documentation shell');
    assert.ok(await page.locator('#sidebar .sidebar__link').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 14.5), 'wide sidebar type is readable');
    assert.ok(await page.locator('.toc').evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 14.5), 'wide TOC type is readable');
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'doc-wide.png'), fullPage: true });
    assert.ok(await page.locator('html').evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 17), 'wide root font size');
    report.wide = await page.evaluate(homeWidth => ({ homeWidth, shellWidth: document.querySelector('.page-shell').getBoundingClientRect().width, rootFontSize: getComputedStyle(document.documentElement).fontSize, sidebarWidth: document.querySelector('#sidebar').getBoundingClientRect().width, tocWidth: document.querySelector('.toc').getBoundingClientRect().width, sidebarFontSize: getComputedStyle(document.querySelector('#sidebar .sidebar__link')).fontSize, tocFontSize: getComputedStyle(document.querySelector('.toc')).fontSize, measure: getComputedStyle(document.documentElement).getPropertyValue('--measure').trim() }), homeWidth);
    report.checks.push('2560px: wider shell/home and larger sidebar/TOC typography');
    await page.setViewportSize({ width: 390, height: 844 });
    await open('/');
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'home-mobile.png') });
    await page.locator('#sidebarToggle').click();
    assert.equal(await page.locator('#sidebarToggle').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#sidebarToggle').getAttribute('aria-expanded'), 'false');
    await open('/docs/03-object-storage/03-read-write-path/');
    await page.locator('.mobile-toc summary').click();
    const target = await page.locator('.mobile-toc a').first().getAttribute('href');
    await page.locator('.mobile-toc a').first().click();
    await page.waitForFunction(hash => decodeURIComponent(location.hash) === decodeURIComponent(hash), target);
    assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(target));
    assert.equal(await page.locator('.mobile-toc').getAttribute('open'), null);
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'read-write-mobile.png') });
    await page.locator('#sidebarToggle').click();
    await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'sidebar-mobile.png') });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 320, height: 720 });
    await open('/');
    await open('/docs/10-recovery-operations-observability/03-recovery-task-coordination/');
    for (const viewport of [{ width: 2560, height: 1440 }, { width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
      await page.setViewportSize(viewport);
      await open('/');
      const cols = await page.locator('.knowledge-groups').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
      assert.equal(cols, viewport.width <= 600 ? 1 : viewport.width <= 960 ? 2 : 3);
      for (const item of pages) await open('/' + item.path.replace(/README\.md$/, '').replace(/\.md$/, '/'));
      if (viewport.width < 600) {
        await page.locator('#sidebarToggle').click();
        assert.equal(await page.locator('#sidebarToggle').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape');
        await page.locator('.mobile-toc summary').click();
        await page.locator('.mobile-toc a').first().click();
        assert.equal(await page.locator('.mobile-toc').getAttribute('open'), null);
        await page.locator('[data-search-open]').first().click();
        await page.locator('#searchInput').fill('S3');
        await page.waitForFunction(() => document.querySelectorAll('.search-result').length > 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.keyboard.press('Escape');
        await page.screenshot({ animations: 'disabled', path: path.join(evidence, 'doc-' + viewport.width + '.png') });
      }
    }
    report.checks.push('all source documents: no overflow and local Mermaid at 2560, 1280, 390 and 320px');
    await open('/docs/03-object-storage/01-object-model/');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('.code-copy').first().click();
    await page.waitForFunction(() => document.querySelector('.code-copy.is-done'));
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Bucket: reports/);
    report.checks.push('code copy reaches clipboard');
    // Exercise local KaTeX without creating or changing a knowledge article.
    await page.addScriptTag({ url: root + '/assets/vendor/katex/katex.min.js' });
    await page.addStyleTag({ url: root + '/assets/vendor/katex/katex.min.css' });
    await page.evaluate(() => {
      const node = document.createElement('div'); node.className = 'math-display';
      document.querySelector('#doc-content').append(node);
      window.katex.render('N = k + m', node, { displayMode: true, throwOnError: true, trust: false });
    });
    assert.equal(await page.locator('.math-display .katex').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    report.checks.push('local KaTeX browser fixture; no formulas added to maintained content');
    report.checks.push('390px and 320px: no page overflow, home/doc drawer, mobile TOC');
    assert.deepEqual(report.errors, [], 'Browser console errors');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.errors.push(String(error.stack || error));
    throw error;
  } finally {
    fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
