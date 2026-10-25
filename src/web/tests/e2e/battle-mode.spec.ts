import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

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

const selectComboboxOption = async (
  scope: Locator,
  input: Locator,
  optionName: string,
) => {
  await input.focus();
  await input.fill(optionName);
  const listbox = scope.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const option = listbox.getByRole("option", {
    name: optionName,
    exact: true,
  });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute("aria-selected", "true");
  await option.click();
  await expect(input).toHaveValue(optionName);
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
  await selectComboboxOption(member, move, "Dragon Claw");
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

const selectPreparedTeam = async (page: Page) => {
  await page.getByRole("button", { name: /Your team/ }).click();
  const team = page
    .getByRole("dialog", { name: "Choose your team" })
    .getByRole("button", { name: new RegExp(preparedTeamName) });
  await expect(team).toBeEnabled();
  await team.click();
  await expect(
    page.getByRole("dialog", { name: "Choose your team" }),
  ).toBeHidden();
};

test("starts a memory-only battle and supports rapid opponent entry", async ({
  page,
}) => {
  // This comprehensive interaction path takes ~31s on the reduced-motion tablet project.
  test.setTimeout(45_000);
  await selectPreparedTeam(page);
  await expect(page.getByRole("button", { name: /Your team/ })).toContainText(
    preparedTeamName,
  );

  const addOpponent = page.getByRole("button", {
    name: "Add opponent Pokémon",
  });
  await addOpponent.click();
  const opponent = page.getByLabel("Add opponent Pokémon");
  await opponent.fill("MissingNo");
  await opponent.press("Enter");
  await expect(
    page.getByText("Choose a legal Pokémon from the suggestions."),
  ).toBeVisible();
  await opponent.fill("Charizard");
  await expect(
    page.locator("#battle-opponent-options kbd", { hasText: "Enter" }),
  ).toHaveCount(1);
  await opponent.press("Enter");
  await expect(addOpponent).toBeFocused();
  await expect(page.getByText("Charizard added.")).toHaveCount(0);

  await addOpponent.click();
  const reopenedOpponent = page.getByLabel("Add opponent Pokémon");
  await reopenedOpponent.fill("Charizard");
  await expect(page.getByRole("option", { name: /Charizard/ })).toHaveCount(0);
  await reopenedOpponent.press("Escape");

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
  const opponentPanel = page.locator(".battle-panel--opponent");
  const charizardAbility = opponentPanel.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  await expect(charizardAbility).not.toHaveValue("");
  await expect(charizardAbility).not.toHaveAttribute("placeholder");
  const charizardItem = opponentPanel.getByRole("combobox", {
    name: "Item",
    exact: true,
  });
  await expect(charizardItem).toHaveValue("");
  await expect(charizardItem).not.toHaveAttribute("placeholder");
  const charizardMove = opponentPanel.getByRole("combobox", {
    name: "Move 1",
    exact: true,
  });
  await expect(charizardMove).toHaveValue("");
  await expect(charizardMove).not.toHaveAttribute("placeholder");
  await charizardItem.focus();
  await charizardItem.press("Enter");
  const heldItem = await charizardItem.inputValue();
  expect(heldItem).not.toBe("");
  await expect(page.getByRole("main")).toHaveCount(1);

  await addOpponent.click();
  const secondOpponentInput = page.getByLabel("Add opponent Pokémon");
  await secondOpponentInput.fill("Blastoise");
  await secondOpponentInput.press("Enter");
  const blastoise = page
    .locator(".battle-panel--opponent")
    .getByRole("button", { name: /Blastoise/ })
    .first();
  await blastoise.click();
  await page
    .getByRole("button", { name: "Opponent active slot 2, empty" })
    .click();
  await expect(opponentPanel.locator(".battle-editor")).toHaveCount(1);
  await expect(
    opponentPanel.getByRole("heading", { name: "Charizard", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select Blastoise as attacker" })
    .click();
  const blastoiseAbility = opponentPanel.getByRole("combobox", {
    name: "Ability",
    exact: true,
  });
  await blastoiseAbility.focus();
  await blastoiseAbility.press("Enter");
  await expect(blastoiseAbility).not.toHaveValue("");
  const blastoiseItem = opponentPanel.getByRole("combobox", {
    name: "Item",
    exact: true,
  });
  await blastoiseItem.fill(heldItem);
  await expect(
    opponentPanel.getByRole("option", { name: heldItem, exact: true }),
  ).toHaveCount(0);
  await blastoiseItem.press("Escape");
  await expect(
    opponentPanel.getByRole("heading", { name: "Blastoise", exact: true }),
  ).toBeVisible();
  await charizard.click();
  await expect(
    opponentPanel.getByRole("heading", { name: "Blastoise", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select Charizard as attacker" })
    .click();

  const turnOrder = page.locator(".battle-order");
  const untiedTurnOrderBox = await turnOrder.boundingBox();
  if (!untiedTurnOrderBox)
    throw new Error("Turn Order layout is unavailable before the Speed tie.");

  const ownMember = page
    .locator(".battle-panel--own")
    .locator(".battle-roster__member")
    .first();
  const ownLabel = await ownMember.locator("strong").textContent();
  if (!ownLabel) throw new Error("Own member label is unavailable.");
  const ownField = page.locator(".battle-board__side").filter({
    has: page.getByRole("heading", { name: "Your field" }),
  });
  await ownMember.click();
  await page.getByRole("button", { name: "Your active slot 1, empty" }).click();
  const tiedTurnOrderBox = await turnOrder.boundingBox();
  if (!tiedTurnOrderBox)
    throw new Error("Turn Order layout is unavailable during the Speed tie.");
  expect(tiedTurnOrderBox.height).toBeGreaterThan(untiedTurnOrderBox.height);
  const tiedSpeedCards = turnOrder.locator("li.is-tied .battle-order__member");
  await expect(tiedSpeedCards).toHaveCount(2);
  const tiedCardBoxes = await tiedSpeedCards.evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().height),
  );
  const untiedCardHeight = await turnOrder
    .locator("li:not(.is-tied) .battle-order__member")
    .first()
    .evaluate((card) => card.getBoundingClientRect().height);
  for (const tiedCardHeight of tiedCardBoxes)
    expect(Math.abs(tiedCardHeight - untiedCardHeight)).toBeLessThan(1);
  await expect(page.getByText("Priority ignored", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Speed tie", { exact: true })).toHaveCount(0);
  const ownPanel = page.locator(".battle-panel--own");
  await expect(ownPanel.locator(".battle-editor")).toHaveCount(1);
  await expect(
    ownPanel.getByRole("group", { name: `${ownLabel} stats` }),
  ).toHaveCount(1);
  await expect(
    ownPanel.getByLabel(`${ownLabel} HP Stat Points`, { exact: true }),
  ).toBeDisabled();
  await expect(ownPanel.getByRole("button", { name: /HP from/ })).toHaveCount(
    0,
  );
  await expect(
    ownPanel.getByLabel(`${ownLabel} Attack Stat Points`, { exact: true }),
  ).toBeDisabled();
  const ownAttack = ownPanel.getByLabel(`${ownLabel} Atk stat`);
  const baseAttack = Number(await ownAttack.textContent());
  await expect(
    ownPanel.getByRole("button", { name: `Raise ${ownLabel} Atk from 0` }),
  ).toBeVisible();
  await expect(ownAttack).not.toHaveText("");
  await ownPanel
    .getByRole("button", { name: `Raise ${ownLabel} Atk from 0` })
    .click();
  expect(Number(await ownAttack.textContent())).toBeGreaterThan(baseAttack);
  await expect(
    ownPanel.getByRole("button", { name: `Raise ${ownLabel} Atk from 1` }),
  ).toBeVisible();
  await expect(
    ownField.getByRole("button", { name: `Raise ${ownLabel} Atk from 1` }),
  ).toHaveCount(0);
  await expect(
    page.locator(".battle-panel--own").getByLabel("Known moves"),
  ).toHaveCount(0);
  await expect(
    page.locator(".battle-move-result details strong").first(),
  ).toContainText("%");
  const moveDetails = page.locator(".battle-move-result__details").first();
  const moveName = await moveDetails.textContent();
  if (!moveName) throw new Error("Damage-pane move name is unavailable.");
  await moveDetails.click();
  const moveDialog = page.getByRole("dialog", { name: moveName });
  await expect(moveDialog).toBeVisible();
  await expect(moveDialog.getByText("Power:")).toBeVisible();
  await expect(moveDialog.getByText("Accuracy:")).toBeVisible();
  await expect(moveDialog.getByText("PP:")).toBeVisible();
  await expect(moveDialog.getByText("Priority:")).toBeVisible();
  await expect(moveDialog.getByText("Target:")).toBeVisible();
  await expect(moveDialog.getByText("Flags:")).toBeVisible();
  await expect(moveDialog.locator(".info-description")).not.toBeEmpty();
  await moveDialog.getByRole("button", { name: "Close details" }).click();
  await expect(moveDialog).toHaveCount(0);
  await expect(moveDetails).toBeFocused();

  await charizard.click();
  const observedMove = page
    .locator(".battle-panel--opponent")
    .getByLabel("Move 1");
  await observedMove.fill("MissingNo");
  await observedMove.press("Enter");
  await expect(
    opponentPanel.getByText("Choose a valid move 1 from the suggestions."),
  ).toBeVisible();
  await observedMove.press("Escape");
  await expect(observedMove).toHaveValue("");
  await selectComboboxOption(opponentPanel, observedMove, "Dragon Claw");
  await charizard.click();
  await expect(
    page.locator(".battle-move-result details strong").first(),
  ).toContainText("HP");
  await page.locator(".battle-move-result details").first().click();
  await expect(page.getByText(/Exact rolls:/)).toHaveCount(0);
  await expect(
    page.locator(".battle-move-result details[open] p").first(),
  ).not.toHaveText("");

  await expect(
    opponentPanel.getByLabel("Charizard Attack Stat Points", { exact: true }),
  ).toBeEnabled();
  await expect(
    opponentPanel.getByRole("group", { name: "Charizard stats" }),
  ).toHaveCount(1);
  await expect(
    opponentPanel.getByText("Observed set", { exact: true }),
  ).toHaveCount(0);
  await expect(
    opponentPanel.getByLabel("Charizard HP Stat Points", { exact: true }),
  ).toBeEnabled();
  await expect(
    opponentPanel.getByRole("button", { name: /HP from/ }),
  ).toHaveCount(0);
  const opponentEditorOrder = await opponentPanel
    .locator(".battle-set-editor")
    .evaluate((editor) =>
      Array.from(editor.children).map((child) => child.className),
    );
  expect(opponentEditorOrder).toEqual([
    "battle-choice-grid",
    "battle-moves",
    "battle-editor__stats",
    "battle-choice-grid battle-choice-grid--single",
  ]);
  await opponentPanel
    .getByLabel("Charizard Attack Stat Points", { exact: true })
    .fill("32");
  await expect(
    opponentPanel.getByLabel("Charizard Attack Stat Points value"),
  ).toHaveText("32");
  await expect(opponentPanel.getByLabel("Charizard Spe stat")).not.toHaveText(
    "",
  );
  await expect(
    opponentPanel.getByRole("button", {
      name: "Lower Charizard Spe from 0",
    }),
  ).toBeVisible();
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
  await opponentField
    .getByRole("button", { name: "Select Charizard as attacker" })
    .click();
  await expect(opponentPanel.getByText("43%", { exact: true })).toBeVisible();
  await expect(opponentPanel.getByLabel("Move 1")).not.toHaveValue("");

  await ownMember.click();
  await ownField.getByRole("button", { name: `Bench ${ownLabel}` }).click();
  await expect(ownMember).toBeVisible();
  await ownMember.click();
  await page.getByRole("button", { name: "Your active slot 1, empty" }).click();
});

test("warns before leaving an active battle and remains functional on phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await selectPreparedTeam(page);
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
  await selectPreparedTeam(page);
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
  await selectPreparedTeam(page);
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
  await selectPreparedTeam(page);
  const ownMember = page
    .locator(".battle-panel--own")
    .locator(".battle-roster__member")
    .first();
  await ownMember.press("Enter");
  await page
    .getByRole("button", { name: "Your active slot 1, empty" })
    .press("Space");
  const selectedAttacker = page.locator(".battle-selected-attacker");
  await expect(
    selectedAttacker.getByText("Selected attacker", { exact: true }),
  ).toBeVisible();
  const selectedAttackerSprite = selectedAttacker.locator("img");
  await expect(selectedAttackerSprite).toBeVisible();
  await expect(selectedAttackerSprite).toHaveCSS("width", "48px");
  await expect(selectedAttackerSprite).toHaveCSS("height", "48px");
  const fieldEffects = page.getByRole("region", { name: "Field effects" });
  await expect(fieldEffects).toBeVisible();
  await expect(fieldEffects.locator("details, summary")).toHaveCount(0);
  await expect(fieldEffects).toHaveCSS("position", "static");
  expect(
    await selectedAttacker.evaluate(
      (attacker, effects) =>
        Boolean(
          effects &&
            attacker.closest("section")?.compareDocumentPosition(effects) &
              Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      await fieldEffects.elementHandle(),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Rain" }).click();
  await page.getByRole("button", { name: "Trick Room" }).click();
  await expect(page.getByRole("button", { name: "Rain" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Trick Room" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Friend Guard" }).first(),
  ).toBeVisible();
  const helpingHand = page.getByRole("button", { name: "Helping Hand" });
  await expect(helpingHand).toHaveCount(2);
  await helpingHand.first().click();
  await expect(helpingHand.first()).toHaveAttribute("aria-pressed", "true");
  await expect(helpingHand.last()).toHaveAttribute("aria-pressed", "false");
  await helpingHand.last().click();
  await expect(helpingHand.last()).toHaveAttribute("aria-pressed", "true");
  const singleTarget = page.getByRole("button", { name: "Single Target" });
  await expect(singleTarget).toHaveCount(2);
  await singleTarget.first().click();
  await expect(singleTarget.first()).toHaveAttribute("aria-pressed", "true");
  await expect(singleTarget.last()).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Spread hits one target" }),
  ).toHaveCount(0);
  await expect(page.getByText("Accounted effects")).toHaveCount(0);
});
