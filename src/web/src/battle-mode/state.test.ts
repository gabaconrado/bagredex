import { describe, expect, it } from "vitest";
import {
  battleReducer,
  emptyBattleState,
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
  it("clears only stages when an occupied slot benches a member", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "start",
      members: [member("first", "own"), member("second", "own")],
    });
    state = selectAndPlace(state, "first", "own", 0);
    state = selectAndPlace(state, "second", "own", 0);
    const benched = state.members.find(({ id }) => id === "first")!;
    expect(benched.stages).toEqual(zeroStages());
    expect(benched.status).toBe("par");
    expect(benched.hp).toBe(100);
  });

  it("resets the transient spread override on attacker and board changes", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "start",
      members: [member("ally", "own"), member("foe", "opponent")],
    });
    state = selectAndPlace(state, "ally", "own", 0);
    state = battleReducer(state, { type: "single-target", value: true });
    state = selectAndPlace(state, "foe", "opponent", 0);
    expect(state.singleTargetOverride).toBe(false);
    state = battleReducer(state, { type: "single-target", value: true });
    state = battleReducer(state, { type: "select", id: "ally" });
    expect(state.singleTargetOverride).toBe(false);
  });

  it("removes an active opponent and clamps percentage HP deterministically", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "start",
      members: [member("foe", "opponent")],
    });
    state = selectAndPlace(state, "foe", "opponent", 0);
    state = battleReducer(state, { type: "remove", id: "foe" });
    expect(state.board.opponent).toEqual([null, null]);
    expect(opponentCurrentHp(151, 50)).toBe(75);
    expect(opponentCurrentHp(1, 1)).toBe(1);
  });

  it("keeps field state while switching and resets override on replacement", () => {
    let state = battleReducer(emptyBattleState(), {
      type: "start",
      members: [member("first", "own"), member("second", "own")],
    });
    state = battleReducer(state, {
      type: "field",
      field: {
        ...state.field,
        weather: "rain",
        trickRoom: true,
        own: { ...state.field.own, tailwind: true },
      },
    });
    state = selectAndPlace(state, "first", "own", 0);
    state = battleReducer(state, { type: "single-target", value: true });
    state = selectAndPlace(state, "second", "own", 0);
    expect(state.field).toMatchObject({
      weather: "rain",
      trickRoom: true,
      own: { tailwind: true },
    });
    expect(state.singleTargetOverride).toBe(false);
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
      type: "start",
      members: [own, foe],
    });
    state = selectAndPlace(state, "ally", "own", 0);
    state = selectAndPlace(state, "foe", "opponent", 0);
    state = battleReducer(state, { type: "select", id: "ally" });
    state = battleReducer(state, { type: "single-target", value: true });
    state = battleReducer(state, { type: "bench", id: "foe" });
    expect(state.board.opponent).toEqual([null, null]);
    expect(state.singleTargetOverride).toBe(false);
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
