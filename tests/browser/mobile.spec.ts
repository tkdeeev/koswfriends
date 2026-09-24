import { test, expect } from "@playwright/test";
import { closeDatabase } from "../../src/server/db";
import { seed } from "./fixtures";
import { DateTime } from "luxon";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
test.afterAll(closeDatabase);

test("mobile navigation, sharing controls and personal event editing fit small screens", async ({
  page,
  context,
  browserName,
}) => {
  await seed(context);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Timetable", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "KOS++", exact: true }),
  ).toBeVisible();
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  await expect(filters).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /^Thu/ }).tap();
  await page.getByRole("button", { name: /09:00.*TEST-MAT/ }).tap();
  await expect(
    page.getByRole("dialog", { name: "TEST-MAT", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await filters.tap();
  await page
    .getByRole("button", { name: "Personal subjects and events", exact: true })
    .tap();
  const editor = page.locator("dialog[open]");
  await editor.getByLabel("Course code", { exact: true }).fill("TV1-PE");
  await editor
    .getByLabel("Event name", { exact: true })
    .fill("Mobile swimming");
  const eventDay = DateTime.now()
    .setZone("Europe/Prague")
    .plus({ days: 1 })
    .toISODate();
  await editor.getByLabel("Starts", { exact: true }).fill(`${eventDay}T15:00`);
  await editor.getByLabel("Ends", { exact: true }).fill(`${eventDay}T16:00`);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await editor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await editor.getByRole("button", { name: "Save event", exact: true }).tap();
  await expect(editor).not.toBeVisible();
  await page
    .getByRole("button", { name: "Personal subjects and events", exact: true })
    .tap();
  await expect(editor.getByRole("button", { name: /TV1-PE/ })).toBeVisible();
  await editor.getByRole("button", { name: "Close", exact: true }).tap();
  for (const tab of ["Friends", "Groups", "Semester planner", "Timetable"]) {
    const button = page.getByRole("button", { name: tab, exact: true });
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(721);
    await button.tap();
    await expect(
      page.getByRole("heading", { level: 1, name: tab, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Groups", exact: true }).tap();
  await page.getByLabel("Group name", { exact: true }).fill("Mobile group");
  await page.getByRole("button", { name: "Create group", exact: true }).tap();
  await expect(
    page.getByRole("heading", { name: "Mobile group", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Applies to current and future accepted members|Each person chooses independently/,
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Dark mode", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Groups", exact: true }),
  ).toHaveCSS("background-color", "rgb(22, 56, 76)");
  await page.screenshot({
    path: `test-results/mobile-groups-${browserName}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("PWA metadata, install guidance and private offline fallback", async ({
  page,
  context,
  browserName,
}) => {
  await seed(context);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Timetable", exact: true }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest).toMatchObject({
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toContain(
    "192x192",
  );
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    const bytes = await response.body();
    const size = Number(icon.sizes.split("x")[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/apple-touch-icon.png",
  );
  const worker = await page.request.get("/sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  await page.getByRole("button", { name: "Install app", exact: true }).tap();
  await expect(
    page.getByRole("dialog", { name: "Install app", exact: true }),
  ).toBeVisible();
  if (browserName === "webkit")
    await expect(page.getByText(/In Safari, choose Share/)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    return (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cached.sort()).toEqual(
    [
      "/offline.html",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/maskable-512.png",
      "/icons/apple-touch-icon.png",
    ].sort(),
  );
  // WebKit's offline flag blocks even literal service-worker responses:
  // https://github.com/microsoft/playwright/issues/42775
  // The origin-loss test below exercises its actual worker fallback instead.
  if (browserName === "chromium") {
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Offline", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("TEST-MAT")).toHaveCount(0);
    await page.screenshot({ path: `test-results/offline-${browserName}.png` });
    await context.setOffline(false);
    await page
      .getByRole("heading", { name: "Timetable", exact: true })
      .waitFor();
  }
});

test("the real service worker serves its fallback when the origin is unavailable", async ({
  page,
  browserName,
}) => {
  const files = new Map<string, Buffer>();
  for (const path of [
    "sw.js",
    "offline.html",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/maskable-512.png",
    "icons/apple-touch-icon.png",
  ]) {
    files.set(`/${path}`, await readFile(`public/${path}`));
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    response.setHeader(
      "Content-Type",
      path.endsWith(".js")
        ? "text/javascript"
        : path.endsWith(".png")
          ? "image/png"
          : "text/html",
    );
    response.end(
      files.get(path) ||
        '<h1>Online</h1><script>navigator.serviceWorker.register("/sw.js")</script>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const stop = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await stop();
    const response = await page.reload();
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Offline", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/origin-offline-${browserName}.png`,
    });
    await new Promise<void>((resolve) =>
      server.listen(port, "127.0.0.1", resolve),
    );
    await page.getByRole("button", { name: "Try again", exact: true }).tap();
    await expect(
      page.getByRole("heading", { name: "Online", exact: true }),
    ).toBeVisible();
  } finally {
    await stop();
  }
});
