// Render public/icon.svg to the PNG sizes the PWA manifest and iOS need.
(async () => {
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/${name}` });
  await page.close();
}
await browser.close();
})();
