import { expect, test, type Page } from "@playwright/test";

const credentials = () => {
  const username = process.env.BAGREDEX_E2E_USERNAME;
  const password = process.env.BAGREDEX_E2E_PASSWORD;
  if (!username || !password)
    throw new Error(
      "Set BAGREDEX_E2E_USERNAME and BAGREDEX_E2E_PASSWORD for the local test account.",
    );
  return { username, password };
};

async function login(page: Page) {
  const { username, password } = credentials();
  await page.goto("/login/?next=/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Pokédex" })).toBeVisible();
}

test.beforeEach(async ({ page }) => login(page));

test("switches explicit regulations and supports keyboard selection", async ({
  page,
}) => {
  await page.getByRole("link", { name: "M-B" }).click();
  await expect(page).toHaveURL(/regulation=m-b/);
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  const search = page.getByRole("combobox");
  await search.fill("mega");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByText("Selected Pokémon")).toBeVisible();
  await page.getByLabel("Shiny").check();
  await expect(page.getByRole("img", { name: /^Shiny / })).toBeVisible();
});

test("combines move, ability, and type filters and cycles sorting", async ({
  page,
}) => {
  const search = page.getByRole("combobox");
  for (const choice of [
    { query: "protect", group: "Moves", option: "Protect" },
    { query: "intimidate", group: "Abilities", option: "Intimidate" },
    { query: "fire", group: "Types", option: "Fire" },
  ]) {
    await search.fill(choice.query);
    await page
      .getByRole("group", { name: choice.group })
      .getByRole("option", { name: choice.option, exact: true })
      .click();
  }
  const filters = page.getByLabel("Active filters");
  await expect(
    filters.getByRole("button", { name: "Remove Protect move filter" }),
  ).toBeVisible();
  await expect(
    filters.getByRole("button", { name: "Remove Intimidate ability filter" }),
  ).toBeVisible();
  await expect(
    filters.getByRole("button", { name: "Remove Fire type filter" }),
  ).toBeVisible();
  await expect(filters.getByRole("button")).toHaveCount(3);

  // M-C has four Protect + Intimidate + Fire forms, but none is both Fire and Water.
  await search.fill("water");
  await page
    .getByRole("group", { name: "Types" })
    .getByRole("option", { name: "Water", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No Pokémon match" }),
  ).toBeVisible();
  await expect(
    filters.getByRole("button", { name: "Remove Water type filter" }),
  ).toBeVisible();
  await expect(filters.getByRole("button")).toHaveCount(4);

  await filters
    .getByRole("button", { name: "Remove Water type filter" })
    .click();
  const hp = page.getByRole("button", { name: "HP" });
  await hp.click();
  await expect(hp.locator("xpath=..")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await hp.click();
  await expect(hp.locator("xpath=..")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await hp.click();
  await expect(hp.locator("xpath=..")).toHaveAttribute("aria-sort", "none");
});

test("navigates Mega forms in both directions and replaces detail information", async ({
  page,
}) => {
  const search = page.getByRole("combobox");
  await search.fill("charizard");
  await page.getByRole("option", { name: "Charizard", exact: true }).click();
  const mega = page.getByRole("button", { name: /Charizard-Mega/ }).first();
  await expect(mega).toBeVisible();
  await mega.click();
  await expect(
    page.getByRole("button", { name: /^Base: Charizard$/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Base: Charizard$/ }).click();
  await page.getByRole("button", { name: "Blaze", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Blaze", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Charizard-Mega/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Blaze", exact: true }),
  ).toHaveCount(0);
});
