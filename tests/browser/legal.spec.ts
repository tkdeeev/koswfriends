import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 320, height: 740 } });

test("public legal pages work without login in all languages and themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/privacy?lang=en");
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacy notice" }),
  ).toBeVisible();
  await expect(page.getByText(/Tomáš Viktor Kubíček/).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "tkdeeev@gmail.com", exact: true }).first(),
  ).toHaveAttribute("href", "mailto:tkdeeev@gmail.com");
  await expect(page.getByText(/365/).first()).toBeVisible();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const [button, language, heading] of [
    ["CZ", "cs", "Ochrana osobních údajů"],
    ["UA", "uk", "Захист персональних даних"],
    ["EN", "en", "Privacy notice"],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Terms of use", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Terms of use" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Analytics settings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Optional analytics" }),
  ).toBeVisible();
  await expect(
    page.getByText("Analytics are not active.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
