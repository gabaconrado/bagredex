import { expect, test, type Locator, type Page } from "@playwright/test";

const commitChoice = async (page: Page, input: Locator, name: string) => {
  await input.fill(name);
  const listboxId = await input.getAttribute("aria-controls");
  if (!listboxId) throw new Error(`Combobox for ${name} has no listbox.`);
  await page
    .locator(`#${listboxId}`)
    .getByRole("option", { name, exact: true })
    .click();
  await expect(input).toHaveValue(name);
};

test.beforeEach(async ({ page }) => {
  const username = process.env.BAGREDEX_E2E_USERNAME;
  const password = process.env.BAGREDEX_E2E_PASSWORD;
  if (!username || !password)
    throw new Error("Set BAGREDEX_E2E_USERNAME and BAGREDEX_E2E_PASSWORD.");
  await page.goto("/login/?next=/damage-calculator/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/damage-calculator\//);
});

test("calculates in both directions and resets field effects", async ({
  page,
}) => {
  for (const input of [
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ]) {
    await input.fill("Charizard");
    await input.press("Enter");
  }
  await expect(page.getByLabel("Gender")).toHaveCount(2);
  await page.getByLabel("Gender").nth(0).selectOption("F");
  await expect(page.getByLabel("Gender").nth(0)).toHaveValue("F");
  for (const input of [
    page.getByRole("combobox", { name: "Move 1", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Move 1", exact: true }).nth(1),
  ]) {
    await input.fill("Dragon Claw");
    await input.press("Enter");
  }
  await expect(page.locator(".damage-result").nth(0)).toContainText(/%/);
  await expect(page.locator(".damage-result").nth(6)).toContainText(/%/);

  await page.getByRole("button", { name: /Field Effects/ }).click();
  await page.getByLabel("single target", { exact: true }).nth(0).check();
  await page.getByLabel("tailwind", { exact: true }).nth(0).check();
  await expect(
    page.getByRole("button", { name: /Field Effects/ }),
  ).toContainText("left singleTarget");
  await page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .nth(0)
    .fill("Charizard");
  await page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .nth(0)
    .press("Enter");
  await expect(page.getByLabel("Gender").nth(0)).toHaveValue("M");
  await expect(
    page.getByRole("button", { name: /Field Effects/ }),
  ).toContainText("None active");
});

test("keeps every calculator control reachable on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Damage Calculator" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Pokémon", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: /Field Effects/ }),
  ).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= body.clientWidth),
  ).toBe(true);
});

test("keeps six independent slots and clamps local battle state", async ({
  page,
}) => {
  const pokemon = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .nth(0);
  await pokemon.fill("Char");
  await expect(page.getByRole("listbox")).toBeVisible();
  await pokemon.press("ArrowDown");
  await pokemon.press("Enter");
  await expect(pokemon).toHaveValue("Charizard");

  await expect(
    page.getByRole("combobox", { name: /^Move [1-6]$/ }),
  ).toHaveCount(6);
  const opponent = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .nth(1);
  await opponent.fill("Charizard");
  await opponent.press("Enter");
  await pokemon.fill("not a committed choice");
  await pokemon.press("Escape");
  await expect(pokemon).toHaveValue("Charizard");

  await expect(
    page.getByRole("combobox", { name: /^Move [1-6]$/ }),
  ).toHaveCount(12);
  await page.getByLabel("Attack SP").nth(0).fill("99");
  await expect(page.getByLabel("Attack SP").nth(0)).toHaveValue("32");
  await page
    .getByLabel(/Current HP/)
    .nth(0)
    .fill("99999");
  await expect(page.getByLabel(/Current HP/).nth(0)).not.toHaveValue("99999");
  await page.getByLabel("Speed stage").nth(0).selectOption("6");
  await expect(page.getByLabel("Speed stage").nth(0)).toHaveValue("6");

  const move = page
    .getByRole("combobox", { name: "Move 1", exact: true })
    .nth(0);
  await move.fill("Earthquake");
  await move.press("Enter");
  const result = page.locator(".damage-result").nth(0);
  await result.click();
  await expect(result).toHaveAttribute("aria-expanded", "true");
});

test("preserves combobox focus through navigation, commit, and Escape", async ({
  page,
}) => {
  const input = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await input.focus();
  await input.fill("Char");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toBeFocused();
  await input.fill("partial");
  await input.press("Escape");
  await expect(input).toHaveValue("Charizard");
  await expect(input).toBeFocused();
});

test("keeps move slot selections and contextual controls independent", async ({
  page,
}) => {
  for (const pokemon of [
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ]) {
    await pokemon.fill("Charizard");
    await pokemon.press("Enter");
  }
  const counter = page
    .getByRole("combobox", { name: "Move 1", exact: true })
    .first();
  await counter.fill("Counter");
  await counter.press("Enter");
  const beatUp = page
    .getByRole("combobox", { name: "Move 2", exact: true })
    .first();
  await beatUp.fill("Beat Up");
  await beatUp.press("Enter");
  await page.getByLabel("Prior damage taken").fill("40");
  await page.getByLabel("Ally 1 base Attack").fill("120");
  await expect(page.getByLabel("Prior damage taken")).toHaveValue("40");
  await expect(page.getByLabel("Ally 1 base Attack")).toHaveValue("120");
  await expect(page.locator(".damage-result").nth(0)).toContainText("80");
  await expect(page.locator(".damage-result").nth(1)).toContainText(/%/);
  await expect(
    page.getByRole("combobox", { name: /^Move [1-6]$/ }),
  ).toHaveCount(12);
});

test("applies legal defaults and keeps ability, item, and nature scoped", async ({
  page,
}) => {
  const pokemon = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await pokemon.fill("Charizard");
  await pokemon.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Ability", exact: true }).first(),
  ).toHaveValue("Blaze");
  await expect(
    page.getByRole("combobox", { name: "Nature", exact: true }).first(),
  ).toHaveValue("Serious");
  await expect(
    page.getByRole("combobox", { name: "Item", exact: true }).first(),
  ).toHaveValue("");
  await expect(page.getByLabel("HP SP").first()).toHaveValue("0");
  await expect(page.getByLabel(/Current HP/).first()).toHaveValue("153");
});

test("updates Mega form lock and resets owned state", async ({ page }) => {
  const pokemon = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await pokemon.fill("Charizard");
  await pokemon.press("Enter");
  const item = page
    .getByRole("combobox", { name: "Item", exact: true })
    .first();
  await commitChoice(page, item, "Charizardite X");
  const mega = page.getByRole("button", {
    name: "Preview Charizard-Mega-X",
    exact: true,
  });
  await expect(mega).toBeVisible();
  await mega.click();
  await expect(
    page.getByRole("combobox", { name: "Ability", exact: true }).first(),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Use base form", pressed: true }),
  ).toBeVisible();
});

test("recalculates for status and every damage-relevant stage", async ({
  page,
}) => {
  for (const pokemon of [
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ]) {
    await commitChoice(page, pokemon, "Charizard");
  }
  for (const [slot, name] of [
    [0, "Dragon Claw"],
    [1, "Flamethrower"],
  ] as const) {
    const input = page
      .getByRole("combobox", { name: `Move ${slot + 1}`, exact: true })
      .first();
    await input.fill(name);
    await input.press("Enter");
  }
  const changedAndRestored = async (
    resultIndex: number,
    control: ReturnType<typeof page.getByLabel>,
    value: string,
    restored = "0",
  ) => {
    const result = page.locator(".damage-result").nth(resultIndex);
    const baseline = await result.textContent();
    await control.selectOption(value);
    await expect(result).not.toHaveText(baseline ?? "");
    await control.selectOption(restored);
    await expect(result).toHaveText(baseline ?? "");
  };
  await changedAndRestored(0, page.getByLabel("Status").first(), "brn", "");
  await changedAndRestored(0, page.getByLabel("Attack stage").first(), "1");
  await changedAndRestored(0, page.getByLabel("Defense stage").nth(1), "1");
  await changedAndRestored(1, page.getByLabel("Sp. Atk stage").first(), "1");
  await changedAndRestored(1, page.getByLabel("Sp. Def stage").nth(1), "1");
  const attacker = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await commitChoice(page, attacker, "Jolteon");
  const speedMove = page
    .getByRole("combobox", { name: "Move 1", exact: true })
    .first();
  await commitChoice(page, speedMove, "Electro Ball");
  await changedAndRestored(0, page.getByLabel("Speed stage").nth(0), "6");
});

test("keeps directional fields independent and resets on Pokémon change", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Field Effects/ }).click();
  await page.getByLabel("tailwind", { exact: true }).first().check();
  await expect(
    page.getByLabel("tailwind", { exact: true }).nth(1),
  ).not.toBeChecked();
  const pokemon = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await pokemon.fill("Charizard");
  await pokemon.press("Enter");
  await expect(
    page.getByRole("button", { name: /Field Effects/ }),
  ).toContainText("None active");
});

test("announces recalculated results and supports keyboard disclosure", async ({
  page,
}) => {
  for (const pokemon of [
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ])
    await commitChoice(page, pokemon, "Charizard");
  const move = page
    .getByRole("combobox", { name: "Move 1", exact: true })
    .first();
  await commitChoice(page, move, "Dragon Claw");
  const result = page.locator(".damage-result").first();
  await expect(result).toBeEnabled();
  await expect(result).toContainText(/%/);
  await expect(result).toHaveAttribute("aria-live", "polite");
  await result.focus();
  await result.press("Enter");
  await expect(result).toHaveAttribute("aria-expanded", "true");
  await result.press("Escape");
  await expect(result).toHaveAttribute("aria-expanded", "false");
});

test("renders delayed loading state", async ({ page }) => {
  await page.route("**/damage-calculator/data/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  const reload = page.reload();
  await expect(page.getByText(/Loading calculation data/)).toBeVisible();
  await reload;
  await expect(
    page.getByRole("combobox", { name: "Pokémon", exact: true }).first(),
  ).toBeVisible();
});

test("renders unavailable state after dataset failure", async ({ page }) => {
  await page.route("**/damage-calculator/data/**", async (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.reload();
  await expect(
    page.getByText(/Damage calculation data could not be loaded/i),
  ).toBeVisible();
});

test("renders stale state after release conflict", async ({ page }) => {
  await page.route("**/damage-calculator/data/**", async (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: "{}" }),
  );
  await page.reload();
  await expect(page.getByText(/active Pokémon data changed/)).toBeVisible();
});

test("keeps the calculator available across M-A, M-B, and M-C", async ({
  page,
}) => {
  const regulation = page.getByLabel("Regulation");
  await expect(regulation.locator("option")).toHaveCount(3);
  for (const value of ["m-a", "m-b", "m-c"]) {
    await regulation.selectOption(value);
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.getByRole("heading", { name: "Damage Calculator" }),
    ).toBeVisible();
  }
});
