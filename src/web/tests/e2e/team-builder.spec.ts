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
  await page.setViewportSize({ width: 1515, height: 1029 });
  await expect(page.getByRole("heading", { name: "My Teams" })).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "My Teams" })
      .getByText(/Regulation/i),
  ).toHaveCount(0);
  const createButton = page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" });
  await expect(createButton).toHaveText("+");
  await expect(page.getByText("Create your first team")).toHaveCount(0);
  let promptOpened = false;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") promptOpened = true;
    await dialog.dismiss();
  });
  await createButton.click();
  const teamName = page.getByLabel("Team name");
  await expect(teamName).toHaveValue(/^Team \d+$/);
  await expect(teamName).toBeFocused();
  expect(
    await teamName.evaluate((input: HTMLInputElement) => [
      input.selectionStart,
      input.selectionEnd,
      input.value.length,
    ]),
  ).toEqual([
    0,
    (await teamName.inputValue()).length,
    (await teamName.inputValue()).length,
  ]);
  expect(promptOpened).toBe(false);
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const picker = page.getByRole("dialog", { name: "Choose a Pokémon" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("combobox")).toBeFocused();
  const pickerList = picker.locator("#pokemon-results");
  await expect(pickerList).toHaveClass(/search-list/);
  const pokemonTable = pickerList.getByRole("grid", {
    name: "Available Pokémon and base stats",
  });
  await expect(pokemonTable).toBeVisible();
  expect(
    await pokemonTable
      .getByRole("columnheader")
      .evaluateAll((headers) =>
        headers.map((header) =>
          header.textContent?.replace(/[↑↓]/g, "").trim(),
        ),
      ),
  ).toEqual(["Pokémon", "HP", "Atk", "Def", "SpA", "SpD", "Spe", "BST"]);
  const pokemonRows = pokemonTable.locator("tbody tr");
  await expect(pokemonRows.first()).toHaveClass(/is-active/);
  await expect(pokemonRows.first()).toHaveAttribute("aria-selected", "true");
  await expect(picker.getByRole("combobox")).toHaveAttribute(
    "aria-controls",
    "pokemon-result-grid",
  );
  await expect(picker.getByRole("combobox")).toHaveAttribute(
    "aria-haspopup",
    "grid",
  );
  const rowCells = pokemonRows.first().locator("th, td");
  expect(
    await rowCells.evaluateAll((cells) =>
      cells.map((cell) => getComputedStyle(cell).whiteSpace),
    ),
  ).toEqual(Array(8).fill("nowrap"));
  const rowTops = await rowCells.evaluateAll((cells) =>
    cells.map((cell) => Math.round(cell.getBoundingClientRect().top)),
  );
  expect(new Set(rowTops).size).toBe(1);
  const columnWidths = await pokemonTable
    .getByRole("columnheader")
    .evaluateAll((headers) =>
      headers.map((header) => header.getBoundingClientRect().width),
    );
  expect(columnWidths[0]).toBeGreaterThanOrEqual(288);
  for (const width of columnWidths.slice(1))
    expect(width).toBeLessThanOrEqual(64);
  expect(
    Math.max(...columnWidths.slice(1)) - Math.min(...columnWidths.slice(1)),
  ).toBeLessThanOrEqual(1);
  expect(
    await pokemonRows
      .first()
      .locator("strong")
      .evaluate((name) => name.scrollWidth <= name.clientWidth),
  ).toBe(true);
  const hpHeader = pokemonTable.getByRole("columnheader").nth(1);
  const hpHeaderButton = hpHeader.getByRole("button");
  const [labelBox, indicatorBox, headerButtonBox] = await Promise.all([
    hpHeaderButton.locator(".sort-label").boundingBox(),
    hpHeaderButton.locator(".sort-indicator").boundingBox(),
    hpHeaderButton.boundingBox(),
  ]);
  expect(indicatorBox?.y ?? 0).toBeGreaterThan(labelBox?.y ?? 0);
  expect(headerButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const statValues = await pokemonRows
    .first()
    .locator("td")
    .evaluateAll((values) => values.map((value) => Number(value.textContent)));
  expect(
    statValues.slice(0, 6).reduce((total, value) => total + value, 0),
  ).toBe(statValues[6]);
  await expect(pickerList).toHaveCSS("overflow-y", "scroll");
  await expect(pickerList).toHaveCSS("overflow-x", "hidden");
  await expect(pickerList).toHaveCSS("overscroll-behavior-y", "contain");
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await pickerList.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await picker
      .locator(".pokemon-picker-table__identity-copy")
      .first()
      .evaluate((identity) => getComputedStyle(identity).minWidth),
  ).toBe("0px");
  await page.setViewportSize({ width: 1515, height: 1029 });
  await picker.getByRole("combobox").press("End");
  await expect(pokemonRows.last()).toHaveClass(/is-active/);
  await picker.getByRole("combobox").press("Home");
  await expect(pokemonRows.first()).toHaveClass(/is-active/);
  const activeBeforeSort = await picker
    .getByRole("combobox")
    .getAttribute("aria-activedescendant");
  const hpSort = pokemonTable.getByRole("button", { name: "Sort by HP" });
  await pickerList.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  const horizontalScroll = await pickerList.evaluate(
    (element) => element.scrollLeft,
  );
  await hpSort.click();
  await expect(hpSort.locator("xpath=..")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await expect(picker.getByRole("combobox")).toHaveAttribute(
    "aria-activedescendant",
    activeBeforeSort ?? "",
  );
  expect(await pickerList.evaluate((element) => element.scrollLeft)).toBe(
    horizontalScroll,
  );
  await hpSort.click();
  await expect(hpSort.locator("xpath=..")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await hpSort.click();
  await expect(hpSort.locator("xpath=..")).toHaveAttribute("aria-sort", "none");
  await picker.getByRole("combobox").fill("a");
  await expect(picker.getByRole("option").first()).toBeVisible();
  const beforeGroupJump = await picker
    .getByRole("combobox")
    .getAttribute("aria-activedescendant");
  await picker.getByRole("combobox").press("Alt+ArrowDown");
  await expect(picker.getByRole("combobox")).not.toHaveAttribute(
    "aria-activedescendant",
    beforeGroupJump ?? "",
  );
  await expect(picker.getByRole("combobox")).toHaveAttribute(
    "aria-controls",
    "pokemon-filter-options",
  );
  await expect(picker.getByRole("combobox")).toHaveAttribute(
    "aria-haspopup",
    "listbox",
  );
  const activeFilterId = await picker
    .getByRole("combobox")
    .getAttribute("aria-activedescendant");
  await expect(picker.locator(`#${activeFilterId}`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
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
  await expect(sixth.getByLabel(/Nickname for/)).toBeFocused();
  await sixth.getByLabel(/Nickname for/).fill("Ace");
  await expect(sixth.getByRole("heading")).not.toHaveText("Ace");
  await sixth.getByLabel(/Nickname for/).press("Enter");
  await expect(
    sixth.getByRole("button", { name: /Edit nickname/ }),
  ).toBeFocused();
  await sixth.getByLabel("Ability").fill("not accepted");
  await sixth.getByLabel("Item").focus();
  await expect(sixth.getByLabel("Ability")).toHaveValue("not accepted");
  await expect(
    sixth.getByRole("button", { name: /Shiny colors/ }),
  ).toBeVisible();
  await expect(
    sixth.getByRole("button", { name: /item information/i }),
  ).toHaveCount(0);
  await expect(
    sixth.getByRole("button", { name: /ability information/i }),
  ).toHaveCount(0);
  let saveRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/teams/"
    )
      saveRequests += 1;
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(sixth.getByLabel("Ability")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(sixth.getByLabel("Ability")).toBeFocused();
  expect(saveRequests).toBe(0);
  await sixth.getByRole("button", { name: /Collapse/ }).click();
  await expect(sixth.locator(".collapsed-member__surface")).toBeFocused();
  await expect(sixth.getByText("Ace")).toBeVisible();
  await sixth.locator(".collapsed-member__surface").click();
  const nicknameEdit = sixth.getByRole("button", { name: /Edit nickname/ });
  await expect(nicknameEdit).toBeVisible();
  await nicknameEdit.click();
  await sixth.getByLabel(/Nickname for/).press("Escape");
  await expect(nicknameEdit).toBeFocused();

  const pokedexLink = page.getByRole("link", { name: "Pokédex" });
  await pokedexLink.click();
  const discard = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await expect(discard.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(discard).toBeHidden();
  await expect(pokedexLink).toBeFocused();
  await expect(page).toHaveURL(/\/teams\//);

  await page
    .locator("[data-regulation-selector] select")
    .dispatchEvent("change");
  await expect(
    page.getByRole("alertdialog", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  let nativeDialogs = 0;
  page.on("dialog", async (dialog) => {
    nativeDialogs += 1;
    await dialog.accept();
  });
  await pokedexLink.click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL(/\/(?:\?regulation=.*)?$/);
  expect(nativeDialogs).toBe(0);
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
  const glyph = await button.locator("span").boundingBox();
  expect(
    Math.abs(
      (box?.x ?? 0) +
        (box?.width ?? 0) / 2 -
        ((glyph?.x ?? 0) + (glyph?.width ?? 0) / 2),
    ),
  ).toBeLessThanOrEqual(1);
});

test("keeps library geometry stable and aligns builder content", async ({
  page,
}) => {
  const library = page.getByRole("complementary", { name: "My Teams" });
  const cards = library.locator("li button");
  await expect(page.getByText(/\/ 6 Pokémon/)).toHaveCount(0);
  if ((await cards.count()) === 0) return;
  await expect(cards.first().locator(".team-card__roster > *")).toHaveCount(6);
  const before = await library.boundingBox();
  await cards.first().click();
  await expect(page.getByLabel("Team name")).toBeVisible();
  const after = await library.boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.width).toBe(before?.width);
  const toolbar = await page.locator(".team-toolbar").boundingBox();
  const card = await page
    .locator(".member-card, .empty-slot")
    .first()
    .boundingBox();
  expect(Math.abs((toolbar?.x ?? 0) - (card?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(
    Math.abs((toolbar?.width ?? 0) - (card?.width ?? 0)),
  ).toBeLessThanOrEqual(1);
  const deleteButton = page.getByRole("button", { name: "Delete" });
  if (await deleteButton.isVisible()) {
    await deleteButton.click();
    const deleteDialog = page.getByRole("alertdialog", {
      name: "Delete this team?",
    });
    await expect(
      deleteDialog.getByRole("button", { name: "Delete team" }),
    ).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Cancel" }).click();
  }
  const statInput = page.locator('.sp-control input[type="number"]').first();
  if (await statInput.isVisible()) {
    const statBox = await statInput.boundingBox();
    expect(statBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(statBox?.width ?? 100).toBeLessThan(60);
    expect(
      await statInput.evaluate((node) => getComputedStyle(node).textAlign),
    ).toBe("center");
  }
  const member = page.locator(".member-card").first();
  if (await member.isVisible()) {
    const species = (await member.getByRole("heading").textContent()) ?? "";
    const collapsedSurface = member.locator(".collapsed-member__surface");
    if (await collapsedSurface.isVisible()) await collapsedSurface.click();
    await expect(
      member.getByRole("button", { name: /Edit nickname/ }),
    ).toBeVisible();
    expect(
      await member
        .locator(".member-heading")
        .evaluate((identity) =>
          [...identity.children].map((child) =>
            child.matches("h2") ? "species" : "nickname",
          ),
        ),
    ).toEqual(["species", "nickname"]);
    const slot = Number(await member.getAttribute("data-member-slot"));
    await member.getByRole("button", { name: /Collapse/ }).click();
    await page.keyboard.press(String(slot + 1));
    await expect(member).toHaveAttribute("aria-expanded", "true");
    await expect(member).toBeFocused();
    expect(species.trim().length).toBeGreaterThan(0);
    await expect(
      member.getByRole("button", { name: /item information/i }),
    ).toHaveCount(0);
    const abilityInfo = member.getByRole("button", {
      name: /ability information/i,
    });
    if ((await abilityInfo.count()) > 0) {
      await expect(abilityInfo).toHaveAttribute("tabindex", "-1");
      const ability = member.getByLabel("Ability");
      await ability.focus();
      await ability.press("Alt+i");
      const detail = page.getByRole("dialog");
      await expect(detail).toBeVisible();
      await detail.getByRole("button", { name: "Close details" }).click();
      await expect(ability).toBeFocused();
    }
  }
});
