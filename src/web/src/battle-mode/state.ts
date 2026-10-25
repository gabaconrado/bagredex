import type { Stats } from "../damage-calculator/contracts";

export type BattleSide = "own" | "opponent";
export type StageId = "atk" | "def" | "spa" | "spd" | "spe";
export type Stages = Record<StageId, number>;
export type BattleMember = {
  id: string;
  side: BattleSide;
  formId: string;
  baseSpeciesId: string;
  label: string;
  gender: "M" | "F" | "N";
  abilityId: string | null;
  itemId: string | null;
  natureId: string;
  moveIds: (string | null)[];
  sp: Stats;
  status: string;
  stages: Stages;
  hp: number;
  mega: boolean;
  shiny: boolean;
};
export type SideField = {
  tailwind: boolean;
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
};
export type BattleField = {
  weather: string;
  terrain: string;
  trickRoom: boolean;
  own: SideField;
  opponent: SideField;
};
export type BattleState = {
  started: boolean;
  members: BattleMember[];
  board: Record<BattleSide, [string | null, string | null]>;
  placementId: string | null;
  attackerId: string | null;
  singleTargetOverride: boolean;
  field: BattleField;
};

export const zeroStages = (): Stages => ({
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
});
const sideField = (): SideField => ({
  tailwind: false,
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
});
export const emptyBattleState = (): BattleState => ({
  started: false,
  members: [],
  board: { own: [null, null], opponent: [null, null] },
  placementId: null,
  attackerId: null,
  singleTargetOverride: false,
  field: {
    weather: "",
    terrain: "",
    trickRoom: false,
    own: sideField(),
    opponent: sideField(),
  },
});

export type BattleAction =
  | { type: "start"; members: BattleMember[] }
  | { type: "start-over" }
  | { type: "add"; member: BattleMember }
  | { type: "remove"; id: string }
  | { type: "bench"; id: string }
  | { type: "select"; id: string }
  | { type: "place"; side: BattleSide; slot: 0 | 1 }
  | { type: "update"; id: string; patch: Partial<BattleMember> }
  | { type: "field"; field: BattleField }
  | { type: "single-target"; value: boolean };

const boardWithout = (
  board: BattleState["board"],
  id: string,
): BattleState["board"] => ({
  own: board.own.map((value) => (value === id ? null : value)) as [
    string | null,
    string | null,
  ],
  opponent: board.opponent.map((value) => (value === id ? null : value)) as [
    string | null,
    string | null,
  ],
});
const clearStages = (members: BattleMember[], id: string | null) =>
  id
    ? members.map((member) =>
        member.id === id ? { ...member, stages: zeroStages() } : member,
      )
    : members;

export function battleReducer(
  state: BattleState,
  action: BattleAction,
): BattleState {
  if (action.type === "start")
    return { ...emptyBattleState(), started: true, members: action.members };
  if (action.type === "start-over") return emptyBattleState();
  if (action.type === "add")
    return { ...state, members: [...state.members, action.member] };
  if (action.type === "update")
    return {
      ...state,
      members: state.members.map((member) =>
        member.id === action.id ? { ...member, ...action.patch } : member,
      ),
    };
  if (action.type === "field") return { ...state, field: action.field };
  if (action.type === "single-target")
    return { ...state, singleTargetOverride: action.value };
  if (action.type === "select") {
    const member = state.members.find(({ id }) => id === action.id);
    if (!member) return state;
    const active = state.board[member.side].includes(member.id);
    return active
      ? {
          ...state,
          attackerId: member.id,
          placementId: null,
          singleTargetOverride: false,
        }
      : { ...state, placementId: member.id };
  }
  if (action.type === "remove") {
    const board = boardWithout(state.board, action.id);
    return {
      ...state,
      members: state.members.filter(({ id }) => id !== action.id),
      board,
      placementId: state.placementId === action.id ? null : state.placementId,
      attackerId: state.attackerId === action.id ? null : state.attackerId,
      singleTargetOverride: false,
    };
  }
  if (action.type === "bench") {
    const member = state.members.find(({ id }) => id === action.id);
    if (!member || !state.board[member.side].includes(action.id)) return state;
    return {
      ...state,
      members: clearStages(state.members, action.id),
      board: boardWithout(state.board, action.id),
      placementId: state.placementId === action.id ? null : state.placementId,
      attackerId: state.attackerId === action.id ? null : state.attackerId,
      singleTargetOverride: false,
    };
  }
  if (action.type === "place") {
    const member = state.members.find(({ id }) => id === state.placementId);
    if (!member || member.side !== action.side) return state;
    const previous = state.board[action.side][action.slot];
    const without = boardWithout(state.board, member.id);
    const nextSide = [...without[action.side]] as [
      string | null,
      string | null,
    ];
    nextSide[action.slot] = member.id;
    return {
      ...state,
      members: clearStages(state.members, previous),
      board: { ...without, [action.side]: nextSide },
      placementId: null,
      attackerId: member.id,
      singleTargetOverride: false,
    };
  }
  return state;
}

export const opponentCurrentHp = (maximum: number, percentage: number) =>
  Math.max(
    1,
    Math.floor((maximum * Math.max(1, Math.min(100, percentage))) / 100),
  );
