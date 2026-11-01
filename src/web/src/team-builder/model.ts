import type {
  BuilderData,
  BuilderForm,
  MegaSearchEntry,
  Member,
  Named,
  Nature,
  StatId,
  Stats,
} from "./contracts";
import type { Sort } from "../model";

export type PaletteFilter = Named & { kind: "type" | "ability" | "move" };
export type PaletteChoice =
  | (BuilderForm & { kind: "ordinary" })
  | (MegaSearchEntry & { kind: "mega" });
export const statIds: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];
export const statLabels: Record<StatId, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};
export const baseStatTotal = (stats: Stats) =>
  statIds.reduce((total, id) => total + stats[id], 0);
export function sortPaletteForms<T extends BuilderForm>(
  forms: T[],
  sort: Sort,
): T[] {
  return [...forms].sort((left, right) => {
    if (sort) {
      const leftValue =
        sort.key === "bst"
          ? baseStatTotal(left.base_stats)
          : left.base_stats[sort.key];
      const rightValue =
        sort.key === "bst"
          ? baseStatTotal(right.base_stats)
          : right.base_stats[sort.key];
      if (leftValue !== rightValue)
        return (
          (leftValue - rightValue) * (sort.direction === "ascending" ? 1 : -1)
        );
    }
    return (
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    );
  });
}
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const matches = (name: string, query: string) =>
  normalizeSearch(name).includes(normalizeSearch(query));

export function paletteResults<T extends BuilderForm>(
  forms: T[],
  query: string,
  filters: PaletteFilter[],
  usedSpecies: Set<string>,
): T[] {
  return forms
    .filter(
      (form) =>
        !usedSpecies.has(form.base_species_id) &&
        matches(form.name, query) &&
        filters.every((filter) =>
          filter.kind === "type"
            ? form.types.some((type) => type.id === filter.id)
            : filter.kind === "ability"
              ? form.ability_ids.includes(filter.id)
              : form.move_ids.includes(filter.id),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function paletteChoices(data: BuilderData): PaletteChoice[] {
  return [
    ...data.forms.map((form) => ({ ...form, kind: "ordinary" as const })),
    ...data.mega_search_entries.map((entry) => ({
      ...entry,
      kind: "mega" as const,
    })),
  ];
}

export function newMember(
  formId: string,
  seriousId: string,
  position = 0,
): Member {
  return {
    position,
    form_id: formId,
    nickname: "",
    ability_id: null,
    item_id: null,
    move_ids: [null, null, null, null],
    nature_id: seriousId,
    sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    shiny: false,
    mega_preview: false,
  };
}
export function memberFromPaletteChoice(
  choice: PaletteChoice,
  seriousId: string,
  position: number,
): Member {
  const member = newMember(
    choice.kind === "mega" ? choice.base_form_id : choice.id,
    seriousId,
    position,
  );
  return choice.kind === "mega"
    ? { ...member, item_id: choice.item_id, mega_preview: true }
    : member;
}
export const spTotal = (sp: Stats) =>
  statIds.reduce((total, id) => total + sp[id], 0);
export function clampSpEdit(
  sp: Stats,
  stat: StatId,
  requested: number,
  mechanics: { sp_min: number; sp_max: number; sp_total_max: number },
): number {
  const integer = Number.isFinite(requested)
    ? Math.trunc(requested)
    : mechanics.sp_min;
  const otherTotal = statIds.reduce(
    (total, id) => total + (id === stat ? 0 : sp[id]),
    0,
  );
  return Math.min(
    mechanics.sp_max,
    Math.max(mechanics.sp_min, integer),
    Math.max(mechanics.sp_min, mechanics.sp_total_max - otherTotal),
  );
}
export function realStats(base: Stats, sp: Stats, nature: Nature): Stats {
  const result = {} as Stats;
  for (const id of statIds) {
    const raw = id === "hp" ? base[id] + sp[id] + 75 : base[id] + sp[id] + 20;
    const modifier =
      nature.increased_stat === id
        ? 110
        : nature.decreased_stat === id
          ? 90
          : 100;
    result[id] = id === "hp" ? raw : Math.floor((raw * modifier) / 100);
  }
  return result;
}
export function validateLocal(
  member: Member,
  data: BuilderData,
  members: Member[],
  index: number,
) {
  const errors: Record<string, string> = {};
  const form = data.forms.find((item) => item.id === member.form_id);
  if (!form) return { form_id: "Choose a legal Pokémon." };
  if (
    !member.nature_id ||
    !data.natures.some((nature) => nature.id === member.nature_id)
  )
    errors.nature_id = "Choose a valid nature.";
  if (member.nickname.length > 10)
    errors.nickname = "Use 10 characters or fewer.";
  if (member.ability_id && !form.ability_ids.includes(member.ability_id))
    errors.ability_id = "Choose an ability this Pokémon can use.";
  if (member.item_id && !data.items.some((item) => item.id === member.item_id))
    errors.item_id = "Choose an available item.";
  else if (
    member.item_id &&
    members.some(
      (item, memberIndex) =>
        memberIndex !== index && item.item_id === member.item_id,
    )
  )
    errors.item_id = "Another Pokémon already holds this item.";
  const seen = new Set<string>();
  member.move_ids.forEach((id, moveIndex) => {
    if (!id) return;
    if (!form.move_ids.includes(id))
      errors[`move_ids.${moveIndex}`] = "Choose a move this Pokémon can learn.";
    else if (seen.has(id))
      errors[`move_ids.${moveIndex}`] = "Choose each move once.";
    seen.add(id);
  });
  if (spTotal(member.sp) > data.mechanics.sp_total_max)
    errors.sp = `Use no more than ${data.mechanics.sp_total_max} SP total.`;
  for (const id of statIds)
    if (
      !Number.isInteger(member.sp[id]) ||
      member.sp[id] < 0 ||
      member.sp[id] > data.mechanics.sp_max
    )
      errors[`sp.${id}`] =
        `Enter a whole number from ${data.mechanics.sp_min} to ${data.mechanics.sp_max}.`;
  return errors;
}

export function moveMember(members: Member[], index: number, delta: -1 | 1) {
  const member = members[index];
  if (!member) return null;
  const target = member.position + delta;
  if (target < 0 || target > 5) return null;
  const moved = members.map((item) => ({ ...item }));
  const other = moved.find((item) => item.position === target);
  moved[index]!.position = target;
  if (other) other.position = member.position;
  moved.sort((left, right) => left.position - right.position);
  return { members: moved, position: target };
}
