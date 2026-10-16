import type {
  FormSummary,
  MoveDetail,
  NamedValue,
  PokedexIndex,
  Stats,
} from "./contracts";

export type FilterKind = "move" | "ability" | "type";
export type Filter = NamedValue & { kind: FilterKind };
export type SortKey = keyof Stats | "bst";
export type Sort = {
  key: SortKey;
  direction: "ascending" | "descending";
} | null;
export type Suggestion = NamedValue & { kind: "pokemon" | FilterKind };
export type MoveSortKey = "type" | "category" | "power";
export type MoveSort = {
  key: MoveSortKey;
  direction: "ascending" | "descending";
} | null;

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
  if (!sort || sort.key !== key) return { key, direction: "descending" };
  if (sort.direction === "descending") return { key, direction: "ascending" };
  return null;
}

export function cycleMoveSort(sort: MoveSort, key: MoveSortKey): MoveSort {
  const first = key === "power" ? "descending" : "ascending";
  if (!sort || sort.key !== key) return { key, direction: first };
  if (sort.direction === first)
    return {
      key,
      direction: first === "ascending" ? "descending" : "ascending",
    };
  return null;
}

const compareText = (left: string, right: string) =>
  normalizeSearch(left) < normalizeSearch(right)
    ? -1
    : normalizeSearch(left) > normalizeSearch(right)
      ? 1
      : 0;
const moveTie = (left: MoveDetail, right: MoveDetail) =>
  compareText(left.name, right.name) || compareText(left.id, right.id);
const categoryRank = { Physical: 0, Special: 1, Status: 2 } as const;

export function sortedMoves(moves: MoveDetail[], sort: MoveSort): MoveDetail[] {
  if (!sort) return [...moves];
  const direction = sort.direction === "ascending" ? 1 : -1;
  return [...moves].sort((left, right) => {
    let primary = 0;
    if (sort.key === "type")
      primary = compareText(left.type.name, right.type.name);
    if (sort.key === "category")
      primary =
        categoryRank[left.category as keyof typeof categoryRank] -
        categoryRank[right.category as keyof typeof categoryRank];
    if (sort.key === "power") {
      const leftStatus = left.category === "Status";
      const rightStatus = right.category === "Status";
      if (leftStatus !== rightStatus) return leftStatus ? 1 : -1;
      if (!leftStatus) primary = left.base_power - right.base_power;
    }
    return primary ? primary * direction : moveTie(left, right);
  });
}

export function addFilter(filters: Filter[], filter: Filter): Filter[] {
  return filters.some(
    (item) => item.kind === filter.kind && item.id === filter.id,
  )
    ? filters
    : [...filters, filter];
}
