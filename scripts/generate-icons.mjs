// Draws the dsarecx app icons ("d." in Instrument Serif italic with the ember dot)
// and writes every size the site, browsers and installed app need into public/.
// Run: node scripts/generate-icons.mjs   (needs Microsoft Edge or Chrome installed)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public');
const INK = '#161311';
const PAPER = '#f0ebe1';
const EMBER = '#ff6a1f';

// scale < 1 shrinks the mark so it survives the circle/squircle crop of "maskable" icons.
const html = (size, scale = 1) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:${size}px;height:${size}px;background:${INK};overflow:hidden}
  .wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .mark{position:relative;transform:scale(${scale});display:flex;align-items:baseline}
  .d{font-family:'Instrument Serif',serif;font-style:italic;color:${PAPER};font-size:${size * 0.78}px;line-height:1;
     letter-spacing:-0.02em;transform:translate(-${size * 0.03}px, -${size * 0.035}px)}
  .dot{width:${size * 0.13}px;height:${size * 0.13}px;border-radius:50%;background:${EMBER};
       margin-left:${size * 0.005}px;transform:translateY(-${size * 0.1}px)}
</style></head><body><div class="wrap"><div class="mark"><span class="d">d</span><span class="dot"></span></div></div></body></html>`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage();

async function render(size, scale) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, scale), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: 'png', omitBackground: false });
}

const files = {
  'icon-512.png': [512, 1],
  'icon-192.png': [192, 1],
  'icon-maskable-512.png': [512, 0.8],
  'apple-touch-icon.png': [180, 0.9],
  'icon-48.png': [48, 1],
  'icon.png': [32, 1],
};
const pngs = {};
for (const [name, [size, scale]] of Object.entries(files)) {
  pngs[name] = await render(size, scale);
  fs.writeFileSync(path.join(OUT, name), pngs[name]);
  console.log('wrote', name);
}

// favicon.ico holding 16, 32 and 48 px PNGs.
const icoImages = [await render(16, 1), pngs['icon.png'], pngs['icon-48.png']];
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + 16 * icoImages.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach((img, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(sizes[i], e);
  header.writeUInt8(sizes[i], e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([header, ...icoImages]));
console.log('wrote favicon.ico');

await browser.close();
