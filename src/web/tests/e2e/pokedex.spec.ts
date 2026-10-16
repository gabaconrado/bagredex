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
  await expect(
    moveTable.getByRole("button", { name: "Sort moves by category" }),
  ).toBeVisible();
  const statsInfo = page.getByRole("button", {
    name: "Show level-50 stat calculation information",
  });
  await statsInfo.click();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Real: 0 SP, neutral nature. Min: 0 SP, hindering nature. Max: 32 SP, increasing nature.",
  );
  await statsInfo.click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  for (const key of ["type", "category", "power"]) {
    const button = moveTable.getByRole("button", {
      name: new RegExp(`Sort moves by ${key}`),
    });
    const header = button.locator("xpath=..");
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "none");
  }
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

test("keeps responsive shell, sort columns, and delayed detail geometry stable", async ({
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
  const baselineSortBoxes = await boxes(measuredLayout);
  const baselineColumnBoxes = await boxes(await columns.all());
  const baselineScrollLeft = await scroll.evaluate(
    (element) => element.scrollLeft,
  );
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
    const button = page.getByRole("button", { name: label, exact: true });
    for (const direction of ["ascending", "descending", "none"]) {
      const shiftStart = await page.evaluate(() => performance.now());
      await button.click();
      await expect(button.locator("xpath=..")).toHaveAttribute(
        "aria-sort",
        direction,
      );
      expectStableBoxes(
        baselineSortBoxes,
        await boxes(measuredLayout),
        measuredLayoutLabels,
        `${label} ${direction}`,
      );
      expectStableBoxes(
        baselineColumnBoxes,
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
        baselineScrollLeft,
      );
      await expectNoOuterShiftSince(page, shiftStart);
    }
  }
  const keyboardSort = page.getByRole("button", { name: "HP", exact: true });
  await keyboardSort.focus();
  const keyboardScrollLeft = await scroll.evaluate(
    (element) => element.scrollLeft,
  );
  for (const direction of ["ascending", "descending", "none"]) {
    await keyboardSort.press("Enter");
    await expect(keyboardSort.locator("xpath=..")).toHaveAttribute(
      "aria-sort",
      direction,
    );
    expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(
      keyboardScrollLeft,
    );
    expectStableBoxes(
      baselineSortBoxes,
      await boxes(measuredLayout),
      measuredLayoutLabels,
      `HP keyboard ${direction}`,
    );
    expectStableBoxes(
      baselineColumnBoxes,
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
  await firstRow.getByRole("button").click();
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
