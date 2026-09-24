import { test, expect, type BrowserContext } from "@playwright/test";
import { DateTime } from "luxon";
import { database, closeDatabase } from "../../src/server/db";
import { users, sessions, snapshots, plans } from "../../src/server/schema";
import { hash } from "../../src/server/security";
import { currentSemester, semesterWindow, ZONE } from "../../src/lib/calendar";
import type { Lesson } from "../../src/lib/types";
if (process.env.KWF_TEST_DATABASE !== "yes")
  throw new Error("Only synthetic test databases are allowed");
let sequence = 0;
async function seed(context: BrowserContext) {
  const username = `synthetic-${process.pid}-${++sequence}`;
  const semester = currentSemester();
  const [user] = await database()
    .insert(users)
    .values({ username, name: username, semester })
    .returning();
  const token = `synthetic-session-${username}`;
  await database()
    .insert(sessions)
    .values({
      userId: user.id,
      hash: hash(token),
      csrf: `synthetic-csrf-${username}`,
      expiresAt: new Date(Date.now() + 3600000),
    });
  const start = DateTime.now()
    .setZone(ZONE)
    .startOf("week")
    .plus({ days: 3, hours: 9 });
  const lesson: Lesson = {
    id: "synthetic-common-1",
    course: "TEST-MAT",
    title: { cs: "Ilustrační matematika", en: "Illustrative mathematics" },
    group: "101",
    type: "tutorial",
    start: start.toISO()!,
    end: start.plus({ minutes: 90 }).toISO()!,
    room: "TEST-101",
    cancelled: false,
  };
  await database()
    .insert(snapshots)
    .values({
      userId: user.id,
      semester,
      window: { ...semesterWindow(semester), verified: true },
      events: [
        lesson,
        {
          ...lesson,
          id: "synthetic-overlap",
          course: "TEST-PRG",
          start: start.plus({ minutes: 45 }).toISO()!,
          end: start.plus({ minutes: 135 }).toISO()!,
        },
        {
          ...lesson,
          id: "synthetic-cancelled",
          course: "TEST-CANCEL",
          cancelled: true,
          start: start.plus({ days: 1 }).toISO()!,
          end: start.plus({ days: 1, minutes: 90 }).toISO()!,
        },
      ],
      lastSuccess: new Date(),
    });
  await context.addCookies([
    {
      name: "kwf_session",
      value: token,
      url: "http://localhost:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return user;
}
test.afterAll(closeDatabase);
test("bilingual landing page, square controls and desktop/mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /Sign in with your school/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "CZ", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Přihlásit školním/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Přihlásit školním/ }),
  ).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  expect(
    await page
      .locator("button")
      .first()
      .evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe("0px");
  expect(errors).toEqual([]);
});
test("two synthetic browsers request, accept, compare, then revoke calendar access", async ({
  browser,
  page,
  context,
}) => {
  const a = await seed(context);
  const second = await browser.newContext({
    locale: "en-GB",
    viewport: { width: 1440, height: 1000 },
  });
  const b = await seed(second);
  const pageB = await second.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page.getByLabel("School username", { exact: true }).fill(b.username);
  await page.getByRole("button", { name: /Send request/ }).click();
  await expect(page.getByText("Request sent", { exact: true })).toBeVisible();
  await pageB.goto("/");
  await pageB.getByRole("button", { name: "Friends", exact: true }).click();
  await pageB.getByRole("button", { name: "Accept", exact: true }).click();
  await pageB.getByRole("button", { name: "Timetable", exact: true }).click();
  await expect(
    pageB
      .getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) })
      .first(),
  ).toBeVisible();
  await pageB.getByText("Overlay timetables", { exact: true }).click();
  await pageB.getByRole("checkbox", { name: a.username, exact: true }).check();
  await pageB.getByLabel("Shared lessons only").check();
  await expect(
    pageB
      .getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/friends-desktop.png",
    fullPage: true,
  });
  await pageB
    .getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) })
    .first()
    .click();
  await expect(pageB.locator("dialog[open]")).toBeVisible();
  const row = page.locator("article").filter({ hasText: b.username });
  await row.getByLabel("My timetable", { exact: true }).uncheck();
  await row.getByRole("button", { name: "Save sharing" }).click();
  await expect(
    pageB.getByText("A friend has stopped sharing their timetable.", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    pageB.getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) }),
  ).toHaveCount(0);
  await expect(pageB.locator("dialog[open]")).toHaveCount(0);
  await second.close();
});
test("manual draft CRUD, conflicts, invitation creation and responsive timetable", async ({
  page,
  context,
}) => {
  const u = await seed(context);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /TEST-MAT.*09:00/ }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/timetable-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Semester planner", exact: true })
    .click();
  await page.getByLabel("Course code", { exact: true }).fill("TEST-NEW");
  await page.getByLabel("Note", { exact: true }).fill("Consider next semester");
  await page.getByRole("button", { name: "Add to draft", exact: true }).click();
  await expect(page.getByRole("heading", { name: "TEST-NEW" })).toBeVisible();
  await expect(page.getByText("Unverified", { exact: true })).toBeVisible();
  const planRows = await database().select().from(plans);
  expect(planRows.find((p) => p.userId === u.id)?.choices[0].verified).toBe(
    false,
  );
  await page.screenshot({
    path: "test-results/planner-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.locator('a[href*="?invite="]')).toBeVisible();
  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.locator('a[href*="?invite="]')).toHaveCount(0);
  for (const tab of ["Timetable", "Friends", "Semester planner"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${tab} overflow at ${width}`,
      ).toBe(true);
    }
  }
  await page.getByRole("button", { name: "Timetable", exact: true }).click();
  await page.screenshot({
    path: "test-results/timetable-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Semester planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("heading", { name: "TEST-NEW" })).toHaveCount(0);
});

test("group invitation, personal override and leave update default attendee icons", async ({
  page,
  context,
  browser,
}) => {
  const a = await seed(context);
  const second = await browser.newContext({
    locale: "en-GB",
    viewport: { width: 1440, height: 1000 },
  });
  const b = await seed(second),
    pageB = await second.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("Study crew");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  const group = page.getByRole("region", { name: "Study crew", exact: true });
  await expect(group).toBeVisible();
  await group.getByLabel("School username", { exact: true }).fill(b.username);
  await group.getByRole("button", { name: "Invite member" }).click();
  await pageB.goto("/");
  await expect(
    pageB.getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) }),
  ).toHaveCount(0);
  await pageB.getByRole("button", { name: "Groups", exact: true }).click();
  const groupB = pageB.getByRole("region", { name: "Study crew", exact: true });
  await groupB.getByRole("button", { name: "Accept", exact: true }).click();
  await pageB.getByRole("button", { name: "Timetable", exact: true }).click();
  const common = pageB
    .getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) })
    .first();
  await expect(common).toBeVisible();
  await expect(common.locator('[class*="profileAvatar"]')).toHaveCount(1);
  await common.click();
  await expect(pageB.locator("dialog[open]")).toContainText(a.username);
  const member = group.locator("article").filter({ hasText: b.username });
  await member.getByLabel("My timetable", { exact: true }).uncheck();
  await member
    .getByRole("button", { name: "Save sharing", exact: true })
    .click();
  await expect(pageB.locator("dialog[open]")).not.toContainText(a.username, {
    timeout: 15000,
  });
  await expect(
    pageB.getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) }),
  ).toHaveCount(0);
  await member.getByRole("button", { name: "Use sharing defaults" }).click();
  await expect(common).toBeVisible({ timeout: 15000 });
  await page.screenshot({
    path: "test-results/groups-desktop.png",
    fullPage: true,
  });
  await pageB
    .locator("dialog[open]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await pageB.getByRole("button", { name: "Groups", exact: true }).click();
  await groupB
    .getByRole("button", { name: "Leave group", exact: true })
    .click();
  await groupB
    .getByRole("button", { name: "Leave group", exact: true })
    .last()
    .click();
  await expect(groupB).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/groups-mobile.png",
    fullPage: true,
  });
  await second.close();
});

test("personal subject CRUD, custom colors and automatic weekend columns", async ({
  page,
  context,
}) => {
  await seed(context);
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator("[data-date]")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Personal subjects and events", exact: true })
    .click();
  const editor = page.locator("dialog[open]");
  const start = DateTime.now()
    .setZone(ZONE)
    .startOf("week")
    .plus({ days: 5, hours: 10 });
  await editor.getByLabel("Course code", { exact: true }).fill("TV1-PE");
  await editor.getByLabel("Event name", { exact: true }).fill("Personal sport");
  await editor
    .getByLabel("Starts", { exact: true })
    .fill(start.toFormat("yyyy-MM-dd'T'HH:mm"));
  await editor
    .getByLabel("Ends", { exact: true })
    .fill(start.plus({ minutes: 90 }).toFormat("yyyy-MM-dd'T'HH:mm"));
  await editor.getByLabel("Room", { exact: true }).fill("Gym 1");
  await editor.getByLabel("Color", { exact: true }).fill("#158b98");
  await editor.getByLabel("Repeat weekly", { exact: true }).check();
  await editor.getByLabel("Note", { exact: true }).fill("Bring shoes");
  await page.screenshot({
    path: "test-results/personal-editor.png",
    fullPage: true,
  });
  await editor.getByRole("button", { name: "Save event" }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator("[data-date]")).toHaveCount(6);
  const event = page.getByRole("button", { name: /TV1-PE 10:00/ }).first();
  await expect(event).toBeVisible();
  expect(
    await event.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--lesson-color").trim(),
    ),
  ).toBe("#158b98");
  await page.screenshot({
    path: "test-results/weekend-personal.png",
    fullPage: true,
  });
  await event.click();
  await expect(editor).toContainText("Bring shoes");
  await editor.getByRole("button", { name: "Edit personal event" }).click();
  await editor.getByLabel("Course code", { exact: true }).fill("TV2-PE");
  await editor.getByLabel("Color", { exact: true }).fill("#007788");
  await editor.getByRole("button", { name: "Save event" }).click();
  await expect(
    page.getByRole("button", { name: /TV2-PE 10:00/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /TV2-PE 10:00/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByRole("button", { name: "Personal subjects and events", exact: true })
    .click();
  await editor.getByRole("button", { name: /TV2-PE/ }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await editor.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await editor
    .getByRole("button", { name: "Delete event", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Yes, delete event", exact: true })
    .click();
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("[data-date]")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /TV2-PE 10:00/ })).toHaveCount(
    0,
  );
  expect(errors).toEqual([]);
});
