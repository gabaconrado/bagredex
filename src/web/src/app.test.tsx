import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";
import type { Bootstrap, FormDetail, PokedexIndex } from "./contracts";

const bootstrap: Bootstrap = {
  schema_version: "pokedex-bootstrap-v1",
  active_version: "v1",
  regulation: { id: "m-c", name: "Regulation M-C" },
  regulations: [{ id: "m-c", name: "Regulation M-C", url: "/?regulation=m-c" }],
  index_url: "/index",
  detail_url_template: "/pokemon/__FORM__",
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
const detail: FormDetail = {
  schema_version: "pokedex-form-detail-v1",
  data_version: "v1",
  regulation_id: "m-c",
  form: {
    id: "charizard",
    name: "Charizard",
    is_list_legal: true,
    is_mega: false,
    types: index.forms[0]!.types,
    sprites: { normal: "/normal.webp", shiny: "/shiny.webp" },
    form_switches: {
      base: { id: "charizard", name: "Charizard" },
      megas: [{ id: "charizardmegax", name: "Charizard-Mega-X" }],
    },
    stats: [
      { id: "hp", name: "HP", base: 78, real: 153, minimum: 153, maximum: 185 },
    ],
    abilities: [
      {
        id: "blaze",
        name: "Blaze",
        slot: "0",
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
  },
};
const response = (value: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(value) } as Response);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Pokédex app", () => {
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
    const search = screen.getByRole("combobox");
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
    await user.click(screen.getByLabelText("Shiny"));
    expect(screen.getByAltText("Shiny Charizard").getAttribute("src")).toBe(
      "/shiny.webp",
    );
    await user.click(screen.getByRole("button", { name: /Flamethrower Fire/ }));
    expect(screen.getByText("May burn the target.")).toBeTruthy();
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
    const search = screen.getByRole("combobox");
    fireEvent.input(search, { target: { value: "fire" } });
    fireEvent.click(screen.getByRole("option", { name: "Fire" }));
    fireEvent.input(search, { target: { value: "grass" } });
    fireEvent.click(screen.getByRole("option", { name: "Grass" }));
    await waitFor(() =>
      expect(screen.queryByText("No Pokémon match")).toBeTruthy(),
    );
    expect(screen.getByRole("heading", { name: "Charizard" })).toBeTruthy();
  });
  it("ignores an older detail response after a rapid selection", async () => {
    const secondForm = {
      ...index.forms[0]!,
      id: "bulbasaur",
      name: "Bulbasaur",
      national_dex_number: 1,
    };
    const raceIndex = { ...index, forms: [secondForm, ...index.forms] };
    let resolveFirst!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => (resolveFirst = resolve));
    const secondDetail: FormDetail = {
      ...detail,
      form: { ...detail.form, id: "bulbasaur", name: "Bulbasaur" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/index") return response(raceIndex);
        if (url.endsWith("charizard")) return first;
        return response(secondDetail);
      }),
    );
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("2 of 2 Pokémon");
    fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
    fireEvent.click(screen.getByRole("button", { name: "Bulbasaur" }));
    await screen.findByRole("heading", { name: "Bulbasaur" });
    resolveFirst(await response(detail));
    await Promise.resolve();
    expect(screen.getByRole("heading", { name: "Bulbasaur" })).toBeTruthy();
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
    await user.click(screen.getByLabelText("Shiny"));
    await user.click(screen.getByRole("button", { name: "Blaze" }));
    await user.click(screen.getByRole("button", { name: "Charizard" }));
    expect((screen.getByLabelText("Shiny") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole("heading", { name: "Blaze" })).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("exposes complete combobox relationships and closes with Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => response(index)),
    );
    const user = userEvent.setup();
    render(<App bootstrap={bootstrap} />);
    await screen.findByText("1 of 1 Pokémon");
    const search = screen.getByRole("combobox");
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
  it.each(["index", "detail"])(
    "treats a successful %s version mismatch as stale",
    async (source) => {
      const wrongIndex = { ...index, data_version: "v2" };
      const wrongDetail = { ...detail, data_version: "v2" };
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) =>
          url === "/index"
            ? response(source === "index" ? wrongIndex : index)
            : response(wrongDetail),
        ),
      );
      render(<App bootstrap={bootstrap} />);
      if (source === "detail") {
        await screen.findByText("1 of 1 Pokémon");
        fireEvent.click(screen.getByRole("button", { name: "Charizard" }));
      }
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
