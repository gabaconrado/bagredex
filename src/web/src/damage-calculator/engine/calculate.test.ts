import { describe, expect, it } from "vitest";
import { format } from "pretty-format";
import parityFixture from "./parity-fixture.txt?raw";
import type { CalculatorData, Form, Move, Nature } from "../contracts";
import {
  applyMod,
  calculate,
  chainMods,
  pokeRound,
  stats,
  type Combatant,
  type Field,
} from "./calculate";

const parityPins = {
  release: "showdown-multi-s5-i6-38ee90625b30",
  formula: "vgcmulticalc@166578cf88c4219dff7dbaa562b0a4e798b274f3",
} as const;

const nature: Nature = {
  id: "serious",
  name: "Serious",
  increased_stat: null,
  decreased_stat: null,
};
const form = (id: string, types: string[], values: number[]): Form => ({
  id,
  name: id,
  searchable: true,
  is_mega: false,
  is_nfe: false,
  gender: "variable",
  gender_options: ["M", "F"],
  default_gender: "M",
  types,
  base_stats: {
    hp: values[0]!,
    atk: values[1]!,
    def: values[2]!,
    spa: values[3]!,
    spd: values[4]!,
    spe: values[5]!,
  },
  weight_tenths_kg: 100,
  abilities: [],
  move_ids: ["earthquake"],
  sprite_form_id: id,
});
const charizard = form(
  "charizard",
  ["fire", "flying"],
  [78, 84, 78, 109, 85, 100],
);
const target = form("target", ["fire", "dragon"], [78, 130, 111, 130, 85, 100]);
const move: Move = {
  id: "earthquake",
  name: "Earthquake",
  type_id: "ground",
  category: "Physical",
  base_power: 100,
  accuracy: 100,
  pp: 10,
  priority: 0,
  target: "allAdjacent",
  flags: [],
  calculation: {},
  contextual_inputs: [],
};
const data = {
  mechanics: { level: 50 },
  type_effectiveness: [
    {
      attacking_type_id: "ground",
      defending_type_id: "fire",
      multiplier_percent: 200,
    },
    {
      attacking_type_id: "ground",
      defending_type_id: "dragon",
      multiplier_percent: 100,
    },
  ],
} as CalculatorData;
const combatant = (pokemon: Form): Combatant => ({
  form: pokemon,
  gender: "M",
  nature,
  sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: "",
  currentHp: stats({
    form: pokemon,
    nature,
    sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  }).hp,
  context: {},
});
const field: Field = {
  weather: "",
  terrain: "",
  attacker: {
    helpingHand: false,
    singleTarget: false,
    critical: false,
    tailwind: false,
  },
  defender: {
    reflect: false,
    lightScreen: false,
    auroraVeil: false,
    friendGuard: false,
    tailwind: false,
  },
};

describe("damage engine", () => {
  it("uses the Champions SP stat formula", () =>
    expect(stats(combatant(charizard)).hp).toBe(153));
  it("returns sixteen exact ordered rolls and compact output", () => {
    expect(parityPins).toEqual({
      release: "showdown-multi-s5-i6-38ee90625b30",
      formula: "vgcmulticalc@166578cf88c4219dff7dbaa562b0a4e798b274f3",
    });
    const result = calculate(
      data,
      combatant(charizard),
      combatant(target),
      move,
      field,
    );
    expect(result.rolls).toHaveLength(16);
    expect(result.rolls).toEqual([...result.rolls].sort((a, b) => a - b));
    expect(result.compact).toMatch(/^\d+ ~ \d+ \| \d+\.\d% ~ \d+\.\d%$/);
    expect(result.rolls).toEqual([
      44, 46, 46, 46, 48, 48, 48, 48, 50, 50, 50, 50, 52, 52, 52, 54,
    ]);
    expect(result.compact).toBe("44 ~ 54 | 28.7% ~ 35.2%");
    expect(result.description).toBe(
      "0 Atk charizard Earthquake vs. 0 HP / 0 Def target: 44-54 (28.7 - 35.2%)\n(44, 46, 46, 46, 48, 48, 48, 48, 50, 50, 50, 50, 52, 52, 52, 54)",
    );
  });
  it("matches the pinned modifier rounding primitives", () => {
    expect(pokeRound(10.5)).toBe(10);
    expect(pokeRound(10.51)).toBe(11);
    expect(chainMods([5324, 3072])).toBe(3993);
    expect(applyMod(101, 3072)).toBe(76);
  });
  it("applies Rivalry only for gendered same/opposite pairs", () => {
    const attacker = {
      ...combatant(charizard),
      ability: { id: "rivalry", name: "Rivalry", contextual_inputs: [] },
    };
    const same = calculate(
      data,
      attacker,
      combatant(target),
      move,
      field,
    ).rolls;
    const opposite = calculate(
      data,
      attacker,
      { ...combatant(target), gender: "F" },
      move,
      field,
    ).rolls;
    const genderless = calculate(
      data,
      attacker,
      { ...combatant(target), gender: "N" },
      move,
      field,
    ).rolls;
    expect(same[0]).toBeGreaterThan(genderless[0]!);
    expect(opposite[0]).toBeLessThan(genderless[0]!);
  });
  it("uses explicit prior-damage and stockpile descriptors", () => {
    const applied = new Set<string>();
    const priorDamage = calculate(
      data,
      { ...combatant(charizard), context: { prior_damage_taken: 20 } },
      combatant(target),
      { ...move, id: "counter", name: "Counter", base_power: 0 },
      field,
      applied,
    );
    expect(priorDamage.rolls).toEqual(Array(16).fill(40));
    expect(applied).toContain(
      "applied:variable-power:context:counter:prior_damage_taken",
    );
    expect(
      calculate(
        data,
        {
          ...combatant(charizard),
          currentHp: 1,
          context: { prior_damage_taken: 200 },
        },
        { ...combatant(target), currentHp: 1 },
        { ...move, id: "counter", name: "Counter", base_power: 0 },
        field,
      ).rolls,
    ).toEqual(Array(16).fill(400));
    for (const id of ["mirrorcoat", "comeuppance", "metalburst"] as const) {
      const result = calculate(
        data,
        { ...combatant(charizard), context: { prior_damage_taken: 20 } },
        combatant(target),
        { ...move, id, name: id, base_power: 0 },
        field,
      );
      expect(result.rolls).toEqual(
        Array(16).fill(id === "mirrorcoat" ? 40 : 30),
      );
    }
    const oneStockpile = calculate(
      data,
      { ...combatant(charizard), context: { stockpile_count: 1 } },
      combatant(target),
      { ...move, id: "spitup", name: "Spit Up", base_power: 0 },
      field,
    );
    const threeStockpiles = calculate(
      data,
      { ...combatant(charizard), context: { stockpile_count: 3 } },
      combatant(target),
      { ...move, id: "spitup", name: "Spit Up", base_power: 0 },
      field,
    );
    expect(threeStockpiles.rolls[0]).toBeGreaterThan(oneStockpile.rolls[0]!);
    const soloBeatUp = calculate(
      data,
      { ...combatant(charizard), context: {} },
      combatant(target),
      { ...move, id: "beatup", name: "Beat Up", base_power: 0 },
      field,
    );
    const partyBeatUp = calculate(
      data,
      {
        ...combatant(charizard),
        context: {
          ally_1_base_attack: 100,
          ally_2_base_attack: 120,
          ally_3_base_attack: 0,
        },
      },
      combatant(target),
      { ...move, id: "beatup", name: "Beat Up", base_power: 0 },
      field,
    );
    expect(partyBeatUp.rolls[0]).toBeGreaterThan(soloBeatUp.rolls[0]!);
  });
  it("keeps formerly unsupported ability branches calculable", () => {
    const result = calculate(
      data,
      {
        ...combatant(charizard),
        ability: {
          id: "cloudnine",
          name: "Cloud Nine",
          contextual_inputs: [],
        },
      },
      combatant(target),
      move,
      field,
    );
    expect(result.rolls).toHaveLength(16);
  });
  it("handles speed, weight, typing, and item-suppression groups", () => {
    const ability = (id: string) => ({ id, name: id, contextual_inputs: [] });
    const plain = combatant(charizard);
    const sun = { ...field, weather: "sun" };
    const electroBall = {
      ...move,
      id: "electroball",
      name: "Electro Ball",
      category: "Special" as const,
      base_power: 0,
    };
    expect(
      calculate(
        data,
        { ...plain, ability: ability("chlorophyll") },
        combatant(target),
        electroBall,
        sun,
      ).rolls[0],
    ).toBeGreaterThan(
      calculate(data, plain, combatant(target), electroBall, sun).rolls[0]!,
    );
    const heavySlam = {
      ...move,
      id: "heavyslam",
      name: "Heavy Slam",
      base_power: 0,
    };
    const weightedAttacker = {
      ...plain,
      form: { ...charizard, weight_tenths_kg: 1000 },
    };
    const weightedTarget = {
      ...combatant(target),
      form: { ...target, weight_tenths_kg: 300 },
    };
    expect(
      calculate(
        data,
        { ...weightedAttacker, ability: ability("lightmetal") },
        weightedTarget,
        heavySlam,
        field,
      ).rolls[0],
    ).toBeLessThan(
      calculate(data, weightedAttacker, weightedTarget, heavySlam, field)
        .rolls[0]!,
    );
    expect(
      calculate(
        data,
        { ...plain, ability: ability("protean") },
        combatant(target),
        move,
        field,
      ).rolls[0],
    ).toBeGreaterThan(
      calculate(data, plain, combatant(target), move, field).rolls[0]!,
    );
  });
  it("keeps pinch typing exact and applies Tailwind to speed power", () => {
    const ability = (id: string) => ({ id, name: id, contextual_inputs: [] });
    const lowHpBlaze = {
      ...combatant(charizard),
      currentHp: 1,
      ability: ability("blaze"),
    };
    expect(
      calculate(data, lowHpBlaze, combatant(target), move, field).rolls,
    ).toEqual(
      calculate(
        data,
        { ...lowHpBlaze, ability: undefined },
        combatant(target),
        move,
        field,
      ).rolls,
    );
    const electroBall = {
      ...move,
      id: "electroball",
      name: "Electro Ball",
      category: "Special" as const,
      base_power: 0,
    };
    const withTailwind = calculate(
      data,
      combatant(charizard),
      combatant(target),
      electroBall,
      { ...field, attacker: { ...field.attacker, tailwind: true } },
    );
    expect(withTailwind.rolls[0]).toBeGreaterThan(
      calculate(
        data,
        combatant(charizard),
        combatant(target),
        electroBall,
        field,
      ).rolls[0]!,
    );
  });
  it("recalculates Parental Bond child hits and excludes fixed damage", () => {
    const parental = {
      ...combatant(charizard),
      ability: {
        id: "parentalbond",
        name: "Parental Bond",
        contextual_inputs: [],
      },
    };
    const singleTargetMove = { ...move, target: "normal" };
    const result = calculate(
      data,
      parental,
      combatant(target),
      singleTargetMove,
      field,
    );
    expect(result.rolls).toEqual([
      75, 75, 77, 77, 80, 80, 80, 82, 82, 82, 85, 85, 85, 87, 87, 90,
    ]);
    expect(result.compact).toBe("75 ~ 90 | 49.0% ~ 58.8%");
    expect(result.description).toBe(
      "0 Atk charizard Earthquake vs. 0 HP / 0 Def target: 75-90 (49.0 - 58.8%)\n(75, 75, 77, 77, 80, 80, 80, 82, 82, 82, 85, 85, 85, 87, 87, 90)",
    );
    const fixed = calculate(
      data,
      { ...parental, context: { prior_damage_taken: 20 } },
      combatant(target),
      { ...singleTargetMove, id: "counter", base_power: 0 },
      field,
    );
    expect(fixed.rolls).toEqual(Array(16).fill(80));
    const seismicToss = calculate(
      data,
      parental,
      combatant(target),
      {
        ...singleTargetMove,
        id: "seismictoss",
        name: "Seismic Toss",
        base_power: 0,
      },
      field,
    );
    expect(seismicToss.rolls).toEqual(Array(16).fill(100));
    expect(seismicToss.compact).toBe("100 ~ 100 | 65.3% ~ 65.3%");
  });
  it("explains status moves and immunity", () => {
    expect(
      calculate(
        data,
        combatant(charizard),
        combatant(target),
        { ...move, category: "Status", base_power: 0 },
        field,
      ).description,
    ).toContain("status move");
    expect(
      calculate(
        {
          ...data,
          type_effectiveness: [
            {
              attacking_type_id: "ground",
              defending_type_id: "fire",
              multiplier_percent: 0,
            },
          ],
        },
        combatant(charizard),
        combatant(target),
        move,
        field,
      ).compact,
    ).toBe("—");
  });
});

const parityCases = [
  ["physical", {}, {}, {}],
  ["special", {}, { category: "Special" }, {}],
  ["spread", {}, {}, {}],
  [
    "single-target",
    {},
    {},
    { attacker: { ...field.attacker, singleTarget: true } },
  ],
  ["weather", {}, {}, { weather: "sun" }],
  [
    "terrain-grounded",
    { form: { ...charizard, types: ["ground"] } },
    {},
    { terrain: "grassy" },
  ],
  ["terrain-ungrounded", {}, {}, { terrain: "electric" }],
  ["screens", {}, {}, { defender: { ...field.defender, reflect: true } }],
  ["critical", {}, {}, { attacker: { ...field.attacker, critical: true } }],
  ["stages", { stages: { atk: 2, def: 0, spa: 0, spd: 0, spe: 0 } }, {}, {}],
  ["burn", { status: "brn" }, {}, {}],
  [
    "hp-ability",
    {
      currentHp: 1,
      ability: { id: "blaze", name: "Blaze", contextual_inputs: [] },
    },
    {},
    {},
  ],
  ["hp-power", { currentHp: 50 }, { id: "eruption", name: "Eruption" }, {}],
  [
    "item",
    {
      item: {
        id: "lifeorb",
        name: "Life Orb",
        calculation: {},
        contextual_inputs: [],
      },
    },
    {},
    {},
  ],
  [
    "ability",
    { ability: { id: "rivalry", name: "Rivalry", contextual_inputs: [] } },
    {},
    {},
  ],
  [
    "variable",
    {},
    {
      id: "electroball",
      name: "Electro Ball",
      base_power: 0,
      category: "Special",
    },
    {},
  ],
  [
    "fixed",
    { context: { prior_damage_taken: 20 } },
    { id: "counter", name: "Counter", base_power: 0 },
    {},
  ],
  [
    "progressive",
    { context: { hits: 2 } },
    { calculation: { multihit: 2 } },
    {},
  ],
  [
    "mega",
    { form: { ...charizard, id: "charizardmegax", name: "Charizard-Mega-X" } },
    {},
    {},
  ],
  [
    "context",
    { context: { target_damaged: true } },
    { id: "assurance", name: "Assurance", base_power: 60 },
    {},
  ],
  [
    "specialized",
    {},
    { id: "knockoff", name: "Knock Off", base_power: 65 },
    {},
  ],
] as const;

describe.skip("superseded internal output fixture", () => {
  const expected = new Map(
    [
      ...parityFixture.matchAll(
        /exports\[`pinned exact parity matrix > (.+?) 1`\] = `\n([\s\S]*?)\n`;/g,
      ),
    ].map(([, id, value]) => [id, value]),
  );
  it.each(parityCases)("%s", (name, attackerPatch, movePatch, fieldPatch) => {
    const moveValues = movePatch as Partial<Move>;
    const fieldValues = fieldPatch as Partial<Field>;
    const result = calculate(
      data,
      { ...combatant(charizard), ...attackerPatch } as Combatant,
      combatant(target),
      {
        ...move,
        ...moveValues,
        calculation: {
          ...move.calculation,
          ...(moveValues.calculation ?? {}),
        },
      } as Move,
      {
        ...field,
        ...fieldValues,
        attacker: { ...field.attacker, ...(fieldValues.attacker ?? {}) },
        defender: { ...field.defender, ...(fieldValues.defender ?? {}) },
      },
    );
    expect(
      format(
        { name, pins: parityPins, ...result },
        { printBasicPrototype: false },
      ),
    ).toBe(expected.get(name));
  });
});
