import type { Named } from "../damage-calculator/contracts";

export type BattleTeamSummary = {
  id: string;
  name: string;
  pinned_version: string;
  regulation: Named;
  members: { position: number; sprite_url: string }[];
  updated_at: string;
};

export type BattleBootstrap = {
  schema_version: "battle-mode-bootstrap-v1";
  active_version: string;
  regulation: Named;
  teams: BattleTeamSummary[];
  dataset_url: string;
  team_url_template: string;
  team_builder_url: string;
  base_species_by_form: Record<string, string>;
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const localUrl = (value: unknown): value is string =>
  text(value) && value.startsWith("/") && !value.startsWith("//");
const named = (value: unknown): value is Named => {
  const row = record(value);
  return Boolean(row && text(row.id) && text(row.name));
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
    throw new Error(`The Battle Mode ${label} is invalid.`);
};

export function parseBattleBootstrap(value: unknown): BattleBootstrap {
  const row = record(value);
  if (
    !row ||
    row.schema_version !== "battle-mode-bootstrap-v1" ||
    !text(row.active_version) ||
    !named(row.regulation) ||
    !Array.isArray(row.teams) ||
    !localUrl(row.dataset_url) ||
    !localUrl(row.team_url_template) ||
    !String(row.team_url_template).includes("__TEAM__") ||
    !localUrl(row.team_builder_url)
  )
    throw new Error("The Battle Mode configuration is invalid.");
  exactKeys(
    row,
    [
      "schema_version",
      "active_version",
      "regulation",
      "teams",
      "dataset_url",
      "team_url_template",
      "team_builder_url",
      "base_species_by_form",
    ],
    "configuration",
  );
  const species = record(row.base_species_by_form);
  if (
    !species ||
    Object.keys(species).some((id) => !text(id) || !text(species[id]))
  )
    throw new Error("The Battle Mode species mapping is invalid.");
  const seenTeams = new Set<string>();
  for (const candidate of row.teams) {
    const team = record(candidate);
    if (
      !team ||
      !text(team.id) ||
      seenTeams.has(team.id) ||
      !text(team.name) ||
      !text(team.pinned_version) ||
      !named(team.regulation) ||
      !Array.isArray(team.members) ||
      team.members.length > 6 ||
      !text(team.updated_at)
    )
      throw new Error("The Battle Mode team list is invalid.");
    exactKeys(
      team,
      ["id", "name", "pinned_version", "regulation", "members", "updated_at"],
      "team list",
    );
    seenTeams.add(team.id);
    const positions = new Set<number>();
    for (const candidateMember of team.members) {
      const member = record(candidateMember);
      const position = Number(member?.position);
      if (
        !member ||
        !Number.isInteger(position) ||
        position < 0 ||
        position > 5 ||
        positions.has(position) ||
        !localUrl(member.sprite_url)
      )
        throw new Error("The Battle Mode team preview is invalid.");
      exactKeys(member, ["position", "sprite_url"], "team preview");
      positions.add(position);
    }
    if (
      team.pinned_version !== row.active_version ||
      (team.regulation as Named).id !== (row.regulation as Named).id
    )
      throw new Error("The Battle Mode team list is stale.");
  }
  const mappingIds = Object.keys(species);
  if (new Set(mappingIds).size !== mappingIds.length)
    throw new Error("The Battle Mode species mapping is invalid.");
  return value as BattleBootstrap;
}
