import { expect, test, type Page, type TestInfo } from "@playwright/test";

let preparedTeamName = "";
let preparedTeamId = "";

const fixtureName = (testInfo: TestInfo) => {
  const project = testInfo.project.name
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(0, 12);
  const test = testInfo.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 12);
  return [
    "Battle-E2E",
    project,
    test,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
    Date.now().toString(36),
    crypto.randomUUID().slice(0, 8),
  ].join("-");
};

const prepareCalculableTeam = async (page: Page, testInfo: TestInfo) => {
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Team Builder" })
    .click();
  await page
    .getByRole("complementary", { name: "My Teams" })
    .getByRole("button", { name: "New Team" })
    .click();
  preparedTeamName = fixtureName(testInfo);
  await page.getByLabel("Team name").fill(preparedTeamName);
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  const picker = page.getByRole("dialog", { name: "Choose a Pokémon" });
  const pokemon = picker.getByRole("combobox");
  await pokemon.fill("Charizard");
  await pokemon.press("Enter");
  const member = page.locator(".member-card").first();
  await expect(member).toBeVisible();
  const ability = member.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  await ability.focus();
  await ability.press("Enter");
  await expect(ability).not.toHaveValue("");
  const move = member.getByRole("combobox", { name: "Move 1", exact: true });
  await move.fill("Dragon Claw");
  await move.press("Enter");
  await expect(move).toHaveValue("Dragon Claw");
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/teams/",
  );
  await page.getByRole("button", { name: "Save" }).click();
  const payload = await (await created).json();
  preparedTeamId = String(payload.data?.id ?? "");
  if (!preparedTeamId)
    throw new Error("The Battle Mode fixture team has no ID.");
  await expect(page.getByText("Team saved.")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Battle Mode" })
    .click();
  await expect(page).toHaveURL(/\/battle-mode\//);
};

test.beforeEach(async ({ page }, testInfo) => {
  preparedTeamName = "";
  preparedTeamId = "";
  const username = process.env.BAGREDEX_E2E_USERNAME;
  const password = process.env.BAGREDEX_E2E_PASSWORD;
  if (!username || !password)
    throw new Error("Set BAGREDEX_E2E_USERNAME and BAGREDEX_E2E_PASSWORD.");
  await page.goto("/login/?next=/battle-mode/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/battle-mode\//);
  await prepareCalculableTeam(page, testInfo);
});

const csrfToken = async (page: Page) =>
  (await page.context().cookies()).find(({ name }) => name === "csrftoken")
    ?.value ?? "";

const deletePreparedTeam = async (page: Page) => {
  if (!preparedTeamId || page.isClosed()) return;
  const remove = async () => {
    const csrf = await csrfToken(page);
    if (!csrf) return 0;
    const response = await page.request.delete(`/teams/${preparedTeamId}/`, {
      headers: { "X-CSRFToken": csrf },
      maxRedirects: 0,
    });
    return response.status();
  };
  let status = await remove();
  if ([204, 404].includes(status)) return;

  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/login/?next=/teams/");
  if (await page.getByLabel("Username").isVisible()) {
    const username = process.env.BAGREDEX_E2E_USERNAME;
    const password = process.env.BAGREDEX_E2E_PASSWORD;
    if (!username || !password) return;
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
  }
  status = await remove();
  if (![204, 404].includes(status))
    throw new Error(`Could not remove Battle Mode fixture team (${status}).`);
};

test.afterEach(async ({ page }) => {
  await deletePreparedTeam(page);
});

const preparedTeam = (page: Page) =>
  page.getByRole("radio", { name: new RegExp(preparedTeamName) });

test("starts a memory-only battle and supports rapid opponent entry", async ({
  page,
}) => {
  const team = preparedTeam(page);
  await expect(team).toBeVisible();
  await team.click();
  await page.getByRole("button", { name: "Start battle" }).click();
  await expect(page.getByRole("heading", { name: "Your team" })).toBeVisible();

  const opponent = page.getByLabel("Add opponent Pokémon");
  await opponent.fill("Charizard");
  await opponent.press("Enter");
  await expect(opponent).toBeFocused();
  await expect(opponent).toHaveValue("");
  await expect(page.getByText("Charizard added.")).toBeVisible();

  const charizard = page
    .locator(".battle-panel--opponent")
    .getByRole("button", { name: /Charizard/ })
    .first();
  await charizard.click();
  await page
    .getByRole("button", { name: "Opponent active slot 1, empty" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Charizard", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/100% HP becomes/)).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);

  const ownMember = page
    .locator(".battle-panel--own")
    .locator(".battle-roster__member")
    .first();
  await ownMember.click();
  await page.getByRole("button", { name: "Your active slot 1, empty" }).click();
  await expect(
    page.locator(".battle-move-result details strong").first(),
  ).toContainText("%");

  await charizard.click();
  const observedMove = page
    .locator(".battle-panel--opponent")
    .getByLabel("Move 1");
  await observedMove.selectOption({ index: 1 });
  await charizard.click();
  await expect(
    page.locator(".battle-move-result details strong").first(),
  ).toContainText("HP");
  await page.locator(".battle-move-result details").first().click();
  await expect(page.getByText(/Exact rolls:/).first()).toBeVisible();

  const opponentPanel = page.locator(".battle-panel--opponent");
  await opponentPanel.getByLabel("Current HP").fill("43");
  const opponentField = page.locator(".battle-board__side").filter({
    has: page.getByRole("heading", { name: "Opponent field" }),
  });
  await opponentField.getByRole("button", { name: "Bench Charizard" }).click();
  await expect(charizard).toBeVisible();
  await charizard.click();
  await page
    .getByRole("button", { name: "Opponent active slot 1, empty" })
    .click();
  await expect(opponentPanel.getByText("43%", { exact: true })).toBeVisible();
  await expect(opponentPanel.getByLabel("Move 1")).not.toHaveValue("");

  await ownMember.click();
  const ownLabel = await ownMember.locator("strong").textContent();
  if (!ownLabel) throw new Error("Own member label is unavailable.");
  const ownField = page.locator(".battle-board__side").filter({
    has: page.getByRole("heading", { name: "Your field" }),
  });
  await ownField.getByRole("button", { name: `Bench ${ownLabel}` }).click();
  await expect(ownMember).toBeVisible();
  await ownMember.click();
  await page.getByRole("button", { name: "Your active slot 1, empty" }).click();
});

test("warns before leaving an active battle and remains functional on phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparedTeam(page).click();
  await page.getByRole("button", { name: "Start battle" }).click();
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Pokédex" })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep battling" }).click();
  await expect(page).toHaveURL(/\/battle-mode\//);
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= body.clientWidth),
  ).toBe(true);
});

test("confirmed link navigation bypasses the native unload warning", async ({
  page,
}) => {
  await preparedTeam(page).click();
  await page.getByRole("button", { name: "Start battle" }).click();
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Pokédex" })
    .click();
  await page.getByRole("button", { name: "Discard battle" }).click();
  await expect(page).not.toHaveURL(/\/battle-mode\//);
});

test("confirmed logout and regulation navigation each leave exactly once", async ({
  page,
}) => {
  await preparedTeam(page).click();
  await page.getByRole("button", { name: "Start battle" }).click();
  const regulation = page.getByLabel("Regulation");
  const choices = await regulation
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  const current = await regulation.inputValue();
  const next = choices.find((value) => value !== current);
  if (!next)
    throw new Error("A second regulation is required for navigation coverage.");
  await regulation.selectOption(next);
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep battling" }).click();
  await expect(regulation).toBeFocused();
  await expect(page).toHaveURL(/\/battle-mode\//);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Discard battle" }).click();
  await expect(page).toHaveURL(/\/login\//);
});

test("exposes damage context, field state, and accessible keyboard placement", async ({
  page,
}) => {
  await preparedTeam(page).press("Space");
  await page.getByRole("button", { name: "Start battle" }).press("Enter");
  const ownMember = page
    .locator(".battle-panel--own")
    .locator(".battle-roster__member")
    .first();
  await ownMember.press("Enter");
  await page
    .getByRole("button", { name: "Your active slot 1, empty" })
    .press("Space");
  await page.getByRole("button", { name: "Rain" }).click();
  await page.getByRole("button", { name: "Trick Room" }).click();
  await expect(page.getByText("Rain weather selected manually.")).toBeVisible();
  await expect(
    page.getByText(/Trick Room orders slower unequal groups first/),
  ).toBeVisible();
  await expect(page.getByText(/turn-order group 1/)).toBeVisible();
});
