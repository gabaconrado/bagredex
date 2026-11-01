import { describe, expect, it } from "vitest";
import fixture from "./reference-parity.json";
import type { CalculatorData, Form, Move } from "../contracts";
import { calculate, stats, type Combatant, type Field } from "./calculate";

const nature = {
  id: "serious",
  name: "Serious",
  increased_stat: null,
  decreased_stat: null,
} as const;
const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const combatant = (input: any): Combatant => {
  const facts = input.facts;
  const form: Form = {
    id: facts.id,
    name: facts.name,
    is_mega: facts.id.includes("mega"),
    is_nfe: false,
    gender: "fixed",
    gender_options: [facts.gender],
    default_gender: facts.gender,
    types: facts.types.map(id),
    base_stats: facts.baseStats,
    weight_tenths_kg: Math.round(facts.weightKg * 10),
    abilities: [],
    move_ids: [],
    sprite_form_id: facts.id,
  };
  const options = input.options;
  const base = {
    form,
    gender: facts.gender,
    nature,
    sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: options.status ?? "",
    currentHp: 1,
    context: {},
  } as Combatant;
  base.currentHp = options.curHP ?? stats(base).hp;
  if (options.ability)
    base.ability = {
      id: id(options.ability),
      name: options.ability,
      contextual_inputs: [],
    };
  if (options.item)
    base.item = {
      id: id(options.item),
      name: options.item,
      calculation: {},
      contextual_inputs: [],
    };
  if (options.boosts) base.stages = { ...base.stages, ...options.boosts };
  return base;
};
const move = (input: any): Move => ({
  id: input.facts.id,
  name: input.facts.name,
  description: input.facts.description ?? input.facts.name,
  type_id: id(input.facts.type),
  category: input.facts.category,
  base_power: input.facts.basePower,
  accuracy: 100,
  pp: 1,
  priority: input.facts.priority,
  target: input.facts.target,
  flags: Object.keys(input.facts.flags),
  calculation: input.facts.calculation ?? {},
  contextual_inputs: [],
});
const field = (input: any): Field => ({
  weather: id(input.weather ?? ""),
  terrain: id(input.terrain ?? ""),
  attacker: {
    helpingHand: false,
    singleTarget: input.gameType === "Singles",
    critical: false,
    tailwind: Boolean(input.attackerSide?.isTailwind),
  },
  defender: {
    reflect: Boolean(input.defenderSide?.isReflect),
    lightScreen: Boolean(input.defenderSide?.isLightScreen),
    auroraVeil: false,
    friendGuard: false,
    tailwind: false,
  },
});
const data = {
  mechanics: { level: 50 },
  type_effectiveness: fixture.canonical.typeEffectiveness,
} as CalculatorData;
const referenceRolls = (damage: any): number[] =>
  Array.isArray(damage[0])
    ? damage[0].map((_: number, index: number) =>
        damage.reduce((sum: number, hit: number[]) => sum + hit[index]!, 0),
      )
    : damage;

describe("locally generated pinned vgcmulticalc evidence", () => {
  it("pins provenance and contains one activating case per parity category", () => {
    expect(fixture.metadata).toEqual({
      reference: "vgcmulticalc@166578cf88c4219dff7dbaa562b0a4e798b274f3",
      release: "showdown-multi-s5-i6-38ee90625b30",
      generator: "npm run generate:damage-parity",
      source: "local pinned references/vgc-multicalc",
    });
    expect(fixture.cases).toHaveLength(21);
    expect(new Set(fixture.cases.map(({ id }) => id)).size).toBe(21);
    for (const entry of fixture.cases) {
      expect(entry.description, entry.id).toContain(":");
      expect(entry.range, entry.id).toHaveLength(2);
    }
  });

  it("materially activates the required weather, HP, item, spread, and Mega cases", () => {
    const byId = new Map(fixture.cases.map((entry) => [entry.id, entry]));
    const maximum = (id: string) => byId.get(id)!.range[1]!;
    expect(maximum("weather")).toBeGreaterThan(maximum("special"));
    expect(maximum("hp-ability")).toBeGreaterThan(maximum("special"));
    expect(maximum("item")).toBeGreaterThan(maximum("physical"));
    expect(maximum("single-target")).toBeGreaterThan(maximum("spread"));
    expect(maximum("mega")).not.toBe(maximum("special"));
    expect(byId.get("specialized")!.description).toContain("Knock Off");
  });

  it.each(fixture.cases)("matches Bagredex ordered rolls for $id", (entry) => {
    const attacker = combatant(entry.inputs.attacker);
    const defender = combatant(entry.inputs.defender);
    const selectedMove = move(entry.inputs.move);
    const options = entry.inputs.move.options as Record<string, unknown>;
    Object.assign(attacker.context, options, {
      target_damaged: options.targetDamaged,
    });
    const selectedField = field(entry.inputs.field);
    selectedField.attacker.critical = Boolean(options.isCrit);
    const result = calculate(
      data,
      attacker,
      defender,
      selectedMove,
      selectedField,
    );
    const expected = referenceRolls(entry.rolls);
    expect(result.rolls).toEqual(
      typeof expected === "number" ? Array(16).fill(expected) : expected,
    );
    // The product intentionally omits reference-only prose (KO chance, BP
    // annotations, weather/screen clauses, and ability/item prefixes). The
    // normalized full output is its ordered roll range and percentage range.
    const referenceCore = entry.description.split(" -- ")[0]!;
    const summary = referenceCore.match(/: (\d+)-(\d+) \(([^)]+)\)$/);
    const expectedPercent = summary![3]!.match(/\d+(?:\.\d+)?/g)!;
    const actualCore = result.description.split("\n")[0]!;
    const actualSummary = actualCore.match(/: (\d+)(?:-(\d+))? \(([^)]+)\)$/);
    const actualPercent = actualSummary![3]!.match(/\d+(?:\.\d+)?/g)!;
    expect([
      actualSummary![1],
      actualSummary![2] ?? actualSummary![1],
      Number(actualPercent[0]),
      Number(actualPercent[1] ?? actualPercent[0]),
    ]).toEqual([summary![1], summary![2], ...expectedPercent.map(Number)]);
    expect(result.compact).toBe(
      `${summary![1]} ~ ${summary![2]} | ${Number(expectedPercent[0]).toFixed(1)}% ~ ${Number(expectedPercent[1]).toFixed(1)}%`,
    );
  });
});
