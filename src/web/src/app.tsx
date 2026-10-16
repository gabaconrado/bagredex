import { memo } from "preact/compat";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type {
  Bootstrap,
  BulkAbility,
  BulkForm,
  DetailsMaps,
  FormSummary,
  MoveDetail,
  PokedexIndex,
} from "./contracts";
import { parseApiError, parseDetails, parseIndex } from "./contracts";
import { CategoryIcon, MegaIcon, ShinyIcon } from "./icons";
import {
  addFilter,
  cycleMoveSort,
  cycleSort,
  filteredForms,
  sortedForms,
  sortedMoves,
  statLabels,
  suggestions,
  type Filter,
  type Sort,
  type SortKey,
  type Suggestion,
  type MoveSort,
  type MoveSortKey,
} from "./model";

type LoadState = "loading" | "ready" | "error" | "stale";
type ModalInfo = { kind: "ability" | "move"; id: string } | null;

async function json(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw Object.assign(new Error(parseApiError(payload).message), {
      response: parseApiError(payload),
      status: response.status,
    });
  return payload;
}

const staleDataError = (url: string) =>
  Object.assign(new Error("The Pokémon data changed. Reload the Pokédex."), {
    response: { code: "data-version-changed", url },
  });
const currentPageUrl = () => `${location.pathname}${location.search}` || "/";
const spriteUrl = (
  template: string,
  form: string,
  variant: "normal" | "shiny",
) =>
  template
    .replace("__FORM__", encodeURIComponent(form))
    .replace("__VARIANT__", variant);

const typeClass = (id: string) =>
  `type-badge type-badge--${id.replace(/[^a-z]/g, "")}`;

function Types({ values }: { values: { id: string; name: string }[] }) {
  return (
    <span class="type-list">
      {values.map((type) => (
        <span class={typeClass(type.id)} key={type.id}>
          {type.name}
        </span>
      ))}
    </span>
  );
}

function Search({
  index,
  filters,
  onFilter,
  onRemove,
  onSelect,
}: {
  index: PokedexIndex;
  filters: Filter[];
  onFilter: (filter: Filter) => void;
  onRemove: (filter: Filter) => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const choices = useMemo(() => suggestions(index, query), [index, query]);
  const listId = "pokedex-suggestions";
  const activate = (choice: Suggestion) => {
    if (choice.kind === "pokemon") onSelect(choice.id);
    else onFilter({ id: choice.id, name: choice.name, kind: choice.kind });
    setQuery("");
    setOpen(false);
    setActive(-1);
  };
  const groups = (["pokemon", "move", "ability", "type"] as const)
    .map((kind) => ({
      kind,
      values: choices.filter((choice) => choice.kind === kind),
    }))
    .filter((group) => group.values.length);
  const labels = {
    pokemon: "Pokémon",
    move: "Moves",
    ability: "Abilities",
    type: "Types",
  };
  return (
    <div class="search">
      <label for="pokedex-search">
        Search Pokémon, moves, abilities, or types
      </label>
      <input
        id="pokedex-search"
        type="search"
        value={query}
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && Boolean(query)}
        aria-controls={open && query ? listId : undefined}
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => query && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (!choices.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((active + 1) % choices.length);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(active <= 0 ? choices.length - 1 : active - 1);
          }
          if (event.key === "Enter" && open && active >= 0) {
            event.preventDefault();
            activate(choices[active]!);
          }
        }}
      />
      <span class="visually-hidden" role="status" aria-live="polite">
        {open && query
          ? choices.length
            ? `${choices.length} suggestions available.`
            : "No suggestions available."
          : ""}
      </span>
      {open && query && (
        <div class="suggestions" id={listId} role="listbox">
          {choices.length === 0 && <p class="suggestions__empty">No matches</p>}
          {groups.map((group) => (
            <section
              class="suggestions__group"
              key={group.kind}
              role="group"
              aria-labelledby={`group-${group.kind}`}
            >
              <h3 id={`group-${group.kind}`}>{labels[group.kind]}</h3>
              {group.values.map((choice) => {
                const choiceIndex = choices.indexOf(choice);
                return (
                  <button
                    type="button"
                    role="option"
                    id={`suggestion-${choiceIndex}`}
                    aria-selected={active === choiceIndex}
                    class={active === choiceIndex ? "is-active" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => activate(choice)}
                    key={`${choice.kind}-${choice.id}`}
                  >
                    {choice.name}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}
      {filters.length > 0 && (
        <div class="filters" aria-label="Active filters">
          {filters.map((filter) => (
            <button
              type="button"
              class="filter-token"
              key={`${filter.kind}-${filter.id}`}
              onClick={() => onRemove(filter)}
              aria-label={`Remove ${filter.name} ${filter.kind} filter`}
            >
              <span>{filter.name}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const rowKeys: SortKey[] = ["hp", "atk", "def", "spa", "spd", "spe", "bst"];
const shortStatLabels: Record<SortKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
  bst: "BST",
};

export const PokemonRow = memo(function PokemonRow({
  form,
  selected,
  onSelect,
  spriteTemplate,
}: {
  form: FormSummary;
  selected: boolean;
  onSelect: (id: string) => void;
  spriteTemplate: string;
}) {
  return (
    <tr class={selected ? "is-selected" : ""} onClick={() => onSelect(form.id)}>
      <td class="pokemon-table__sprite">
        <img
          src={spriteUrl(spriteTemplate, form.id, "normal")}
          width="48"
          height="48"
          loading="lazy"
          alt=""
        />
      </td>
      <th scope="row" class="pokemon-table__name">
        <button
          type="button"
          title={form.name}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(form.id);
          }}
          aria-pressed={selected}
        >
          {form.name}
        </button>
      </th>
      <td class="pokemon-table__types">
        <Types values={form.types} />
      </td>
      {rowKeys.map((key) => (
        <td data-label={statLabels[key]} key={key}>
          <span class="stat-value">
            {key === "bst" ? form.bst : form.stats[key]}
          </span>
        </td>
      ))}
    </tr>
  );
});

function PokemonTable({
  forms,
  selected,
  sort,
  onSort,
  onSelect,
  spriteTemplate,
}: {
  forms: FormSummary[];
  selected: string | null;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onSelect: (id: string) => void;
  spriteTemplate: string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const pointerScrollLeft = useRef<number | null>(null);
  const activateSort = (key: SortKey, pointer: boolean) => {
    const origin = pointer ? pointerScrollLeft.current : null;
    onSort(key);
    if (origin !== null && scroll.current) scroll.current.scrollLeft = origin;
    pointerScrollLeft.current = null;
  };
  return (
    <div class="table-scroll" ref={scroll}>
      <table class="pokemon-table">
        <caption class="visually-hidden">Pokémon in this regulation</caption>
        <colgroup>
          <col class="pokemon-col pokemon-col--sprite" />
          <col class="pokemon-col pokemon-col--name" />
          <col class="pokemon-col pokemon-col--types" />
          {rowKeys.map((key) => (
            <col class="pokemon-col pokemon-col--stat" key={key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th class="pokemon-table__sprite" scope="col">
              <span class="visually-hidden">Sprite</span>
            </th>
            <th scope="col">Pokémon</th>
            <th scope="col">Types</th>
            {rowKeys.map((key) => (
              <th
                class="pokemon-table__stat-header"
                scope="col"
                key={key}
                aria-sort={sort?.key === key ? sort.direction : "none"}
              >
                <span class="pokemon-table__stat-header-inner">
                  <button
                    type="button"
                    class={sort?.key === key ? "sort is-active" : "sort"}
                    title={`Sort by ${statLabels[key]}`}
                    aria-label={`Sort by ${statLabels[key]}${sort?.key === key ? `, ${sort.direction}` : ""}`}
                    onPointerDown={() => {
                      pointerScrollLeft.current =
                        scroll.current?.scrollLeft ?? 0;
                    }}
                    onClick={(event) => activateSort(key, event.detail > 0)}
                  >
                    <span class="sort-content">
                      <span class="sort-label sort-label--full">
                        {statLabels[key]}
                      </span>
                      <span
                        class="sort-label sort-label--short"
                        aria-hidden="true"
                      >
                        {shortStatLabels[key]}
                      </span>
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
                    </span>
                  </button>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {forms.map((form) => (
            <PokemonRow
              key={form.id}
              form={form}
              selected={selected === form.id}
              onSelect={onSelect}
              spriteTemplate={spriteTemplate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveInfo({ move }: { move: MoveDetail }) {
  return (
    <div>
      <div class="info-grid">
        <Types values={[move.type]} />
        <span>{move.category}</span>
        <span>
          <b>Power:</b> {move.base_power}
        </span>
        <span>
          <b>Accuracy:</b> {move.always_hits ? "Always hits" : move.accuracy}
        </span>
        <span>
          <b>PP:</b> {move.pp}
        </span>
        <span>
          <b>Priority:</b> {move.priority}
        </span>
        <span>
          <b>Target:</b> {move.target}
        </span>
      </div>
      <p>{move.short_description}</p>
      {move.description !== move.short_description && <p>{move.description}</p>}
      <p>
        <b>Flags:</b> {move.flags.length ? move.flags.join(", ") : "None"}
      </p>
    </div>
  );
}

function InformationDialog({
  info,
  maps,
  invoker,
  onClose,
}: {
  info: Exclude<ModalInfo, null>;
  maps: DetailsMaps;
  invoker: HTMLElement | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const value =
    info.kind === "move"
      ? maps.moves.get(info.id)
      : maps.abilities.get(info.id);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === "function") element.showModal();
    if (!element.open) element.setAttribute("open", "");
    element.querySelector<HTMLElement>(".dialog-close")?.focus();
  }, []);
  if (!value) return null;
  const close = (restore = true) => {
    dialog.current?.close();
    onClose();
    if (restore) queueMicrotask(() => invoker?.isConnected && invoker.focus());
  };
  return (
    <dialog
      ref={dialog}
      class="info-dialog"
      aria-labelledby="info-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ];
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (
          first === last ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
    >
      <div class="info-dialog__surface">
        <header>
          <h2 id="info-dialog-title">{value.name}</h2>
          <button
            type="button"
            class="dialog-close"
            autofocus
            onClick={() => close()}
            aria-label="Close details"
          >
            ×
          </button>
        </header>
        {info.kind === "move" ? (
          <MoveInfo move={value as MoveDetail} />
        ) : (
          <>
            <p>{(value as BulkAbility).short_description}</p>
            {(value as BulkAbility).description !==
              (value as BulkAbility).short_description && (
              <p>{(value as BulkAbility).description}</p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

const statExplanation =
  "Real: 0 SP, neutral nature. Min: 0 SP, hindering nature. Max: 32 SP, increasing nature.";

function StatsHeading() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const open = !suppressed && (hovered || focused || pinned);
  useEffect(() => {
    if (!pinned) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setPinned(false);
        setSuppressed(true);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [pinned]);
  return (
    <div
      class="stats-heading"
      ref={root}
      onMouseEnter={() => {
        setSuppressed(false);
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinned(false);
          setSuppressed(true);
        }
      }}
    >
      <h3>Stats</h3>
      <button
        type="button"
        class="info-button"
        aria-label="Show level-50 stat calculation information"
        aria-expanded={open}
        aria-controls="stats-explanation"
        title="Level-50 stat calculations"
        onFocus={() => {
          setSuppressed(false);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onClick={() => {
          setPinned((value) => {
            setSuppressed(value);
            return !value;
          });
        }}
      >
        <span class="info-mark" aria-hidden="true">
          i
        </span>
      </button>
      {open && (
        <span class="stats-tooltip" id="stats-explanation" role="tooltip">
          {statExplanation}
        </span>
      )}
    </div>
  );
}

function RefinedDetailPane({
  selected,
  detailsState,
  maps,
  error,
  shiny,
  modal,
  modalInvoker,
  spriteTemplate,
  onShiny,
  onModal,
  onCloseModal,
  onSelect,
  onRetry,
}: {
  selected: string | null;
  detailsState: "idle" | "loading" | "ready" | "error";
  maps: DetailsMaps | null;
  error: string | null;
  shiny: boolean;
  modal: ModalInfo;
  modalInvoker: HTMLElement | null;
  spriteTemplate: string;
  onShiny: () => void;
  onModal: (info: Exclude<ModalInfo, null>, invoker: HTMLElement) => void;
  onCloseModal: () => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  const [moveSort, setMoveSort] = useState<MoveSort>(null);
  useEffect(() => setMoveSort(null), [selected]);
  if (!selected)
    return (
      <aside class="detail-pane detail-pane--empty">
        <h2>Choose a Pokémon</h2>
        <p>Select a row or search result to see its full details.</p>
      </aside>
    );
  if (detailsState === "error")
    return (
      <aside class="detail-pane state-panel state-card--error" role="alert">
        <h2>Details unavailable</h2>
        <p>{error}</p>
        <button type="button" class="button button--primary" onClick={onRetry}>
          Retry details
        </button>
      </aside>
    );
  if (detailsState === "idle" || detailsState === "loading")
    return (
      <aside
        class="detail-pane detail-skeleton"
        aria-live="polite"
        aria-label="Loading Pokémon details"
      >
        <div class="spinner" aria-hidden="true" />
        <div class="skeleton skeleton--title" />
        <div class="skeleton skeleton--sprite" />
        <div class="skeleton skeleton--rows" />
        <span class="visually-hidden">Loading Pokémon details…</span>
      </aside>
    );
  if (!maps)
    return (
      <aside class="detail-pane state-card state-card--error" role="alert">
        <h2>Details unavailable</h2>
        <p>{error}</p>
        <button type="button" class="button button--primary" onClick={onRetry}>
          Retry details
        </button>
      </aside>
    );
  const form = maps.forms.get(selected);
  if (!form)
    return (
      <aside class="detail-pane state-card state-card--error" role="alert">
        <h2>Pokémon unavailable</h2>
        <p>This form is missing from the loaded details.</p>
      </aside>
    );
  const abilities = form.ability_slots.map(({ id, slot }) => ({
    value: maps.abilities.get(id)!,
    slot,
  }));
  const moves = sortedMoves(
    form.move_ids.map((id) => maps.moves.get(id)!),
    moveSort,
  );
  const base = maps.forms.get(form.base_id)!;
  const megaChoices = form.is_mega
    ? [form]
    : form.mega_ids.map((id) => maps.forms.get(id)!);
  return (
    <aside class="detail-pane" aria-labelledby="detail-title">
      <header class="detail-header">
        <div>
          <p class="eyebrow">Selected Pokémon</p>
          <h2 id="detail-title">{form.name}</h2>
          <Types values={form.types} />
        </div>
      </header>
      <div class="sprite-stage">
        <div class="sprite-frame">
          <img
            class="pokemon-sprite"
            src={spriteUrl(spriteTemplate, form.id, shiny ? "shiny" : "normal")}
            width="384"
            height="384"
            alt={`${shiny ? "Shiny " : ""}${form.name}`}
          />
        </div>
        <div class="form-toggles" aria-label="Sprite and form controls">
          <button
            type="button"
            class={shiny ? "icon-toggle is-active" : "icon-toggle"}
            aria-pressed={shiny}
            title={
              shiny ? `Show normal ${form.name}` : `Show shiny ${form.name}`
            }
            aria-label={
              shiny ? `Show normal ${form.name}` : `Show shiny ${form.name}`
            }
            onClick={onShiny}
          >
            <ShinyIcon />
          </button>
          {megaChoices.map((mega) => (
            <button
              type="button"
              key={mega.id}
              class={form.is_mega ? "icon-toggle is-active" : "icon-toggle"}
              aria-pressed={form.is_mega}
              title={
                form.is_mega
                  ? `Return to base form ${base.name}`
                  : `Switch to ${mega.name}`
              }
              aria-label={
                form.is_mega
                  ? `Return to base form ${base.name}`
                  : `Switch to ${mega.name}`
              }
              onClick={() => onSelect(form.is_mega ? base.id : mega.id)}
            >
              <MegaIcon />
              {/[XYZ]$/.exec(mega.form_label)?.[0] && (
                <span class="mega-marker">
                  {/[XYZ]$/.exec(mega.form_label)![0]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <section>
        <StatsHeading key={form.id} />
        <div class="stat-grid" role="table" aria-label="Level 50 stats">
          <div class="stat-grid__header" role="row">
            <span role="columnheader">Stat</span>
            <span role="columnheader">Base</span>
            <span role="columnheader">Real</span>
            <span role="columnheader">Min</span>
            <span role="columnheader">Max</span>
          </div>
          {form.stats.map((stat) => (
            <div role="row" key={stat.id}>
              <b role="rowheader">{stat.name}</b>
              <span role="cell">{stat.base}</span>
              <span role="cell">{stat.real}</span>
              <span role="cell">{stat.minimum}</span>
              <span role="cell">{stat.maximum}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Abilities</h3>
        <div class="chip-list">
          {abilities.map(({ value, slot }) => (
            <button
              type="button"
              onClick={(event) =>
                onModal({ kind: "ability", id: value.id }, event.currentTarget)
              }
              key={`${slot}-${value.id}`}
            >
              {value.name}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>
          Moves <span class="count">{moves.length}</span>
        </h3>
        <div class="move-table" role="table" aria-label="Legal moves">
          <div class="move-table__header" role="row">
            <span role="columnheader">Name</span>
            {(["type", "category", "power"] as MoveSortKey[]).map((key) => (
              <span
                role="columnheader"
                aria-sort={moveSort?.key === key ? moveSort.direction : "none"}
                key={key}
              >
                <button
                  type="button"
                  class="move-sort"
                  aria-label={`Sort moves by ${key}${moveSort?.key === key ? `, ${moveSort.direction}` : ""}`}
                  onClick={() =>
                    setMoveSort((value) => cycleMoveSort(value, key))
                  }
                >
                  <span class="move-sort__label">
                    {key[0]!.toUpperCase() + key.slice(1)}
                  </span>
                  <span
                    class={`sort-indicator${moveSort?.key === key ? "" : " is-inactive"}`}
                    aria-hidden="true"
                  >
                    {moveSort?.key === key
                      ? moveSort.direction === "ascending"
                        ? "↑"
                        : "↓"
                      : "↑"}
                  </span>
                </button>
              </span>
            ))}
          </div>
          {moves.map((move) => (
            <div class="move-row" role="row" key={move.id}>
              <span role="cell" class="move-name">
                <button
                  type="button"
                  class="move-row__action"
                  aria-label={`${move.name}, ${move.type.name} type, ${move.category}, power ${move.category === "Status" ? "not applicable" : move.base_power}`}
                  onClick={(event) =>
                    onModal({ kind: "move", id: move.id }, event.currentTarget)
                  }
                />
                <span>{move.name}</span>
              </span>
              <span role="cell">
                <Types values={[move.type]} />
              </span>
              <span role="cell" class="move-category">
                <CategoryIcon
                  category={move.category as "Physical" | "Special" | "Status"}
                />
                <span class="visually-hidden">{move.category}</span>
              </span>
              <span role="cell">
                {move.category === "Status" ? "—" : move.base_power}
              </span>
            </div>
          ))}
        </div>
      </section>
      {modal && (
        <InformationDialog
          info={modal}
          maps={maps}
          invoker={modalInvoker}
          onClose={onCloseModal}
        />
      )}
    </aside>
  );
}

export function App({ bootstrap }: { bootstrap: Bootstrap }) {
  const [index, setIndex] = useState<PokedexIndex | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [reloadUrl, setReloadUrl] = useState<string | null>(null);
  const [indexRetry, setIndexRetry] = useState(0);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [detailsState, setDetailsState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [details, setDetails] = useState<DetailsMaps | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsRetry, setDetailsRetry] = useState(0);
  const [shiny, setShiny] = useState(false);
  const [modal, setModal] = useState<ModalInfo>(null);
  const [modalInvoker, setModalInvoker] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(bootstrap.index_url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const data = parseIndex(await json(response));
        if (data.data_version !== bootstrap.active_version)
          throw staleDataError(currentPageUrl());
        setIndex(data);
        setLoadState("ready");
      } catch (reason) {
        if (controller.signal.aborted) return;
        const failure = reason as Error & {
          response?: { code: string; url?: string };
        };
        setMessage(failure.message);
        setLoadState(
          failure.response?.code === "data-version-changed" ? "stale" : "error",
        );
        setReloadUrl(failure.response?.url ?? null);
      }
    })();
    return () => controller.abort();
  }, [bootstrap, indexRetry]);

  useEffect(() => {
    if (loadState !== "ready" || !index) return;
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      setDetailsState("loading");
      setDetailsError(null);
      void (async () => {
        try {
          const response = await fetch(bootstrap.details_url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          const { maps } = parseDetails(
            await json(response),
            bootstrap.active_version,
            bootstrap.regulation.id,
          );
          setDetails(maps);
          setDetailsState("ready");
        } catch (reason) {
          if (controller.signal.aborted) return;
          const failure = reason as Error & {
            response?: { code: string; url?: string };
          };
          if (
            failure.response?.code === "data-version-changed" ||
            failure.message.includes("data changed")
          ) {
            setLoadState("stale");
            setReloadUrl(failure.response?.url ?? null);
            setMessage(failure.message);
          } else {
            setDetailsError(failure.message);
            setDetailsState("error");
          }
        }
      })();
    });
    return () => {
      cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [bootstrap, detailsRetry, index, loadState]);

  const select = useCallback(
    (id: string) => {
      if (id === selected) return;
      setSelected(id);
      setSelectionRevision((value) => value + 1);
      setModal(null);
      setModalInvoker(null);
      setShiny(false);
    },
    [selected],
  );
  const visible = useMemo(
    () => (index ? sortedForms(filteredForms(index.forms, filters), sort) : []),
    [index, filters, sort],
  );
  if (loadState === "loading")
    return (
      <div class="pokedex-app pokedex-app--shell" aria-live="polite">
        <section class="pokedex-list">
          <header class="pokedex-title">
            <div>
              <h1>Pokédex</h1>
            </div>
            <label class="regulation-picker">
              Regulation
              <select disabled>
                <option>{bootstrap.regulation.label}</option>
              </select>
            </label>
            <p
              class="result-count result-count--placeholder"
              aria-hidden="true"
            >
              000 of 000 Pokémon
            </p>
          </header>
          <div class="shell-search" />
          <div class="shell-table" />
          <span class="visually-hidden">
            Loading {bootstrap.regulation.label}…
          </span>
        </section>
        <aside class="detail-pane detail-pane--empty">
          <h2>Choose a Pokémon</h2>
          <p>Select a row or search result to see its full details.</p>
        </aside>
      </div>
    );
  if (loadState !== "ready" || !index)
    return (
      <div class="pokedex-app">
        <section
          class={`pokedex-list state-panel ${loadState === "error" ? "state-card--error" : ""}`}
          role="alert"
        >
          <h1>
            {loadState === "stale"
              ? "Pokémon data changed"
              : "Pokédex unavailable"}
          </h1>
          <p>{message}</p>
          {loadState === "stale" && (
            <a class="button button--primary" href={reloadUrl ?? location.href}>
              Reload Pokédex
            </a>
          )}
          {loadState === "error" && (
            <button
              type="button"
              class="button button--primary"
              onClick={() => {
                setMessage(null);
                setLoadState("loading");
                setIndexRetry((value) => value + 1);
              }}
            >
              Retry Pokédex
            </button>
          )}
        </section>
        <aside class="detail-pane detail-pane--empty">
          <h2>Choose a Pokémon</h2>
        </aside>
      </div>
    );
  return (
    <div
      class="pokedex-app"
      data-details-state={detailsState}
      data-selection-revision={selectionRevision}
    >
      <section class="pokedex-list" aria-labelledby="pokedex-title">
        <header class="pokedex-title">
          <div>
            <h1 id="pokedex-title">Pokédex</h1>
          </div>
          <label class="regulation-picker">
            Regulation
            <select
              value={bootstrap.regulation.id}
              onChange={(event) => {
                const target = bootstrap.regulations.find(
                  ({ id }) => id === event.currentTarget.value,
                );
                if (target) location.assign(target.url);
              }}
            >
              {bootstrap.regulations.map((regulation) => (
                <option value={regulation.id} key={regulation.id}>
                  {regulation.label}
                </option>
              ))}
            </select>
          </label>
          <p class="result-count" aria-live="polite">
            {visible.length} of {index.forms.length} Pokémon
          </p>
        </header>
        <Search
          index={index}
          filters={filters}
          onSelect={select}
          onFilter={(filter) =>
            setFilters((current) => addFilter(current, filter))
          }
          onRemove={(filter) =>
            setFilters((current) =>
              current.filter(
                (value) =>
                  !(value.kind === filter.kind && value.id === filter.id),
              ),
            )
          }
        />
        {filters.length > 0 && (
          <button
            class="clear-filters"
            type="button"
            onClick={() => setFilters([])}
          >
            Clear all filters
          </button>
        )}
        {visible.length ? (
          <PokemonTable
            forms={visible}
            selected={selected}
            sort={sort}
            onSort={(key) => setSort((value) => cycleSort(value, key))}
            onSelect={select}
            spriteTemplate={bootstrap.sprite_url_template}
          />
        ) : (
          <div class="empty-list">
            <h2>No Pokémon match</h2>
            <p>Remove one or more filters to broaden the results.</p>
          </div>
        )}
      </section>
      <RefinedDetailPane
        selected={selected}
        detailsState={detailsState}
        maps={details}
        error={detailsError}
        shiny={shiny}
        modal={modal}
        modalInvoker={modalInvoker}
        spriteTemplate={bootstrap.sprite_url_template}
        onShiny={() => setShiny((value) => !value)}
        onModal={(value, invoker) => {
          setModalInvoker(invoker);
          setModal(value);
        }}
        onCloseModal={() => {
          setModal(null);
          setModalInvoker(null);
        }}
        onSelect={select}
        onRetry={() => {
          setDetails(null);
          setDetailsState("idle");
          setDetailsRetry((value) => value + 1);
        }}
      />
    </div>
  );
}
