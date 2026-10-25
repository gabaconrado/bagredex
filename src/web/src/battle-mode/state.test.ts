import { describe, expect, it } from "vitest";
import {
  battleReducer,
  emptyBattleState,
  hasBattleProgress,
  opponentCurrentHp,
  zeroStages,
  type BattleMember,
} from "./state";

const member = (id: string, side: "own" | "opponent"): BattleMember => ({
  id,
  side,
  formId: id,
  baseSpeciesId: id,
  label: id,
  gender: "N",
  abilityId: null,
  itemId: null,
  natureId: "serious",
  moveIds: [null, null, null, null],
  sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  status: "par",
  stages: { ...zeroStages(), spe: 2 },
  hp: side === "own" ? 100 : 50,
  mega: false,
  shiny: false,
});

const selectAndPlace = (
  state: ReturnType<typeof emptyBattleState>,
  id: string,
  side: "own" | "opponent",
  slot: 0 | 1,
) =>
  battleReducer(battleReducer(state, { type: "select", id }), {
    type: "place",
    side,
    slot,
  });

describe("Battle Mode state", () => {
  it("installs teams atomically and detects only meaningful progress", () => {
    const installed = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team-one",
      members: [member("ally", "own")],
    });
    expect(installed.currentTeamId).toBe("team-one");
    expect(hasBattleProgress(installed)).toBe(false);
    expect(
      hasBattleProgress(
        battleReducer(installed, {
          type: "field",
          field: {
            ...installed.field,
            own: { ...installed.field.own, friendGuard: true },
          },
        }),
      ),
    ).toBe(true);
    const replacement = battleReducer(installed, {
      type: "install-team",
      teamId: "team-two",
      members: [member("replacement", "own")],
    });
    expect(replacement).toMatchObject({
      currentTeamId: "team-two",
      board: { own: [null, null], opponent: [null, null] },
      field: {
        own: {
          friendGuard: false,
          helpingHand: false,
          singleTarget: false,
        },
        opponent: {
          friendGuard: false,
          helpingHand: false,
          singleTarget: false,
        },
      },
    });
    expect(hasBattleProgress(replacement)).toBe(false);
  });

  it("ignores battle mutations until a team is installed", () => {
    const empty = emptyBattleState();
    expect(
      battleReducer(empty, { type: "add", member: member("foe", "opponent") }),
    ).toBe(empty);
  });

  it("clears only stages when an occupied slot benches a member", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team",
      members: [member("first", "own"), member("second", "own")],
    });
    state = selectAndPlace(state, "first", "own", 0);
    state = selectAndPlace(state, "second", "own", 0);
    const benched = state.members.find(({ id }) => id === "first")!;
    expect(benched.stages).toEqual(zeroStages());
    expect(benched.status).toBe("par");
    expect(benched.hp).toBe(100);
  });

  it("keeps Single Target independent by attacking side", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team",
      members: [member("ally", "own"), member("foe", "opponent")],
    });
    state = battleReducer(state, {
      type: "field",
      field: {
        ...state.field,
        own: { ...state.field.own, singleTarget: true },
      },
    });
    expect(state.field.own.singleTarget).toBe(true);
    expect(state.field.opponent.singleTarget).toBe(false);
  });

  it("removes an active opponent and clamps percentage HP deterministically", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team",
      members: [member("foe", "opponent")],
    });
    state = selectAndPlace(state, "foe", "opponent", 0);
    state = battleReducer(state, { type: "remove", id: "foe" });
    expect(state.board.opponent).toEqual([null, null]);
    expect(opponentCurrentHp(151, 50)).toBe(75);
    expect(opponentCurrentHp(1, 1)).toBe(1);
  });

  it("keeps field state while switching", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team",
      members: [member("first", "own"), member("second", "own")],
    });
    state = battleReducer(state, {
      type: "field",
      field: {
        ...state.field,
        weather: "rain",
        trickRoom: true,
        own: {
          ...state.field.own,
          tailwind: true,
          helpingHand: true,
          singleTarget: true,
        },
      },
    });
    state = selectAndPlace(state, "first", "own", 0);
    state = selectAndPlace(state, "second", "own", 0);
    expect(state.field).toMatchObject({
      weather: "rain",
      trickRoom: true,
      own: { tailwind: true, helpingHand: true, singleTarget: true },
    });
  });

  it("resets both Helping Hand toggles when installing another team", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team-one",
      members: [member("first", "own")],
    });
    state = battleReducer(state, {
      type: "field",
      field: {
        ...state.field,
        own: { ...state.field.own, helpingHand: true },
        opponent: { ...state.field.opponent, helpingHand: true },
      },
    });

    state = battleReducer(state, {
      type: "install-team",
      teamId: "team-two",
      members: [member("second", "own")],
    });

    expect(state.field.own.helpingHand).toBe(false);
    expect(state.field.opponent.helpingHand).toBe(false);
  });

  it("benches either side with persistent knowledge and cleared stages", () => {
    const own = { ...member("ally", "own"), hp: 71, mega: true };
    const foe = {
      ...member("foe", "opponent"),
      hp: 43,
      itemId: "known-item",
      moveIds: ["known-move", null, null, null],
    };
    let state = battleReducer(emptyBattleState(), {
      type: "install-team",
      teamId: "team",
      members: [own, foe],
    });
    state = selectAndPlace(state, "ally", "own", 0);
    state = selectAndPlace(state, "foe", "opponent", 0);
    state = battleReducer(state, { type: "select", id: "ally" });
    state = battleReducer(state, { type: "bench", id: "foe" });
    expect(state.board.opponent).toEqual([null, null]);
    expect(state.members.find(({ id }) => id === "foe")).toMatchObject({
      hp: 43,
      status: "par",
      itemId: "known-item",
      moveIds: ["known-move", null, null, null],
      stages: zeroStages(),
    });

    state = selectAndPlace(state, "foe", "opponent", 1);
    expect(state.board.opponent).toEqual([null, "foe"]);
    state = battleReducer(state, { type: "select", id: "ally" });
    state = battleReducer(state, { type: "bench", id: "ally" });
    expect(state.board.own).toEqual([null, null]);
    expect(state.attackerId).toBeNull();
    expect(state.members.find(({ id }) => id === "ally")).toMatchObject({
      hp: 71,
      status: "par",
      mega: true,
      stages: zeroStages(),
    });
  });
});
