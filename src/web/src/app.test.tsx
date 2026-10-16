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
import type { Bootstrap, BulkDetails, PokedexIndex } from "./contracts";

const bootstrap: Bootstrap = {
  schema_version: "pokedex-bootstrap-v2",
  active_version: "v1",
  regulation: { id: "m-c", name: "regulation-m-c", label: "Regulation M-C" },
  regulations: [
    {
      id: "m-c",
      name: "regulation-m-c",
      label: "Regulation M-C",
      url: "/?regulation=m-c",
    },
  ],
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
describe("Pokédex app", () => {
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
    expect(
      [...document.querySelectorAll<SVGElement>(".icon")].every(
        (icon) => icon.getAttribute("fill") === "currentColor",
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
    const blaze = screen.getByRole("button", { name: "Blaze" });
    fireEvent.click(blaze);
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to Charizard-Mega-X" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(blaze);
    expect(
      screen.getByRole("button", { name: "Return to base form Charizard" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Charizard-Mega-Y/ }),
    ).toBeNull();
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
    const zeroRow = screen.getByRole("row", { name: /Zero Move.*Physical.*0/ });
    expect(zeroRow.textContent).toMatch(/0$/);
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
