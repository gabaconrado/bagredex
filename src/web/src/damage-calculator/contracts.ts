export type StatId = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
const statIds = new Set<StatId>(["hp", "atk", "def", "spa", "spd", "spe"]);
export type Stats = Record<StatId, number>;
export type Named = { id: string; name: string };
export type ContextInput =
  | { key: string; label: string; kind: "boolean"; default: boolean }
  | {
      key: string;
      label: string;
      kind: "integer";
      default: number;
      minimum: number;
      maximum: number;
    }
  | {
      key: string;
      label: string;
      kind: "choice";
      default: string;
      choices: { value: string; label: string }[];
    };
export type Form = Named & {
  searchable: boolean;
  is_mega: boolean;
  is_nfe: boolean;
  gender: string;
  gender_options: ("M" | "F" | "N")[];
  default_gender: "M" | "F" | "N";
  types: string[];
  base_stats: Stats;
  weight_tenths_kg: number;
  abilities: { id: string; slot: string }[];
  move_ids: string[];
  sprite_form_id: string;
};
export type Nature = Named & {
  increased_stat: StatId | null;
  decreased_stat: StatId | null;
};
export type Ability = Named & { contextual_inputs: ContextInput[] };
export type Item = Named & {
  calculation: Record<string, unknown>;
  contextual_inputs: ContextInput[];
};
export type Move = Named & {
  description: string;
  type_id: string;
  category: "Physical" | "Special" | "Status";
  base_power: number;
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  flags: string[];
  calculation: Record<string, unknown>;
  contextual_inputs: ContextInput[];
};
export type MegaRelation = {
  item_id: string;
  base_form_id: string;
  mega_form_id: string;
  locked_ability_id: string;
};
export type CalculatorData = {
  schema_version: "damage-calculator-data-v2";
  data_version: string;
  regulation: Named;
  sprite_url_template: string;
  capability: {
    status_values: string[];
    stat_stage_minimum: number;
    stat_stage_maximum: number;
  };
  mechanics: { level: 50; sp_minimum: 0; sp_maximum: 32 };
  natures: Nature[];
  types: Named[];
  forms: Form[];
  abilities: Ability[];
  items: Item[];
  moves: Move[];
  mega_item_relations: MegaRelation[];
  type_effectiveness: {
    attacking_type_id: string;
    defending_type_id: string;
    multiplier_percent: number;
  }[];
};
export type Bootstrap = {
  schema_version: "damage-calculator-bootstrap-v1";
  active_version: string;
  regulation: Named;
  dataset_url: string;
};

const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const localUrl = (value: unknown): value is string =>
  text(value) && value.startsWith("/") && !value.startsWith("//");
const named = (value: unknown): value is Named => {
  const row = object(value);
  return Boolean(row && text(row.id) && text(row.name));
};
const unique = (rows: unknown[], label: string) => {
  const ids = rows.map((row) => object(row)?.id);
  if (ids.some((id) => !text(id)) || new Set(ids).size !== ids.length)
    throw new Error(`Invalid ${label} identifiers.`);
};
const exactKeys = (
  value: Record<string, unknown>,
  expected: string[],
  label: string,
) => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  )
    throw new Error(`Invalid ${label} keys.`);
};
const assertDescriptors = (value: unknown) => {
  if (!Array.isArray(value)) throw new Error("Invalid contextual inputs.");
  const keys = new Set<string>();
  for (const candidate of value) {
    const row = object(candidate);
    if (!row || !text(row.key) || keys.has(row.key) || !text(row.label))
      throw new Error("Invalid contextual input.");
    keys.add(row.key);
    if (row.kind === "boolean") {
      exactKeys(
        row,
        ["key", "label", "kind", "default"],
        "boolean contextual input",
      );
      if (typeof row.default !== "boolean")
        throw new Error("Invalid boolean contextual input.");
    } else if (row.kind === "integer") {
      exactKeys(
        row,
        ["key", "label", "kind", "default", "minimum", "maximum"],
        "integer contextual input",
      );
      if (
        ![row.default, row.minimum, row.maximum].every(Number.isInteger) ||
        Number(row.minimum) > Number(row.default) ||
        Number(row.default) > Number(row.maximum)
      )
        throw new Error("Invalid integer contextual input.");
    } else if (row.kind === "choice") {
      exactKeys(
        row,
        ["key", "label", "kind", "default", "choices"],
        "choice contextual input",
      );
      if (!text(row.default) || !Array.isArray(row.choices))
        throw new Error("Invalid choice contextual input.");
      const choices = row.choices.map(object);
      if (
        choices.some(
          (choice) => !choice || !text(choice.value) || !text(choice.label),
        ) ||
        !choices.some((choice) => choice?.value === row.default)
      )
        throw new Error("Invalid choice contextual input.");
    } else throw new Error("Unknown contextual input kind.");
  }
};
const assertFraction = (value: unknown, label: string) => {
  if (value === null) return;
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(Number.isInteger) ||
    Number(value[1]) <= 0
  )
    throw new Error(`Invalid ${label}.`);
};
const assertSecondary = (value: unknown) => {
  if (value === null) return;
  const row = object(value);
  if (!row) throw new Error("Invalid move secondary.");
  exactKeys(
    row,
    ["boosts", "chance", "self_boosts", "status", "volatile_status"],
    "move secondary",
  );
  if (
    !object(row.boosts) ||
    !object(row.self_boosts) ||
    (row.chance !== null && !Number.isInteger(row.chance)) ||
    (row.status !== null && typeof row.status !== "string") ||
    (row.volatile_status !== null && typeof row.volatile_status !== "string")
  )
    throw new Error("Invalid move secondary.");
  for (const boosts of [row.boosts, row.self_boosts])
    for (const [stat, amount] of Object.entries(boosts as object))
      if (
        ![...statIds, "accuracy"].includes(stat as StatId | "accuracy") ||
        !Number.isInteger(amount) ||
        Number(amount) < -6 ||
        Number(amount) > 6
      )
        throw new Error("Invalid move secondary boost.");
};

export function parseBootstrap(value: unknown): Bootstrap {
  const row = object(value);
  if (
    !row ||
    row.schema_version !== "damage-calculator-bootstrap-v1" ||
    !text(row.active_version) ||
    !named(row.regulation) ||
    !localUrl(row.dataset_url)
  )
    throw new Error("The damage calculator configuration is invalid.");
  exactKeys(
    row,
    ["schema_version", "active_version", "regulation", "dataset_url"],
    "calculator bootstrap",
  );
  return value as Bootstrap;
}

export function parseCalculatorData(value: unknown): CalculatorData {
  const row = object(value);
  if (
    !row ||
    row.schema_version !== "damage-calculator-data-v2" ||
    !text(row.data_version) ||
    !named(row.regulation) ||
    !localUrl(row.sprite_url_template)
  )
    throw new Error("The damage calculator data uses an unsupported format.");
  exactKeys(
    row,
    [
      "schema_version",
      "data_version",
      "regulation",
      "mechanics",
      "sprite_url_template",
      "state_input_policy",
      "capability",
      "natures",
      "types",
      "forms",
      "abilities",
      "items",
      "moves",
      "mega_item_relations",
      "type_effectiveness",
    ],
    "calculator data",
  );
  for (const key of [
    "natures",
    "types",
    "forms",
    "abilities",
    "items",
    "moves",
    "mega_item_relations",
    "type_effectiveness",
  ] as const)
    if (!Array.isArray(row[key])) throw new Error(`Invalid calculator ${key}.`);
  const mechanics = object(row.mechanics);
  const capability = object(row.capability);
  if (
    !mechanics ||
    mechanics.level !== 50 ||
    mechanics.sp_minimum !== 0 ||
    mechanics.sp_maximum !== 32 ||
    !capability ||
    !Array.isArray(capability.status_values) ||
    !Number.isInteger(capability.stat_stage_minimum) ||
    !Number.isInteger(capability.stat_stage_maximum)
  )
    throw new Error("Invalid calculator mechanics.");
  exactKeys(
    mechanics,
    [
      "id",
      "level",
      "sp_minimum",
      "sp_maximum",
      "sp_total_max",
      "hp_formula",
      "other_formula",
      "nature_percentages",
    ],
    "calculator mechanics",
  );
  if (
    mechanics.id !== "champions-level-50-v1" ||
    mechanics.sp_total_max !== 66 ||
    mechanics.hp_formula !== "base + sp + 75" ||
    mechanics.other_formula !==
      "truncate((base + sp + 20) * nature_percent / 100)"
  )
    throw new Error("Unsupported calculator mechanics.");
  const percentages = object(mechanics.nature_percentages);
  if (
    !percentages ||
    percentages.hindering !== 90 ||
    percentages.neutral !== 100 ||
    percentages.increasing !== 110
  )
    throw new Error("Invalid nature percentages.");
  exactKeys(
    capability,
    [
      "id",
      "context_schema_version",
      "formula_reference",
      "game_type",
      "level",
      "stat_stage_minimum",
      "stat_stage_maximum",
      "status_values",
    ],
    "calculator capability",
  );
  const policy = object(row.state_input_policy);
  if (!policy) throw new Error("Invalid state input policy.");
  exactKeys(policy, ["StateMove", "StatePokemon"], "state input policy");
  for (const name of ["StateMove", "StatePokemon"]) {
    const entry = object(policy[name]);
    if (!entry) throw new Error("Invalid state input policy.");
    exactKeys(
      entry,
      ["source", "user", "deterministic_defaults", "unsupported"],
      `${name} policy`,
    );
    if (
      ![entry.source, entry.user, entry.unsupported].every(Array.isArray) ||
      !object(entry.deterministic_defaults)
    )
      throw new Error("Invalid state input policy.");
    const classified = [
      ...(entry.source as unknown[]),
      ...(entry.user as unknown[]),
      ...(entry.unsupported as unknown[]),
      ...Object.keys(entry.deterministic_defaults as object),
    ];
    if (
      classified.some((key) => !text(key)) ||
      new Set(classified).size !== classified.length
    )
      throw new Error("Invalid state input policy classification.");
  }
  for (const key of [
    "natures",
    "types",
    "forms",
    "abilities",
    "items",
    "moves",
  ] as const)
    unique(row[key] as unknown[], key);
  const result = value as CalculatorData;
  const ids = {
    form: new Set(result.forms.map(({ id }) => id)),
    ability: new Set(result.abilities.map(({ id }) => id)),
    item: new Set(result.items.map(({ id }) => id)),
    move: new Set(result.moves.map(({ id }) => id)),
    type: new Set(result.types.map(({ id }) => id)),
  };
  for (const nature of result.natures) {
    exactKeys(
      nature as unknown as Record<string, unknown>,
      ["id", "name", "increased_stat", "decreased_stat"],
      "nature",
    );
    if (
      !named(nature) ||
      (nature.increased_stat !== null && !statIds.has(nature.increased_stat)) ||
      (nature.decreased_stat !== null && !statIds.has(nature.decreased_stat))
    )
      throw new Error("Invalid nature.");
  }
  result.types.forEach((entry) => {
    exactKeys(
      entry as unknown as Record<string, unknown>,
      ["id", "name"],
      "type",
    );
    if (!named(entry)) throw new Error("Invalid type.");
  });
  for (const form of result.forms) {
    exactKeys(
      form as unknown as Record<string, unknown>,
      [
        "id",
        "name",
        "searchable",
        "is_mega",
        "is_nfe",
        "gender",
        "gender_options",
        "default_gender",
        "types",
        "base_stats",
        "weight_tenths_kg",
        "abilities",
        "move_ids",
        "sprite_form_id",
      ],
      "form",
    );
    if (
      !named(form) ||
      typeof form.searchable !== "boolean" ||
      typeof form.is_mega !== "boolean" ||
      typeof form.is_nfe !== "boolean" ||
      !text(form.gender) ||
      !Array.isArray(form.gender_options) ||
      !text(form.default_gender) ||
      !Array.isArray(form.types) ||
      !Array.isArray(form.abilities) ||
      !Array.isArray(form.move_ids) ||
      !text(form.sprite_form_id)
    )
      throw new Error("Invalid calculator form fields.");
    for (const ability of form.abilities) {
      const row = object(ability);
      if (!row) throw new Error("Invalid form ability.");
      exactKeys(row, ["id", "slot"], "form ability");
      if (!text(row.id) || !text(row.slot))
        throw new Error("Invalid form ability.");
    }
    if (
      (form.searchable && form.is_mega) ||
      form.types.length < 1 ||
      form.types.length > 2 ||
      form.types.some((id) => !ids.type.has(id)) ||
      form.abilities.some(({ id }) => !ids.ability.has(id)) ||
      form.move_ids.some((id) => !ids.move.has(id))
    )
      throw new Error("Calculator form references are invalid.");
    const expectedGenders =
      form.gender === "variable"
        ? ["M", "F"]
        : form.gender === "M"
          ? ["M"]
          : form.gender === "F"
            ? ["F"]
            : form.gender === "N"
              ? ["N"]
              : null;
    if (
      !expectedGenders ||
      form.gender_options.length !== expectedGenders.length ||
      form.gender_options.some(
        (value, index) => value !== expectedGenders[index],
      ) ||
      !form.gender_options.includes(form.default_gender)
    )
      throw new Error("Invalid form gender facts.");
    const baseStats = object(form.base_stats);
    if (
      !baseStats ||
      Object.keys(baseStats).length !== 6 ||
      [...statIds].some((id) => !Number.isInteger(baseStats[id])) ||
      !Number.isInteger(form.weight_tenths_kg)
    )
      throw new Error("Invalid form stats.");
    const slots = form.abilities.map(({ slot }) => slot);
    if (
      slots.some((slot) => !["0", "1", "H", "S"].includes(slot)) ||
      new Set(slots).size !== slots.length
    )
      throw new Error("Invalid ability slots.");
  }
  result.abilities.forEach((entry) => {
    exactKeys(
      entry as unknown as Record<string, unknown>,
      ["id", "name", "contextual_inputs"],
      "ability",
    );
    assertDescriptors(entry.contextual_inputs);
  });
  result.items.forEach((entry) => {
    exactKeys(
      entry as unknown as Record<string, unknown>,
      ["id", "name", "calculation", "contextual_inputs"],
      "item",
    );
    assertDescriptors(entry.contextual_inputs);
    const calculation = object(entry.calculation);
    if (!calculation) throw new Error("Invalid item calculation.");
    exactKeys(
      calculation,
      [
        "drive_type_id",
        "damage_boost",
        "damage_resist",
        "fling_base_power",
        "mega_stone",
        "memory_type_id",
        "natural_gift",
        "plate_type_id",
      ],
      "item calculation",
    );
    for (const key of ["drive_type_id", "memory_type_id", "plate_type_id"])
      if (calculation[key] !== null && !ids.type.has(String(calculation[key])))
        throw new Error("Invalid item calculation type reference.");
    for (const key of ["damage_boost", "damage_resist"]) {
      const effect = calculation[key];
      if (effect === null) continue;
      const row = object(effect);
      if (!row || !ids.type.has(String(row.type_id)))
        throw new Error("Invalid item damage calculation.");
      exactKeys(
        row,
        key === "damage_boost"
          ? ["type_id", "numerator", "denominator"]
          : ["type_id"],
        `item ${key}`,
      );
      if (
        key === "damage_boost" &&
        (!Number.isInteger(row.numerator) || !Number.isInteger(row.denominator))
      )
        throw new Error("Invalid item damage calculation.");
    }
    const gift = calculation.natural_gift;
    if (gift !== null) {
      const row = object(gift);
      if (!row) throw new Error("Invalid Natural Gift calculation.");
      exactKeys(row, ["base_power", "type_id"], "Natural Gift calculation");
      if (
        !Number.isInteger(row.base_power) ||
        !ids.type.has(String(row.type_id))
      )
        throw new Error("Invalid Natural Gift calculation.");
    }
    if (
      typeof calculation.mega_stone !== "boolean" ||
      !Number.isInteger(calculation.fling_base_power) ||
      Number(calculation.fling_base_power) < 0
    )
      throw new Error("Invalid item scalar calculation.");
  });
  const moveCalculationKeys = [
    "always_crit",
    "breaks_protect",
    "crash_damage",
    "crit_ratio",
    "drain",
    "ignore_defensive",
    "mind_blown_recoil",
    "multiaccuracy",
    "multihit",
    "override_defensive_stat",
    "recoil",
    "secondaries",
    "secondary",
    "self",
    "self_boost",
    "struggle_recoil",
  ];
  result.moves.forEach((entry) => {
    exactKeys(
      entry as unknown as Record<string, unknown>,
      [
        "id",
        "name",
        "description",
        "type_id",
        "category",
        "base_power",
        "accuracy",
        "pp",
        "priority",
        "target",
        "flags",
        "calculation",
        "contextual_inputs",
      ],
      "move",
    );
    if (
      !named(entry) ||
      !text(entry.description) ||
      !ids.type.has(entry.type_id) ||
      !["Physical", "Special", "Status"].includes(entry.category) ||
      !Number.isInteger(entry.base_power) ||
      entry.base_power < 0 ||
      (entry.accuracy !== null &&
        (!Number.isInteger(entry.accuracy) ||
          entry.accuracy < 0 ||
          entry.accuracy > 100)) ||
      !Number.isInteger(entry.pp) ||
      entry.pp < 1 ||
      !Number.isInteger(entry.priority) ||
      entry.priority < -7 ||
      entry.priority > 7 ||
      !text(entry.target) ||
      !Array.isArray(entry.flags) ||
      entry.flags.some((flag) => !text(flag)) ||
      new Set(entry.flags).size !== entry.flags.length
    )
      throw new Error("Invalid move facts.");
    assertDescriptors(entry.contextual_inputs);
    const calculation = object(entry.calculation);
    if (!calculation) throw new Error("Invalid move calculation.");
    exactKeys(calculation, moveCalculationKeys, "move calculation");
    for (const key of [
      "always_crit",
      "breaks_protect",
      "crash_damage",
      "ignore_defensive",
      "mind_blown_recoil",
      "multiaccuracy",
      "struggle_recoil",
    ])
      if (typeof calculation[key] !== "boolean")
        throw new Error("Invalid move calculation boolean.");
    if (
      !Number.isInteger(calculation.crit_ratio) ||
      Number(calculation.crit_ratio) < 0 ||
      ![null, "def", "spd"].includes(
        calculation.override_defensive_stat as null | string,
      )
    )
      throw new Error("Invalid move calculation scalar.");
    assertFraction(calculation.drain, "move drain");
    assertFraction(calculation.recoil, "move recoil");
    const multihit = calculation.multihit;
    if (
      multihit !== null &&
      !Number.isInteger(multihit) &&
      !(
        Array.isArray(multihit) &&
        multihit.length === 2 &&
        multihit.every(Number.isInteger)
      )
    )
      throw new Error("Invalid move multihit.");
    assertSecondary(calculation.secondary);
    assertSecondary(calculation.self);
    assertSecondary(calculation.self_boost);
    if (!Array.isArray(calculation.secondaries))
      throw new Error("Invalid move secondaries.");
    calculation.secondaries.forEach(assertSecondary);
  });
  for (const relation of result.mega_item_relations) {
    exactKeys(
      relation as unknown as Record<string, unknown>,
      ["item_id", "base_form_id", "mega_form_id", "locked_ability_id"],
      "Mega relation",
    );
    if (
      !ids.form.has(relation.base_form_id) ||
      !ids.form.has(relation.mega_form_id) ||
      !ids.item.has(relation.item_id) ||
      !ids.ability.has(relation.locked_ability_id)
    )
      throw new Error("Calculator Mega references are invalid.");
  }
  const matrix = new Set<string>();
  for (const entry of result.type_effectiveness) {
    exactKeys(
      entry as unknown as Record<string, unknown>,
      ["attacking_type_id", "defending_type_id", "multiplier_percent"],
      "type effectiveness",
    );
    if (
      !ids.type.has(entry.attacking_type_id) ||
      !ids.type.has(entry.defending_type_id) ||
      ![0, 25, 50, 100, 200, 400].includes(entry.multiplier_percent)
    )
      throw new Error("Invalid type effectiveness.");
    matrix.add(`${entry.attacking_type_id}:${entry.defending_type_id}`);
  }
  if (matrix.size !== result.types.length ** 2)
    throw new Error("Incomplete type effectiveness matrix.");
  if (result.type_effectiveness.length !== matrix.size)
    throw new Error("Duplicate type effectiveness entries.");
  return result;
}
