import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./app";
import type { Bootstrap, FormSummary, PokedexIndex } from "./contracts";
import { filteredForms, sortedForms, suggestions } from "./model";

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
  schema_version: "pokedex-bootstrap-v1",
  active_version: "v1",
  regulation: index.regulation,
  regulations: [{ ...index.regulation, url: "/?regulation=m-c" }],
  index_url: "/index",
  detail_url_template: "/pokemon/__FORM__",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("records M-C-scale local render and interaction timings", async () => {
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
  const speed = screen.getByRole("button", { name: "Speed" });
  fireEvent.click(speed);
  expect(speed.parentElement?.getAttribute("aria-sort")).toBe("ascending");
  const sortRenderMs = performance.now() - sortStart;
  const search = screen.getByRole("combobox");
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
  expect(sortRenderMs).toBeLessThan(100);
  expect(filterRenderMs).toBeLessThan(100);
  expect(interactionMs).toBeLessThan(16);
});
