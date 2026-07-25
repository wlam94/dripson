// Generates icon-192.png and icon-512.png using Playwright
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dir, '..', 'public');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0C0C0C"/>
  <!-- Gold accent bar top-left -->
  <rect x="60" y="60" width="6" height="80" rx="3" fill="#C5A028"/>
  <!-- Lettermark D -->
  <text
    x="264" y="358"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="310"
    font-weight="700"
    font-style="italic"
    text-anchor="middle"
    fill="#FFFFFF"
    letter-spacing="-8"
  >D</text>
  <!-- Gold underline accent -->
  <rect x="140" y="390" width="232" height="5" rx="2.5" fill="#C5A028"/>
</svg>
`;

const browser = await chromium.launch();
const page = await browser.newPage();

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${size}px;height:${size}px;overflow:hidden;background:#0C0C0C}
    svg{width:${size}px;height:${size}px;display:block}
  </style></head><body>${svg}</body></html>`);

  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
  const out = join(publicDir, `icon-${size}.png`);
  writeFileSync(out, buf);
  console.log(`✓ Generated public/icon-${size}.png`);
}

await browser.close();
console.log('Icons ready.');
