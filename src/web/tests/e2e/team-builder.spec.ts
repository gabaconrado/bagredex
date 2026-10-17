import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const username = process.env.BAGREDEX_E2E_USERNAME;
  const password = process.env.BAGREDEX_E2E_PASSWORD;
  if (!username || !password)
    throw new Error("Set BAGREDEX_E2E_USERNAME and BAGREDEX_E2E_PASSWORD.");
  await page.goto("/login/?next=/teams/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/teams\//);
});

test("creates a keyboard-first local draft and protects it from navigation", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "My Teams" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("Keyboard Team"));
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await expect(page.getByLabel("Team name")).toHaveValue("Keyboard Team");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const picker = page.getByRole("dialog", { name: "Choose a Pokémon" });
  await expect(picker).toBeVisible();
  await picker.getByRole("combobox").fill("a");
  await expect(picker.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Add Pokémon" }).first(),
  ).toBeFocused();

  await page.getByRole("button", { name: "Add Pokémon" }).nth(5).click();
  await page
    .getByRole("dialog", { name: "Choose a Pokémon" })
    .getByRole("combobox")
    .press("Enter");
  const sixth = page.locator('[data-member-slot="5"]');
  await expect(sixth).toBeVisible();
  await expect(sixth.getByLabel("Nickname")).toBeFocused();
  await sixth.getByLabel("Nickname").fill("Ace");
  await sixth.getByLabel("Nickname").press("Enter");
  await expect(sixth.getByLabel("Ability")).toBeFocused();
  await sixth.getByLabel("Ability").fill("not accepted");
  await sixth.getByLabel("Item").focus();
  await expect(sixth.getByLabel("Ability")).toHaveValue("not accepted");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Pokédex" }).click();
  await expect(page).toHaveURL(/\/teams\//);
});

test("is functional at phone width with touch-sized controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const button = page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
