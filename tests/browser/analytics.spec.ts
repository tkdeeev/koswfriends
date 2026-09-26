import { test, expect } from "@playwright/test";
import { ANALYTICS_CHOICE_TTL } from "../../src/lib/analytics";
import { closeDatabase } from "../../src/server/db";
import { seed } from "./fixtures";

// This suite mocks the analytics configuration and collector. Service worker
// behavior has its own real-network tests; it must not bypass these mocks.
test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
test.afterAll(closeDatabase);

test("analytics rechecks consent expiry before counting navigation in an existing tab", async ({
  page,
  context,
}) => {
  await seed(context);
  const requests: unknown[] = [];
  await page.addInitScript(() => {
    localStorage.setItem(
      "kwf_analytics_choice",
      JSON.stringify({ version: 1, choice: "accepted", savedAt: Date.now() }),
    );
  });
  await page.route("**/api/usage/config", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route("**/api/usage", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto("/");
  await expect.poll(() => requests).toEqual([{ page: "timetable" }]);
  // Aging the stored record does not emit a storage event in this tab. The
  // component's accepted state stays unchanged until the next navigation.
  await page.evaluate((ttl) => {
    localStorage.setItem(
      "kwf_analytics_choice",
      JSON.stringify({
        version: 1,
        choice: "accepted",
        savedAt: Date.now() - ttl - 1,
      }),
    );
  }, ANALYTICS_CHOICE_TTL);
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  const banner = page.getByRole("region", {
    name: "Optional analytics",
    exact: true,
  });
  await expect(banner).toBeVisible();
  expect(requests).toEqual([{ page: "timetable" }]);
  await banner.getByRole("button", { name: "Allow", exact: true }).click();
  await expect
    .poll(() => requests)
    .toEqual([{ page: "timetable" }, { page: "connections" }]);
});

test("analytics needs consent and can be declined or withdrawn without private data", async ({
  page,
  context,
}) => {
  const requests: { body: unknown; headers: Record<string, string> }[] = [];
  await page.route("**/api/usage/config", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route("**/api/usage", async (route) => {
    requests.push({
      body: route.request().postDataJSON(),
      headers: await route.request().allHeaders(),
    });
    await route.fulfill({ status: 204 });
  });
  await context.addCookies([
    {
      name: "private_test",
      value: "never-forward",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/?invite=do-not-send#private-fragment");
  const banner = page.getByRole("region", {
    name: "Optional analytics",
    exact: true,
  });
  await expect(banner).toBeVisible();
  expect(requests).toEqual([]);
  const allowBox = await banner
    .getByRole("button", { name: "Allow", exact: true })
    .boundingBox();
  const declineBox = await banner
    .getByRole("button", { name: "Decline", exact: true })
    .boundingBox();
  expect(allowBox?.width).toBe(declineBox?.width);
  expect(allowBox?.height).toBe(declineBox?.height);
  await banner.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Analytics settings", exact: true }),
  ).toBeVisible();
  await expect(banner).toHaveCount(0);
  expect(requests).toEqual([]);
  await page
    .getByRole("button", { name: "Analytics settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Optional analytics",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Allow", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].body).toEqual({ page: "home" });
  expect(requests[0].headers.cookie).toBeUndefined();
  expect(requests[0].headers.referer).toBeUndefined();
  await page
    .getByRole("button", { name: "Analytics settings", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Decline", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Analytics settings", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.setViewportSize({ width: 320, height: 740 });
  await page
    .getByRole("button", { name: "Analytics settings", exact: true })
    .click();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/analytics-mobile.png" });
});

for (const signal of ["doNotTrack", "globalPrivacyControl"] as const) {
  test(`analytics honors ${signal} even with a saved acceptance`, async ({
    page,
  }) => {
    let sends = 0;
    await page.addInitScript((signal) => {
      localStorage.setItem(
        "kwf_analytics_choice",
        JSON.stringify({ version: 1, choice: "accepted", savedAt: Date.now() }),
      );
      Object.defineProperty(navigator, signal, {
        get: () => (signal === "doNotTrack" ? "1" : true),
      });
    }, signal);
    await page.route("**/api/usage/config", (route) =>
      route.fulfill({ json: { enabled: true } }),
    );
    await page.route("**/api/usage", (route) => {
      sends++;
      return route.fulfill({ status: 204 });
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Analytics settings", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Optional analytics",
      exact: true,
    });
    await expect(
      dialog.getByText("Your browser requests no tracking. Analytics are off."),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Allow", exact: true }),
    ).toBeDisabled();
    expect(sends).toBe(0);
  });
}
