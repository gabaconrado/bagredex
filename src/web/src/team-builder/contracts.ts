export type Named = { id: string; name: string };
export type StatId = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type Stats = Record<StatId, number>;

export type TeamSummary = {
  id: string;
  name: string;
  data_version: string;
  regulation: Named;
  member_count: number;
  updated_at: string;
};

export type Bootstrap = {
  schema_version: "team-builder-bootstrap-v1";
  active_version: string;
  regulation: Named;
  data_url: string;
  create_url: string;
  team_url_template: string;
  teams: TeamSummary[];
};

export type BuilderForm = Named & {
  base_species_id: string;
  types: Named[];
  ability_ids: string[];
  move_ids: string[];
  base_stats: Stats;
  sprites: { normal: string; shiny: string };
};
export type Nature = Named & {
  increased_stat: StatId | null;
  decreased_stat: StatId | null;
};
export type MegaRelation = {
  form_id: string;
  item_id: string;
  target: BuilderForm & { ability: Named };
};
export type BuilderData = {
  schema_version: "team-builder-data-v1";
  data_version: string;
  regulation: Named;
  forms: BuilderForm[];
  types: Named[];
  abilities: Named[];
  moves: Named[];
  items: Named[];
  natures: Nature[];
  mega_relations: MegaRelation[];
  mechanics: {
    level: 50;
    iv: 31;
    sp_min: 0;
    sp_max: 32;
    sp_total_max: 66;
    formula: string;
  };
};
export type Member = {
  position: number;
  form_id: string;
  nickname: string;
  ability_id: string | null;
  item_id: string | null;
  move_ids: (string | null)[];
  nature_id: string | null;
  sp: Stats;
  shiny: boolean;
  mega_preview: boolean;
};
export type Team = {
  id: string | null;
  name: string;
  data_version: string;
  regulation: Named;
  members: Member[];
  updated_at?: string;
};
export type TeamEnvelope = {
  schema_version: "team-builder-response-v1";
  team: Team;
  summary: TeamSummary;
};
export type ApiProblem = {
  schema_version: "team-builder-error-v1";
  code: string;
  message: string;
  fields: Record<string, string[]>;
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const localUrl = (value: unknown): value is string =>
  text(value) && value.startsWith("/") && !value.startsWith("//");
const statIds: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const assertNamed = (value: unknown) => {
  const item = record(value);
  if (!item || !text(item.id) || !text(item.name))
    throw new Error("Invalid named value.");
};
const assertStats = (value: unknown) => {
  const stats = record(value);
  if (
    !stats ||
    statIds.some((id) => !Number.isInteger(stats[id]) || Number(stats[id]) < 0)
  )
    throw new Error("Invalid stats.");
};
const assertNamedArray = (value: unknown) => {
  if (!Array.isArray(value)) throw new Error("Invalid choice list.");
  value.forEach(assertNamed);
};
const assertSummary = (value: unknown) => {
  const item = record(value);
  if (
    !item ||
    !text(item.id) ||
    !text(item.name) ||
    !text(item.data_version) ||
    !Number.isInteger(item.member_count) ||
    Number(item.member_count) < 0 ||
    Number(item.member_count) > 6 ||
    !text(item.updated_at)
  )
    throw new Error("Invalid team summary.");
  assertNamed(item.regulation);
};

export function parseBootstrap(value: unknown): Bootstrap {
  const item = record(value);
  if (
    !item ||
    item.schema_version !== "team-builder-bootstrap-v1" ||
    !text(item.active_version) ||
    !localUrl(item.dataset_url) ||
    !localUrl(item.create_url) ||
    !localUrl(item.team_url_template) ||
    !String(item.team_url_template).includes("__TEAM__") ||
    !Array.isArray(item.teams)
  )
    throw new Error("The team builder configuration is invalid.");
  assertNamed(item.regulation);
  item.teams.forEach((summary) => {
    const row = record(summary);
    if (row && text(row.pinned_version) && !row.data_version)
      row.data_version = row.pinned_version;
    assertSummary(summary);
  });
  return { ...(value as Bootstrap), data_url: item.dataset_url as string };
}

function assertForm(value: unknown) {
  const item = record(value);
  if (
    !item ||
    !text(item.id) ||
    !text(item.name) ||
    !text(item.base_species_id) ||
    !Array.isArray(item.types) ||
    !Array.isArray(item.ability_ids) ||
    !Array.isArray(item.move_ids)
  )
    throw new Error("Invalid Pokémon form.");
  assertNamedArray(item.types);
  if ([...item.ability_ids, ...item.move_ids].some((id) => !text(id)))
    throw new Error("Invalid form choices.");
  assertStats(item.base_stats);
  const sprites = record(item.sprites);
  if (!sprites || !localUrl(sprites.normal) || !localUrl(sprites.shiny))
    throw new Error("Invalid sprite URLs.");
}

export function parseBuilderData(value: unknown): BuilderData {
  const item = record(value);
  if (
    !item ||
    item.schema_version !== "team-builder-data-v1" ||
    !text(item.data_version) ||
    !Array.isArray(item.forms) ||
    !Array.isArray(item.abilities) ||
    !Array.isArray(item.moves) ||
    !Array.isArray(item.items) ||
    !Array.isArray(item.natures) ||
    !Array.isArray(item.mega_relations)
  )
    throw new Error("The team builder data uses an unsupported format.");
  assertNamed(item.regulation);
  const spriteTemplate = item.sprite_url_template;
  if (
    !localUrl(spriteTemplate) ||
    !String(spriteTemplate).includes("__FORM__") ||
    !String(spriteTemplate).includes("__VARIANT__")
  )
    throw new Error("Invalid sprite template.");
  const convertStats = (value: unknown): Stats => {
    const source = record(value);
    if (!source) throw new Error("Invalid stats.");
    return {
      hp: Number(source.hp),
      atk: Number(source.attack),
      def: Number(source.defense),
      spa: Number(source.special_attack),
      spd: Number(source.special_defense),
      spe: Number(source.speed),
    };
  };
  const sprite = (form: string, variant: "normal" | "shiny") =>
    String(spriteTemplate)
      .replace("__FORM__", encodeURIComponent(form))
      .replace("__VARIANT__", variant);
  const types = item.types as Named[];
  const forms = (item.forms as Record<string, unknown>[]).map((form) => ({
    id: String(form.id),
    name: String(form.name),
    base_species_id: String(form.base_species),
    types: types.filter((type) =>
      (form.type_ids as string[]).includes(type.id),
    ),
    ability_ids: form.ability_ids as string[],
    move_ids: form.move_ids as string[],
    base_stats: convertStats(form.base_stats),
    sprites: {
      normal: sprite(String(form.sprite_form), "normal"),
      shiny: sprite(String(form.sprite_form), "shiny"),
    },
  }));
  forms.forEach(assertForm);
  assertNamedArray(item.abilities);
  assertNamedArray(item.moves);
  assertNamedArray(item.items);
  item.natures.forEach((value) => {
    assertNamed(value);
    const nature = record(value)!;
    if (
      ![null, ...statIds].includes(nature.increased_stat as null | StatId) ||
      ![null, ...statIds].includes(nature.decreased_stat as null | StatId)
    )
      throw new Error("Invalid nature.");
  });
  item.mega_relations.forEach((value) => {
    const relation = record(value);
    if (
      !relation ||
      !text(relation.base_form) ||
      !text(relation.item) ||
      !record(relation.target)
    )
      throw new Error("Invalid Mega mapping.");
  });
  const mechanics = record(item.mechanics);
  const naturePercentages = record(mechanics?.nature_percentages);
  if (
    !mechanics ||
    mechanics.level !== 50 ||
    mechanics.sp_minimum !== 0 ||
    mechanics.sp_maximum !== 32 ||
    mechanics.sp_total_max !== 66 ||
    mechanics.hp_formula !== "base + sp + 75" ||
    mechanics.other_formula !==
      "truncate((base + sp + 20) * nature_percent / 100)" ||
    !naturePercentages ||
    naturePercentages.hindering !== 90 ||
    naturePercentages.neutral !== 100 ||
    naturePercentages.increasing !== 110
  )
    throw new Error("Invalid Champions mechanics.");
  const mega = (item.mega_relations as Record<string, unknown>[]).map(
    (relation) => {
      const target = record(relation.target)!;
      const abilityIds = target.ability_ids as string[];
      const ability = (item.abilities as Named[]).find(
        (choice) => choice.id === abilityIds[0],
      );
      if (!ability) throw new Error("Invalid Mega ability.");
      return {
        form_id: String(relation.base_form),
        item_id: String(relation.item),
        target: {
          id: String(target.id),
          name: String(target.name),
          base_species_id: String(relation.base_form),
          types:
            forms.find((form) => form.id === relation.base_form)?.types ?? [],
          ability_ids: abilityIds,
          move_ids: [],
          base_stats: convertStats(target.base_stats),
          sprites: {
            normal: sprite(String(target.sprite_form), "normal"),
            shiny: sprite(String(target.sprite_form), "shiny"),
          },
          ability,
        },
      };
    },
  );
  return {
    schema_version: "team-builder-data-v1",
    data_version: String(item.data_version),
    regulation: item.regulation as Named,
    forms,
    types,
    abilities: item.abilities as Named[],
    moves: item.moves as Named[],
    items: item.items as Named[],
    natures: item.natures as Nature[],
    mega_relations: mega,
    mechanics: {
      level: 50,
      iv: 31,
      sp_min: 0,
      sp_max: 32,
      sp_total_max: 66,
      formula: `${mechanics.hp_formula};${mechanics.other_formula}`,
    },
  };
}

function assertMember(value: unknown) {
  const member = record(value);
  if (
    !member ||
    !Number.isInteger(member.position) ||
    Number(member.position) < 0 ||
    Number(member.position) > 5 ||
    !text(member.form_id) ||
    typeof member.nickname !== "string" ||
    member.nickname.length > 12 ||
    !Array.isArray(member.move_ids) ||
    member.move_ids.length !== 4 ||
    member.move_ids.some((id) => id !== null && !text(id)) ||
    (member.nature_id !== null && !text(member.nature_id)) ||
    typeof member.shiny !== "boolean" ||
    typeof member.mega_preview !== "boolean"
  )
    throw new Error("Invalid team member.");
  if (member.ability_id !== null && !text(member.ability_id))
    throw new Error("Invalid ability.");
  if (member.item_id !== null && !text(member.item_id))
    throw new Error("Invalid item.");
  assertStats(member.sp);
}

export function parseTeam(value: unknown): Team {
  const envelope = record(value);
  const raw =
    envelope?.schema_version === "team-api-v1" ? envelope.data : value;
  const team = record(raw);
  const pinned = record(team?.pinned);
  if (
    !team ||
    !text(team.id) ||
    !text(team.name) ||
    !text(team.updated_at) ||
    !pinned ||
    !text(pinned.version) ||
    !Array.isArray(team.members) ||
    team.members.length > 6
  )
    throw new Error("The team response is invalid.");
  assertNamed(pinned.regulation);
  const stats = (source: unknown): Stats => {
    const item = record(source);
    if (!item) throw new Error("Invalid SP.");
    return {
      hp: Number(item.hp),
      atk: Number(item.attack),
      def: Number(item.defense),
      spa: Number(item.special_attack),
      spd: Number(item.special_defense),
      spe: Number(item.speed),
    };
  };
  const members = [...(team.members as Record<string, unknown>[])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((member) => ({
      position: Number(member.position),
      form_id: String(member.pokemon),
      nickname: String(member.nickname ?? ""),
      ability_id: member.ability === null ? null : String(member.ability),
      item_id: member.item === null ? null : String(member.item),
      move_ids: member.moves as (string | null)[],
      nature_id: String(member.nature),
      sp: stats(member.sp),
      shiny: Boolean(member.shiny),
      mega_preview: Boolean(member.mega_preview),
    }));
  const converted: Team = {
    id: String(team.id),
    name: String(team.name),
    data_version: String(pinned.version),
    regulation: pinned.regulation as Named,
    members,
    updated_at: team.updated_at as string,
  };
  converted.members.forEach(assertMember);
  return converted;
}

export function parseProblem(value: unknown): ApiProblem | null {
  const item = record(value);
  const error = record(item?.error);
  if (
    !item ||
    item.schema_version !== "team-api-v1" ||
    !error ||
    !text(error.code) ||
    !text(error.message) ||
    !record(error.fields)
  )
    return null;
  for (const messages of Object.values(error.fields as Record<string, unknown>))
    if (!Array.isArray(messages) || messages.some((message) => !text(message)))
      return null;
  return {
    schema_version: "team-builder-error-v1",
    code: String(error.code),
    message: String(error.message),
    fields: error.fields as Record<string, string[]>,
  };
}

export function serializeDraft(team: Team) {
  const sp = (stats: Stats) => ({
    hp: stats.hp,
    attack: stats.atk,
    defense: stats.def,
    special_attack: stats.spa,
    special_defense: stats.spd,
    speed: stats.spe,
  });
  return {
    schema_version: "team-draft-v1",
    ...(team.id
      ? {}
      : { version: team.data_version, regulation: team.regulation.id }),
    name: team.name,
    members: [...team.members]
      .sort((a, b) => a.position - b.position)
      .map((member) => ({
        position: member.position,
        pokemon: member.form_id,
        nickname: member.nickname,
        ability: member.ability_id,
        item: member.item_id,
        moves: member.move_ids,
        nature: member.nature_id,
        sp: sp(member.sp),
        shiny: member.shiny,
        mega_preview: member.mega_preview,
      })),
  };
}
