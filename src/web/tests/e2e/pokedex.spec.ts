import { expect, test, type Locator, type Page } from "@playwright/test";

type Box = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;
type ShiftEvidence = {
  startTime: number;
  value: number;
  hadRecentInput: boolean;
  outerDelta: number;
};

const boxes = (locators: Locator[]) =>
  Promise.all(locators.map((locator) => locator.boundingBox()));

const textRangeBox = (locator: Locator) =>
  locator.evaluate((element) => {
    const text = [...element.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
    if (!text) return null;
    const range = document.createRange();
    range.selectNodeContents(text);
    return range.getBoundingClientRect().toJSON();
  });

async function expectResponsiveTableRange(page: Page, state: string) {
  const scroll = page.locator(".table-scroll");
  await expect(page.locator(".pokemon-table thead th")).toHaveCount(10);
  const range = await scroll.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  if ((page.viewportSize()?.width ?? 1000) > 640)
    expect(range, `${state} has no horizontal table range`).toBeLessThanOrEqual(
      0,
    );
  else
    expect(range, `${state} retains phone table overflow`).toBeGreaterThan(0);
}

function expectStableBoxes(
  baseline: (Box | null)[],
  current: (Box | null)[],
  labels: string[],
  state: string,
) {
  expect(current).toHaveLength(baseline.length);
  current.forEach((box, boxIndex) =>
    (["x", "y", "width", "height"] as const).forEach((key) =>
      expect(
        Math.abs((box?.[key] ?? 0) - (baseline[boxIndex]?.[key] ?? 0)),
        `${state}: ${labels[boxIndex] ?? boxIndex}.${key}`,
      ).toBeLessThanOrEqual(1),
    ),
  );
}

async function settleFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function revealInTable(page: Page, target: Locator) {
  const before = await target.evaluate((element) => {
    const scroll = element.closest<HTMLElement>(".table-scroll")!;
    for (let pass = 0; pass < 2; pass += 1) {
      const targetBox = element.getBoundingClientRect();
      const scrollBox = scroll.getBoundingClientRect();
      scroll.scrollLeft +=
        targetBox.left +
        targetBox.width / 2 -
        (scrollBox.left + scrollBox.width / 2);
      if (targetBox.top < scrollBox.top)
        scroll.scrollTop += targetBox.top - scrollBox.top;
      else if (targetBox.bottom > scrollBox.bottom)
        scroll.scrollTop += targetBox.bottom - scrollBox.bottom;
    }
    return { scrollLeft: scroll.scrollLeft, scrollTop: scroll.scrollTop };
  });
  await settleFrames(page);
  const result = await target.evaluate((element, initial) => {
    const targetBox = element.getBoundingClientRect();
    const scroll = element.closest<HTMLElement>(".table-scroll")!;
    const scrollBox = scroll.getBoundingClientRect();
    const x = targetBox.left + targetBox.width / 2;
    const y = targetBox.top + targetBox.height / 2;
    const owner = document.elementFromPoint(x, y);
    const sides = {
      left: targetBox.left >= scrollBox.left,
      right: targetBox.right <= scrollBox.right,
      top: targetBox.top >= scrollBox.top,
      bottom: targetBox.bottom <= scrollBox.bottom,
    };
    return {
      ok:
        Object.values(sides).every(Boolean) &&
        owner !== null &&
        (owner === element || element.contains(owner)),
      initial,
      target: targetBox.toJSON(),
      scroll: scrollBox.toJSON(),
      scrollLeft: scroll.scrollLeft,
      maxScrollLeft: scroll.scrollWidth - scroll.clientWidth,
      sides,
      owner: owner
        ? {
            tag: owner.tagName,
            className: (owner as HTMLElement).className,
            text: owner.textContent?.trim().slice(0, 80),
          }
        : null,
    };
  }, before);
  expect(result.ok, JSON.stringify(result)).toBe(true);
}

async function expectNoOuterShiftSince(page: Page, startTime: number) {
  await settleFrames(page);
  const shifts = await page.evaluate(
    (start) =>
      (
        window as unknown as { __bagredexLayoutShifts: ShiftEvidence[] }
      ).__bagredexLayoutShifts.filter((shift) => shift.startTime >= start),
    startTime,
  );
  shifts.forEach((shift) => expect(shift.outerDelta).toBeLessThanOrEqual(1));
}

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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const values: ShiftEvidence[] = [];
    (
      window as unknown as { __bagredexLayoutShifts: ShiftEvidence[] }
    ).__bagredexLayoutShifts = values;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: {
            node: Node | null;
            previousRect: DOMRectReadOnly;
            currentRect: DOMRectReadOnly;
          }[];
        };
        const outerDelta = Math.max(
          0,
          ...(shift.sources ?? [])
            .filter(
              ({ node }) =>
                node instanceof Element &&
                node.matches(
                  ".pokedex-app, .pokedex-list, .detail-pane, .pokedex-title, .search, .table-scroll, .pokemon-table, .pokemon-table thead tr",
                ),
            )
            .flatMap(({ previousRect, currentRect }) =>
              (["x", "y", "width", "height"] as const).map((key) =>
                Math.abs(previousRect[key] - currentRect[key]),
              ),
            ),
        );
        values.push({
          startTime: shift.startTime,
          value: shift.value,
          hadRecentInput: shift.hadRecentInput,
          outerDelta,
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await login(page);
});

test("switches explicit regulations and supports keyboard selection", async ({
  page,
}, testInfo) => {
  await page.getByLabel("Regulation").selectOption("m-b");
  await expect(page).toHaveURL(/regulation=m-b/);
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  const search = page.getByLabel(/Search Pokémon/);
  await search.focus();
  const assertVisibleLowerFocusEdge = async (
    lowerElement: Locator,
    state: "closed" | "open",
  ) => {
    const inputBox = (await search.boundingBox())!;
    const lowerBox = (await lowerElement.boundingBox())!;
    const focusExtent = await search.evaluate((input) => {
      const style = getComputedStyle(input);
      return (
        parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset || "0")
      );
    });
    expect(focusExtent).toBeGreaterThan(0);
    const externalGap =
      lowerBox.y - (inputBox.y + inputBox.height + focusExtent);
    const insetEdgeVisible = await search.evaluate((input) => {
      const box = input.getBoundingClientRect();
      const elementAtEdge = document.elementFromPoint(
        box.x + box.width / 2,
        box.bottom - 2,
      );
      return {
        edgeOwnsPointer: elementAtEdge === input,
        insetPainted: getComputedStyle(input).boxShadow.includes("inset"),
      };
    });
    await testInfo.attach(`search-focus-${state}-geometry`, {
      body: Buffer.from(
        JSON.stringify(
          { externalGap, focusExtent, inputBox, lowerBox, insetEdgeVisible },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    expect(
      externalGap >= 0 ||
        (insetEdgeVisible.edgeOwnsPointer && insetEdgeVisible.insetPainted),
    ).toBe(true);
  };
  await assertVisibleLowerFocusEdge(page.locator(".table-scroll"), "closed");
  await testInfo.attach("search-focus-closed", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await search.fill("mega");
  await expect(page.getByRole("listbox")).toBeVisible();
  await assertVisibleLowerFocusEdge(page.getByRole("listbox"), "open");
  await testInfo.attach("search-focus-open", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
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
  await expectResponsiveTableRange(page, "AND-filtered result");

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
  await expectResponsiveTableRange(page, "restored filtered result");
  const hp = page.locator('button.sort[title="Sort by HP"]');
  await revealInTable(page, hp);
  await hp.click();
  await expect(hp.locator("xpath=ancestor::th")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await hp.click();
  await expect(hp.locator("xpath=ancestor::th")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await hp.click();
  await expect(hp.locator("xpath=ancestor::th")).toHaveAttribute(
    "aria-sort",
    "none",
  );
});

test("keeps mid-width stat controls accessible and contained @mid-width", async ({
  page,
}) => {
  const scroll = page.locator(".table-scroll");
  const buttons = page.locator(".pokemon-table thead .sort");
  await expect(buttons).toHaveCount(7);
  expect(
    await scroll.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(
    await scroll.evaluate((element) => element.clientWidth),
  );

  for (const button of await buttons.all()) {
    await revealInTable(page, button);
    const header = button.locator("xpath=ancestor::th");
    const [buttonBox, headerBox] = await Promise.all([
      button.boundingBox(),
      header.boundingBox(),
    ]);
    expect(buttonBox?.width).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.x ?? 0).toBeGreaterThanOrEqual((headerBox?.x ?? 0) - 1);
    expect((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0)).toBeLessThanOrEqual(
      (headerBox?.x ?? 0) + (headerBox?.width ?? 0) + 1,
    );
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS("outline-style", "solid");
    expect(
      Number.parseFloat(
        await button.evaluate(
          (element) => getComputedStyle(element).outlineOffset,
        ),
      ),
    ).toBeLessThanOrEqual(0);
    const origin = await scroll.evaluate((element) => element.scrollLeft);
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(origin);
    expectStableBoxes(
      [headerBox],
      [await header.boundingBox()],
      ["stat header"],
      `${await button.textContent()} mid-width click`,
    );
    await button.click();
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "none");
  }
});

test("fits every column and stat target immediately above phone width @boundary", async ({
  page,
}) => {
  const scroll = page.locator(".table-scroll");
  const columns = page.locator(".pokemon-table thead th");
  const buttons = page.locator(".pokemon-table thead .sort");
  await expect(columns).toHaveCount(10);
  await expect(buttons).toHaveCount(7);
  await expectResponsiveTableRange(page, "641px boundary");
  for (const button of await buttons.all()) {
    const header = button.locator("xpath=ancestor::th");
    const [buttonBox, headerBox] = await Promise.all([
      button.boundingBox(),
      header.boundingBox(),
    ]);
    expect(buttonBox?.width).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.x ?? 0).toBeGreaterThanOrEqual((headerBox?.x ?? 0) - 1);
    expect((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0)).toBeLessThanOrEqual(
      (headerBox?.x ?? 0) + (headerBox?.width ?? 0) + 1,
    );
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expectResponsiveTableRange(page, "641px sorted boundary");
  }
  expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(0);
});

test("contains centered full stat labels on genuinely wide tables @wide", async ({
  page,
}) => {
  const scroll = page.locator(".table-scroll");
  const buttons = page.locator(".pokemon-table thead .sort");
  await expectResponsiveTableRange(page, "wide full-label table");
  await expect(buttons).toHaveCount(7);
  for (const button of await buttons.all()) {
    const header = button.locator("xpath=ancestor::th");
    const full = button.locator(".sort-label--full");
    const short = button.locator(".sort-label--short");
    await expect(full).toBeVisible();
    await expect(short).toBeHidden();
    const [buttonBox, headerBox] = await Promise.all([
      button.boundingBox(),
      header.boundingBox(),
    ]);
    expect(buttonBox?.width).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(43.99);
    for (const direction of ["ascending", "descending", "none"]) {
      const [contentBox, labelBox, indicatorBox] = await Promise.all([
        button.locator(".sort-content").boundingBox(),
        textRangeBox(full),
        textRangeBox(button.locator(".sort-indicator")),
      ]);
      expect(
        Math.abs(
          (contentBox?.x ?? 0) +
            (contentBox?.width ?? 0) / 2 -
            ((headerBox?.x ?? 0) + (headerBox?.width ?? 0) / 2),
        ),
      ).toBeLessThanOrEqual(1);
      expect(labelBox?.x ?? 0).toBeGreaterThanOrEqual((buttonBox?.x ?? 0) - 1);
      expect(
        (indicatorBox?.x ?? 0) + (indicatorBox?.width ?? 0),
      ).toBeLessThanOrEqual((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) + 1);
      expect((labelBox?.x ?? 0) + (labelBox?.width ?? 0)).toBeLessThanOrEqual(
        (indicatorBox?.x ?? 0) + 1,
      );
      await button.click();
      await expect(header).toHaveAttribute("aria-sort", direction);
      await expectResponsiveTableRange(page, `wide ${direction} stat sort`);
    }
  }
  expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(0);
});

test("selects an entire data row exactly once by pointer, touch, and keyboard", async ({
  page,
}, testInfo) => {
  const root = page.locator(".pokedex-app");
  const rows = page.locator(".pokemon-table tbody tr");
  await expect(rows.nth(4)).toBeVisible();
  const hpSort = page.locator('button.sort[title="Sort by HP"]');
  const expectSelection = async (rowIndex: number, revision: number) => {
    const button = rows.nth(rowIndex).getByRole("button");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(root).toHaveAttribute(
      "data-selection-revision",
      String(revision),
    );
    await expect(hpSort.locator("xpath=ancestor::th")).toHaveAttribute(
      "aria-sort",
      "none",
    );
  };
  const activate = async (target: Locator) => {
    await revealInTable(page, target);
    const box = await target.boundingBox();
    const position = {
      x: (box?.width ?? 16) / 2,
      y: (box?.height ?? 16) / 2,
    };
    if (testInfo.project.use.hasTouch) await target.tap({ position });
    else await target.click({ position });
  };
  const firstRow = rows.nth(0);
  await expect(firstRow).toHaveCSS("cursor", "pointer");
  if (!testInfo.project.use.hasTouch) {
    const before = await firstRow.evaluate(
      (row) => getComputedStyle(row).backgroundColor,
    );
    await firstRow.hover();
    const after = await firstRow.evaluate(
      (row) => getComputedStyle(row).backgroundColor,
    );
    expect(after).not.toBe(before);
  }
  await activate(firstRow.locator(".pokemon-table__sprite"));
  await expectSelection(0, 1);
  await expectResponsiveTableRange(page, "sprite-cell selection");
  const selectedBackground = await firstRow.evaluate(
    (row) => getComputedStyle(row).backgroundColor,
  );
  expect(selectedBackground).not.toBe("rgba(0, 0, 0, 0)");

  let revision = 2;
  await activate(rows.nth(1).locator(".pokemon-table__types"));
  await expectSelection(1, revision);
  revision += 1;
  await activate(rows.nth(2).locator("[data-label=HP]"));
  await expectSelection(2, revision);
  await expectResponsiveTableRange(page, "stat-cell selection");
  revision += 1;
  const enterButton = rows.nth(3).getByRole("button");
  await enterButton.focus();
  await enterButton.press("Enter");
  await expectSelection(3, revision);
  revision += 1;
  const spaceButton = rows.nth(4).getByRole("button");
  await spaceButton.focus();
  await spaceButton.press("Space");
  await expectSelection(4, revision);
});

test("navigates Mega forms in both directions and replaces detail information", async ({
  page,
}, testInfo) => {
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
  await expect(rowSprite).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const shinyToggle = page.locator("button.icon-toggle--shiny");
  await expect(shinyToggle).toHaveAccessibleName("Show shiny Charizard");
  const spriteFrame = page.locator(".sprite-frame");
  const toggleRow = page.locator(".form-toggles");
  const stableSpriteControls = async () => {
    await spriteFrame.evaluate((frame) => {
      const detail = frame.closest<HTMLElement>(".detail-pane");
      if (detail) detail.scrollTop = 0;
      frame.scrollIntoView({ block: "start", inline: "nearest" });
    });
    await settleFrames(page);
    const [frame, row, first] = await Promise.all([
      spriteFrame.boundingBox(),
      toggleRow.boundingBox(),
      toggleRow.locator("button").first().boundingBox(),
    ]);
    return [frame, row, first] as const;
  };
  const spriteControlBaseline = await stableSpriteControls();
  expect(spriteControlBaseline[1]?.x).toBe(spriteControlBaseline[0]?.x);
  expect(spriteControlBaseline[2]?.x).toBe(spriteControlBaseline[0]?.x);
  await expect(shinyToggle.locator('img.icon[alt=""]')).toHaveAttribute(
    "src",
    /shiny-[A-Za-z0-9_-]+\.svg$/,
  );
  const inactiveShinyBackground = await shinyToggle.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await expect(shinyToggle.locator(".icon--shiny")).toHaveCSS(
    "filter",
    /invert\(1\)/,
  );
  await shinyToggle.click();
  await expect(shinyToggle).toHaveAccessibleName("Show normal Charizard");
  await expect(
    page.getByRole("img", { name: "Shiny Charizard" }),
  ).toBeVisible();
  expect(
    await shinyToggle.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe(inactiveShinyBackground);
  expectStableBoxes(
    [...spriteControlBaseline],
    [...(await stableSpriteControls())],
    ["sprite frame", "toggle row", "first toggle"],
    "shiny sprite controls",
  );
  await expect(rowSprite).toHaveAttribute("src", normalRowSource!);
  const moveTable = page.getByLabel("Legal moves");
  await expect(moveTable.getByText("Name", { exact: true })).toBeVisible();
  await expect(
    moveTable.getByRole("button", { name: "Sort moves by category" }),
  ).toBeVisible();
  await expect(
    moveTable.getByRole("button", { name: "Sort moves by category" }),
  ).toContainText("Category");
  const categoryCell = moveTable.locator(".move-category").first();
  await expect(categoryCell.locator('img.icon[alt=""]')).toBeVisible();
  await expect(categoryCell.locator(".visually-hidden")).toHaveCSS(
    "position",
    "absolute",
  );
  const inactiveMoveIndicator = moveTable
    .getByRole("button", { name: "Sort moves by category" })
    .locator(".sort-indicator");
  await expect(inactiveMoveIndicator).toHaveCSS("visibility", "hidden");
  const statsInfo = page.getByRole("button", {
    name: "Show level-50 stat calculation information",
  });
  const [infoBox, markBox] = await Promise.all([
    statsInfo.boundingBox(),
    statsInfo.locator(".info-mark").boundingBox(),
  ]);
  // Firefox can report exact CSS-pixel boundaries a few millionths off.
  expect(infoBox?.width).toBeGreaterThanOrEqual(43.99);
  expect(infoBox?.height).toBeGreaterThanOrEqual(43.99);
  expect(markBox?.width).toBeGreaterThanOrEqual(20);
  expect(markBox?.width).toBeLessThanOrEqual(24);
  await statsInfo.click();
  const statsTooltip = page.getByRole("tooltip");
  await expect(statsTooltip).toHaveText(
    "Real: 0 SP, neutral nature. Min: 0 SP, hindering nature. Max: 32 SP, increasing nature.",
  );
  expect((await statsTooltip.boundingBox())?.width).toBeLessThanOrEqual(320.01);
  await statsInfo.click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  for (const key of ["type", "category", "power"]) {
    const button = moveTable.getByRole("button", {
      name: new RegExp(`Sort moves by ${key}`),
    });
    const header = button.locator("xpath=ancestor::*[@aria-sort]");
    const assertMoveIndicatorContained = async () => {
      const [buttonBox, headerBox, indicatorBox] = await Promise.all([
        button.boundingBox(),
        header.boundingBox(),
        button.locator(".sort-indicator").boundingBox(),
      ]);
      for (const container of [buttonBox, headerBox]) {
        expect(indicatorBox?.x ?? 0).toBeGreaterThanOrEqual(
          (container?.x ?? 0) - 1,
        );
        expect(
          (indicatorBox?.x ?? 0) + (indicatorBox?.width ?? 0),
        ).toBeLessThanOrEqual(
          (container?.x ?? 0) + (container?.width ?? 0) + 1,
        );
      }
    };
    await assertMoveIndicatorContained();
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    const focusMetrics = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        offset: Number.parseFloat(style.outlineOffset),
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusMetrics.style).toBe("solid");
    expect(focusMetrics.width).toBeGreaterThanOrEqual(2);
    expect(focusMetrics.offset + focusMetrics.width).toBeLessThanOrEqual(0);
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(button.locator(".sort-indicator")).toHaveCSS(
      "visibility",
      "visible",
    );
    await assertMoveIndicatorContained();
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await assertMoveIndicatorContained();
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "none");
    await expect(button.locator(".sort-indicator")).toHaveCSS(
      "visibility",
      "hidden",
    );
    await assertMoveIndicatorContained();
  }
  await testInfo.attach("corrected-icons-and-detail", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const mega = page
    .getByRole("button", { name: /Switch to Charizard-Mega/ })
    .first();
  await expect(mega).toBeVisible();
  await mega.click();
  expectStableBoxes(
    [...spriteControlBaseline],
    [...(await stableSpriteControls())],
    ["sprite frame", "toggle row", "first toggle"],
    "Mega sprite controls",
  );
  await page.waitForFunction(() => {
    const icons = [
      ...document.querySelectorAll<HTMLImageElement>(".detail-pane img.icon"),
    ];
    return (
      icons.length >= 3 &&
      icons.every((icon) => icon.complete && icon.naturalWidth > 0)
    );
  });
  const iconLoads = await page
    .locator(".detail-pane img.icon")
    .evaluateAll((images) =>
      images.map((image) => {
        const value = image as HTMLImageElement;
        return {
          alt: value.alt,
          complete: value.complete,
          width: value.naturalWidth,
          url: value.currentSrc || value.src,
        };
      }),
    );
  expect(iconLoads.length).toBeGreaterThanOrEqual(3);
  iconLoads.forEach((icon) => {
    expect(icon.alt).toBe("");
    expect(icon.complete).toBe(true);
    expect(icon.width).toBeGreaterThan(0);
    expect(new URL(icon.url).origin).toBe(new URL(page.url()).origin);
    expect(new URL(icon.url).pathname).toMatch(/\.svg$/);
  });
  await expect(
    page.getByRole("button", { name: /^Return to base form Charizard$/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Return to base form Charizard$/ })
    .click();
  const differentRow = page
    .locator(".pokemon-table tbody tr")
    .filter({ hasNotText: "Charizard" })
    .first();
  const differentForm = (await differentRow.getByRole("button").textContent())!;
  await differentRow.getByRole("button").click();
  await expect(
    page.getByRole("heading", { name: differentForm, exact: true }),
  ).toBeVisible();
  expectStableBoxes(
    [...spriteControlBaseline],
    [...(await stableSpriteControls())],
    ["sprite frame", "toggle row", "first toggle"],
    `${differentForm} sprite controls`,
  );
  await page
    .locator(".pokemon-table tbody tr")
    .filter({ hasText: /^Charizard/ })
    .first()
    .getByRole("button", { name: "Charizard", exact: true })
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

test("keeps responsive shell, sort columns, and delayed detail geometry stable", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const firstRow = page.locator(".pokemon-table tbody tr").first();
  await expect(firstRow.getByRole("button")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 640) {
    await expect(
      page.getByRole("columnheader", { name: "Pokémon" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Types" }),
    ).toBeVisible();
  }
  // Finish the initial background request before intercepting reload traffic.
  // Otherwise Firefox can dispose that older APIResponse during navigation.
  await expect(page.locator(".pokedex-app")).toHaveAttribute(
    "data-details-state",
    "ready",
  );
  const bootstrap = JSON.parse(
    (await page.locator("#pokedex-bootstrap").textContent()) ?? "null",
  ) as { index_url: string; details_url: string };
  const copyFixture = async (path: string) => {
    const response = await page.request.get(new URL(path, page.url()).href);
    const fixture = {
      body: await response.body(),
      headers: response.headers(),
      status: response.status(),
    };
    await response.dispose();
    return fixture;
  };
  const [indexFixture, detailsFixture] = await Promise.all([
    copyFixture(bootstrap.index_url),
    copyFixture(bootstrap.details_url),
  ]);
  let releaseDetails!: () => void;
  const detailsGate = new Promise<void>((resolve) => {
    releaseDetails = resolve;
  });
  await page.route("**/index/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill(indexFixture);
  });
  await page.route("**/details/**", async (route) => {
    await detailsGate;
    await route.fulfill(detailsFixture);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", /stable/);
  const root = page.locator("[data-pokedex-root]");
  const app = page.locator(".pokedex-app");
  const heading = page.getByRole("heading", { name: "Pokédex" });
  const picker = page.getByLabel("Regulation");
  const list = page.locator(".pokedex-list");
  const detail = page.locator(".detail-pane");
  const toolbar = page.locator(".pokedex-title");
  await expect(heading).toBeVisible();
  const shellBoxes = await boxes([
    root,
    app,
    list,
    detail,
    toolbar,
    heading,
    picker,
  ]);
  await testInfo.attach("delayed-index-shell", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  expectStableBoxes(
    shellBoxes,
    await boxes([root, app, list, detail, toolbar, heading, picker]),
    ["root", "app", "list", "detail", "toolbar", "heading", "picker"],
    "server shell to loaded index",
  );
  if ((page.viewportSize()?.width ?? 1000) <= 640) {
    const rows = page.locator(".pokemon-table tbody tr");
    const widestDualTypeRow = await rows.evaluateAll((elements) => {
      let widest = { index: -1, width: -1 };
      elements.forEach((row, index) => {
        const badges = row.querySelectorAll(
          ".pokemon-table__types .type-badge",
        );
        if (badges.length >= 2) {
          const boxes = [...badges].map((badge) =>
            badge.getBoundingClientRect(),
          );
          const width =
            Math.max(...boxes.map((box) => box.right)) -
            Math.min(...boxes.map((box) => box.left));
          if (width > widest.width) widest = { index, width };
        }
      });
      return widest.index;
    });
    expect(widestDualTypeRow).toBeGreaterThanOrEqual(0);
    const typeCell = rows
      .nth(widestDualTypeRow)
      .locator(".pokemon-table__types");
    const badges = typeCell.locator(".type-badge");
    const [cellBox, badgeBoxes] = await Promise.all([
      typeCell.boundingBox(),
      boxes(await badges.all()),
    ]);
    expect(await badges.count()).toBeGreaterThanOrEqual(2);
    for (const badgeBox of badgeBoxes) {
      expect(badgeBox?.x ?? 0).toBeGreaterThanOrEqual((cellBox?.x ?? 0) - 1);
      expect((badgeBox?.x ?? 0) + (badgeBox?.width ?? 0)).toBeLessThanOrEqual(
        (cellBox?.x ?? 0) + (cellBox?.width ?? 0) + 1,
      );
      expect(badgeBox?.width ?? 0).toBeGreaterThan(20);
    }
  }
  const longestName = await page
    .locator(".pokemon-table tbody th button")
    .evaluateAll(
      (buttons) =>
        buttons
          .map((button) => button.textContent?.trim() ?? "")
          .sort((left, right) => right.length - left.length)[0],
    );
  const longestNameButton = page.getByRole("button", {
    name: longestName,
    exact: true,
  });
  await expect(longestNameButton).toHaveAttribute("title", longestName);
  expect(
    await longestNameButton.evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    }),
  ).toEqual({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  const longestRow = longestNameButton.locator("xpath=../..");
  const rowCells = longestRow.locator("th, td");
  const nameBox = await rowCells.nth(1).boundingBox();
  const typesBox = await rowCells.nth(2).boundingBox();
  const hpBox = await rowCells.nth(3).boundingBox();
  if ((page.viewportSize()?.width ?? 1000) > 640) {
    expect((nameBox?.x ?? 0) + (nameBox?.width ?? 0)).toBeLessThanOrEqual(
      (typesBox?.x ?? 0) + 1,
    );
    expect((typesBox?.x ?? 0) + (typesBox?.width ?? 0)).toBeLessThanOrEqual(
      (hpBox?.x ?? 0) + 1,
    );
    const badges = longestRow.locator(".pokemon-table__types .type-badge");
    for (
      let badgeIndex = 0;
      badgeIndex < (await badges.count());
      badgeIndex += 1
    ) {
      const badgeBox = await badges.nth(badgeIndex).boundingBox();
      expect(badgeBox?.x ?? 0).toBeGreaterThanOrEqual((typesBox?.x ?? 0) - 1);
      expect((badgeBox?.x ?? 0) + (badgeBox?.width ?? 0)).toBeLessThanOrEqual(
        (typesBox?.x ?? 0) + (typesBox?.width ?? 0) + 1,
      );
    }
  }
  await page.waitForFunction(() => {
    const viewport = document
      .querySelector(".table-scroll")!
      .getBoundingClientRect();
    return [
      ...document.querySelectorAll<HTMLImageElement>(".pokemon-table img"),
    ]
      .filter((image) => {
        const box = image.getBoundingClientRect();
        return box.bottom >= viewport.top && box.top <= viewport.bottom;
      })
      .every((image) => image.complete);
  });
  await settleFrames(page);
  const table = page.locator(".pokemon-table");
  const headerRow = page.locator(".pokemon-table thead tr");
  const searchToolbar = page.locator(".search");
  const scroll = page.locator(".table-scroll");
  const columns = page.locator(".pokemon-table thead th");
  await expect(columns).toHaveCount(10);
  const tableOverflow = await scroll.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  if ((page.viewportSize()?.width ?? 1000) > 640) {
    expect(tableOverflow.scroll).toBeLessThanOrEqual(tableOverflow.client);
    expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(0);
  } else {
    expect(tableOverflow.scroll).toBeGreaterThan(tableOverflow.client);
    await expect(firstRow.locator(".pokemon-table__types")).toBeVisible();
  }
  for (const columnIndex of [1, 2]) {
    const header = columns.nth(columnIndex);
    const [headerBox, headerTextBox] = await Promise.all([
      header.boundingBox(),
      textRangeBox(header),
    ]);
    expect(
      Math.abs(
        (headerBox?.x ?? 0) +
          (headerBox?.width ?? 0) / 2 -
          ((headerTextBox?.x ?? 0) + (headerTextBox?.width ?? 0) / 2),
      ),
      `column ${columnIndex} header text center`,
    ).toBeLessThanOrEqual(1);
  }
  const firstRowCells = firstRow.locator("th, td");
  const [nameCellBox, nameTextBox, typesCellBox, typeBadgeGroupBox] =
    await Promise.all([
      firstRowCells.nth(1).boundingBox(),
      textRangeBox(firstRowCells.nth(1).getByRole("button")),
      firstRowCells.nth(2).boundingBox(),
      firstRowCells
        .nth(2)
        .locator(".type-list")
        .evaluate((list) => {
          const boxes = [...list.children].map((child) =>
            child.getBoundingClientRect(),
          );
          const left = Math.min(...boxes.map((box) => box.left));
          const right = Math.max(...boxes.map((box) => box.right));
          return { x: left, width: right - left };
        }),
    ]);
  expect(
    Math.abs(
      (nameCellBox?.x ?? 0) +
        (nameCellBox?.width ?? 0) / 2 -
        ((nameTextBox?.x ?? 0) + (nameTextBox?.width ?? 0) / 2),
    ),
    "Pokémon name text center",
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      (typesCellBox?.x ?? 0) +
        (typesCellBox?.width ?? 0) / 2 -
        (typeBadgeGroupBox.x + typeBadgeGroupBox.width / 2),
    ),
    "type badge group center",
  ).toBeLessThanOrEqual(1);
  const measuredLayout = [
    app,
    list,
    detail,
    toolbar,
    searchToolbar,
    scroll,
    table,
    headerRow,
  ];
  const measuredLayoutLabels = [
    "app",
    "list",
    "detail",
    "toolbar",
    "search toolbar",
    "table scrollport",
    "table",
    "header row",
  ];
  const baselineColumnBoxes = await boxes(await columns.all());
  if ((page.viewportSize()?.width ?? 1000) <= 640) {
    const firstRowCells = await boxes(
      await page
        .locator(".pokemon-table tbody tr")
        .first()
        .locator("th, td")
        .all(),
    );
    for (const [kind, cellBoxes] of [
      ["header", baselineColumnBoxes],
      ["row", firstRowCells],
    ] as const) {
      const stats = cellBoxes.slice(3);
      stats.forEach((box, index) => {
        expect(
          box?.width,
          `${kind} stat ${index} width`,
        ).toBeGreaterThanOrEqual(63);
        expect(box?.width, `${kind} stat ${index} width`).toBeLessThanOrEqual(
          65,
        );
        if (index > 0)
          expect(
            box?.x ?? 0,
            `${kind} stat ${index} does not overlap its predecessor`,
          ).toBeGreaterThanOrEqual(
            (stats[index - 1]?.x ?? 0) + (stats[index - 1]?.width ?? 0) - 1,
          );
      });
    }
  }
  const statHeaderButtons = page.locator(".pokemon-table thead .sort");
  const statHeaderButtonBoxes = await boxes(await statHeaderButtons.all());
  for (
    let buttonIndex = 0;
    buttonIndex < (await statHeaderButtons.count());
    buttonIndex += 1
  ) {
    const button = statHeaderButtons.nth(buttonIndex);
    const [buttonBox, headerBox] = await Promise.all([
      button.boundingBox(),
      button.locator("xpath=ancestor::th").boundingBox(),
    ]);
    expect(buttonBox?.width).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(43.99);
    expect(buttonBox?.x ?? 0).toBeGreaterThanOrEqual((headerBox?.x ?? 0) - 1);
    expect((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0)).toBeLessThanOrEqual(
      (headerBox?.x ?? 0) + (headerBox?.width ?? 0) + 1,
    );
    if (buttonIndex > 0)
      expect(buttonBox?.x ?? 0).toBeGreaterThanOrEqual(
        (statHeaderButtonBoxes[buttonIndex - 1]?.x ?? 0) +
          (statHeaderButtonBoxes[buttonIndex - 1]?.width ?? 0) -
          1,
      );
    const ownsVisibleCenter = await button.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const viewport = element
        .closest(".table-scroll")!
        .getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (
        x < viewport.left ||
        x > viewport.right ||
        y < viewport.top ||
        y > viewport.bottom
      )
        return true;
      const owner = document.elementFromPoint(x, y);
      return owner === element || element.contains(owner);
    });
    expect(ownsVisibleCenter).toBe(true);
    const visibleLabel = button.locator(
      (page.viewportSize()?.width ?? 1000) <= 1600
        ? ".sort-label--short"
        : ".sort-label--full",
    );
    const [labelBox, indicatorBox] = await Promise.all([
      textRangeBox(visibleLabel),
      textRangeBox(button.locator(".sort-indicator")),
    ]);
    expect(labelBox?.x ?? 0).toBeGreaterThanOrEqual((buttonBox?.x ?? 0) - 1);
    expect((labelBox?.x ?? 0) + (labelBox?.width ?? 0)).toBeLessThanOrEqual(
      (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) + 1,
    );
    expect(
      (labelBox?.x ?? 0) + (labelBox?.width ?? 0),
      `stat ${buttonIndex} label does not overlap its arrow slot`,
    ).toBeLessThanOrEqual((indicatorBox?.x ?? 0) + 1);
    await expect(button).toHaveAttribute("title", /Sort by /);
    const value = page
      .locator(".pokemon-table tbody tr")
      .first()
      .locator("th, td")
      .nth(buttonIndex + 3)
      .locator(".stat-value");
    const [valueBox, valueTextBox, sortContentBox] = await Promise.all([
      value.locator("xpath=..").boundingBox(),
      textRangeBox(value),
      button.locator(".sort-content").boundingBox(),
    ]);
    expect(
      Math.abs(
        (headerBox?.x ?? 0) +
          (headerBox?.width ?? 0) -
          ((valueBox?.x ?? 0) + (valueBox?.width ?? 0)),
      ),
      `stat ${buttonIndex} header and value right edges`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        (sortContentBox?.x ?? 0) +
          (sortContentBox?.width ?? 0) / 2 -
          ((valueTextBox?.x ?? 0) + (valueTextBox?.width ?? 0) / 2),
      ),
      `stat ${buttonIndex} sort group and numeric text centers`,
    ).toBeLessThanOrEqual(1);
  }
  await expect(
    page.locator(".pokemon-table thead .sort-indicator").first(),
  ).toHaveCSS("visibility", "hidden");
  const identityRow = page.locator(".pokemon-table tbody tr").first();
  const identityName = await identityRow.getByRole("button").textContent();
  await identityRow.evaluate((row) =>
    row.setAttribute("data-sort-identity", "preserved"),
  );
  const spriteRequests = await page.evaluate(() =>
    Object.fromEntries(
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/sprites/"))
        .map((entry) => entry.name)
        .map((url, _index, urls) => [
          url,
          urls.filter((candidate) => candidate === url).length,
        ]),
    ),
  );
  for (const label of [
    "HP",
    "Attack",
    "Defense",
    "Sp. Atk",
    "Sp. Def",
    "Speed",
    "BST",
  ]) {
    const button = page.locator(`button.sort[title="Sort by ${label}"]`);
    for (const direction of ["ascending", "descending", "none"]) {
      await revealInTable(page, button);
      const pointerOrigin = await scroll.evaluate(
        (element) => element.scrollLeft,
      );
      const interactionBoxes = await boxes(measuredLayout);
      const interactionColumnBoxes = await boxes(await columns.all());
      const ownsCenter = await button.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const owner = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return owner === element || element.contains(owner);
      });
      expect(ownsCenter).toBe(true);
      const shiftStart = await page.evaluate(() => performance.now());
      await button.click();
      await expect(button.locator("xpath=ancestor::th")).toHaveAttribute(
        "aria-sort",
        direction,
      );
      await expect(button).toHaveAccessibleName(
        direction === "none"
          ? `Sort by ${label}`
          : `Sort by ${label}, ${direction}`,
      );
      await expect(button.locator(".sort-indicator")).toHaveCSS(
        "visibility",
        direction === "none" ? "hidden" : "visible",
      );
      expectStableBoxes(
        interactionBoxes,
        await boxes(measuredLayout),
        measuredLayoutLabels,
        `${label} ${direction}`,
      );
      expectStableBoxes(
        interactionColumnBoxes,
        await boxes(await columns.all()),
        [
          "sprite",
          "pokemon",
          "types",
          "hp",
          "attack",
          "defense",
          "special attack",
          "special defense",
          "speed",
          "bst",
        ],
        `${label} ${direction} column boundary`,
      );
      await expect(scroll).toHaveCSS("scrollbar-gutter", /stable/);
      expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(
        pointerOrigin,
      );
      if ((page.viewportSize()?.width ?? 1000) > 640)
        expect(
          await scroll.evaluate(
            (element) => element.scrollWidth - element.clientWidth,
          ),
          `${label} ${direction} has no horizontal range`,
        ).toBeLessThanOrEqual(0);
      await expectNoOuterShiftSince(page, shiftStart);
    }
  }
  const keyboardSort = page.locator('button.sort[title="Sort by HP"]');
  await keyboardSort.focus();
  await settleFrames(page);
  const keyboardScrollLeft = await scroll.evaluate(
    (element) => element.scrollLeft,
  );
  const keyboardSortBoxes = await boxes(measuredLayout);
  const keyboardColumnBoxes = await boxes(await columns.all());
  for (const direction of ["ascending", "descending", "none"]) {
    await keyboardSort.press("Enter");
    await expect(keyboardSort.locator("xpath=ancestor::th")).toHaveAttribute(
      "aria-sort",
      direction,
    );
    await expect(keyboardSort).toHaveAccessibleName(
      direction === "none" ? "Sort by HP" : `Sort by HP, ${direction}`,
    );
    expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(
      keyboardScrollLeft,
    );
    if ((page.viewportSize()?.width ?? 1000) > 640)
      expect(
        await scroll.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
        `keyboard HP ${direction} has no horizontal range`,
      ).toBeLessThanOrEqual(0);
    expectStableBoxes(
      keyboardSortBoxes,
      await boxes(measuredLayout),
      measuredLayoutLabels,
      `HP keyboard ${direction}`,
    );
    expectStableBoxes(
      keyboardColumnBoxes,
      await boxes(await columns.all()),
      [
        "sprite",
        "pokemon",
        "types",
        "hp",
        "attack",
        "defense",
        "special attack",
        "special defense",
        "speed",
        "bst",
      ],
      `HP keyboard ${direction} column boundary`,
    );
    const [scrollBox, buttonBox] = await Promise.all([
      scroll.boundingBox(),
      keyboardSort.boundingBox(),
    ]);
    expect((buttonBox?.x ?? 0) + 1).toBeGreaterThanOrEqual(scrollBox?.x ?? 0);
    expect((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0)).toBeLessThanOrEqual(
      (scrollBox?.x ?? 0) + (scrollBox?.width ?? 0) + 1,
    );
  }
  await expect(
    page.locator(".pokemon-table tbody tr", {
      has: page.getByRole("button", { name: identityName ?? "", exact: true }),
    }),
  ).toHaveAttribute("data-sort-identity", "preserved");
  const spriteRequestsAfterSort = await page.evaluate(() =>
    Object.fromEntries(
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/sprites/"))
        .map((entry) => entry.name)
        .map((url, _index, urls) => [
          url,
          urls.filter((candidate) => candidate === url).length,
        ]),
    ),
  );
  Object.entries(spriteRequests).forEach(([url, count]) =>
    expect(spriteRequestsAfterSort[url]).toBe(count),
  );
  await testInfo.attach("all-stat-sort-cycles", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const emptyBoxes = await boxes([app, list, detail, toolbar, searchToolbar]);
  const selectionShiftStart = await page.evaluate(() => performance.now());
  await firstRow.locator("[data-label=HP]").click({ position: { x: 2, y: 2 } });
  await expect(firstRow.getByRole("button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Loading Pokémon details")).toBeVisible();
  expectStableBoxes(
    emptyBoxes,
    await boxes([app, list, detail, toolbar, searchToolbar]),
    ["app", "list", "detail", "toolbar", "search toolbar"],
    "empty detail to loading detail",
  );
  await expectNoOuterShiftSince(page, selectionShiftStart);
  await testInfo.attach("delayed-detail-loading", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  releaseDetails();
  await expect(detail.getByRole("heading", { name: "Stats" })).toBeVisible();
  expectStableBoxes(
    emptyBoxes,
    await boxes([app, list, detail, toolbar, searchToolbar]),
    ["app", "list", "detail", "toolbar", "search toolbar"],
    "empty detail to ready detail",
  );
  await expectNoOuterShiftSince(page, selectionShiftStart);
  await expect(scroll).toHaveCSS("scrollbar-gutter", /stable/);
  await expect(detail).toHaveCSS("scrollbar-gutter", /stable/);
  const layoutShifts = await page.evaluate(
    () =>
      (window as unknown as { __bagredexLayoutShifts: ShiftEvidence[] })
        .__bagredexLayoutShifts,
  );
  layoutShifts.forEach((shift) =>
    expect(shift.outerDelta).toBeLessThanOrEqual(1),
  );
  await testInfo.attach("layout-shift-evidence", {
    body: Buffer.from(JSON.stringify({ layoutShifts }, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach("detail-ready", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});
