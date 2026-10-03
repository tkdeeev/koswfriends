import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { seed } from "./fixtures";
import { closeDatabase, database } from "../../src/server/db";
import {
  calendarFeeds,
  feedSnapshots,
  snapshots,
  users,
} from "../../src/server/schema";
import { encrypt, hash } from "../../src/server/security";
import { externalUsername } from "../../src/server/username";
test.afterAll(closeDatabase);
test("alternative sign-in is accessible in every locale and fits narrow screens in both themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [locale, label] of [
    ["cs", "Přihlásit se jinak"],
    ["en", "Sign in another way"],
    ["uk", "Увійти іншим способом"],
  ]) {
    await page.addInitScript(
      (lang) => localStorage.setItem("kwf_locale", lang),
      locale,
    );
    await page.goto("/");
    // The stored key is shared with the rest of the app.
    await page.getByRole("button", { name: /^Language:/ }).click();
    await page
      .getByRole("menuitemradio", {
        name:
          locale === "cs"
            ? "Čeština"
            : locale === "en"
              ? "English"
              : "Українська",
      })
      .click();
    const toggle = page.getByRole("button", { name: label });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("link", { name: "Google", exact: true }),
    ).toHaveAttribute("href", "/auth/login?provider=google");
    await expect(
      page.getByRole("link", { name: "Discord", exact: true }),
    ).toHaveAttribute("href", "/auth/login?provider=discord");
    for (const width of [320, 517, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (value) => (document.documentElement.dataset.theme = value),
          theme,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(toggle).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Google", exact: true }),
        ).toBeVisible();
        if (locale === "cs" && width === 517 && theme === "dark") {
          const school = await page
            .getByRole("link", { name: /Přihlásit školním účtem/ })
            .boundingBox();
          const other = await toggle.boundingBox();
          expect(school!.y).toBe(other!.y);
          await page
            .locator('section[aria-labelledby="landing-title"]')
            .screenshot({ path: "test-results/alternative-login-cs.png" });
        }
      }
    }
  }
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/external-login.png",
    fullPage: true,
  });
});
test("external accounts can start without a calendar, see their tag and manage ICS subscriptions", async ({
  page,
  context,
}) => {
  const me = await seed(context, "Alexandra Smith");
  await database()
    .update(users)
    .set({
      accountType: "external",
      username: externalUsername("Alexandra Smith", true),
    })
    .where(eq(users.id, me.id));
  await database().delete(snapshots).where(eq(snapshots.userId, me.id));
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/?view=account");
  await expect(
    page.getByRole("heading", { name: "Alexandra Smith" }),
  ).toBeVisible();
  await expect(
    page.getByText("External account", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Reconnect your school account to import new lessons."),
  ).toHaveCount(0);
  const feeds = page.getByRole("region", { name: "ICS calendars" });
  await expect(
    feeds.getByText("No additional calendars yet. Importing is optional."),
  ).toBeVisible();
  await feeds.getByLabel("Calendar name", { exact: true }).fill("Campus");
  await feeds
    .getByLabel("ICS calendar URL", { exact: true })
    .fill("https://127.0.0.1/calendar.ics");
  await feeds
    .getByRole("button", { name: "Add calendar", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Internal addresses are blocked." }),
  ).toBeVisible();
  expect(
    await database()
      .select()
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, me.id)),
  ).toEqual([]);
  const [feed] = await database()
    .insert(calendarFeeds)
    .values({
      userId: me.id,
      name: "Synthetic university calendar",
      url: encrypt("https://university.example/feed?secret=synthetic"),
      urlHash: hash("synthetic-feed"),
    })
    .returning();
  await database().insert(feedSnapshots).values({
    feedId: feed.id,
    semester: me.semester,
    events: [],
    lastAttempt: new Date(),
    lastSuccess: new Date(),
  });
  await page.reload();
  await expect(
    feeds.getByText("Synthetic university calendar", { exact: true }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("secret=synthetic");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await feeds
    .getByRole("button", {
      name: "Remove calendar: Synthetic university calendar",
      exact: true,
    })
    .click();
  await expect(
    feeds.getByText("No additional calendars yet. Importing is optional."),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/external-account.png",
    fullPage: true,
  });
});
test("school accounts also receive optional ICS controls", async ({
  page,
  context,
}) => {
  await seed(context, "School Student");
  await page.goto("/?view=account");
  await expect(
    page.getByRole("region", { name: "ICS calendars" }),
  ).toBeVisible();
  await expect(page.getByText("External account", { exact: true })).toHaveCount(
    0,
  );
});
