import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type {
  AbilityDetail,
  BuilderData,
  Bootstrap,
  ItemDetail,
  Member,
  MoveDetail,
  Named,
  Team,
  TeamSummary,
} from "./contracts";
import { CategoryIcon, InformationIcon, MegaIcon, ShinyIcon } from "../icons";
import {
  parseBuilderData,
  parseProblem,
  parseTeam,
  serializeDraft,
} from "./contracts";
import {
  matches,
  baseStatTotal,
  clampSpEdit,
  memberFromPaletteChoice,
  moveMember,
  newMember,
  paletteChoices,
  paletteResults,
  sortPaletteForms,
  realStats,
  memberWithForm,
  spTotal,
  statIds,
  statLabels,
  type PaletteFilter,
  type PaletteChoice,
  validateLocal,
} from "./model";
import { searchEntryForForm } from "../form-search";
import {
  SearchLiveCount,
  SearchOptionGroup,
  SearchOptionRow,
  SearchTextField,
  useActiveOptionScroll,
} from "../search-list";
import {
  cycleSort,
  shortStatLabels,
  statKeys,
  statLabels as pokedexStatLabels,
  type Sort,
} from "../model";

type Status = {
  kind: "idle" | "loading" | "saving" | "success" | "error";
  message?: string;
};
export type AutocompleteTransient = { text: string; invalid: boolean };
export function prepareDraftForSave(
  draft: Team,
  data: BuilderData,
  transients: Map<string, AutocompleteTransient>,
) {
  const team = clone(draft);
  const errors = team.members.flatMap((member, index) => {
    const domain = validateLocal(member, data, team.members, index);
    const paths = [
      "ability",
      "item",
      "move-0",
      "move-1",
      "move-2",
      "move-3",
      "nature",
    ];
    const transientPath = paths.find(
      (path) => transients.get(`${member.form_id}:${path}`)?.invalid,
    );
    const domainPath = Object.keys(domain).at(0);
    const path = transientPath ?? domainPath;
    return path ? [{ member, path }] : [];
  });
  return { team, firstError: errors.at(0) };
}
export const fieldPathToDomPath = (path: string) =>
  path
    .replace("ability_id", "ability")
    .replace("item_id", "item")
    .replace("nature_id", "nature")
    .replace("move_ids.", "move-")
    .replace("sp.", "sp-")
    .replace(/^sp$/, "sp-hp");
const clone = <T,>(value: T): T => structuredClone(value);
const same = (a: Team, b: Team) => JSON.stringify(a) === JSON.stringify(b);
const csrf = () =>
  document.querySelector<HTMLInputElement>("[name=csrfmiddlewaretoken]")
    ?.value ?? "";

export function Autocomplete({
  label,
  inputId,
  value,
  choices,
  disabled,
  error,
  next,
  onChange,
  onValidityChange,
  forceInvalid = false,
  informationDescriptionId,
  informationControlId,
  transient,
  onTransientChange,
}: {
  label: string;
  inputId: string;
  value: string | null;
  choices: Named[];
  disabled?: boolean;
  error?: string;
  next?: string;
  onChange: (id: string | null) => void;
  onValidityChange?: (inputId: string, invalid: boolean) => void;
  forceInvalid?: boolean;
  informationDescriptionId?: string;
  informationControlId?: string;
  transient?: AutocompleteTransient;
  onTransientChange?: (state: AutocompleteTransient) => void;
}) {
  const selected = choices.find((item) => item.id === value);
  const [query, setQuery] = useState(transient?.text ?? selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalidText, setInvalidText] = useState(false);
  const previousName = useRef(selected?.name ?? "");
  const userEditing = useRef(false);
  useEffect(() => {
    if (transient) {
      setQuery(transient.text);
      setInvalidText(transient.invalid);
      return;
    }
    if (selected) {
      previousName.current = selected.name;
      userEditing.current = false;
      setQuery(selected.name);
      setInvalidText(false);
      onValidityChange?.(inputId, false);
    } else if (value) {
      userEditing.current = true;
      setQuery((current) => current || previousName.current);
      onChange(null);
      setInvalidText(true);
      onValidityChange?.(inputId, true);
    } else if (!userEditing.current) {
      setQuery("");
      setInvalidText(false);
      onValidityChange?.(inputId, false);
    }
  }, [value, selected?.name, transient?.text, transient?.invalid]);
  const results = useMemo(
    () =>
      choices
        .filter((item) => matches(item.name, query))
        .sort(
          (left, right) =>
            left.name.localeCompare(right.name) ||
            left.id.localeCompare(right.id),
        ),
    [choices, query],
  );
  const listId = `choices-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${next ?? "last"}`;
  useEffect(() => {
    if (!open || !results[active]) return;
    document
      .getElementById(`${listId}-option-${results[active].id}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId, open, results]);
  const errorId = `${inputId}-error`;
  const visibleError =
    error ??
    (invalidText || forceInvalid
      ? `Choose a valid ${label.toLowerCase()}.`
      : undefined);
  const resolveExact = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setQuery("");
      userEditing.current = false;
      onChange(null);
      setInvalidText(false);
      onValidityChange?.(inputId, false);
      onTransientChange?.({ text: "", invalid: false });
      return true;
    }
    const exact = choices.find(
      (item) => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
    );
    if (exact) {
      accept(exact, false);
      return true;
    }
    onChange(null);
    userEditing.current = true;
    setInvalidText(true);
    onValidityChange?.(inputId, true);
    onTransientChange?.({ text: query, invalid: true });
    return false;
  };
  function accept(choice: Named, advance = true): void {
    onChange(choice.id);
    setQuery(choice.name);
    previousName.current = choice.name;
    userEditing.current = false;
    setInvalidText(false);
    onValidityChange?.(inputId, false);
    onTransientChange?.({ text: choice.name, invalid: false });
    setOpen(false);
    if (advance && next)
      requestAnimationFrame(() => document.getElementById(next)?.focus());
  }
  return (
    <div class="team-field autocomplete">
      <label>
        {label}
        <input
          id={inputId}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
          value={query}
          disabled={disabled}
          aria-invalid={Boolean(visibleError)}
          aria-describedby={
            [visibleError ? errorId : null, informationDescriptionId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-activedescendant={
            open && results[active]
              ? `${listId}-option-${results[active].id}`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            userEditing.current = true;
            setOpen(true);
            setActive(0);
            setInvalidText(false);
            onValidityChange?.(inputId, false);
            onTransientChange?.({
              text: event.currentTarget.value,
              invalid: false,
            });
            if (event.currentTarget.value !== selected?.name) {
              onChange(null);
            }
          }}
          onBlur={() => {
            setOpen(false);
            resolveExact();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive(Math.min(active + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive(Math.max(0, active - 1));
            }
            if (event.key === "Escape") {
              setOpen(false);
              setActive(0);
              event.currentTarget.blur();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const exact = results.find(
                (item) =>
                  item.name.toLocaleLowerCase() ===
                  query.trim().toLocaleLowerCase(),
              );
              const choice = exact ?? results[active];
              if (choice) accept(choice);
            }
            if (
              event.altKey &&
              event.key.toLocaleLowerCase() === "i" &&
              informationControlId
            ) {
              event.preventDefault();
              document.getElementById(informationControlId)?.click();
            }
          }}
        />
      </label>
      {visibleError && (
        <span class="field-error" id={errorId}>
          {visibleError}
        </span>
      )}
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" class="autocomplete__list">
          {results.map((choice, index) => (
            <li
              id={`${listId}-option-${choice.id}`}
              key={choice.id}
              role="option"
              aria-selected={index === active}
              class={index === active ? "is-active" : undefined}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => accept(choice)}
              >
                {choice.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PokemonPalette({
  data,
  members,
  onClose,
  onChoose,
}: {
  data: BuilderData;
  members: Member[];
  onClose: () => void;
  onChoose: (form: PaletteChoice) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PaletteFilter[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const [activeOption, setActiveOption] = useState<{
    kind: "pokemon" | "move" | "ability" | "type";
    id: string;
  } | null>(null);
  const used = new Set(
    members
      .map(
        (member) =>
          data.forms.find((form) => form.id === member.form_id)
            ?.base_species_id,
      )
      .filter(Boolean) as string[],
  );
  const results = sortPaletteForms(
    paletteResults(paletteChoices(data), query, filters, used),
    sort,
  );
  const matchingFilters: PaletteFilter[] = query
    ? [
        ...data.types.map((x) => ({ ...x, kind: "type" as const })),
        ...data.abilities.map((x) => ({ ...x, kind: "ability" as const })),
        ...data.moves.map((x) => ({ ...x, kind: "move" as const })),
      ].filter((item) => matches(item.name, query))
    : [];
  const filterGroups = (["move", "ability", "type"] as const)
    .map((kind) => ({
      kind,
      values: matchingFilters.filter((item) => item.kind === kind).slice(0, 8),
    }))
    .filter((group) => group.values.length > 0);
  const filterSuggestions = filterGroups.flatMap((group) => group.values);
  const options = [
    ...results.map((value) => ({ kind: "pokemon" as const, value })),
    ...filterGroups.flatMap((group) =>
      group.values.map((value) => ({ kind: "filter" as const, value })),
    ),
  ];
  const groupStarts = [
    ...(results.length ? [0] : []),
    ...filterGroups.map(
      (_, groupIndex) =>
        results.length +
        filterGroups
          .slice(0, groupIndex)
          .reduce((total, group) => total + group.values.length, 0),
    ),
  ];
  const identity = (option: (typeof options)[number]) => ({
    kind: option.kind === "pokemon" ? ("pokemon" as const) : option.value.kind,
    id: option.value.id,
  });
  const active = options.findIndex((option) => {
    const value = identity(option);
    return value.kind === activeOption?.kind && value.id === activeOption.id;
  });
  const optionId = (option: (typeof options)[number]) => {
    const value = identity(option);
    return `pokemon-picker-option-${value.kind}-${value.id}`;
  };
  const setActive = (index: number) =>
    setActiveOption(options[index] ? identity(options[index]) : null);
  const pokemonPopupActive =
    activeOption?.kind === "pokemon" || (!activeOption && results.length > 0);
  useActiveOptionScroll(
    active >= 0 && options[active] ? optionId(options[active]) : undefined,
  );
  useEffect(() => {
    if (active < 0) setActive(0);
  }, [query, filters.length, options.length]);
  useEffect(() => {
    search.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const close = () => onClose();
  const activate = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (option.kind === "pokemon") {
      onChoose(option.value);
      return;
    }
    if (
      !filters.some(
        (value) =>
          value.kind === option.value.kind && value.id === option.value.id,
      )
    )
      setFilters([...filters, option.value]);
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => search.current?.focus());
  };
  return (
    <div
      class="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        class="pokemon-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key === "Tab") {
            const focusable = [
              ...dialog.current!.querySelectorAll<HTMLElement>("button,input"),
            ].filter((el) => !el.hasAttribute("disabled"));
            const first = focusable[0],
              last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <div>
            <p class="eyebrow">Add a team member</p>
            <h2 id="palette-title">Choose a Pokémon</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="Close Pokémon picker"
            onClick={close}
          >
            ×
          </button>
        </header>
        <SearchTextField
          className="palette-search"
          inputRef={search}
          inputId="pokemon-picker-search"
          label="Search names, moves, abilities, or types"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={
            pokemonPopupActive
              ? "pokemon-result-grid"
              : "pokemon-filter-options"
          }
          aria-haspopup={pokemonPopupActive ? "grid" : "listbox"}
          aria-expanded="true"
          aria-activedescendant={
            active >= 0 && options[active]
              ? optionId(options[active])
              : undefined
          }
          autocomplete="off"
          value={query}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (
              event.altKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              groupStarts.length
            ) {
              event.preventDefault();
              const currentGroup = groupStarts.findIndex((start, index) => {
                const next = groupStarts[index + 1] ?? options.length;
                return active >= start && active < next;
              });
              const delta = event.key === "ArrowDown" ? 1 : -1;
              const base =
                currentGroup < 0 ? (delta > 0 ? -1 : 0) : currentGroup;
              setActive(
                groupStarts[
                  (base + delta + groupStarts.length) % groupStarts.length
                ]!,
              );
            } else if (event.key === "ArrowDown" && options.length) {
              event.preventDefault();
              setActive((active + 1) % options.length);
            } else if (event.key === "ArrowUp" && options.length) {
              event.preventDefault();
              setActive(active <= 0 ? options.length - 1 : active - 1);
            } else if (event.key === "Home" && options.length) {
              event.preventDefault();
              setActive(0);
            } else if (event.key === "End" && options.length) {
              event.preventDefault();
              setActive(options.length - 1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              activate(active);
            }
          }}
        />
        <SearchLiveCount>{results.length} matching Pokémon</SearchLiveCount>
        <div class="pokemon-palette__results">
          {filters.length > 0 && (
            <div class="filter-chips" aria-label="Active filters">
              {filters.map((item) => (
                <button
                  type="button"
                  aria-label={`Remove ${item.name} ${item.kind} filter`}
                  onClick={() => setFilters(filters.filter((x) => x !== item))}
                >
                  {item.name} <span>×</span>
                </button>
              ))}
            </div>
          )}
          <div id="pokemon-results" class="search-list pokemon-results">
            {results.length > 0 && (
              <table
                id="pokemon-result-grid"
                class="pokemon-picker-table"
                role="grid"
                aria-label="Available Pokémon and base stats"
              >
                <caption class="visually-hidden">
                  Available Pokémon and base stats
                </caption>
                <colgroup>
                  <col class="pokemon-picker-col pokemon-picker-col--identity" />
                  {statKeys.map((key) => (
                    <col
                      class="pokemon-picker-col pokemon-picker-col--stat"
                      key={key}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Pokémon</th>
                    {statKeys.map((key) => (
                      <th
                        scope="col"
                        aria-sort={sort?.key === key ? sort.direction : "none"}
                      >
                        <button
                          type="button"
                          class={sort?.key === key ? "sort is-active" : "sort"}
                          aria-label={`Sort by ${pokedexStatLabels[key]}${sort?.key === key ? `, ${sort.direction}` : ""}`}
                          onClick={() =>
                            setSort((current) => cycleSort(current, key))
                          }
                        >
                          <span class="sort-label">{shortStatLabels[key]}</span>
                          <span
                            class={`sort-indicator${sort?.key === key ? "" : " is-inactive"}`}
                            aria-hidden="true"
                          >
                            {sort?.key === key
                              ? sort.direction === "ascending"
                                ? "↑"
                                : "↓"
                              : "↑"}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((form, index) => (
                    <tr
                      id={optionId(options[index]!)}
                      role="row"
                      tabIndex={-1}
                      class={active === index ? "is-active" : ""}
                      aria-selected={active === index}
                      onMouseMove={() => setActive(index)}
                      onClick={() => activate(index)}
                    >
                      <th scope="row">
                        <span class="pokemon-picker-table__identity">
                          <img src={form.sprites.normal} alt="" />
                          <span class="pokemon-picker-table__identity-copy">
                            <strong title={form.name}>{form.name}</strong>
                            {form.kind === "mega" && (
                              <small class="pokemon-picker-table__mega">
                                Mega choice
                              </small>
                            )}
                            <small
                              title={form.types
                                .map((type) => type.name)
                                .join(" · ")}
                            >
                              {form.types.map((type) => type.name).join(" · ")}
                            </small>
                          </span>
                        </span>
                      </th>
                      {statKeys.map((key) => (
                        <td data-label={shortStatLabels[key]}>
                          {key === "bst"
                            ? baseStatTotal(form.base_stats)
                            : form.base_stats[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {filterGroups.length > 0 && (
              <div
                id="pokemon-filter-options"
                class="pokemon-picker-filters"
                role="listbox"
                aria-label="Matching filters"
              >
                {filterGroups.map((group, groupIndex) => (
                  <SearchOptionGroup
                    id={`pokemon-filter-group-${group.kind}`}
                    label={
                      group.kind === "move"
                        ? "Moves"
                        : group.kind === "ability"
                          ? "Abilities"
                          : "Types"
                    }
                  >
                    {group.values.map((item, filterIndex) => {
                      const index =
                        results.length +
                        filterGroups
                          .slice(0, groupIndex)
                          .reduce(
                            (total, previous) => total + previous.values.length,
                            0,
                          ) +
                        filterIndex;
                      return (
                        <SearchOptionRow
                          id={optionId(options[index]!)}
                          active={active === index}
                          onPointerActive={() => setActive(index)}
                          onActivate={() => activate(index)}
                          key={`${item.kind}-${item.id}`}
                          className="pokemon-result-row pokemon-result-row--filter"
                        >
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.kind}</small>
                          </span>
                        </SearchOptionRow>
                      );
                    })}
                  </SearchOptionGroup>
                ))}
              </div>
            )}
            {results.length === 0 && filterSuggestions.length === 0 && (
              <p class="suggestions__empty state-inline">
                {!query &&
                filters.length === 0 &&
                data.forms.every((form) => used.has(form.base_species_id))
                  ? "No Pokémon available"
                  : "No available Pokémon match every filter."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type FieldInformation =
  | { kind: "ability"; value: AbilityDetail }
  | {
      kind: "item";
      value: ItemDetail & { short_description: string; description: string };
    }
  | { kind: "move"; value: MoveDetail };

const formatMoveTarget = (target: string) => {
  const spaced = target
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

function FieldInformationControl({
  info,
  controlId,
}: {
  info: FieldInformation | null;
  controlId: string;
}) {
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const invoker = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (typeof element?.showModal === "function") element.showModal();
    if (element && !element.open) element.setAttribute("open", "");
    element?.querySelector<HTMLElement>(".dialog-close")?.focus();
  }, [open]);
  useEffect(() => {
    if (!info) setOpen(false);
  }, [info]);
  if (!info) return null;
  const tooltipId = `${controlId}-tooltip`;
  const descriptionId = `${controlId}-description`;
  const titleId = `${controlId}-dialog-title`;
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    queueMicrotask(() => invoker.current?.focus());
  };
  return (
    <span class="field-information">
      <button
        ref={button}
        id={controlId}
        type="button"
        class="field-information__button"
        tabIndex={-1}
        aria-label={`Show ${info.value.name} ${info.kind} information`}
        aria-describedby={tooltip ? tooltipId : undefined}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        onFocus={() => setTooltip(true)}
        onBlur={() => setTooltip(false)}
        onClick={() => {
          const active = document.activeElement;
          invoker.current =
            active instanceof HTMLInputElement ? active : button.current;
          setTooltip(false);
          setOpen(true);
        }}
      >
        <InformationIcon />
      </button>
      <span class="visually-hidden" id={descriptionId}>
        {info.value.short_description} Press Alt+I for information.
      </span>
      {tooltip && (
        <span class="field-information__tooltip" id={tooltipId} role="tooltip">
          {info.value.short_description}
        </span>
      )}
      {open && (
        <dialog
          ref={dialog}
          class="info-dialog"
          aria-labelledby={titleId}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            event.currentTarget
              .querySelector<HTMLElement>(".dialog-close")
              ?.focus();
          }}
        >
          <div class="info-dialog__surface">
            <header>
              <h2 id={titleId}>{info.value.name}</h2>
              <button
                type="button"
                class="dialog-close"
                aria-label="Close details"
                onClick={close}
              >
                ×
              </button>
            </header>
            {info.kind !== "move" ? (
              <p class="info-description">{info.value.description}</p>
            ) : (
              <div>
                <div class="info-grid">
                  <span class="info-pill">{info.value.type.name}</span>
                  <span>
                    <CategoryIcon category={info.value.category} />{" "}
                    {info.value.category}
                  </span>
                  <span>
                    <b>Power:</b> {info.value.base_power}
                  </span>
                  <span>
                    <b>Accuracy:</b>{" "}
                    {info.value.always_hits
                      ? "Always hits"
                      : info.value.accuracy}
                  </span>
                  <span>
                    <b>PP:</b> {info.value.pp}
                  </span>
                  <span>
                    <b>Priority:</b> {info.value.priority}
                  </span>
                  <span>
                    <b>Target:</b> {formatMoveTarget(info.value.target)}
                  </span>
                </div>
                <p class="info-description">{info.value.description}</p>
                <div class="info-flags">
                  <b>Flags:</b>{" "}
                  {info.value.flags.length
                    ? info.value.flags.join(", ")
                    : "None"}
                </div>
              </div>
            )}
          </div>
        </dialog>
      )}
    </span>
  );
}

export function MemberEditor({
  member,
  index,
  slot,
  data,
  allMembers,
  onChange,
  onRemove,
  onMove,
  serverErrors,
  onAnnounce,
  autocompleteTransients = new Map(),
  onAutocompleteTransient = () => undefined,
  expanded = true,
  onExpand = () => undefined,
  onCollapse = () => undefined,
}: {
  member: Member;
  index: number;
  slot: number;
  data: BuilderData;
  allMembers: Member[];
  onChange: (member: Member) => void;
  onRemove: () => void;
  onMove: (delta: number) => number | null;
  serverErrors: Record<string, string[]>;
  onAnnounce: (message: string) => void;
  autocompleteTransients?: Map<string, AutocompleteTransient>;
  onAutocompleteTransient?: (key: string, state: AutocompleteTransient) => void;
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const form = data.forms.find((item) => item.id === member.form_id)!;
  const searchEntry = searchEntryForForm(
    data.pokemon_search_entries,
    member.form_id,
  );
  const nature = data.natures.find((item) => item.id === member.nature_id) ??
    data.natures.find((item) => item.id === "serious") ?? {
      id: "serious",
      name: "Serious",
      increased_stat: null,
      decreased_stat: null,
    };
  const mega = data.mega_relations.find(
    (relation) =>
      relation.form_id === member.form_id &&
      relation.item_id === member.item_id,
  );
  const display = member.mega_preview && mega ? mega.target : form;
  const abilityDetail =
    member.mega_preview && mega
      ? data.abilities.find((item) => item.id === mega.target.ability.id)
      : data.abilities.find((item) => item.id === member.ability_id);
  const selectedItem = data.items.find((item) => item.id === member.item_id);
  const stats = realStats(
    display,
    member.sp,
    nature,
    selectedItem ?? null,
    abilityDetail ?? null,
  );
  const errors = validateLocal(member, data, allMembers, index);
  const serverError = (path: string) =>
    serverErrors[`members.${index}.${path}`]?.join(" ");
  const nicknameError = serverError("nickname");
  const spServerPath = {
    hp: "hp",
    atk: "attack",
    def: "defense",
    spa: "special_attack",
    spd: "special_defense",
    spe: "speed",
  } as const;
  const prefix = `member-${slot}`;
  const transientKey = (path: string) => `${member.form_id}:${path}`;
  const update = <K extends keyof Member>(key: K, value: Member[K]) =>
    onChange({ ...member, [key]: value });
  const updateSp = (id: (typeof statIds)[number], requested: number) =>
    update("sp", {
      ...member.sp,
      [id]: clampSpEdit(member.sp, id, requested, data.mechanics),
    });
  const availableItems = data.items.filter(
    (item) =>
      item.id === member.item_id ||
      !allMembers.some((other, i) => i !== index && other.item_id === item.id),
  );
  const itemDetail =
    selectedItem?.short_description && selectedItem.description
      ? {
          ...selectedItem,
          short_description: selectedItem.short_description,
          description: selectedItem.description,
        }
      : null;
  if (!expanded) {
    const ability =
      member.mega_preview && mega
        ? mega.target.ability.name
        : data.abilities.find((item) => item.id === member.ability_id)?.name;
    const item = data.items.find(
      (choice) => choice.id === member.item_id,
    )?.name;
    const moves = member.move_ids
      .map((id) => data.moves.find((choice) => choice.id === id)?.name)
      .filter(Boolean) as string[];
    const allocations = statIds
      .filter((id) => member.sp[id] > 0)
      .map((id) => `${statLabels[id]} ${member.sp[id]}`);
    const summary = [
      ability && `Ability: ${ability}`,
      item && `Item: ${item}`,
      moves.length && `Moves: ${moves.join(", ")}`,
      nature && `Nature: ${nature.name}`,
      allocations.length && `SP: ${allocations.join(", ")}`,
      member.shiny && "Shiny",
      member.mega_preview &&
        mega &&
        `Mega: ${mega.target.name} · ${mega.target.ability.name}`,
    ].filter(Boolean) as string[];
    return (
      <article
        class="member-card member-card--collapsed"
        aria-labelledby={`${prefix}-title`}
        style={{ order: slot }}
        data-member-slot={slot}
      >
        <div
          id={`${prefix}-card`}
          class="collapsed-member__surface"
          aria-expanded="false"
          role="button"
          tabIndex={0}
          onClick={onExpand}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onExpand();
            }
          }}
        >
          <div class="collapsed-member__identity">
            <span class="slot-number">{slot + 1}</span>
            <img
              src={
                member.shiny ? display.sprites.shiny : display.sprites.normal
              }
              alt=""
            />
            <div>
              <h2 id={`${prefix}-title`}>{form.name}</h2>
              {member.nickname && <p>{member.nickname}</p>}
            </div>
          </div>
          {summary.length > 0 && (
            <ul class="collapsed-member__summary">
              {summary.map((value) => (
                <li>{value}</li>
              ))}
            </ul>
          )}
        </div>
        <div class="member-actions">
          <button
            type="button"
            disabled={slot === 0}
            onClick={() => {
              const moved = onMove(-1);
              if (moved !== null)
                onAnnounce(`${form.name} moved to position ${moved + 1}.`);
            }}
            aria-label={`Move ${form.name} earlier`}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={slot === 5}
            onClick={() => {
              const moved = onMove(1);
              if (moved !== null)
                onAnnounce(`${form.name} moved to position ${moved + 1}.`);
            }}
            aria-label={`Move ${form.name} later`}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${form.name}`}
          >
            Remove
          </button>
        </div>
      </article>
    );
  }
  return (
    <article
      id={`${prefix}-card`}
      class="member-card"
      aria-expanded="true"
      tabIndex={-1}
      aria-labelledby={`${prefix}-title`}
      style={{ order: slot }}
      data-member-slot={slot}
    >
      <header class="member-card__header">
        <span class="slot-number">{slot + 1}</span>
        <div class="member-heading">
          <h2 id={`${prefix}-title`}>{form.name}</h2>
          <InlineNickname
            inputId={`${prefix}-nickname`}
            species={form.name}
            value={member.nickname}
            error={nicknameError ?? errors.nickname}
            onCommit={(value) => update("nickname", value)}
          />
        </div>
        <div class="member-actions">
          <button
            type="button"
            onClick={() => {
              onCollapse();
              requestAnimationFrame(() =>
                document.getElementById(`${prefix}-card`)?.focus(),
              );
            }}
            aria-label={`Collapse ${form.name}`}
          >
            Collapse
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${form.name}`}
          >
            Remove
          </button>
        </div>
      </header>
      <div class="member-card__body">
        <div class="member-visual">
          <img
            src={member.shiny ? display.sprites.shiny : display.sprites.normal}
            alt={`${member.shiny ? "Shiny " : ""}${display.name}`}
          />
          <div class="member-form-toggles">
            <button
              type="button"
              class={member.shiny ? "icon-toggle is-active" : "icon-toggle"}
              aria-pressed={member.shiny}
              aria-label={
                member.shiny ? "Use normal colors" : "Use Shiny colors"
              }
              title={member.shiny ? "Use normal colors" : "Use Shiny colors"}
              onClick={() => update("shiny", !member.shiny)}
            >
              <ShinyIcon />
            </button>
            {mega && (
              <>
                <button
                  type="button"
                  class={
                    member.mega_preview
                      ? "icon-toggle is-active"
                      : "icon-toggle"
                  }
                  aria-pressed={member.mega_preview}
                  aria-label={
                    member.mega_preview
                      ? "Hide Mega preview"
                      : "Show Mega preview"
                  }
                  title={
                    member.mega_preview
                      ? "Hide Mega preview"
                      : "Show Mega preview"
                  }
                  aria-describedby={
                    serverError("mega_preview")
                      ? `${prefix}-mega-error`
                      : undefined
                  }
                  onClick={() => update("mega_preview", !member.mega_preview)}
                >
                  <MegaIcon />
                </button>
                {serverError("mega_preview") && (
                  <span class="field-error" id={`${prefix}-mega-error`}>
                    {serverError("mega_preview")}
                  </span>
                )}
              </>
            )}
          </div>
          <dl class="real-stats">
            {statIds.map((id) => (
              <div>
                <dt>{statLabels[id]}</dt>
                <dd>{stats[id]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div class="member-fields">
          {searchEntry?.form_group && (
            <label class="team-field team-field--form">
              {searchEntry.form_group.label}
              <select
                id={`${prefix}-form`}
                value={member.form_id}
                onChange={(event) => {
                  const target = data.forms.find(
                    ({ id }) => id === event.currentTarget.value,
                  );
                  if (!target) return;
                  onChange(memberWithForm(member, target, data));
                  onAnnounce(`Form changed to ${target.name}.`);
                  requestAnimationFrame(() =>
                    document.getElementById(`${prefix}-form`)?.focus(),
                  );
                }}
              >
                {searchEntry.form_group.options.map((option) => (
                  <option value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
          <div>
            <div class="field-with-information">
              {member.mega_preview && mega ? (
                <label class="team-field">
                  Ability
                  <input
                    id={`${prefix}-ability`}
                    value={mega.target.ability.name}
                    readOnly
                    aria-describedby={
                      abilityDetail
                        ? `${prefix}-ability-info-description`
                        : undefined
                    }
                    onKeyDown={(event) => {
                      if (
                        event.altKey &&
                        event.key.toLocaleLowerCase() === "i" &&
                        abilityDetail
                      ) {
                        event.preventDefault();
                        document
                          .getElementById(`${prefix}-ability-info`)
                          ?.click();
                      }
                    }}
                  />
                </label>
              ) : (
                <Autocomplete
                  inputId={`${prefix}-ability`}
                  label="Ability"
                  value={member.ability_id}
                  choices={data.abilities.filter((item) =>
                    form.ability_ids.includes(item.id),
                  )}
                  error={errors.ability_id ?? serverError("ability")}
                  transient={autocompleteTransients.get(
                    transientKey("ability"),
                  )}
                  onTransientChange={(state) =>
                    onAutocompleteTransient(transientKey("ability"), state)
                  }
                  informationDescriptionId={
                    abilityDetail
                      ? `${prefix}-ability-info-description`
                      : undefined
                  }
                  informationControlId={
                    abilityDetail ? `${prefix}-ability-info` : undefined
                  }
                  next={`${prefix}-item`}
                  onChange={(id) => update("ability_id", id)}
                />
              )}
              <FieldInformationControl
                controlId={`${prefix}-ability-info`}
                info={
                  abilityDetail
                    ? { kind: "ability", value: abilityDetail }
                    : null
                }
              />
            </div>
          </div>
          <div>
            <div class="field-with-information">
              <Autocomplete
                inputId={`${prefix}-item`}
                label="Item"
                value={member.item_id}
                choices={availableItems}
                error={errors.item_id ?? serverError("item")}
                transient={autocompleteTransients.get(transientKey("item"))}
                onTransientChange={(state) =>
                  onAutocompleteTransient(transientKey("item"), state)
                }
                informationDescriptionId={
                  itemDetail ? `${prefix}-item-info-description` : undefined
                }
                informationControlId={
                  itemDetail ? `${prefix}-item-info` : undefined
                }
                next={`${prefix}-move-0`}
                onChange={(id) =>
                  onChange({
                    ...member,
                    item_id: id,
                    mega_preview:
                      id === member.item_id ? member.mega_preview : false,
                  })
                }
              />
              <FieldInformationControl
                controlId={`${prefix}-item-info`}
                info={itemDetail ? { kind: "item", value: itemDetail } : null}
              />
            </div>
          </div>
          <div class="move-grid">
            {member.move_ids.map((move, moveIndex) => (
              <div>
                <div class="field-with-information">
                  <Autocomplete
                    inputId={`${prefix}-move-${moveIndex}`}
                    label={`Move ${moveIndex + 1}`}
                    value={move}
                    choices={data.moves.filter(
                      (item) =>
                        form.move_ids.includes(item.id) &&
                        (!member.move_ids.includes(item.id) ||
                          item.id === move),
                    )}
                    error={
                      errors[`move_ids.${moveIndex}`] ??
                      serverError(`moves.${moveIndex}`)
                    }
                    transient={autocompleteTransients.get(
                      transientKey(`move-${moveIndex}`),
                    )}
                    onTransientChange={(state) =>
                      onAutocompleteTransient(
                        transientKey(`move-${moveIndex}`),
                        state,
                      )
                    }
                    informationDescriptionId={
                      move && data.moves.some((item) => item.id === move)
                        ? `${prefix}-move-${moveIndex}-info-description`
                        : undefined
                    }
                    informationControlId={
                      move && data.moves.some((item) => item.id === move)
                        ? `${prefix}-move-${moveIndex}-info`
                        : undefined
                    }
                    next={
                      moveIndex < 3
                        ? `${prefix}-move-${moveIndex + 1}`
                        : `${prefix}-nature`
                    }
                    onChange={(id) => {
                      const moves = [...member.move_ids];
                      moves[moveIndex] = id;
                      update("move_ids", moves);
                    }}
                  />
                  <FieldInformationControl
                    controlId={`${prefix}-move-${moveIndex}-info`}
                    info={(() => {
                      const detail = data.moves.find(
                        (item) => item.id === move,
                      );
                      return detail ? { kind: "move", value: detail } : null;
                    })()}
                  />
                </div>
              </div>
            ))}
          </div>
          <div>
            <Autocomplete
              inputId={`${prefix}-nature`}
              label="Nature"
              value={member.nature_id}
              choices={data.natures}
              error={errors.nature_id ?? serverError("nature")}
              transient={autocompleteTransients.get(transientKey("nature"))}
              onTransientChange={(state) =>
                onAutocompleteTransient(transientKey("nature"), state)
              }
              next={`${prefix}-sp-hp`}
              onChange={(id) => update("nature_id", id)}
            />
          </div>
          <fieldset class="sp-editor">
            <legend>
              Stat Points{" "}
              <span
                class={
                  spTotal(member.sp) > data.mechanics.sp_total_max ? "over" : ""
                }
              >
                {spTotal(member.sp)} / {data.mechanics.sp_total_max}
              </span>
            </legend>
            {(errors.sp ?? serverError("sp")) && (
              <p class="field-error">{errors.sp ?? serverError("sp")}</p>
            )}
            {statIds.map((id, statIndex) => (
              <div class="sp-control">
                <label for={`${prefix}-sp-${id}`}>{statLabels[id]}</label>
                <input
                  type="range"
                  min={data.mechanics.sp_min}
                  max={data.mechanics.sp_max}
                  value={member.sp[id]}
                  aria-label={`${statLabels[id]} SP slider`}
                  onInput={(event) =>
                    updateSp(id, event.currentTarget.valueAsNumber)
                  }
                />
                <input
                  id={`${prefix}-sp-${id}`}
                  type="number"
                  min={data.mechanics.sp_min}
                  max={data.mechanics.sp_max}
                  inputMode="numeric"
                  value={member.sp[id]}
                  aria-invalid={Boolean(
                    errors[`sp.${id}`] ?? serverError(`sp.${spServerPath[id]}`),
                  )}
                  aria-describedby={
                    (errors[`sp.${id}`] ??
                    serverError(`sp.${spServerPath[id]}`))
                      ? `${prefix}-sp-${id}-error`
                      : undefined
                  }
                  onInput={(event) =>
                    updateSp(id, event.currentTarget.valueAsNumber)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (statIndex < statIds.length - 1)
                        document
                          .getElementById(
                            `${prefix}-sp-${statIds[statIndex + 1]}`,
                          )
                          ?.focus();
                    }
                  }}
                />
                <div class="sp-control__shortcuts">
                  <button type="button" onClick={() => updateSp(id, 0)}>
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSp(id, data.mechanics.sp_max)}
                  >
                    Max
                  </button>
                </div>
                {(errors[`sp.${id}`] ??
                  serverError(`sp.${spServerPath[id]}`)) && (
                  <span
                    class="field-error sp-control__error"
                    id={`${prefix}-sp-${id}-error`}
                  >
                    {errors[`sp.${id}`] ??
                      serverError(`sp.${spServerPath[id]}`)}
                  </span>
                )}
              </div>
            ))}
          </fieldset>
        </div>
      </div>
    </article>
  );
}

export function InlineNickname({
  value,
  species,
  inputId,
  error,
  onCommit,
}: {
  value: string;
  species: string;
  inputId: string;
  error?: string;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(value);
  const snapshot = useRef(value);
  const idle = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const errorId = `${inputId}-error`;

  useEffect(() => {
    if (!editing) setBuffer(value);
  }, [editing, value]);
  useLayoutEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const activate = () => {
    snapshot.current = value;
    setBuffer(value);
    setEditing(true);
  };
  const finish = (restoreFocus: boolean, cancel = false) => {
    const next = cancel ? snapshot.current : buffer;
    setBuffer(next);
    setEditing(false);
    if (!cancel && next !== snapshot.current) onCommit(next);
    if (restoreFocus) requestAnimationFrame(() => idle.current?.focus());
  };

  return (
    <div class="nickname-inline">
      {editing ? (
        <input
          ref={input}
          id={inputId}
          class="nickname-inline__input"
          aria-label={`Nickname for ${species}`}
          maxLength={10}
          value={buffer}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onInput={(event) => setBuffer(event.currentTarget.value)}
          onBlur={() => finish(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              finish(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              finish(true, true);
            }
          }}
        />
      ) : (
        <button
          ref={idle}
          id={inputId}
          class="nickname-inline__idle"
          type="button"
          aria-label={`Edit nickname for ${species}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onClick={activate}
        >
          {value || "Nickname"}
        </button>
      )}
      {error && (
        <span class="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  initiator: HTMLElement | null;
  resolve: (confirmed: boolean) => void;
};

export function ConfirmationDialog({
  confirmation,
  onClose,
}: {
  confirmation: Confirmation;
  onClose: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    return () => confirmation.initiator?.focus();
  }, [confirmation]);
  return (
    <div class="confirmation-backdrop">
      <div
        class="confirmation-dialog"
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose(false);
          }
          if (event.key === "Tab") {
            const controls = [
              ...dialog.current!.querySelectorAll<HTMLButtonElement>("button"),
            ];
            const first = controls[0];
            const last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id="confirmation-title">{confirmation.title}</h2>
        <p id="confirmation-description">{confirmation.description}</p>
        <div class="confirmation-dialog__actions">
          <button
            ref={cancel}
            class="button button--secondary"
            type="button"
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            class={`button ${confirmation.danger ? "button--danger" : "button--primary"}`}
            type="button"
            onClick={() => onClose(true)}
          >
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamBuilder({
  bootstrap,
  initialData,
}: {
  bootstrap: Bootstrap;
  initialData?: BuilderData;
}) {
  const empty = (name = ""): Team => ({
    id: null,
    name,
    data_version: bootstrap.active_version,
    regulation: bootstrap.regulation,
    members: [],
  });
  const [data, setData] = useState<BuilderData | null>(initialData ?? null);
  const [activeData, setActiveData] = useState<BuilderData | null>(
    initialData?.data_version === bootstrap.active_version ? initialData : null,
  );
  const [teams, setTeams] = useState(bootstrap.teams);
  const [nextTeamNumber, setNextTeamNumber] = useState(
    bootstrap.next_team_number,
  );
  const [baseline, setBaseline] = useState<Team | null>(null);
  const [draft, setDraft] = useState<Team | null>(null);
  const [status, setStatus] = useState<Status>({
    kind: initialData ? "idle" : "loading",
  });
  const [palette, setPalette] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const slotTrigger = useRef<HTMLElement | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const loadGeneration = useRef(0);
  const [announcement, setAnnouncement] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationPending = useRef(false);
  const unloadBypass = useRef(false);
  const [autocompleteTransients, setAutocompleteTransients] = useState<
    Map<string, AutocompleteTransient>
  >(new Map());
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set(),
  );
  const [pendingMemberSlot, setPendingMemberSlot] = useState<number | null>(
    null,
  );
  const [pendingInvalidFocus, setPendingInvalidFocus] = useState<{
    formId: string;
    path: string;
  } | null>(null);
  const selectTeamName = useRef(false);
  const dirty = Boolean(draft && (!baseline || !same(draft, baseline)));
  const requestConfirmation = (
    details: Omit<Confirmation, "resolve">,
  ): Promise<boolean> => {
    if (confirmationPending.current) return Promise.resolve(false);
    confirmationPending.current = true;
    return new Promise((resolve) => setConfirmation({ ...details, resolve }));
  };
  const closeConfirmation = (confirmed: boolean) => {
    const current = confirmation;
    setConfirmation(null);
    confirmationPending.current = false;
    current?.resolve(confirmed);
  };
  const confirmDiscard = (initiator: HTMLElement | null) =>
    !dirty
      ? Promise.resolve(true)
      : requestConfirmation({
          title: "Discard unsaved changes?",
          description:
            "Your changes to this team have not been saved and will be lost.",
          confirmLabel: "Discard changes",
          danger: true,
          initiator,
        });
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
  useEffect(() => () => loadController.current?.abort(), []);
  useEffect(() => {
    if (!selectTeamName.current || !draft) return;
    selectTeamName.current = false;
    const input = document.getElementById(
      "team-name",
    ) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }, [draft]);
  useEffect(() => {
    if (data) return;
    const controller = new AbortController();
    fetch(bootstrap.data_url, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Builder data could not be loaded.");
        return parseBuilderData(await response.json());
      })
      .then((value) => {
        setData(value);
        setActiveData(value);
        setStatus({ kind: "idle" });
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError")
          setStatus({ kind: "error", message: error.message });
      });
    return () => controller.abort();
  }, [bootstrap.data_url, data]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty && !unloadBypass.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    const clicks = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a[href]");
      if (!dirty || !anchor || anchor.closest("[data-team-builder-root]"))
        return;
      event.preventDefault();
      void confirmDiscard(anchor as HTMLElement).then((confirmed) => {
        if (!confirmed) return;
        withUnloadBypass(() =>
          window.location.assign((anchor as HTMLAnchorElement).href),
        );
      });
    };
    document.addEventListener("click", clicks);
    const forms = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (!dirty || form.closest("[data-team-builder-root]")) return;
      event.preventDefault();
      void confirmDiscard(
        event.submitter instanceof HTMLElement ? event.submitter : form,
      ).then((confirmed) => {
        if (!confirmed) return;
        withUnloadBypass(() => HTMLFormElement.prototype.submit.call(form));
      });
    };
    document.addEventListener("submit", forms);
    const navigation = (event: Event) => {
      if (!dirty) return;
      const navigationEvent = event as CustomEvent<{ url?: string }>;
      const url = navigationEvent.detail?.url;
      if (!url) return;
      event.preventDefault();
      const selector = document.querySelector<HTMLElement>(
        "[data-regulation-selector] select",
      );
      void confirmDiscard(selector).then((confirmed) => {
        if (!confirmed) return;
        withUnloadBypass(() => window.location.assign(url));
      });
    };
    document.addEventListener("bagredex:navigate", navigation);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", clicks);
      document.removeEventListener("submit", forms);
      document.removeEventListener("bagredex:navigate", navigation);
    };
  }, [dirty]);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !/^[1-6]$/.test(event.key) ||
        palette !== null ||
        confirmation ||
        document.querySelector("dialog[open]") ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"], [role="combobox"]',
          ))
      )
        return;
      const member = draft?.members.find(
        (value) => value.position === Number(event.key) - 1,
      );
      if (!draft) return;
      event.preventDefault();
      if (!member) {
        const position = Number(event.key) - 1;
        slotTrigger.current = document.querySelector(
          `.empty-slot[data-member-slot="${position}"]`,
        );
        setPalette(position);
        return;
      }
      setPendingMemberSlot(member.position);
      setExpandedMembers((current) => new Set(current).add(member.form_id));
    };
    document.addEventListener("keydown", shortcuts);
    return () => document.removeEventListener("keydown", shortcuts);
  }, [confirmation, draft, palette]);
  useLayoutEffect(() => {
    if (pendingMemberSlot === null) return;
    const member = draft?.members.find(
      (value) => value.position === pendingMemberSlot,
    );
    if (!member) {
      setPendingMemberSlot(null);
      return;
    }
    if (!expandedMembers.has(member.form_id)) return;
    const card = document.getElementById(`member-${pendingMemberSlot}-card`);
    if (!card) {
      setPendingMemberSlot(null);
      return;
    }
    card.focus({ preventScroll: true });
    card.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    setPendingMemberSlot((current) =>
      current === pendingMemberSlot ? null : current,
    );
  }, [draft, expandedMembers, pendingMemberSlot]);
  useLayoutEffect(() => {
    if (!pendingInvalidFocus || !draft) return;
    const member = draft.members.find(
      (value) => value.form_id === pendingInvalidFocus.formId,
    );
    if (!member) {
      setPendingInvalidFocus(null);
      return;
    }
    if (!expandedMembers.has(member.form_id)) return;
    const field = document.getElementById(
      `member-${member.position}-${pendingInvalidFocus.path}`,
    );
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView?.({ block: "center" });
    setPendingInvalidFocus(null);
  }, [draft, expandedMembers, pendingInvalidFocus]);
  const openTeam = async (summary: TeamSummary, initiator: HTMLElement) => {
    if (!(await confirmDiscard(initiator))) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const generation = ++loadGeneration.current;
    setStatus({ kind: "loading" });
    try {
      const response = await fetch(
        bootstrap.team_url_template.replace(
          "__TEAM__",
          encodeURIComponent(summary.id),
        ),
        { credentials: "same-origin", signal: controller.signal },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          parseProblem(payload)?.message ?? "This team could not be loaded.",
        );
      const team = parseTeam(payload);
      if (
        !data ||
        data.data_version !== team.data_version ||
        data.regulation.id !== team.regulation.id
      ) {
        const dataResponse = await fetch(
          `/teams/data/${encodeURIComponent(team.data_version)}/${encodeURIComponent(team.regulation.id)}/`,
          { credentials: "same-origin", signal: controller.signal },
        );
        if (!dataResponse.ok)
          throw new Error("This team's pinned Pokémon data is unavailable.");
        const retained = parseBuilderData(await dataResponse.json());
        if (generation !== loadGeneration.current) return;
        setData(retained);
      }
      if (generation !== loadGeneration.current) return;
      setDraft(clone(team));
      setBaseline(clone(team));
      setAutocompleteTransients(new Map());
      setExpandedMembers(new Set());
      setFieldErrors({});
      setStatus({ kind: "idle" });
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      if ((error as Error).name === "AbortError") return;
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };
  const create = async (initiator: HTMLElement) => {
    if (!(await confirmDiscard(initiator))) return;
    loadController.current?.abort();
    let source = activeData;
    if (!source) {
      setStatus({ kind: "loading" });
      try {
        const response = await fetch(bootstrap.data_url, {
          credentials: "same-origin",
        });
        if (!response.ok)
          throw new Error("The active regulation data is unavailable.");
        source = parseBuilderData(await response.json());
        setActiveData(source);
      } catch (error) {
        setStatus({ kind: "error", message: (error as Error).message });
        return;
      }
    }
    setData(source);
    const team = empty(`Team ${nextTeamNumber}`);
    selectTeamName.current = true;
    setDraft(team);
    setBaseline(null);
    setAutocompleteTransients(new Map());
    setExpandedMembers(new Set());
    setStatus({ kind: "idle" });
  };
  const save = async () => {
    if (!draft || !data) return;
    const { team: normalized, firstError } = prepareDraftForSave(
      draft,
      data,
      autocompleteTransients,
    );
    if (firstError) {
      const path = fieldPathToDomPath(firstError.path);
      setExpandedMembers((current) =>
        new Set(current).add(firstError.member.form_id),
      );
      setPendingInvalidFocus({ formId: firstError.member.form_id, path });
      setStatus({
        kind: "error",
        message: "Resolve the highlighted team fields before saving.",
      });
      return;
    }
    setDraft(normalized);
    setStatus({ kind: "saving", message: "Saving team…" });
    setFieldErrors({});
    const url = draft.id
      ? bootstrap.team_url_template.replace("__TEAM__", draft.id)
      : bootstrap.create_url;
    try {
      const response = await fetch(url, {
        method: draft.id ? "PUT" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() },
        body: JSON.stringify(serializeDraft(normalized)),
      });
      const payload = await response.json();
      const problem = parseProblem(payload);
      if (!response.ok || problem) {
        setFieldErrors(problem?.fields ?? {});
        throw new Error(problem?.message ?? "The team could not be saved.");
      }
      const team = parseTeam(payload);
      const created = draft.id === null;
      setDraft(clone(team));
      setBaseline(clone(team));
      setAutocompleteTransients(new Map());
      const summary: TeamSummary = {
        id: team.id!,
        name: team.name,
        data_version: team.data_version,
        regulation: team.regulation,
        members: team.members
          .map((member) => {
            const form = data.forms.find((item) => item.id === member.form_id);
            return form
              ? {
                  position: member.position,
                  sprite_url: member.shiny
                    ? form.sprites.shiny
                    : form.sprites.normal,
                }
              : null;
          })
          .filter(
            (member): member is { position: number; sprite_url: string } =>
              member !== null,
          ),
        updated_at: team.updated_at!,
      };
      setTeams((values) => [
        summary,
        ...values.filter((item) => item.id !== summary.id),
      ]);
      if (created) setNextTeamNumber((value) => value + 1);
      setStatus({ kind: "success", message: "Team saved." });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };
  const removeTeam = async () => {
    if (!draft?.id) return;
    const initiator = document.activeElement as HTMLElement | null;
    if (
      !(await requestConfirmation({
        title: "Delete this team?",
        description: `“${draft.name}” will be permanently deleted. This cannot be undone.`,
        confirmLabel: "Delete team",
        danger: true,
        initiator,
      }))
    )
      return;
    const deletedId = draft.id;
    setStatus({ kind: "saving", message: "Deleting team…" });
    try {
      const response = await fetch(
        bootstrap.team_url_template.replace("__TEAM__", deletedId),
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-CSRFToken": csrf() },
        },
      );
      if (!response.ok) throw new Error("The team could not be deleted.");
      setTeams((values) => values.filter((item) => item.id !== deletedId));
      setDraft(null);
      setBaseline(null);
      setAutocompleteTransients(new Map());
      setExpandedMembers(new Set());
      setStatus({ kind: "success", message: "Team deleted." });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };
  const serious = data
    ? (data.natures.find((item) => item.id === "serious") ??
      data.natures.find(
        (item) => item.increased_stat === null && item.decreased_stat === null,
      )!)
    : null;
  if (status.kind === "loading" && !data)
    return (
      <div class="page-loading" role="status" aria-busy="true">
        <span class="page-loading__spinner" aria-hidden="true" />
        <span class="visually-hidden">Loading Team Builder…</span>
      </div>
    );
  return (
    <div
      class="team-builder-app"
      data-dirty={dirty ? "true" : "false"}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          !(event.target instanceof HTMLInputElement) ||
          event.target.closest("dialog") ||
          event.target.type === "range" ||
          event.target.type === "number"
        )
          return;
        event.target.blur();
      }}
    >
      <aside class="team-library" aria-labelledby="my-teams-title">
        <header>
          <h1 id="my-teams-title">My Teams</h1>
          <button
            class="new-team-fab"
            type="button"
            aria-label="New Team"
            onClick={(event) => void create(event.currentTarget)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </header>
        {teams.length ? (
          <ul>
            {teams.map((team) => (
              <li>
                <button
                  type="button"
                  class={draft?.id === team.id ? "selected" : ""}
                  onClick={(event) => void openTeam(team, event.currentTarget)}
                >
                  <strong>{team.name}</strong>
                  <time dateTime={team.updated_at}>
                    {new Date(team.updated_at).toLocaleDateString()}
                  </time>
                  <span class="team-card__roster" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((position) => {
                      const member = team.members.find(
                        (item) => item.position === position,
                      );
                      return member ? (
                        <img src={member.sprite_url} alt="" />
                      ) : (
                        <span class="team-card__empty-slot" />
                      );
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div class="library-empty">
            <p>No teams in this regulation yet.</p>
          </div>
        )}
      </aside>
      <main
        class="team-workspace"
        aria-busy={status.kind === "loading" ? "true" : undefined}
      >
        {status.kind === "loading" && (
          <div class="team-loading" role="status">
            <span class="team-spinner" aria-hidden="true" />
            <span class="visually-hidden">Loading team</span>
          </div>
        )}
        {status.message && status.kind !== "loading" && (
          <div
            class={`team-notice team-notice--${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {status.message}
          </div>
        )}
        {Object.keys(fieldErrors).length > 0 && (
          <ul class="field-error-summary" aria-label="Team validation errors">
            {Object.entries(fieldErrors).map(([path, messages]) => (
              <li>
                <strong>{path || "Team"}:</strong> {messages.join(" ")}
              </li>
            ))}
          </ul>
        )}
        {status.kind === "loading" ? null : !data ? (
          <section
            class={`workspace-empty${status.kind === "error" ? " team-state--error" : ""}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            <h2>
              {status.kind === "error"
                ? "Team Builder unavailable"
                : "Loading team"}
            </h2>
            {status.kind === "error" && <p>{status.message}</p>}
          </section>
        ) : draft ? (
          <>
            <header class="team-toolbar">
              <div>
                <label for="team-name">Team name</label>
                <input
                  id="team-name"
                  maxLength={80}
                  value={draft.name}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={
                    fieldErrors.name ? "team-name-error" : undefined
                  }
                  onInput={(event) =>
                    setDraft({ ...draft, name: event.currentTarget.value })
                  }
                />
                {fieldErrors.name && (
                  <span class="field-error" id="team-name-error">
                    {fieldErrors.name.join(" ")}
                  </span>
                )}
              </div>
              <span class={`save-state ${dirty ? "save-state--dirty" : ""}`}>
                {dirty ? "Unsaved changes" : "Saved"}
              </span>
              <button
                class="button button--primary"
                type="button"
                disabled={!dirty || status.kind === "saving"}
                onClick={() => void save()}
              >
                {status.kind === "saving" ? "Saving…" : "Save"}
              </button>
              {draft.id && (
                <button
                  class="button button--danger"
                  type="button"
                  onClick={() => void removeTeam()}
                >
                  Delete
                </button>
              )}
            </header>
            <div class="team-slots">
              {draft.members.map((member, index) => (
                <MemberEditor
                  key={`${member.form_id}-${member.position}`}
                  member={member}
                  index={index}
                  slot={member.position}
                  data={data}
                  allMembers={draft.members}
                  serverErrors={fieldErrors}
                  onAnnounce={setAnnouncement}
                  expanded={expandedMembers.has(member.form_id)}
                  onExpand={() =>
                    setExpandedMembers((current) =>
                      new Set(current).add(member.form_id),
                    )
                  }
                  onCollapse={() =>
                    setExpandedMembers((current) => {
                      const next = new Set(current);
                      next.delete(member.form_id);
                      return next;
                    })
                  }
                  autocompleteTransients={autocompleteTransients}
                  onAutocompleteTransient={(key, state) =>
                    setAutocompleteTransients((current) => {
                      const next = new Map(current);
                      next.set(key, state);
                      return next;
                    })
                  }
                  onChange={(next) => {
                    if (next.form_id !== member.form_id) {
                      setExpandedMembers((current) => {
                        const updated = new Set(current);
                        if (updated.delete(member.form_id))
                          updated.add(next.form_id);
                        return updated;
                      });
                      setAutocompleteTransients(
                        (current) =>
                          new Map(
                            [...current].filter(
                              ([key]) => !key.startsWith(`${member.form_id}:`),
                            ),
                          ),
                      );
                    }
                    const members = [...draft.members];
                    members[index] = next;
                    setDraft({ ...draft, members });
                  }}
                  onRemove={() => {
                    setExpandedMembers((current) => {
                      const next = new Set(current);
                      next.delete(member.form_id);
                      return next;
                    });
                    setAutocompleteTransients(
                      (current) =>
                        new Map(
                          [...current].filter(
                            ([key]) => !key.startsWith(`${member.form_id}:`),
                          ),
                        ),
                    );
                    setDraft({
                      ...draft,
                      members: draft.members.filter((_, i) => i !== index),
                    });
                  }}
                  onMove={(delta) => {
                    const result = moveMember(
                      draft.members,
                      index,
                      delta as -1 | 1,
                    );
                    if (!result) return null;
                    setDraft({ ...draft, members: result.members });
                    return result.position;
                  }}
                />
              ))}
              {[0, 1, 2, 3, 4, 5]
                .filter(
                  (position) =>
                    !draft.members.some(
                      (member) => member.position === position,
                    ),
                )
                .map((position) => (
                  <button
                    class="empty-slot"
                    type="button"
                    data-member-slot={position}
                    style={{ order: position }}
                    onClick={(event) => {
                      slotTrigger.current = event.currentTarget;
                      setPalette(position);
                    }}
                  >
                    <span>{position + 1}</span>
                    <strong>Add Pokémon</strong>
                    <small>Search by name, type, ability, or move</small>
                  </button>
                ))}
            </div>
          </>
        ) : (
          <section class="workspace-empty">
            <p class="eyebrow">Team Builder</p>
            <h2>Choose a team to begin</h2>
            <p>
              Open a saved team or create a new one. Teams stay private and are
              saved only when you choose Save.
            </p>
            <button
              class="button button--primary"
              type="button"
              onClick={(event) => void create(event.currentTarget)}
            >
              New Team
            </button>
          </section>
        )}
      </main>
      {palette !== null && (
        <PokemonPalette
          data={data!}
          members={draft?.members ?? []}
          onClose={() => {
            setPalette(null);
            requestAnimationFrame(() => slotTrigger.current?.focus());
          }}
          onChoose={(choice) => {
            if (!draft) return;
            const targetSlot = palette;
            const member = memberFromPaletteChoice(
              choice,
              serious!.id,
              palette,
            );
            setDraft({
              ...draft,
              members: [...draft.members, member].sort(
                (left, right) => left.position - right.position,
              ),
            });
            setExpandedMembers((current) =>
              new Set(current).add(member.form_id),
            );
            setPalette(null);
            requestAnimationFrame(() =>
              document.getElementById(`member-${targetSlot}-nickname`)?.click(),
            );
          }}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          onClose={closeConfirmation}
        />
      )}
      {announcement && (
        <span class="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </span>
      )}
    </div>
  );
}
