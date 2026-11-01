import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Autocomplete,
  ConfirmationDialog,
  InlineNickname,
  MemberEditor,
  PokemonPalette,
  TeamBuilder,
  fieldPathToDomPath,
  prepareDraftForSave,
} from "./app";
import { serializeDraft } from "./contracts";
import type { Bootstrap, BuilderData, Member, Team } from "./contracts";

function ControlledAutocomplete() {
  const [value, setValue] = useState<string | null>("blaze");
  return (
    <>
      <Autocomplete
        inputId="ability"
        label="Ability"
        value={value}
        choices={[
          { id: "blaze", name: "Blaze" },
          { id: "solar-power", name: "Solar Power" },
        ]}
        next="after"
        onChange={setValue}
      />
      <output data-testid="value">{value ?? "empty"}</output>
      <button id="after" type="button">
        After
      </button>
      <button type="button" onClick={() => setValue(null)}>
        Clear externally
      </button>
    </>
  );
}

function ChangingChoicesAutocomplete() {
  const [value, setValue] = useState<string | null>("blaze");
  const [choices, setChoices] = useState([
    { id: "blaze", name: "Blaze" },
    { id: "solar-power", name: "Solar Power" },
  ]);
  return (
    <>
      <Autocomplete
        inputId="changing-ability"
        label="Ability"
        value={value}
        choices={choices}
        onChange={setValue}
      />
      <output data-testid="changing-value">{value ?? "empty"}</output>
      <button type="button" onClick={() => setChoices(choices.slice(1))}>
        Remove Blaze
      </button>
    </>
  );
}

function ControlledNickname() {
  const [value, setValue] = useState("Ace");
  return (
    <InlineNickname
      value={value}
      species="Charizard"
      inputId="nickname"
      onCommit={setValue}
    />
  );
}

function BlankAutocomplete({ count = 3 }: { count?: number }) {
  const [value, setValue] = useState<string | null>(null);
  const choices = Array.from({ length: count }, (_, index) => ({
    id: `choice-${String(index).padStart(3, "0")}`,
    name: `Choice ${String(count - index).padStart(3, "0")}`,
  }));
  return (
    <Autocomplete
      inputId="blank-choice"
      label="Move 1"
      value={value}
      choices={choices}
      onChange={setValue}
    />
  );
}

const shortcutBootstrap: Bootstrap = {
  schema_version: "team-builder-bootstrap-v2",
  active_version: "version-3",
  regulation: { id: "m-c", name: "Regulation M-C" },
  data_url: "/teams/data/",
  create_url: "/teams/",
  team_url_template: "/teams/__TEAM__/",
  next_team_number: 1,
  teams: [],
};

const shortcutData: BuilderData = {
  schema_version: "team-builder-data-v5",
  data_version: "version-3",
  regulation: shortcutBootstrap.regulation,
  forms: [
    {
      id: "charizard",
      name: "Charizard",
      base_species_id: "charizard",
      is_nfe: false,
      types: [{ id: "fire", name: "Fire" }],
      ability_ids: ["blaze"],
      move_ids: [],
      base_stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
      sprites: { normal: "/normal.webp", shiny: "/shiny.webp" },
    },
  ],
  types: [{ id: "fire", name: "Fire" }],
  abilities: [
    {
      id: "blaze",
      name: "Blaze",
      short_description: "Boosts Fire moves.",
      description: "Boosts Fire-type moves when HP is low.",
      suppresses_held_item: false,
    },
  ],
  moves: [],
  items: [],
  natures: [
    {
      id: "serious",
      name: "Serious",
      increased_stat: null,
      decreased_stat: null,
    },
  ],
  mega_relations: [],
  mega_search_entries: [],
  mechanics: {
    level: 50,
    iv: 31,
    sp_min: 0,
    sp_max: 32,
    sp_total_max: 66,
    formula: "champions",
  },
};

describe("team slot keyboard shortcuts", () => {
  afterEach(cleanup);

  it("opens the requested empty slot picker and retains occupied-slot focus", async () => {
    render(
      <TeamBuilder bootstrap={shortcutBootstrap} initialData={shortcutData} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "New Team" })[0]!);
    const teamName = await screen.findByLabelText("Team name");
    fireEvent.keyDown(teamName, { key: "4" });
    expect(
      screen.queryByRole("dialog", { name: "Choose a Pokémon" }),
    ).toBeNull();
    const fourthSlot = document.querySelector<HTMLElement>(
      '.empty-slot[data-member-slot="3"]',
    )!;
    fireEvent.keyDown(fourthSlot, { key: "4", altKey: true });
    expect(
      screen.queryByRole("dialog", { name: "Choose a Pokémon" }),
    ).toBeNull();
    fireEvent.keyDown(fourthSlot, { key: "4", repeat: true });
    expect(
      screen.queryByRole("dialog", { name: "Choose a Pokémon" }),
    ).toBeNull();
    const openDialog = document.createElement("dialog");
    openDialog.setAttribute("open", "");
    document.body.append(openDialog);
    fireEvent.keyDown(fourthSlot, { key: "4" });
    expect(
      screen.queryByRole("dialog", { name: "Choose a Pokémon" }),
    ).toBeNull();
    openDialog.remove();

    await waitFor(() => {
      fireEvent.keyDown(fourthSlot, { key: "4" });
      expect(
        screen.getByRole("dialog", { name: "Choose a Pokémon" }),
      ).toBeTruthy();
    });
    const picker = screen.getByRole("dialog", { name: "Choose a Pokémon" });
    expect(picker).toBeTruthy();
    fireEvent.keyDown(
      screen.getByRole("combobox", {
        name: "Search names, moves, abilities, or types",
      }),
      { key: "Enter" },
    );
    const member = document.querySelector<HTMLElement>(
      '[data-member-slot="3"].member-card',
    );
    expect(member).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Collapse Charizard/ }));
    fireEvent.keyDown(member!, { key: "4" });
    await waitFor(() => expect(document.activeElement).toBe(member));
    expect(member?.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Team Builder initial loading", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the shared page loader before builder data resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const bootstrap: Bootstrap = {
      schema_version: "team-builder-bootstrap-v2",
      active_version: "v1",
      regulation: { id: "m-c", name: "Regulation M-C" },
      data_url: "/teams/data/",
      create_url: "/teams/",
      team_url_template: "/teams/__TEAM__/",
      next_team_number: 1,
      teams: [],
    };
    render(<TeamBuilder bootstrap={bootstrap} />);
    const loading = screen.getByRole("status");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.textContent).toBe("Loading Team Builder…");
    expect(document.querySelector(".team-builder-app")).toBeNull();
  });
});

describe("Team Builder team loading", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("ignores an older request that rejects after the newest team loads", async () => {
    let rejectOlder!: (reason: Error) => void;
    let resolveNewer!: (response: Response) => void;
    const olderResponse = new Promise<Response>((_resolve, reject) => {
      rejectOlder = reject;
    });
    const newerResponse = new Promise<Response>((resolve) => {
      resolveNewer = resolve;
    });
    const newerDataVersion = "version-newer";
    const newerData = {
      schema_version: "team-builder-data-v5",
      data_version: "version-newer",
      regulation: shortcutBootstrap.regulation,
      forms: [
        {
          id: "charizard",
          name: "Newest Charizard",
          base_species: "charizard",
          is_nfe: false,
          national_dex_number: 6,
          type_ids: ["fire"],
          ability_ids: ["blaze"],
          move_ids: [],
          base_stats: {
            hp: 78,
            attack: 84,
            defense: 78,
            special_attack: 109,
            special_defense: 85,
            speed: 100,
          },
          sprite_form: "charizard",
        },
      ],
      types: shortcutData.types,
      abilities: shortcutData.abilities,
      moves: [],
      items: [],
      natures: shortcutData.natures,
      mega_relations: [],
      mega_search_entries: [],
      mechanics: {
        level: 50,
        sp_minimum: 0,
        sp_maximum: 32,
        sp_total_max: 66,
        hp_formula: "base + sp + 75",
        other_formula: "truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages: { hindering: 90, neutral: 100, increasing: 110 },
      },
      sprite_url_template:
        "/pokedex/sprites/version-newer/__FORM__/__VARIANT__.webp",
    };
    const teamResponse = {
      schema_version: "team-api-v1",
      data: {
        id: "newer",
        name: "Newest team",
        updated_at: "2026-11-01T12:00:00Z",
        pinned: {
          version: newerDataVersion,
          regulation: shortcutBootstrap.regulation,
        },
        members: [
          {
            position: 0,
            pokemon: "charizard",
            nickname: "Latest",
            ability: null,
            item: null,
            moves: [null, null, null, null],
            nature: "serious",
            sp: {
              hp: 0,
              attack: 0,
              defense: 0,
              special_attack: 0,
              special_defense: 0,
              speed: 0,
            },
            shiny: false,
            mega_preview: false,
          },
        ],
      },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/teams/older/") return olderResponse;
      if (url === "/teams/newer/") return newerResponse;
      if (url === "/teams/data/version-newer/m-c/")
        return Promise.resolve(
          new Response(JSON.stringify(newerData), { status: 200 }),
        );
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const bootstrap: Bootstrap = {
      ...shortcutBootstrap,
      teams: [
        {
          id: "older",
          name: "Older team",
          data_version: "version-older",
          regulation: shortcutBootstrap.regulation,
          members: [],
          updated_at: "2026-10-31T12:00:00Z",
        },
        {
          id: "newer",
          name: "Newest team",
          data_version: newerDataVersion,
          regulation: shortcutBootstrap.regulation,
          members: [],
          updated_at: "2026-11-01T12:00:00Z",
        },
      ],
    };
    render(<TeamBuilder bootstrap={bootstrap} initialData={shortcutData} />);

    fireEvent.click(screen.getByRole("button", { name: /Older team/ }));
    fireEvent.click(screen.getByRole("button", { name: /Newest team/ }));
    resolveNewer(new Response(JSON.stringify(teamResponse), { status: 200 }));

    await screen.findByDisplayValue("Newest team");
    expect(screen.getByText("Newest Charizard")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    rejectOlder(new Error("Stale request failed."));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(screen.getByDisplayValue("Newest team")).toBeTruthy();
    expect(screen.getByText("Newest Charizard")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.queryByText("Stale request failed.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Team Builder SP and Mega palette behavior", () => {
  afterEach(cleanup);

  it("routes SP number, range, zero, and max edits through the shared clamp", () => {
    function Harness() {
      const [member, setMember] = useState<Member>({
        position: 0,
        form_id: "charizard",
        nickname: "",
        ability_id: null,
        item_id: null,
        move_ids: [null, null, null, null],
        nature_id: "serious",
        sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        shiny: false,
        mega_preview: false,
      });
      return (
        <MemberEditor
          member={member}
          index={0}
          slot={0}
          data={shortcutData}
          allMembers={[member]}
          onChange={setMember}
          onRemove={() => undefined}
          onMove={() => null}
          serverErrors={{}}
          onAnnounce={() => undefined}
        />
      );
    }
    render(<Harness />);
    const max = screen.getAllByRole("button", { name: "Max" });
    fireEvent.click(max[0]!);
    fireEvent.click(max[1]!);
    fireEvent.click(max[2]!);
    expect(screen.getByText("66 / 66")).toBeTruthy();
    expect(
      (screen.getByRole("spinbutton", { name: "Defense" }) as HTMLInputElement)
        .value,
    ).toBe("2");

    fireEvent.input(screen.getByRole("spinbutton", { name: "HP" }), {
      target: { value: "" },
    });
    expect(
      (screen.getByRole("spinbutton", { name: "HP" }) as HTMLInputElement)
        .value,
    ).toBe("0");
    fireEvent.input(screen.getByRole("slider", { name: "Defense SP slider" }), {
      target: { value: "99" },
    });
    expect(
      (screen.getByRole("spinbutton", { name: "Defense" }) as HTMLInputElement)
        .value,
    ).toBe("32");
    fireEvent.click(screen.getAllByRole("button", { name: "0" })[1]!);
    expect(
      (screen.getByRole("spinbutton", { name: "Attack" }) as HTMLInputElement)
        .value,
    ).toBe("0");
  });

  it("recomputes displayed Real Stats when item suppression changes", () => {
    const effectiveData: BuilderData = {
      ...shortcutData,
      forms: [
        {
          ...shortcutData.forms[0]!,
          ability_ids: ["blaze", "klutz"],
        },
      ],
      abilities: [
        ...shortcutData.abilities,
        {
          id: "klutz",
          name: "Klutz",
          short_description: "Suppresses held items.",
          description: "The Pokémon cannot use its held item.",
          suppresses_held_item: true,
        },
      ],
      items: [
        {
          id: "normalized-speed-item",
          name: "Normalized Speed Item",
          short_description: null,
          description: null,
          stat_modifiers: [
            {
              stat: "spe",
              numerator: 6144,
              denominator: 4096,
              eligibility: "always",
            },
          ],
        },
      ],
    };
    function Harness() {
      const [member, setMember] = useState<Member>({
        position: 0,
        form_id: "charizard",
        nickname: "",
        ability_id: "blaze",
        item_id: "normalized-speed-item",
        move_ids: [null, null, null, null],
        nature_id: "serious",
        sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        shiny: false,
        mega_preview: false,
      });
      return (
        <>
          <MemberEditor
            member={member}
            index={0}
            slot={0}
            data={effectiveData}
            allMembers={[member]}
            onChange={setMember}
            onRemove={() => undefined}
            onMove={() => null}
            serverErrors={{}}
            onAnnounce={() => undefined}
          />
          <button
            type="button"
            onClick={() => setMember({ ...member, item_id: null })}
          >
            Remove item
          </button>
          <button
            type="button"
            onClick={() => setMember({ ...member, ability_id: "klutz" })}
          >
            Suppress item
          </button>
          <button
            type="button"
            onClick={() => setMember({ ...member, ability_id: "blaze" })}
          >
            Enable item
          </button>
        </>
      );
    }
    const displayedSpeed = () =>
      screen.getAllByText("Speed").find((element) => element.tagName === "DT")
        ?.nextElementSibling?.textContent;
    render(<Harness />);
    expect(displayedSpeed()).toBe("180");
    fireEvent.click(screen.getByRole("button", { name: "Suppress item" }));
    expect(displayedSpeed()).toBe("120");
    fireEvent.click(screen.getByRole("button", { name: "Enable item" }));
    expect(displayedSpeed()).toBe("180");
    fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
    expect(displayedSpeed()).toBe("120");
  });

  it("returns a discriminated Mega choice with target presentation data", () => {
    const onChoose = vi.fn();
    const megaData: BuilderData = {
      ...shortcutData,
      items: [
        {
          id: "charizarditex",
          name: "Charizardite X",
          short_description: "Mega Stone.",
          description: "Enables Mega Evolution.",
          stat_modifiers: [],
        },
      ],
      mega_search_entries: [
        {
          ...shortcutData.forms[0]!,
          id: "charizardmegax",
          name: "Charizard-Mega-X",
          base_form_id: "charizard",
          item_id: "charizarditex",
          base_stats: {
            hp: 78,
            atk: 130,
            def: 111,
            spa: 130,
            spd: 85,
            spe: 100,
          },
        },
      ],
    };
    render(
      <PokemonPalette
        data={megaData}
        members={[]}
        onClose={() => undefined}
        onChoose={onChoose}
      />,
    );
    fireEvent.input(
      screen.getByRole("combobox", {
        name: "Search names, moves, abilities, or types",
      }),
      { target: { value: "Mega-X" } },
    );
    fireEvent.click(screen.getByRole("row", { name: /Charizard-Mega-X/ }));
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "mega",
        id: "charizardmegax",
        base_form_id: "charizard",
        item_id: "charizarditex",
        base_stats: expect.objectContaining({ atk: 130 }),
      }),
    );
  });
});

describe("team builder autocomplete", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("clears the accepted identifier as soon as visible text diverges", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "Blaz" } });
    expect((input as HTMLInputElement).value).toBe("Blaz");
    expect(screen.getByTestId("value").textContent).toBe("empty");
  });

  it("does not restore a stale identifier on blur", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "Not an ability" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("value").textContent).toBe("empty");
    expect((input as HTMLInputElement).value).toBe("Not an ability");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Choose a valid ability.")).toBeTruthy();
  });

  it("canonicalizes a case-insensitive exact display name on blur", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "  solar power  " } });
    fireEvent.blur(input);
    expect(screen.getByTestId("value").textContent).toBe("solar-power");
    expect((input as HTMLInputElement).value).toBe("Solar Power");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("keeps blank optional text valid", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("value").textContent).toBe("empty");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("accepts with Enter and advances focus", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "Solar" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("value").textContent).toBe("solar-power");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "After" }),
    );
  });

  it("synchronizes a populated selection to blank when its owner clears it", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", {
      name: "Ability",
    }) as HTMLInputElement;
    expect(input.value).toBe("Blaze");
    fireEvent.click(screen.getByRole("button", { name: "Clear externally" }));
    expect(input.value).toBe("");
  });

  it("retains and invalidates display text when its selected choice disappears", () => {
    render(<ChangingChoicesAutocomplete />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Blaze" }));
    const input = screen.getByRole("combobox", { name: "Ability" });
    expect((input as HTMLInputElement).value).toBe("Blaze");
    expect(screen.getByTestId("changing-value").textContent).toBe("empty");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("opens every sorted option and reports only the active one as selected", () => {
    render(<BlankAutocomplete count={40} />);
    const input = screen.getByRole("combobox", { name: "Move 1" });
    fireEvent.focus(input);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(40);
    expect(options[0]?.textContent).toBe("Choice 001");
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
    expect(
      options.filter(
        (option) => option.getAttribute("aria-selected") === "true",
      ),
    ).toHaveLength(1);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);
    expect(
      options.every(
        (option) => option.querySelector("button")?.tabIndex === -1,
      ),
    ).toBe(true);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]?.getAttribute("aria-selected")).toBe("false");
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("keeps a large empty-focus list practical without virtualization", () => {
    const started = performance.now();
    render(<BlankAutocomplete count={500} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Move 1" }));
    expect(screen.getAllByRole("option")).toHaveLength(500);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("clears an unaccepted nature identifier", () => {
    let nature: string | null = "serious";
    render(
      <Autocomplete
        inputId="nature"
        label="Nature"
        value={nature}
        choices={[{ id: "serious", name: "Serious" }]}
        onChange={(value) => {
          nature = value;
        }}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Nature" });
    fireEvent.input(input, { target: { value: "Tim" } });
    fireEvent.blur(input);
    expect(nature).toBeNull();
  });

  it("keeps rendering stats and an error when a member nature is null", async () => {
    const member: Member = {
      position: 0,
      form_id: "charizard",
      nickname: "",
      ability_id: "blaze",
      item_id: "charizarditex",
      move_ids: ["protect", null, null, null],
      nature_id: null,
      sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      shiny: false,
      mega_preview: false,
    };
    const data = {
      schema_version: "team-builder-data-v5",
      data_version: "version-3",
      regulation: { id: "m-c", name: "Regulation M-C" },
      forms: [
        {
          id: "charizard",
          name: "Charizard",
          base_species_id: "charizard",
          is_nfe: false,
          types: [{ id: "fire", name: "Fire" }],
          ability_ids: ["blaze"],
          move_ids: ["protect"],
          base_stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
          sprites: { normal: "/normal.webp", shiny: "/shiny.webp" },
        },
      ],
      types: [{ id: "fire", name: "Fire" }],
      abilities: [
        {
          id: "blaze",
          name: "Blaze",
          short_description: "Boosts Fire moves.",
          description: "Boosts Fire-type moves when HP is low.",
          suppresses_held_item: false,
        },
        {
          id: "toughclaws",
          name: "Tough Claws",
          short_description: "Boosts contact moves.",
          description: "Boosts the power of contact moves.",
          suppresses_held_item: false,
        },
      ],
      moves: [
        {
          id: "protect",
          name: "Protect",
          type: { id: "normal", name: "Normal" },
          category: "Status",
          base_power: 0,
          accuracy: null,
          always_hits: true,
          pp: 10,
          priority: 4,
          target: "self",
          short_description: "Protects the user.",
          description: "Protects the user from most attacks.",
          flags: [],
        },
      ],
      items: [
        {
          id: "charizarditex",
          name: "Charizardite X",
          short_description: "Makes Charizard Mega Evolve.",
          description: "Makes Charizard Mega Evolve into Mega Charizard X.",
          stat_modifiers: [],
        },
      ],
      natures: [],
      mega_relations: [
        {
          form_id: "charizard",
          item_id: "charizarditex",
          target: {
            id: "charizardmegax",
            name: "Charizard-Mega-X",
            base_species_id: "charizard",
            is_nfe: false,
            types: [{ id: "fire", name: "Fire" }],
            ability_ids: ["toughclaws"],
            move_ids: [],
            base_stats: {
              hp: 78,
              atk: 130,
              def: 111,
              spa: 130,
              spd: 85,
              spe: 100,
            },
            sprites: { normal: "/mega.webp", shiny: "/mega-shiny.webp" },
            ability: { id: "toughclaws", name: "Tough Claws" },
          },
        },
      ],
      mega_search_entries: [],
      mechanics: {
        level: 50,
        iv: 31,
        sp_min: 0,
        sp_max: 32,
        sp_total_max: 66,
        formula: "champions",
      },
    } satisfies BuilderData;
    const abomasnow: Member = {
      ...member,
      position: 1,
      form_id: "abomasnow",
      ability_id: "blaze",
      item_id: null,
      move_ids: ["protect", null, null, null],
      nature_id: "serious",
    };
    const saveData: BuilderData = {
      ...data,
      forms: [
        ...data.forms,
        {
          ...data.forms[0]!,
          id: "abomasnow",
          name: "Abomasnow",
          base_species_id: "abomasnow",
        },
      ],
      natures: [
        {
          id: "serious",
          name: "Serious",
          increased_stat: null,
          decreased_stat: null,
        },
      ],
    };
    const reordered: Team = {
      id: "saved-team",
      name: "Snow and Fire",
      data_version: data.data_version,
      regulation: data.regulation,
      members: [{ ...member, position: 0, nature_id: "serious" }, abomasnow],
    };
    const prepared = prepareDraftForSave(reordered, saveData, new Map());
    expect(prepared.firstError).toBeUndefined();
    expect(prepared.team.members).toEqual(reordered.members);
    expect(prepared.team).not.toBe(reordered);
    expect(serializeDraft(prepared.team).members).toEqual(
      reordered.members.map((saved) =>
        expect.objectContaining({
          position: saved.position,
          pokemon: saved.form_id,
          ability: saved.ability_id,
          item: saved.item_id,
          moves: saved.move_ids,
          nature: saved.nature_id,
        }),
      ),
    );
    const invalidAfterReorder = prepareDraftForSave(
      reordered,
      saveData,
      new Map([
        ["abomasnow:ability", { text: "Not an ability", invalid: true }],
      ]),
    );
    expect(invalidAfterReorder.firstError).toMatchObject({
      member: { form_id: "abomasnow", position: 1 },
      path: "ability",
    });
    const staleItem = prepareDraftForSave(
      {
        ...reordered,
        members: [{ ...reordered.members[0]!, item_id: "missing-item" }],
      },
      saveData,
      new Map(),
    );
    expect(staleItem.firstError?.path).toBe("item_id");
    const overTotal = prepareDraftForSave(
      {
        ...reordered,
        members: [
          {
            ...reordered.members[0]!,
            sp: { hp: 12, atk: 12, def: 12, spa: 12, spd: 12, spe: 12 },
          },
        ],
      },
      saveData,
      new Map(),
    );
    expect(overTotal.firstError?.path).toBe("sp");
    expect(fieldPathToDomPath(overTotal.firstError!.path)).toBe("sp-hp");
    const onChange = vi.fn();
    const onRemove = vi.fn();
    render(
      <MemberEditor
        member={member}
        index={0}
        slot={0}
        data={data}
        allMembers={[member]}
        onChange={onChange}
        onRemove={onRemove}
        onMove={() => null}
        serverErrors={{}}
        onAnnounce={() => undefined}
      />,
    );
    expect(screen.getByText("Choose a valid nature.")).toBeTruthy();
    expect(screen.getByText("153")).toBeTruthy();
    const speciesHeading = screen.getByRole("heading", { name: "Charizard" });
    expect(speciesHeading).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Collapse Charizard" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Remove Charizard" }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove Charizard" }));
    expect(onRemove).toHaveBeenCalledOnce();
    const nickname = screen.getByRole("button", {
      name: "Edit nickname for Charizard",
    });
    expect(
      speciesHeading.compareDocumentPosition(nickname) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(speciesHeading.nextElementSibling?.contains(nickname)).toBe(true);
    expect(nickname.textContent).toBe("Nickname");
    fireEvent.click(nickname);
    const nicknameInput = screen.getByRole("textbox", {
      name: "Nickname for Charizard",
    });
    expect((nicknameInput as HTMLInputElement).maxLength).toBe(10);
    fireEvent.blur(nicknameInput);
    expect(onChange).not.toHaveBeenCalled();

    const abilityInfo = screen.getByRole("button", {
      name: "Show Blaze ability information",
    });
    fireEvent.focus(abilityInfo);
    expect(screen.getByRole("tooltip").textContent).toContain("Boosts Fire");
    fireEvent.click(abilityInfo);
    expect(screen.getByRole("dialog").textContent).toContain("Fire-type moves");
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    await Promise.resolve();
    expect(document.activeElement).toBe(abilityInfo);
    const ability = screen.getByRole("combobox", { name: "Ability" });
    expect(ability.getAttribute("aria-describedby")).toContain(
      "member-0-ability-info-description",
    );
    expect(abilityInfo.getAttribute("tabindex")).toBe("-1");
    ability.focus();
    fireEvent.keyDown(ability, { key: "i", altKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    await Promise.resolve();
    expect(document.activeElement).toBe(ability);

    expect(
      screen.getByRole("button", { name: "Show Protect move information" }),
    ).toBeTruthy();
    const itemInfo = screen.getByRole("button", {
      name: "Show Charizardite X item information",
    });
    const item = screen.getByRole("combobox", { name: "Item" });
    expect(item.getAttribute("aria-describedby")).toContain(
      "member-0-item-info-description",
    );
    fireEvent.focus(itemInfo);
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Makes Charizard Mega Evolve",
    );
    fireEvent.blur(itemInfo);
    item.focus();
    fireEvent.keyDown(item, { key: "i", altKey: true });
    expect(screen.getByRole("dialog").textContent).toContain(
      "Mega Charizard X",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    await Promise.resolve();
    expect(document.activeElement).toBe(item);

    cleanup();
    render(
      <MemberEditor
        member={member}
        index={0}
        slot={0}
        data={{
          ...data,
          items: data.items.map((choice) => ({
            ...choice,
            short_description: null,
            description: null,
          })),
        }}
        allMembers={[member]}
        onChange={onChange}
        onRemove={() => undefined}
        onMove={() => null}
        serverErrors={{}}
        onAnnounce={() => undefined}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /item information/i }),
    ).toBeNull();
    expect(
      screen
        .getByRole("combobox", { name: "Item" })
        .getAttribute("aria-describedby"),
    ).toBeNull();

    cleanup();
    render(
      <MemberEditor
        member={member}
        index={0}
        slot={0}
        data={data}
        allMembers={[member]}
        onChange={onChange}
        onRemove={() => undefined}
        onMove={() => null}
        serverErrors={{}}
        onAnnounce={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Use Shiny colors" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ shiny: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show Mega preview" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mega_preview: true, ability_id: "blaze" }),
    );

    cleanup();
    const onExpand = vi.fn();
    render(
      <MemberEditor
        member={{ ...member, nickname: "Ace", shiny: true }}
        index={0}
        slot={0}
        data={data}
        allMembers={[member]}
        expanded={false}
        onExpand={onExpand}
        onChange={() => undefined}
        onRemove={() => undefined}
        onMove={() => null}
        serverErrors={{}}
        onAnnounce={() => undefined}
      />,
    );
    const collapsed = document.querySelector(".collapsed-member__surface")!;
    expect(collapsed.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Ace")).toBeTruthy();
    expect(screen.getByText("Ability: Blaze")).toBeTruthy();
    expect(screen.getByText("Item: Charizardite X")).toBeTruthy();
    expect(screen.getByText("Moves: Protect")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Remove Charizard" }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByText("Ability: Blaze"));
    expect(onExpand).toHaveBeenCalledOnce();

    cleanup();
    render(
      <PokemonPalette
        data={data}
        members={[]}
        onClose={() => undefined}
        onChoose={() => undefined}
      />,
    );
    const pickerSearch = screen.getByRole("combobox", {
      name: "Search names, moves, abilities, or types",
    });
    expect(pickerSearch.getAttribute("aria-controls")).toBe(
      "pokemon-result-grid",
    );
    expect(pickerSearch.getAttribute("aria-haspopup")).toBe("grid");
    fireEvent.input(pickerSearch, { target: { value: "Blaze" } });
    await waitFor(() =>
      expect(pickerSearch.getAttribute("aria-controls")).toBe(
        "pokemon-filter-options",
      ),
    );
    expect(pickerSearch.getAttribute("aria-haspopup")).toBe("listbox");

    cleanup();
    const savedMember = overTotal.team.members[0]!;
    const bootstrap: Bootstrap = {
      schema_version: "team-builder-bootstrap-v2",
      active_version: saveData.data_version,
      regulation: saveData.regulation,
      data_url: "/teams/data/",
      create_url: "/teams/",
      team_url_template: "/teams/__TEAM__/",
      next_team_number: 2,
      teams: [
        {
          id: "saved-team",
          name: "Over total",
          data_version: saveData.data_version,
          regulation: saveData.regulation,
          members: [{ position: 0, sprite_url: "/normal.webp" }],
          updated_at: "2026-10-24T00:00:00Z",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schema_version: "team-api-v1",
        data: {
          id: "saved-team",
          name: "Over total",
          updated_at: "2026-10-24T00:00:00Z",
          pinned: {
            version: saveData.data_version,
            regulation: saveData.regulation,
          },
          members: [
            {
              position: savedMember.position,
              pokemon: savedMember.form_id,
              nickname: savedMember.nickname,
              ability: savedMember.ability_id,
              item: savedMember.item_id,
              moves: savedMember.move_ids,
              nature: savedMember.nature_id,
              sp: {
                hp: savedMember.sp.hp,
                attack: savedMember.sp.atk,
                defense: savedMember.sp.def,
                special_attack: savedMember.sp.spa,
                special_defense: savedMember.sp.spd,
                speed: savedMember.sp.spe,
              },
              shiny: savedMember.shiny,
              mega_preview: savedMember.mega_preview,
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TeamBuilder bootstrap={bootstrap} initialData={saveData} />);
    fireEvent.click(screen.getByRole("button", { name: /Over total/ }));
    const teamName = await screen.findByLabelText("Team name");
    expect(document.querySelector(".member-card--collapsed")).toBeTruthy();
    fireEvent.input(teamName, { target: { value: "Over total changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.getElementById("member-0-sp-hp"),
      ),
    );
    expect(screen.getByText("Use no more than 66 SP total.")).toBeTruthy();
    expect(
      document.querySelector(".member-card")?.getAttribute("aria-expanded"),
    ).toBe("true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("inline nickname", () => {
  afterEach(cleanup);

  it("buffers edits, cancels cleanly, and commits only changed values", () => {
    const onCommit = vi.fn();
    render(
      <InlineNickname
        value="Ace"
        species="Charizard"
        inputId="nickname"
        onCommit={onCommit}
      />,
    );
    const edit = screen.getByRole("button", {
      name: "Edit nickname for Charizard",
    });
    expect(edit.textContent).toBe("Ace");
    fireEvent.click(edit);
    const input = screen.getByRole("textbox", {
      name: "Nickname for Charizard",
    });
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).maxLength).toBe(10);
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(edit);
    const changed = screen.getByRole("textbox", {
      name: "Nickname for Charizard",
    });
    fireEvent.input(changed, { target: { value: "Blaze" } });
    fireEvent.keyDown(changed, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /edit nickname/i }).textContent,
    ).toBe("Ace");

    fireEvent.click(screen.getByRole("button", { name: /edit nickname/i }));
    const committed = screen.getByRole("textbox", {
      name: "Nickname for Charizard",
    });
    fireEvent.input(committed, { target: { value: "Blaze" } });
    fireEvent.keyDown(committed, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("Blaze");
  });

  it("commits an empty nickname on blur and preserves normal focus flow", () => {
    render(
      <>
        <ControlledNickname />
        <button type="button">Next control</button>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Edit nickname/i }));
    const input = screen.getByRole("textbox", {
      name: "Nickname for Charizard",
    });
    fireEvent.input(input, { target: { value: "" } });
    const next = screen.getByRole("button", { name: "Next control" });
    fireEvent.blur(input);
    next.focus();
    expect(next).toBe(document.activeElement);
    expect(
      screen.getByRole("button", { name: /Edit nickname/i }).textContent,
    ).toBe("Nickname");
  });
});

describe("team builder confirmation dialog", () => {
  afterEach(cleanup);

  it("focuses the safe action, traps focus, cancels with Escape, and restores focus", () => {
    const initiator = document.createElement("button");
    initiator.textContent = "Open action";
    document.body.append(initiator);
    initiator.focus();
    const close = vi.fn();
    const { unmount } = render(
      <ConfirmationDialog
        confirmation={{
          title: "Discard unsaved changes?",
          description: "Your changes will be lost.",
          confirmLabel: "Discard changes",
          danger: true,
          initiator,
          resolve: () => undefined,
        }}
        onClose={close}
      />,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Discard changes" });
    expect(cancel).toBe(document.activeElement);
    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toBe(document.activeElement);
    fireEvent.keyDown(cancel, { key: "Escape" });
    expect(close).toHaveBeenCalledWith(false);
    unmount();
    expect(initiator).toBe(document.activeElement);
    initiator.remove();
  });
});
