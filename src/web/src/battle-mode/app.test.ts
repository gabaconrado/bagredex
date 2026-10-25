import { describe, expect, it } from "vitest";
import type { CalculatorData, Form } from "../damage-calculator/contracts";
import {
  deriveSpeedOrder,
  formatBattleDamage,
  friendGuardPartner,
  spreadContext,
  unavailableBuildReason,
} from "./app";
import { emptyBattleState, zeroStages, type BattleMember } from "./state";

const form = (id: string, speed: number): Form => ({
  id,
  name: id,
  searchable: true,
  is_mega: false,
  is_nfe: false,
  gender: "N",
  gender_options: ["N"],
  default_gender: "N",
  types: ["normal"],
  base_stats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: speed },
  weight_tenths_kg: 100,
  abilities: [{ id: "plain", slot: "0" }],
  move_ids: [],
  sprite_form_id: id,
});
const data = {
  forms: [
    form("fast", 100),
    form("slow", 50),
    form("twin", 100),
    { ...form("fastmega", 120), is_mega: true, searchable: false },
  ],
  natures: [
    {
      id: "serious",
      name: "Serious",
      increased_stat: null,
      decreased_stat: null,
    },
  ],
  abilities: [
    { id: "plain", name: "Plain", contextual_inputs: [] },
    { id: "friendguard", name: "Friend Guard", contextual_inputs: [] },
  ],
  items: [
    {
      id: "fastite",
      name: "Fastite",
      calculation: {},
      contextual_inputs: [],
    },
  ],
  moves: [],
  mega_item_relations: [
    {
      item_id: "fastite",
      base_form_id: "fast",
      mega_form_id: "fastmega",
      locked_ability_id: "plain",
    },
  ],
} as unknown as CalculatorData;
const member = (id: string, side: "own" | "opponent"): BattleMember => ({
  id,
  side,
  formId: id,
  baseSpeciesId: id,
  label: id,
  gender: "N",
  abilityId: "plain",
  itemId: null,
  natureId: "serious",
  moveIds: [null, null, null, null],
  sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: "",
  stages: zeroStages(),
  hp: 100,
  mega: false,
  shiny: false,
});

describe("Battle Mode calculation adapters", () => {
  it("formats opponent damage as floored percentages and own damage as raw HP", () => {
    expect(formatBattleDamage("opponent", [30, 40], 151)).toBe("19.8–26.4%");
    expect(formatBattleDamage("own", [30, 40], 151)).toBe("30–40 HP");
  });

  it("derives automatic and overridden spread inputs with explicit multipliers", () => {
    expect(spreadContext(2, false)).toEqual({
      singleTarget: false,
      multiplier: 0.75,
      source: "automatic-spread",
    });
    expect(spreadContext(2, true)).toEqual({
      singleTarget: true,
      multiplier: 1,
      source: "override",
    });
    expect(spreadContext(1, false).source).toBe("automatic-one");
  });

  it("groups ties and reverses unequal groups under Trick Room", () => {
    const members = [
      member("fast", "own"),
      member("twin", "opponent"),
      member("slow", "opponent"),
    ];
    const base = emptyBattleState();
    const board: Record<"own" | "opponent", [string | null, string | null]> = {
      own: ["fast", null],
      opponent: ["twin", "slow"],
    };
    const normal = deriveSpeedOrder(data, members, board, base.field);
    expect(
      normal.groups.map((group) => group.map(({ member }) => member.id)),
    ).toEqual([["fast", "twin"], ["slow"]]);
    const trick = deriveSpeedOrder(data, members, board, {
      ...base.field,
      trickRoom: true,
    });
    expect(
      trick.groups.map((group) => group.map(({ member }) => member.id)),
    ).toEqual([["slow"], ["fast", "twin"]]);
  });

  it("fails closed when a saved member has an unknown nature or ability", () => {
    expect(
      unavailableBuildReason(data, { ...member("fast", "own"), natureId: "" }),
    ).toBe("nature is unknown");
    expect(
      unavailableBuildReason(data, {
        ...member("fast", "own"),
        abilityId: null,
      }),
    ).toBe("ability is unknown");
  });

  it("infers Friend Guard only from the other active defending partner", () => {
    const target = member("fast", "own");
    const guard = {
      ...member("slow", "own"),
      abilityId: "friendguard",
    };
    expect(friendGuardPartner(data, [target, guard], target)?.id).toBe("slow");
    expect(friendGuardPartner(data, [target], target)).toBeNull();
  });

  it("uses a legal Mega relation's locked ability instead of requiring a base ability", () => {
    expect(
      unavailableBuildReason(data, {
        ...member("fast", "own"),
        abilityId: null,
        itemId: "fastite",
        mega: true,
      }),
    ).toBe("");
  });
});
