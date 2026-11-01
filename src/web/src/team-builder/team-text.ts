import type { BuilderData, Member, Named, StatId } from "./contracts";
import { newMember, spTotal, statIds, validateLocal } from "./model";

const MAX_TEAM_TEXT_LENGTH = 32_000;
const statNames: Record<StatId, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};
const statByName = new Map(
  Object.entries(statNames).map(([id, name]) => [
    name.toLowerCase(),
    id as StatId,
  ]),
);

export type TeamTextImportResult =
  | { ok: true; members: Member[] }
  | { ok: false; errors: string[] };

type SpeciesChoice = {
  formId: string;
  itemId: string | null;
};

type Lookup<T> = Map<string, T[]>;

export const normalizeTeamTextName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function addLookup<T>(
  lookup: Lookup<T>,
  name: string,
  value: T,
  same: (a: T, b: T) => boolean,
) {
  const key = normalizeTeamTextName(name);
  if (!key) return;
  const values = lookup.get(key) ?? [];
  if (!values.some((candidate) => same(candidate, value))) values.push(value);
  lookup.set(key, values);
}

function namedLookup(values: Named[]): Lookup<Named> {
  const lookup: Lookup<Named> = new Map();
  values.forEach((value) =>
    addLookup(lookup, value.name, value, (left, right) => left.id === right.id),
  );
  return lookup;
}

function resolve<T>(
  lookup: Lookup<T>,
  value: string,
  label: string,
  location: string,
  errors: string[],
): T | null {
  const choices = lookup.get(normalizeTeamTextName(value)) ?? [];
  if (choices.length === 1) return choices[0]!;
  errors.push(
    choices.length > 1
      ? `${location}: ${label} “${value}” is ambiguous.`
      : `${location}: ${label} “${value}” is unknown.`,
  );
  return null;
}

function seriousNature(data: BuilderData) {
  return (
    data.natures.find((nature) => nature.id === "serious") ??
    data.natures.find(
      (nature) =>
        nature.increased_stat === null && nature.decreased_stat === null,
    )
  );
}

function firstLocalError(errors: Record<string, string>): string | null {
  return Object.values(errors)[0] ?? null;
}

export function importTeamText(
  text: string,
  data: BuilderData,
): TeamTextImportResult {
  if (text.length > MAX_TEAM_TEXT_LENGTH)
    return {
      ok: false,
      errors: [
        `Team text must be ${MAX_TEAM_TEXT_LENGTH.toLocaleString()} characters or fewer.`,
      ],
    };
  if (!text.trim()) return { ok: true, members: [] };

  const errors: string[] = [];
  const species: Lookup<SpeciesChoice> = new Map();
  const sameSpecies = (left: SpeciesChoice, right: SpeciesChoice) =>
    left.formId === right.formId && left.itemId === right.itemId;
  data.forms.forEach((form) =>
    addLookup(
      species,
      form.name,
      { formId: form.id, itemId: null },
      sameSpecies,
    ),
  );
  data.pokemon_search_entries.forEach((entry) =>
    addLookup(
      species,
      entry.name,
      { formId: entry.form_id, itemId: null },
      sameSpecies,
    ),
  );
  data.mega_search_entries.forEach((entry) =>
    addLookup(
      species,
      entry.name,
      { formId: entry.base_form_id, itemId: entry.item_id },
      sameSpecies,
    ),
  );
  const abilities = namedLookup(data.abilities);
  const items = namedLookup(data.items);
  const moves = namedLookup(data.moves);
  const natures = namedLookup(data.natures);
  const serious = seriousNature(data);
  if (!serious)
    return {
      ok: false,
      errors: ["The retained dataset has no neutral default nature."],
    };

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const groups: { line: number; lines: { line: number; text: string }[] }[] =
    [];
  let current: {
    line: number;
    lines: { line: number; text: string }[];
  } | null = null;
  lines.forEach((raw, index) => {
    const value = raw.trim();
    if (!value) {
      if (current) groups.push(current);
      current = null;
      return;
    }
    current ??= { line: index + 1, lines: [] };
    current.lines.push({ line: index + 1, text: value });
  });
  if (current) groups.push(current);
  if (groups.length > 6)
    errors.push(
      `Team: found ${groups.length} sets; a team can contain at most 6.`,
    );

  const members: Member[] = [];
  for (const [setIndex, group] of groups.slice(0, 6).entries()) {
    const header = group.lines[0]!;
    const location = `Set ${setIndex + 1}, line ${header.line}`;
    const atParts = header.text.split("@");
    if (atParts.length > 2 || !atParts[0]!.trim()) {
      errors.push(
        `${location}: use “Species @ Item” or “Nickname (Species) @ Item”.`,
      );
      continue;
    }
    let identity = atParts[0]!
      .trim()
      .replace(/\s+\((?:M|F)\)$/i, "")
      .trim();
    const itemText = atParts[1]?.trim() ?? "";
    let choice =
      (species.get(normalizeTeamTextName(identity)) ?? []).length === 1
        ? resolve(species, identity, "Pokémon", location, errors)
        : null;
    let nickname = "";
    if (!choice) {
      const nicknameMatch = identity.match(/^(.*?)\s+\((.+)\)$/);
      if (!nicknameMatch) {
        if ((species.get(normalizeTeamTextName(identity)) ?? []).length !== 1)
          resolve(species, identity, "Pokémon", location, errors);
        continue;
      }
      nickname = nicknameMatch[1]!.trim();
      identity = nicknameMatch[2]!.trim();
      choice = resolve(species, identity, "Pokémon", location, errors);
      if (!choice) continue;
    }
    if (nickname.length > 10) {
      errors.push(`${location}: nickname must use 10 characters or fewer.`);
      continue;
    }

    const member = newMember(choice.formId, serious.id, setIndex);
    member.nickname = nickname;
    let item = itemText
      ? resolve(items, itemText, "item", location, errors)
      : null;
    if (choice.itemId) {
      if (item && item.id !== choice.itemId)
        errors.push(
          `${location}: ${identity} requires its matching Mega Stone.`,
        );
      item = data.items.find(({ id }) => id === choice!.itemId) ?? null;
    }
    member.item_id = item?.id ?? null;
    const seen = new Set<string>();
    const parsedMoves: string[] = [];

    for (const detail of group.lines.slice(1)) {
      const detailLocation = `Set ${setIndex + 1}, line ${detail.line}`;
      const unsupported = detail.text.match(
        /^(Level|EVs|IVs|Tera\s+Type)\s*:/i,
      );
      if (unsupported) {
        errors.push(
          `${detailLocation}: ${unsupported[1]} is not supported; use SPs only.`,
        );
        continue;
      }
      const abilityMatch = detail.text.match(/^(Ability|Trait)\s*:\s*(.+)$/i);
      if (abilityMatch) {
        if (seen.has("ability"))
          errors.push(`${detailLocation}: ability appears more than once.`);
        else {
          seen.add("ability");
          member.ability_id =
            resolve(
              abilities,
              abilityMatch[2]!,
              "ability",
              detailLocation,
              errors,
            )?.id ?? null;
        }
        continue;
      }
      const shinyMatch = detail.text.match(/^Shiny\s*:\s*(.+)$/i);
      if (shinyMatch) {
        if (seen.has("shiny"))
          errors.push(`${detailLocation}: Shiny appears more than once.`);
        else if (!/^(?:yes|no)$/i.test(shinyMatch[1]!.trim()))
          errors.push(`${detailLocation}: Shiny must be Yes or No.`);
        else {
          seen.add("shiny");
          member.shiny = /^yes$/i.test(shinyMatch[1]!.trim());
        }
        continue;
      }
      const spMatch = detail.text.match(/^SPs\s*:\s*(.+)$/i);
      if (spMatch) {
        if (seen.has("sp")) {
          errors.push(`${detailLocation}: SPs appears more than once.`);
          continue;
        }
        seen.add("sp");
        const usedStats = new Set<StatId>();
        for (const allocation of spMatch[1]!.split("/")) {
          const match = allocation
            .trim()
            .match(/^(-?\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
          if (!match) {
            errors.push(
              `${detailLocation}: invalid SP allocation “${allocation.trim()}”.`,
            );
            continue;
          }
          const stat = statByName.get(match[2]!.toLowerCase())!;
          const value = Number(match[1]);
          if (usedStats.has(stat))
            errors.push(
              `${detailLocation}: ${statNames[stat]} SP appears more than once.`,
            );
          else if (
            !Number.isInteger(value) ||
            value < data.mechanics.sp_min ||
            value > data.mechanics.sp_max
          )
            errors.push(
              `${detailLocation}: ${statNames[stat]} SP must be from ${data.mechanics.sp_min} to ${data.mechanics.sp_max}.`,
            );
          else {
            usedStats.add(stat);
            member.sp[stat] = value;
          }
        }
        if (spTotal(member.sp) > data.mechanics.sp_total_max)
          errors.push(
            `${detailLocation}: SP total must not exceed ${data.mechanics.sp_total_max}.`,
          );
        continue;
      }
      const natureMatch = detail.text.match(/^(.+?)\s+Nature$/i);
      if (natureMatch) {
        if (seen.has("nature"))
          errors.push(`${detailLocation}: nature appears more than once.`);
        else {
          seen.add("nature");
          member.nature_id =
            resolve(natures, natureMatch[1]!, "nature", detailLocation, errors)
              ?.id ?? null;
        }
        continue;
      }
      const moveMatch = detail.text.match(/^-\s*(.+)$/);
      if (moveMatch) {
        if (parsedMoves.length >= 4) {
          errors.push(`${detailLocation}: a set can contain at most 4 moves.`);
          continue;
        }
        const move = resolve(
          moves,
          moveMatch[1]!,
          "move",
          detailLocation,
          errors,
        );
        if (move) parsedMoves.push(move.id!);
        continue;
      }
      errors.push(
        `${detailLocation}: unsupported or malformed line “${detail.text}”.`,
      );
    }
    member.move_ids = [
      ...parsedMoves,
      ...Array(4 - parsedMoves.length).fill(null),
    ];
    member.mega_preview = data.mega_relations.some(
      ({ form_id, item_id }) =>
        form_id === member.form_id && item_id === member.item_id,
    );
    members.push(member);
  }

  const baseSpecies = new Set<string>();
  members.forEach((member, index) => {
    const form = data.forms.find(({ id }) => id === member.form_id);
    if (form && baseSpecies.has(form.base_species_id))
      errors.push(
        `Set ${index + 1}: another set already uses ${form.name}'s species.`,
      );
    if (form) baseSpecies.add(form.base_species_id);
    const local = firstLocalError(validateLocal(member, data, members, index));
    if (local) errors.push(`Set ${index + 1}: ${local}`);
  });
  return errors.length ? { ok: false, errors } : { ok: true, members };
}

export function exportTeamText(members: Member[], data: BuilderData): string {
  return [...members]
    .sort((left, right) => left.position - right.position)
    .map((member) => {
      const form = data.forms.find(({ id }) => id === member.form_id);
      if (!form) return "";
      const item = data.items.find(({ id }) => id === member.item_id);
      const ability = data.abilities.find(({ id }) => id === member.ability_id);
      const nature = data.natures.find(({ id }) => id === member.nature_id);
      const identity = member.nickname
        ? `${member.nickname} (${form.name})`
        : form.name;
      const lines = [`${identity}${item ? ` @ ${item.name}` : ""}`];
      if (ability) lines.push(`Ability: ${ability.name}`);
      if (member.shiny) lines.push("Shiny: Yes");
      const allocations = statIds
        .filter((id) => member.sp[id] > 0)
        .map((id) => `${member.sp[id]} ${statNames[id]}`);
      if (allocations.length) lines.push(`SPs: ${allocations.join(" / ")}`);
      if (nature) lines.push(`${nature.name} Nature`);
      member.move_ids.forEach((id) => {
        const move = data.moves.find((choice) => choice.id === id);
        if (move) lines.push(`- ${move.name}`);
      });
      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
