import { describe, expect, it } from "vitest";
import type { FormSummary, PokedexIndex } from "./contracts";
import {
  addFilter,
  cycleSort,
  filteredForms,
  normalizeSearch,
  sortedForms,
  suggestions,
} from "./model";

const form = (
  id: string,
  dex: number,
  hp: number,
  moves = ["tackle"],
  abilities = ["pressure"],
  types = [{ id: "normal", name: "Normal" }],
): FormSummary => ({
  id,
  name: id,
  national_dex_number: dex,
  is_mega: false,
  types,
  stats: { hp, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
  bst: hp + 5,
  move_ids: moves,
  ability_ids: abilities,
});
const forms = [
  form(
    "second",
    2,
    90,
    ["tackle", "surf"],
    ["torrent"],
    [{ id: "water", name: "Water" }],
  ),
  form("firstb", 1, 100),
  form("firsta", 1, 100),
];
const index: PokedexIndex = {
  schema_version: "pokedex-index-v1",
  data_version: "v",
  regulation: { id: "m-c", name: "M-C" },
  forms,
  moves: [{ id: "surf", name: "Surf" }],
  abilities: [{ id: "torrent", name: "Torrent" }],
  types: [{ id: "water", name: "Water" }],
};

describe("Pokédex selectors", () => {
  it("normalizes punctuation, case, and accents", () =>
    expect(normalizeSearch("Flabé-bé! ")).toBe("flabebe"));
  it("groups suggestions in Pokémon, move, ability, type order", () =>
    expect(suggestions(index, "r").map(({ kind }) => kind)).toEqual([
      "pokemon",
      "pokemon",
      "move",
      "ability",
      "type",
    ]));
  it("combines filters with AND semantics", () =>
    expect(
      filteredForms(forms, [
        { kind: "move", id: "surf", name: "Surf" },
        { kind: "ability", id: "torrent", name: "Torrent" },
        { kind: "type", id: "water", name: "Water" },
      ]).map(({ id }) => id),
    ).toEqual(["second"]));
  it("permits zero matches and leaves suggestions unpruned", () => {
    expect(
      filteredForms(forms, [{ kind: "move", id: "missing", name: "Missing" }]),
    ).toEqual([]);
    expect(suggestions(index, "surf")).toHaveLength(1);
  });
  it("adds filters idempotently", () => {
    const filter = { kind: "move" as const, id: "surf", name: "Surf" };
    expect(addFilter([filter], filter)).toHaveLength(1);
  });
  it("cycles a single sort and uses dex and identifier tie breakers", () => {
    let sort = cycleSort(null, "hp");
    expect(sortedForms(forms, sort).map(({ id }) => id)).toEqual([
      "second",
      "firsta",
      "firstb",
    ]);
    sort = cycleSort(sort, "hp");
    expect(sortedForms(forms, sort).map(({ id }) => id)).toEqual([
      "firsta",
      "firstb",
      "second",
    ]);
    expect(cycleSort(sort, "hp")).toBeNull();
    expect(cycleSort(sort, "atk")).toEqual({
      key: "atk",
      direction: "ascending",
    });
  });
});
