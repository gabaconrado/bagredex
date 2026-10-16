import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./app";
import type {
  Bootstrap,
  FormSummary,
  MoveDetail,
  PokedexIndex,
} from "./contracts";
import { filteredForms, sortedForms, sortedMoves, suggestions } from "./model";

const forms: FormSummary[] = Array.from({ length: 351 }, (_, index) => ({
  id: `pokemon${index}`,
  name: `Pokémon ${index}`,
  national_dex_number: index + 1,
  is_mega: index % 11 === 0,
  types: [
    { id: index % 2 ? "fire" : "water", name: index % 2 ? "Fire" : "Water" },
  ],
  stats: {
    hp: 40 + (index % 100),
    atk: 50,
    def: 60,
    spa: 70,
    spd: 80,
    spe: 30 + ((index * 47) % 120),
  },
  bst: 390 + (index % 100),
  ability_ids: [`ability${index % 40}`],
  move_ids: ["protect", `move${index % 200}`],
}));
const index: PokedexIndex = {
  schema_version: "pokedex-index-v1",
  data_version: "v1",
  regulation: { id: "m-c", name: "M-C" },
  forms,
  moves: [
    { id: "protect", name: "Protect" },
    ...Array.from({ length: 200 }, (_, id) => ({
      id: `move${id}`,
      name: `Move ${id}`,
    })),
  ],
  abilities: Array.from({ length: 40 }, (_, id) => ({
    id: `ability${id}`,
    name: `Ability ${id}`,
  })),
  types: [
    { id: "fire", name: "Fire" },
    { id: "water", name: "Water" },
  ],
};
const bootstrap: Bootstrap = {
  schema_version: "pokedex-bootstrap-v2",
  active_version: "v1",
  regulation: { ...index.regulation, label: "Regulation M-C" },
  regulations: [
    { ...index.regulation, label: "Regulation M-C", url: "/?regulation=m-c" },
  ],
  index_url: "/index",
  details_url: "/details",
  sprite_url_template: "/sprites/__FORM__/__VARIANT__.webp",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps representative full-learnset move sorts within one frame", () => {
  const moves: MoveDetail[] = Array.from({ length: 220 }, (_, index) => ({
    id: `move${index}`,
    name: `Move ${String(index).padStart(3, "0")}`,
    type: {
      id: index % 2 ? "fire" : "water",
      name: index % 2 ? "Fire" : "Water",
    },
    category: index % 5 === 0 ? "Status" : index % 2 ? "Physical" : "Special",
    base_power: index % 121,
    accuracy: 100,
    always_hits: false,
    pp: 10,
    priority: 0,
    target: "normal",
    short_description: "",
    description: "",
    flags: [],
  }));
  for (const key of ["type", "category", "power"] as const) {
    const start = performance.now();
    for (let run = 0; run < 100; run += 1)
      sortedMoves(moves, {
        key,
        direction: run % 2 ? "ascending" : "descending",
      });
    expect((performance.now() - start) / 100).toBeLessThan(16);
  }
});

it("commits warm full-learnset Type, Category, and Power sorts within one frame", async () => {
  const moves: MoveDetail[] = Array.from({ length: 220 }, (_, moveIndex) => ({
    id: `detail-move${moveIndex}`,
    name: `Detail move ${String(moveIndex).padStart(3, "0")}`,
    type: {
      id: moveIndex % 2 ? "fire" : "water",
      name: moveIndex % 2 ? "Fire" : "Water",
    },
    category:
      moveIndex % 5 === 0 ? "Status" : moveIndex % 2 ? "Physical" : "Special",
    base_power: moveIndex % 121,
    accuracy: 100,
    always_hits: false,
    pp: 10,
    priority: 0,
    target: "normal",
    short_description: "",
    description: "",
    flags: [],
  }));
  const measuredIndex: PokedexIndex = {
    ...index,
    forms: [
      {
        ...forms[0]!,
        ability_ids: [],
        move_ids: moves.map(({ id }) => id),
      },
    ],
    moves: moves.map(({ id, name }) => ({ id, name })),
    abilities: [],
  };
  const bulk = {
    schema_version: "pokedex-details-v1",
    data_version: "v1",
    regulation_id: "m-c",
    forms: [
      {
        id: forms[0]!.id,
        name: forms[0]!.name,
        is_list_legal: true,
        is_mega: false,
        form_label: "",
        base_id: forms[0]!.id,
        mega_ids: [],
        types: forms[0]!.types,
        stats: [
          {
            id: "hp",
            name: "HP",
            base: 40,
            real: 115,
            minimum: 115,
            maximum: 147,
          },
        ],
        ability_slots: [],
        move_ids: moves.map(({ id }) => id),
      },
    ],
    abilities: [],
    moves,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url === "/index" ? measuredIndex : bulk),
      } as Response),
    ),
  );
  render(<App bootstrap={bootstrap} />);
  await screen.findByText("1 of 1 Pokémon");
  fireEvent.click(screen.getByRole("button", { name: forms[0]!.name }));
  await screen.findByRole("heading", { name: "Stats" });

  const table = document.querySelector<HTMLElement>(".move-table")!;
  const firstMove = () =>
    document.querySelector<HTMLElement>(".move-row .move-name > span")
      ?.textContent;
  const durations: Record<string, number> = {};
  for (const key of ["type", "category", "power"] as const) {
    const button = screen.getByRole("button", {
      name: `Sort moves by ${key}`,
    });
    // Warm the keyed reorder path, then return this header to inactive.
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    const firstDirection = key === "power" ? "descending" : "ascending";
    const expected = sortedMoves(moves, {
      key,
      direction: firstDirection,
    })[0]!.name;
    const mutation = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(table, { childList: true, subtree: true });
    });
    const start = performance.now();
    fireEvent.click(button);
    await mutation;
    durations[key] = performance.now() - start;
    expect(firstMove()).toBe(expected);
    expect(button.closest("[aria-sort]")?.getAttribute("aria-sort")).toBe(
      firstDirection,
    );
    fireEvent.click(button);
    fireEvent.click(button);
  }
  await waitFor(() =>
    expect(Object.values(durations).every((duration) => duration < 16)).toBe(
      true,
    ),
  );
  console.info(
    `move-sort-dom-performance ${JSON.stringify(
      Object.fromEntries(
        Object.entries(durations).map(([key, value]) => [
          `${key}_ms`,
          Number(value.toFixed(2)),
        ]),
      ),
    )}`,
  );
});

it("records M-C-scale synthetic render and enforces local selector timing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(index),
      } as Response),
    ),
  );
  const renderStart = performance.now();
  render(<App bootstrap={bootstrap} />);
  await screen.findByText("351 of 351 Pokémon");
  const renderMs = performance.now() - renderStart;
  const sortStart = performance.now();
  const speed = screen.getByRole("button", { name: "Sort by Speed" });
  fireEvent.click(speed);
  expect(speed.closest("[aria-sort]")?.getAttribute("aria-sort")).toBe(
    "descending",
  );
  const sortRenderMs = performance.now() - sortStart;
  const search = screen.getByLabelText(/Search Pokémon/);
  fireEvent.input(search, { target: { value: "fire" } });
  const filterStart = performance.now();
  fireEvent.click(screen.getByRole("option", { name: "Fire", exact: true }));
  await screen.findByText("175 of 351 Pokémon");
  const filterRenderMs = performance.now() - filterStart;
  const iterations = 200;
  const interactionStart = performance.now();
  for (let run = 0; run < iterations; run += 1) {
    suggestions(index, "move 19");
    sortedForms(
      filteredForms(forms, [
        { kind: "move", id: "protect", name: "Protect" },
        { kind: "type", id: "fire", name: "Fire" },
      ]),
      { key: "spe", direction: "descending" },
    );
  }
  const interactionMs = (performance.now() - interactionStart) / iterations;
  console.info(
    `frontend-performance ${JSON.stringify({ forms: forms.length, render_ms: Number(renderMs.toFixed(2)), sort_render_ms: Number(sortRenderMs.toFixed(2)), filter_render_ms: Number(filterRenderMs.toFixed(2)), selector_ms: Number(interactionMs.toFixed(3)) })}`,
  );
  expect(renderMs).toBeLessThan(500);
  // happy-dom render duration is diagnostic only; Playwright owns browser-frame budgets.
  expect(sortRenderMs).toBeLessThan(500);
  expect(filterRenderMs).toBeLessThan(500);
  expect(interactionMs).toBeLessThan(16);
});
