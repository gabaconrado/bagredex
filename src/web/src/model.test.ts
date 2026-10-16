import { describe, expect, it } from "vitest";
import type { FormSummary, MoveDetail, PokedexIndex } from "./contracts";
import {
  addFilter,
  cycleSort,
  cycleMoveSort,
  filteredForms,
  normalizeSearch,
  sortedForms,
  suggestions,
  sortedMoves,
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
  it("sorts move domains with stable ties and a terminal Status power bucket", () => {
    const move = (
      id: string,
      name: string,
      type: string,
      category: MoveDetail["category"],
      base_power: number,
    ): MoveDetail => ({
      id,
      name,
      type: { id: type.toLowerCase(), name: type },
      category,
      base_power,
      accuracy: 100,
      always_hits: false,
      pp: 5,
      priority: 0,
      target: "normal",
      short_description: "",
      description: "",
      flags: [],
    });
    const moves = [
      move("status", "Alpha", "Fire", "Status", 999),
      move("zero", "Zero", "Water", "Physical", 0),
      move("tie-b", "Beta", "Fire", "Special", 80),
      move("tie-a", "Alpha", "Fire", "Special", 80),
    ];
    expect(sortedMoves(moves, null).map(({ id }) => id)).toEqual([
      "status",
      "zero",
      "tie-b",
      "tie-a",
    ]);
    expect(
      sortedMoves(moves, { key: "type", direction: "ascending" }).map(
        ({ id }) => id,
      ),
    ).toEqual(["status", "tie-a", "tie-b", "zero"]);
    expect(
      sortedMoves(moves, { key: "type", direction: "descending" }).map(
        ({ id }) => id,
      ),
    ).toEqual(["zero", "status", "tie-a", "tie-b"]);
    expect(
      sortedMoves(moves, { key: "category", direction: "ascending" }).map(
        ({ id }) => id,
      ),
    ).toEqual(["zero", "tie-a", "tie-b", "status"]);
    expect(
      sortedMoves(moves, { key: "category", direction: "descending" }).map(
        ({ id }) => id,
      ),
    ).toEqual(["status", "tie-a", "tie-b", "zero"]);
    expect(
      sortedMoves(moves, { key: "power", direction: "ascending" }).map(
        ({ id }) => id,
      ),
    ).toEqual(["zero", "tie-a", "tie-b", "status"]);
    expect(
      sortedMoves(moves, { key: "power", direction: "descending" }).map(
        ({ id }) => id,
      ),
    ).toEqual(["tie-a", "tie-b", "zero", "status"]);
    const first = cycleMoveSort(null, "type");
    expect(cycleMoveSort(first, "type")?.direction).toBe("descending");
    expect(cycleMoveSort(cycleMoveSort(first, "type"), "type")).toBeNull();
    expect(cycleMoveSort(first, "power")?.key).toBe("power");
  });
});
