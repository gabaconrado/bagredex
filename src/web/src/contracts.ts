export type NamedValue = { id: string; name: string };
export type Stats = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
};
export type FormGroup = {
  label: string;
  options: { id: string; label: string }[];
};
export type FormSummary = NamedValue & {
  national_dex_number: number;
  is_mega: boolean;
  types: NamedValue[];
  stats: Stats;
  bst: number;
  ability_ids: string[];
  move_ids: string[];
  form_group: FormGroup | null;
};
export type PokedexIndex = {
  schema_version: "pokedex-index-v2";
  data_version: string;
  regulation: NamedValue;
  forms: FormSummary[];
  moves: NamedValue[];
  abilities: NamedValue[];
  types: NamedValue[];
};
export type AbilityDetail = NamedValue & {
  slot: string;
  short_description: string;
  description: string;
};
export type MoveDetail = NamedValue & {
  type: NamedValue;
  category: string;
  base_power: number;
  accuracy: number | null;
  always_hits: boolean;
  pp: number;
  priority: number;
  target: string;
  short_description: string;
  description: string;
  flags: string[];
};
export type StatDetail = {
  id: string;
  name: string;
  base: number;
  real: number;
  minimum: number;
  maximum: number;
};
export type FormDetail = {
  schema_version: "pokedex-form-detail-v1";
  data_version: string;
  regulation_id: string;
  form: NamedValue & {
    is_list_legal: boolean;
    is_mega: boolean;
    types: NamedValue[];
    sprites: { normal: string; shiny: string };
    form_switches: { base: NamedValue; megas: NamedValue[] };
    stats: StatDetail[];
    abilities: AbilityDetail[];
    moves: MoveDetail[];
  };
};
export type Bootstrap = {
  schema_version: "pokedex-bootstrap-v2";
  active_version: string;
  regulation: NamedValue;
  index_url: string;
  details_url: string;
  sprite_url_template: string;
};
export type ApiError = {
  code: string;
  message: string;
  active_version?: string;
  url?: string;
};
export type BulkForm = NamedValue & {
  is_list_legal: boolean;
  is_mega: boolean;
  form_label: string;
  base_id: string;
  mega_ids: string[];
  types: NamedValue[];
  stats: StatDetail[];
  ability_slots: { id: string; slot: string }[];
  move_ids: string[];
  form_group: FormGroup | null;
};
export type BulkAbility = NamedValue & {
  short_description: string;
  description: string;
};
export type BulkDetails = {
  schema_version: "pokedex-details-v2";
  data_version: string;
  regulation_id: string;
  forms: BulkForm[];
  abilities: BulkAbility[];
  moves: MoveDetail[];
};
export type DetailsMaps = {
  forms: ReadonlyMap<string, BulkForm>;
  abilities: ReadonlyMap<string, BulkAbility>;
  moves: ReadonlyMap<string, MoveDetail>;
};

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const string = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const localUrl = (value: unknown): value is string =>
  string(value) && value.startsWith("/") && !value.startsWith("//");

export function parseBootstrap(value: unknown): Bootstrap {
  const record = object(value);
  if (
    record?.schema_version !== "pokedex-bootstrap-v2" ||
    !string(record.active_version) ||
    !localUrl(record.index_url) ||
    !localUrl(record.details_url) ||
    !localUrl(record.sprite_url_template)
  ) {
    throw new Error("The Pokédex page configuration is invalid.");
  }
  assertNamed(record.regulation);
  if (
    !record.sprite_url_template.includes("__FORM__") ||
    !record.sprite_url_template.includes("__VARIANT__")
  )
    throw new Error(
      "The Pokédex page configuration contains an invalid sprite URL.",
    );
  return value as Bootstrap;
}

function assertNamed(value: unknown): asserts value is NamedValue {
  const record = object(value);
  if (!record || !string(record.id) || !string(record.name))
    throw new Error("Invalid named value.");
}

function assertStringArray(
  value: unknown,
  label: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => !string(item)))
    throw new Error(`The Pokédex response contains invalid ${label}.`);
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`The Pokédex response contains an invalid ${label}.`);
}

export function parseIndex(value: unknown): PokedexIndex {
  const record = object(value);
  if (
    record?.schema_version !== "pokedex-index-v2" ||
    !string(record.data_version) ||
    !object(record.regulation) ||
    !Array.isArray(record.forms) ||
    !Array.isArray(record.moves) ||
    !Array.isArray(record.abilities) ||
    !Array.isArray(record.types)
  ) {
    throw new Error("The Pokédex index uses an unsupported format.");
  }
  assertNamed(record.regulation);
  [...record.moves, ...record.abilities, ...record.types].forEach(assertNamed);
  for (const formValue of record.forms) {
    assertNamed(formValue);
    const form = formValue as unknown as Record<string, unknown>;
    if (
      !Number.isInteger(form.national_dex_number) ||
      (form.national_dex_number as number) < 1 ||
      typeof form.is_mega !== "boolean" ||
      !Array.isArray(form.types) ||
      form.types.length === 0 ||
      !Array.isArray(form.ability_ids) ||
      !Array.isArray(form.move_ids) ||
      !(form.form_group === null || object(form.form_group)) ||
      !object(form.stats)
    ) {
      throw new Error("The Pokédex index contains an invalid form.");
    }
    form.types.forEach(assertNamed);
    assertStringArray(form.ability_ids, "ability identifiers");
    assertStringArray(form.move_ids, "move identifiers");
    validateFormGroup(form.form_group, String(form.id));
    for (const key of ["hp", "atk", "def", "spa", "spd", "spe"])
      assertNumber((form.stats as Record<string, unknown>)[key], `${key} stat`);
    assertNumber(form.bst, "BST");
  }
  return value as PokedexIndex;
}

export function parseDetail(value: unknown): FormDetail {
  const record = object(value);
  const form = object(record?.form);
  if (
    record?.schema_version !== "pokedex-form-detail-v1" ||
    !string(record.data_version) ||
    !string(record.regulation_id) ||
    !form ||
    typeof form.is_list_legal !== "boolean" ||
    typeof form.is_mega !== "boolean" ||
    !Array.isArray(form.types) ||
    !Array.isArray(form.stats) ||
    !Array.isArray(form.abilities) ||
    !Array.isArray(form.moves) ||
    !object(form.sprites) ||
    !object(form.form_switches)
  ) {
    throw new Error("The Pokémon detail uses an unsupported format.");
  }
  assertNamed(record.form);
  form.types.forEach(assertNamed);
  const sprites = form.sprites as Record<string, unknown>;
  const switches = form.form_switches as Record<string, unknown>;
  if (
    !localUrl(sprites.normal) ||
    !localUrl(sprites.shiny) ||
    !object(switches.base) ||
    !Array.isArray(switches.megas)
  )
    throw new Error(
      "The Pokémon detail contains invalid sprite or form switches.",
    );
  assertNamed(switches.base);
  switches.megas.forEach(assertNamed);
  form.stats.forEach((value) => {
    const stat = object(value);
    assertNamed(value);
    if (!stat) throw new Error("The Pokémon detail contains an invalid stat.");
    for (const key of ["base", "real", "minimum", "maximum"])
      assertNumber(stat[key], `detail ${key}`);
  });
  form.abilities.forEach((value) => {
    const ability = object(value);
    assertNamed(value);
    if (
      !ability ||
      !string(ability.slot) ||
      typeof ability.short_description !== "string" ||
      typeof ability.description !== "string"
    )
      throw new Error("The Pokémon detail contains an invalid ability.");
  });
  form.moves.forEach((value) => {
    const move = object(value);
    assertNamed(value);
    if (
      !move ||
      !object(move.type) ||
      !string(move.category) ||
      typeof move.always_hits !== "boolean" ||
      !string(move.target) ||
      typeof move.short_description !== "string" ||
      typeof move.description !== "string"
    )
      throw new Error("The Pokémon detail contains an invalid move.");
    assertNamed(move.type);
    for (const key of ["base_power", "pp", "priority"])
      assertNumber(move[key], `move ${key}`);
    if (move.accuracy !== null) assertNumber(move.accuracy, "move accuracy");
    if ((move.accuracy === null) !== (move.always_hits === true))
      throw new Error(
        "The Pokémon detail contains inconsistent move accuracy.",
      );
    assertStringArray(move.flags, "move flags");
  });
  return value as FormDetail;
}

const uniqueMap = <T extends { id: string }>(values: T[], label: string) => {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.id))
      throw new Error(`The Pokédex details contain a duplicate ${label}.`);
    result.set(value.id, value);
  }
  return result;
};

export function parseDetails(
  value: unknown,
  expectedVersion: string,
  expectedRegulation: string,
): { details: BulkDetails; maps: DetailsMaps } {
  const record = object(value);
  if (
    record?.schema_version !== "pokedex-details-v2" ||
    !string(record.data_version) ||
    !string(record.regulation_id) ||
    !Array.isArray(record.forms) ||
    !Array.isArray(record.abilities) ||
    !Array.isArray(record.moves)
  )
    throw new Error("The Pokédex details use an unsupported format.");
  if (
    record.data_version !== expectedVersion ||
    record.regulation_id !== expectedRegulation
  )
    throw new Error("The Pokémon data changed. Reload the Pokédex.");

  for (const value of record.abilities) {
    assertNamed(value);
    const ability = object(value)!;
    if (
      typeof ability.short_description !== "string" ||
      typeof ability.description !== "string"
    )
      throw new Error("The Pokédex details contain an invalid ability.");
  }
  for (const value of record.moves) validateMove(value);
  for (const value of record.forms) {
    assertNamed(value);
    const form = object(value)!;
    if (
      typeof form.is_list_legal !== "boolean" ||
      typeof form.is_mega !== "boolean" ||
      typeof form.form_label !== "string" ||
      !string(form.base_id) ||
      !Array.isArray(form.types) ||
      form.types.length === 0 ||
      !Array.isArray(form.stats) ||
      !Array.isArray(form.ability_slots) ||
      !(form.form_group === null || object(form.form_group))
    )
      throw new Error("The Pokédex details contain an invalid form.");
    form.types.forEach(assertNamed);
    assertStringArray(form.mega_ids, "Mega identifiers");
    assertStringArray(form.move_ids, "move identifiers");
    validateFormGroup(form.form_group, String(form.id));
    form.stats.forEach(validateStat);
    for (const slotValue of form.ability_slots) {
      const slot = object(slotValue);
      if (!slot || !string(slot.id) || !string(slot.slot))
        throw new Error("The Pokédex details contain an invalid ability slot.");
    }
  }

  const details = value as BulkDetails;
  const forms = uniqueMap(details.forms, "form identifier");
  const abilities = uniqueMap(details.abilities, "ability identifier");
  const moves = uniqueMap(details.moves, "move identifier");
  for (const form of details.forms) {
    if (!forms.has(form.base_id))
      throw new Error("The Pokédex details contain a dangling base form.");
    for (const id of form.mega_ids)
      if (!forms.has(id))
        throw new Error("The Pokédex details contain a dangling Mega form.");
    for (const { id } of form.ability_slots)
      if (!abilities.has(id))
        throw new Error("The Pokédex details contain a dangling ability.");
    for (const id of form.move_ids)
      if (!moves.has(id))
        throw new Error("The Pokédex details contain a dangling move.");
    for (const option of form.form_group?.options ?? [])
      if (!forms.has(option.id))
        throw new Error("The Pokédex details contain a dangling form option.");
  }
  return { details, maps: { forms, abilities, moves } };
}

function validateFormGroup(value: unknown, formId: string): void {
  if (value === null) return;
  const group = object(value);
  if (!group || !string(group.label) || !Array.isArray(group.options))
    throw new Error("The Pokédex response contains an invalid form group.");
  const ids = new Set<string>();
  let selectedCount = 0;
  for (const value of group.options) {
    const option = object(value);
    if (
      !option ||
      !string(option.id) ||
      !string(option.label) ||
      ids.has(option.id)
    )
      throw new Error("The Pokédex response contains an invalid form option.");
    ids.add(option.id);
    if (option.id === formId) selectedCount += 1;
  }
  if (group.options.length === 0 || selectedCount !== 1)
    throw new Error("The Pokédex response contains an invalid form group.");
}

function validateStat(value: unknown): void {
  const stat = object(value);
  assertNamed(value);
  if (!stat) throw new Error("The Pokédex details contain an invalid stat.");
  for (const key of ["base", "real", "minimum", "maximum"])
    assertNumber(stat[key], `detail ${key}`);
}

function validateMove(value: unknown): void {
  const move = object(value);
  assertNamed(value);
  if (
    !move ||
    !object(move.type) ||
    !["Physical", "Special", "Status"].includes(String(move.category)) ||
    typeof move.always_hits !== "boolean" ||
    !string(move.target) ||
    typeof move.short_description !== "string" ||
    typeof move.description !== "string"
  )
    throw new Error("The Pokédex details contain an invalid move.");
  assertNamed(move.type);
  for (const key of ["base_power", "pp", "priority"])
    assertNumber(move[key], `move ${key}`);
  if (move.accuracy !== null) assertNumber(move.accuracy, "move accuracy");
  if ((move.accuracy === null) !== (move.always_hits === true))
    throw new Error("The Pokédex details contain inconsistent move accuracy.");
  assertStringArray(move.flags, "move flags");
}

export function parseApiError(value: unknown): ApiError {
  const record = object(value);
  if (!record || !string(record.code) || !string(record.message))
    return {
      code: "request-failed",
      message: "The request failed unexpectedly.",
    };
  if (record.active_version !== undefined && !string(record.active_version))
    return {
      code: "request-failed",
      message: "The request failed unexpectedly.",
    };
  if (record.url !== undefined && !localUrl(record.url))
    return {
      code: "request-failed",
      message: "The request failed unexpectedly.",
    };
  if (
    record.code === "data-version-changed" &&
    (!string(record.active_version) || !localUrl(record.url))
  )
    return {
      code: "request-failed",
      message: "The request failed unexpectedly.",
    };
  return value as ApiError;
}
