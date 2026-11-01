export type FormOption = { id: string; label: string };

export type PokemonSearchEntry = {
  form_id: string;
  name: string;
  form_group: { label: string; options: FormOption[] } | null;
};

type CanonicalForm = { id: string; is_mega?: boolean };

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const exactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
};

export function parsePokemonSearchEntries(
  value: unknown,
  forms: CanonicalForm[],
): PokemonSearchEntry[] {
  if (!Array.isArray(value)) throw new Error("Invalid Pokémon search entries.");
  const formsById = new Map(forms.map((form) => [form.id, form]));
  const represented = new Set<string>();
  const entryIds = new Set<string>();
  const result: PokemonSearchEntry[] = [];
  for (const candidate of value) {
    const entry = object(candidate);
    if (
      !entry ||
      !exactKeys(entry, ["form_id", "name", "form_group"]) ||
      !text(entry.form_id) ||
      !text(entry.name) ||
      entryIds.has(entry.form_id)
    )
      throw new Error("Invalid Pokémon search entry.");
    const representative = formsById.get(entry.form_id);
    if (!representative || representative.is_mega)
      throw new Error("Invalid Pokémon search representative.");
    entryIds.add(entry.form_id);
    if (entry.form_group === null) {
      if (represented.has(entry.form_id))
        throw new Error("Duplicate Pokémon search form.");
      represented.add(entry.form_id);
      result.push({
        form_id: entry.form_id,
        name: entry.name,
        form_group: null,
      });
      continue;
    }
    const group = object(entry.form_group);
    if (
      !group ||
      !exactKeys(group, ["label", "options"]) ||
      !text(group.label) ||
      !Array.isArray(group.options) ||
      group.options.length < 2
    )
      throw new Error("Invalid Pokémon form group.");
    const optionIds = new Set<string>();
    const options: FormOption[] = [];
    for (const candidateOption of group.options) {
      const option = object(candidateOption);
      if (
        !option ||
        !exactKeys(option, ["id", "label"]) ||
        !text(option.id) ||
        !text(option.label) ||
        optionIds.has(option.id) ||
        represented.has(option.id)
      )
        throw new Error("Invalid Pokémon form option.");
      const form = formsById.get(option.id);
      if (!form || form.is_mega)
        throw new Error("Invalid Pokémon form option reference.");
      optionIds.add(option.id);
      represented.add(option.id);
      options.push({ id: option.id, label: option.label });
    }
    if (!optionIds.has(entry.form_id))
      throw new Error("Pokémon form group omits its representative.");
    result.push({
      form_id: entry.form_id,
      name: entry.name,
      form_group: { label: group.label, options },
    });
  }
  const expected = new Set(
    forms.filter(({ is_mega }) => !is_mega).map(({ id }) => id),
  );
  if (
    represented.size !== expected.size ||
    [...expected].some((id) => !represented.has(id))
  )
    throw new Error("Pokémon search entries do not cover canonical forms.");
  return result;
}

export function searchEntryForForm(
  entries: PokemonSearchEntry[],
  formId: string | null,
) {
  if (!formId) return undefined;
  return entries.find(
    (entry) =>
      entry.form_id === formId ||
      entry.form_group?.options.some(({ id }) => id === formId),
  );
}
