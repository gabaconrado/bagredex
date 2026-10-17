import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  BuilderData,
  BuilderForm,
  Bootstrap,
  Member,
  Named,
  Team,
  TeamSummary,
} from "./contracts";
import {
  parseBuilderData,
  parseProblem,
  parseTeam,
  serializeDraft,
} from "./contracts";
import {
  matches,
  moveMember,
  newMember,
  paletteResults,
  realStats,
  spTotal,
  statIds,
  statLabels,
  type PaletteFilter,
  validateLocal,
} from "./model";

type Status = {
  kind: "idle" | "loading" | "saving" | "success" | "error";
  message?: string;
};
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
}: {
  label: string;
  inputId: string;
  value: string | null;
  choices: Named[];
  disabled?: boolean;
  error?: string;
  next?: string;
  onChange: (id: string | null) => void;
}) {
  const selected = choices.find((item) => item.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const userDiverged = useRef(false);
  useEffect(() => {
    if (userDiverged.current) {
      userDiverged.current = false;
      return;
    }
    setQuery(selected?.name ?? "");
  }, [value, selected?.name]);
  const results = useMemo(
    () => choices.filter((item) => matches(item.name, query)).slice(0, 30),
    [choices, query],
  );
  const listId = `choices-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${next ?? "last"}`;
  const errorId = `${inputId}-error`;
  const accept = (choice: Named) => {
    userDiverged.current = false;
    onChange(choice.id);
    setQuery(choice.name);
    setOpen(false);
    if (next)
      requestAnimationFrame(() => document.getElementById(next)?.focus());
  };
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onFocus={() => setOpen(true)}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
            setActive(0);
            if (event.currentTarget.value !== selected?.name) {
              userDiverged.current = true;
              onChange(null);
            }
          }}
          onBlur={() => {
            setOpen(false);
            if (query !== selected?.name) onChange(null);
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
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter") {
              event.preventDefault();
              const exact = results.find(
                (item) => item.name.toLowerCase() === query.toLowerCase(),
              );
              const choice = exact ?? results[active];
              if (choice) accept(choice);
            }
          }}
        />
      </label>
      {error && (
        <span class="field-error" id={errorId}>
          {error}
        </span>
      )}
      {open && query && (
        <ul id={listId} role="listbox" class="autocomplete__list">
          {results.map((choice, index) => (
            <li key={choice.id} role="option" aria-selected={index === active}>
              <button
                type="button"
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

function PokemonPalette({
  data,
  members,
  onClose,
  onChoose,
}: {
  data: BuilderData;
  members: Member[];
  onClose: () => void;
  onChoose: (form: BuilderForm) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PaletteFilter[]>([]);
  const [active, setActive] = useState(0);
  const used = new Set(
    members
      .map(
        (member) =>
          data.forms.find((form) => form.id === member.form_id)
            ?.base_species_id,
      )
      .filter(Boolean) as string[],
  );
  const results = paletteResults(data.forms, query, filters, used).slice(0, 80);
  const filterSuggestions: PaletteFilter[] = [
    ...data.types.map((x) => ({ ...x, kind: "type" as const })),
    ...data.abilities.map((x) => ({ ...x, kind: "ability" as const })),
    ...data.moves.map((x) => ({ ...x, kind: "move" as const })),
  ]
    .filter((item) => matches(item.name, query))
    .slice(0, 8);
  useEffect(() => {
    search.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const close = () => onClose();
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
        <label class="palette-search">
          Search names, moves, abilities, or types
          <input
            ref={search}
            role="combobox"
            aria-controls="pokemon-results"
            aria-expanded="true"
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive(Math.min(active + 1, results.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(Math.max(active - 1, 0));
              }
              if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                onChoose(results[active]);
              }
            }}
          />
        </label>
        {query && filterSuggestions.length > 0 && (
          <div class="filter-suggestions" aria-label="Matching filters">
            {filterSuggestions.map((item) => (
              <button
                type="button"
                onClick={() => {
                  if (
                    !filters.some(
                      (x) => x.kind === item.kind && x.id === item.id,
                    )
                  )
                    setFilters([...filters, item]);
                  setQuery("");
                }}
              >
                {item.name}
                <small>{item.kind}</small>
              </button>
            ))}
          </div>
        )}
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
        <p class="palette-count" aria-live="polite">
          {results.length} matching Pokémon
        </p>
        <ul id="pokemon-results" class="pokemon-results" role="listbox">
          {results.map((form, index) => (
            <li key={form.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                onClick={() => onChoose(form)}
                onMouseMove={() => setActive(index)}
              >
                <img src={form.sprites.normal} alt="" />
                <span>
                  <strong>{form.name}</strong>
                  <small>
                    {form.types.map((type) => type.name).join(" · ")}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p class="state-inline">No available Pokémon match every filter.</p>
        )}
      </div>
    </div>
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
}) {
  const form = data.forms.find((item) => item.id === member.form_id)!;
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
  const stats = realStats(display.base_stats, member.sp, nature);
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
  const update = <K extends keyof Member>(key: K, value: Member[K]) =>
    onChange({ ...member, [key]: value });
  const availableItems = data.items.filter(
    (item) =>
      item.id === member.item_id ||
      !allMembers.some((other, i) => i !== index && other.item_id === item.id),
  );
  return (
    <article
      class="member-card"
      aria-labelledby={`${prefix}-title`}
      style={{ order: slot }}
      data-member-slot={slot}
    >
      <header class="member-card__header">
        <span class="slot-number">{slot + 1}</span>
        <div>
          <h2 id={`${prefix}-title`}>{member.nickname || form.name}</h2>
          <p>{member.nickname ? form.name : "Team member"}</p>
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
      </header>
      <div class="member-card__body">
        <div class="member-visual">
          <img
            src={member.shiny ? display.sprites.shiny : display.sprites.normal}
            alt={`${member.shiny ? "Shiny " : ""}${display.name}`}
          />
          <label class="toggle">
            <input
              type="checkbox"
              checked={member.shiny}
              onChange={(event) => update("shiny", event.currentTarget.checked)}
            />{" "}
            Shiny
          </label>
          {mega && (
            <label class="toggle">
              <input
                type="checkbox"
                checked={member.mega_preview}
                aria-invalid={Boolean(serverError("mega_preview"))}
                aria-describedby={
                  serverError("mega_preview")
                    ? `${prefix}-mega-error`
                    : undefined
                }
                onChange={(event) =>
                  update("mega_preview", event.currentTarget.checked)
                }
              />{" "}
              Mega preview
              {serverError("mega_preview") && (
                <span class="field-error" id={`${prefix}-mega-error`}>
                  {serverError("mega_preview")}
                </span>
              )}
            </label>
          )}
          <dl class="real-stats">
            {statIds.map((id) => (
              <div>
                <dt>{statLabels[id]}</dt>
                <dd>{stats[id]}</dd>
              </div>
            ))}
          </dl>
          {member.mega_preview && mega && (
            <p class="mega-ability">
              Mega ability: <strong>{mega.target.ability.name}</strong>
            </p>
          )}
        </div>
        <div class="member-fields">
          <label class="team-field">
            Nickname{" "}
            <input
              id={`${prefix}-nickname`}
              maxLength={12}
              value={member.nickname}
              aria-invalid={Boolean(nicknameError)}
              aria-describedby={
                nicknameError ? `${prefix}-nickname-error` : undefined
              }
              onInput={(event) => update("nickname", event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  document.getElementById(`${prefix}-ability`)?.focus();
                }
              }}
            />
            {nicknameError && (
              <span class="field-error" id={`${prefix}-nickname-error`}>
                {nicknameError}
              </span>
            )}
          </label>
          <div>
            <Autocomplete
              inputId={`${prefix}-ability`}
              label="Ability"
              value={member.ability_id}
              choices={data.abilities.filter((item) =>
                form.ability_ids.includes(item.id),
              )}
              disabled={member.mega_preview && Boolean(mega)}
              error={errors.ability_id ?? serverError("ability")}
              next={`${prefix}-item`}
              onChange={(id) => update("ability_id", id)}
            />
          </div>
          <div>
            <Autocomplete
              inputId={`${prefix}-item`}
              label="Item"
              value={member.item_id}
              choices={availableItems}
              error={errors.item_id ?? serverError("item")}
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
          </div>
          <div class="move-grid">
            {member.move_ids.map((move, moveIndex) => (
              <div>
                <Autocomplete
                  inputId={`${prefix}-move-${moveIndex}`}
                  label={`Move ${moveIndex + 1}`}
                  value={move}
                  choices={data.moves.filter(
                    (item) =>
                      form.move_ids.includes(item.id) &&
                      (!member.move_ids.includes(item.id) || item.id === move),
                  )}
                  error={
                    errors[`move_ids.${moveIndex}`] ??
                    serverError(`moves.${moveIndex}`)
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
              next={`${prefix}-sp-hp`}
              onChange={(id) => update("nature_id", id)}
            />
          </div>
          <fieldset class="sp-editor">
            <legend>
              Stat Points{" "}
              <span class={spTotal(member.sp) > 66 ? "over" : ""}>
                {spTotal(member.sp)} / 66
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
                  min="0"
                  max="32"
                  value={member.sp[id]}
                  aria-label={`${statLabels[id]} SP slider`}
                  onInput={(event) =>
                    update("sp", {
                      ...member.sp,
                      [id]: Number(event.currentTarget.value),
                    })
                  }
                />
                <input
                  id={`${prefix}-sp-${id}`}
                  type="number"
                  min="0"
                  max="32"
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
                    update("sp", {
                      ...member.sp,
                      [id]: event.currentTarget.valueAsNumber,
                    })
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
  const dirty = Boolean(draft && (!baseline || !same(draft, baseline)));
  useEffect(() => () => loadController.current?.abort(), []);
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
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    const clicks = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a[href]");
      if (
        dirty &&
        anchor &&
        !anchor.closest("[data-team-builder-root]") &&
        !confirm("Discard unsaved team changes?")
      )
        event.preventDefault();
    };
    document.addEventListener("click", clicks);
    const forms = (event: SubmitEvent) => {
      if (
        dirty &&
        !(event.target as Element).closest("[data-team-builder-root]") &&
        !confirm("Discard unsaved team changes?")
      )
        event.preventDefault();
    };
    document.addEventListener("submit", forms);
    const navigation = (event: Event) => {
      if (dirty && !confirm("Discard unsaved team changes?"))
        event.preventDefault();
    };
    document.addEventListener("bagredex:navigate", navigation);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", clicks);
      document.removeEventListener("submit", forms);
      document.removeEventListener("bagredex:navigate", navigation);
    };
  }, [dirty]);
  const confirmDiscard = () =>
    !dirty || confirm("Discard unsaved team changes?");
  const openTeam = async (summary: TeamSummary) => {
    if (!confirmDiscard()) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const generation = ++loadGeneration.current;
    setStatus({ kind: "loading", message: `Loading ${summary.name}…` });
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
      setFieldErrors({});
      setStatus({ kind: "idle" });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };
  const create = async () => {
    if (!confirmDiscard()) return;
    const name = prompt("Team name (up to 80 characters)")?.trim();
    if (!name) return;
    if (name.length > 80) {
      setStatus({
        kind: "error",
        message: "Use 80 characters or fewer for the team name.",
      });
      return;
    }
    loadController.current?.abort();
    let source = activeData;
    if (!source) {
      setStatus({ kind: "loading", message: "Loading the active regulation…" });
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
    const team = empty(name);
    setDraft(team);
    setBaseline(null);
    setStatus({ kind: "idle" });
  };
  const save = async () => {
    if (!draft || !data) return;
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
        body: JSON.stringify(serializeDraft(draft)),
      });
      const payload = await response.json();
      const problem = parseProblem(payload);
      if (!response.ok || problem) {
        setFieldErrors(problem?.fields ?? {});
        throw new Error(problem?.message ?? "The team could not be saved.");
      }
      const team = parseTeam(payload);
      setDraft(clone(team));
      setBaseline(clone(team));
      const summary: TeamSummary = {
        id: team.id!,
        name: team.name,
        data_version: team.data_version,
        regulation: team.regulation,
        member_count: team.members.length,
        updated_at: team.updated_at!,
      };
      setTeams((values) => [
        summary,
        ...values.filter((item) => item.id !== summary.id),
      ]);
      setStatus({ kind: "success", message: "Team saved." });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };
  const removeTeam = async () => {
    if (!draft?.id || !confirm(`Permanently delete “${draft.name}”?`)) return;
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
      setStatus({ kind: "success", message: "Team deleted." });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };
  if (status.kind === "loading" && !data)
    return (
      <section class="team-state" aria-live="polite">
        <h1>Team Builder</h1>
        <p>Loading regulation data…</p>
      </section>
    );
  if (!data)
    return (
      <section class="team-state team-state--error" role="alert">
        <h1>Team Builder unavailable</h1>
        <p>{status.message ?? "The pinned Pokémon data is unavailable."}</p>
      </section>
    );
  const serious =
    data.natures.find((item) => item.id === "serious") ??
    data.natures.find(
      (item) => item.increased_stat === null && item.decreased_stat === null,
    )!;
  return (
    <div class="team-builder-app" data-dirty={dirty ? "true" : "false"}>
      <aside class="team-library" aria-labelledby="my-teams-title">
        <header>
          <div>
            <p class="eyebrow">{bootstrap.regulation.name}</p>
            <h1 id="my-teams-title">My Teams</h1>
          </div>
          <button
            class="button button--primary"
            type="button"
            onClick={() => void create()}
          >
            New Team
          </button>
        </header>
        {teams.length ? (
          <ul>
            {teams.map((team) => (
              <li>
                <button
                  type="button"
                  class={draft?.id === team.id ? "selected" : ""}
                  onClick={() => void openTeam(team)}
                >
                  <strong>{team.name}</strong>
                  <span>{team.member_count} / 6 Pokémon</span>
                  <time dateTime={team.updated_at}>
                    {new Date(team.updated_at).toLocaleDateString()}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div class="library-empty">
            <p>No teams in this regulation yet.</p>
            <button
              class="button button--secondary"
              type="button"
              onClick={() => void create()}
            >
              Create your first team
            </button>
          </div>
        )}
      </aside>
      <main class="team-workspace">
        {status.message && (
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
        {draft ? (
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
                  onChange={(next) => {
                    const members = [...draft.members];
                    members[index] = next;
                    setDraft({ ...draft, members });
                  }}
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      members: draft.members.filter((_, i) => i !== index),
                    })
                  }
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
              onClick={() => void create()}
            >
              New Team
            </button>
          </section>
        )}
      </main>
      {palette !== null && (
        <PokemonPalette
          data={data}
          members={draft?.members ?? []}
          onClose={() => {
            setPalette(null);
            requestAnimationFrame(() => slotTrigger.current?.focus());
          }}
          onChoose={(form) => {
            if (!draft) return;
            const targetSlot = palette;
            setDraft({
              ...draft,
              members: [
                ...draft.members,
                newMember(form.id, serious.id, palette),
              ].sort((left, right) => left.position - right.position),
            });
            setPalette(null);
            requestAnimationFrame(() =>
              document.getElementById(`member-${targetSlot}-nickname`)?.focus(),
            );
          }}
        />
      )}
      <span class="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
