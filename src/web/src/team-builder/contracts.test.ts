import { describe, expect, it } from "vitest";
import {
  parseBootstrap,
  parseBuilderData,
  parseTeam,
  serializeDraft,
} from "./contracts";

const named = { id: "m-c", name: "Regulation M-C" };
const stats = {
  hp: 78,
  attack: 84,
  defense: 78,
  special_attack: 109,
  special_defense: 85,
  speed: 100,
};

describe("team builder contracts", () => {
  it("strictly parses and adapts the bootstrap", () => {
    const parsed = parseBootstrap({
      schema_version: "team-builder-bootstrap-v1",
      active_version: "version-3",
      regulation: named,
      teams: [
        {
          id: "team-id",
          name: "Rain",
          pinned_version: "version-3",
          regulation: named,
          member_count: 1,
          updated_at: "2026-10-17T00:00:00Z",
        },
      ],
      create_url: "/teams/",
      dataset_url: "/teams/data/version-3/m-c/",
      team_url_template: "/teams/__TEAM__/",
    });
    expect(parsed.data_url).toContain("/data/");
    expect(parsed.teams[0]?.data_version).toBe("version-3");
    expect(() => parseBootstrap({ schema_version: "bad" })).toThrow();
  });

  it("parses the exact dataset and builds same-origin sprites", () => {
    const parsed = parseBuilderData({
      schema_version: "team-builder-data-v1",
      data_version: "version-3",
      regulation: named,
      forms: [
        {
          id: "charizard",
          name: "Charizard",
          base_species: "charizard",
          national_dex_number: 6,
          type_ids: ["fire"],
          ability_ids: ["blaze"],
          move_ids: ["protect"],
          base_stats: stats,
          sprite_form: "charizard",
        },
      ],
      types: [{ id: "fire", name: "Fire" }],
      abilities: [
        { id: "blaze", name: "Blaze" },
        { id: "toughclaws", name: "Tough Claws" },
      ],
      moves: [{ id: "protect", name: "Protect" }],
      items: [{ id: "charizarditex", name: "Charizardite X" }],
      natures: [
        {
          id: "serious",
          name: "Serious",
          increased_stat: null,
          decreased_stat: null,
        },
      ],
      mechanics: {
        level: 50,
        sp_minimum: 0,
        sp_maximum: 32,
        sp_total_max: 66,
        hp_formula: "base + sp + 75",
        other_formula: "truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages: { hindering: 90, neutral: 100, increasing: 110 },
      },
      mega_relations: [
        {
          base_form: "charizard",
          item: "charizarditex",
          target: {
            id: "charizardmegax",
            name: "Charizard-Mega-X",
            sprite_form: "charizardmegax",
            ability_ids: ["toughclaws"],
            base_stats: stats,
          },
        },
      ],
      sprite_url_template:
        "/pokedex/sprites/version-3/__FORM__/__VARIANT__.webp",
    });
    expect(parsed.forms[0]?.base_stats.spa).toBe(109);
    expect(parsed.mega_relations[0]?.target.ability.name).toBe("Tough Claws");
    expect(parsed.forms[0]?.sprites.shiny).toContain("/shiny.webp");
  });

  it("adapts aggregates and serializes complete draft replacement", () => {
    const parsed = parseTeam({
      schema_version: "team-api-v1",
      data: {
        id: "team-id",
        name: "Sun",
        updated_at: "2026-10-17T00:00:00Z",
        pinned: { version: "version-3", regulation: named },
        members: [
          {
            position: 0,
            pokemon: "charizard",
            nickname: "Sunny",
            ability: null,
            item: null,
            moves: [null, null, null, null],
            nature: "serious",
            sp: {
              hp: 0,
              attack: 0,
              defense: 0,
              special_attack: 0,
              special_defense: 0,
              speed: 0,
            },
            shiny: false,
            mega_preview: false,
          },
        ],
      },
    });
    expect(parsed.members[0]?.move_ids).toEqual([null, null, null, null]);
    expect(serializeDraft(parsed)).toMatchObject({
      schema_version: "team-draft-v1",
      members: [{ pokemon: "charizard", moves: [null, null, null, null] }],
    });
  });
});
