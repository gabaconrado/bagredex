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
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

async function expectPokedexReady(page: Page, regulation = "m-c") {
  const app = page.locator(".pokedex-app");
  await expect(app).toHaveAttribute("data-regulation", regulation);
  await expect(app).toHaveAttribute("data-details-state", "ready", {
    timeout: 15_000,
  });
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

test("publishes the white Bagredex icon from the shared page shell", async ({
  page,
}) => {
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute("type", "image/svg+xml");
  await expect(icon).toHaveAttribute(
    "href",
    /\/static\/web\/icons\/bagredex-classic-white\.svg$/,
  );
  const authenticatedIconUrl = await icon.getAttribute("href");
  const authenticatedIconResponse = await page.request.get(
    new URL(authenticatedIconUrl!, page.url()).toString(),
  );
  expect(authenticatedIconResponse.ok()).toBe(true);
  expect(authenticatedIconResponse.headers()["content-type"]).toContain(
    "image/svg+xml",
  );

  await page.context().clearCookies();
  await page.goto("/login/");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    authenticatedIconUrl!,
  );
});

test("keeps historical regulation navigation explicit and latest navigation clean", async ({
  page,
}) => {
  const regulation = page.getByLabel("Regulation");
  await expect(page.locator("[data-regulation-selector]")).toHaveAttribute(
    "data-enhanced",
    "",
  );
  await regulation.selectOption("m-a");
  await expect(page).toHaveURL(/regulation=m-a/);
  await expectPokedexReady(page, "m-a");
  await page.getByRole("link", { name: "Damage Calculator" }).click();
  await expect(page).toHaveURL(/\/damage-calculator\/\?regulation=m-a/);
  await expect(page.getByLabel("Regulation")).toHaveValue("m-a");
  await page.getByRole("link", { name: "Pokédex" }).click();
  await expect(page).toHaveURL(/regulation=m-a/);
  await expectPokedexReady(page, "m-a");
  await page.locator(".site-header__brand").click();
  await expect(page).toHaveURL(/regulation=m-a/);
  await expectPokedexReady(page, "m-a");
  await expect(page.getByLabel("Regulation")).toHaveValue("m-a");

  await page.getByLabel("Regulation").selectOption("m-c");
  await expect(page).toHaveURL(/\/$/);
  await expectPokedexReady(page, "m-c");
  await expect(page.getByLabel("Regulation")).toHaveValue("m-c");
});

test("switches explicit regulations and preserves header behavior", async ({
  page,
}) => {
  const picker = page.getByLabel("Regulation");
  await expect(picker).toHaveCount(1);
  await expect(picker.locator("option")).toHaveText([
    "Regulation M-C",
    "Regulation M-B",
    "Regulation M-A",
  ]);
  await expect(page.locator(".pokedex-title select")).toHaveCount(0);
  await expect(page.locator("[data-regulation-selector]")).toHaveAttribute(
    "data-enhanced",
    "",
  );
  await picker.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/regulation=m-b/);
  await expectPokedexReady(page, "m-b");
  await expect(page.getByLabel("Regulation")).toHaveValue("m-b");
  await page.getByLabel("Regulation").selectOption("m-a");
  await expect(page).toHaveURL(/regulation=m-a/);
  await expectPokedexReady(page, "m-a");
  await page.goBack();
  await expect(page).toHaveURL(/regulation=m-b/);
  await expectPokedexReady(page, "m-b");
  await expect(page.getByLabel("Regulation")).toHaveValue("m-b");
  await page.goForward();
  await expect(page).toHaveURL(/regulation=m-a/);
  await expectPokedexReady(page, "m-a");
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  await expect(page.locator(".site-header__brand small")).toHaveText(
    "development",
  );
  const brand = page.locator(".site-header__brand");
  const brandGeometry = await brand.evaluate((link) => {
    const logo = link.querySelector<HTMLImageElement>(
      ".site-header__brand-logo",
    )!;
    const text = link.querySelector<HTMLElement>(".site-header__brand-text")!;
    const name = link.querySelector<HTMLElement>(".site-header__brand-name")!;
    const version = link.querySelector<HTMLElement>(".site-header__version")!;
    const header = link.closest<HTMLElement>(".site-header")!;
    const account = header.querySelector<HTMLElement>(".site-header__account")!;
    const box = (element: HTMLElement) => {
      const value = element.getBoundingClientRect();
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height,
      };
    };
    const linkStyle = getComputedStyle(link);
    const nameStyle = getComputedStyle(name);
    const versionStyle = getComputedStyle(version);
    return {
      display: linkStyle.display,
      authoredDisplay: [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules];
          } catch {
            return [];
          }
        })
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
        .find((rule) => rule.selectorText === ".site-header__brand")?.style
        .display,
      direction: linkStyle.flexDirection,
      alignment: linkStyle.alignItems,
      link: box(link),
      logo: box(logo),
      logoComplete: logo.complete,
      logoNaturalWidth: logo.naturalWidth,
      logoAlt: logo.getAttribute("alt"),
      logoAriaHidden: logo.getAttribute("aria-hidden"),
      text: box(text),
      name: box(name),
      version: box(version),
      header: box(header),
      account: box(account),
      nameFontSize: Number.parseFloat(nameStyle.fontSize),
      nameWeight: Number.parseFloat(nameStyle.fontWeight),
      nameColor: nameStyle.color,
      versionFontSize: Number.parseFloat(versionStyle.fontSize),
      versionWeight: Number.parseFloat(versionStyle.fontWeight),
      versionColor: versionStyle.color,
    };
  });
  expect(brandGeometry.authoredDisplay).toBe("inline-flex");
  expect(brandGeometry.display).toBe("flex");
  expect(brandGeometry.direction).toBe("row");
  expect(brandGeometry.alignment).toBe("center");
  expect(brandGeometry.logoComplete).toBe(true);
  expect(brandGeometry.logoNaturalWidth).toBeGreaterThan(0);
  expect(brandGeometry.logoAlt).toBe("");
  expect(brandGeometry.logoAriaHidden).toBe("true");
  expect(brandGeometry.logo.right).toBeLessThanOrEqual(brandGeometry.text.left);
  expect(brandGeometry.logo.width).toBe(brandGeometry.logo.height);
  expect(
    brandGeometry.version.top - brandGeometry.name.bottom,
  ).toBeGreaterThanOrEqual(1);
  expect(
    brandGeometry.version.top - brandGeometry.name.bottom,
  ).toBeLessThanOrEqual(4);
  expect(
    Math.abs(brandGeometry.version.left - brandGeometry.name.left),
  ).toBeLessThanOrEqual(1);
  expect(brandGeometry.versionFontSize).toBeLessThan(
    brandGeometry.nameFontSize,
  );
  expect(brandGeometry.versionWeight).toBeLessThan(brandGeometry.nameWeight);
  expect(brandGeometry.versionColor).not.toBe(brandGeometry.nameColor);
  const viewportScreenshot = await page.screenshot();
  const sampledColors = await page.evaluate(
    async ({ source, sampleX, sampleY }) => {
      const toRgb = (value: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const scaleX = image.naturalWidth / innerWidth;
      const scaleY = image.naturalHeight / innerHeight;
      const background = [
        ...context
          .getImageData(
            Math.round(sampleX * scaleX),
            Math.round(sampleY * scaleY),
            1,
            1,
          )
          .data.slice(0, 3),
      ];
      return {
        background,
        foreground: toRgb(
          getComputedStyle(document.querySelector(".site-header__version")!)
            .color,
        ),
      };
    },
    {
      source: `data:image/png;base64,${viewportScreenshot.toString("base64")}`,
      sampleX: brandGeometry.version.right + 6,
      sampleY: brandGeometry.version.top + brandGeometry.version.height / 2,
    },
  );
  const luminance = (rgb: number[]) => {
    const values = rgb.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
  };
  const [bright, dark] = [
    luminance(sampledColors.foreground),
    luminance(sampledColors.background),
  ].sort((left, right) => right - left);
  expect((bright! + 0.05) / (dark! + 0.05)).toBeGreaterThanOrEqual(4.5);
  for (const child of [
    brandGeometry.logo,
    brandGeometry.text,
    brandGeometry.name,
    brandGeometry.version,
  ]) {
    expect(child.left).toBeGreaterThanOrEqual(brandGeometry.link.left - 1);
    expect(child.right).toBeLessThanOrEqual(brandGeometry.link.right + 1);
    expect(child.top).toBeGreaterThanOrEqual(brandGeometry.link.top - 1);
    expect(child.bottom).toBeLessThanOrEqual(brandGeometry.link.bottom + 1);
  }
  expect(brandGeometry.link.left).toBeGreaterThanOrEqual(
    brandGeometry.header.left,
  );
  expect(brandGeometry.link.right).toBeLessThanOrEqual(
    brandGeometry.account.left,
  );
  await brand.focus();
  await expect(brand).toBeFocused();
  await expect(brand).toHaveAccessibleName("Bagredex development");
  const focusStyle = await brand.evaluate((link) => {
    const style = getComputedStyle(link);
    const linkBox = link.getBoundingClientRect();
    const headerBox = link
      .closest<HTMLElement>(".site-header")!
      .getBoundingClientRect();
    const extent =
      Number.parseFloat(style.outlineWidth) +
      Number.parseFloat(style.outlineOffset);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineOffset: Number.parseFloat(style.outlineOffset),
      expanded: {
        left: linkBox.left - extent,
        top: linkBox.top - extent,
        right: linkBox.right + extent,
        bottom: linkBox.bottom + extent,
      },
      header: {
        left: headerBox.left,
        top: headerBox.top,
        right: headerBox.right,
        bottom: headerBox.bottom,
      },
    };
  });
  expect(focusStyle.outlineStyle).toBe("solid");
  expect(focusStyle.outlineWidth).toBeGreaterThan(0);
  expect(focusStyle.outlineOffset).toBeGreaterThanOrEqual(0);
  expect(focusStyle.expanded.left).toBeGreaterThanOrEqual(
    focusStyle.header.left,
  );
  expect(focusStyle.expanded.top).toBeGreaterThanOrEqual(focusStyle.header.top);
  expect(focusStyle.expanded.right).toBeLessThanOrEqual(
    focusStyle.header.right,
  );
  expect(focusStyle.expanded.bottom).toBeLessThanOrEqual(
    focusStyle.header.bottom,
  );
  expect(focusStyle.expanded.left).toBeGreaterThanOrEqual(0);
  expect(focusStyle.expanded.right).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await expect(brand).toHaveAttribute("href", "/?regulation=m-a");
  await expect(
    brand.locator(
      ".site-header__brand-text > span, .site-header__brand-text > small",
    ),
  ).toHaveCount(2);
  await expect(brand.locator("img.site-header__brand-logo")).toHaveCount(1);
  await expect(page.locator("a.site-header__brand")).toHaveCount(1);
  const identity = page.locator(".site-header__identity");
  const originalIdentity = await identity.textContent();
  await identity.evaluate((element) => {
    element.textContent = "VeryLongAuthenticatedTrainerIdentityWithoutSpaces";
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const responsiveHeader = await page.locator(".site-header").boundingBox();
  const responsiveBrand = await brand.boundingBox();
  const responsiveAccount = await page
    .locator(".site-header__account")
    .boundingBox();
  const responsiveIdentity = await identity.boundingBox();
  const logout = await page
    .getByRole("button", { name: "Log out" })
    .boundingBox();
  for (const box of [
    responsiveBrand,
    responsiveAccount,
    responsiveIdentity,
    logout,
  ]) {
    expect(box!.x).toBeGreaterThanOrEqual(responsiveHeader!.x - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      responsiveHeader!.x + responsiveHeader!.width + 1,
    );
    expect(box!.y).toBeGreaterThanOrEqual(responsiveHeader!.y - 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      responsiveHeader!.y + responsiveHeader!.height + 1,
    );
  }
  expect(responsiveBrand!.x + responsiveBrand!.width).toBeLessThanOrEqual(
    responsiveAccount!.x + 1,
  );
  await identity.evaluate((element, value) => {
    element.textContent = value;
  }, originalIdentity ?? "");
});

test("supports Pokédex keyboard selection", async ({ page }, testInfo) => {
  const reminder = page.locator(".shortcut-reminder");
  await expect(reminder).toHaveText("Press ? for keyboard shortcuts");
  await expect(reminder.locator("kbd")).toHaveCount(1);
  await expect(reminder.locator("a, button, [tabindex]")).toHaveCount(0);
  const search = page.getByLabel(/Search Pokémon/);
  await expect(search).toBeVisible();
  await expect(search).toBeEnabled();
  const eligibleShortcutTarget = page.getByRole("heading", {
    name: "Pokédex",
  });
  await eligibleShortcutTarget.evaluate((heading) => {
    heading.setAttribute("tabindex", "-1");
  });
  await eligibleShortcutTarget.focus();
  await expect(eligibleShortcutTarget).toBeFocused();
  await page.keyboard.press("Slash");
  await expect(search).toBeFocused();
  expect(
    await page.evaluate(() => {
      const event = new KeyboardEvent("keydown", {
        key: "s",
        ctrlKey: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  const shortcutInvoker = page
    .locator(".pokemon-table tbody th button")
    .first();
  await shortcutInvoker.focus();
  await page.keyboard.press("Shift+Slash");
  const shortcutDialog = page.getByRole("dialog", {
    name: "Pokédex keyboard shortcuts",
  });
  await expect(shortcutDialog).toBeVisible();
  await expect(shortcutDialog.locator("kbd")).toHaveCount(9);
  await expect(shortcutDialog).toContainText("↑ / ↓");
  await expect(
    shortcutDialog.getByRole("button", { name: "Close shortcuts" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    shortcutDialog.getByRole("button", { name: "Close shortcuts" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(shortcutDialog).toHaveCount(0);
  await expect(shortcutInvoker).toBeFocused();
  await page.keyboard.press("Shift+Slash");
  await shortcutDialog.getByRole("button", { name: "Close shortcuts" }).click();
  await expect(shortcutDialog).toHaveCount(0);
  await expect(shortcutInvoker).toBeFocused();
  await page.keyboard.press("Shift+Slash");
  await shortcutDialog.evaluate((dialog) => dialog.click());
  await expect(shortcutDialog).toHaveCount(0);
  await expect(shortcutInvoker).toBeFocused();
  await eligibleShortcutTarget.focus();
  await expect(eligibleShortcutTarget).toBeFocused();
  await page.keyboard.press("Slash");
  await expect(search).toBeFocused();
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
    const cleanEdge = await search.evaluate((input) => {
      const box = input.getBoundingClientRect();
      const elementAtEdge = document.elementFromPoint(
        box.x + box.width / 2,
        box.bottom - 2,
      );
      return {
        edgeOwnsPointer: elementAtEdge === input,
        borderBottomStyle: getComputedStyle(input).borderBottomStyle,
        borderBottomWidth: getComputedStyle(input).borderBottomWidth,
        boxShadow: getComputedStyle(input).boxShadow,
      };
    });
    await testInfo.attach(`search-focus-${state}-geometry`, {
      body: Buffer.from(
        JSON.stringify(
          { cleanEdge, externalGap, focusExtent, inputBox, lowerBox },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
    expect(externalGap).toBeGreaterThanOrEqual(0);
    expect(cleanEdge.edgeOwnsPointer).toBe(true);
    expect(cleanEdge.borderBottomStyle).toBe("solid");
    expect(Number.parseFloat(cleanEdge.borderBottomWidth)).toBe(1);
    expect(cleanEdge.boxShadow).not.toContain("inset");
  };
  await assertVisibleLowerFocusEdge(page.locator(".table-scroll"), "closed");
  await testInfo.attach("search-focus-closed", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await search.fill("a");
  await expect(page.locator(".suggestion-enter-hint")).toHaveCount(1);
  await expect(
    page
      .getByRole("option")
      .filter({ has: page.locator(".suggestion-enter-hint") }),
  ).toHaveCount(1);
  const hintGeometry = await page
    .locator(".search-field__input-wrap")
    .evaluate((wrap) => {
      const input = wrap.querySelector("input")!;
      const hint = wrap.querySelector(".search-shortcut-hint")!;
      const inputBox = input.getBoundingClientRect();
      const hintBox = hint.getBoundingClientRect();
      const style = getComputedStyle(input);
      return {
        hintRight: hintBox.right,
        textStart: inputBox.left + Number.parseFloat(style.paddingLeft),
        clearReserve: Number.parseFloat(style.paddingRight),
      };
    });
  expect(hintGeometry.hintRight).toBeLessThanOrEqual(
    hintGeometry.textStart + 1,
  );
  expect(hintGeometry.clearReserve).toBeGreaterThanOrEqual(40);
  await expect(page.getByRole("listbox")).toBeVisible();
  await search.press("Tab");
  await expect(search).toBeFocused();
  await expect(page.locator(".suggestion-enter-hint")).toHaveCount(1);
  const firstActive = await search.getAttribute("aria-activedescendant");
  expect(firstActive).toBeTruthy();
  await search.press("Shift+Tab");
  await expect(search).toBeFocused();
  expect(await search.getAttribute("aria-activedescendant")).not.toBe(
    firstActive,
  );
  await search.press("Alt+ArrowDown");
  await expect(search).toBeFocused();
  const activeGroup = async () =>
    search.evaluate((input) => {
      const active = input.getAttribute("aria-activedescendant");
      return active
        ? document
            .getElementById(active)
            ?.closest(".suggestions__group")
            ?.querySelector("h3")?.textContent
        : null;
    });
  expect(await activeGroup()).toBe("Pokémon");
  await search.press("Alt+ArrowDown");
  expect(await activeGroup()).not.toBe("Pokémon");
  await search.press("Alt+ArrowUp");
  expect(await activeGroup()).toBe("Pokémon");
  await search.press("Escape");
  await expect(search).not.toBeFocused();
  await expect(search).toHaveValue("a");
  await search.focus();
  await search.fill("definitely-no-result");
  await expect(page.getByText("No matches")).toBeVisible();
  expect(
    await search.evaluate((input) => {
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await search.fill("mega");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  const firstPokemonSuggestion = (
    await page.getByRole("listbox").getByRole("option").first().textContent()
  )
    ?.replace("Enter", "")
    .trim();
  await assertVisibleLowerFocusEdge(page.getByRole("listbox"), "open");
  await testInfo.attach("search-focus-open", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await search.press("Enter");
  await expect(page.getByText("Selected Pokémon")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: firstPokemonSuggestion ?? "",
      exact: true,
    }),
  ).toBeVisible();
  await search.fill("protect");
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await expect(
    page.getByRole("option", { name: "Protect", exact: true }),
  ).toBeVisible();
  await search.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remove Protect move filter" }),
  ).toBeVisible();
  await eligibleShortcutTarget.focus();
  await page.keyboard.press("Shift+C");
  const clearDialog = page.getByRole("dialog", {
    name: "Clear search and filters?",
  });
  await expect(clearDialog).toBeVisible();
  await expect(
    clearDialog.getByRole("button", { name: "Clear search and filters" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(clearDialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Protect move filter" }),
  ).toBeVisible();
  await eligibleShortcutTarget.focus();
  await page.keyboard.press("Shift+C");
  await page.keyboard.press("Enter");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Remove Protect move filter" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Show shiny / }).click();
  await expect(page.getByRole("img", { name: /^Shiny / })).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("preserves unrelated query values in native regulation submission", async ({
    page,
  }) => {
    await page.goto("/?view=grid&tag=first&tag=second&regulation=m-c");
    const picker = page.getByLabel("Regulation");
    await picker.selectOption("m-b");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/regulation=m-b/);
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    const query = new URL(page.url()).searchParams;
    expect(query.getAll("regulation")).toEqual(["m-b"]);
    expect(query.get("view")).toBe("grid");
    expect(query.getAll("tag")).toEqual(["first", "second"]);
  });
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
    "descending",
  );
  await hp.click();
  await expect(hp.locator("xpath=ancestor::th")).toHaveAttribute(
    "aria-sort",
    "ascending",
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
    await expect(header).toHaveAttribute("aria-sort", "descending");
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
    await expect(header).toHaveAttribute("aria-sort", "descending");
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
    for (const direction of ["descending", "ascending", "none"]) {
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
  await expectPokedexReady(page);
  const search = page.getByLabel(/Search Pokémon/);
  await search.fill("charizard");
  await page.getByRole("option", { name: "Charizard", exact: true }).click();
  await expect(
    page.locator('.detail-pane[data-form="charizard"]'),
  ).toBeVisible();
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
  const inactiveMega = page
    .getByRole("button", { name: /Switch to Charizard-Mega/ })
    .first();
  const controlSurface = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      boxShadow: style.boxShadow,
    };
  };
  expect(await shinyToggle.evaluate(controlSurface)).toEqual(
    await inactiveMega.evaluate(controlSurface),
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
  const statTable = page.getByRole("table", { name: "Level 50 stats" });
  for (const cell of await statTable
    .locator('[role="columnheader"], [role="rowheader"], [role="cell"]')
    .all())
    await expect(cell).toHaveCSS("text-align", "center");
  const moveTable = page.getByLabel("Legal moves");
  await expect(moveTable.getByText("Name", { exact: true })).toBeVisible();
  expect(
    await moveTable
      .locator('[role="columnheader"], [role="cell"]')
      .evaluateAll((cells) =>
        cells.every((cell) => getComputedStyle(cell).textAlign === "center"),
      ),
  ).toBe(true);
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
  const statusCategory = moveTable.getByText("Status", { exact: true }).first();
  const statusRow = statusCategory.locator("xpath=ancestor::*[@role='row'][1]");
  const statusIcon = statusRow.locator(".move-category img.icon");
  await statusIcon.scrollIntoViewIfNeeded();
  await expect(statusIcon).toHaveAttribute("src", /status-move-[^/]+\.svg$/);
  await expect(statusIcon).toHaveAttribute("alt", "");
  expect(
    await statusIcon.evaluate((image) => ({
      present: image.hasAttribute("aria-hidden"),
      value: image.getAttribute("aria-hidden"),
    })),
  ).toEqual({ present: true, value: expect.stringMatching(/^(?:true)?$/) });
  const statusIconSource = await statusIcon.getAttribute("src");
  expect(statusIconSource).not.toBeNull();
  const pageUrl = new URL(page.url());
  const statusIconUrl = new URL(statusIconSource!, pageUrl);
  expect(statusIconUrl.origin).toBe(pageUrl.origin);
  const statusIconResponse = await page.request.get(statusIconUrl.href);
  expect(statusIconResponse.ok()).toBe(true);
  expect(statusIconResponse.headers()["content-type"]).toContain(
    "image/svg+xml",
  );
  expect(await statusIconResponse.text()).toContain('viewBox="0 0 48 48"');
  const [statusIconBox, statusContrast] = await Promise.all([
    statusIcon.boundingBox(),
    statusRow.evaluate((row) => {
      const rgb = (value: string) =>
        (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = ([red, green, blue]: number[]) => {
        const channels = [red!, green!, blue!].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (
          0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
        );
      };
      const ratio = (left: number[], right: number[]) => {
        const [bright, dark] = [luminance(left), luminance(right)].sort(
          (a, b) => b - a,
        );
        return (bright! + 0.05) / (dark! + 0.05);
      };
      const deep = [0x4f, 0x6f, 0x82];
      const white = [255, 255, 255];
      const background = rgb(getComputedStyle(row).backgroundColor);
      return {
        background: getComputedStyle(row).backgroundColor,
        deepToBackground: ratio(deep, background),
        whiteToDeep: ratio(white, deep),
      };
    }),
  ]);
  expect(statusIconBox?.width).toBeGreaterThanOrEqual(19.99);
  expect(statusIconBox?.width).toBeLessThanOrEqual(20.01);
  expect(statusIconBox?.height).toBeGreaterThanOrEqual(19.99);
  expect(statusIconBox?.height).toBeLessThanOrEqual(20.01);
  expect(statusContrast.deepToBackground).toBeGreaterThanOrEqual(3);
  expect(statusContrast.whiteToDeep).toBeGreaterThanOrEqual(3);
  await testInfo.attach("status-icon-real-row", {
    body: await statusRow.screenshot(),
    contentType: "image/png",
  });
  await testInfo.attach("status-icon-contrast", {
    body: Buffer.from(JSON.stringify(statusContrast, null, 2)),
    contentType: "application/json",
  });
  const inactiveMoveIndicator = moveTable
    .getByRole("button", { name: "Sort moves by category" })
    .locator(".sort-indicator");
  await expect(inactiveMoveIndicator).toHaveCSS("visibility", "hidden");
  const statsInfo = page.getByRole("button", {
    name: "Show level-50 stat calculation information",
  });
  await expect(statsInfo.locator(".icon--information")).toBeVisible();
  const [infoBox, markBox] = await Promise.all([
    statsInfo.boundingBox(),
    statsInfo.locator(".icon--information").boundingBox(),
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
    const [buttonBox, contentBox, labelBox] = await Promise.all([
      button.boundingBox(),
      button.evaluate((element) => {
        const label = element.querySelector<HTMLElement>(".move-sort__label")!;
        const indicator =
          element.querySelector<HTMLElement>(".sort-indicator")!;
        const left = Math.min(
          label.getBoundingClientRect().left,
          indicator.getBoundingClientRect().left,
        );
        const right = Math.max(
          label.getBoundingClientRect().right,
          indicator.getBoundingClientRect().right,
        );
        return { x: left, width: right - left };
      }),
      textRangeBox(button.locator(".move-sort__label")),
    ]);
    expect(
      Math.abs(
        contentBox.x +
          contentBox.width / 2 -
          ((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(labelBox?.x ?? 0).toBeGreaterThanOrEqual((buttonBox?.x ?? 0) - 1);
    expect((labelBox?.x ?? 0) + (labelBox?.width ?? 0)).toBeLessThanOrEqual(
      (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) + 1,
    );
    if (key === "power")
      expect(await button.locator(".move-sort__label").textContent()).toBe(
        "Power",
      );
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
    await expect(header).toHaveAttribute(
      "aria-sort",
      key === "power" ? "descending" : "ascending",
    );
    await expect(button.locator(".sort-indicator")).toHaveCSS(
      "visibility",
      "visible",
    );
    await assertMoveIndicatorContained();
    await button.click();
    await expect(header).toHaveAttribute(
      "aria-sort",
      key === "power" ? "ascending" : "descending",
    );
    await assertMoveIndicatorContained();
    await button.click();
    await expect(header).toHaveAttribute("aria-sort", "none");
    await expect(button.locator(".sort-indicator")).toHaveCSS(
      "visibility",
      "hidden",
    );
    await assertMoveIndicatorContained();
  }
  const firstMoveAction = moveTable.locator(".move-row__action").first();
  await firstMoveAction.click();
  const moveDialog = page.getByRole("dialog");
  await expect(moveDialog.locator(".info-description")).toHaveCount(1);
  await expect(moveDialog.getByText("Power:", { exact: true })).toBeVisible();
  await expect(
    moveDialog.getByText("Accuracy:", { exact: true }),
  ).toBeVisible();
  await expect(moveDialog.getByText("PP:", { exact: true })).toBeVisible();
  await expect(
    moveDialog.getByText("Priority:", { exact: true }),
  ).toBeVisible();
  await expect(moveDialog.getByText("Target:", { exact: true })).toBeVisible();
  await expect(moveDialog.getByText("Flags:", { exact: true })).toBeVisible();
  const targetPill = moveDialog.locator(".info-grid .info-pill");
  await expect(targetPill).toHaveCount(1);
  await expect(targetPill).toHaveText(/^[A-Z][A-Za-z]*(?: [A-Z]+[A-Za-z]*)*$/);
  const flagPills = moveDialog.locator(".info-flags .info-pill");
  expect(await flagPills.count()).toBeGreaterThan(0);
  for (const pill of await moveDialog.locator(".info-pill").all()) {
    await expect(pill).toHaveJSProperty("tagName", "SPAN");
    await expect(pill).not.toHaveAttribute("tabindex");
  }
  await expect(
    moveDialog.locator(".info-flags button, .info-flags a"),
  ).toHaveCount(0);
  await moveDialog.getByRole("button", { name: "Close details" }).click();
  await testInfo.attach("corrected-icons-and-detail", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const mega = page
    .getByRole("button", { name: /Switch to Charizard-Mega/ })
    .first();
  await expect(mega).toBeVisible();
  const detailScroller = page.locator(".detail-pane");
  await detailScroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  const pageScrollBefore = await page.evaluate(() => scrollY);
  const eligibleArrowTarget = page.getByRole("heading", { name: "Pokédex" });
  await eligibleArrowTarget.evaluate((heading) => {
    heading.setAttribute("tabindex", "-1");
    (heading as HTMLElement).focus({ preventScroll: true });
  });
  await expect(eligibleArrowTarget).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(pageScrollBefore);
  await page.keyboard.press("ArrowDown");
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(
    48,
  );
  expect(await page.evaluate(() => scrollY)).toBe(pageScrollBefore);
  await page.keyboard.press("ArrowUp");
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(0);
  await detailScroller.evaluate((element) => {
    element.scrollTop = 120;
  });
  const sameFormScroll = await detailScroller.evaluate(
    (element) => element.scrollTop,
  );
  await page
    .locator(".pokemon-table tbody tr", { hasText: "Charizard" })
    .first()
    .getByRole("button", { name: "Charizard", exact: true })
    .click();
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(
    sameFormScroll,
  );
  await mega.click();
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(0);
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
  await detailScroller.evaluate((element) => {
    element.scrollTop = 120;
  });
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(
    120,
  );
  await page
    .getByRole("button", { name: /^Return to base form Charizard$/ })
    .click();
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(0);
  const differentRow = page
    .locator(".pokemon-table tbody tr")
    .filter({ hasNotText: "Charizard" })
    .first();
  const differentForm = (await differentRow.getByRole("button").textContent())!;
  await detailScroller.evaluate((element) => {
    element.scrollTop = 120;
  });
  await differentRow.getByRole("button").click();
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(
    page.getByRole("heading", { name: differentForm, exact: true }),
  ).toBeVisible();
  expectStableBoxes(
    [...spriteControlBaseline],
    [...(await stableSpriteControls())],
    ["sprite frame", "toggle row", "first toggle"],
    `${differentForm} sprite controls`,
  );
  await detailScroller.evaluate((element) => {
    element.scrollTop = 120;
  });
  await search.fill("charizard");
  await page.getByRole("option", { name: "Charizard", exact: true }).click();
  expect(await detailScroller.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "Blaze", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator(".info-description"),
  ).toHaveCount(1);
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

test("switches grouped forms and keeps Meowstic entries separate", async ({
  page,
}) => {
  await expectPokedexReady(page);
  const bootstrap = JSON.parse(
    (await page.locator("#pokedex-bootstrap").textContent()) ?? "null",
  ) as { details_url: string };
  const detailsResponse = await page.request.get(bootstrap.details_url);
  expect(detailsResponse.ok()).toBe(true);
  const details = (await detailsResponse.json()) as {
    forms: { id: string; form_group: unknown }[];
  };
  expect(
    details.forms.find(({ id }) => id === "castform")?.form_group,
    "The selected runtime must expose Castform's canonical detail group.",
  ).toMatchObject({
    label: "Form",
    options: expect.arrayContaining([
      { id: "castform", label: "Castform" },
      { id: "castformrainy", label: "Rainy" },
    ]),
  });
  const search = page.getByLabel(/Search Pokémon/);
  await search.fill("castform");
  await page.getByRole("option", { name: "Castform", exact: true }).click();
  const form = page.getByRole("combobox", { name: "Form", exact: true });
  await expect(form).toBeVisible();
  await page.getByRole("button", { name: "Show shiny Castform" }).click();
  await form.selectOption({ label: "Rainy" });
  await expect(
    page.getByRole("heading", { name: /Castform-Rainy/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Shiny Castform-Rainy/i }),
  ).toBeVisible();

  await search.fill("Castform-Rainy");
  await expect(
    page.getByRole("option", { name: "Castform-Rainy", exact: true }),
  ).toHaveCount(0);
  await search.fill("Meowstic");
  await expect(
    page.getByRole("option", { name: "Meowstic-Male", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Meowstic-Female", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: "Meowstic-Male", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meowstic-Male", exact: true }),
  ).toBeVisible();
  const maleSprite = await page
    .getByRole("img", { name: "Meowstic-Male", exact: true })
    .getAttribute("src");
  const maleMegaControls = await page
    .locator(".form-toggles button[aria-label*='Mega']")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );

  await search.fill("Meowstic");
  await page
    .getByRole("option", { name: "Meowstic-Female", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meowstic-Female", exact: true }),
  ).toBeVisible();
  const femaleSprite = await page
    .getByRole("img", { name: "Meowstic-Female", exact: true })
    .getAttribute("src");
  expect(femaleSprite).not.toBe(maleSprite);
  const femaleMegaControls = await page
    .locator(".form-toggles button[aria-label*='Mega']")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(maleMegaControls.every((label) => !label?.includes("Female"))).toBe(
    true,
  );
  expect(femaleMegaControls.every((label) => !label?.includes("Male"))).toBe(
    true,
  );
  if (maleMegaControls.length > 0 && femaleMegaControls.length > 0)
    expect(femaleMegaControls).not.toEqual(maleMegaControls);
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
  const initialLoading = page.getByRole("status");
  await expect(initialLoading).toBeVisible();
  await expect(initialLoading).toContainText("Loading Pokédex…");
  await expect(initialLoading).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".pokedex-app")).toHaveCount(0);
  await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", /stable/);
  const root = page.locator("[data-pokedex-root]");
  const app = page.locator(".pokedex-app");
  const heading = page.getByRole("heading", { name: "Pokédex" });
  const picker = page.getByLabel("Regulation");
  const list = page.locator(".pokedex-list");
  const detail = page.locator(".detail-pane");
  const toolbar = page.locator(".pokedex-title");
  const resultMeta = page.locator(".result-meta");
  const shortcutReminder = page.locator(".shortcut-reminder");
  const siteHeader = page.locator(".site-header");
  const brand = page.locator(".site-header__brand");
  const brandName = page.locator(".site-header__brand-name");
  const version = page.locator(".site-header__version");
  const account = page.locator(".site-header__account");
  await expect(heading).toBeVisible();
  const shellBoxes = await boxes([
    siteHeader,
    brand,
    brandName,
    version,
    account,
    root,
    app,
    list,
    detail,
    toolbar,
    heading,
    picker,
    resultMeta,
    shortcutReminder,
  ]);
  await testInfo.attach("delayed-index-shell", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await expect(page.getByText(/of \d+ Pokémon/)).toBeVisible();
  expectStableBoxes(
    shellBoxes,
    await boxes([
      siteHeader,
      brand,
      brandName,
      version,
      account,
      root,
      app,
      list,
      detail,
      toolbar,
      heading,
      picker,
      resultMeta,
      shortcutReminder,
    ]),
    [
      "site header",
      "brand link",
      "brand name",
      "version label",
      "account controls",
      "root",
      "app",
      "list",
      "detail",
      "toolbar",
      "heading",
      "picker",
      "result metadata",
      "shortcut reminder",
    ],
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
    resultMeta,
    shortcutReminder,
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
    "result metadata",
    "shortcut reminder",
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
    for (const direction of ["descending", "ascending", "none"]) {
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
  for (const direction of ["descending", "ascending", "none"]) {
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
  const emptyBoxes = await boxes([
    app,
    list,
    detail,
    toolbar,
    resultMeta,
    shortcutReminder,
    searchToolbar,
  ]);
  const selectionShiftStart = await page.evaluate(() => performance.now());
  await firstRow.locator("[data-label=HP]").click({ position: { x: 2, y: 2 } });
  await expect(firstRow.getByRole("button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Loading Pokémon details")).toBeVisible();
  expect(await detail.evaluate((element) => element.scrollTop)).toBe(0);
  expectStableBoxes(
    emptyBoxes,
    await boxes([
      app,
      list,
      detail,
      toolbar,
      resultMeta,
      shortcutReminder,
      searchToolbar,
    ]),
    [
      "app",
      "list",
      "detail",
      "toolbar",
      "result metadata",
      "shortcut reminder",
      "search toolbar",
    ],
    "empty detail to loading detail",
  );
  await expectNoOuterShiftSince(page, selectionShiftStart);
  await testInfo.attach("delayed-detail-loading", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  releaseDetails();
  await expect(detail.getByRole("heading", { name: "Stats" })).toBeVisible();
  expect(await detail.evaluate((element) => element.scrollTop)).toBe(0);
  expectStableBoxes(
    emptyBoxes,
    await boxes([
      app,
      list,
      detail,
      toolbar,
      resultMeta,
      shortcutReminder,
      searchToolbar,
    ]),
    [
      "app",
      "list",
      "detail",
      "toolbar",
      "result metadata",
      "shortcut reminder",
      "search toolbar",
    ],
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
