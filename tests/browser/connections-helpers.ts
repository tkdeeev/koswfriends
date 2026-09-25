import { expect, type Page, type Locator } from "@playwright/test";
export async function connections(page: Page, tab: "Friends" | "Groups") {
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  const switcher = page.getByRole("group", {
    name: "Connections",
    exact: true,
  });
  if (await switcher.isVisible())
    await switcher.getByRole("button", { name: tab, exact: true }).click();
  await expect(
    page.getByRole("region", { name: tab, exact: true }),
  ).toBeVisible();
}
export async function addConnection(page: Page, tab: "Friends" | "Groups") {
  await page
    .getByRole("button", { name: "Add connection", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Add connection",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: tab, exact: true }).click();
  return dialog;
}
export async function expand(row: Locator) {
  const details = row.locator(":scope > details");
  await expect(details).toBeAttached();
  if ((await details.getAttribute("open")) === null)
    await details.locator(":scope > summary").click();
}
