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

async function expectCalculatorReady(page: Page) {
  const pokemon = page.getByRole("combobox", {
    name: "Pokémon",
    exact: true,
  });
  const failure = page.getByRole("alert");
  await expect(pokemon.first().or(failure)).toBeVisible({ timeout: 15_000 });
  await expect(failure).toHaveCount(0);
  await expect(pokemon).toHaveCount(2);
}

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
  await expectCalculatorReady(page);
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
  await page
    .getByRole("group", { name: "Left" })
    .getByRole("button", { name: "Single Target" })
    .click();
  await page
    .getByRole("group", { name: "Left" })
    .getByRole("button", { name: "Tailwind" })
    .click();
  await expect(
    page.getByRole("button", { name: /Field Effects/ }),
  ).toContainText("Left: Single Target");
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
  await expect(page.getByText(/Level 50 · VGC doubles/)).toHaveCount(0);
  await expect(page.getByText(/Compare six moves/)).toHaveCount(0);
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

test("marks the active navigation section and centers calculator content", async ({
  page,
}) => {
  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    navigation.getByRole("link", { name: "Damage Calculator" }),
  ).toHaveAttribute("aria-current", "page");

  const calculator = await page.locator(".damage-calculator").boundingBox();
  const field = await page.locator(".field-effects").boundingBox();
  const matchup = await page.locator(".damage-matchup").boundingBox();
  const viewport = page.viewportSize();
  if (!calculator || !field || !matchup || !viewport)
    throw new Error("Calculator geometry is unavailable.");
  expect(
    Math.abs(calculator.x - (viewport.width - calculator.width - calculator.x)),
  ).toBeLessThan(2);
  expect(field.x).toBeCloseTo(matchup.x, 0);
  expect(field.width).toBeCloseTo(matchup.width, 0);

  await navigation.getByRole("link", { name: "Pokédex" }).click();
  const pokedexNavigation = page.getByRole("navigation", { name: "Primary" });
  await expect(pokedexNavigation.locator('[aria-current="page"]')).toHaveCount(
    1,
  );
  await expect(
    pokedexNavigation.getByRole("link", { name: "Pokédex" }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Team Builder" })
    .click();
  const teamNavigation = page.getByRole("navigation", { name: "Primary" });
  await expect(teamNavigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    teamNavigation.getByRole("link", { name: "Team Builder" }),
  ).toHaveAttribute("aria-current", "page");
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
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("Escape");
  await expect(input).toHaveValue("Charizard");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(input).not.toBeFocused();
  await page.keyboard.press("2");
  await expect(
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("1");
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
  const counterModifiers = page.getByRole("button", {
    name: "Counter modifiers",
    exact: true,
  });
  const beatUpModifiers = page.getByRole("button", {
    name: "Beat Up modifiers",
    exact: true,
  });
  await counterModifiers.click();
  await page.getByLabel("Prior damage taken").fill("40");
  if ((page.viewportSize()?.width ?? 1000) <= 720) {
    await page.getByRole("button", { name: "Dismiss modifier dialog" }).click({
      position: { x: 1, y: 1 },
    });
    await expect(page.getByLabel("Prior damage taken")).toHaveCount(0);
    await expect(counterModifiers).toBeFocused();
  }
  await beatUpModifiers.click();
  await expect(page.getByLabel("Prior damage taken")).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1000) <= 720)
    await expect(
      page.getByRole("dialog", { name: "Beat Up modifiers" }),
    ).toContainText("Beat Up modifiers");
  else await expect(beatUpModifiers).toBeFocused();
  const allyAttack = page.getByLabel("Ally 1 base Attack");
  await allyAttack.fill("120");
  await expect(allyAttack).toHaveValue("120");
  await expect(allyAttack).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(beatUpModifiers).toBeFocused();
  await counterModifiers.click();
  await expect(page.getByLabel("Prior damage taken")).toHaveValue("40");
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
  const leftTailwind = page
    .getByRole("group", { name: "Left" })
    .getByRole("button", { name: "Tailwind" });
  const rightTailwind = page
    .getByRole("group", { name: "Right" })
    .getByRole("button", { name: "Tailwind" });
  await leftTailwind.click();
  await expect(leftTailwind).toHaveAttribute("aria-pressed", "true");
  await expect(rightTailwind).toHaveAttribute("aria-pressed", "false");
  const pokemon = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await pokemon.fill("Charizard");
  await pokemon.press("Enter");
  await expect(
    page.getByRole("button", { name: /Field Effects/ }),
  ).toContainText("None active");
});

test("groups readable field summaries without changing toggle labels", async ({
  page,
}) => {
  const summary = page.getByRole("button", { name: /Field Effects/ });
  await expect(summary).toContainText("None active");
  await summary.click();
  await page
    .getByRole("group", { name: "Weather" })
    .getByRole("button", { name: "Sun" })
    .click();
  const grassy = page
    .getByRole("group", { name: "Terrain" })
    .getByRole("button", { name: "Grassy" });
  await grassy.click();
  await page
    .getByRole("group", { name: "Left" })
    .getByRole("button", { name: "Aurora Veil" })
    .click();
  await page
    .getByRole("group", { name: "Left" })
    .getByRole("button", { name: "Friend Guard" })
    .click();
  await page
    .getByRole("group", { name: "Right" })
    .getByRole("button", { name: "Helping Hand" })
    .click();
  await expect(summary.locator("small")).toHaveText(
    "Field: Sun, Grassy Terrain · Left: Aurora Veil, Friend Guard · Right: Helping Hand",
  );
  await expect(grassy).toHaveText("Grassy");
  const [labelBox, textBox] = await Promise.all([
    summary.locator("span").boundingBox(),
    summary.locator("small").boundingBox(),
  ]);
  if (!labelBox || !textBox)
    throw new Error("Field summary geometry unavailable.");
  expect(textBox.x).toBeCloseTo(labelBox.x, 0);
  expect(
    await summary.evaluate(
      (button) => button.scrollWidth <= button.clientWidth,
    ),
  ).toBe(true);
});

test("keeps paired panels aligned and compacts the control workflow", async ({
  page,
}) => {
  await commitChoice(
    page,
    page.getByRole("combobox", { name: "Pokémon", exact: true }).first(),
    "Charizard",
  );
  const left = page.getByRole("article", { name: "Left Pokémon" });
  const right = page.getByRole("article", { name: "Right Pokémon" });
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  await expect(page.getByText("Left Pokémon", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Right Pokémon", { exact: true })).toHaveCount(0);

  const [leftBox, rightBox] = await Promise.all([
    left.boundingBox(),
    right.boundingBox(),
  ]);
  const viewport = page.viewportSize();
  if (!leftBox || !rightBox || !viewport)
    throw new Error("Pokémon panel geometry unavailable.");
  if (viewport.width > 720) {
    expect(leftBox.height).toBeCloseTo(rightBox.height, 0);
  } else {
    expect(leftBox.height).toBeGreaterThan(rightBox.height + 100);
  }

  const nature = left.getByRole("combobox", { name: "Nature", exact: true });
  const currentHp = left.getByLabel(/Current HP/);
  await expect(currentHp).toHaveAccessibleName("Current HP");
  await expect(currentHp).toHaveAccessibleDescription("100.0%");
  const status = left.getByLabel("Status");
  const stats = left.getByRole("heading", { name: "Stats" });
  expect(
    await left.evaluate(
      (panel, selectors) => {
        const elements = selectors.map((selector) =>
          panel.querySelector(selector),
        );
        if (elements.some((element) => !element)) return false;
        return elements.every(
          (element, index) =>
            index === elements.length - 1 ||
            Boolean(
              element!.compareDocumentPosition(elements[index + 1]!) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
        );
      },
      ["#left-nature", "#left-current-hp", "#left-status", ".damage-stats"],
    ),
  ).toBe(true);
  await expect(nature).toBeVisible();
  await expect(currentHp).toBeVisible();
  await expect(status).toBeVisible();
  await expect(stats).toBeVisible();

  const attackSp = left.getByLabel("Attack SP");
  const attackStage = left.getByLabel("Attack stage");
  const attackStageId = await attackStage.getAttribute("id");
  expect(
    await attackSp.evaluate((input, stageId) => {
      const stage = document.getElementById(stageId ?? "");
      if (!stage || input.parentElement !== stage.parentElement) return false;
      const tracks = Array.from(input.parentElement!.children);
      return (
        input.nextElementSibling === stage &&
        tracks.indexOf(input) === 3 &&
        tracks.indexOf(stage) === 4
      );
    }, attackStageId),
  ).toBe(true);
  await expect(attackStage.locator("option")).toHaveCount(13);
  await expect(left.getByLabel("HP stage")).toHaveCount(0);
});

test("keeps native stat tracks aligned and constrained", async ({ page }) => {
  for (const pokemon of [
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ])
    await commitChoice(page, pokemon, "Charizard");
  const geometry = await page
    .getByRole("article", { name: "Left Pokémon" })
    .locator(".damage-stat")
    .evaluateAll((rows) =>
      rows.slice(1).map((row) => {
        const input =
          row.querySelector<HTMLInputElement>("input[type=number]")!;
        const select = row.querySelector<HTMLSelectElement>("select")!;
        const inputBox = input.getBoundingClientRect();
        const selectBox = select.getBoundingClientRect();
        const inputStyle = getComputedStyle(input);
        const selectStyle = getComputedStyle(select);
        return {
          inputX: inputBox.x,
          inputWidth: inputBox.width,
          inputHeight: inputBox.height,
          selectX: selectBox.x,
          selectWidth: selectBox.width,
          selectHeight: selectBox.height,
          inputBoxSizing: inputStyle.boxSizing,
          selectBoxSizing: selectStyle.boxSizing,
          inputMinWidth: inputStyle.minWidth,
          selectMinWidth: selectStyle.minWidth,
          rowRight: row.getBoundingClientRect().right,
        };
      }),
    );
  for (const row of geometry) {
    expect(row.inputHeight).toBeCloseTo(row.selectHeight, 0);
    expect(row.inputBoxSizing).toBe("border-box");
    expect(row.selectBoxSizing).toBe("border-box");
    expect(row.inputMinWidth).toBe("0px");
    expect(row.selectMinWidth).toBe("0px");
    expect(row.selectX + row.selectWidth).toBeLessThanOrEqual(row.rowRight + 1);
  }
  expect(new Set(geometry.map(({ inputX }) => Math.round(inputX))).size).toBe(
    1,
  );
  expect(new Set(geometry.map(({ selectX }) => Math.round(selectX))).size).toBe(
    1,
  );
});

test("keeps Mega geometry stable and restores the base ability", async ({
  page,
}) => {
  const pokemon = page
    .getByRole("combobox", { name: "Pokémon", exact: true })
    .first();
  await commitChoice(page, pokemon, "Charizard");
  const panel = page.getByRole("article", { name: "Left Pokémon" });
  const sprite = panel.locator(".damage-pokemon__visual > img");
  const header = panel.locator(".damage-pokemon__header");
  const initialSprite = await sprite.boundingBox();
  const initialHeader = await header.boundingBox();
  const ability = panel.getByRole("combobox", { name: "Ability" });
  await commitChoice(page, ability, "Solar Power");
  await commitChoice(
    page,
    panel.getByRole("combobox", { name: "Item" }),
    "Charizardite X",
  );
  const relatedSprite = await sprite.boundingBox();
  const relatedHeader = await header.boundingBox();
  if (!initialSprite || !initialHeader || !relatedSprite || !relatedHeader)
    throw new Error("Mega geometry is unavailable.");
  expect(relatedSprite).toEqual(initialSprite);
  expect(relatedHeader.height).toBeCloseTo(initialHeader.height, 0);
  const mega = panel.getByRole("button", { name: "Preview Charizard-Mega-X" });
  await mega.click();
  await expect(ability).toBeDisabled();
  await expect(ability).toHaveValue("Tough Claws");
  const megaSprite = await sprite.boundingBox();
  expect(megaSprite).toEqual(initialSprite);
  await panel.getByRole("button", { name: "Use base form" }).click();
  await expect(ability).toBeEnabled();
  await expect(ability).toHaveValue("Solar Power");
});

test("keeps sticky field effects bounded without duplicate page whitespace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 560 });
  for (const pokemon of [
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
  ])
    await commitChoice(page, pokemon, "Charizard");
  const field = page.locator(".field-effects");
  await expect(field).toHaveCSS("position", "sticky");
  const summary = page.getByRole("button", { name: /Field Effects/ });
  await summary.click();
  await expect(field).toHaveClass(/field-effects--open/);
  const body = field.locator(".field-effects__body");
  expect(
    await body.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect(
    page.getByRole("group", { name: "Right" }).getByRole("button", {
      name: "Tailwind",
    }),
  ).toBeVisible();

  const move6 = page
    .getByRole("combobox", { name: "Move 6", exact: true })
    .last();
  await move6.scrollIntoViewIfNeeded();
  await commitChoice(page, move6, "Dragon Claw");
  await expect(move6).toHaveValue("Dragon Claw");
  await summary.click();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const gap = await page
    .locator(".damage-calculator")
    .evaluate((calculator) => {
      const matchup = calculator.querySelector(".damage-matchup")!;
      const fieldEffects = calculator.querySelector(".field-effects")!;
      return (
        fieldEffects.getBoundingClientRect().top -
        matchup.getBoundingClientRect().bottom
      );
    });
  expect(gap).toBeGreaterThan(8);
  expect(gap).toBeLessThan(32);
});

test("uses pressed cells for mutually exclusive field conditions", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Field Effects/ }).click();
  const weather = page.getByRole("group", { name: "Weather" });
  const sun = weather.getByRole("button", { name: "Sun" });
  const rain = weather.getByRole("button", { name: "Rain" });
  const inactiveBackground = await rain.evaluate(
    (button) => getComputedStyle(button).backgroundColor,
  );
  await sun.click();
  await expect(sun).toHaveAttribute("aria-pressed", "true");
  await rain.focus();
  await rain.press("Enter");
  await expect(sun).toHaveAttribute("aria-pressed", "false");
  await expect(rain).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      rain.evaluate((button) => getComputedStyle(button).backgroundColor),
    )
    .not.toBe(inactiveBackground);
  await rain.press("Space");
  await expect(rain).toHaveAttribute("aria-pressed", "false");

  const terrain = page.getByRole("group", { name: "Terrain" });
  const electric = terrain.getByRole("button", { name: "Electric" });
  const grassy = terrain.getByRole("button", { name: "Grassy" });
  await electric.click();
  await grassy.click();
  await expect(electric).toHaveAttribute("aria-pressed", "false");
  await expect(grassy).toHaveAttribute("aria-pressed", "true");
});

test("recalculates and restores damage when field cells toggle", async ({
  page,
}) => {
  await commitChoice(
    page,
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(0),
    "Arcanine",
  );
  await commitChoice(
    page,
    page.getByRole("combobox", { name: "Pokémon", exact: true }).nth(1),
    "Charizard",
  );
  await commitChoice(
    page,
    page.getByRole("combobox", { name: "Move 1", exact: true }).nth(0),
    "Flamethrower",
  );
  await commitChoice(
    page,
    page.getByRole("combobox", { name: "Move 2", exact: true }).nth(0),
    "Thunder Fang",
  );

  const fireResult = page.locator(".damage-result").nth(0);
  const electricResult = page.locator(".damage-result").nth(1);
  const fireBaseline = await fireResult.textContent();
  const electricBaseline = await electricResult.textContent();
  if (!fireBaseline || !electricBaseline)
    throw new Error("Expected baseline damage results.");

  await page.getByRole("button", { name: /Field Effects/ }).click();
  const sun = page
    .getByRole("group", { name: "Weather" })
    .getByRole("button", { name: "Sun" });
  await sun.click();
  await expect(fireResult).not.toHaveText(fireBaseline);
  await sun.click();
  await expect(fireResult).toHaveText(fireBaseline);

  const electricTerrain = page
    .getByRole("group", { name: "Terrain" })
    .getByRole("button", { name: "Electric" });
  await electricTerrain.click();
  await expect(electricResult).not.toHaveText(electricBaseline);
  await electricTerrain.click();
  await expect(electricResult).toHaveText(electricBaseline);

  const helpingHand = page
    .getByRole("group", { name: "Left" })
    .getByRole("button", { name: "Helping Hand" });
  await helpingHand.click();
  await expect(fireResult).not.toHaveText(fireBaseline);
  await helpingHand.click();
  await expect(fireResult).toHaveText(fireBaseline);
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
  const loading = page.getByRole("status");
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("Loading damage calculator…");
  await expect(loading).toHaveAttribute("aria-busy", "true");
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
      page.getByRole("combobox", { name: "Pokémon", exact: true }).first(),
    ).toBeVisible();
  }
});
