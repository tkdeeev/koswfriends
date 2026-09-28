import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { DateTime } from "luxon";
import { seed } from "./fixtures";
import { closeDatabase } from "../../src/server/db";

test.afterAll(closeDatabase);

test("social crawlers receive public friend and group preview cards without running JavaScript", async ({
  request,
}) => {
  for (const bot of [
    "Discordbot/2.0",
    "TelegramBot",
    "facebookexternalhit/1.1",
  ]) {
    for (const kind of ["friend", "group"]) {
      const response = await request.get(
        `/invite/${kind}?invite=${"s".repeat(43)}`,
        { headers: { "User-Agent": bot } },
      );
      expect(response.status()).toBe(200);
      const head = (await response.text()).split("</head>")[0];
      expect(head).toContain(
        `property="og:title" content="${kind === "friend" ? "Friend" : "Group"} invitation`,
      );
      expect(head).toContain(`https://kos.deeev.cz/social/${kind}.png`);
      expect(head).toContain(
        'name="twitter:card" content="summary_large_image"',
      );
      expect(head).not.toContain("s".repeat(43));
      expect(head).toContain('property="og:image:width" content="1200"');
    }
  }
  for (const kind of ["home", "friend", "group"]) {
    const image = await request.get(`/social/${kind}.png`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    expect(await sharp(await image.body()).metadata()).toMatchObject({
      width: 1200,
      height: 630,
    });
  }
});

test("flag dropdown is compact, keyboard accessible and persists the choice", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /^Language:/ });
  await expect(trigger).toHaveAccessibleName("Language: English");
  await expect(trigger).toHaveText("");
  await expect(
    page.getByRole("heading", { name: "Timetables with friends" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your university week" }),
  ).toBeVisible();
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "English" }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.reload();
  await expect(trigger).toHaveAccessibleName("Language: Українська");
  await trigger.click();
  await page.locator("h1").click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await trigger.focus();
  await trigger.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("picture upload, replacement and removal work on a narrow screen with fallback initials", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(context, "Demo Student");
  await page.goto("/?view=account");
  const editor = page.getByRole("region", { name: "Profile picture" });
  const upload = editor.getByLabel("Upload picture", { exact: true });
  const makePhoto = (background: string) =>
    sharp({ create: { width: 300, height: 400, channels: 3, background } })
      .png()
      .toBuffer();
  await upload.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: await makePhoto("#3569a1"),
  });
  await expect(
    editor.getByRole("button", { name: "Remove picture" }),
  ).toBeVisible();
  const image = editor.locator("img");
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(256);
  const first = await image.getAttribute("src");
  await expect(page.locator("header img")).toHaveAttribute("src", first!);
  await upload.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: await makePhoto("#986133"),
  });
  await expect(image).not.toHaveAttribute("src", first!);
  await expect(editor).toHaveAttribute("aria-busy", "false");
  await page.reload();
  await expect(
    editor.getByRole("button", { name: "Remove picture" }),
  ).toBeVisible();
  await upload.setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid file"),
  });
  await expect(editor.getByRole("alert")).toContainText("valid, still JPG");
  await expect(image).toHaveCount(1);
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/profile-mobile-dark.png",
    fullPage: true,
  });
  await editor.getByRole("button", { name: "Remove picture" }).click();
  await expect(image).toHaveCount(0);
  await expect(editor.getByText("DS", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    editor.getByRole("button", { name: "Remove picture" }),
  ).toHaveCount(0);
});

test("month and year, navigation and quick controls stay on one row on small phones", async ({
  page,
  context,
}) => {
  await seed(context);
  await page.goto("/");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 740 });
    await expect(
      page.getByRole("group", { name: "Timetable controls" }),
    ).toBeVisible();
    const today = page.getByRole("button", { name: "Today", exact: true });
    const month = DateTime.now()
      .setZone("Europe/Prague")
      .startOf("week")
      .setLocale("en")
      .toFormat("LLL yy");
    const label = page.getByRole("heading", { name: month, exact: true });
    await expect(label).toBeVisible();
    const buttons = [
      page.getByRole("button", { name: "Previous", exact: true }),
      today,
      page.getByRole("button", { name: "Next", exact: true }),
      page.getByRole("button", { name: "Filters", exact: true }),
    ];
    const boxes = await Promise.all(
      [label, ...buttons].map((item) => item.boundingBox()),
    );
    const center = boxes[0]!.y + boxes[0]!.height / 2;
    for (const box of boxes.slice(1))
      expect(Math.abs(box!.y + box!.height / 2 - center)).toBeLessThanOrEqual(
        1,
      );
    expect(boxes[1]!.width).toBe(boxes[2]!.width);
    expect(boxes[1]!.height).toBe(boxes[2]!.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/compact-timetable-mobile.png",
    fullPage: true,
  });
});
