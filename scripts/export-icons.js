#!/usr/bin/env node
/**
 * Regenerates every app icon asset from the master SVG at assets/icon/icon.svg.
 *
 *   node scripts/export-icons.js
 *
 * The master has three flat top-level groups: #background, #wave and #lines. This script:
 *   1. writes them out as layer SVGs (assets/icon/*.svg and the iOS Icon Composer bundle
 *      assets/expo.icon/Assets/*.svg),
 *   2. rasterizes the PNGs in assets/images/ with headless Chromium (pixel-exact SVG rendering):
 *        icon.png                     1024, opaque, full bleed (iOS fallback, App Store, Android legacy)
 *        android-icon-background.png  1024, opaque, the pastel background
 *        android-icon-foreground.png  1024, transparent, mark inside the adaptive-icon safe zone
 *        android-icon-monochrome.png  1024, white mark on transparent (Android 13 themed icons)
 *        splash-icon.png              1024, transparent, mark only (drawn on white by expo-splash-screen)
 *        favicon.png                  48, rounded tile with an enlarged mark for browser tabs
 *
 * Needs Playwright with Chromium. Use a global install or a temporary one:
 *   npm i -g playwright && npx playwright install chromium
 * Set CHROMIUM_PATH to use a specific Chromium/Chrome binary instead of Playwright's own.
 *
 * Icon changes only reach the native apps after a rebuild: `npx expo prebuild --clean`
 * (or `npx expo run:ios|android`, or a new EAS build).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MASTER = path.join(ROOT, 'assets/icon/icon.svg');
const ICON_DIR = path.join(ROOT, 'assets/icon');
const IMAGES = path.join(ROOT, 'assets/images');
const COMPOSER_ASSETS = path.join(ROOT, 'assets/expo.icon/Assets');

/** Scale of the mark on the Android adaptive foreground. The mark's farthest point sits ~320 px
 *  from the center at 1.0; at 0.64 that is ~205 px, well inside the 66 dp safe circle
 *  (radius ~313 px of the 1024 px / 108 dp layer), and it reads about as large as on iOS. */
const ANDROID_MARK_SCALE = 0.64;
/** Square crop around the mark (216..808 x 302..722) used for the splash image. */
const SPLASH_VIEWBOX = '200 200 624 624';
/** The favicon is shown at 16-32 px, so the mark is enlarged on a rounded tile. */
const FAVICON_MARK_SCALE = 1.3;
const FAVICON_RADIUS = 220;

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    try {
      const globalRoot = execSync('npm root -g').toString().trim();
      return require(path.join(globalRoot, 'playwright'));
    } catch {
      console.error('Playwright not found. Install it with: npm i -g playwright && npx playwright install chromium');
      process.exit(1);
    }
  }
}

// ---- split the master into layers -------------------------------------------------------
const master = fs.readFileSync(MASTER, 'utf8');
const defs = (master.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0];
const groups = {};
for (const m of master.matchAll(/<g id="([\w-]+)"[^>]*>[\s\S]*?<\/g>/g)) groups[m[1]] = m[0];
for (const id of ['background', 'wave', 'lines']) {
  if (!groups[id]) throw new Error(`assets/icon/icon.svg is missing <g id="${id}">`);
}

const svg = (body, { viewBox = '0 0 1024 1024', withDefs = false } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewBox}">\n` +
  (withDefs ? `  ${defs}\n` : '') +
  `  ${body}\n</svg>\n`;

/** Re-colors every fill in a group (used for the single-color monochrome mark). */
const recolor = (group, color) => group.replace(/fill="#[0-9A-Fa-f]{3,8}"/g, `fill="${color}"`);

const layers = {
  background: svg(groups.background, { withDefs: true }),
  wave: svg(groups.wave),
  lines: svg(groups.lines),
  mark: svg(`${groups.wave}\n  ${groups.lines}`),
};
for (const [name, content] of Object.entries(layers)) {
  fs.writeFileSync(path.join(ICON_DIR, `${name}.svg`), content);
}
fs.mkdirSync(COMPOSER_ASSETS, { recursive: true });
fs.writeFileSync(path.join(COMPOSER_ASSETS, 'wave.svg'), layers.wave);
fs.writeFileSync(path.join(COMPOSER_ASSETS, 'lines.svg'), layers.lines);

// ---- rasterize ----------------------------------------------------------------------------
const dataUrl = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

/**
 * Renders stacked SVG layers to a PNG of `size` x `size`.
 * Each layer: { svg, scale = 1 } (scaled about the center).
 * `opaque` renders on white and yields an RGB PNG with no alpha channel.
 */
async function render(page, out, size, layerList, { opaque = false, radius = 0 } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const r = (radius * size) / 1024;
  const imgs = layerList
    .map(
      ({ svg: s, scale = 1 }) =>
        `<img src="${dataUrl(s)}" style="position:absolute;inset:0;width:${size}px;height:${size}px;transform:scale(${scale})">`,
    )
    .join('');
  await page.setContent(
    `<html><body style="margin:0;background:${opaque ? '#fff' : 'transparent'}">` +
      `<div style="position:relative;width:${size}px;height:${size}px;overflow:hidden;border-radius:${r}px">${imgs}</div>` +
      `</body></html>`,
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await page.screenshot({ path: out, omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.relative(ROOT, out));
}

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const img = (name) => path.join(IMAGES, name);

  await render(page, img('icon.png'), 1024, [{ svg: layers.background }, { svg: layers.mark }], { opaque: true });
  await render(page, img('android-icon-background.png'), 1024, [{ svg: layers.background }], { opaque: true });
  await render(page, img('android-icon-foreground.png'), 1024, [{ svg: layers.mark, scale: ANDROID_MARK_SCALE }]);
  await render(page, img('android-icon-monochrome.png'), 1024, [
    { svg: svg(`${recolor(groups.wave, '#FFFFFF')}\n  ${recolor(groups.lines, '#FFFFFF')}`), scale: ANDROID_MARK_SCALE },
  ]);
  await render(page, img('splash-icon.png'), 1024, [
    { svg: svg(`${groups.wave}\n  ${groups.lines}`, { viewBox: SPLASH_VIEWBOX }) },
  ]);
  await render(page, img('favicon.png'), 48, [{ svg: layers.background }, { svg: layers.mark, scale: FAVICON_MARK_SCALE }], {
    radius: FAVICON_RADIUS,
  });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
