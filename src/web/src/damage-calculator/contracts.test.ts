import { describe, expect, it } from "vitest";
import { parseBootstrap, parseCalculatorData } from "./contracts";

const stats = { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 };
const dataset = {
  schema_version: "damage-calculator-data-v1",
  data_version: "version-1",
  regulation: { id: "m-c", name: "Regulation M-C" },
  mechanics: {
    id: "champions-level-50-v1",
    level: 50,
    sp_minimum: 0,
    sp_maximum: 32,
    sp_total_max: 66,
    hp_formula: "base + sp + 75",
    other_formula: "truncate((base + sp + 20) * nature_percent / 100)",
    nature_percentages: { hindering: 90, neutral: 100, increasing: 110 },
  },
  sprite_url_template: "/sprites/__FORM__/__VARIANT__.webp",
  state_input_policy: {
    StateMove: {
      source: ["name"],
      user: [],
      deterministic_defaults: {},
      unsupported: ["overrides"],
    },
    StatePokemon: {
      source: ["name"],
      user: [],
      deterministic_defaults: {},
      unsupported: ["overrides"],
    },
  },
  capability: {
    id: "damage-calculator-v1",
    context_schema_version: "damage-context-v1",
    formula_reference: "vgcmulticalc@166578cf88c4219dff7dbaa562b0a4e798b274f3",
    game_type: "Doubles",
    level: 50,
    status_values: ["", "brn"],
    stat_stage_minimum: -6,
    stat_stage_maximum: 6,
  },
  natures: [
    {
      id: "serious",
      name: "Serious",
      increased_stat: null,
      decreased_stat: null,
    },
  ],
  types: [{ id: "fire", name: "Fire" }],
  forms: [
    {
      id: "charizard",
      name: "Charizard",
      searchable: true,
      is_mega: false,
      is_nfe: false,
      gender: "variable",
      gender_options: ["M", "F"],
      default_gender: "M",
      types: ["fire"],
      base_stats: stats,
      weight_tenths_kg: 905,
      abilities: [{ id: "blaze", slot: "0" }],
      move_ids: ["protect"],
      sprite_form_id: "charizard",
    },
  ],
  abilities: [{ id: "blaze", name: "Blaze", contextual_inputs: [] }],
  items: [],
  moves: [
    {
      id: "protect",
      name: "Protect",
      type_id: "fire",
      category: "Status",
      base_power: 0,
      accuracy: null,
      pp: 10,
      priority: 4,
      target: "self",
      flags: [],
      calculation: {
        always_crit: false,
        breaks_protect: false,
        crash_damage: false,
        crit_ratio: 0,
        drain: null,
        ignore_defensive: false,
        mind_blown_recoil: false,
        multiaccuracy: false,
        multihit: null,
        override_defensive_stat: null,
        recoil: null,
        secondaries: [],
        secondary: null,
        self: null,
        self_boost: null,
        struggle_recoil: false,
      },
      contextual_inputs: [],
    },
  ],
  mega_item_relations: [],
  type_effectiveness: [
    {
      attacking_type_id: "fire",
      defending_type_id: "fire",
      multiplier_percent: 50,
    },
  ],
};

describe("damage calculator contracts", () => {
  it("accepts the versioned same-origin bootstrap", () => {
    expect(
      parseBootstrap({
        schema_version: "damage-calculator-bootstrap-v1",
        active_version: "version-1",
        regulation: dataset.regulation,
        dataset_url: "/damage-calculator/data/version-1/m-c/",
      }).active_version,
    ).toBe("version-1");
    expect(() =>
      parseBootstrap({
        schema_version: "damage-calculator-bootstrap-v1",
        active_version: "version-1",
        regulation: dataset.regulation,
        dataset_url: "https://example.test/data",
      }),
    ).toThrow();
  });

  it("rejects dangling canonical references", () => {
    expect(parseCalculatorData(dataset).forms[0]?.abilities[0]?.slot).toBe("0");
    expect(() =>
      parseCalculatorData({
        ...dataset,
        forms: [{ ...dataset.forms[0], move_ids: ["missing"] }],
      }),
    ).toThrow("form references");
  });

  it("rejects unknown keys, incomplete matrices, and malformed descriptors", () => {
    expect(() => parseCalculatorData({ ...dataset, surprise: true })).toThrow(
      "calculator data keys",
    );
    expect(() =>
      parseCalculatorData({ ...dataset, type_effectiveness: [] }),
    ).toThrow("Incomplete type effectiveness matrix");
    expect(() =>
      parseCalculatorData({
        ...dataset,
        abilities: [
          {
            ...dataset.abilities[0],
            contextual_inputs: [
              {
                key: "active",
                label: "Active",
                kind: "integer",
                default: 2,
                minimum: 0,
                maximum: 1,
              },
            ],
          },
        ],
      }),
    ).toThrow("integer contextual input");
  });
  it("rejects inconsistent canonical gender facts", () => {
    expect(() =>
      parseCalculatorData({
        ...dataset,
        forms: [
          { ...dataset.forms[0], gender_options: ["F"], default_gender: "F" },
        ],
      }),
    ).toThrow("gender facts");
  });
  it("rejects duplicate state-policy classifications", () => {
    expect(() =>
      parseCalculatorData({
        ...dataset,
        state_input_policy: {
          ...dataset.state_input_policy,
          StateMove: {
            ...dataset.state_input_policy.StateMove,
            user: ["name"],
          },
        },
      }),
    ).toThrow("policy classification");
  });
  it("rejects malformed nested calculation facts", () => {
    expect(() =>
      parseCalculatorData({
        ...dataset,
        moves: [
          {
            ...dataset.moves[0],
            calculation: {
              ...dataset.moves[0]!.calculation,
              secondary: {
                chance: 30,
                boosts: { accuracy: -1 },
                self_boosts: {},
                status: null,
                volatile_status: null,
              },
            },
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      parseCalculatorData({
        ...dataset,
        moves: [
          {
            ...dataset.moves[0],
            calculation: { ...dataset.moves[0]!.calculation, crit_ratio: -1 },
          },
        ],
      }),
    ).toThrow("calculation scalar");
    expect(() =>
      parseCalculatorData({
        ...dataset,
        moves: [
          {
            ...dataset.moves[0],
            calculation: {
              ...dataset.moves[0]!.calculation,
              secondary: {
                chance: 100,
                boosts: { unknown: 1 },
                self_boosts: {},
                status: null,
                volatile_status: null,
              },
            },
          },
        ],
      }),
    ).toThrow("secondary boost");
  });
  it("rejects wrong scalar, range, and array types before record access", () => {
    expect(() =>
      parseCalculatorData({
        ...dataset,
        forms: [{ ...dataset.forms[0], types: "fire" }],
      }),
    ).toThrow("form fields");
    expect(() =>
      parseCalculatorData({
        ...dataset,
        moves: [{ ...dataset.moves[0], accuracy: 101 }],
      }),
    ).toThrow("move facts");
    expect(() =>
      parseCalculatorData({
        ...dataset,
        moves: [{ ...dataset.moves[0], flags: ["protect", "protect"] }],
      }),
    ).toThrow("move facts");
  });
});
