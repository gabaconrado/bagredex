import type { FormSummary, NamedValue, PokedexIndex, Stats } from "./contracts";

export type FilterKind = "move" | "ability" | "type";
export type Filter = NamedValue & { kind: FilterKind };
export type SortKey = keyof Stats | "bst";
export type Sort = {
  key: SortKey;
  direction: "ascending" | "descending";
} | null;
export type Suggestion = NamedValue & { kind: "pokemon" | FilterKind };

export const statLabels: Record<SortKey, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
  bst: "BST",
};

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function suggestions(index: PokedexIndex, query: string): Suggestion[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const matches = (values: NamedValue[]) =>
    values.filter((value) => normalizeSearch(value.name).includes(needle));
  return [
    ...matches(index.forms).map((value) => ({
      ...value,
      kind: "pokemon" as const,
    })),
    ...matches(index.moves).map((value) => ({
      ...value,
      kind: "move" as const,
    })),
    ...matches(index.abilities).map((value) => ({
      ...value,
      kind: "ability" as const,
    })),
    ...matches(index.types).map((value) => ({
      ...value,
      kind: "type" as const,
    })),
  ];
}

export function filteredForms(
  forms: FormSummary[],
  filters: Filter[],
): FormSummary[] {
  return forms.filter((form) =>
    filters.every((filter) => {
      if (filter.kind === "move") return form.move_ids.includes(filter.id);
      if (filter.kind === "ability")
        return form.ability_ids.includes(filter.id);
      return form.types.some((type) => type.id === filter.id);
    }),
  );
}

export function sortedForms(forms: FormSummary[], sort: Sort): FormSummary[] {
  return [...forms].sort((left, right) => {
    if (sort) {
      const leftValue = sort.key === "bst" ? left.bst : left.stats[sort.key];
      const rightValue = sort.key === "bst" ? right.bst : right.stats[sort.key];
      if (leftValue !== rightValue)
        return (
          (leftValue - rightValue) * (sort.direction === "ascending" ? 1 : -1)
        );
    }
    return (
      left.national_dex_number - right.national_dex_number ||
      left.id.localeCompare(right.id)
    );
  });
}

export function cycleSort(sort: Sort, key: SortKey): Sort {
  if (!sort || sort.key !== key) return { key, direction: "ascending" };
  if (sort.direction === "ascending") return { key, direction: "descending" };
  return null;
}

export function addFilter(filters: Filter[], filter: Filter): Filter[] {
  return filters.some(
    (item) => item.kind === filter.kind && item.id === filter.id,
  )
    ? filters
    : [...filters, filter];
}
