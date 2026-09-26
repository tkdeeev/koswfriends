import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { database, closeDatabase } from "../../src/server/db";
import { snapshots, plans, groups, members } from "../../src/server/schema";
import { ZONE } from "../../src/lib/calendar";
if (process.env.KWF_TEST_DATABASE !== "yes")
  throw new Error("Only synthetic test databases are allowed");
import { seed } from "./fixtures";
import { connections, addConnection, expand } from "./connections-helpers";
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
  await expect(
    page.getByText("Groups, invites and per-person sharing", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Semester planning with conflict checks", { exact: true }),
  ).toHaveCount(0);
  const preview = page.locator("figure img:visible");
  await expect(preview).toHaveAttribute(
    "src",
    "/preview/timetable-en-light.png",
  );
  expect(
    await preview.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBe(1280);
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.goto("/?view=planner");
  await expect(
    page.getByRole("link", { name: /Sign in with your school/ }),
  ).toHaveAttribute("href", "/auth/login?view=planner");
  await expect(
    page.getByRole("navigation", { name: "Navigation", exact: true }),
  ).toHaveCount(0);
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
  await connections(page, "Friends");
  await addConnection(page, "Friends");
  await page.getByLabel("School username", { exact: true }).fill(b.username);
  await page.getByRole("button", { name: /Send request/ }).click();
  await expect(page.getByText("Request sent", { exact: true })).toBeVisible();
  await pageB.goto("/");
  await connections(pageB, "Friends");
  await expand(pageB.locator("article").filter({ hasText: a.username }));
  await pageB.getByRole("button", { name: "Accept", exact: true }).click();
  await pageB.getByRole("button", { name: "Timetable", exact: true }).click();
  await expect(
    pageB
      .getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) })
      .first(),
  ).toBeVisible();
  await pageB.getByText("Overlay timetables", { exact: true }).click();
  await pageB.getByRole("button", { name: a.username, exact: true }).click();
  await pageB
    .getByRole("button", { name: "Shared lessons only", exact: true })
    .click();
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
  await expand(row);
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
  await expect(
    page
      .getByRole("navigation", { name: "Navigation", exact: true })
      .getByRole("button", { name: "Semester planner", exact: true }),
  ).toHaveCount(0);
  await page.goto("/?view=planner");
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
  await connections(page, "Friends");
  const add = await addConnection(page, "Friends");
  await add
    .locator("summary")
    .filter({ hasText: "Invite with a link" })
    .click();
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.locator('a[href*="?invite="]')).toBeVisible();
  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.locator('a[href*="?invite="]')).toHaveCount(0);
  await add.getByRole("button", { name: "Close", exact: true }).click();
  for (const tab of ["Timetable", "Connections", "Semester planner"]) {
    if (tab === "Semester planner") await page.goto("/?view=planner");
    else await page.getByRole("button", { name: tab, exact: true }).click();
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
  await page.goto("/?view=planner");
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
  await connections(page, "Groups");
  await addConnection(page, "Groups");
  await page.getByLabel("Group name", { exact: true }).fill("Study crew");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  const group = page.getByRole("region", { name: "Study crew", exact: true });
  await expect(group).toBeVisible();
  await expand(group);
  await group.getByLabel("School username", { exact: true }).fill(b.username);
  await group.getByRole("button", { name: "Invite member" }).click();
  await pageB.goto("/");
  await expect(
    pageB.getByRole("button", { name: new RegExp(`TEST-MAT.*${a.username}`) }),
  ).toHaveCount(0);
  await connections(pageB, "Groups");
  const groupB = pageB.getByRole("region", { name: "Study crew", exact: true });
  await expand(groupB);
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
  await expand(member);
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
  await connections(pageB, "Groups");
  await expand(groupB);
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
  await connections(page, "Groups");
  await addConnection(page, "Groups");
  await page.getByLabel("Group name", { exact: true }).fill("Link crew");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  const group = page.getByRole("region", { name: "Link crew", exact: true });
  await expand(group);
  await group.getByRole("button", { name: "Create group link" }).click();
  const href = await group
    .locator('a[href*="#groupInvite="]')
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.reload();
  await connections(page, "Groups");
  await expand(group);
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
  await connections(pageB, "Groups");
  await expect(
    pageB.getByRole("region", { name: "Link crew", exact: true }),
  ).toBeVisible();
  await second.close();
});

test("shared overlays start off and support bulk, individual and own timetable switches", async ({
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
  const all = page
    .getByRole("button", { name: "All friends", exact: true })
    .last();
  const first = page.getByRole("button", { name: /FRIEND-0/ }).first();
  const next = page.getByRole("button", { name: /FRIEND-1/ }).first();
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await expect(first).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /TEST-MAT/ }).first(),
  ).toBeVisible();
  await all.click();
  await expect(first).toBeVisible();
  await expect(next).toBeVisible();
  await page.getByText("Overlay timetables", { exact: true }).click();
  await page.getByRole("button", { name: b.username, exact: true }).click();
  await expect(first).toHaveCount(0);
  await expect(next).toBeVisible();
  await expect(all).toHaveAttribute("aria-pressed", "mixed");
  await all.click();
  await expect(first).toBeVisible();
  await page
    .getByRole("button", { name: "Your timetable", exact: true })
    .click();
  await expect(page.locator('[data-owned="true"]')).toHaveCount(0);
  await expect(next).toBeVisible();
  await page
    .getByRole("button", { name: "Your timetable", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /TEST-MAT/ }).first(),
  ).toBeVisible();
  await all.click();
  await expect(first).toHaveCount(0);
  await expect(next).toHaveCount(0);
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
  const detail = page.getByRole("dialog", { name: "THEME-0", exact: true });
  await expect(
    detail.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await expect(detail.getByText("TEST-101", { exact: true })).toBeVisible();
  await detail.screenshot({ path: "test-results/subject-dark-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /THEME-0/ }).first(),
  ).toBeFocused();
  await page
    .getByRole("button", { name: /THEME-1/ })
    .first()
    .click();
  await expect(
    page.locator("dialog[open]").getByText("Exercise", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  const exercise = page.getByRole("dialog", { name: "THEME-1", exact: true });
  expect(
    await exercise.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await exercise.screenshot({ path: "test-results/subject-dark-mobile.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await theme.click();
  await page
    .getByRole("button", { name: /THEME-1/ })
    .first()
    .click();
  await exercise.screenshot({ path: "test-results/subject-light-desktop.png" });
  await page.keyboard.press("Escape");
  await theme.click();
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
  for (const tab of ["Connections", "Semester planner"]) {
    if (tab === "Semester planner") await page.goto("/?view=planner");
    else await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      tab === "Connections"
        ? page.getByRole("region", { name: "Friends", exact: true })
        : page.locator('[class*="panel"]').first(),
    ).toHaveCSS("background-color", "rgb(20, 31, 41)");
  }
  await page.getByRole("button", { name: "Timetable", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: /^Thu/ }).click();
  const mobileCard = page.locator('button[class*="mobileLesson"]').first();
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

test("equal week columns cap crowded lessons and expand a complete day without losing privacy", async ({
  page,
  context,
  browser,
}) => {
  const a = await seed(context);
  const second = await browser.newContext(),
    b = await seed(second);
  const [group] = await database()
    .insert(groups)
    .values({ owner: a.id, name: "Crowded week" })
    .returning();
  await database()
    .insert(members)
    .values(
      [a, b].map((u) => ({
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
  const base = snapshot.events[0];
  const crowded = Array.from({ length: 6 }, (_, i) => ({
    ...base,
    id: `crowd-${i}`,
    course: `CROWD-${i}`,
    type: i % 2 ? "lecture" : "tutorial",
    end: DateTime.fromISO(base.start).plus({ hours: 2 }).toISO()!,
  }));
  await database()
    .update(snapshots)
    .set({ events: crowded })
    .where(eq(snapshots.userId, b.id));
  await page.goto("/");
  await page
    .getByRole("button", { name: "All friends", exact: true })
    .last()
    .click();
  const frame = page.locator('[class*="calendarFrame"]');
  const headers = page.locator("[data-date]");
  const columns = page.locator("[data-day-column]");
  const assertWeekFits = async () => {
    await expect(headers).toHaveCount(5);
    await expect(columns).toHaveCount(5);
    const widths = await columns.evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect().width),
    );
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    expect(
      await page
        .locator('[class*="dayScroll"]')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const rects = await headers.evaluateAll((nodes) =>
      nodes.map((n) => ({
        left: n.getBoundingClientRect().left,
        right: n.getBoundingClientRect().right,
      })),
    );
    const viewport = page.viewportSize()!.width;
    for (const rect of rects) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(viewport);
    }
  };
  for (const width of [1440, 1024, 800]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertWeekFits();
  }
  const thursday = DateTime.fromISO(base.start).setZone(ZONE).toISODate()!;
  const day = page.locator(`[data-day-column="${thursday}"]`);
  const overflow = day.getByRole("button", { name: /more lessons/ });
  await expect(overflow).toHaveText(/\+6/);
  await expect(day.locator("[data-lesson-type]")).toHaveCount(2);
  await expect(day.getByRole("button", { name: /TEST-MAT/ })).toBeVisible();
  await expect(day.getByRole("button", { name: /TEST-PRG/ })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/week-crowded.png",
    fullPage: true,
  });
  await overflow.click();
  await expect(columns).toHaveCount(1);
  await expect(headers).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Back to week", exact: true }),
  ).toBeVisible();
  await expect(day.locator("[data-lesson-type]")).toHaveCount(8);
  await expect(day.getByRole("button", { name: /more lessons/ })).toHaveCount(
    0,
  );
  expect((await day.boundingBox())!.width).toBeGreaterThan(
    (await frame.boundingBox())!.width - 60,
  );
  await page.screenshot({
    path: "test-results/day-expanded.png",
    fullPage: true,
  });
  // A full-width day must keep evaluating current sharing, including open details.
  await day.getByRole("button", { name: /CROWD-0/ }).click();
  await expect(page.locator("dialog[open]")).toContainText("CROWD-0");
  await database()
    .update(members)
    .set({ calendar: false })
    .where(eq(members.userId, b.id));
  await expect(day.getByRole("button", { name: /CROWD-/ })).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to week", exact: true }).click();
  await assertWeekFits();
  const monday = headers.first();
  await monday.click();
  await expect(columns).toHaveCount(1);
  await expect(columns.locator("[data-lesson-type]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await assertWeekFits();
  await monday.focus();
  await page.keyboard.press("Enter");
  await expect(columns).toHaveCount(1);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await assertWeekFits();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.screenshot({
    path: "test-results/empty-week-dark.png",
    fullPage: true,
  });
  const weekend = [2, 3].map((days, i) => {
    const start = DateTime.fromISO(base.start).plus({ days });
    return {
      ...base,
      id: `weekend-${i}`,
      course: `WEEKEND-${i}`,
      start: start.toISO()!,
      end: start.plus({ hours: 1 }).toISO()!,
    };
  });
  await database()
    .update(snapshots)
    .set({ events: [...snapshot.events, ...weekend] })
    .where(eq(snapshots.userId, a.id));
  await page.reload();
  await expect(headers).toHaveCount(7);
  const widths = await columns.evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().width),
  );
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  expect(
    await page
      .locator('[class*="dayScroll"]')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.setViewportSize({ width: 320, height: 844 });
  const picker = page.locator('[class*="dayPicker"]');
  await expect(picker.getByRole("button")).toHaveCount(7);
  const right = await picker
    .getByRole("button")
    .last()
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(right).toBeLessThanOrEqual(320);
  await picker.getByRole("button", { name: /^Sun/ }).click();
  await expect(
    page
      .locator('button[class*="mobileLesson"]')
      .filter({ hasText: "WEEKEND-1" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/seven-day-mobile.png",
    fullPage: true,
  });
  await second.close();
});
