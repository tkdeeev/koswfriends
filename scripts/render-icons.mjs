import { chromium } from "playwright";
import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";

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

  // Browser tabs need small icons and the conventional /favicon.ico fallback.
  // Keep the supplied artwork, with less padding at these small sizes.
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0;background:#172d3b;display:grid;place-items:center;height:100vh}svg{width:${size}px;height:${size}px}</style>${svg}`,
    );
    const png = await page.screenshot();
    images.push(png);
    if (size === 32) await writeFile("public/icons/favicon-32.png", png);
  }
  // ICO directory with one PNG-encoded, 32-bit image per size.
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  for (const [index, size] of sizes.entries()) {
    const entry = 6 + index * 16;
    directory[entry] = size;
    directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(images[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  }
  await writeFile("public/favicon.ico", Buffer.concat([directory, ...images]));
} finally {
  await browser.close();
}
