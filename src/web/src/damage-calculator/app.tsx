import { useEffect, useMemo, useState } from "preact/hooks";
import type {
  Bootstrap,
  CalculatorData,
  ContextInput,
  Form,
  Named,
  StatId,
  Stats,
} from "./contracts";
import { parseCalculatorData } from "./contracts";
import {
  calculate,
  statIds,
  stats,
  type Combatant,
  type Field,
} from "./engine/calculate";

type SideId = "left" | "right";
type Side = {
  formId: string | null;
  gender: "M" | "F" | "N";
  abilityId: string | null;
  itemId: string | null;
  natureId: string;
  moveIds: (string | null)[];
  sp: Stats;
  stages: Record<"atk" | "def" | "spa" | "spd" | "spe", number>;
  status: string;
  currentHp: number;
  mega: boolean;
  abilityContext: Record<string, boolean | number | string>;
  itemContext: Record<string, boolean | number | string>;
  moveContexts: Record<string, boolean | number | string>[];
};
type FieldState = {
  weather: string;
  terrain: string;
  left: SideEffects;
  right: SideEffects;
};
type SideEffects = {
  reflect: boolean;
  lightScreen: boolean;
  auroraVeil: boolean;
  helpingHand: boolean;
  friendGuard: boolean;
  singleTarget: boolean;
  critical: boolean;
  tailwind: boolean;
};
const zeroStats = (): Stats => ({
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
});
const effects = (): SideEffects => ({
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  helpingHand: false,
  friendGuard: false,
  singleTarget: false,
  critical: false,
  tailwind: false,
});
const emptyField = (): FieldState => ({
  weather: "",
  terrain: "",
  left: effects(),
  right: effects(),
});
const statLabels: Record<StatId, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};
const stageLabels = {
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
} as const;

function newSide(data: CalculatorData, form?: Form): Side {
  const natureId =
    data.natures.find(({ id }) => id === "serious")?.id ??
    data.natures[0]?.id ??
    "";
  const base: Side = {
    formId: form?.id ?? null,
    gender: form?.default_gender ?? "N",
    abilityId: form?.abilities[0]?.id ?? null,
    itemId: null,
    natureId,
    moveIds: Array(6).fill(null),
    sp: zeroStats(),
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: "",
    currentHp: 0,
    mega: false,
    abilityContext: {},
    itemContext: {},
    moveContexts: Array.from({ length: 6 }, () => ({})),
  };
  if (form) base.currentHp = maxHp(data, base, form);
  return base;
}
function maxHp(data: CalculatorData, side: Side, form: Form) {
  const nature =
    data.natures.find(({ id }) => id === side.natureId) ?? data.natures[0]!;
  return stats({ form, nature, sp: side.sp }).hp;
}
export const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? Math.trunc(value) : minimum),
  );
function withClampedHp(
  data: CalculatorData,
  side: Side,
  form: Form,
  requested = side.currentHp,
): Side {
  return {
    ...side,
    currentHp: clampInteger(requested, 0, maxHp(data, side, form)),
  };
}
function displayedForm(data: CalculatorData, side: Side): Form | undefined {
  const base = data.forms.find(({ id }) => id === side.formId);
  const relation = data.mega_item_relations.find(
    (row) => row.base_form_id === side.formId && row.item_id === side.itemId,
  );
  return side.mega && relation
    ? (data.forms.find(({ id }) => id === relation.mega_form_id) ?? base)
    : base;
}

function Choice({
  id,
  label,
  value,
  choices,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  choices: Named[];
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const selected = choices.find((row) => row.id === value);
  const [text, setText] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => setText(selected?.name ?? ""), [selected?.name]);
  const list = `${id}-choices`;
  const results = useMemo(
    () =>
      choices
        .filter(({ name }) =>
          name.toLocaleLowerCase().includes(text.trim().toLocaleLowerCase()),
        )
        .slice(0, 40),
    [choices, text],
  );
  const accept = (choice: Named) => {
    onChange(choice.id);
    setText(choice.name);
    setOpen(false);
    setActive(0);
  };
  return (
    <div class="damage-field damage-combobox">
      <label for={id}>{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={list}
        aria-expanded={open}
        aria-activedescendant={
          open && results[active] ? `${list}-${results[active].id}` : undefined
        }
        value={text}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onInput={(event) => {
          setText(event.currentTarget.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((current) => Math.min(results.length - 1, current + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => Math.max(0, current - 1));
          } else if (event.key === "Enter" && open && results[active]) {
            event.preventDefault();
            accept(results[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setText(selected?.name ?? "");
          }
        }}
        onBlur={(event) => {
          if (
            !event.currentTarget.parentElement?.contains(
              event.relatedTarget as Node,
            )
          ) {
            setOpen(false);
            setText(selected?.name ?? "");
          }
        }}
      />
      {open && !disabled && (
        <div id={list} role="listbox" class="damage-combobox__list">
          {results.length ? (
            results.map((row, index) => (
              <button
                id={`${list}-${row.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                class={index === active ? "is-active" : ""}
                onPointerDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => accept(row)}
              >
                <strong>{row.name}</strong>
              </button>
            ))
          ) : (
            <p>No matching choices.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContextControl({
  prefix,
  descriptor,
  value,
  onChange,
}: {
  prefix: string;
  descriptor: ContextInput;
  value: boolean | number | string;
  onChange: (value: boolean | number | string) => void;
}) {
  return descriptor.kind === "boolean" ? (
    <label class="damage-toggle">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {descriptor.label}
    </label>
  ) : descriptor.kind === "choice" ? (
    <label class="damage-field" for={`${prefix}-${descriptor.key}`}>
      {descriptor.label}
      <select
        id={`${prefix}-${descriptor.key}`}
        value={String(value)}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {descriptor.choices.map((choice) => (
          <option value={choice.value}>{choice.label}</option>
        ))}
      </select>
    </label>
  ) : (
    <label class="damage-field" for={`${prefix}-${descriptor.key}`}>
      {descriptor.label}
      <input
        id={`${prefix}-${descriptor.key}`}
        type="number"
        min={descriptor.minimum}
        max={descriptor.maximum}
        value={Number(value)}
        onInput={(event) =>
          onChange(
            Math.min(
              descriptor.maximum ?? Infinity,
              Math.max(
                descriptor.minimum ?? -Infinity,
                event.currentTarget.valueAsNumber,
              ),
            ),
          )
        }
      />
    </label>
  );
}

function DamageDisclosure({
  id,
  compact,
  description,
}: {
  id: string;
  compact: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      class={open ? "damage-result is-open" : "damage-result"}
      aria-expanded={open}
      aria-describedby={id}
      aria-live="polite"
      aria-atomic="true"
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.currentTarget.focus();
        }
      }}
    >
      {compact}
      <span role="tooltip" id={id}>
        {description}
      </span>
    </button>
  );
}

function PokemonPanel({
  sideId,
  side,
  opponent,
  data,
  field,
  onChange,
  onPokemonChange,
}: {
  sideId: SideId;
  side: Side;
  opponent: Side;
  data: CalculatorData;
  field: FieldState;
  onChange: (side: Side) => void;
  onPokemonChange: (side: Side) => void;
}) {
  const base = data.forms.find(({ id }) => id === side.formId);
  const form = displayedForm(data, side);
  const nature =
    data.natures.find(({ id }) => id === side.natureId) ?? data.natures[0];
  const relation = data.mega_item_relations.find(
    (row) => row.base_form_id === side.formId && row.item_id === side.itemId,
  );
  const abilityId =
    side.mega && relation ? relation.locked_ability_id : side.abilityId;
  const ability = data.abilities.find(({ id }) => id === abilityId);
  const item = data.items.find(({ id }) => id === side.itemId);
  const currentStats =
    form && nature ? stats({ form, nature, sp: side.sp }) : null;
  const update = (patch: Partial<Side>) => onChange({ ...side, ...patch });
  const updateSp = (id: StatId, raw: number) => {
    const next = {
      ...side,
      sp: { ...side.sp, [id]: clampInteger(raw, 0, 32) },
    };
    const nextForm = displayedForm(data, next);
    onChange(nextForm ? withClampedHp(data, next, nextForm) : next);
  };
  const opponentForm = displayedForm(data, opponent);
  const opponentNature =
    data.natures.find(({ id }) => id === opponent.natureId) ?? data.natures[0];
  const opponentRelation = data.mega_item_relations.find(
    (row) =>
      row.base_form_id === opponent.formId && row.item_id === opponent.itemId,
  );
  const opponentAbility = data.abilities.find(
    ({ id }) =>
      id ===
      (opponent.mega && opponentRelation
        ? opponentRelation.locked_ability_id
        : opponent.abilityId),
  );
  const opponentItem = data.items.find(({ id }) => id === opponent.itemId);
  const defender =
    opponentForm && opponentNature
      ? buildCombatant(data, opponent, opponentForm, opponentNature, {
          ...defaults(opponentAbility?.contextual_inputs),
          ...defaults(opponentItem?.contextual_inputs),
          ...opponent.abilityContext,
          ...opponent.itemContext,
        })
      : null;
  return (
    <article class="damage-pokemon" aria-labelledby={`${sideId}-heading`}>
      <header class="damage-pokemon__header">
        <div>
          <p class="eyebrow">
            {sideId === "left" ? "Left Pokémon" : "Right Pokémon"}
          </p>
          <h2 id={`${sideId}-heading`}>{form?.name ?? "Choose a Pokémon"}</h2>
        </div>
        {form && (
          <img
            src={data.sprite_url_template
              .replace("__FORM__", form.sprite_form_id)
              .replace("{sprite_form_id}", form.sprite_form_id)
              .replace("__VARIANT__", "normal")}
            alt=""
          />
        )}
      </header>
      <Choice
        id={`${sideId}-pokemon`}
        label="Pokémon"
        value={side.formId}
        choices={data.forms.filter(({ searchable }) => searchable)}
        onChange={(id) => {
          const next = data.forms.find((row) => row.id === id);
          onPokemonChange(newSide(data, next));
        }}
      />
      {base && (
        <>
          <div class="damage-choice-grid">
            {base.gender === "variable" && (
              <label class="damage-field" for={`${sideId}-gender`}>
                Gender
                <select
                  id={`${sideId}-gender`}
                  value={side.gender}
                  onChange={(event) =>
                    update({ gender: event.currentTarget.value as "M" | "F" })
                  }
                >
                  {base.gender_options.map((gender) => (
                    <option value={gender}>
                      {gender === "M" ? "Male" : "Female"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Choice
              id={`${sideId}-ability`}
              label="Ability"
              value={abilityId}
              disabled={side.mega && Boolean(relation)}
              choices={
                base.abilities
                  .map(({ id }) => data.abilities.find((row) => row.id === id))
                  .filter(Boolean) as Named[]
              }
              onChange={(abilityId) =>
                update({ abilityId, abilityContext: {} })
              }
            />
            <Choice
              id={`${sideId}-item`}
              label="Item"
              value={side.itemId}
              choices={data.items}
              onChange={(itemId) =>
                (() => {
                  const next = {
                    ...side,
                    itemId,
                    itemContext: {},
                    mega: itemId === side.itemId ? side.mega : false,
                  };
                  const nextForm = displayedForm(data, next);
                  onChange(
                    nextForm ? withClampedHp(data, next, nextForm) : next,
                  );
                })()
              }
            />
            <Choice
              id={`${sideId}-nature`}
              label="Nature"
              value={side.natureId}
              choices={data.natures}
              onChange={(natureId) => natureId && update({ natureId })}
            />
          </div>
          {relation && (
            <button
              type="button"
              class={side.mega ? "mega-toggle is-active" : "mega-toggle"}
              aria-pressed={side.mega}
              onClick={() =>
                (() => {
                  const next = {
                    ...side,
                    mega: !side.mega,
                    abilityContext: {},
                  };
                  const nextForm = displayedForm(data, next) ?? base;
                  onChange(withClampedHp(data, next, nextForm));
                })()
              }
            >
              {side.mega
                ? "Use base form"
                : `Preview ${data.forms.find(({ id }) => id === relation.mega_form_id)?.name ?? "Mega form"}`}
            </button>
          )}
          <section
            class="damage-stats"
            aria-labelledby={`${sideId}-stats-title`}
          >
            <header>
              <h3 id={`${sideId}-stats-title`}>Stats</h3>
              <strong>
                {statIds.reduce((sum, id) => sum + side.sp[id], 0)} SP
              </strong>
            </header>
            {statIds.map((id) => (
              <div class="damage-stat">
                <label for={`${sideId}-sp-${id}`}>
                  {statLabels[id]} <output>{currentStats?.[id] ?? "—"}</output>
                </label>
                <input
                  id={`${sideId}-sp-${id}`}
                  type="range"
                  min="0"
                  max="32"
                  value={side.sp[id]}
                  onInput={(event) =>
                    updateSp(id, event.currentTarget.valueAsNumber)
                  }
                />
                <input
                  aria-label={`${statLabels[id]} SP`}
                  type="number"
                  min="0"
                  max="32"
                  value={side.sp[id]}
                  onInput={(event) =>
                    updateSp(id, event.currentTarget.valueAsNumber)
                  }
                />
              </div>
            ))}
          </section>
          <div class="damage-battle-state">
            <label class="damage-field">
              Current HP{" "}
              <span>
                {currentStats
                  ? ((side.currentHp / currentStats.hp) * 100).toFixed(1)
                  : "0.0"}
                %
              </span>
              <input
                type="number"
                min="0"
                max={currentStats?.hp}
                value={side.currentHp}
                onInput={(event) =>
                  update({
                    currentHp: clampInteger(
                      event.currentTarget.valueAsNumber,
                      0,
                      currentStats?.hp ?? 0,
                    ),
                  })
                }
              />
            </label>
            <label class="damage-field">
              Status
              <select
                value={side.status}
                onChange={(event) =>
                  update({ status: event.currentTarget.value })
                }
              >
                <option value="">Healthy</option>
                {data.capability.status_values.filter(Boolean).map((status) => (
                  <option value={status}>{status.toUpperCase()}</option>
                ))}
              </select>
            </label>
            {Object.entries(stageLabels).map(([id, label]) => (
              <label class="damage-field">
                {label} stage
                <select
                  value={side.stages[id as keyof Side["stages"]]}
                  onChange={(event) =>
                    update({
                      stages: {
                        ...side.stages,
                        [id]: Number(event.currentTarget.value),
                      },
                    })
                  }
                >
                  {Array.from({ length: 13 }, (_, index) => index - 6).map(
                    (value) => (
                      <option value={value}>
                        {value > 0 ? `+${value}` : value}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ))}
          </div>
          {Boolean(
            ability?.contextual_inputs.length || item?.contextual_inputs.length,
          ) && (
            <fieldset class="damage-context">
              <legend>Conditional state</legend>
              {ability?.contextual_inputs.map((descriptor) => (
                <ContextControl
                  prefix={`${sideId}-ability`}
                  descriptor={descriptor}
                  value={
                    side.abilityContext[descriptor.key] ?? descriptor.default
                  }
                  onChange={(value) =>
                    update({
                      abilityContext: {
                        ...side.abilityContext,
                        [descriptor.key]: value,
                      },
                    })
                  }
                />
              ))}
              {item?.contextual_inputs.map((descriptor) => (
                <ContextControl
                  prefix={`${sideId}-item`}
                  descriptor={descriptor}
                  value={side.itemContext[descriptor.key] ?? descriptor.default}
                  onChange={(value) =>
                    update({
                      itemContext: {
                        ...side.itemContext,
                        [descriptor.key]: value,
                      },
                    })
                  }
                />
              ))}
            </fieldset>
          )}
          <section
            class="damage-moves"
            aria-labelledby={`${sideId}-moves-title`}
          >
            <h3 id={`${sideId}-moves-title`}>Moves</h3>
            {side.moveIds.map((moveId, index) => {
              const move = data.moves.find(({ id }) => id === moveId);
              const moveContext = side.moveContexts[index] ?? {};
              const combatant =
                form && nature && move
                  ? buildCombatant(data, side, form, nature, {
                      ...defaults(ability?.contextual_inputs),
                      ...defaults(item?.contextual_inputs),
                      ...defaults(move.contextual_inputs),
                      ...side.abilityContext,
                      ...side.itemContext,
                      ...moveContext,
                    })
                  : null;
              const result =
                combatant && defender && move
                  ? calculate(
                      data,
                      combatant,
                      defender,
                      move,
                      calculationField(sideId, field),
                    )
                  : null;
              return (
                <div class="damage-move">
                  {result ? (
                    <DamageDisclosure
                      id={`${sideId}-result-${index}`}
                      compact={result.compact}
                      description={result.description}
                    />
                  ) : (
                    <button type="button" class="damage-result" disabled>
                      —
                    </button>
                  )}
                  <Choice
                    id={`${sideId}-move-${index}`}
                    label={`Move ${index + 1}`}
                    value={moveId}
                    choices={
                      base.move_ids
                        .map((id) => data.moves.find((row) => row.id === id))
                        .filter(Boolean) as Named[]
                    }
                    onChange={(id) => {
                      const moveIds = [...side.moveIds];
                      moveIds[index] = id;
                      const moveContexts = [...side.moveContexts];
                      moveContexts[index] = {};
                      update({ moveIds, moveContexts });
                    }}
                  />
                  {move && move.contextual_inputs.length > 0 && (
                    <fieldset class="damage-context damage-context--move">
                      <legend>{move.name} state</legend>
                      {move.contextual_inputs.map((descriptor) => (
                        <ContextControl
                          prefix={`${sideId}-move-${index}`}
                          descriptor={descriptor}
                          value={
                            moveContext[descriptor.key] ?? descriptor.default
                          }
                          onChange={(value) => {
                            const moveContexts = [...side.moveContexts];
                            moveContexts[index] = {
                              ...moveContext,
                              [descriptor.key]: value,
                            };
                            update({ moveContexts });
                          }}
                        />
                      ))}
                    </fieldset>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </article>
  );
}

function buildCombatant(
  data: CalculatorData,
  side: Side,
  form: Form,
  nature: CalculatorData["natures"][number],
  context: Record<string, boolean | number | string>,
): Combatant {
  const relation = data.mega_item_relations.find(
    (row) => row.base_form_id === side.formId && row.item_id === side.itemId,
  );
  const abilityId =
    side.mega && relation ? relation.locked_ability_id : side.abilityId;
  return {
    form,
    gender: side.gender,
    nature,
    ability: data.abilities.find(({ id }) => id === abilityId),
    item: data.items.find(({ id }) => id === side.itemId),
    sp: side.sp,
    stages: side.stages,
    status: side.status,
    currentHp: side.currentHp,
    context,
  };
}
const defaults = (descriptors: ContextInput[] | undefined) =>
  Object.fromEntries(
    (descriptors ?? []).map(({ key, default: value }) => [key, value]),
  );
function calculationField(side: SideId, state: FieldState): Field {
  const attacker = state[side];
  const defender = state[side === "left" ? "right" : "left"];
  return {
    weather: state.weather,
    terrain: state.terrain,
    attacker: {
      helpingHand: attacker.helpingHand,
      singleTarget: attacker.singleTarget,
      critical: attacker.critical,
      tailwind: attacker.tailwind,
    },
    defender: {
      reflect: defender.reflect,
      lightScreen: defender.lightScreen,
      auroraVeil: defender.auroraVeil,
      friendGuard: defender.friendGuard,
      tailwind: defender.tailwind,
    },
  };
}

function FieldEffects({
  value,
  onChange,
}: {
  value: FieldState;
  onChange: (value: FieldState) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = [
    value.weather,
    value.terrain,
    ...(["left", "right"] as SideId[]).flatMap((side) =>
      Object.entries(value[side])
        .filter(([, active]) => active)
        .map(([name]) => `${side} ${name}`),
    ),
  ].filter(Boolean);
  const choices = {
    weather: ["sun", "rain", "sand", "snow"],
    terrain: ["electric", "grassy", "psychic", "misty"],
  } as const;
  const label = (value: string) => {
    const words = value.replace(/([A-Z])/g, " $1").toLowerCase();
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
  };
  return (
    <section class="field-effects">
      <button
        type="button"
        class="field-effects__summary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>Field Effects</span>
        <small>{summary.length ? summary.join(" · ") : "None active"}</small>
      </button>
      {open && (
        <div class="field-effects__body">
          {(
            Object.entries(choices) as [
              keyof typeof choices,
              readonly string[],
            ][]
          ).map(([group, options]) => (
            <fieldset class="field-effects__group" key={group}>
              <legend>{group === "weather" ? "Weather" : "Terrain"}</legend>
              <div class="field-effects__cells">
                {options.map((option) => (
                  <button
                    type="button"
                    class="field-effect-cell"
                    key={option}
                    aria-pressed={value[group] === option}
                    onClick={() =>
                      onChange({
                        ...value,
                        [group]: value[group] === option ? "" : option,
                      })
                    }
                  >
                    {label(option)}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {(["left", "right"] as SideId[]).map((side) => (
            <fieldset class="field-effects__group" key={side}>
              <legend>{side === "left" ? "Left" : "Right"}</legend>
              <div class="field-effects__cells">
                {Object.entries(value[side]).map(([key, active]) => (
                  <button
                    type="button"
                    class="field-effect-cell"
                    key={key}
                    aria-pressed={active}
                    onClick={() =>
                      onChange({
                        ...value,
                        [side]: { ...value[side], [key]: !active },
                      })
                    }
                  >
                    {label(key)}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}

export function DamageCalculator({ bootstrap }: { bootstrap: Bootstrap }) {
  const [data, setData] = useState<CalculatorData | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState<Side | null>(null);
  const [right, setRight] = useState<Side | null>(null);
  const [field, setField] = useState(emptyField);
  useEffect(() => {
    const controller = new AbortController();
    fetch(bootstrap.dataset_url, {
      credentials: "same-origin",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 409
              ? "The active Pokémon data changed. Reload this page."
              : "Damage calculation data could not be loaded.",
          );
        return parseCalculatorData(await response.json());
      })
      .then((parsed) => {
        if (
          parsed.data_version !== bootstrap.active_version ||
          parsed.regulation.id !== bootstrap.regulation.id
        )
          throw new Error(
            "The damage calculator data does not match this page.",
          );
        setData(parsed);
        setLeft(newSide(parsed));
        setRight(newSide(parsed));
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError")
          setError(
            reason instanceof Error
              ? reason.message
              : "Damage calculation data could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [bootstrap]);
  if (error)
    return (
      <section class="damage-state damage-state--error" role="alert">
        <h1>Damage Calculator</h1>
        <p>{error}</p>
      </section>
    );
  if (!data || !left || !right)
    return (
      <section class="damage-state" aria-live="polite">
        <h1>Damage Calculator</h1>
        <p>Loading calculation data…</p>
      </section>
    );
  const changePokemon = (setter: (side: Side) => void) => (side: Side) => {
    setter(side);
    setField(emptyField());
  };
  return (
    <div class="damage-calculator">
      <FieldEffects value={field} onChange={setField} />
      <div class="damage-matchup">
        <PokemonPanel
          sideId="left"
          side={left}
          opponent={right}
          data={data}
          field={field}
          onChange={setLeft}
          onPokemonChange={changePokemon(setLeft)}
        />
        <PokemonPanel
          sideId="right"
          side={right}
          opponent={left}
          data={data}
          field={field}
          onChange={setRight}
          onPokemonChange={changePokemon(setRight)}
        />
      </div>
      <p class="visually-hidden" aria-live="polite">
        Damage results update automatically.
      </p>
    </div>
  );
}
