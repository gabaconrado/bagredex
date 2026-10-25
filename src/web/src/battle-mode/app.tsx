import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "preact/hooks";
import type {
  Ability,
  CalculatorData,
  Form,
  Item,
  Move,
  Nature,
  StatId,
  Stats,
} from "../damage-calculator/contracts";
import { parseCalculatorData } from "../damage-calculator/contracts";
import {
  calculate,
  effectiveSpeedWithEvidence,
  stats,
  type Combatant,
  type Field,
} from "../damage-calculator/engine/calculate";
import { parseProblem, parseTeam, type Team } from "../team-builder/contracts";
import type { BattleBootstrap } from "./contracts";
import {
  battleReducer,
  emptyBattleState,
  opponentCurrentHp,
  zeroStages,
  type BattleField,
  type BattleMember,
  type BattleSide,
  type StageId,
} from "./state";

const zeroStats = (): Stats => ({
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
});
const statIds: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const stageIds: StageId[] = ["atk", "def", "spa", "spd", "spe"];
const statLabels: Record<StatId, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};
const title = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
const statusLabels: Record<string, string> = {
  brn: "Burn",
  par: "Paralysis",
  psn: "Poison",
  slp: "Sleep",
  frz: "Freeze",
  tox: "Bad poison",
};
const indexes = (data: CalculatorData) => ({
  forms: new Map(data.forms.map((row) => [row.id, row])),
  abilities: new Map(data.abilities.map((row) => [row.id, row])),
  items: new Map(data.items.map((row) => [row.id, row])),
  moves: new Map(data.moves.map((row) => [row.id, row])),
  natures: new Map(data.natures.map((row) => [row.id, row])),
});
const defaults = (
  descriptors: { key: string; default: boolean | number | string }[],
) =>
  Object.fromEntries(
    descriptors.map(({ key, default: value }) => [key, value]),
  );

function displayForm(data: CalculatorData, member: BattleMember) {
  if (member.mega) {
    const relation = data.mega_item_relations.find(
      ({ base_form_id, item_id }) =>
        base_form_id === member.formId && item_id === member.itemId,
    );
    if (relation)
      return data.forms.find(({ id }) => id === relation.mega_form_id);
  }
  return data.forms.find(({ id }) => id === member.formId);
}
function effectiveAbilityId(data: CalculatorData, member: BattleMember) {
  if (member.mega) {
    const relation = data.mega_item_relations.find(
      ({ base_form_id, item_id }) =>
        base_form_id === member.formId && item_id === member.itemId,
    );
    if (relation) return relation.locked_ability_id;
  }
  return member.abilityId;
}
export function unavailableBuildReason(
  data: CalculatorData,
  member: BattleMember,
) {
  if (!displayForm(data, member)) return "Pokémon form is unavailable";
  if (!data.natures.some(({ id }) => id === member.natureId))
    return "nature is unknown";
  if (!effectiveAbilityId(data, member)) return "ability is unknown";
  return "";
}
function combatant(
  data: CalculatorData,
  member: BattleMember,
): Combatant | null {
  const lookup = indexes(data);
  if (unavailableBuildReason(data, member)) return null;
  const form = displayForm(data, member);
  const nature = lookup.natures.get(member.natureId);
  if (!form || !nature) return null;
  const ability = lookup.abilities.get(effectiveAbilityId(data, member) ?? "");
  const item = lookup.items.get(member.itemId ?? "");
  const hpMax = stats({ form, nature, sp: member.sp }).hp;
  return {
    form,
    gender: member.gender,
    nature,
    ability,
    item,
    sp: member.sp,
    stages: member.stages,
    status: member.status,
    currentHp:
      member.side === "own"
        ? Math.max(1, Math.min(hpMax, member.hp))
        : opponentCurrentHp(hpMax, member.hp),
    context: {
      ...defaults(ability?.contextual_inputs ?? []),
      ...defaults(item?.contextual_inputs ?? []),
    },
  };
}
const sprite = (data: CalculatorData, member: BattleMember) => {
  const form = displayForm(data, member);
  return form
    ? data.sprite_url_template
        .replace("__FORM__", form.sprite_form_id)
        .replace("__VARIANT__", member.shiny ? "shiny" : "normal")
        .replace("{sprite_form_id}", form.sprite_form_id)
    : "";
};

function validateTeam(
  team: Team,
  bootstrap: BattleBootstrap,
  data: CalculatorData,
) {
  if (
    team.data_version !== bootstrap.active_version ||
    team.regulation.id !== bootstrap.regulation.id
  )
    throw new Error("That team no longer matches this Battle Mode regulation.");
  const lookup = indexes(data);
  const positions = new Set<number>();
  for (const member of team.members) {
    const form = lookup.forms.get(member.form_id);
    if (positions.has(member.position) || !form)
      throw new Error("That team contains unavailable Pokémon data.");
    positions.add(member.position);
    if (
      member.nature_id &&
      member.nature_id !== "null" &&
      !lookup.natures.has(member.nature_id)
    )
      throw new Error("That team contains an unavailable nature.");
    if (
      member.ability_id &&
      (!lookup.abilities.has(member.ability_id) ||
        !form.abilities.some(({ id }) => id === member.ability_id))
    )
      throw new Error("That team contains an unavailable ability.");
    if (member.item_id && !lookup.items.has(member.item_id))
      throw new Error("That team contains an unavailable item.");
    if (
      member.move_ids.some(
        (id) => id && (!lookup.moves.has(id) || !form.move_ids.includes(id)),
      )
    )
      throw new Error("That team contains an unavailable move.");
  }
}

function ownMembers(
  team: Team,
  data: CalculatorData,
  bootstrap: BattleBootstrap,
) {
  const hpNature =
    data.natures.find(({ id }) => id === "serious") ?? data.natures[0]!;
  return team.members.map((member) => {
    const form = data.forms.find(({ id }) => id === member.form_id)!;
    const nature = data.natures.find(({ id }) => id === member.nature_id);
    const maximum = stats({
      form,
      nature: nature ?? hpNature,
      sp: member.sp,
    }).hp;
    return {
      id: `own-${member.position}`,
      side: "own" as const,
      formId: member.form_id,
      baseSpeciesId:
        bootstrap.base_species_by_form[member.form_id] ?? member.form_id,
      label: member.nickname || form.name,
      gender: form.default_gender,
      abilityId: member.ability_id,
      itemId: member.item_id,
      natureId: nature?.id ?? "",
      moveIds: member.move_ids,
      sp: member.sp,
      status: "",
      stages: zeroStages(),
      hp: maximum,
      mega: false,
      shiny: member.shiny,
    };
  });
}

function calculationField(
  state: BattleField,
  attackerSide: BattleSide,
  singleTarget: boolean,
  friendGuard: boolean,
): Field {
  const defenderSide = attackerSide === "own" ? "opponent" : "own";
  return {
    weather: state.weather,
    terrain: state.terrain,
    attacker: {
      helpingHand: false,
      singleTarget,
      critical: false,
      tailwind: state[attackerSide].tailwind,
    },
    defender: {
      ...state[defenderSide],
      friendGuard,
      tailwind: state[defenderSide].tailwind,
    },
  };
}

export function spreadContext(targetCount: number, override: boolean) {
  const singleTarget = override || targetCount < 2;
  return {
    singleTarget,
    multiplier: singleTarget ? 1 : 0.75,
    source: override
      ? "override"
      : targetCount < 2
        ? "automatic-one"
        : "automatic-spread",
  } as const;
}

export function formatBattleDamage(
  targetSide: BattleSide,
  rolls: number[],
  maximumHp: number,
) {
  const low = rolls[0] ?? 0;
  const high = rolls.at(-1) ?? 0;
  return targetSide === "opponent"
    ? `${(Math.floor((low * 1000) / maximumHp) / 10).toFixed(1)}–${(Math.floor((high * 1000) / maximumHp) / 10).toFixed(1)}%`
    : `${low}–${high} HP`;
}

export function friendGuardPartner(
  data: CalculatorData,
  targets: BattleMember[],
  target: BattleMember,
) {
  return (
    targets.find(
      (candidate) =>
        candidate.id !== target.id &&
        effectiveAbilityId(data, candidate) === "friendguard",
    ) ?? null
  );
}

function Selection({
  bootstrap,
  selected,
  loading,
  error,
  onSelect,
  onStart,
}: {
  bootstrap: BattleBootstrap;
  selected: string;
  loading: boolean;
  error: string;
  onSelect: (id: string) => void;
  onStart: () => void;
}) {
  return (
    <section class="battle-selection" aria-labelledby="battle-title">
      <p class="eyebrow">Live VGC reference</p>
      <h1 id="battle-title">Battle Mode</h1>
      <p>
        Choose the saved team you are bringing. The battle stays only in this
        tab.
      </p>
      {bootstrap.teams.length ? (
        <>
          <div
            class="battle-team-grid"
            role="radiogroup"
            aria-label="Saved teams"
          >
            {bootstrap.teams.map((team) => (
              <button
                type="button"
                role="radio"
                aria-checked={selected === team.id}
                class={`battle-team${selected === team.id ? " is-selected" : ""}`}
                onClick={() => onSelect(team.id)}
              >
                <strong>{team.name}</strong>
                <span>{team.members.length} Pokémon</span>
                <span class="battle-team__sprites" aria-hidden="true">
                  {team.members.map((member) => (
                    <img src={member.sprite_url} alt="" />
                  ))}
                </span>
              </button>
            ))}
          </div>
          {error && (
            <p class="battle-error" role="alert">
              {error}
            </p>
          )}
          <button
            class="button"
            type="button"
            disabled={!selected || loading}
            onClick={onStart}
          >
            {loading ? "Loading team…" : "Start battle"}
          </button>
        </>
      ) : (
        <div class="battle-empty">
          <p>
            No compatible saved teams are available for{" "}
            {bootstrap.regulation.name}.
          </p>
          <a class="button" href={bootstrap.team_builder_url}>
            Create a team
          </a>
        </div>
      )}
    </section>
  );
}

function Roster({
  side,
  members,
  active,
  placementId,
  attackerId,
  data,
  onSelect,
  onRemove,
}: {
  side: BattleSide;
  members: BattleMember[];
  active: (string | null)[];
  placementId: string | null;
  attackerId: string | null;
  data: CalculatorData;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div class="battle-roster" role="list">
      {members.map((member) => (
        <div class="battle-roster__row" role="listitem" key={member.id}>
          <button
            type="button"
            class={`battle-roster__member${placementId === member.id ? " is-selected" : ""}${attackerId === member.id ? " is-attacker" : ""}`}
            aria-pressed={placementId === member.id || attackerId === member.id}
            onClick={() => onSelect(member.id)}
          >
            <img src={sprite(data, member)} alt="" />
            <span>
              <strong>{member.label}</strong>
              <small>{active.includes(member.id) ? "Active" : "Bench"}</small>
            </span>
          </button>
          {side === "opponent" && onRemove && (
            <button
              type="button"
              class="battle-icon-button"
              aria-label={`Remove ${member.label}`}
              onClick={() => onRemove(member.id)}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function OpponentEntry({
  data,
  disabled,
  onAdd,
}: {
  data: CalculatorData;
  disabled: boolean;
  onAdd: (form: Form) => string | null;
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const options = data.forms.filter(
    ({ searchable, is_mega }) => searchable && !is_mega,
  );
  const commit = () => {
    const normalized = value.trim().toLocaleLowerCase();
    const form = options.find(
      ({ id, name }) =>
        id.toLocaleLowerCase() === normalized ||
        name.toLocaleLowerCase() === normalized,
    );
    if (!form) {
      setMessage("Choose a legal Pokémon from the suggestions.");
      return;
    }
    const error = onAdd(form);
    if (error) setMessage(error);
    else {
      setValue("");
      setMessage(`${form.name} added.`);
      requestAnimationFrame(() => input.current?.focus());
    }
  };
  return (
    <div class="battle-opponent-entry">
      <label for="battle-opponent-pokemon">Add opponent Pokémon</label>
      <div>
        <input
          ref={input}
          id="battle-opponent-pokemon"
          list="battle-opponent-options"
          value={value}
          disabled={disabled}
          onInput={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" disabled={disabled || !value} onClick={commit}>
          Add
        </button>
      </div>
      <datalist id="battle-opponent-options">
        {options.map((form) => (
          <option value={form.name} />
        ))}
      </datalist>
      <small role="status">{message}</small>
    </div>
  );
}

function BoardSlot({
  side,
  slot,
  member,
  canPlace,
  data,
  onPlace,
  onSelect,
  onBench,
}: {
  side: BattleSide;
  slot: 0 | 1;
  member?: BattleMember;
  canPlace: boolean;
  data: CalculatorData;
  onPlace: () => void;
  onSelect: () => void;
  onBench: () => void;
}) {
  return (
    <div class="battle-slot-wrap">
      <button
        type="button"
        class={`battle-slot${member ? " is-filled" : ""}`}
        aria-label={`${side === "own" ? "Your" : "Opponent"} active slot ${slot + 1}${member ? `, ${member.label}` : ", empty"}`}
        onClick={member && !canPlace ? onSelect : onPlace}
      >
        {member ? (
          <>
            <img src={sprite(data, member)} alt="" />
            <strong>{member.label}</strong>
          </>
        ) : (
          <span>{canPlace ? "Place here" : "Empty"}</span>
        )}
      </button>
      {member && (
        <button
          type="button"
          class="battle-bench"
          onClick={onBench}
          aria-label={`Bench ${member.label}`}
        >
          Bench
        </button>
      )}
    </div>
  );
}

function MemberEditor({
  member,
  data,
  onChange,
}: {
  member: BattleMember;
  data: CalculatorData;
  onChange: (patch: Partial<BattleMember>) => void;
}) {
  const form = data.forms.find(({ id }) => id === member.formId)!;
  const shown = displayForm(data, member) ?? form;
  const nature = data.natures.find(({ id }) => id === member.natureId);
  const hpNature =
    nature ??
    data.natures.find(({ id }) => id === "serious") ??
    data.natures[0]!;
  const maximum = stats({ form: shown, nature: hpNature, sp: member.sp }).hp;
  const unavailable = unavailableBuildReason(data, member);
  const legalAbilityIds = form.abilities.map(({ id }) => id);
  const relation = data.mega_item_relations.find(
    ({ base_form_id, item_id }) =>
      base_form_id === member.formId && item_id === member.itemId,
  );
  const setMove = (index: number, value: string) => {
    const moveIds = [...member.moveIds];
    moveIds[index] = value || null;
    onChange({ moveIds });
  };
  return (
    <section class="battle-editor" aria-labelledby={`editor-${member.id}`}>
      <header>
        <img src={sprite(data, member)} alt="" />
        <div>
          <p class="eyebrow">
            Active {member.side === "own" ? "ally" : "opponent"}
          </p>
          <h3 id={`editor-${member.id}`}>{member.label}</h3>
        </div>
      </header>
      {unavailable && member.side === "own" && (
        <p class="battle-error" role="status">
          Calculations unavailable: {unavailable}. Complete this member in Team
          Builder.
        </p>
      )}
      <div class="battle-editor__battle-state">
        <label>
          Current HP
          <span class="battle-range">
            <input
              type="range"
              min="1"
              max={member.side === "own" ? maximum : 100}
              value={member.hp}
              onInput={(e) => onChange({ hp: Number(e.currentTarget.value) })}
            />
            <output>
              {member.hp}
              {member.side === "opponent" ? "%" : ` / ${maximum}`}
            </output>
          </span>
        </label>
        <label>
          Status
          <select
            value={member.status}
            onChange={(e) => onChange({ status: e.currentTarget.value })}
          >
            <option value="">None</option>
            {data.capability.status_values.filter(Boolean).map((status) => (
              <option value={status}>
                {statusLabels[status] ?? title(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset class="battle-stages">
        <legend>Stat stages</legend>
        {stageIds.map((id) => (
          <label>
            {statLabels[id]}
            <input
              type="number"
              min="-6"
              max="6"
              value={member.stages[id]}
              onInput={(e) =>
                onChange({
                  stages: {
                    ...member.stages,
                    [id]: Math.max(
                      -6,
                      Math.min(6, Number(e.currentTarget.value)),
                    ),
                  },
                })
              }
            />
          </label>
        ))}
      </fieldset>
      {member.side === "opponent" ? (
        <details class="battle-set-editor" open>
          <summary>Observed set</summary>
          <div class="battle-choice-grid">
            <label>
              Ability
              <select
                value={member.abilityId ?? ""}
                onChange={(e) =>
                  onChange({ abilityId: e.currentTarget.value || null })
                }
              >
                {data.abilities
                  .filter(({ id }) => legalAbilityIds.includes(id))
                  .map((ability) => (
                    <option value={ability.id}>{ability.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Item
              <select
                value={member.itemId ?? ""}
                onChange={(e) =>
                  onChange({
                    itemId: e.currentTarget.value || null,
                    mega: false,
                  })
                }
              >
                <option value="">No item</option>
                {data.items.map((item) => (
                  <option value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Nature
              <select
                value={member.natureId}
                onChange={(e) => onChange({ natureId: e.currentTarget.value })}
              >
                {data.natures.map((choice) => (
                  <option value={choice.id}>{choice.name}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset class="battle-sp">
            <legend>Stat points</legend>
            {statIds.map((id) => (
              <label>
                {statLabels[id]}
                <input
                  type="number"
                  min="0"
                  max="32"
                  value={member.sp[id]}
                  onInput={(e) =>
                    onChange({
                      sp: {
                        ...member.sp,
                        [id]: Math.max(
                          0,
                          Math.min(32, Number(e.currentTarget.value)),
                        ),
                      },
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          <fieldset class="battle-moves">
            <legend>Moves</legend>
            {member.moveIds.map((moveId, index) => (
              <label>
                Move {index + 1}
                <select
                  value={moveId ?? ""}
                  onChange={(e) => setMove(index, e.currentTarget.value)}
                >
                  <option value="">Unknown</option>
                  {data.moves
                    .filter(
                      ({ id }) =>
                        form.move_ids.includes(id) &&
                        (!member.moveIds.includes(id) || id === moveId),
                    )
                    .map((move) => (
                      <option value={move.id}>{move.name}</option>
                    ))}
                </select>
              </label>
            ))}
          </fieldset>
          {relation && (
            <button
              type="button"
              class="battle-toggle"
              aria-pressed={member.mega}
              onClick={() => onChange({ mega: !member.mega })}
            >
              {member.mega ? "Mega active" : "Mega evolve"}
            </button>
          )}
        </details>
      ) : relation ? (
        <button
          type="button"
          class="battle-toggle"
          aria-pressed={member.mega}
          onClick={() => onChange({ mega: !member.mega })}
        >
          {member.mega ? "Mega active" : "Mega evolve"}
        </button>
      ) : null}
      {member.side === "own" && (
        <div class="battle-known-moves" aria-label="Known moves">
          {member.moveIds.map((id) => (
            <span>
              {data.moves.find((move) => move.id === id)?.name ?? "Empty move"}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function FieldControls({
  value,
  onChange,
}: {
  value: BattleField;
  onChange: (value: BattleField) => void;
}) {
  const groups = {
    weather: ["sun", "rain", "sand", "snow"],
    terrain: ["electric", "grassy", "psychic", "misty"],
  } as const;
  return (
    <section class="battle-field">
      <h2>Field effects</h2>
      {Object.entries(groups).map(([group, choices]) => (
        <fieldset>
          <legend>{title(group)}</legend>
          <div class="battle-toggle-grid">
            {choices.map((choice) => (
              <button
                type="button"
                aria-pressed={value[group as "weather" | "terrain"] === choice}
                onClick={() =>
                  onChange({
                    ...value,
                    [group]:
                      value[group as "weather" | "terrain"] === choice
                        ? ""
                        : choice,
                  })
                }
              >
                {title(choice)}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        class="battle-toggle"
        aria-pressed={value.trickRoom}
        onClick={() => onChange({ ...value, trickRoom: !value.trickRoom })}
      >
        Trick Room
      </button>
      {(["own", "opponent"] as BattleSide[]).map((side) => (
        <fieldset>
          <legend>{side === "own" ? "Your side" : "Opponent side"}</legend>
          <div class="battle-toggle-grid">
            {(
              ["tailwind", "reflect", "lightScreen", "auroraVeil"] as const
            ).map((effect) => (
              <button
                type="button"
                aria-pressed={value[side][effect]}
                onClick={() =>
                  onChange({
                    ...value,
                    [side]: { ...value[side], [effect]: !value[side][effect] },
                  })
                }
              >
                {title(effect)}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </section>
  );
}

function Results({
  data,
  members,
  board,
  attackerId,
  field,
  override,
  onOverride,
}: {
  data: CalculatorData;
  members: BattleMember[];
  board: Record<BattleSide, [string | null, string | null]>;
  attackerId: string | null;
  field: BattleField;
  override: boolean;
  onOverride: (value: boolean) => void;
}) {
  const lookup = indexes(data);
  const attacker = members.find(({ id }) => id === attackerId);
  const attackerCombatant = attacker ? combatant(data, attacker) : null;
  const defendingSide: BattleSide =
    attacker?.side === "own" ? "opponent" : "own";
  const targets = board[defendingSide]
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as BattleMember[];
  const spread = spreadContext(targets.length, override);
  const friend = (target: BattleMember) => {
    return friendGuardPartner(data, targets, target);
  };
  if (!attacker)
    return (
      <section class="battle-results">
        <h2>Damage</h2>
        <p>Select an active Pokémon to see its moves.</p>
      </section>
    );
  if (!attackerCombatant)
    return (
      <section class="battle-results">
        <h2>{attacker.label} damage</h2>
        <p class="battle-error" role="status">
          Calculations unavailable: {unavailableBuildReason(data, attacker)}.
          Complete this member in Team Builder.
        </p>
      </section>
    );
  return (
    <section class="battle-results">
      <header>
        <div>
          <p class="eyebrow">Selected attacker</p>
          <h2>{attacker.label} damage</h2>
        </div>
        <button
          type="button"
          class="battle-toggle"
          aria-pressed={override}
          onClick={() => onOverride(!override)}
        >
          Spread hits one target
        </button>
      </header>
      {!targets.length ? (
        <p>Place an opposing Pokémon on the field to calculate damage.</p>
      ) : (
        <div class="battle-result-grid">
          {attacker.moveIds.map((moveId, moveIndex) => {
            const move = lookup.moves.get(moveId ?? "");
            return (
              <article class="battle-move-result">
                <h3>{move?.name ?? `Move ${moveIndex + 1}`}</h3>
                {!move ? (
                  <p>No move entered.</p>
                ) : (
                  targets.map((target) => {
                    const defender = combatant(data, target);
                    if (!defender)
                      return (
                        <p class="battle-error">
                          {target.label}: calculation unavailable because its{" "}
                          {unavailableBuildReason(data, target)}.
                        </p>
                      );
                    const guard = friend(target);
                    const result = calculate(
                      data,
                      {
                        ...attackerCombatant,
                        context: {
                          ...attackerCombatant.context,
                          ...defaults(move.contextual_inputs),
                        },
                      },
                      defender,
                      move,
                      calculationField(
                        field,
                        attacker.side,
                        spread.singleTarget,
                        Boolean(guard),
                      ),
                    );
                    const maximum = stats(defender).hp;
                    const compact = formatBattleDamage(
                      target.side,
                      result.rolls,
                      maximum,
                    );
                    return (
                      <details>
                        <summary>
                          <span>{target.label}</span>
                          <strong>
                            {result.reason ? "No damage" : compact}
                          </strong>
                        </summary>
                        <p>{result.description}</p>
                        {result.rolls.length > 0 && (
                          <p class="battle-exact-rolls">
                            <strong>Exact rolls:</strong>{" "}
                            {result.rolls.join(", ")}
                          </p>
                        )}
                      </details>
                    );
                  })
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type SpeedOrderRow = {
  member: BattleMember;
  result: ReturnType<typeof effectiveSpeedWithEvidence>;
  stable: number;
};

export function deriveSpeedOrder(
  data: CalculatorData,
  members: BattleMember[],
  board: Record<BattleSide, [string | null, string | null]>,
  field: BattleField,
) {
  const active = ([...board.own, ...board.opponent] as (string | null)[])
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as BattleMember[];
  const unknown = active.filter((member) => !combatant(data, member));
  const rows = active
    .map((member, stable): SpeedOrderRow | null => {
      const fighter = combatant(data, member);
      if (!fighter) return null;
      return {
        member,
        result: effectiveSpeedWithEvidence(
          fighter,
          stats(fighter).spe,
          field.weather,
          field.terrain,
          field[member.side].tailwind,
        ),
        stable,
      };
    })
    .filter(Boolean) as SpeedOrderRow[];
  rows.sort(
    (a, b) =>
      (field.trickRoom
        ? a.result.value - b.result.value
        : b.result.value - a.result.value) || a.stable - b.stable,
  );
  const groups = rows.reduce<SpeedOrderRow[][]>((all, row) => {
    const last = all.at(-1);
    if (last?.[0]?.result.value === row.result.value) last.push(row);
    else all.push([row]);
    return all;
  }, []);
  return { groups, unknown };
}

function TurnOrder({
  data,
  members,
  board,
  field,
}: {
  data: CalculatorData;
  members: BattleMember[];
  board: Record<BattleSide, [string | null, string | null]>;
  field: BattleField;
}) {
  const { groups, unknown } = deriveSpeedOrder(data, members, board, field);
  return (
    <section class="battle-order">
      <h2>
        Turn order <small>Priority ignored</small>
      </h2>
      {groups.length ? (
        <ol>
          {groups.map((group) => (
            <li>
              <span>
                {group.length > 1
                  ? "Speed tie"
                  : `Speed ${group[0]!.result.value}`}
              </span>
              {group.map(({ member }) => (
                <strong>{member.label}</strong>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <p>Place Pokémon to compare Speed.</p>
      )}
      {unknown.map((member) => (
        <p class="battle-error">
          {member.label}: Speed unavailable because its{" "}
          {unavailableBuildReason(data, member)}.
        </p>
      ))}
    </section>
  );
}

function AccountedEffects({
  data,
  members,
  board,
  attackerId,
  field,
  override,
}: {
  data: CalculatorData;
  members: BattleMember[];
  board: Record<BattleSide, [string | null, string | null]>;
  attackerId: string | null;
  field: BattleField;
  override: boolean;
}) {
  const active = ([...board.own, ...board.opponent] as (string | null)[])
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as BattleMember[];
  const attacker = members.find(({ id }) => id === attackerId);
  const opponentCount = attacker
    ? board[attacker.side === "own" ? "opponent" : "own"].filter(Boolean).length
    : 0;
  const facts: string[] = [];
  const speedOrder = deriveSpeedOrder(data, members, board, field);
  if (attacker) {
    const spread = spreadContext(opponentCount, override);
    facts.push(
      spread.source === "override"
        ? "Spread override: one target (manual); spread multiplier 1.00."
        : spread.source === "automatic-spread"
          ? "Spread attacks use the automatic doubles multiplier 0.75."
          : "Moves are automatically treated as single-target; spread multiplier 1.00.",
    );
  }
  if (field.weather)
    facts.push(`${title(field.weather)} weather selected manually.`);
  if (field.terrain)
    facts.push(`${title(field.terrain)} Terrain selected manually.`);
  if (field.trickRoom) facts.push("Trick Room reverses unequal Speed groups.");
  for (const side of ["own", "opponent"] as BattleSide[])
    for (const [key, enabled] of Object.entries(field[side]))
      if (enabled)
        facts.push(
          `${side === "own" ? "Your" : "Opponent"} side: ${title(key)}.`,
        );
  for (const member of active) {
    const fighter = combatant(data, member);
    if (!fighter) {
      facts.push(
        `${member.label}: damage and Speed unavailable because ${unavailableBuildReason(data, member)}.`,
      );
      continue;
    }
    const speed = effectiveSpeedWithEvidence(
      fighter,
      stats(fighter).spe,
      field.weather,
      field.terrain,
      field[member.side].tailwind,
    );
    facts.push(
      `${member.label}: base Speed ${speed.base}; ${speed.modifiers.length ? speed.modifiers.map(({ label }) => label).join(", ") : "no Speed modifiers"}; effective Speed ${speed.value}.`,
    );
    const groupIndex = speedOrder.groups.findIndex((group) =>
      group.some(({ member: grouped }) => grouped.id === member.id),
    );
    const group = speedOrder.groups[groupIndex];
    facts.push(
      `${member.label}: turn-order group ${groupIndex + 1}${
        group && group.length > 1
          ? `, tied with ${group
              .filter(({ member: grouped }) => grouped.id !== member.id)
              .map(({ member: grouped }) => grouped.label)
              .join(", ")}`
          : ""
      }; ${field.trickRoom ? "Trick Room orders slower unequal groups first" : "normal Speed order places faster groups first"}.`,
    );
    if (member.side === "opponent")
      facts.push(
        `${member.label}: ${member.hp}% HP becomes ${fighter.currentHp}/${stats(fighter).hp} HP for mechanics.`,
      );
    if (member.mega)
      facts.push(
        `${member.label}: Mega form and locked ${fighter.ability?.name ?? "ability"} active.`,
      );
    for (const owner of [fighter.ability, fighter.item])
      for (const descriptor of owner?.contextual_inputs ?? [])
        facts.push(
          `${member.label}: ${owner!.name} uses default ${descriptor.label} = ${String(descriptor.default)}.`,
        );
  }
  if (attacker)
    for (const moveId of attacker.moveIds) {
      const move = data.moves.find(({ id }) => id === moveId);
      for (const descriptor of move?.contextual_inputs ?? [])
        facts.push(
          `${move!.name} uses default ${descriptor.label} = ${String(descriptor.default)}.`,
        );
    }
  const defenders = attacker
    ? active.filter(({ side }) => side !== attacker.side)
    : [];
  for (const target of defenders) {
    const partner = friendGuardPartner(data, defenders, target);
    if (partner)
      facts.push(
        `Friend Guard inferred from ${partner.label} while ${target.label} defends.`,
      );
  }
  return (
    <details class="battle-accounted" open>
      <summary>Accounted effects</summary>
      {facts.length ? (
        <ul>
          {facts.map((fact) => (
            <li>{fact}</li>
          ))}
        </ul>
      ) : (
        <p>No active calculation context yet.</p>
      )}
    </details>
  );
}

function Confirmation({
  action,
  onCancel,
}: {
  action: { label: string; run: () => void; initiator?: HTMLElement };
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const initiator = action.initiator ?? document.activeElement;
    cancel.current?.focus();
    return () => {
      if (initiator instanceof HTMLElement && initiator.isConnected)
        initiator.focus();
    };
  }, []);
  return (
    <div class="battle-dialog-backdrop">
      <div
        class="battle-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="battle-confirm-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Tab") {
            const buttons = [...event.currentTarget.querySelectorAll("button")];
            const first = buttons[0];
            const last = buttons.at(-1);
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2 id="battle-confirm-title">{action.label}</h2>
        <p>Battle Mode does not save match state.</p>
        <div>
          <button
            ref={cancel}
            type="button"
            class="button button--secondary"
            onClick={onCancel}
          >
            Keep battling
          </button>
          <button type="button" class="button" onClick={() => action.run()}>
            Discard battle
          </button>
        </div>
      </div>
    </div>
  );
}

export function BattleMode({ bootstrap }: { bootstrap: BattleBootstrap }) {
  const [data, setData] = useState<CalculatorData | null>(null);
  const [dataError, setDataError] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [state, dispatch] = useReducer(
    battleReducer,
    undefined,
    emptyBattleState,
  );
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    run: () => void;
    cancel?: () => void;
    initiator?: HTMLElement;
  } | null>(null);
  const nextOpponentId = useRef(1);
  const unloadBypass = useRef(false);
  const departureProtected = useRef(state.started || loadingTeam);
  departureProtected.current = state.started || loadingTeam;
  const withUnloadBypass = (navigate: () => void) => {
    unloadBypass.current = true;
    try {
      navigate();
    } finally {
      window.setTimeout(() => {
        unloadBypass.current = false;
      }, 1000);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(bootstrap.dataset_url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Battle data could not be loaded.");
        return response.json();
      })
      .then((value) => {
        const parsed = parseCalculatorData(value);
        if (
          parsed.data_version !== bootstrap.active_version ||
          parsed.regulation.id !== bootstrap.regulation.id
        )
          throw new Error("Battle data changed. Reload this page.");
        const searchable = parsed.forms.filter(
          ({ searchable, is_mega }) => searchable && !is_mega,
        );
        const mappedIds = Object.keys(bootstrap.base_species_by_form);
        if (
          mappedIds.length !== searchable.length ||
          searchable.some(({ id }) => !bootstrap.base_species_by_form[id]) ||
          mappedIds.some((id) => !searchable.some((form) => form.id === id))
        )
          throw new Error(
            "Battle species data is inconsistent. Reload this page.",
          );
        setData(parsed);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setDataError(
          error instanceof Error
            ? error.message
            : "Battle Mode could not load.",
        );
      });
    return () => controller.abort();
  }, [bootstrap]);
  useLayoutEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!departureProtected.current) return;
      if (unloadBypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!departureProtected.current) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setConfirmAction({
        label: "Leave Battle Mode? This battle will be lost.",
        run: () => withUnloadBypass(() => location.assign(link.href)),
        initiator: link,
      });
    };
    const submit = (event: SubmitEvent) => {
      if (!departureProtected.current) return;
      const form = event.target as HTMLFormElement;
      if (form.closest("[data-battle-mode-root]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setConfirmAction({
        label: "Leave Battle Mode? This battle will be lost.",
        run: () =>
          withUnloadBypass(() => HTMLFormElement.prototype.submit.call(form)),
        initiator:
          event.submitter instanceof HTMLElement ? event.submitter : form,
      });
    };
    const navigation = (event: Event) => {
      if (!departureProtected.current) return;
      const url = (event as CustomEvent<{ url?: string }>).detail?.url;
      if (!url) return;
      const selector = document.querySelector<HTMLSelectElement>(
        "[data-regulation-selector] select",
      );
      event.preventDefault();
      event.stopImmediatePropagation();
      setConfirmAction({
        label: "Leave Battle Mode? This battle will be lost.",
        run: () => withUnloadBypass(() => location.assign(url)),
        initiator: selector ?? undefined,
        cancel: () => {
          if (selector) selector.value = bootstrap.regulation.id;
        },
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    document.addEventListener("bagredex:navigate", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
      document.removeEventListener("bagredex:navigate", navigation, true);
    };
  }, [bootstrap.regulation.id]);
  const start = async () => {
    if (!data || !selectedTeam) return;
    departureProtected.current = true;
    setLoadingTeam(true);
    setTeamError("");
    try {
      const response = await fetch(
        bootstrap.team_url_template.replace(
          "__TEAM__",
          encodeURIComponent(selectedTeam),
        ),
        { headers: { Accept: "application/json" } },
      );
      const value = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          parseProblem(value)?.message ?? "That team could not be loaded.",
        );
      const parsed = parseTeam(value);
      validateTeam(parsed, bootstrap, data);
      setTeam(parsed);
      dispatch({ type: "start", members: ownMembers(parsed, data, bootstrap) });
    } catch (error) {
      departureProtected.current = false;
      setTeamError(
        error instanceof Error
          ? error.message
          : "That team could not be loaded.",
      );
    } finally {
      setLoadingTeam(false);
    }
  };
  const addOpponent = (form: Form) => {
    const opponents = state.members.filter(({ side }) => side === "opponent");
    if (opponents.length >= 6)
      return "The opponent roster already has six Pokémon.";
    const species = bootstrap.base_species_by_form[form.id];
    if (!species) return "That form is not available in this regulation.";
    if (opponents.some(({ baseSpeciesId }) => baseSpeciesId === species))
      return "That species is already on the opponent roster.";
    const serious =
      data!.natures.find(({ id }) => id === "serious") ?? data!.natures[0]!;
    dispatch({
      type: "add",
      member: {
        id: `opponent-${nextOpponentId.current++}`,
        side: "opponent",
        formId: form.id,
        baseSpeciesId: species,
        label: form.name,
        gender: form.default_gender,
        abilityId: form.abilities[0]?.id ?? null,
        itemId: null,
        natureId: serious.id,
        moveIds: [null, null, null, null],
        sp: zeroStats(),
        status: "",
        stages: zeroStages(),
        hp: 100,
        mega: false,
        shiny: false,
      },
    });
    return null;
  };
  if (dataError)
    return (
      <section class="battle-state battle-state--error" role="alert">
        <h1>Battle Mode unavailable</h1>
        <p>{dataError}</p>
      </section>
    );
  if (!data)
    return (
      <div class="page-loading" role="status" aria-busy="true">
        <span class="page-loading__spinner" aria-hidden="true" />
        <span class="visually-hidden">Loading Battle Mode…</span>
      </div>
    );
  const confirmation = confirmAction && (
    <Confirmation
      action={{
        ...confirmAction,
        run: () => {
          const run = confirmAction.run;
          setConfirmAction(null);
          run();
        },
      }}
      onCancel={() => {
        confirmAction.cancel?.();
        setConfirmAction(null);
      }}
    />
  );
  if (!state.started)
    return (
      <>
        <Selection
          bootstrap={bootstrap}
          selected={selectedTeam}
          loading={loadingTeam}
          error={teamError}
          onSelect={(id) => {
            setSelectedTeam(id);
            setTeam(null);
            setTeamError("");
          }}
          onStart={start}
        />
        {confirmation}
      </>
    );
  const own = state.members.filter(({ side }) => side === "own");
  const opponents = state.members.filter(({ side }) => side === "opponent");
  const activeMembers = [...state.board.own, ...state.board.opponent]
    .map((id) => state.members.find((member) => member.id === id))
    .filter(Boolean) as BattleMember[];
  return (
    <div class="battle-mode">
      <header class="battle-mode__header">
        <div>
          <p class="eyebrow">{bootstrap.regulation.name}</p>
          <h1>{team?.name ?? "Battle Mode"}</h1>
        </div>
        <button
          type="button"
          class="button button--secondary"
          onClick={() =>
            setConfirmAction({
              label: "Start over? This battle will be lost.",
              run: () => {
                dispatch({ type: "start-over" });
                setSelectedTeam("");
                setTeam(null);
              },
            })
          }
        >
          Start over
        </button>
      </header>
      <aside class="battle-panel battle-panel--own">
        <h2>Your team</h2>
        <Roster
          side="own"
          members={own}
          active={state.board.own}
          placementId={state.placementId}
          attackerId={state.attackerId}
          data={data}
          onSelect={(id) => dispatch({ type: "select", id })}
        />
        {activeMembers
          .filter(({ side }) => side === "own")
          .map((member) => (
            <MemberEditor
              member={member}
              data={data}
              onChange={(patch) =>
                dispatch({ type: "update", id: member.id, patch })
              }
            />
          ))}
      </aside>
      <div class="battle-center">
        <section class="battle-board" aria-label="Battlefield">
          <div class="battle-board__side">
            <h2>Opponent field</h2>
            {([0, 1] as const).map((slot) => {
              const member = state.members.find(
                ({ id }) => id === state.board.opponent[slot],
              );
              return (
                <BoardSlot
                  side="opponent"
                  slot={slot}
                  member={member}
                  canPlace={Boolean(
                    state.placementId &&
                      opponents.some(({ id }) => id === state.placementId),
                  )}
                  data={data}
                  onPlace={() =>
                    dispatch({ type: "place", side: "opponent", slot })
                  }
                  onSelect={() =>
                    member && dispatch({ type: "select", id: member.id })
                  }
                  onBench={() =>
                    member && dispatch({ type: "bench", id: member.id })
                  }
                />
              );
            })}
          </div>
          <div class="battle-board__side">
            <h2>Your field</h2>
            {([0, 1] as const).map((slot) => {
              const member = state.members.find(
                ({ id }) => id === state.board.own[slot],
              );
              return (
                <BoardSlot
                  side="own"
                  slot={slot}
                  member={member}
                  canPlace={Boolean(
                    state.placementId &&
                      own.some(({ id }) => id === state.placementId),
                  )}
                  data={data}
                  onPlace={() => dispatch({ type: "place", side: "own", slot })}
                  onSelect={() =>
                    member && dispatch({ type: "select", id: member.id })
                  }
                  onBench={() =>
                    member && dispatch({ type: "bench", id: member.id })
                  }
                />
              );
            })}
          </div>
        </section>
        <TurnOrder
          data={data}
          members={state.members}
          board={state.board}
          field={state.field}
        />
        <Results
          data={data}
          members={state.members}
          board={state.board}
          attackerId={state.attackerId}
          field={state.field}
          override={state.singleTargetOverride}
          onOverride={(value) => dispatch({ type: "single-target", value })}
        />
        <FieldControls
          value={state.field}
          onChange={(field) => dispatch({ type: "field", field })}
        />
        <AccountedEffects
          data={data}
          members={state.members}
          board={state.board}
          attackerId={state.attackerId}
          field={state.field}
          override={state.singleTargetOverride}
        />
      </div>
      <aside class="battle-panel battle-panel--opponent">
        <h2>Opponent</h2>
        <OpponentEntry
          data={data}
          disabled={opponents.length >= 6}
          onAdd={addOpponent}
        />
        <Roster
          side="opponent"
          members={opponents}
          active={state.board.opponent}
          placementId={state.placementId}
          attackerId={state.attackerId}
          data={data}
          onSelect={(id) => dispatch({ type: "select", id })}
          onRemove={(id) => dispatch({ type: "remove", id })}
        />
        {activeMembers
          .filter(({ side }) => side === "opponent")
          .map((member) => (
            <MemberEditor
              member={member}
              data={data}
              onChange={(patch) =>
                dispatch({ type: "update", id: member.id, patch })
              }
            />
          ))}
      </aside>
      {confirmation}
    </div>
  );
}
