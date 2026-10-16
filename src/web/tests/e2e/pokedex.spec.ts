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
  await page.getByLabel("Regulation").selectOption("m-b");
  await expect(page).toHaveURL(/regulation=m-b/);
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  const search = page.getByLabel(/Search Pokémon/);
  await search.fill("mega");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByText("Selected Pokémon")).toBeVisible();
  await page.getByRole("button", { name: /^Show shiny / }).click();
  await expect(page.getByRole("img", { name: /^Shiny / })).toBeVisible();
});

test("combines move, ability, and type filters and cycles sorting", async ({
  page,
}) => {
  const search = page.getByLabel(/Search Pokémon/);
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
  const search = page.getByLabel(/Search Pokémon/);
  await search.fill("charizard");
  await page.getByRole("option", { name: "Charizard", exact: true }).click();
  const rowSprite = page
    .locator(".pokemon-table tbody tr", { hasText: "Charizard" })
    .first()
    .locator("img");
  await expect(rowSprite).toHaveAttribute("loading", "lazy");
  await expect(rowSprite).toHaveAttribute("src", /charizard\/normal/);
  const normalRowSource = await rowSprite.getAttribute("src");
  const shinyToggle = page.getByRole("button", {
    name: "Show shiny Charizard",
  });
  expect(
    await shinyToggle.evaluate((button) => {
      const icon = button.querySelector("svg")!;
      return getComputedStyle(icon).fill === getComputedStyle(button).color;
    }),
  ).toBe(true);
  await shinyToggle.click();
  expect(
    await page
      .getByRole("button", { name: "Show normal Charizard" })
      .evaluate((button) => {
        const icon = button.querySelector("svg")!;
        return getComputedStyle(icon).fill === getComputedStyle(button).color;
      }),
  ).toBe(true);
  await expect(
    page.getByRole("img", { name: "Shiny Charizard" }),
  ).toBeVisible();
  await expect(rowSprite).toHaveAttribute("src", normalRowSource!);
  const moveTable = page.getByLabel("Legal moves");
  await expect(moveTable.getByText("Name", { exact: true })).toBeVisible();
  await expect(moveTable.getByText("Category", { exact: true })).toBeVisible();
  const mega = page
    .getByRole("button", { name: /Switch to Charizard-Mega/ })
    .first();
  await expect(mega).toBeVisible();
  await mega.click();
  await expect(
    page.getByRole("button", { name: /^Return to base form Charizard$/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Return to base form Charizard$/ })
    .click();
  await page.getByRole("button", { name: "Blaze", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Blaze", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(
    page.getByRole("button", { name: "Blaze", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Blaze", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Blaze", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Blaze", exact: true }).click();
  const dialogBox = await page.getByRole("dialog").boundingBox();
  await page.mouse.click(
    Math.max(1, (dialogBox?.x ?? 20) - 8),
    dialogBox?.y ?? 20,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Blaze", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: /Switch to Charizard-Mega/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Blaze", exact: true }),
  ).toHaveCount(0);
});

test("keeps phone columns and delayed Firefox detail geometry stable", async ({
  page,
}, testInfo) => {
  const firstRow = page.locator(".pokemon-table tbody tr").first();
  await expect(firstRow.getByRole("button")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 640) {
    await expect(
      page.getByRole("columnheader", { name: "Pokémon" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Types" }),
    ).toBeHidden();
  }
  if (!testInfo.project.name.startsWith("firefox")) return;
  await page.route("**/index/**", async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    const status = response.status();
    const headers = response.headers();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ body, headers, status });
  });
  await page.route("**/details/**", async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    const status = response.status();
    const headers = response.headers();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ body, headers, status });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const heading = page.getByRole("heading", { name: "Pokédex" });
  const picker = page.getByLabel("Regulation");
  const list = page.locator(".pokedex-list");
  const detail = page.locator(".detail-pane");
  await expect(heading).toBeVisible();
  const shellBoxes = await Promise.all([
    heading.boundingBox(),
    picker.boundingBox(),
    list.boundingBox(),
    detail.boundingBox(),
  ]);
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  const loadedBoxes = await Promise.all([
    heading.boundingBox(),
    picker.boundingBox(),
    list.boundingBox(),
    detail.boundingBox(),
  ]);
  for (let index = 0; index < shellBoxes.length; index += 1) {
    for (const key of ["x", "y", "width", "height"] as const)
      expect(
        Math.abs(
          (shellBoxes[index]?.[key] ?? 0) - (loadedBoxes[index]?.[key] ?? 0),
        ),
      ).toBeLessThanOrEqual(1);
  }
  const emptyBox = await detail.boundingBox();
  await page
    .locator(".pokemon-table tbody tr")
    .first()
    .getByRole("button")
    .click();
  await expect(page.getByLabel("Loading Pokémon details")).toBeVisible();
  const loadingBox = await detail.boundingBox();
  await expect(detail.getByText("Stats at level 50")).toBeVisible();
  const readyBox = await detail.boundingBox();
  expect(
    Math.abs((emptyBox?.width ?? 0) - (loadingBox?.width ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((loadingBox?.width ?? 0) - (readyBox?.width ?? 0)),
  ).toBeLessThanOrEqual(1);
  await expect(page.locator(".table-scroll")).toHaveCSS(
    "scrollbar-gutter",
    /stable/,
  );
});
