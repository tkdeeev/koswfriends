import { test, expect, type BrowserContext } from "@playwright/test";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { database, closeDatabase } from "../../src/server/db";
import {
  users,
  sessions,
  snapshots,
  plans,
  groups,
  members,
} from "../../src/server/schema";
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

test("group links survive sign-in, require joining and can be copied again or revoked", async ({
  page,
  context,
  browser,
}) => {
  await seed(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("Link crew");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  const group = page.getByRole("region", { name: "Link crew", exact: true });
  await group.getByRole("button", { name: "Create group link" }).click();
  const href = await group
    .locator('a[href*="#groupInvite="]')
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await expect(group.locator('a[href*="#groupInvite="]')).toHaveAttribute(
    "href",
    href!,
  );
  const second = await browser.newContext({ locale: "en-GB" });
  const pageB = await second.newPage();
  await pageB.goto(href!);
  await expect(pageB.getByText(/You have a group invitation/)).toBeVisible();
  expect(new URL(pageB.url()).hash).toBe("");
  expect(
    await pageB.evaluate(() => sessionStorage.getItem("kwf_group_invite")),
  ).toHaveLength(43);
  // Simulate returning from school login using an isolated synthetic session.
  const b = await seed(second);
  await pageB.reload();
  const invitation = pageB.getByRole("region", {
    name: "Group invitation",
    exact: true,
  });
  await expect(invitation).toContainText("Link crew");
  expect(
    await database().select().from(members).where(eq(members.userId, b.id)),
  ).toHaveLength(0);
  await invitation.getByLabel("My timetable", { exact: true }).uncheck();
  await invitation
    .getByRole("button", { name: "Join group", exact: true })
    .click();
  await expect(
    pageB.getByRole("region", { name: "Link crew", exact: true }),
  ).toBeVisible();
  const [membership] = await database()
    .select()
    .from(members)
    .where(eq(members.userId, b.id));
  expect(membership.calendar).toBe(false);
  expect(
    await pageB.evaluate(() => sessionStorage.getItem("kwf_group_invite")),
  ).toBeNull();
  await group.getByRole("button", { name: "Revoke link" }).click();
  await expect(group.locator('a[href*="#groupInvite="]')).toHaveCount(0);
  await pageB.goto(href!);
  await expect(pageB.locator("main").getByRole("alert")).toContainText(
    "expired or was revoked",
  );
  await pageB
    .getByRole("region", { name: "Group invitation", exact: true })
    .getByRole("button", { name: "Cancel" })
    .click();
  await pageB.getByRole("button", { name: "Groups", exact: true }).click();
  await expect(
    pageB.getByRole("region", { name: "Link crew", exact: true }),
  ).toBeVisible();
  await second.close();
});

test("all shared overlays start enabled and support bulk and individual switches", async ({
  page,
  context,
  browser,
}) => {
  const a = await seed(context);
  const second = await browser.newContext();
  const b = await seed(second),
    c = await seed(second);
  const [group] = await database()
    .insert(groups)
    .values({ owner: a.id, name: "Overlay test" })
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
  for (const [i, u] of [b, c].entries()) {
    const start = DateTime.fromISO(snapshot.events[0].start).plus({
      hours: 4 + i,
    });
    await database()
      .update(snapshots)
      .set({
        events: [
          {
            ...snapshot.events[0],
            id: `friend-only-${i}`,
            course: `FRIEND-${i}`,
            start: start.toISO()!,
            end: start.plus({ minutes: 45 }).toISO()!,
          },
        ],
      })
      .where(eq(snapshots.userId, u.id));
  }
  await page.goto("/");
  const all = page.getByRole("checkbox", { name: "All friends", exact: true });
  const first = page.getByRole("button", { name: /FRIEND-0/ }).first();
  const next = page.getByRole("button", { name: /FRIEND-1/ }).first();
  await expect(all).toBeChecked();
  await expect(first).toBeVisible();
  await expect(next).toBeVisible();
  await all.uncheck();
  await expect(first).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /TEST-MAT/ }).first(),
  ).toBeVisible();
  await all.check();
  await expect(first).toBeVisible();
  await expect(next).toBeVisible();
  await page.getByText("Overlay timetables", { exact: true }).click();
  await page.getByRole("checkbox", { name: b.username, exact: true }).uncheck();
  await expect(first).toHaveCount(0);
  await expect(next).toBeVisible();
  expect(await all.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(
    true,
  );
  await all.check();
  await expect(first).toBeVisible();
  await second.close();
});

test("dark mode covers lessons, custom colors, dialogs and mobile and persists across reloads", async ({
  page,
  context,
}) => {
  const u = await seed(context);
  const [snapshot] = await database()
    .select()
    .from(snapshots)
    .where(eq(snapshots.userId, u.id));
  const start = DateTime.fromISO(snapshot.events[0].start);
  const lessons = ["lecture", "tutorial", "laboratory", "exam", "personal"].map(
    (type, i) => ({
      ...snapshot.events[0],
      id: `theme-${i}`,
      course: `THEME-${i}`,
      type,
      ...(type === "personal" ? { color: "#ffffff" } : {}),
      start: start.plus({ hours: i }).toISO()!,
      end: start.plus({ hours: i, minutes: 45 }).toISO()!,
    }),
  );
  await database()
    .update(snapshots)
    .set({ events: lessons })
    .where(eq(snapshots.userId, u.id));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const theme = page.getByRole("button", { name: "Dark mode", exact: true });
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-lesson-type]")).toHaveCount(5);
  const styles = await page
    .locator("[data-lesson-type]")
    .evaluateAll((elements) => {
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d")!;
      const luminance = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const pixels = ctx.getImageData(0, 0, 1, 1).data;
        const rgb = [...pixels].slice(0, 3).map((c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      };
      return elements.map((el) => {
        const s = getComputedStyle(el),
          bg = luminance(s.backgroundColor),
          fg = luminance(s.color);
        return { bg, contrast: (fg + 0.05) / (bg + 0.05) };
      });
    });
  for (const style of styles) {
    expect(style.bg).toBeLessThan(0.15);
    expect(style.contrast).toBeGreaterThan(4.5);
  }
  await page.screenshot({
    path: "test-results/dark-timetable.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /THEME-0/ })
    .first()
    .click();
  await expect(page.locator("dialog[open]")).toHaveCSS(
    "background-color",
    "rgb(20, 31, 41)",
  );
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Personal subjects and events", exact: true })
    .click();
  await expect(page.locator("dialog[open]")).toHaveCSS(
    "background-color",
    "rgb(20, 31, 41)",
  );
  await expect(
    page.locator("dialog[open]").getByLabel("Course code", { exact: true }),
  ).toHaveCSS("background-color", "rgb(20, 31, 41)");
  await page.screenshot({
    path: "test-results/dark-editor.png",
    fullPage: true,
  });
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  for (const tab of ["Groups", "Friends", "Semester planner"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(page.locator('[class*="panel"]').first()).toHaveCSS(
      "background-color",
      "rgb(20, 31, 41)",
    );
  }
  await page.getByRole("button", { name: "Timetable", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: /^Thu/ }).click();
  const mobileCard = page.locator('[class*="agendaEvent"]').first();
  await expect(mobileCard).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dark-mobile.png",
    fullPage: true,
  });
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await theme.click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(20, 31, 41)",
  );
  expect(errors).toEqual([]);
});
