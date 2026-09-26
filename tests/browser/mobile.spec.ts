import { test, expect } from "@playwright/test";
import { database, closeDatabase } from "../../src/server/db";
import { seed } from "./fixtures";
import { connections, addConnection, expand } from "./connections-helpers";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import {
  users,
  groups,
  members,
  snapshots,
  personalEvents,
} from "../../src/server/schema";
import { requestFriend } from "../../src/server/friends";
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
  for (const tab of ["Connections", "Semester planner", "Timetable"]) {
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
  await connections(page, "Groups");
  await addConnection(page, "Groups");
  await page.getByLabel("Group name", { exact: true }).fill("Mobile group");
  await page.getByRole("button", { name: "Create group", exact: true }).tap();
  await expect(
    page.getByRole("region", { name: "Mobile group", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Applies to current and future accepted members|Each person chooses independently/,
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Dark mode", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Connections", exact: true }),
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

test("connections use names, compact expandable rows, a single add dialog and mobile switches", async ({
  page,
  context,
  browser,
  browserName,
}) => {
  const a = await seed(context, "Demo Student");
  const other = await browser.newContext();
  const b = await seed(other, "Jana Nováková");
  await requestFriend(b.id, a.id, { calendar: true, plans: false });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await connections(page, "Friends");
  const friends = page.getByRole("region", { name: "Friends", exact: true });
  const groups = page.getByRole("region", { name: "Groups", exact: true });
  await expect(groups).toBeVisible();
  const fb = await friends.boundingBox(),
    gb = await groups.boundingBox();
  expect(Math.abs(fb!.width - gb!.width)).toBeLessThan(1);
  expect(fb!.y).toBe(gb!.y);
  const row = friends.locator("article");
  const summary = row.locator("summary");
  await expect(summary).toHaveText(/Jana Nováková/);
  await expect(summary).not.toContainText(b.username);
  await expect(summary.locator('[class*="profileAvatar"]')).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Accept", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByLabel("School username", { exact: true }),
  ).not.toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  await row.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Save sharing", exact: true }),
  ).toBeVisible();
  await row.getByLabel("My semester drafts", { exact: true }).check();
  await database()
    .update(users)
    .set({ name: "Jana Nováková Dvořáková" })
    .where(eq(users.id, b.id));
  await expect(summary).toContainText("Jana Nováková Dvořáková", {
    timeout: 15000,
  });
  await expect(
    row.getByLabel("My semester drafts", { exact: true }),
  ).toBeChecked();
  await summary.click();
  await page.screenshot({
    path: `test-results/connections-desktop-${browserName}.png`,
    fullPage: true,
  });
  const add = await addConnection(page, "Groups");
  await add.getByLabel("Group name", { exact: true }).fill("Study crew");
  await add.getByRole("button", { name: "Create group", exact: true }).click();
  await expect(add).not.toBeVisible();
  const group = page.getByRole("region", { name: "Study crew", exact: true });
  await expect(
    group.getByRole("button", { name: "Save sharing", exact: true }),
  ).not.toBeVisible();
  await expand(group);
  await group.getByLabel("School username", { exact: true }).fill(b.username);
  await group
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  await expect(group.locator("article > details > summary")).toContainText(
    "Jana Nováková Dvořáková",
  );
  await group.locator(":scope > details > summary").click();
  await page.setViewportSize({ width: 320, height: 720 });
  const switcher = page.getByRole("group", {
    name: "Connections",
    exact: true,
  });
  await expect(switcher).toBeVisible();
  await expect(groups).toBeVisible();
  await expect(friends).not.toBeVisible();
  await switcher.getByRole("button", { name: "Friends", exact: true }).tap();
  await expect(friends).toBeVisible();
  await expect(groups).not.toBeVisible();
  const theme = page.getByRole("button", { name: "Dark mode", exact: true });
  await expect(theme.locator("svg")).toHaveCount(1);
  await expect(theme).toHaveText("");
  await theme.tap();
  await page.screenshot({
    path: `test-results/connections-mobile-${browserName}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await addConnection(page, "Friends");
  await add.getByLabel("School username", { exact: true }).fill("missing-user");
  await add.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(add.getByRole("alert")).toBeVisible();
  expect(await add.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await add.getByLabel("School username", { exact: true }).fill("draft-name");
  await add.getByRole("button", { name: "Groups", exact: true }).tap();
  await add.getByRole("button", { name: "Friends", exact: true }).tap();
  await expect(add.getByLabel("School username", { exact: true })).toHaveValue(
    "draft-name",
  );
  await page.keyboard.press("Escape");
  await expect(add).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add connection", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await other.close();
});

test("mobile time lanes preserve gaps, default to own lessons and compare friends without self", async ({
  page,
  context,
  browser,
  browserName,
}) => {
  const a = await seed(context, "Demo Student");
  const second = await browser.newContext();
  try {
    const b = await seed(second, "Demo Friend One"),
      c = await seed(second, "Demo Friend Two");
    const [group] = await database()
      .insert(groups)
      .values({ owner: a.id, name: "Lane comparison" })
      .returning();
    await database()
      .insert(members)
      .values(
        [a, b, c].map((u) => ({
          groupId: group.id,
          userId: u.id,
          status: "accepted" as const,
          calendar: true,
          plans: false,
        })),
      );
    const [snapshot] = await database()
      .select()
      .from(snapshots)
      .where(eq(snapshots.userId, a.id));
    const common = snapshot.events[0];
    const start = DateTime.fromISO(common.start);
    await database()
      .update(snapshots)
      .set({ events: [common] })
      .where(eq(snapshots.userId, a.id));
    await database()
      .insert(personalEvents)
      .values({
        owner: a.id,
        semester: a.semester,
        details: {
          course: "TV1-PE",
          title: "Swimming",
          start: start.plus({ hours: 2 }).toISO()!,
          end: start.plus({ hours: 3 }).toISO()!,
          room: "Pool",
          color: "#158b98",
          note: "",
          repeatUntil: null,
        },
      });
    for (const [i, user] of [b, c].entries()) {
      await database()
        .update(snapshots)
        .set({
          events: [
            common,
            {
              ...common,
              id: `lane-friend-${i}`,
              course: `FRIEND-${i}`,
              start: start.plus({ minutes: 90 }).toISO()!,
              end: start.plus({ hours: 4 }).toISO()!,
            },
          ],
        })
        .where(eq(snapshots.userId, user.id));
    }
    await page.goto("/");
    await page.getByRole("button", { name: /^Thu/ }).tap();
    const grid = page.getByRole("region", {
      name: "Compare timetables",
      exact: true,
    });
    const own = grid.locator(`[data-person-lane="${a.id}"]`);
    const card = grid.getByRole("button", { name: /TEST-MAT/ });
    await expect(card).toBeVisible();
    await expect(card.locator('[class*="profileAvatar"]')).toHaveCount(2);
    await expect(grid.locator("[data-person-lane]")).toHaveCount(1);
    await expect(grid.getByRole("button", { name: /FRIEND-/ })).toHaveCount(0);
    const personal = grid.getByRole("button", { name: /TV1-PE/ });
    const firstRect = await card.boundingBox(),
      nextRect = await personal.boundingBox();
    expect(nextRect!.y - firstRect!.y).toBeCloseTo(120 * 1.4, 0);
    expect(firstRect!.height).toBeCloseTo(90 * 1.4 - 3, 0);
    expect(nextRect!.y - firstRect!.y - firstRect!.height).toBeGreaterThan(40);
    // This DB-only fixture has no school token and correctly shows a reconnect banner.
    const bannersHeight = await page
      .locator('main [class*="banner"]')
      .evaluateAll((nodes) =>
        nodes.reduce(
          (sum, node) =>
            sum +
            node.getBoundingClientRect().height +
            parseFloat(getComputedStyle(node).marginBottom),
          0,
        ),
      );
    expect((await grid.boundingBox())!.y - bannersHeight).toBeLessThan(250);
    const nav = page.getByRole("navigation", { name: "Navigation" });
    const navRect = await nav.boundingBox();
    expect(navRect!.y + navRect!.height).toBe(page.viewportSize()!.height);
    await expect(nav.locator("button svg")).toHaveCount(3);
    const filters = page.getByRole("button", { name: "Filters", exact: true });
    const iconBounds = await filters.evaluate((el) => {
      const button = el.getBoundingClientRect(),
        icon = el.querySelector("svg")!.getBoundingClientRect();
      return {
        offset: Math.abs(
          button.x + button.width / 2 - (icon.x + icon.width / 2),
        ),
        left: icon.x - button.x,
        right: button.right - icon.right,
      };
    });
    expect(iconBounds.offset).toBeLessThan(1);
    expect(Math.min(iconBounds.left, iconBounds.right)).toBeGreaterThanOrEqual(
      8,
    );
    await filters.tap();
    const all = page.getByRole("checkbox", {
      name: "All friends",
      exact: true,
    });
    await expect(all).not.toBeChecked();
    await all.check();
    await filters.tap();
    await expect(grid.locator("[data-person-lane]")).toHaveCount(3);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-lane-span", "3");
    await expect(card.getByText("Together · 3", { exact: true })).toBeVisible();
    const joinedBounds = await card.boundingBox();
    const allLaneBounds = await grid
      .locator("[data-person-lane]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().width),
      );
    expect(joinedBounds!.width).toBeCloseTo(
      allLaneBounds.reduce((sum, width) => sum + width, 0) - 6,
      0,
    );
    await expect(grid.getByRole("button", { name: /FRIEND-0/ })).toHaveCount(1);
    expect(await grid.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Wide shared cards keep their title and people visible while comparing later columns.
    await page.setViewportSize({ width: 320, height: 844 });
    await grid.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(card).toHaveAttribute("data-clipped-left", "true");
    await expect(card).toHaveAttribute("data-clipped-right", "false");
    expect(
      await card.evaluate(
        (el) => getComputedStyle(el, "::before").borderLeftStyle,
      ),
    ).toBe("dashed");
    await expect(card).toHaveCSS("border-right-style", "solid");
    const sharedTitle = await card.locator("b").boundingBox();
    expect(sharedTitle!.x).toBeGreaterThanOrEqual(
      (await grid.boundingBox())!.x + 40,
    );
    expect(sharedTitle!.x + sharedTitle!.width).toBeLessThanOrEqual(320);
    await grid.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await expect(card).toHaveAttribute("data-clipped-left", "false");
    await expect(card).toHaveAttribute("data-clipped-right", "true");
    await expect(card).toHaveCSS("border-left-style", "solid");
    expect(
      await card.evaluate(
        (el) => getComputedStyle(el, "::after").borderRightStyle,
      ),
    ).toBe("dashed");
    // Own personal events remain left of an earlier friend's lesson on desktop too.
    await page.setViewportSize({ width: 1440, height: 1000 });
    const desktop = page.locator('[class*="calendarFrame"]');
    const personalRect = await desktop
      .getByRole("button", { name: /TV1-PE/ })
      .boundingBox();
    const friendRect = await desktop
      .getByRole("button", { name: /FRIEND-0/ })
      .boundingBox();
    expect(personalRect!.x).toBeLessThan(friendRect!.x);
    await expect(desktop.locator('[class*="lessonOwner"]')).toHaveCount(0);
    await expect(desktop.getByRole("button", { name: /FRIEND-0/ })).toHaveCSS(
      "border-left-style",
      "solid",
    );
    await page.setViewportSize({ width: 320, height: 844 });
    await filters.tap();
    await page
      .getByRole("checkbox", { name: "Your timetable", exact: true })
      .uncheck();
    await filters.tap();
    await expect(own).toHaveCount(0);
    await expect(grid.getByRole("button", { name: /TV1-PE/ })).toHaveCount(0);
    await expect(grid.locator("[data-person-lane]")).toHaveCount(2);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-lane-span", "2");
    await expect(card.locator('[class*="profileAvatar"]')).toHaveCount(2);
    await expect(card).toHaveAccessibleName(
      /Together.*Demo Friend One.*Demo Friend Two/,
    );
    const laneRects = await grid
      .locator("[data-person-lane]")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          x: node.getBoundingClientRect().x,
          width: node.getBoundingClientRect().width,
        })),
      );
    expect(laneRects[0].width).toBeCloseTo(laneRects[1].width, 0);
    expect(laneRects[1].x + laneRects[1].width).toBeLessThanOrEqual(320);
    const sameTime = await grid
      .getByRole("button", { name: /FRIEND-/ })
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().y),
      );
    expect(sameTime[0]).toBe(sameTime[1]);
    for (const theme of ["dark", "light"]) {
      const toggle = page.getByRole("button", {
        name: "Dark mode",
        exact: true,
      });
      if (
        (await toggle.getAttribute("aria-pressed")) !== String(theme === "dark")
      )
        await toggle.tap();
      await expect(grid.getByRole("button", { name: /FRIEND-0/ })).toHaveCSS(
        "border-top-style",
        "dashed",
      );
      await page.screenshot({
        path: `test-results/time-lanes-${theme}-${browserName}.png`,
        animations: "disabled",
      });
    }
    // Shared-only still compares the two selected friends while self is hidden.
    await filters.tap();
    await page
      .getByRole("checkbox", { name: "Shared lessons only", exact: true })
      .check();
    await filters.tap();
    await expect(grid.getByRole("button", { name: /FRIEND-/ })).toHaveCount(0);
    await expect(grid.getByRole("button", { name: /TEST-MAT/ })).toHaveCount(1);
    await grid
      .getByRole("button", { name: /TEST-MAT/ })
      .first()
      .tap();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await database()
      .update(members)
      .set({ calendar: false })
      .where(eq(members.userId, b.id));
    await expect(grid.locator(`[data-person-lane="${b.id}"]`)).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.reload();
    await expect(grid.locator("[data-person-lane]")).toHaveCount(1);
    await expect(own).toBeVisible();
  } finally {
    await second.close();
  }
});

test("single-day layouts persist across mobile and desktop with Ukrainian controls and source titles", async ({
  page,
  context,
  browserName,
}) => {
  await seed(context, "Demo Student");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Thu/ }).click();
  const people = page.locator('[data-layout="people"]');
  const lessons = page.locator('[data-layout="lessons"]');
  const filters = page.getByRole("button", { name: "Filters", exact: true });
  await expect(people).toBeVisible();
  const days = page.locator('[class*="dayPicker"] button');
  const heights = await days.evaluateAll((nodes) =>
    nodes.map((el) => el.getBoundingClientRect().height),
  );
  expect(Math.max(...heights)).toBeLessThanOrEqual(36);
  await filters.click();
  await expect(
    page.getByRole("radio", { name: "By person", exact: true }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "By lesson", exact: true }).check();
  await filters.click();
  await expect(people).toHaveCount(0);
  await expect(lessons).toBeVisible();
  await expect(lessons.locator("[data-day-column]")).toHaveCount(1);
  const mat = lessons.getByRole("button", { name: /TEST-MAT/ });
  const prg = lessons.getByRole("button", { name: /TEST-PRG/ });
  expect(
    (await prg.boundingBox())!.y - (await mat.boundingBox())!.y,
  ).toBeCloseTo(45 * 1.4, 0);
  await page.reload();
  await page.getByRole("button", { name: /^Thu/ }).click();
  await expect(lessons).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(lessons.locator("[data-day-column]")).toHaveCount(5);
  await expect(
    page.getByRole("radio", { name: "By person", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Expand day: Thursday/ }).click();
  await page.getByRole("radio", { name: "By person", exact: true }).check();
  await expect(people).toBeVisible();
  await expect(people.getByRole("button", { name: /TEST-MAT/ })).toBeVisible();
  await page.getByRole("button", { name: "Back to week", exact: true }).click();
  await expect(people).toHaveCount(0);
  await expect(lessons.locator("[data-day-column]")).toHaveCount(5);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "UA", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(
    page.getByRole("heading", { name: "Розклад", exact: true }),
  ).toBeVisible();
  await expect(people).toBeVisible();
  await page.getByRole("button", { name: /^чт/i }).click();
  await people.getByRole("button", { name: /TEST-MAT/ }).click();
  const dialog = page.locator("dialog[open]");
  await expect(
    dialog.getByText("Практичне заняття", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Illustrative mathematics",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрити", exact: true }).click();
  await page.getByRole("button", { name: "Фільтри", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "За людьми", exact: true }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "За заняттями", exact: true }).check();
  await page
    .getByRole("button", { name: "Власні предмети та події", exact: true })
    .click();
  await expect(dialog.getByLabel("Назва події", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Закрити", exact: true }).click();
  await page.getByRole("button", { name: "Фільтри", exact: true }).click();
  await page.getByRole("button", { name: "Контакти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Контакти", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Друзі", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "План семестру", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "План семестру", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Розклад", exact: true }),
  ).toBeVisible();
  await expect(lessons).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/uk-layout-${browserName}.png`,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
