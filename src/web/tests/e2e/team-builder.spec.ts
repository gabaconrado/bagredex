import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

let retainedFixtureTeamId = "";

const describedItemTeamName = (testInfo: TestInfo) =>
  [
    "Item-E2E",
    testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 12),
    testInfo.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 12),
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
    Date.now().toString(36),
    crypto.randomUUID().slice(0, 8),
  ].join("-");

async function createDraftWithDescribedItem(page: Page, testInfo: TestInfo) {
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await page.getByLabel("Team name").fill(describedItemTeamName(testInfo));
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  await page
    .getByRole("dialog", { name: "Choose a Pokémon" })
    .getByRole("combobox")
    .press("Enter");
  const member = page.locator(".member-card").first();
  await expect(member).toBeVisible();
  const ability = member.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  await ability.focus();
  await ability.press("Enter");
  const item = member.getByRole("combobox", { name: "Item", exact: true });
  await item.focus();
  await item.press("Enter");
  await expect(item).not.toHaveValue("");
  await expect(
    member.getByRole("combobox", { name: "Move 1", exact: true }),
  ).toBeFocused();
  await expect(
    member.getByRole("button", { name: /item information/i }),
  ).toHaveCount(1);
  return { member, item };
}

test.beforeEach(async ({ page }) => {
  retainedFixtureTeamId = "";
  const username = process.env.BAGREDEX_E2E_USERNAME;
  const password = process.env.BAGREDEX_E2E_PASSWORD;
  if (!username || !password)
    throw new Error("Set BAGREDEX_E2E_USERNAME and BAGREDEX_E2E_PASSWORD.");
  await page.goto("/login/?next=/teams/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/teams\//);
  await expect(page.getByRole("heading", { name: "My Teams" })).toBeVisible({
    timeout: 15_000,
  });
});

test.afterEach(async ({ page }) => {
  if (!retainedFixtureTeamId || page.isClosed()) return;
  const csrf = (await page.context().cookies()).find(
    ({ name }) => name === "csrftoken",
  )?.value;
  if (!csrf) throw new Error("Missing CSRF token for retained-team cleanup.");
  const response = await page.request.delete(
    `/teams/${retainedFixtureTeamId}/`,
    { headers: { "X-CSRFToken": csrf }, maxRedirects: 0 },
  );
  if (![204, 404].includes(response.status()))
    throw new Error(
      `Could not remove retained Team Builder fixture (${response.status()}).`,
    );
});

test("renders a centralized initial loading state", async ({ page }) => {
  let releaseData!: () => void;
  const dataGate = new Promise<void>((resolve) => {
    releaseData = resolve;
  });
  await page.route("**/teams/data/**", async (route) => {
    await dataGate;
    await route.continue();
  });
  const reload = page.reload({ waitUntil: "domcontentloaded" });
  const loading = page.getByRole("status");
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("Loading Team Builder…");
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".team-builder-app")).toHaveCount(0);
  releaseData();
  await reload;
  await page.unroute("**/teams/data/**");
  await expect(page.getByRole("heading", { name: "My Teams" })).toBeVisible();
});

test("imports and exports a draft atomically before explicit save", async ({
  page,
}) => {
  let saveRequests = 0;
  page.on("request", (request) => {
    if (
      ["POST", "PUT"].includes(request.method()) &&
      new URL(request.url()).pathname.startsWith("/teams/")
    )
      saveRequests += 1;
  });
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  const teamName = page.getByRole("textbox", { name: "Team name" });
  await expect(teamName).toBeVisible();
  await expect(page.locator('label[for="team-name"]')).toHaveCount(0);
  const importedName = `Import-E2E-${Date.now().toString(36)}`;
  await teamName.fill(importedName);
  await page.getByRole("button", { name: "Import/Export" }).click();
  let dialog = page.getByRole("dialog", { name: "Import or export team" });
  const text = dialog.getByRole("textbox", { name: "Team text" });
  await expect(text).toHaveValue("");
  const importedSet = [
    "Blaze (Charizard) @ Sitrus Berry",
    "Ability: Blaze",
    "Shiny: Yes",
    "EVs: 32 HP / 2 SpA / 32 Spe",
    "Timid Nature",
    "- Heat Wave",
    "- Protect",
    "",
    "heleno (Gengar-Mega) @ Gengarite",
    "Ability: Shadow Tag",
    "EVs: 2 HP / 32 SpA / 32 Spe",
    "Timid Nature",
    "Shiny: Yes",
    "",
    "neneca (Raichu-Mega-X) @ Raichunite X",
    "Ability: Electric Surge",
    "EVs: 32 HP / 1 Def / 1 SpD / 32 Spe",
    "Jolly Nature",
    "Shiny: Yes",
  ].join("\n");
  const canonicalSet = [
    "Blaze (Charizard) @ Sitrus Berry",
    "Ability: Blaze",
    "Shiny: Yes",
    "SPs: 32 HP / 2 SpA / 32 Spe",
    "Timid Nature",
    "- Heat Wave",
    "- Protect",
    "",
    "heleno (Gengar) @ Gengarite",
    "Ability: Cursed Body",
    "Shiny: Yes",
    "SPs: 2 HP / 32 SpA / 32 Spe",
    "Timid Nature",
    "",
    "neneca (Raichu) @ Raichunite X",
    "Ability: Static",
    "Shiny: Yes",
    "SPs: 32 HP / 1 Def / 1 SpD / 32 Spe",
    "Jolly Nature",
  ].join("\n");
  await text.fill(importedSet);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Charizard" })).toBeVisible();
  expect(saveRequests).toBe(0);

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/teams/",
  );
  await page.getByRole("button", { name: "Save" }).click();
  const createdPayload = await (await created).json();
  retainedFixtureTeamId = String(
    createdPayload.data?.id ?? createdPayload.id ?? "",
  );
  expect(retainedFixtureTeamId).not.toBe("");

  await page.reload();
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button")
    .filter({ has: page.getByText(importedName, { exact: true }) })
    .click();
  await expect(page.getByRole("textbox", { name: "Team name" })).toHaveValue(
    importedName,
  );

  await page.getByRole("button", { name: "Import/Export" }).click();
  dialog = page.getByRole("dialog", { name: "Import or export team" });
  const exported = dialog.getByRole("textbox", { name: "Team text" });
  await expect(exported).toHaveValue(canonicalSet);
  await exported.fill("Missingno");
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("unknown");
  await expect(page.getByRole("heading", { name: "Charizard" })).toBeVisible();
  expect(saveRequests).toBe(1);

  const variedSet = [
    "blaze (charizard) (M) @ sitrus-berry",
    "Trait: BLAZE",
    "Shiny: Yes",
    "EVs: 32 hp / 2 spa / 32 spe",
    "timid Nature",
    "- heat wave",
    "- protect",
    "",
    "heleno (gengar-mega) @ gengarite",
    "Ability: SHADOW TAG",
    "EVs: 2 hp / 32 spa / 32 spe",
    "timid Nature",
    "Shiny: Yes",
    "",
    "neneca (raichu-mega-x) @ raichunite-x",
    "Ability: ELECTRIC SURGE",
    "EVs: 32 hp / 1 def / 1 spd / 32 spe",
    "jolly Nature",
    "Shiny: Yes",
  ].join("\n");
  await exported.fill(variedSet);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saveRequests).toBe(1);
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  const updated = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/teams/${retainedFixtureTeamId}/`,
  );
  await page.getByRole("button", { name: "Save" }).click();
  const updatedResponse = await updated;
  expect(updatedResponse.ok()).toBe(true);
  const submitted = updatedResponse.request().postDataJSON();
  expect(submitted.members).toEqual([
    {
      position: 0,
      pokemon: "charizard",
      nickname: "blaze",
      ability: "blaze",
      item: "sitrusberry",
      moves: ["heatwave", "protect", null, null],
      nature: "timid",
      sp: {
        hp: 32,
        attack: 0,
        defense: 0,
        special_attack: 2,
        special_defense: 0,
        speed: 32,
      },
      shiny: true,
      mega_preview: false,
    },
    {
      position: 1,
      pokemon: "gengar",
      nickname: "heleno",
      ability: "cursedbody",
      item: "gengarite",
      moves: [null, null, null, null],
      nature: "timid",
      sp: {
        hp: 2,
        attack: 0,
        defense: 0,
        special_attack: 32,
        special_defense: 0,
        speed: 32,
      },
      shiny: true,
      mega_preview: true,
    },
    {
      position: 2,
      pokemon: "raichu",
      nickname: "neneca",
      ability: "static",
      item: "raichunitex",
      moves: [null, null, null, null],
      nature: "jolly",
      sp: {
        hp: 32,
        attack: 0,
        defense: 1,
        special_attack: 0,
        special_defense: 1,
        speed: 32,
      },
      shiny: true,
      mega_preview: true,
    },
  ]);
  expect(saveRequests).toBe(2);
});

test("groups selectable forms and keeps both Meowstic identities", async ({
  page,
}) => {
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Choose a Pokémon" });
  const search = dialog.getByRole("combobox");
  await search.fill("Castform");
  await expect(dialog.getByRole("row", { name: /Castform/ })).toHaveCount(1);
  await expect(dialog.getByText("Castform-Rainy", { exact: true })).toHaveCount(
    0,
  );
  await dialog.getByRole("row", { name: /Castform/ }).click();
  const member = page.locator(".member-card").first();
  const form = member.getByRole("combobox", { name: "Form", exact: true });
  await expect(form).toHaveValue("castform");
  await form.selectOption("castformrainy");
  await expect(form).toHaveValue("castformrainy");
  await expect(
    member.getByRole("heading", { name: /Castform-Rainy/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const secondDialog = page.getByRole("dialog", { name: "Choose a Pokémon" });
  await secondDialog.getByRole("combobox").fill("Meowstic");
  await expect(
    secondDialog.getByText("Meowstic-Male", { exact: true }),
  ).toBeVisible();
  await expect(
    secondDialog.getByText("Meowstic-Female", { exact: true }),
  ).toBeVisible();
});

test("saves and reloads the exact female Meowstic profile", async ({
  page,
}) => {
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  const teamName = `Female-Meowstic-${Date.now().toString(36)}`;
  await page.getByLabel("Team name").fill(teamName);
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Choose a Pokémon" });
  await dialog.getByRole("combobox").fill("Meowstic");
  await dialog.getByRole("row", { name: /^Meowstic-Female / }).click();
  const member = page.locator(".member-card").first();
  await expect(
    member.getByRole("heading", { name: "Meowstic-F", exact: true }),
  ).toBeVisible();
  const ability = member.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  await ability.focus();
  await ability.press("Enter");
  await expect(ability).not.toHaveValue("");
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/teams/",
  );
  await page.getByRole("button", { name: "Save" }).click();
  const payload = await (await created).json();
  retainedFixtureTeamId = String(payload.data?.id ?? payload.id ?? "");
  expect(retainedFixtureTeamId).not.toBe("");
  expect(
    payload.data?.members?.[0]?.pokemon ?? payload.members?.[0]?.pokemon,
  ).toBe("meowsticf");

  await page.reload();
  const library = page.getByRole("complementary", { name: "My Teams" });
  await library
    .getByRole("button")
    .filter({ has: page.getByText(teamName, { exact: true }) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meowstic-F", exact: true }),
  ).toBeVisible();
  const sprite = page.locator(".member-card img").first();
  await expect(sprite).toHaveAttribute("alt", "");
  await expect(sprite).toHaveAttribute("src", /\/meowsticf\/normal\.webp$/);
});

test("clamps SP shortcuts and selects Mega search entries atomically", async ({
  page,
}) => {
  let submittedMember: Record<string, unknown> | undefined;
  let responseVersion = "";
  let responseRegulation: { id: string; name: string } | undefined;
  await page.route("**/teams/", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const submitted = route.request().postDataJSON();
    submittedMember = submitted.members[0];
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "isolated-mega-e2e",
        name: submitted.name,
        updated_at: "2026-11-01T00:00:00Z",
        pinned: {
          version: responseVersion,
          regulation: responseRegulation,
        },
        members: submitted.members,
      }),
    });
  });
  const bootstrap = JSON.parse(
    (await page.locator("#team-builder-bootstrap").textContent()) ?? "null",
  ) as { dataset_url: string };
  const dataset = await (await page.request.get(bootstrap.dataset_url)).json();
  responseVersion = dataset.data_version;
  responseRegulation = dataset.regulation;
  const mega = dataset.mega_search_entries[0];
  const base = dataset.forms.find(
    ({ id }: { id: string }) => id === mega.base_form_id,
  );
  const stone = dataset.items.find(
    ({ id }: { id: string }) => id === mega.item_id,
  );
  expect(base, "Mega fixture base form").toBeTruthy();
  expect(stone, "Mega fixture stone").toBeTruthy();
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const picker = page.getByRole("dialog", { name: "Choose a Pokémon" });
  await picker.getByRole("combobox").fill(mega.name);
  const megaRow = picker.getByRole("row").filter({ hasText: mega.name });
  await expect(megaRow).toBeVisible();
  await megaRow.click();

  const member = page.locator(".member-card").first();
  await expect(member.getByRole("heading")).toHaveText(base.name);
  await expect(member.getByRole("heading")).not.toHaveText(mega.name);
  await expect(member.getByRole("combobox", { name: "Item" })).toHaveValue(
    stone.name,
  );
  await expect(
    member.getByRole("button", { name: "Hide Mega preview" }),
  ).toBeVisible();

  const max = member.getByRole("button", { name: "Max" });
  await max.nth(0).click();
  await max.nth(1).click();
  await max.nth(2).click();
  await expect(member.getByText("66 / 66")).toBeVisible();
  await expect(member.getByRole("spinbutton", { name: "Defense" })).toHaveValue(
    "2",
  );
  await member.getByRole("button", { name: "0" }).nth(0).click();
  await expect(member.getByRole("spinbutton", { name: "HP" })).toHaveValue("0");

  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => submittedMember).toBeTruthy();
  expect(submittedMember?.pokemon).toBe(mega.base_form_id);
  expect(submittedMember?.pokemon).not.toBe(mega.id);
  expect(submittedMember?.item).toBe(mega.item_id);
  expect(submittedMember?.mega_preview).toBe(true);
  await expect(page.getByText("Team saved.")).toBeVisible();
});

test("updates Real Stats immediately from normalized held-item modifiers", async ({
  page,
}) => {
  const bootstrap = JSON.parse(
    (await page.locator("#team-builder-bootstrap").textContent()) ?? "null",
  ) as { dataset_url: string };
  const dataset = await (await page.request.get(bootstrap.dataset_url)).json();
  const item = dataset.items.find(
    (choice: { stat_modifiers: { stat: string }[] }) =>
      choice.stat_modifiers.some((modifier) => modifier.stat === "spe"),
  );
  expect(item, "legal normalized Speed modifier fixture").toBeTruthy();
  const speedModifier = item.stat_modifiers.find(
    (modifier: { stat: string; eligibility: string }) =>
      modifier.stat === "spe" && modifier.eligibility === "always",
  );
  expect(speedModifier, "always-active Speed modifier fixture").toBeTruthy();
  const form = dataset.forms.find(
    (choice: { ability_ids: string[] }) => choice.ability_ids.length > 0,
  );
  const ability = dataset.abilities.find(
    (choice: { id: string; suppresses_held_item: boolean }) =>
      form.ability_ids.includes(choice.id) && !choice.suppresses_held_item,
  );
  expect(ability, "non-suppressing ability fixture").toBeTruthy();

  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const picker = page.getByRole("dialog", { name: "Choose a Pokémon" });
  await picker.getByRole("combobox").fill(form.name);
  await picker.getByRole("row").filter({ hasText: form.name }).first().click();
  const member = page.locator(".member-card").first();
  const abilityInput = member.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  await abilityInput.fill(ability.name);
  await abilityInput.press("Enter");
  const itemInput = member.getByRole("combobox", { name: "Item", exact: true });
  await itemInput.fill(item.name);
  await itemInput.press("Enter");

  const displayedSpeed = member
    .locator(".real-stats")
    .getByText("Speed", { exact: true })
    .locator("..")
    .locator("dd");
  const rawSpeed = form.base_stats.speed + 20;
  const effectiveSpeed = Math.ceil(
    (rawSpeed * speedModifier.numerator) / speedModifier.denominator - 0.5,
  );
  await expect(displayedSpeed).toHaveText(String(effectiveSpeed));
  await itemInput.fill("");
  await itemInput.press("Tab");
  await expect(displayedSpeed).toHaveText(String(rawSpeed));
});

test("removes an expanded member from the header action group", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  await page
    .getByRole("dialog", { name: "Choose a Pokémon" })
    .getByRole("combobox")
    .press("Enter");
  const member = page.locator(".member-card").first();
  const species = (await member.getByRole("heading").textContent())?.trim();
  expect(species).toBeTruthy();
  const remove = member.getByRole("button", {
    name: `Remove ${species}`,
    exact: true,
  });
  await expect(remove).toHaveCount(1);
  await expect(
    member.getByRole("button", { name: `Collapse ${species}`, exact: true }),
  ).toBeVisible();
  expect(
    await member
      .locator(".member-actions button")
      .evaluateAll((buttons) => buttons.map((button) => button.textContent)),
  ).toEqual(["Collapse", "Remove"]);
  expect(
    await member
      .locator(".member-card__header")
      .evaluate((header) => header.scrollWidth <= header.clientWidth),
  ).toBe(true);
  await remove.click();
  await expect(member).toHaveCount(0);
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

  await page.keyboard.press("6");
  await expect(
    page.getByRole("dialog", { name: "Choose a Pokémon" }),
  ).toBeVisible();
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
  const sixthAbility = sixth.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  const sixthItem = sixth.getByRole("combobox", {
    name: "Item",
    exact: true,
  });
  await sixthAbility.fill("not accepted");
  await sixthItem.focus();
  await sixthItem.press("Enter");
  await expect(sixthAbility).toHaveValue("not accepted");
  await expect(
    sixth.getByRole("button", { name: /Shiny colors/ }),
  ).toBeVisible();
  const itemInfo = sixth.getByRole("button", { name: /item information/i });
  await expect(itemInfo).toHaveCount(1);
  await expect(itemInfo).toHaveAttribute("tabindex", "-1");
  let informationRequests = 0;
  page.on("request", () => {
    informationRequests += 1;
  });
  const requestsBeforeInformation = informationRequests;
  await sixthItem.press("Alt+i");
  const itemDialog = page.getByRole("dialog");
  await expect(itemDialog).toBeVisible();
  await expect(itemDialog.getByRole("heading")).not.toBeEmpty();
  await itemDialog.getByRole("button", { name: "Close details" }).click();
  await expect(sixthItem).toBeFocused();
  expect(informationRequests).toBe(requestsBeforeInformation);
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
  await expect(sixthAbility).toHaveAttribute("aria-invalid", "true");
  await expect(sixthAbility).toBeFocused();
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

test("keeps a retained legacy Item editable without offering unavailable information", async ({
  page,
}, testInfo) => {
  const { item } = await createDraftWithDescribedItem(page, testInfo);
  const itemName = await item.inputValue();
  const teamName = await page.getByLabel("Team name").inputValue();
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/teams/",
  );
  await page.getByRole("button", { name: "Save" }).click();
  const createdPayload = await (await created).json();
  retainedFixtureTeamId = String(createdPayload.data?.id ?? "");
  if (!retainedFixtureTeamId)
    throw new Error("The retained Team Builder fixture has no ID.");
  await expect(page.getByText("Team saved.")).toBeVisible();

  const retainedVersion = "showdown-retained-s3-i4-111111111111";
  const bootstrap = JSON.parse(
    (await page.locator("#team-builder-bootstrap").textContent()) ?? "null",
  );
  const activeResponse = await page.request.get(bootstrap.dataset_url);
  const activeDataset = await activeResponse.json();
  let retainedTeamResponse: Record<string, any> | null = null;
  let retainedSaveObserved = false;
  await page.route("**/teams/*/", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!/^\/teams\/[^/]+\/$/.test(path)) {
      await route.continue();
      return;
    }
    if (request.method() === "GET") {
      const response = await route.fetch();
      const payload = await response.json();
      payload.data.pinned.version = retainedVersion;
      retainedTeamResponse = payload;
      await route.fulfill({ response, json: payload });
      return;
    }
    if (request.method() === "PUT" && retainedTeamResponse) {
      const draft = request.postDataJSON();
      expect(retainedTeamResponse.data.pinned.version).toBe(retainedVersion);
      expect(draft.schema_version).toBe("team-draft-v1");
      expect(draft.members[0].nickname).toBe("Legacy");
      expect(draft.members[0].item).toBe(
        retainedTeamResponse.data.members[0].item,
      );
      expect(draft.members[0].item).toBeTruthy();
      const saved = structuredClone(retainedTeamResponse);
      saved.data.name = draft.name;
      saved.data.members = draft.members;
      saved.data.updated_at = new Date().toISOString();
      retainedSaveObserved = true;
      await route.fulfill({ status: 200, json: saved });
      return;
    }
    await route.continue();
  });
  await page.route(`**/teams/data/${retainedVersion}/*/`, async (route) => {
    const retainedDataset = structuredClone(activeDataset);
    retainedDataset.data_version = retainedVersion;
    retainedDataset.items = retainedDataset.items.map(
      (choice: Record<string, unknown>) => ({
        ...choice,
        short_description: null,
        description: null,
      }),
    );
    await route.fulfill({ status: 200, json: retainedDataset });
  });

  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  await page
    .getByRole("complementary", { name: "My Teams" })
    .locator("li button")
    .filter({ has: page.getByText(teamName, { exact: true }) })
    .click();
  const discard = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await expect(discard).toBeVisible();
  await discard
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  const retainedMember = page.locator(".member-card").first();
  await expect(retainedMember).toBeVisible();
  const collapsedSurface = retainedMember.locator(".collapsed-member__surface");
  if (await collapsedSurface.isVisible()) await collapsedSurface.click();
  const retainedItem = retainedMember.getByRole("combobox", {
    name: "Item",
    exact: true,
  });
  await expect(retainedItem).toBeVisible();
  await expect(retainedItem).toHaveValue(itemName);
  await expect(
    retainedMember.getByRole("button", { name: /item information/i }),
  ).toHaveCount(0);
  await expect(retainedItem).not.toHaveAttribute(
    "aria-describedby",
    /item-info-description/,
  );

  await retainedMember.getByRole("button", { name: /Edit nickname/ }).click();
  await retainedMember.getByLabel(/Nickname for/).fill("Legacy");
  await retainedMember.getByLabel(/Nickname for/).press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Team saved.")).toBeVisible();
  expect(retainedSaveObserved).toBe(true);
  await expect(retainedItem).toHaveValue(itemName);
});

test("opens described Item information by touch without a request", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { member, item } = await createDraftWithDescribedItem(page, testInfo);
  const information = member.getByRole("button", {
    name: /item information/i,
  });
  await information.focus();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).not.toBeEmpty();

  let requests = 0;
  page.on("request", () => {
    requests += 1;
  });
  const before = requests;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0))
    await information.tap();
  else await information.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText(await item.inputValue());
  await expect(dialog.locator(".info-description")).not.toBeEmpty();
  expect(requests).toBe(before);
  await dialog.getByRole("button", { name: "Close details" }).click();
  await expect(information).toBeFocused();
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
  await expect(page.locator(".team-workspace")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
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
    const abilityInfo = member.getByRole("button", {
      name: /ability information/i,
    });
    if ((await abilityInfo.count()) > 0) {
      await expect(abilityInfo).toHaveAttribute("tabindex", "-1");
      const ability = member.getByRole("combobox", {
        name: "Ability",
        exact: true,
      });
      await ability.focus();
      await ability.press("Alt+i");
      const detail = page.getByRole("dialog");
      await expect(detail).toBeVisible();
      await detail.getByRole("button", { name: "Close details" }).click();
      await expect(ability).toBeFocused();
    }
  }
});
