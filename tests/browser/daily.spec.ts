import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { seed } from "./fixtures";
import { database, closeDatabase } from "../../src/server/db";
import { snapshots, users, grants, friendships } from "../../src/server/schema";
import { pair } from "../../src/server/friends";
import { currentSemester, semesterWindow } from "../../src/lib/calendar";
import type { Lesson } from "../../src/lib/types";
test.afterAll(closeDatabase);
// Mocked school/food endpoints must not be intercepted by the PWA worker.
test.use({ serviceWorkers: "block" });
test.setTimeout(45000);
test("next lesson, detailed classes and profiles stay compact and private on mobile", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const me = await seed(context, "Synthetic Student");
  const [friend] = await database()
    .insert(users)
    .values({
      username: `daily-friend-${me.id.slice(0, 8)}`,
      name: "Synthetic Friend",
      semester: currentSemester(),
    })
    .returning();
  const [a, b] = pair(me.id, friend.id);
  await database()
    .insert(friendships)
    .values({ a, b, requester: me.id, status: "accepted" });
  await database()
    .insert(grants)
    .values({ owner: friend.id, viewer: me.id, calendar: true, plans: false });
  const lesson: Lesson = {
    id: "daily-shared",
    course: "TEST-DAILY",
    title: { cs: "Testovací předmět", en: "Synthetic subject" },
    type: "tutorial",
    group: "101",
    room: "TEST-42",
    cancelled: false,
    start: new Date(Date.now() + 15 * 60000).toISOString(),
    end: new Date(Date.now() + 75 * 60000).toISOString(),
    capacity: 24,
    occupied: 18,
    sequence: 2,
    note: { cs: "Poznámka k výuce", en: "Bring your course materials" },
    teachers: [{ username: "teacher1", name: "Synthetic Teacher" }],
  };
  await database()
    .update(snapshots)
    .set({ events: [lesson] })
    .where(eq(snapshots.userId, me.id));
  await database()
    .insert(snapshots)
    .values({
      userId: friend.id,
      semester: currentSemester(),
      window: semesterWindow(currentSemester()),
      events: [lesson],
      lastSuccess: new Date(),
    });
  await page.route("**/api/course-search?**", (route) =>
    route.fulfill({
      json: { groups: [{ key: "tutorial:101", events: [lesson] }] },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Next lesson: TEST-DAILY", exact: true })
    .click();
  const detail = page.getByRole("dialog", { name: "TEST-DAILY", exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("18 / 24", { exact: true })).toBeVisible();
  await expect(
    detail.getByText("Bring your course materials", { exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("link", {
      name: "Synthetic Teacher · CTU profile & contacts",
    }),
  ).toHaveAttribute("href", "https://usermap.cvut.cz/profile/teacher1");
  await expect(detail.locator("details")).toHaveCount(0);
  await expect(detail.locator('[data-availability="soon"]')).toHaveCount(2);
  const explore = detail.getByRole("button", {
    name: "Explore other classes",
    exact: true,
  });
  await explore.click();
  const classes = page.getByRole("dialog", {
    name: "TEST-DAILY · Explore other classes",
    exact: true,
  });
  await expect(
    classes.getByRole("button", { name: "Exercise 101", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(classes.getByText("18 / 24", { exact: true })).toBeVisible();
  await expect(classes.locator("details")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(classes).toHaveCount(0);
  await expect(explore).toBeFocused();
  await detail
    .getByRole("button", {
      name: "Open profile: Synthetic Friend",
      exact: true,
    })
    .click();
  const profile = page.getByRole("dialog", {
    name: "Synthetic Friend",
    exact: true,
  });
  await expect(profile.getByText(/Starts in/)).toBeVisible();
  await expect(
    profile.getByText("Based on the shared timetable", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await profile.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await database()
    .update(grants)
    .set({ calendar: false })
    .where(eq(grants.owner, friend.id));
  await expect(
    profile.getByText("Timetable not shared", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(profile.getByRole("button", { name: /TEST-DAILY/ })).toHaveCount(
    0,
  );
  await expect(profile.locator("[data-availability]")).toHaveCount(0, {
    timeout: 20000,
  });
  await profile.getByRole("button", { name: "Close", exact: true }).click();
  await detail.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Food", exact: true }),
  ).toHaveCount(0);
  await page.goto("/?view=food");
  await expect(
    page.getByRole("heading", { name: "Food", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Official menus/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /planner/i }),
  ).toHaveCount(0);
});

test("food tab shows today's prices, allergens and empty states without overflowing", async ({
  page,
  context,
}) => {
  await seed(context);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route("**/api/menza?**", (route) =>
    route.fulfill({
      json: {
        configured: true,
        date: "2026-09-27",
        canteens: [{ id: 1, name: "Synthetic menza", isOpen: true }],
        selected: 1,
        categories: [{ id: 2, name: "Main dishes" }],
        meals: [
          {
            id: 3,
            categoryId: 2,
            name: "Synthetic meal with a long descriptive name",
            weight: "250 g",
            studentPrice: "0.00",
            price: null,
            allergens: [1],
            hasPhoto: true,
          },
          {
            id: 4,
            categoryId: 2,
            name: "Unavailable image",
            weight: "200 g",
            studentPrice: "79.00",
            price: "95.00",
            allergens: [],
            hasPhoto: true,
          },
          {
            id: 5,
            categoryId: 2,
            name: "Text-only meal",
            weight: "200 g",
            studentPrice: "85.00",
            price: "99.00",
            allergens: [],
            hasPhoto: false,
          },
        ],
        allergens: [{ id: 1, name: "Gluten" }],
        hours: [],
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  const photo = await sharp({
    create: { width: 600, height: 400, channels: 3, background: "#618945" },
  })
    .webp()
    .toBuffer();
  await page.route("**/api/menza/photo?**", (route) =>
    new URL(route.request().url()).searchParams.get("meal") === "4"
      ? route.fulfill({ status: 404, json: { error: "not_found" } })
      : route.fulfill({ contentType: "image/webp", body: photo }),
  );
  await page.goto("/?view=food");
  await expect(
    page.getByRole("heading", { name: "Main dishes", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 Kč", { exact: true })).toBeVisible();
  const thumbnail = page.getByRole("button", {
    name: "View photo: Synthetic meal with a long descriptive name",
    exact: true,
  });
  await expect(thumbnail.locator("img")).toHaveJSProperty("naturalWidth", 600);
  await thumbnail.click();
  const photoDialog = page.getByRole("dialog", {
    name: "Synthetic meal with a long descriptive name",
    exact: true,
  });
  await expect(photoDialog.getByRole("img")).toBeVisible();
  expect(
    await photoDialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(photoDialog).toHaveCount(0);
  await expect(thumbnail).toBeFocused();
  await page
    .getByRole("heading", { name: "Unavailable image", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", {
      name: "View photo: Unavailable image",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "View photo: Text-only meal",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Text-only meal", exact: true }),
  ).toBeVisible();
  await page.getByText("Allergens: 1", { exact: true }).click();
  await expect(page.getByText("1 · Gluten", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
