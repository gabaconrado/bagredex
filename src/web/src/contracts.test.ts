import { describe, expect, it } from "vitest";
import {
  parseApiError,
  parseBootstrap,
  parseDetails,
  parseDetail,
  parseIndex,
} from "./contracts";

const named = { id: "x", name: "X" };
const bootstrap = {
  schema_version: "pokedex-bootstrap-v2",
  active_version: "v1",
  regulation: { ...named, label: "Regulation X" },
  regulations: [{ ...named, label: "Regulation X", url: "/?regulation=x" }],
  index_url: "/index?version=v1",
  details_url: "/details?version=v1",
  sprite_url_template: "/sprites/__FORM__/__VARIANT__.webp",
};
const index = {
  schema_version: "pokedex-index-v1",
  data_version: "v1",
  regulation: named,
  forms: [
    {
      ...named,
      national_dex_number: 1,
      is_mega: false,
      types: [named],
      stats: { hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 },
      bst: 21,
      ability_ids: ["ability"],
      move_ids: ["move"],
    },
  ],
  moves: [named],
  abilities: [named],
  types: [named],
};
const detail = {
  schema_version: "pokedex-form-detail-v1",
  data_version: "v1",
  regulation_id: "x",
  form: {
    ...named,
    is_list_legal: true,
    is_mega: false,
    types: [named],
    sprites: { normal: "/normal.webp", shiny: "/shiny.webp" },
    form_switches: { base: named, megas: [named] },
    stats: [{ ...named, base: 1, real: 2, minimum: 1, maximum: 3 }],
    abilities: [
      { ...named, slot: "0", short_description: "Short", description: "Long" },
    ],
    moves: [
      {
        ...named,
        type: named,
        category: "Status",
        base_power: 0,
        accuracy: null,
        always_hits: true,
        pp: 5,
        priority: 0,
        target: "normal",
        short_description: "Short",
        description: "Long",
        flags: ["protect"],
      },
    ],
  },
};
const copy = <T>(value: T): T => structuredClone(value);

describe("transport validation", () => {
  it.each([
    ["schema", (x: any) => (x.schema_version = "old")],
    ["version", (x: any) => (x.active_version = "")],
    ["regulation", (x: any) => (x.regulation.name = 1)],
    ["regulations", (x: any) => (x.regulations = null)],
    [
      "regulation URL",
      (x: any) => (x.regulations[0].url = "https://example.test"),
    ],
    ["index URL", (x: any) => (x.index_url = 4)],
    [
      "sprite URL",
      (x: any) => (x.sprite_url_template = "/sprites/no-placeholders"),
    ],
  ])("rejects malformed bootstrap %s", (_label, mutate) => {
    const value: any = copy(bootstrap);
    mutate(value);
    expect(() => parseBootstrap(value)).toThrow();
  });

  it.each([
    ["schema", (x: any) => (x.schema_version = "old")],
    ["version", (x: any) => (x.data_version = null)],
    ["regulation", (x: any) => (x.regulation.id = "")],
    ["forms", (x: any) => (x.forms = {})],
    ["form name", (x: any) => (x.forms[0].name = false)],
    ["dex", (x: any) => (x.forms[0].national_dex_number = 0)],
    ["mega", (x: any) => (x.forms[0].is_mega = "no")],
    ["types", (x: any) => (x.forms[0].types = [])],
    ["stats", (x: any) => (x.forms[0].stats.spe = null)],
    ["bst", (x: any) => (x.forms[0].bst = "21")],
    ["ability ids", (x: any) => (x.forms[0].ability_ids = [null])],
    ["move ids", (x: any) => (x.forms[0].move_ids = [""])],
    ["moves lookup", (x: any) => (x.moves[0].id = 1)],
    ["abilities lookup", (x: any) => (x.abilities = null)],
    ["types lookup", (x: any) => (x.types[0].name = "")],
  ])("rejects malformed index %s", (_label, mutate) => {
    const value: any = copy(index);
    mutate(value);
    expect(() => parseIndex(value)).toThrow();
  });

  it.each([
    ["schema", (x: any) => (x.schema_version = "old")],
    ["version", (x: any) => (x.data_version = 1)],
    ["regulation", (x: any) => (x.regulation_id = "")],
    ["form", (x: any) => (x.form.name = null)],
    ["legal", (x: any) => (x.form.is_list_legal = 1)],
    ["mega", (x: any) => (x.form.is_mega = null)],
    ["types", (x: any) => (x.form.types[0].id = "")],
    ["normal sprite", (x: any) => (x.form.sprites.normal = "javascript:bad")],
    ["shiny sprite", (x: any) => (x.form.sprites.shiny = null)],
    ["base switch", (x: any) => (x.form.form_switches.base = "x")],
    ["mega switches", (x: any) => (x.form.form_switches.megas[0].name = 1)],
    ["stats", (x: any) => (x.form.stats[0].maximum = "3")],
    ["ability slot", (x: any) => (x.form.abilities[0].slot = null)],
    ["ability short", (x: any) => (x.form.abilities[0].short_description = 1)],
    [
      "ability description",
      (x: any) => (x.form.abilities[0].description = null),
    ],
    ["move type", (x: any) => (x.form.moves[0].type = null)],
    ["move category", (x: any) => (x.form.moves[0].category = "")],
    ["move power", (x: any) => (x.form.moves[0].base_power = null)],
    ["move accuracy", (x: any) => (x.form.moves[0].accuracy = 100)],
    ["move always-hit", (x: any) => (x.form.moves[0].always_hits = "yes")],
    ["move PP", (x: any) => (x.form.moves[0].pp = "5")],
    ["move priority", (x: any) => (x.form.moves[0].priority = null)],
    ["move target", (x: any) => (x.form.moves[0].target = "")],
    ["move short", (x: any) => (x.form.moves[0].short_description = null)],
    ["move description", (x: any) => (x.form.moves[0].description = 1)],
    ["move flags", (x: any) => (x.form.moves[0].flags = [null])],
  ])("rejects malformed detail %s", (_label, mutate) => {
    const value: any = copy(detail);
    mutate(value);
    expect(() => parseDetail(value)).toThrow();
  });

  it("validates ordinary and stale errors", () => {
    expect(
      parseApiError({ code: "form-not-found", message: "Missing" }).code,
    ).toBe("form-not-found");
    expect(
      parseApiError({
        code: "data-version-changed",
        message: "Reload",
        active_version: "v2",
        url: "/",
      }).code,
    ).toBe("data-version-changed");
    expect(
      parseApiError({ code: "data-version-changed", message: "Reload" }).code,
    ).toBe("request-failed");
    expect(parseApiError({ code: "bad", message: 1 }).code).toBe(
      "request-failed",
    );
  });

  it("validates and indexes bulk details", () => {
    const bulk = {
      schema_version: "pokedex-details-v1",
      data_version: "v1",
      regulation_id: "x",
      forms: [
        {
          ...named,
          is_list_legal: true,
          is_mega: false,
          form_label: "",
          base_id: "x",
          mega_ids: [],
          types: [named],
          stats: detail.form.stats,
          ability_slots: [{ id: "x", slot: "0" }],
          move_ids: ["x"],
        },
      ],
      abilities: [
        { ...named, short_description: "Short", description: "Long" },
      ],
      moves: detail.form.moves,
    };
    expect(parseDetails(bulk, "v1", "x").maps.forms.get("x")?.name).toBe("X");
    const dangling: any = copy(bulk);
    dangling.forms[0].move_ids = ["missing"];
    expect(() => parseDetails(dangling, "v1", "x")).toThrow(/dangling move/);
    expect(() => parseDetails(bulk, "v2", "x")).toThrow(/data changed/);
  });
});
