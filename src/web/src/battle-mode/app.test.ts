import { describe, expect, it } from "vitest";
import type { CalculatorData, Form } from "../damage-calculator/contracts";
import {
  availableOpponentForms,
  calculationField,
  deriveSpeedOrder,
  formatBattleDamage,
  spreadContext,
  stagedStatValue,
  unavailableOpponentItemIds,
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
  it("shows authoritative staged stats without changing the stored base stat", () => {
    const base = 172;
    expect(stagedStatValue(base, 0)).toBe(172);
    expect(stagedStatValue(base, 1)).toBe(258);
    expect(stagedStatValue(base, -1)).toBe(114);
    expect(base).toBe(172);
  });

  it("excludes every form of a species already on the opponent roster", () => {
    const options = availableOpponentForms(data, new Set(["fast-species"]), {
      fast: "fast-species",
      twin: "fast-species",
      slow: "slow-species",
    });
    expect(options.map(({ id }) => id)).toEqual(["slow"]);
  });

  it("excludes held items from other opponents but retains the current member's item", () => {
    const current = { ...member("fast", "opponent"), itemId: "fastite" };
    const other = { ...member("slow", "opponent"), itemId: "other-item" };
    expect(unavailableOpponentItemIds([current, other], current.id)).toEqual(
      new Set(["other-item"]),
    );
  });

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

  it("maps only the defending side's explicit Friend Guard toggle", () => {
    const field = emptyBattleState().field;
    field.own.friendGuard = true;
    field.opponent.friendGuard = false;
    expect(calculationField(field, "own", true).defender.friendGuard).toBe(
      false,
    );
    expect(calculationField(field, "opponent", true).defender.friendGuard).toBe(
      true,
    );
  });

  it("maps Helping Hand only from the attacking side", () => {
    const field = emptyBattleState().field;
    field.own.helpingHand = true;
    field.opponent.helpingHand = false;
    expect(calculationField(field, "own", true).attacker.helpingHand).toBe(
      true,
    );
    expect(calculationField(field, "opponent", true).attacker.helpingHand).toBe(
      false,
    );

    field.own.helpingHand = false;
    field.opponent.helpingHand = true;
    expect(calculationField(field, "own", true).attacker.helpingHand).toBe(
      false,
    );
    expect(calculationField(field, "opponent", true).attacker.helpingHand).toBe(
      true,
    );
  });

  it("maps the resolved Single Target value only for the current attack", () => {
    const field = emptyBattleState().field;
    field.own.singleTarget = true;
    field.opponent.singleTarget = false;
    expect(calculationField(field, "own", true).attacker.singleTarget).toBe(
      true,
    );
    expect(
      calculationField(field, "opponent", false).attacker.singleTarget,
    ).toBe(false);
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
    expect(normal.groups[0]?.map(({ result }) => result.value)).toEqual([
      120, 120,
    ]);
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
