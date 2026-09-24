import { chromium } from "playwright";
import { readFile, mkdir, copyFile } from "node:fs/promises";

// Render the supplied vector artwork at the platform icon sizes. Keep its
// original paths and give maskable icons enough space for circular cropping.
const svg = await readFile("public/logo.svg", "utf8");
await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, scale] of [
    ["icon-192", 192, 0.875],
    ["icon-512", 512, 0.875],
    ["apple-touch-icon", 180, 0.875],
    ["maskable-512", 512, 0.6875],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0;background:#172d3b;display:grid;place-items:center;height:100vh}svg{width:${size * scale}px;height:${size * scale}px}</style>${svg}`,
    );
    await page.screenshot({ path: `public/icons/${name}.png` });
  }
  await copyFile("public/icons/icon-512.png", "src/app/icon.png");
} finally {
  await browser.close();
}
