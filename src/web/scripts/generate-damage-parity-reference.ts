/** Development-only parity generator. This imports the locally pinned reference directly. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calculate,
  Field,
  Move,
  Pokemon,
} from "../../../references/vgc-multicalc/src/domain/calc/index";

const referenceRevision = "166578cf88c4219dff7dbaa562b0a4e798b274f3";
const release = "showdown-multi-s5-i6-38ee90625b30";
const releaseRoot = resolve(
  process.cwd(),
  `../../src/data/releases/${release}`,
);
const load = (name: string) =>
  JSON.parse(readFileSync(resolve(releaseRoot, `${name}.json`), "utf8"));
const forms = load("forms");
const profiles = load("profiles");
const normalizedMoves = load("move_profiles");
const pokemonFacts = (name: string) => {
  const form = forms.find((row: any) => row.name === name);
  const profile = profiles.find((row: any) => row.form_id === form.id);
  return {
    id: form.id,
    name: form.name,
    types: profile.types,
    baseStats: profile.stats,
    weightKg: profile.weight_tenths_kg / 10,
    gender: form.default_gender,
  };
};
const moveFacts = (name: string) => {
  const row = normalizedMoves.find((candidate: any) => candidate.name === name);
  return {
    id: row.id,
    name: row.name,
    basePower: row.base_power,
    type: row.type,
    category: row.category,
    flags: Object.fromEntries(
      (row.flags ?? []).map((flag: string) => [flag, true]),
    ),
    target: row.target,
    priority: row.priority,
    calculation: row.calculation,
    multihit: row.calculation.multihit ?? undefined,
    multiaccuracy: row.calculation.multiaccuracy,
    ignoreDefensive: row.calculation.ignore_defensive,
    overrideDefensiveStat: row.calculation.override_defensive_stat ?? undefined,
  };
};
type Case = {
  id: string;
  attacker: [string, Record<string, unknown>];
  defender: [string, Record<string, unknown>];
  move: [string, Record<string, unknown>];
  field: Record<string, unknown>;
};
const base = (id: string, move: string, extra: Partial<Case> = {}): Case => ({
  id,
  attacker: ["Charizard", { nature: "Serious" }],
  defender: ["Dragonite", { nature: "Serious" }],
  move: [move, {}],
  field: { gameType: "Doubles" },
  ...extra,
});
const cases: Case[] = [
  base("physical", "Dragon Claw"),
  base("special", "Flamethrower"),
  base("spread", "Heat Wave"),
  base("single-target", "Heat Wave", { field: { gameType: "Singles" } }),
  base("weather", "Flamethrower", {
    field: { gameType: "Doubles", weather: "Sun" },
  }),
  base("terrain-grounded", "Earthquake", {
    attacker: ["Garchomp", {}],
    defender: ["Tyranitar", {}],
    field: { gameType: "Doubles", terrain: "Grassy" },
  }),
  base("terrain-ungrounded", "Rising Voltage", {
    field: { gameType: "Doubles", terrain: "Electric" },
  }),
  base("screens", "Dragon Claw", {
    field: { gameType: "Doubles", defenderSide: { isReflect: true } },
  }),
  base("critical", "Dragon Claw", { move: ["Dragon Claw", { isCrit: true }] }),
  base("stages", "Dragon Claw", {
    attacker: ["Charizard", { boosts: { atk: 2 } }],
  }),
  base("burn", "Dragon Claw", {
    attacker: ["Charizard", { status: "brn" }],
  }),
  base("hp-ability", "Flamethrower", {
    attacker: ["Charizard", { ability: "Blaze", curHP: 1 }],
  }),
  base("hp-power", "Eruption", { attacker: ["Typhlosion", { curHP: 50 }] }),
  base("item", "Dragon Claw", {
    attacker: ["Charizard", { item: "Life Orb" }],
  }),
  base("ability", "Flamethrower", {
    attacker: ["Charizard", { ability: "Solar Power" }],
    field: { gameType: "Doubles", weather: "Sun" },
  }),
  base("variable", "Electro Ball", { attacker: ["Jolteon", {}] }),
  base("fixed", "Seismic Toss"),
  base("progressive", "Triple Axel", { attacker: ["Weavile", {}] }),
  base("mega", "Flamethrower", { attacker: ["Charizard-Mega-Y", {}] }),
  base("context", "Assurance", {
    move: ["Assurance", { targetDamaged: true }],
  }),
  base("specialized", "Knock Off", {
    defender: ["Dragonite", { item: "Leftovers" }],
  }),
];
const rows = cases.map((entry) => {
  const attackerFacts = pokemonFacts(entry.attacker[0]);
  const defenderFacts = pokemonFacts(entry.defender[0]);
  const explicitMove = moveFacts(entry.move[0]);
  const result = calculate(
    new Pokemon(
      entry.attacker[0],
      entry.attacker[1] as never,
      attackerFacts as never,
    ),
    new Pokemon(
      entry.defender[0],
      entry.defender[1] as never,
      defenderFacts as never,
    ),
    new Move(entry.move[0], entry.move[1] as never, explicitMove as never),
    new Field(entry.field as never),
  );
  const damage = result.damage;
  let description: string;
  try {
    description = result.description();
  } catch (error) {
    throw new Error(`Reference description failed for ${entry.id}`, {
      cause: error,
    });
  }
  return {
    id: entry.id,
    inputs: {
      attacker: { facts: attackerFacts, options: entry.attacker[1] },
      defender: { facts: defenderFacts, options: entry.defender[1] },
      move: { facts: explicitMove, options: entry.move[1] },
      field: entry.field,
    },
    rolls: damage,
    range: result.range(),
    description,
  };
});
const artifact = {
  metadata: {
    reference: `vgcmulticalc@${referenceRevision}`,
    release,
    generator: "npm run generate:damage-parity",
    source: "local pinned references/vgc-multicalc",
  },
  cases: rows,
  canonical: {
    typeEffectiveness: load("type_effectiveness"),
    abilities: load("ability_profiles"),
    items: load("item_profiles"),
  },
};
writeFileSync(
  resolve(process.cwd(), "src/damage-calculator/engine/reference-parity.json"),
  `${JSON.stringify(artifact, null, 2)}\n`,
);
