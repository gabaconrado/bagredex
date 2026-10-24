import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  App,
  detailArrowClaimable,
  formatMoveTarget,
  PokemonRow,
  shortcutTargetExcluded,
} from "./app";
import type { Bootstrap, BulkDetails, PokedexIndex } from "./contracts";

const bootstrap: Bootstrap = {
  schema_version: "pokedex-bootstrap-v2",
  active_version: "v1",
  regulation: { id: "m-c", name: "regulation-m-c" },
  index_url: "/index",
  details_url: "/details",
  sprite_url_template: "/sprites/__FORM__/__VARIANT__.webp",
};
const index: PokedexIndex = {
  schema_version: "pokedex-index-v1",
  data_version: "v1",
  regulation: bootstrap.regulation,
  forms: [
    {
      id: "charizard",
      name: "Charizard",
      national_dex_number: 6,
      is_mega: false,
      types: [{ id: "fire", name: "Fire" }],
      stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
      bst: 534,
      ability_ids: ["blaze"],
      move_ids: ["flamethrower"],
    },
  ],
  moves: [{ id: "flamethrower", name: "Flamethrower" }],
  abilities: [{ id: "blaze", name: "Blaze" }],
  types: [{ id: "fire", name: "Fire" }],
};
const detail: BulkDetails = {
  schema_version: "pokedex-details-v1",
  data_version: "v1",
  regulation_id: "m-c",
  forms: [
    {
      id: "charizard",
      name: "Charizard",
      is_list_legal: true,
      is_mega: false,
      form_label: "",
      base_id: "charizard",
      mega_ids: [],
      types: index.forms[0]!.types,
      stats: [
        {
          id: "hp",
          name: "HP",
          base: 78,
          real: 153,
          minimum: 153,
          maximum: 185,
        },
      ],
      ability_slots: [{ id: "blaze", slot: "0" }],
      move_ids: ["flamethrower"],
    },
  ],
  abilities: [
    {
      id: "blaze",
      name: "Blaze",
      short_description: "Powers up Fire moves.",
      description: "Powers up Fire moves when weakened.",
    },
  ],
  moves: [
    {
      id: "flamethrower",
      name: "Flamethrower",
      type: { id: "fire", name: "Fire" },
      category: "Special",
      base_power: 90,
      accuracy: 100,
      always_hits: false,
      pp: 15,
      priority: 0,
      target: "normal",
      short_description: "May burn.",
      description: "May burn the target.",
      flags: ["protect"],
    },
  ],
};
const response = (value: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(value) } as Response);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("move target presentation", () => {
  it.each([
    ["adjacentFoe", "Adjacent Foe"],
    ["userOrNPC", "User Or NPC"],
    ["normal", "Normal"],
  ])("humanizes %s without changing identifiers", (target, expected) => {
    expect(formatMoveTarget(target)).toBe(expected);
  });
});
describe("Pokédex shortcut eligibility", () => {
  it("excludes interactive and editable targets according to each shortcut", () => {
    const input = document.createElement("input");
    const button = document.createElement("button");
    const link = document.createElement("a");
    link.href = "/";
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const nested = document.createElement("span");
    editable.append(nested);
    expect(shortcutTargetExcluded(input, "/")).toBe(true);
    expect(shortcutTargetExcluded(button, "/")).toBe(true);
    expect(shortcutTargetExcluded(link, "/")).toBe(true);
    expect(shortcutTargetExcluded(nested, "/")).toBe(true);
    expect(shortcutTargetExcluded(input, "?")).toBe(true);
    expect(shortcutTargetExcluded(button, "?")).toBe(false);
    expect(shortcutTargetExcluded(document.body, "/")).toBe(false);
  });
  it("claims detail arrows only for an eligible ready overflowing pane", () => {
    const plain = document.createElement("div");
    const pane = { clientHeight: 200, scrollHeight: 500 };
    const event = {
      key: "ArrowDown",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: plain,
    };
    expect(detailArrowClaimable(event, "ready", "charizard", pane)).toBe(true);
    for (const state of ["idle", "loading", "error"] as const)
      expect(detailArrowClaimable(event, state, "charizard", pane)).toBe(false);
    expect(detailArrowClaimable(event, "ready", null, pane)).toBe(false);
    expect(
      detailArrowClaimable(event, "ready", "charizard", {
        clientHeight: 200,
        scrollHeight: 200,
      }),
    ).toBe(false);
    expect(detailArrowClaimable(event, "ready", "charizard", pane, true)).toBe(
      false,
    );
    for (const modifier of [
      "shiftKey",
      "ctrlKey",
      "metaKey",
      "altKey",
    ] as const)
      expect(
        detailArrowClaimable(
          { ...event, [modifier]: true },
          "ready",
          "charizard",
          pane,
        ),
      ).toBe(false);
    for (const markup of [
      "<input>",
      "<textarea></textarea>",
      "<select></select>",
      "<button></button>",
      '<a href="/"></a>',
      '<div contenteditable="true"><span></span></div>',
      "<dialog><span></span></dialog>",
    ]) {
      const host = document.createElement("div");
      host.innerHTML = markup;
      const target = host.querySelector("span") ?? host.firstElementChild!;
      expect(
        detailArrowClaimable({ ...event, target }, "ready", "charizard", pane),
      ).toBe(false);
    }
  });
});
describe("Pokédex app", () => {
  it("leaves information dialogs in control of their keyboard events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(detail),
      ),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await user.click(await screen.findByRole("button", { name: "Charizard" }));
    await user.type(screen.getByLabelText(/Search Pokémon/), "char");
    const ability = await screen.findByRole("button", { name: "Blaze" });
    await user.click(ability);
    await screen.findByRole("dialog", { name: "Blaze" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close details" }),
    );
    await user.keyboard("?");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Blaze" })).toBeTruthy();
    expect(screen.queryByText("Pokédex keyboard shortcuts")).toBeNull();
    await user.keyboard("{Shift>}C{/Shift}");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Blaze" })).toBeTruthy();
    expect(screen.queryByText("Clear search and filters?")).toBeNull();
    expect(
      (screen.getByLabelText(/Search Pokémon/) as HTMLInputElement).value,
    ).toBe("char");
  });
  it("supports global search/help shortcuts and suggestion traversal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(detail),
      ),
    );
    const user = userEvent.setup();
    const { unmount } = render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    const heading = screen.getByRole("heading", { name: "Pokédex" });
    heading.tabIndex = -1;
    await user.click(heading);
    heading.focus();
    let slashPrevented = false;
    const observeSlash = (event: KeyboardEvent) => {
      if (event.key === "/") slashPrevented = event.defaultPrevented;
    };
    window.addEventListener("keydown", observeSlash);
    await user.keyboard("/");
    window.removeEventListener("keydown", observeSlash);
    const search = screen.getByLabelText(/Search Pokémon/);
    expect(document.activeElement).toBe(search);
    await user.type(search, "a");
    expect(document.querySelectorAll(".suggestion-enter-hint")).toHaveLength(1);
    expect(
      document
        .querySelector(".suggestion-enter-hint")
        ?.closest('[role="option"]')?.id,
    ).toBe("suggestion-0");
    const modifiedKeys = [
      ...["Tab", "Enter"].flatMap((key) =>
        (["ctrlKey", "metaKey", "altKey"] as const).map(
          (modifier) => [key, modifier] as const,
        ),
      ),
      ...["ArrowDown", "ArrowUp"].flatMap((key) =>
        (["ctrlKey", "metaKey"] as const).map(
          (modifier) => [key, modifier] as const,
        ),
      ),
    ];
    for (const [key, modifier] of modifiedKeys) {
      const modified = new KeyboardEvent("keydown", {
        key,
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(search, modified);
      expect(modified.defaultPrevented).toBe(false);
      expect(search.getAttribute("aria-activedescendant")).toBeNull();
    }
    await user.tab();
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute("aria-activedescendant")).toBeTruthy();
    expect(
      document
        .querySelector(".suggestion-enter-hint")
        ?.closest('[role="option"]')?.id,
    ).toBe(search.getAttribute("aria-activedescendant"));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(search);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    const activeGroup = () =>
      document
        .getElementById(search.getAttribute("aria-activedescendant")!)
        ?.closest(".suggestions__group")
        ?.querySelector("h3")?.textContent;
    expect(activeGroup()).toBe("Pokémon");
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(activeGroup()).toBe("Moves");
    expect(
      document
        .querySelector(".suggestion-enter-hint")
        ?.closest('[role="option"]')?.id,
    ).toBe(search.getAttribute("aria-activedescendant"));
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(activeGroup()).toBe("Abilities");
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(activeGroup()).toBe("Pokémon");
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(activeGroup()).toBe("Abilities");
    await user.keyboard("{ArrowDown}");
    expect(
      document
        .querySelector(".suggestion-enter-hint")
        ?.closest('[role="option"]')?.id,
    ).toBe(search.getAttribute("aria-activedescendant"));
    await user.keyboard("{ArrowUp}");
    expect(
      document
        .querySelector(".suggestion-enter-hint")
        ?.closest('[role="option"]')?.id,
    ).toBe(search.getAttribute("aria-activedescendant"));
    await user.clear(search);
    await user.type(search, "char");
    expect(search.getAttribute("aria-activedescendant")).toBeNull();
    expect(
      document
        .querySelector(".suggestion-enter-hint")
        ?.closest('[role="option"]')?.id,
    ).toBe("suggestion-0");
    await user.keyboard("{Enter}");
    expect(document.querySelectorAll(".suggestion-enter-hint")).toHaveLength(0);
    await user.type(search, "fire");
    await user.click(screen.getByRole("option", { name: "Fire" }));
    expect(document.querySelectorAll(".suggestion-enter-hint")).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Remove Fire type filter" }),
    );
    expect(document.querySelectorAll(".suggestion-enter-hint")).toHaveLength(0);
    await user.type(search, "a");
    await user.keyboard("{Escape}");
    expect(document.activeElement).not.toBe(search);
    expect((search as HTMLInputElement).value).toBe("a");
    search.focus();
    await user.type(search, "?");
    expect((search as HTMLInputElement).value).toBe("a?");
    search.blur();
    heading.focus();
    let helpPrevented = false;
    const observeHelp = (event: KeyboardEvent) => {
      if (event.key === "?") helpPrevented = event.defaultPrevented;
    };
    window.addEventListener("keydown", observeHelp);
    await user.keyboard("?");
    window.removeEventListener("keydown", observeHelp);
    const dialog = await screen.findByRole("dialog", {
      name: "Pokédex keyboard shortcuts",
    });
    expect(dialog.querySelectorAll("kbd")).toHaveLength(9);
    expect(dialog.textContent).toContain("↑ / ↓");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close shortcuts" }),
    );
    await user.keyboard("{Shift>}C{/Shift}");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByText("Clear search and filters?")).toBeNull();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    search.focus();
    await user.clear(search);
    await user.type(search, "definitely-no-result");
    expect(screen.getByText("No matches")).toBeTruthy();
    expect(document.querySelectorAll(".suggestion-enter-hint")).toHaveLength(0);
    const emptyTab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(search, emptyTab);
    expect(emptyTab.defaultPrevented).toBe(false);
    const modified = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      cancelable: true,
    });
    window.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);
    unmount();
    const afterUnmount = new KeyboardEvent("keydown", {
      key: "/",
      cancelable: true,
    });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });
  it("scrolls an eligible detail pane and atomically confirms clearing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(detail),
      ),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await user.click(await screen.findByRole("button", { name: "Charizard" }));
    await screen.findByRole("heading", { name: "Stats" });
    const shiny = screen.getByRole("button", { name: "Show shiny Charizard" });
    await user.click(shiny);
    expect(shiny.getAttribute("aria-pressed")).toBe("true");
    const hpSort = screen.getByRole("button", { name: "Sort by HP" });
    await user.click(hpSort);
    expect(hpSort.getAttribute("aria-label")).toBe("Sort by HP, descending");
    const pane = document.querySelector<HTMLElement>(".detail-pane")!;
    Object.defineProperties(pane, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 500 },
    });
    const heading = screen.getByRole("heading", { name: "Pokédex" });
    heading.tabIndex = -1;
    await user.click(heading);
    heading.focus();
    const down = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(heading, down);
    expect(down.defaultPrevented).toBe(true);
    expect(pane.scrollTop).toBe(48);
    const up = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(heading, up);
    expect(up.defaultPrevented).toBe(true);
    expect(pane.scrollTop).toBe(0);
    pane.scrollTop = 300;
    const boundary = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(heading, boundary);
    expect(boundary.defaultPrevented).toBe(true);
    expect(pane.scrollTop).toBe(300);
    const modifiedArrow = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(heading, modifiedArrow);
    expect(modifiedArrow.defaultPrevented).toBe(false);
    expect(pane.scrollTop).toBe(300);
    Object.defineProperty(pane, "scrollHeight", {
      configurable: true,
      value: 200,
    });
    const nonoverflow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(heading, nonoverflow);
    expect(nonoverflow.defaultPrevented).toBe(false);
    const search = screen.getByLabelText(/Search Pokémon/);
    await user.type(search, "fire");
    await user.click(screen.getByRole("option", { name: "Fire" }));
    await user.type(search, "char");
    await user.keyboard("{ArrowDown}");
    expect(search.getAttribute("aria-activedescendant")).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.click(heading);
    heading.focus();
    for (const options of [
      { key: "c" },
      { key: "C", shiftKey: true, ctrlKey: true },
      { key: "C", shiftKey: true, metaKey: true },
      { key: "C", shiftKey: true, altKey: true },
    ]) {
      const ignored = new KeyboardEvent("keydown", {
        ...options,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(heading, ignored);
      expect(ignored.defaultPrevented).toBe(false);
      expect(screen.queryByRole("dialog")).toBeNull();
    }
    fireEvent(
      heading,
      new KeyboardEvent("keydown", {
        key: "C",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Clear search and filters?",
    });
    expect((search as HTMLInputElement).value).toBe("char");
    expect(
      screen.getByRole("button", { name: "Remove Fire type filter" }),
    ).toBeTruthy();
    expect((search as HTMLInputElement).value).toBe("char");
    expect(search.getAttribute("aria-activedescendant")).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove Fire type filter" }),
    ).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(search.getAttribute("aria-activedescendant")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Show normal Charizard" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Sort by HP, descending" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Charizard" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(pane.scrollTop).toBe(300);
    expect(dialog.isConnected).toBe(false);
    heading.focus();
    const emptyClear = new KeyboardEvent("keydown", {
      key: "C",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(heading, emptyClear);
    expect(emptyClear.defaultPrevented).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.type(search, "char");
    heading.focus();
    fireEvent(
      heading,
      new KeyboardEvent("keydown", {
        key: "C",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect((search as HTMLInputElement).value).toBe("char");
    expect(document.activeElement).toBe(heading);
    await user.clear(search);
    await user.type(search, "fire");
    await user.click(screen.getByRole("option", { name: "Fire" }));
    heading.focus();
    fireEvent(
      heading,
      new KeyboardEvent("keydown", {
        key: "C",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    const filtersOnlyDialog = await screen.findByRole("dialog", {
      name: "Clear search and filters?",
    });
    fireEvent.click(filtersOnlyDialog);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove Fire type filter" }),
    ).toBeTruthy();
    expect((search as HTMLInputElement).value).toBe("");
  });
  it("confirms query-only and filter-only clearing independently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(detail),
      ),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    const search = screen.getByLabelText(/Search Pokémon/);
    const heading = screen.getByRole("heading", { name: "Pokédex" });
    heading.tabIndex = -1;

    await user.type(search, "char");
    heading.focus();
    await user.keyboard("{Shift>}C{/Shift}");
    await user.click(
      await screen.findByRole("button", {
        name: "Clear search and filters",
      }),
    );
    expect((search as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search);

    await user.type(search, "fire");
    await user.click(screen.getByRole("option", { name: "Fire" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(
      screen.getByRole("button", { name: "Remove Fire type filter" }),
    ).toBeTruthy();
    heading.focus();
    await user.keyboard("{Shift>}C{/Shift}");
    await user.click(
      await screen.findByRole("button", {
        name: "Clear search and filters",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Remove Fire type filter" }),
    ).toBeNull();
    expect((search as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search);
  });
  it("dispatches exactly one row selection for cells, Enter, and Space", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const first = index.forms[0]!;
    const second = { ...first, id: "charizard-two", name: "Charizard Two" };
    render(
      <table>
        <tbody>
          <PokemonRow
            form={first}
            selected={false}
            onSelect={onSelect}
            spriteTemplate={bootstrap.sprite_url_template}
          />
          <PokemonRow
            form={second}
            selected={false}
            onSelect={onSelect}
            spriteTemplate={bootstrap.sprite_url_template}
          />
        </tbody>
      </table>,
    );
    const rows = screen.getAllByRole("row");
    fireEvent.click(rows[0]!.querySelector(".pokemon-table__sprite")!);
    expect(onSelect).toHaveBeenNthCalledWith(1, first.id);
    fireEvent.click(rows[1]!.querySelector(".pokemon-table__types")!);
    expect(onSelect).toHaveBeenNthCalledWith(2, second.id);
    fireEvent.click(rows[0]!.querySelector("[data-label=HP]")!);
    expect(onSelect).toHaveBeenNthCalledWith(3, first.id);
    const firstButton = screen.getByRole("button", { name: first.name });
    firstButton.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenNthCalledWith(4, first.id);
    const secondButton = screen.getByRole("button", { name: second.name });
    secondButton.focus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenNthCalledWith(5, second.id);
    expect(onSelect).toHaveBeenCalledTimes(5);
  });

  it("restores pointer sort origin but preserves the keyboard viewport", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(detail),
      ),
    );
    const { container } = render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    const scroll = container.querySelector<HTMLElement>(".table-scroll")!;
    const bst = screen.getByRole("button", { name: "Sort by BST" });
    const header = bst.closest("th")!;
    for (const direction of ["descending", "ascending", "none"]) {
      scroll.scrollLeft = 9;
      fireEvent.pointerDown(bst);
      fireEvent.click(bst, { detail: 1 });
      expect(scroll.scrollLeft).toBe(9);
      expect(header.getAttribute("aria-sort")).toBe(direction);
    }
    scroll.scrollLeft = 7;
    for (const direction of ["descending", "ascending", "none"]) {
      fireEvent.click(bst, { detail: 0 });
      expect(scroll.scrollLeft).toBe(7);
      expect(header.getAttribute("aria-sort")).toBe(direction);
    }
  });

  it("keeps names, types, and quiet sort indicators in explicit table columns", async () => {
    const longName = "Tauros-Paldea-Blaze-Bagredex-Long-Form";
    const tableIndex = {
      ...index,
      forms: [
        {
          ...index.forms[0]!,
          name: longName,
          types: [
            { id: "fire", name: "Fire" },
            { id: "water", name: "Water" },
          ],
        },
      ],
    };
    const fetch = vi.fn((url: string) =>
      url === "/index" ? response(tableIndex) : response(detail),
    );
    vi.stubGlobal("fetch", fetch);
    const { container } = render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    expect(container.querySelectorAll(".pokemon-table col")).toHaveLength(10);
    const name = screen.getByRole("button", { name: longName });
    expect(name.getAttribute("title")).toBe(longName);
    expect(name.closest("th")?.classList.contains("pokemon-table__name")).toBe(
      true,
    );
    expect(
      name.closest("tr")?.querySelector(".pokemon-table__types .type-list"),
    ).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.click(name.closest("tr")!.querySelector("[data-label=HP]")!);
    expect(name.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(name.closest("tr")!.querySelector("td")!);
    fireEvent.click(
      name.closest("tr")!.querySelector(".pokemon-table__types")!,
    );
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.click(name, { detail: 0 });
    expect(name.getAttribute("aria-pressed")).toBe("true");
    expect(fetch).toHaveBeenCalledTimes(2);
    const hp = screen.getByRole("button", { name: "Sort by HP" });
    expect(hp.getAttribute("title")).toBe("Sort by HP");
    expect(hp.querySelector(".sort-label--full")?.textContent).toBe("HP");
    const attack = screen.getByRole("button", { name: "Sort by Attack" });
    expect(attack.getAttribute("title")).toBe("Sort by Attack");
    expect(attack.querySelector(".sort-label--short")?.textContent).toBe("Atk");
    const indicator = hp.querySelector(".sort-indicator")!;
    expect(indicator.classList.contains("is-inactive")).toBe(true);
    fireEvent.click(hp);
    expect(hp.getAttribute("aria-label")).toBe("Sort by HP, descending");
    expect(indicator.classList.contains("is-inactive")).toBe(false);
    fireEvent.click(hp);
    expect(hp.getAttribute("aria-label")).toBe("Sort by HP, ascending");
    fireEvent.click(hp);
    expect(hp.getAttribute("aria-label")).toBe("Sort by HP");
    expect(indicator.classList.contains("is-inactive")).toBe(true);
  });

  it("paints the index before one bulk request and resolves the latest pending selection", async () => {
    const bulbasaur = {
      ...index.forms[0]!,
      id: "bulbasaur",
      name: "Bulbasaur",
      national_dex_number: 1,
    };
    const twoIndex = { ...index, forms: [bulbasaur, ...index.forms] };
    let resolveDetails!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveDetails = resolve;
    });
    const fetch = vi.fn((url: string) =>
      url === "/index" ? response(twoIndex) : pending,
    );
    vi.stubGlobal("fetch", fetch);
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("2 of 2 Pokémon");
    fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
    fireEvent.click(screen.getByRole("button", { name: "Bulbasaur" }));
    expect(screen.getByLabelText("Loading Pokémon details")).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    resolveDetails(
      await response({
        ...detail,
        forms: [
          {
            ...detail.forms[0]!,
            id: "bulbasaur",
            name: "Bulbasaur",
            base_id: "bulbasaur",
          },
          ...detail.forms,
        ],
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Bulbasaur" }),
    ).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the empty pane on background failure and offers retry once selected", async () => {
    let rejectDetails!: (reason: Error) => void;
    const failedDetails = new Promise<Response>((_resolve, reject) => {
      rejectDetails = reject;
    });
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => response(index))
      .mockImplementationOnce(() => failedDetails)
      .mockImplementationOnce(() => response(detail));
    vi.stubGlobal("fetch", fetch);
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    expect(
      screen.getByRole("heading", { name: "Choose a Pokémon" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    rejectDetails(new Error("Bulk unavailable"));
    expect(
      await screen.findByRole("heading", { name: "Details unavailable" }),
    ).toBeTruthy();
    expect(screen.getByText("Bulk unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry details" }));
    expect(
      await screen.findByRole("heading", { name: "Charizard" }),
    ).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(
      screen.queryByRole("heading", { name: "Details unavailable" }),
    ).toBeNull();
  });

  it("supports keyboard search, filters, selection, shiny, and detail info", async () => {
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        url === "/index" ? response(index) : response(detail),
      );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    const search = screen.getByLabelText(/Search Pokémon/);
    await user.type(search, "flame");
    expect(screen.getByRole("option", { name: "Flamethrower" })).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(
      screen.getByRole("button", { name: /Remove Flamethrower/ }),
    ).toBeTruthy();
    await user.clear(search);
    await user.type(search, "char");
    await user.keyboard("{ArrowDown}{Enter}");
    await screen.findByRole("heading", { name: "Charizard" });
    const selectedSprite = screen.getByRole("img", { name: "Charizard" });
    const shinyControl = screen.getByRole("button", {
      name: "Show shiny Charizard",
    });
    expect(shinyControl.classList.contains("icon-toggle--shiny")).toBe(true);
    expect(shinyControl.querySelector(".icon--shiny")).toBeTruthy();
    expect(
      selectedSprite.compareDocumentPosition(shinyControl) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Shiny")).toBeNull();
    expect(
      [...document.querySelectorAll<HTMLImageElement>("img.icon")].every(
        (icon) =>
          icon.alt === "" && icon.getAttribute("aria-hidden") === "true",
      ),
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Show shiny Charizard" }),
    );
    expect(screen.getByAltText("Shiny Charizard").getAttribute("src")).toBe(
      "/sprites/charizard/shiny.webp",
    );
    await user.click(
      screen.getByRole("button", { name: /Flamethrower.*Fire/ }),
    );
    expect(screen.getByText("May burn the target.")).toBeTruthy();
    const closeButton =
      document.querySelector<HTMLButtonElement>(".dialog-close")!;
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.click(closeButton);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /Flamethrower.*Fire/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Flamethrower.*Fire/ }),
    );
    fireEvent.click(await screen.findByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders exactly one full description for unequal and equal modal fields", async () => {
    const modalDetails: BulkDetails = {
      ...detail,
      forms: [
        {
          ...detail.forms[0]!,
          ability_slots: [
            { id: "blaze", slot: "0" },
            { id: "toughclaws", slot: "1" },
          ],
          move_ids: ["flamethrower", "protect"],
        },
      ],
      abilities: [
        ...detail.abilities,
        {
          id: "toughclaws",
          name: "Tough Claws",
          short_description: "Boosts contact moves.",
          description: "Boosts contact moves.",
        },
      ],
      moves: [
        { ...detail.moves[0]!, flags: ["protect", "mirrorFlag", "Sound"] },
        {
          ...detail.moves[0]!,
          id: "protect",
          name: "Protect",
          category: "Status",
          base_power: 0,
          short_description: "Protects the user.",
          description: "Protects the user.",
          flags: [],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(modalDetails),
      ),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    await user.click(screen.getByRole("button", { name: "Charizard" }));
    await screen.findByRole("heading", { name: "Charizard" });

    const cases = [
      {
        button: "Blaze",
        full: "Powers up Fire moves when weakened.",
        shortOnly: "Powers up Fire moves.",
      },
      { button: "Tough Claws", full: "Boosts contact moves." },
      {
        button: /Flamethrower.*Fire/,
        full: "May burn the target.",
        shortOnly: "May burn.",
      },
      { button: /Protect.*Fire/, full: "Protects the user." },
    ] as const;
    for (const modalCase of cases) {
      await user.click(screen.getByRole("button", { name: modalCase.button }));
      const dialog = await screen.findByRole("dialog");
      const descriptions = dialog.querySelectorAll(".info-description");
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0]?.textContent).toBe(modalCase.full);
      if ("shortOnly" in modalCase)
        expect(dialog.textContent).not.toContain(modalCase.shortOnly);
      if (typeof modalCase.button !== "string") {
        const target = dialog.querySelector(".info-grid .info-pill");
        expect(target?.textContent).toBe("Normal");
        const flagPills = [
          ...dialog.querySelectorAll<HTMLElement>(".info-flags .info-pill"),
        ].map((pill) => pill.textContent);
        if (modalCase.full === "May burn the target.")
          expect(flagPills).toEqual(["protect", "mirrorFlag", "Sound"]);
        else {
          expect(flagPills).toEqual([]);
          expect(dialog.querySelector(".info-flags")?.textContent).toContain(
            "None",
          );
        }
      }
      await user.click(screen.getByRole("button", { name: "Close details" }));
    }
  });
  it("shows stale-version recovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        response(
          {
            code: "data-version-changed",
            message: "Reload.",
            active_version: "v2",
            url: "/",
          },
          false,
        ),
      ),
    );
    render(<App bootstrap={bootstrap} />);
    expect(
      await screen.findByRole("heading", { name: "Pokémon data changed" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reload Pokédex" })).toBeTruthy();
  });
  it("keeps selection independent of zero-result filters", async () => {
    const filteredIndex: PokedexIndex = {
      ...index,
      forms: [
        ...index.forms,
        {
          ...index.forms[0]!,
          id: "bulbasaur",
          name: "Bulbasaur",
          national_dex_number: 1,
          types: [{ id: "grass", name: "Grass" }],
        },
      ],
      types: [...index.types, { id: "grass", name: "Grass" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(filteredIndex) : response(detail),
      ),
    );
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("2 of 2 Pokémon");
    fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
    await screen.findByRole("heading", { name: "Charizard" });
    const search = screen.getByLabelText(/Search Pokémon/);
    fireEvent.input(search, { target: { value: "fire" } });
    fireEvent.click(screen.getByRole("option", { name: "Fire" }));
    fireEvent.input(search, { target: { value: "grass" } });
    fireEvent.click(screen.getByRole("option", { name: "Grass" }));
    await waitFor(() =>
      expect(screen.queryByText("No Pokémon match")).toBeTruthy(),
    );
    expect(screen.getByRole("heading", { name: "Charizard" })).toBeTruthy();
  });
  it("aborts the sole bulk request when the island unmounts", async () => {
    let bulkSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/index") return response(index);
        bulkSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );
    const view = render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    await waitFor(() => expect(bulkSignal).toBeTruthy());
    view.unmount();
    expect(bulkSignal?.aborted).toBe(true);
  });

  it("retries an ordinary index failure inside the stable shell", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Index unavailable"))
      .mockImplementationOnce(() => response(index))
      .mockImplementationOnce(() => response(detail));
    vi.stubGlobal("fetch", fetch);
    render(<App bootstrap={bootstrap} />);
    expect(
      await screen.findByRole("heading", { name: "Pokédex unavailable" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry Pokédex" }));
    expect(await screen.findByText("1 of 1 Pokémon")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("preserves detail, information, and shiny state when reselecting the same form", async () => {
    const fetch = vi.fn((url: string) =>
      url === "/index" ? response(index) : response(detail),
    );
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    await user.click(screen.getByRole("button", { name: "Charizard" }));
    await screen.findByRole("heading", { name: "Charizard" });
    await user.click(
      screen.getByRole("button", { name: "Show shiny Charizard" }),
    );
    await user.click(screen.getByRole("button", { name: "Blaze" }));
    await user.click(screen.getByRole("button", { name: "Charizard" }));
    expect(
      screen
        .getByRole("button", { name: "Show normal Charizard" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "Blaze" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("shows all base Mega choices, suppresses siblings on a Mega, and closes modal without stale focus", async () => {
    const megaForms = [
      { id: "charizardmegax", name: "Charizard-Mega-X", form_label: "Mega X" },
      { id: "charizardmegay", name: "Charizard-Mega-Y", form_label: "Mega Y" },
      { id: "charizardmega", name: "Charizard-Mega", form_label: "Mega" },
    ];
    const megaDetails: BulkDetails = {
      ...detail,
      forms: [
        { ...detail.forms[0]!, mega_ids: megaForms.map(({ id }) => id) },
        ...megaForms.map((mega) => ({
          ...detail.forms[0]!,
          ...mega,
          is_mega: true,
          base_id: "charizard",
          mega_ids: [],
        })),
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(megaDetails),
      ),
    );
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
    await screen.findByRole("button", { name: "Switch to Charizard-Mega-X" });
    expect(
      screen.getByRole("button", { name: "Switch to Charizard-Mega-Y" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Switch to Charizard-Mega" }),
    ).toBeTruthy();
    expect(
      [...document.querySelectorAll(".mega-marker")].map(
        (marker) => marker.textContent,
      ),
    ).toEqual(["X", "Y"]);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show level-50 stat calculation information",
      }),
    );
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Charizard-Mega-X" }),
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Return to base form Charizard" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show level-50 stat calculation information",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show shiny Charizard" }),
    );
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show level-50 stat calculation information",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sort moves by type" }));
    const typeHeader = screen
      .getByRole("button", { name: /Sort moves by type/ })
      .closest("[role=columnheader]")!;
    expect(typeHeader.getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(
      screen.getByRole("button", { name: "Show normal Charizard" }),
    );
    expect(typeHeader.getAttribute("aria-sort")).toBe("ascending");
    const blaze = screen.getByRole("button", { name: "Blaze" });
    fireEvent.click(blaze);
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Charizard-Mega-X" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(blaze);
    expect(
      screen
        .getByRole("button", { name: "Sort moves by type" })
        .closest("[role=columnheader]")
        ?.getAttribute("aria-sort"),
    ).toBe("none");
    expect(
      screen.getByRole("button", { name: "Return to base form Charizard" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Charizard-Mega-Y/ }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Return to base form Charizard" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Charizard-Mega" }),
    );
    expect(document.querySelector(".mega-marker")).toBeNull();
  });

  it("renders status power as an em dash and physical numeric zero exactly", async () => {
    const status = {
      ...detail.moves[0]!,
      id: "status",
      name: "Status Move",
      category: "Status",
      base_power: 99,
    };
    const zero = {
      ...detail.moves[0]!,
      id: "zero",
      name: "Zero Move",
      category: "Physical",
      base_power: 0,
    };
    const moveDetails = {
      ...detail,
      forms: [{ ...detail.forms[0]!, move_ids: ["status", "zero"] }],
      moves: [status, zero],
    } as BulkDetails;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(moveDetails),
      ),
    );
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
    const statusRow = await screen.findByRole("row", {
      name: /Status Move.*Status.*—/,
    });
    expect(statusRow.textContent).toContain("—");
    expect(
      screen.getByRole("button", { name: "Sort moves by category" })
        .textContent,
    ).toContain("Category");
    const categoryCell = statusRow.querySelector(".move-category")!;
    expect(categoryCell.querySelector('img.icon[alt=""]')).toBeTruthy();
    expect(categoryCell.querySelector(".visually-hidden")?.textContent).toBe(
      "Status",
    );
    const zeroRow = screen.getByRole("row", { name: /Zero Move.*Physical.*0/ });
    expect(zeroRow.textContent).toMatch(/0$/);
    const powerButton = screen.getByRole("button", {
      name: "Sort moves by power",
    });
    const powerHeader = powerButton.closest("[role=columnheader]")!;
    fireEvent.click(powerButton);
    expect(powerHeader.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(
      screen.getByRole("button", { name: /Sort moves by power/ }),
    );
    expect(powerHeader.getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(
      screen.getByRole("button", { name: /Sort moves by power/ }),
    );
    expect(powerHeader.getAttribute("aria-sort")).toBe("none");
    fireEvent.click(
      screen.getByRole("button", { name: "Sort moves by category" }),
    );
    expect(
      screen
        .getByRole("button", { name: /Sort moves by category/ })
        .closest("[role=columnheader]")
        ?.getAttribute("aria-sort"),
    ).toBe("ascending");
    expect(powerHeader.getAttribute("aria-sort")).toBe("none");
  });
  it("exposes the exact stats explanation by hover, focus, pin, outside click, and Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/index" ? response(index) : response(detail),
      ),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    await user.click(screen.getByRole("button", { name: "Charizard" }));
    const info = await screen.findByRole("button", {
      name: "Show level-50 stat calculation information",
    });
    expect(info.querySelector(".icon--information")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Stats" })).toBeTruthy();
    await user.hover(info);
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Real: 0 SP, neutral nature. Min: 0 SP, hindering nature. Max: 32 SP, increasing nature.",
    );
    await user.unhover(info);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.click(info);
    expect(info.getAttribute("aria-expanded")).toBe("true");
    await user.click(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.click(info);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.activeElement).toBe(info);
  });
  it("exposes complete combobox relationships and closes with Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => response(index)),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    const search = screen.getByLabelText(/Search Pokémon/);
    await user.type(search, "fire");
    expect(search.getAttribute("aria-expanded")).toBe("true");
    const listbox = screen.getByRole("listbox");
    expect(search.getAttribute("aria-controls")).toBe(listbox.id);
    expect(screen.getByRole("group", { name: "Types" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(
      /suggestions available/,
    );
    await user.keyboard("{ArrowDown}{ArrowUp}{Escape}");
    expect(search.getAttribute("aria-expanded")).toBe("false");
    expect(search.hasAttribute("aria-controls")).toBe(false);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it.each(["index", "bulk details"])(
    "treats a successful %s version mismatch as stale",
    async (source) => {
      const wrongIndex = { ...index, data_version: "v2" };
      const wrongDetails = { ...detail, data_version: "v2" };
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) =>
          url === "/index"
            ? response(source === "index" ? wrongIndex : index)
            : response(wrongDetails),
        ),
      );
      render(<App bootstrap={bootstrap} />);
      expect(
        await screen.findByRole("heading", { name: "Pokémon data changed" }),
      ).toBeTruthy();
      expect(screen.getByRole("link", { name: "Reload Pokédex" })).toBeTruthy();
    },
  );
  it("shows a visible error for malformed successful data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        response({ ...index, forms: [{ ...index.forms[0], is_mega: "no" }] }),
      ),
    );
    render(<App bootstrap={bootstrap} />);
    expect(
      await screen.findByRole("heading", { name: "Pokédex unavailable" }),
    ).toBeTruthy();
  });
});
