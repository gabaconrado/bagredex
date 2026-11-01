import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "preact/hooks";
import type { ComponentChildren } from "preact";
import type {
  CalculatorData,
  Form,
  Move,
  StatId,
  Stats,
} from "../damage-calculator/contracts";
import { searchEntryForForm } from "../form-search";
import { parseCalculatorData } from "../damage-calculator/contracts";
import { MegaIcon } from "../icons";
import { MoveInformationDialog } from "../move-information";
import {
  applyBattleStage,
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
  hasBattleProgress,
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
const stageLabels: Record<StageId, string> = {
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};
const statLabels: Record<StatId, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};
const statShortLabels: Record<StatId, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
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
export const stagedStatValue = (value: number, stage: number) =>
  applyBattleStage(value, stage);
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
  if (!team.members.length)
    throw new Error("That team needs at least one Pokémon.");
  const positions = new Set<number>();
  for (const member of team.members) {
    const form = lookup.forms.get(member.form_id);
    if (positions.has(member.position) || !form)
      throw new Error("That team contains unavailable Pokémon data.");
    positions.add(member.position);
    if (!member.nature_id || !lookup.natures.has(member.nature_id))
      throw new Error("That team contains an unavailable nature.");
    if (
      !member.ability_id ||
      !lookup.abilities.has(member.ability_id) ||
      !form.abilities.some(({ id }) => id === member.ability_id)
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

export function calculationField(
  state: BattleField,
  attackerSide: BattleSide,
  singleTarget: boolean,
): Field {
  const defenderSide = attackerSide === "own" ? "opponent" : "own";
  return {
    weather: state.weather,
    terrain: state.terrain,
    attacker: {
      helpingHand: state[attackerSide].helpingHand,
      singleTarget,
      critical: false,
      tailwind: state[attackerSide].tailwind,
    },
    defender: {
      ...state[defenderSide],
      friendGuard: state[defenderSide].friendGuard,
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

function TeamSelection({
  bootstrap,
  currentTeamId,
  loading,
  error,
  onClose,
  onSelect,
}: {
  bootstrap: BattleBootstrap;
  currentTeamId: string | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div
      class="battle-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        class="battle-dialog battle-team-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-team-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key !== "Tab") return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not([disabled]), a[href]",
            ),
          ];
          const first = controls[0];
          const last = controls.at(-1);
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header>
          <div>
            <h2 id="battle-team-dialog-title">Choose your team</h2>
            <p>Changing teams resets the current battle.</p>
          </div>
          <button
            ref={close}
            type="button"
            class="battle-icon-button"
            aria-label="Close team selection"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {bootstrap.teams.length ? (
          <ul class="battle-team-grid" aria-label="Saved teams">
            {bootstrap.teams.map((team) => (
              <li>
                <button
                  type="button"
                  disabled={!team.battle_ready || loading}
                  aria-current={currentTeamId === team.id ? "true" : undefined}
                  class={`battle-team${currentTeamId === team.id ? " is-selected" : ""}`}
                  onClick={() => onSelect(team.id)}
                >
                  <strong>{team.name}</strong>
                  <span>{team.members.length} Pokémon</span>
                  <span class="battle-team__sprites" aria-hidden="true">
                    {team.members.map((member) => (
                      <img src={member.sprite_url} alt="" />
                    ))}
                  </span>
                  {!team.battle_ready && (
                    <small>{team.battle_unavailable_reason}</small>
                  )}
                  {loading && currentTeamId !== team.id && (
                    <small>Loading…</small>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div class="battle-empty">
            <p>No saved teams are available.</p>
            <a class="button" href={bootstrap.team_builder_url}>
              Create a team
            </a>
          </div>
        )}
        {bootstrap.teams.length > 0 &&
          !bootstrap.teams.some(({ battle_ready }) => battle_ready) && (
            <p>
              Complete a team in Team Builder before entering battle.{" "}
              <a href={bootstrap.team_builder_url}>Open Team Builder</a>
            </p>
          )}
        {error && (
          <p class="battle-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <a class="button" href={bootstrap.team_builder_url}>
            Team Builder
          </a>
          <button
            type="button"
            class="button button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
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
  leading,
}: {
  side: BattleSide;
  members: BattleMember[];
  active: (string | null)[];
  placementId: string | null;
  attackerId: string | null;
  data: CalculatorData;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  leading?: ComponentChildren;
}) {
  return (
    <div class="battle-roster" role="list">
      {leading}
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

export function availableOpponentForms(
  data: CalculatorData,
  excludedBaseSpeciesIds: ReadonlySet<string>,
  baseSpeciesByForm: Readonly<Record<string, string>>,
) {
  return data.pokemon_search_entries
    .filter(
      ({ form_id }) =>
        !excludedBaseSpeciesIds.has(baseSpeciesByForm[form_id] ?? form_id),
    )
    .map((entry) => {
      const form = data.forms.find(({ id }) => id === entry.form_id)!;
      return { ...form, name: entry.name };
    });
}

export function unavailableOpponentItemIds(
  opponents: BattleMember[],
  currentMemberId: string,
) {
  return new Set(
    opponents
      .filter(({ id }) => id !== currentMemberId)
      .map(({ itemId }) => itemId)
      .filter((id): id is string => Boolean(id)),
  );
}

function OpponentEntry({
  data,
  disabled,
  excludedBaseSpeciesIds,
  baseSpeciesByForm,
  onAdd,
}: {
  data: CalculatorData;
  disabled: boolean;
  excludedBaseSpeciesIds: ReadonlySet<string>;
  baseSpeciesByForm: Readonly<Record<string, string>>;
  onAdd: (form: Form) => string | null;
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = availableOpponentForms(
    data,
    excludedBaseSpeciesIds,
    baseSpeciesByForm,
  );
  const results = options
    .filter(({ id, name }) => {
      const query = value.trim().toLocaleLowerCase();
      return (
        !query ||
        id.toLocaleLowerCase().includes(query) ||
        name.toLocaleLowerCase().includes(query)
      );
    })
    .slice(0, 12);
  const commit = (choice?: Form) => {
    const normalized = value.trim().toLocaleLowerCase();
    const form =
      choice ??
      results[active] ??
      options.find(
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
      setOpen(false);
      setExpanded(false);
      setActive(0);
      setMessage("");
      requestAnimationFrame(() => trigger.current?.focus());
    }
  };
  return (
    <div
      class={`battle-roster__add-item${expanded ? " is-expanded" : ""}`}
      role="listitem"
    >
      {!expanded ? (
        <button
          ref={trigger}
          type="button"
          class="battle-roster__add"
          aria-label="Add opponent Pokémon"
          disabled={disabled}
          onClick={() => {
            setExpanded(true);
            setOpen(true);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <span aria-hidden="true">+</span>
          <strong>Add Pokémon</strong>
        </button>
      ) : (
        <div class="battle-opponent-entry">
          <label for="battle-opponent-pokemon">Add opponent Pokémon</label>
          <div class="battle-combobox">
            <input
              ref={input}
              id="battle-opponent-pokemon"
              role="combobox"
              autocomplete="off"
              aria-autocomplete="list"
              aria-expanded={open && results.length > 0}
              aria-controls="battle-opponent-options"
              aria-activedescendant={
                open && results[active]
                  ? `battle-opponent-option-${results[active].id}`
                  : undefined
              }
              value={value}
              disabled={disabled}
              onFocus={() => !disabled && setOpen(true)}
              onInput={(event) => {
                setValue(event.currentTarget.value);
                setActive(0);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && results.length) {
                  event.preventDefault();
                  setOpen(true);
                  setActive((active + 1) % results.length);
                } else if (event.key === "ArrowUp" && results.length) {
                  event.preventDefault();
                  setOpen(true);
                  setActive((active - 1 + results.length) % results.length);
                } else if (event.key === "Enter" && open) {
                  event.preventDefault();
                  commit();
                } else if (event.key === "Escape") {
                  setOpen(false);
                  setExpanded(false);
                  requestAnimationFrame(() => trigger.current?.focus());
                }
              }}
            />
            {open && results.length > 0 && (
              <div
                id="battle-opponent-options"
                role="listbox"
                class="battle-combobox__list"
              >
                {results.map((form, index) => (
                  <button
                    id={`battle-opponent-option-${form.id}`}
                    type="button"
                    role="option"
                    aria-selected={active === index}
                    onMouseEnter={() => setActive(index)}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => commit(form)}
                  >
                    <img
                      src={data.sprite_url_template
                        .replace("__FORM__", form.sprite_form_id)
                        .replace("__VARIANT__", "normal")
                        .replace("{sprite_form_id}", form.sprite_form_id)}
                      alt=""
                    />
                    <strong>{form.name}</strong>
                    {active === index && <kbd aria-hidden="true">Enter</kbd>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <small role="status">{message}</small>
        </div>
      )}
      {!expanded && <small role="status">{message}</small>}
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
  onChange,
  disabled = false,
}: {
  side: BattleSide;
  slot: 0 | 1;
  member?: BattleMember;
  canPlace: boolean;
  data: CalculatorData;
  onPlace: () => void;
  onSelect: () => void;
  onBench: () => void;
  onChange: (patch: Partial<BattleMember>) => void;
  disabled?: boolean;
}) {
  const relation = member
    ? data.mega_item_relations.find(
        ({ base_form_id, item_id }) =>
          base_form_id === member.formId && item_id === member.itemId,
      )
    : undefined;
  return (
    <div class="battle-slot-wrap">
      {member ? (
        <article
          class="battle-slot is-filled"
          aria-label={`${side === "own" ? "Your" : "Opponent"} active slot ${slot + 1}, ${member.label}`}
        >
          <button
            type="button"
            class="battle-slot__select"
            disabled={disabled}
            onClick={canPlace ? onPlace : onSelect}
            aria-label={
              canPlace
                ? `Place selected Pokémon in ${side === "own" ? "your" : "opponent"} slot ${slot + 1}, replacing ${member.label}`
                : `Select ${member.label} as attacker`
            }
          >
            <span class="battle-slot__visual">
              <img src={sprite(data, member)} alt="" />
            </span>
            <strong>{member.label}</strong>
          </button>
          <button
            type="button"
            class="battle-bench"
            disabled={disabled}
            onClick={onBench}
            aria-label={`Bench ${member.label}`}
            title={`Bench ${member.label}`}
          >
            <span aria-hidden="true">×</span>
          </button>
          {relation && (
            <button
              type="button"
              class={`battle-mega-toggle${member.mega ? " is-active" : ""}`}
              disabled={disabled}
              aria-pressed={member.mega}
              aria-label={`${member.mega ? "Revert" : "Mega evolve"} ${member.label}`}
              title={`${member.mega ? "Revert" : "Mega evolve"} ${member.label}`}
              onClick={() => onChange({ mega: !member.mega })}
            >
              <MegaIcon />
            </button>
          )}
        </article>
      ) : (
        <button
          type="button"
          class="battle-slot"
          disabled={disabled}
          aria-label={`${side === "own" ? "Your" : "Opponent"} active slot ${slot + 1}, empty`}
          onClick={onPlace}
        >
          <span>{canPlace ? "Place here" : "Empty"}</span>
        </button>
      )}
    </div>
  );
}

type SetChoice = { id: string; name: string };

function SetCombobox({
  id,
  label,
  valueId,
  choices,
  onChange,
}: {
  id: string;
  label: string;
  valueId: string | null;
  choices: SetChoice[];
  onChange: (value: string | null) => void;
}) {
  const selectedName = choices.find(({ id }) => id === valueId)?.name ?? "";
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => setQuery(selectedName), [selectedName, valueId]);
  const normalized = query.trim().toLocaleLowerCase();
  const results = choices
    .filter(
      ({ id, name }) =>
        !normalized ||
        id.toLocaleLowerCase().includes(normalized) ||
        name.toLocaleLowerCase().includes(normalized),
    )
    .slice(0, 12);
  const commit = (choice?: SetChoice) => {
    const exact = choices.find(
      ({ id, name }) =>
        id.toLocaleLowerCase() === normalized ||
        name.toLocaleLowerCase() === normalized,
    );
    const selected = choice ?? results[active] ?? exact;
    if (!selected && !query.trim()) {
      onChange(null);
      setQuery("");
      setMessage("");
      setOpen(false);
      return;
    }
    if (!selected) {
      setMessage(
        `Choose a valid ${label.toLocaleLowerCase()} from the suggestions.`,
      );
      return;
    }
    onChange(selected.id);
    setQuery(selected.name);
    setMessage("");
    setOpen(false);
  };
  const listId = `${id}-options`;
  return (
    <div class="battle-set-combobox">
      <label for={id}>{label}</label>
      <span class="battle-combobox">
        <input
          id={id}
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            open && results[active]
              ? `${id}-option-${results[active].id}`
              : undefined
          }
          value={query}
          onFocus={() => {
            setActive(0);
            setOpen(true);
          }}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setActive(0);
            setMessage("");
            setOpen(true);
          }}
          onBlur={() => {
            if (!query.trim()) {
              onChange(null);
              setQuery("");
            } else if (
              query.trim().toLocaleLowerCase() !==
              selectedName.toLocaleLowerCase()
            )
              setQuery(selectedName);
            setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setOpen(true);
              setActive((active + 1) % results.length);
            } else if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setOpen(true);
              setActive((active - 1 + results.length) % results.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setQuery(selectedName);
              setMessage("");
              setOpen(false);
            }
          }}
        />
        {open && results.length > 0 && (
          <span id={listId} role="listbox" class="battle-combobox__list">
            {results.map((choice, index) => (
              <button
                id={`${id}-option-${choice.id}`}
                type="button"
                role="option"
                aria-selected={active === index}
                onMouseEnter={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => commit(choice)}
              >
                <strong>{choice.name}</strong>
                {active === index && <kbd aria-hidden="true">Enter</kbd>}
              </button>
            ))}
          </span>
        )}
      </span>
      <small role="status">{message}</small>
    </div>
  );
}

function MemberEditor({
  member,
  data,
  unavailableItemIds = new Set<string>(),
  baseSpeciesByForm = {},
  onChange,
}: {
  member: BattleMember;
  data: CalculatorData;
  unavailableItemIds?: ReadonlySet<string>;
  baseSpeciesByForm?: Readonly<Record<string, string>>;
  onChange: (patch: Partial<BattleMember>) => void;
}) {
  const form = data.forms.find(({ id }) => id === member.formId)!;
  const searchEntry = searchEntryForForm(
    data.pokemon_search_entries,
    member.formId,
  );
  const shown = displayForm(data, member) ?? form;
  const nature = data.natures.find(({ id }) => id === member.natureId);
  const hpNature =
    nature ??
    data.natures.find(({ id }) => id === "serious") ??
    data.natures[0]!;
  const calculatedStats = stats({
    form: shown,
    nature: hpNature,
    sp: member.sp,
  });
  const maximum = calculatedStats.hp;
  const unavailable = unavailableBuildReason(data, member);
  const legalAbilityIds = new Set(form.abilities.map(({ id }) => id));
  const setMove = (index: number, value: string) => {
    const moveIds = [...member.moveIds];
    moveIds[index] = value || null;
    onChange({ moveIds });
  };
  const statControls = (
    <fieldset class="battle-editor__stats" aria-label={`${member.label} stats`}>
      <legend>Stats</legend>
      {statIds.map((id) => (
        <div class="battle-stat-row" key={id}>
          <span class="battle-stat-row__label">{statShortLabels[id]}</span>
          <span class="battle-stat-row__slider">
            <input
              type="range"
              min="0"
              max="32"
              value={member.sp[id]}
              disabled={member.side === "own"}
              aria-label={`${member.label} ${statLabels[id]} Stat Points`}
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
            <output
              aria-label={`${member.label} ${statLabels[id]} Stat Points value`}
            >
              {member.sp[id]}
            </output>
          </span>
          <output
            class="battle-stat-row__value"
            aria-label={`${member.label} ${statShortLabels[id]} stat`}
          >
            {id === "hp"
              ? calculatedStats.hp
              : stagedStatValue(calculatedStats[id], member.stages[id])}
          </output>
          {id !== "hp" && (
            <>
              <button
                type="button"
                class="battle-stage-control battle-stage-control--lower"
                disabled={member.stages[id] <= -6}
                aria-label={`Lower ${member.label} ${stageLabels[id]} from ${member.stages[id]}`}
                onClick={() =>
                  onChange({
                    stages: {
                      ...member.stages,
                      [id]: member.stages[id] - 1,
                    },
                  })
                }
              >
                −
              </button>
              <output
                class="battle-stat-row__stage"
                aria-label={`${member.label} ${stageLabels[id]} stage`}
              >
                {member.stages[id] > 0 ? "+" : ""}
                {member.stages[id]}
              </output>
              <button
                type="button"
                class="battle-stage-control battle-stage-control--raise"
                disabled={member.stages[id] >= 6}
                aria-label={`Raise ${member.label} ${stageLabels[id]} from ${member.stages[id]}`}
                onClick={() =>
                  onChange({
                    stages: {
                      ...member.stages,
                      [id]: member.stages[id] + 1,
                    },
                  })
                }
              >
                +
              </button>
            </>
          )}
        </div>
      ))}
    </fieldset>
  );
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
      {member.side === "own" && statControls}
      {member.side === "opponent" ? (
        <div class="battle-set-editor">
          {searchEntry?.form_group && (
            <label class="battle-form-select">
              {searchEntry.form_group.label}
              <select
                id={`battle-${member.id}-form`}
                value={member.formId}
                onChange={(event) => {
                  const target = data.forms.find(
                    ({ id }) => id === event.currentTarget.value,
                  );
                  if (!target) return;
                  const abilityId = target.abilities.some(
                    ({ id }) => id === member.abilityId,
                  )
                    ? member.abilityId
                    : (target.abilities[0]?.id ?? null);
                  const seen = new Set<string>();
                  const moveIds = member.moveIds.map((id) => {
                    if (!id || !target.move_ids.includes(id) || seen.has(id))
                      return null;
                    seen.add(id);
                    return id;
                  });
                  onChange({
                    formId: target.id,
                    baseSpeciesId: baseSpeciesByForm[target.id] ?? target.id,
                    label:
                      member.label === form.name ? target.name : member.label,
                    gender: target.gender_options.includes(member.gender)
                      ? member.gender
                      : target.default_gender,
                    abilityId,
                    moveIds,
                    mega: false,
                  });
                }}
              >
                {searchEntry.form_group.options.map((option) => (
                  <option value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
          <div class="battle-choice-grid">
            <SetCombobox
              id={`battle-${member.id}-ability`}
              label="Ability"
              valueId={member.abilityId}
              choices={data.abilities.filter(({ id }) =>
                legalAbilityIds.has(id),
              )}
              onChange={(abilityId) => onChange({ abilityId })}
            />
            <SetCombobox
              id={`battle-${member.id}-item`}
              label="Item"
              valueId={member.itemId}
              choices={data.items.filter(
                ({ id }) => id === member.itemId || !unavailableItemIds.has(id),
              )}
              onChange={(itemId) => onChange({ itemId, mega: false })}
            />
          </div>
          <fieldset class="battle-moves">
            <legend>Moves</legend>
            {member.moveIds.map((moveId, index) => (
              <SetCombobox
                id={`battle-${member.id}-move-${index + 1}`}
                label={`Move ${index + 1}`}
                valueId={moveId}
                choices={data.moves.filter(
                  ({ id }) =>
                    form.move_ids.includes(id) &&
                    (!member.moveIds.includes(id) || id === moveId),
                )}
                onChange={(value) => setMove(index, value ?? "")}
              />
            ))}
          </fieldset>
          {statControls}
          <div class="battle-choice-grid battle-choice-grid--single">
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
        </div>
      ) : null}
    </section>
  );
}

function FieldControls({
  value,
  onChange,
  disabled,
}: {
  value: BattleField;
  onChange: (value: BattleField) => void;
  disabled: boolean;
}) {
  const groups = {
    weather: ["sun", "rain", "sand", "snow"],
    terrain: ["electric", "grassy", "psychic", "misty"],
  } as const;
  return (
    <section class="battle-field" aria-labelledby="battle-field-title">
      <h2 id="battle-field-title">Field effects</h2>
      <div class="battle-field__body">
        {Object.entries(groups).map(([group, choices]) => (
          <fieldset>
            <legend>{title(group)}</legend>
            <div class="battle-toggle-grid">
              {choices.map((choice) => (
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={
                    value[group as "weather" | "terrain"] === choice
                  }
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
          disabled={disabled}
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
                [
                  "tailwind",
                  "reflect",
                  "lightScreen",
                  "auroraVeil",
                  "friendGuard",
                  "helpingHand",
                  "singleTarget",
                ] as const
              ).map((effect) => (
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={value[side][effect]}
                  onClick={() =>
                    onChange({
                      ...value,
                      [side]: {
                        ...value[side],
                        [effect]: !value[side][effect],
                      },
                    })
                  }
                >
                  {title(effect)}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function Results({
  data,
  members,
  board,
  attackerId,
  field,
}: {
  data: CalculatorData;
  members: BattleMember[];
  board: Record<BattleSide, [string | null, string | null]>;
  attackerId: string | null;
  field: BattleField;
}) {
  const [moveDialog, setMoveDialog] = useState<{
    move: Move;
    invoker: HTMLElement;
  } | null>(null);
  const lookup = indexes(data);
  const attacker = members.find(({ id }) => id === attackerId);
  const attackerCombatant = attacker ? combatant(data, attacker) : null;
  const defendingSide: BattleSide =
    attacker?.side === "own" ? "opponent" : "own";
  const targets = board[defendingSide]
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as BattleMember[];
  const spread = spreadContext(
    targets.length,
    attacker ? field[attacker.side].singleTarget : false,
  );
  if (!attacker)
    return (
      <section class="battle-results">
        <h2>Damage</h2>
        <p>Select an active Pokémon to see its moves.</p>
      </section>
    );
  const attackerHeader = (
    <header>
      <div>
        <p class="eyebrow battle-selected-attacker">
          <span>Selected attacker</span>
          <img src={sprite(data, attacker)} alt="" />
        </p>
        <h2>{attacker.label} damage</h2>
      </div>
    </header>
  );
  if (!attackerCombatant)
    return (
      <section class="battle-results">
        {attackerHeader}
        <p class="battle-error" role="status">
          Calculations unavailable: {unavailableBuildReason(data, attacker)}.
          Complete this member in Team Builder.
        </p>
      </section>
    );
  return (
    <section class="battle-results">
      {attackerHeader}
      {!targets.length ? (
        <p>Place an opposing Pokémon on the field to calculate damage.</p>
      ) : (
        <div class="battle-result-grid">
          {attacker.moveIds.map((moveId, moveIndex) => {
            const move = lookup.moves.get(moveId ?? "");
            return (
              <article class="battle-move-result">
                <h3>
                  {move ? (
                    <button
                      type="button"
                      class="battle-move-result__details"
                      onClick={(event) =>
                        setMoveDialog({
                          move,
                          invoker: event.currentTarget,
                        })
                      }
                    >
                      {move.name}
                    </button>
                  ) : (
                    `Move ${moveIndex + 1}`
                  )}
                </h3>
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
                      </details>
                    );
                  })
                )}
              </article>
            );
          })}
        </div>
      )}
      {moveDialog && (
        <MoveInformationDialog
          move={{
            name: moveDialog.move.name,
            description: moveDialog.move.description,
            type: data.types.find(
              ({ id }) => id === moveDialog.move.type_id,
            ) ?? {
              id: moveDialog.move.type_id,
              name: title(moveDialog.move.type_id),
            },
            category: moveDialog.move.category,
            basePower: moveDialog.move.base_power,
            accuracy: moveDialog.move.accuracy,
            alwaysHits: moveDialog.move.accuracy === null,
            pp: moveDialog.move.pp,
            priority: moveDialog.move.priority,
            target: moveDialog.move.target,
            flags: moveDialog.move.flags,
          }}
          invoker={moveDialog.invoker}
          onClose={() => setMoveDialog(null)}
        />
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
      <h2>Turn order</h2>
      {groups.length ? (
        <ol>
          {groups.map((group) => (
            <li
              class={group.length > 1 ? "is-tied" : ""}
              aria-label={
                group.length > 1
                  ? `Speed tie at ${group[0]!.result.value}`
                  : undefined
              }
            >
              {group.map(({ member, result }) => (
                <div class="battle-order__member">
                  <span>Speed {result.value}</span>
                  <strong>{member.label}</strong>
                </div>
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
  const [team, setTeam] = useState<Team | null>(null);
  const [teamSelectionOpen, setTeamSelectionOpen] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [state, dispatch] = useReducer(
    battleReducer,
    undefined,
    emptyBattleState,
  );
  const [selectedEditorIds, setSelectedEditorIds] = useState<
    Record<BattleSide, string | null>
  >({ own: null, opponent: null });
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    run: () => void;
    cancel?: () => void;
    initiator?: HTMLElement;
  } | null>(null);
  const nextOpponentId = useRef(1);
  const teamRequest = useRef(0);
  const teamRequestController = useRef<AbortController | null>(null);
  const teamButton = useRef<HTMLButtonElement>(null);
  const unloadBypass = useRef(false);
  const departureProtected = useRef(
    state.currentTeamId !== null || loadingTeam,
  );
  departureProtected.current = state.currentTeamId !== null || loadingTeam;
  useEffect(() => {
    setSelectedEditorIds((current) => {
      const next = { ...current };
      for (const side of ["own", "opponent"] as const) {
        if (!current[side] || !state.board[side].includes(current[side]))
          next[side] = state.board[side].find(Boolean) ?? null;
      }
      return next.own === current.own && next.opponent === current.opponent
        ? current
        : next;
    });
  }, [
    state.board.own[0],
    state.board.own[1],
    state.board.opponent[0],
    state.board.opponent[1],
  ]);
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
        const searchableIds = new Set(
          parsed.pokemon_search_entries.flatMap((entry) =>
            entry.form_group
              ? entry.form_group.options.map(({ id }) => id)
              : [entry.form_id],
          ),
        );
        const mappedIds = Object.keys(bootstrap.base_species_by_form);
        if (
          mappedIds.length !== searchableIds.size ||
          [...searchableIds].some(
            (id) => !bootstrap.base_species_by_form[id],
          ) ||
          mappedIds.some((id) => !searchableIds.has(id))
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
  const closeTeamSelection = () => {
    teamRequest.current += 1;
    teamRequestController.current?.abort();
    teamRequestController.current = null;
    setLoadingTeam(false);
    setTeamError("");
    departureProtected.current = state.currentTeamId !== null;
    setTeamSelectionOpen(false);
    requestAnimationFrame(() => teamButton.current?.focus());
  };
  const selectTeam = async (teamId: string) => {
    if (!data) return;
    if (teamId === state.currentTeamId) {
      closeTeamSelection();
      return;
    }
    const summary = bootstrap.teams.find(({ id }) => id === teamId);
    if (!summary?.battle_ready) return;
    teamRequestController.current?.abort();
    const controller = new AbortController();
    teamRequestController.current = controller;
    const request = ++teamRequest.current;
    departureProtected.current = true;
    setLoadingTeam(true);
    setTeamError("");
    try {
      const response = await fetch(
        bootstrap.team_url_template.replace(
          "__TEAM__",
          encodeURIComponent(teamId),
        ),
        {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      const value = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          parseProblem(value)?.message ?? "That team could not be loaded.",
        );
      const parsed = parseTeam(value);
      validateTeam(parsed, bootstrap, data);
      if (request !== teamRequest.current) return;
      const install = () => {
        setTeam(parsed);
        nextOpponentId.current = 1;
        dispatch({
          type: "install-team",
          teamId,
          members: ownMembers(parsed, data, bootstrap),
        });
        closeTeamSelection();
      };
      if (hasBattleProgress(state)) {
        setTeamSelectionOpen(false);
        setConfirmAction({
          label: `Change to ${summary.name}? Current battle progress will be lost.`,
          run: install,
          cancel: () => setTeamSelectionOpen(true),
          initiator: teamButton.current ?? undefined,
        });
      } else install();
    } catch (error) {
      if (request !== teamRequest.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      departureProtected.current = state.currentTeamId !== null;
      setTeamError(
        error instanceof Error
          ? error.message
          : "That team could not be loaded.",
      );
    } finally {
      if (request === teamRequest.current) {
        teamRequestController.current = null;
        setLoadingTeam(false);
      }
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
  const own = state.members.filter(({ side }) => side === "own");
  const opponents = state.members.filter(({ side }) => side === "opponent");
  const selectedEditors = {
    own: state.members.find(
      ({ id, side }) => side === "own" && id === selectedEditorIds.own,
    ),
    opponent: state.members.find(
      ({ id, side }) =>
        side === "opponent" && id === selectedEditorIds.opponent,
    ),
  };
  return (
    <div class="battle-mode" role="region" aria-label="Battle Mode">
      <aside class="battle-panel battle-panel--own">
        <button
          ref={teamButton}
          type="button"
          class="battle-team-trigger"
          onClick={() => {
            setTeamError("");
            setTeamSelectionOpen(true);
          }}
        >
          <span>Your team</span>
          <small>{team?.name ?? "Choose a team"}</small>
        </button>
        {own.length ? (
          <Roster
            side="own"
            members={own}
            active={state.board.own}
            placementId={state.placementId}
            attackerId={state.attackerId}
            data={data}
            onSelect={(id) => dispatch({ type: "select", id })}
          />
        ) : (
          <p class="battle-empty">Choose your team to begin.</p>
        )}
        {selectedEditors.own &&
          state.board.own.includes(selectedEditors.own.id) && (
            <MemberEditor
              member={selectedEditors.own}
              data={data}
              onChange={(patch) =>
                dispatch({ type: "update", id: selectedEditors.own!.id, patch })
              }
            />
          )}
      </aside>
      <div class="battle-center">
        <section class="battle-board" aria-label="Battlefield">
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
                  disabled={!state.currentTeamId}
                  data={data}
                  onPlace={() => dispatch({ type: "place", side: "own", slot })}
                  onSelect={() => {
                    if (!member) return;
                    setSelectedEditorIds((current) => ({
                      ...current,
                      own: member.id,
                    }));
                    dispatch({ type: "select", id: member.id });
                  }}
                  onBench={() =>
                    member && dispatch({ type: "bench", id: member.id })
                  }
                  onChange={(patch) =>
                    member && dispatch({ type: "update", id: member.id, patch })
                  }
                />
              );
            })}
          </div>
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
                  disabled={!state.currentTeamId}
                  data={data}
                  onPlace={() =>
                    dispatch({ type: "place", side: "opponent", slot })
                  }
                  onSelect={() => {
                    if (!member) return;
                    setSelectedEditorIds((current) => ({
                      ...current,
                      opponent: member.id,
                    }));
                    dispatch({ type: "select", id: member.id });
                  }}
                  onBench={() =>
                    member && dispatch({ type: "bench", id: member.id })
                  }
                  onChange={(patch) =>
                    member && dispatch({ type: "update", id: member.id, patch })
                  }
                />
              );
            })}
          </div>
          <TurnOrder
            data={data}
            members={state.members}
            board={state.board}
            field={state.field}
          />
        </section>
        <Results
          data={data}
          members={state.members}
          board={state.board}
          attackerId={state.attackerId}
          field={state.field}
        />
        <FieldControls
          value={state.field}
          disabled={!state.currentTeamId}
          onChange={(field) => dispatch({ type: "field", field })}
        />
      </div>
      <aside class="battle-panel battle-panel--opponent">
        <h2>Opponent</h2>
        <Roster
          side="opponent"
          members={opponents}
          active={state.board.opponent}
          placementId={state.placementId}
          attackerId={state.attackerId}
          data={data}
          onSelect={(id) => dispatch({ type: "select", id })}
          onRemove={(id) => dispatch({ type: "remove", id })}
          leading={
            opponents.length < 6 ? (
              <OpponentEntry
                data={data}
                disabled={!state.currentTeamId}
                excludedBaseSpeciesIds={
                  new Set(opponents.map(({ baseSpeciesId }) => baseSpeciesId))
                }
                baseSpeciesByForm={bootstrap.base_species_by_form}
                onAdd={addOpponent}
              />
            ) : null
          }
        />
        {selectedEditors.opponent &&
          state.board.opponent.includes(selectedEditors.opponent.id) && (
            <MemberEditor
              member={selectedEditors.opponent}
              data={data}
              unavailableItemIds={unavailableOpponentItemIds(
                opponents,
                selectedEditors.opponent.id,
              )}
              baseSpeciesByForm={bootstrap.base_species_by_form}
              onChange={(patch) =>
                dispatch({
                  type: "update",
                  id: selectedEditors.opponent!.id,
                  patch,
                })
              }
            />
          )}
      </aside>
      {teamSelectionOpen && (
        <TeamSelection
          bootstrap={bootstrap}
          currentTeamId={state.currentTeamId}
          loading={loadingTeam}
          error={teamError}
          onClose={closeTeamSelection}
          onSelect={selectTeam}
        />
      )}
      {confirmation}
    </div>
  );
}
