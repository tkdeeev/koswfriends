import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { seed } from "./fixtures";
import { closeDatabase, database } from "../../src/server/db";
import { subjectBoards, snapshots } from "../../src/server/schema";
import { eq } from "drizzle-orm";

test.use({ serviceWorkers: "block", hasTouch: true });
test.afterAll(closeDatabase);
test.setTimeout(60000);

async function addTask(page: Page, title: string) {
  await page
    .getByRole("region", { name: "To do", exact: true })
    .getByRole("button", { name: "Add task", exact: true })
    .tap();
  const form = page.getByRole("dialog", { name: "Add task", exact: true });
  await form.getByLabel("Task title", { exact: true }).fill(title);
  return form;
}
async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
}

test("notes, editable cards, checklists, ordering and drag-and-drop persist per subject", async ({
  page,
  context,
  browserName,
}) => {
  await seed(context);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Subjects", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Subjects", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Subject", { exact: true }).selectOption("TEST-MAT");
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Review lecture 3\nhttps://example.org/materials");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await saved(page);
  let editor = await addTask(page, "Prepare assignment");
  await editor
    .getByLabel("Description", { exact: true })
    .fill("Solve the practice problems before the next tutorial.");
  await editor.getByLabel("Due date", { exact: true }).fill("2026-10-20");
  await editor
    .getByRole("button", { name: "Add checklist item", exact: true })
    .click();
  await editor
    .getByRole("textbox", { name: "Checklist item 1", exact: true })
    .fill("Read chapter 3");
  await editor
    .getByRole("button", { name: "Add checklist item", exact: true })
    .click();
  await editor
    .getByRole("textbox", { name: "Checklist item 2", exact: true })
    .fill("Solve exercises");
  await editor.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const card = page.getByRole("article", {
    name: "Prepare assignment",
    exact: true,
  });
  await card
    .getByRole("checkbox", { name: "Read chapter 3", exact: true })
    .check();
  await saved(page);
  await card.getByRole("combobox").selectOption("doing");
  await expect(
    page
      .getByRole("region", { name: "In progress", exact: true })
      .getByRole("article", { name: "Prepare assignment", exact: true }),
  ).toBeVisible();
  editor = await addTask(page, "Study definitions");
  await editor.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(editor).toHaveCount(0);
  editor = await addTask(page, "Read examples");
  await editor.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page
    .getByRole("button", { name: "Move up: Read examples", exact: true })
    .click();
  await saved(page);
  await expect(
    page
      .getByRole("region", { name: "To do", exact: true })
      .getByRole("article")
      .first(),
  ).toHaveAttribute("aria-label", "Read examples");
  if (browserName === "chromium") {
    await card.dragTo(page.getByRole("region", { name: "Done", exact: true }));
    await expect(
      page
        .getByRole("region", { name: "Done", exact: true })
        .getByRole("article", { name: "Prepare assignment", exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Review lecture 3\nhttps://example.org/materials");
  await expect(
    card.getByRole("checkbox", { name: "Read chapter 3", exact: true }),
  ).toBeChecked();
  await card
    .getByRole("button", { name: "Edit task: Prepare assignment", exact: true })
    .click();
  editor = page.getByRole("dialog", { name: "Edit task", exact: true });
  await expect(editor.getByLabel("Due date", { exact: true })).toHaveValue(
    "2026-10-20",
  );
  await editor
    .getByLabel("Task title", { exact: true })
    .fill("Submit assignment");
  await editor.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByLabel("Subject", { exact: true }).selectOption("TEST-PRG");
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByLabel("Subject", { exact: true }).selectOption("TEST-MAT");
  await expect(
    page.getByRole("article", { name: "Submit assignment", exact: true }),
  ).toBeVisible();
  if (browserName === "chromium") {
    await mkdir("local-preview", { recursive: true });
    await page.screenshot({
      path: "local-preview/subjects-desktop.png",
      fullPage: true,
    });
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete task: Submit assignment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("article", { name: "Submit assignment", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("mobile board works by touch in both themes and all three languages without overflow", async ({
  page,
  context,
  browserName,
}) => {
  await seed(context);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/?view=subjects&course=TEST-MAT");
  const editor = await addTask(
    page,
    "A long assignment title that wraps comfortably on a small screen",
  );
  await editor
    .getByLabel("Description", { exact: true })
    .fill("https://example.org/" + "long-link".repeat(30));
  await editor
    .getByRole("button", { name: "Add checklist item", exact: true })
    .click();
  await editor
    .getByRole("textbox", { name: "Checklist item 1", exact: true })
    .fill("Review my notes");
  expect(await editor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await editor.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole("article").getByRole("combobox").selectOption("done");
  await expect(
    page
      .getByRole("region", { name: "Done", exact: true })
      .getByRole("article"),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Review my notes", exact: true })
    .check();
  await saved(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (browserName === "webkit")
    await page.screenshot({
      path: "local-preview/subjects-mobile-dark.png",
      fullPage: true,
    });
  await page.evaluate(() => localStorage.setItem("kwf_locale", "cs"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Předměty", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Hotové", exact: true })
      .getByRole("article"),
  ).toBeVisible();
  await page.evaluate(() => localStorage.setItem("kwf_locale", "uk"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Предмети", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Виконано", exact: true })
      .getByRole("article"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("failed writes retain drafts and concurrent changes require reloading", async ({
  page,
  context,
}) => {
  const user = await seed(context);
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Subjects", exact: true })
    .click();
  await page.getByLabel("Subject", { exact: true }).selectOption("TEST-MAT");
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("My unsaved notes");
  await page.route("**/api/subjects", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not save",
  );
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("My unsaved notes");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("Subject", { exact: true }).selectOption("TEST-PRG");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "TEST-MAT",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Timetable", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Subjects", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("My unsaved notes");
  await page.unroute("**/api/subjects");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await saved(page);
  const [snapshot] = await database()
    .select()
    .from(snapshots)
    .where(eq(snapshots.userId, user.id));
  await database()
    .update(snapshots)
    .set({
      lastSuccess: new Date(),
      events: [
        ...snapshot.events,
        { ...snapshot.events[0], id: "new-subject", course: "NEW-SUBJECT" },
      ],
    })
    .where(eq(snapshots.userId, user.id));
  await expect(
    page
      .getByLabel("Subject", { exact: true })
      .getByRole("option", { name: /NEW-SUBJECT/ }),
  ).toHaveCount(1, { timeout: 15000 });
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "TEST-MAT",
  );
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("My unsaved notes");
  await database()
    .update(subjectBoards)
    .set({ revision: 2, notes: "Saved on another device" })
    .where(eq(subjectBoards.userId, user.id));
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Stale local edit");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "another tab or device",
  );
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Stale local edit");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Load latest version", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Saved on another device");
  const editor = await addTask(page, "Unsaved card");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await expect(editor).toHaveCount(0);
});
