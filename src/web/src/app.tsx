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
  FormDetail,
  FormSummary,
  MoveDetail,
  PokedexIndex,
} from "./contracts";
import { parseApiError, parseDetail, parseIndex } from "./contracts";
import {
  addFilter,
  cycleSort,
  filteredForms,
  sortedForms,
  statLabels,
  suggestions,
  type Filter,
  type Sort,
  type SortKey,
  type Suggestion,
} from "./model";

type LoadState = "loading" | "ready" | "error" | "stale";
type Info =
  | { kind: "ability"; value: FormDetail["form"]["abilities"][number] }
  | { kind: "move"; value: MoveDetail }
  | null;

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

const PokemonRow = memo(function PokemonRow({
  form,
  selected,
  onSelect,
}: {
  form: FormSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <tr class={selected ? "is-selected" : ""}>
      <th scope="row">
        <button
          type="button"
          onClick={() => onSelect(form.id)}
          aria-pressed={selected}
        >
          {form.name}
        </button>
      </th>
      <td>
        <Types values={form.types} />
      </td>
      {rowKeys.map((key) => (
        <td data-label={statLabels[key]} key={key}>
          {key === "bst" ? form.bst : form.stats[key]}
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
}: {
  forms: FormSummary[];
  selected: string | null;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div class="table-scroll">
      <table class="pokemon-table">
        <caption class="visually-hidden">Pokémon in this regulation</caption>
        <thead>
          <tr>
            <th scope="col">Pokémon</th>
            <th scope="col">Types</th>
            {rowKeys.map((key) => (
              <th
                scope="col"
                key={key}
                aria-sort={sort?.key === key ? sort.direction : "none"}
              >
                <button
                  type="button"
                  class={sort?.key === key ? "sort is-active" : "sort"}
                  onClick={() => onSort(key)}
                >
                  {statLabels[key]}
                  <span aria-hidden="true">
                    {sort?.key === key
                      ? sort.direction === "ascending"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </span>
                </button>
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

function DetailPane({
  detail,
  loading,
  error,
  shiny,
  info,
  onShiny,
  onInfo,
  onSelect,
}: {
  detail: FormDetail | null;
  loading: boolean;
  error: string | null;
  shiny: boolean;
  info: Info;
  onShiny: () => void;
  onInfo: (value: Info) => void;
  onSelect: (id: string) => void;
}) {
  if (loading)
    return (
      <aside class="detail-pane state-card" aria-live="polite">
        <p>Loading Pokémon details…</p>
      </aside>
    );
  if (error)
    return (
      <aside class="detail-pane state-card state-card--error" role="alert">
        <h2>Could not load Pokémon</h2>
        <p>{error}</p>
      </aside>
    );
  if (!detail)
    return (
      <aside class="detail-pane detail-pane--empty">
        <h2>Choose a Pokémon</h2>
        <p>Select a row or search result to see its full details.</p>
      </aside>
    );
  const form = detail.form;
  const otherMegas = form.form_switches.megas.filter(
    (mega) => mega.id !== form.id,
  );
  return (
    <aside class="detail-pane" aria-labelledby="detail-title">
      <header class="detail-header">
        <div>
          <p class="eyebrow">Selected Pokémon</p>
          <h2 id="detail-title">{form.name}</h2>
          <Types values={form.types} />
        </div>
        <label class="toggle">
          <input type="checkbox" checked={shiny} onChange={onShiny} />
          <span>Shiny</span>
        </label>
      </header>
      <img
        class="pokemon-sprite"
        src={shiny ? form.sprites.shiny : form.sprites.normal}
        width="384"
        height="384"
        alt={`${shiny ? "Shiny " : ""}${form.name}`}
      />
      <div class="form-switches" aria-label="Form switches">
        {form.id !== form.form_switches.base.id && (
          <button
            type="button"
            class="button button--secondary"
            onClick={() => onSelect(form.form_switches.base.id)}
          >
            Base: {form.form_switches.base.name}
          </button>
        )}
        {otherMegas.map((mega) => (
          <button
            type="button"
            class="button button--secondary"
            onClick={() => onSelect(mega.id)}
            key={mega.id}
          >
            {mega.name}
          </button>
        ))}
      </div>
      <section>
        <h3>Stats at level 50</h3>
        <p class="section-note">
          Real: 0 SP, neutral nature. Min: 0 SP, hindering nature. Max: 32 SP,
          increasing nature.
        </p>
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
          {form.abilities.map((ability) => (
            <button
              type="button"
              onClick={() => onInfo({ kind: "ability", value: ability })}
              key={`${ability.slot}-${ability.id}`}
            >
              {ability.name}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>
          Moves <span class="count">{form.moves.length}</span>
        </h3>
        <div class="move-list">
          {form.moves.map((move) => (
            <button
              type="button"
              onClick={() => onInfo({ kind: "move", value: move })}
              key={move.id}
            >
              <span>{move.name}</span>
              <Types values={[move.type]} />
            </button>
          ))}
        </div>
      </section>
      {info && (
        <section class="info-pane" aria-live="polite">
          <h3>{info.value.name}</h3>
          {info.kind === "move" ? (
            <MoveInfo move={info.value} />
          ) : (
            <>
              <p>{info.value.short_description}</p>
              {info.value.description !== info.value.short_description && (
                <p>{info.value.description}</p>
              )}
            </>
          )}
        </section>
      )}
    </aside>
  );
}

export function App({ bootstrap }: { bootstrap: Bootstrap }) {
  const [index, setIndex] = useState<PokedexIndex | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [reloadUrl, setReloadUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<FormDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [shiny, setShiny] = useState(false);
  const [info, setInfo] = useState<Info>(null);
  const cache = useRef(new Map<string, FormDetail>());
  const request = useRef(0);

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
  }, [bootstrap]);

  const select = useCallback(
    async (id: string) => {
      if (id === selected) return;
      const serial = ++request.current;
      setSelected(id);
      setInfo(null);
      setShiny(false);
      setDetailError(null);
      const cached = cache.current.get(id);
      if (cached) {
        setDetail(cached);
        setDetailLoading(false);
        return;
      }
      setDetail(null);
      setDetailLoading(true);
      try {
        const url = bootstrap.detail_url_template.replace(
          "__FORM__",
          encodeURIComponent(id),
        );
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        const data = parseDetail(await json(response));
        if (serial !== request.current) return;
        if (data.data_version !== bootstrap.active_version)
          throw staleDataError(currentPageUrl());
        cache.current.set(id, data);
        setDetail(data);
      } catch (reason) {
        if (serial !== request.current) return;
        const failure = reason as Error & {
          response?: { code: string; url?: string };
        };
        if (failure.response?.code === "data-version-changed") {
          setLoadState("stale");
          setReloadUrl(failure.response.url ?? null);
          setMessage(failure.message);
        } else setDetailError(failure.message);
      } finally {
        if (serial === request.current) setDetailLoading(false);
      }
    },
    [bootstrap, selected],
  );
  const visible = useMemo(
    () => (index ? sortedForms(filteredForms(index.forms, filters), sort) : []),
    [index, filters, sort],
  );
  if (loadState === "loading")
    return (
      <section class="state-card" aria-live="polite">
        <h1>Pokédex</h1>
        <p>Loading {bootstrap.regulation.name}…</p>
      </section>
    );
  if (loadState !== "ready" || !index)
    return (
      <section
        class={`state-card ${loadState === "error" ? "state-card--error" : ""}`}
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
      </section>
    );
  return (
    <div class="pokedex-app">
      <section class="pokedex-list" aria-labelledby="pokedex-title">
        <header class="pokedex-title">
          <div>
            <p class="eyebrow">{index.regulation.name}</p>
            <h1 id="pokedex-title">Pokédex</h1>
          </div>
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
          />
        ) : (
          <div class="empty-list">
            <h2>No Pokémon match</h2>
            <p>Remove one or more filters to broaden the results.</p>
          </div>
        )}
      </section>
      <DetailPane
        detail={detail}
        loading={detailLoading}
        error={detailError}
        shiny={shiny}
        info={info}
        onShiny={() => setShiny((value) => !value)}
        onInfo={setInfo}
        onSelect={select}
      />
    </div>
  );
}
