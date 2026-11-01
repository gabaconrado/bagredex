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
const copy = <T>(value: T): T => structuredClone(value);

describe("team builder contracts", () => {
  it("strictly parses and adapts the bootstrap", () => {
    const parsed = parseBootstrap({
      schema_version: "team-builder-bootstrap-v2",
      active_version: "version-3",
      next_team_number: 4,
      regulation: named,
      teams: [
        {
          id: "team-id",
          name: "Rain",
          pinned_version: "version-3",
          regulation: named,
          members: [
            {
              position: 0,
              sprite_url: "/pokedex/sprites/version-3/charizard/shiny.webp",
            },
          ],
          updated_at: "2026-10-17T00:00:00Z",
        },
      ],
      create_url: "/teams/",
      dataset_url: "/teams/data/version-3/m-c/",
      team_url_template: "/teams/__TEAM__/",
    });
    expect(parsed.data_url).toContain("/data/");
    expect(parsed.teams[0]?.data_version).toBe("version-3");
    expect(parsed.next_team_number).toBe(4);
    expect(() => parseBootstrap({ schema_version: "bad" })).toThrow();
    expect(() =>
      parseBootstrap({
        ...parsed,
        teams: [
          {
            ...parsed.teams[0],
            members: [
              { position: 0, sprite_url: "/normal.webp" },
              { position: 0, sprite_url: "/shiny.webp" },
            ],
          },
        ],
      }),
    ).toThrow("Invalid team summary member");
  });

  it("parses the exact dataset and builds same-origin sprites", () => {
    const dataset = {
      schema_version: "team-builder-data-v6",
      data_version: "version-3",
      regulation: named,
      forms: [
        {
          id: "charizard",
          name: "Charizard",
          base_species: "charizard",
          is_nfe: false,
          national_dex_number: 6,
          type_ids: ["fire"],
          ability_ids: ["blaze"],
          move_ids: ["protect"],
          base_stats: stats,
          sprite_form: "charizard",
        },
      ],
      pokemon_search_entries: [
        { form_id: "charizard", name: "Charizard", form_group: null },
      ],
      types: [{ id: "fire", name: "Fire" }],
      abilities: [
        {
          id: "blaze",
          name: "Blaze",
          short_description: "Boosts Fire moves.",
          description: "Boosts Fire-type moves when HP is low.",
          suppresses_held_item: false,
        },
        {
          id: "toughclaws",
          name: "Tough Claws",
          short_description: "Boosts contact moves.",
          description: "Boosts the power of contact moves.",
          suppresses_held_item: false,
        },
      ],
      moves: [
        {
          id: "protect",
          name: "Protect",
          type: { id: "normal", name: "Normal" },
          category: "Status",
          base_power: 0,
          accuracy: null,
          always_hits: true,
          pp: 10,
          priority: 4,
          target: "self",
          short_description: "Protects the user.",
          description: "Protects the user from most attacks.",
          flags: [],
        },
      ],
      items: [
        {
          id: "charizarditex",
          name: "Charizardite X",
          short_description: "Makes Charizard Mega Evolve.",
          description: "Makes Charizard Mega Evolve into Mega Charizard X.",
          stat_modifiers: [
            {
              stat: "spe",
              numerator: 6144,
              denominator: 4096,
              eligibility: "always",
            },
          ],
        },
      ],
      natures: [
        {
          id: "serious",
          name: "Serious",
          increased_stat: null,
          decreased_stat: null,
        },
        {
          id: "jolly",
          name: "Jolly",
          increased_stat: "spe",
          decreased_stat: "spa",
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
            is_nfe: false,
            sprite_form: "charizardmegax",
            ability_ids: ["toughclaws"],
            base_stats: stats,
          },
        },
      ],
      mega_search_entries: [
        {
          id: "charizardmegax",
          name: "Charizard-Mega-X",
          base_form_id: "charizard",
          item_id: "charizarditex",
          is_nfe: false,
          sprite_form: "charizardmegax",
          type_ids: ["fire"],
          ability_ids: ["toughclaws"],
          move_ids: ["protect"],
          base_stats: stats,
        },
      ],
      sprite_url_template:
        "/pokedex/sprites/version-3/__FORM__/__VARIANT__.webp",
    };
    const parsed = parseBuilderData(dataset);
    expect(parsed.forms[0]?.base_stats.spa).toBe(109);
    expect(parsed.forms[0]?.is_nfe).toBe(false);
    expect(parsed.schema_version).toBe("team-builder-data-v6");
    expect(parsed.mega_search_entries[0]?.base_form_id).toBe("charizard");
    expect(parsed.items[0]?.description).toContain("Mega Charizard X");
    expect(parsed.items[0]?.stat_modifiers[0]).toEqual({
      stat: "spe",
      numerator: 6144,
      denominator: 4096,
      eligibility: "always",
    });
    expect(parsed.abilities[0]?.description).toContain("Fire-type");
    expect(parsed.abilities[0]?.suppresses_held_item).toBe(false);
    expect(parsed.moves[0]?.always_hits).toBe(true);
    expect(parsed.mega_relations[0]?.target.ability.name).toBe("Tough Claws");
    expect(parsed.forms[0]?.sprites.shiny).toContain("/shiny.webp");
    expect(parsed.natures.find((nature) => nature.id === "jolly")?.name).toBe(
      "Jolly (+Spe/-SpA)",
    );

    const orphan = copy(dataset);
    orphan.mega_search_entries[0]!.id = "charizardmegay";
    expect(() => parseBuilderData(orphan)).toThrow(/Mega search reference/);

    const mismatchedStone = copy(dataset);
    mismatchedStone.items.push({
      id: "charizarditey",
      name: "Charizardite Y",
      short_description: "Makes Charizard Mega Evolve.",
      description: "Makes Charizard Mega Evolve into Mega Charizard Y.",
      stat_modifiers: [],
    });
    mismatchedStone.mega_search_entries[0]!.item_id = "charizarditey";
    expect(() => parseBuilderData(mismatchedStone)).toThrow(
      /Mega search reference/,
    );

    for (const invalidModifier of [
      { stat: "hp", numerator: 6144, denominator: 4096, eligibility: "always" },
      { stat: "spe", numerator: 0, denominator: 4096, eligibility: "always" },
      { stat: "spe", numerator: 6144, denominator: 0, eligibility: "always" },
      {
        stat: "spe",
        numerator: 6144,
        denominator: 4096,
        eligibility: "weather",
      },
      {
        stat: "spe",
        numerator: 6144,
        denominator: 4096,
        eligibility: "always",
        item_id: "choicescarf",
      },
    ]) {
      const malformed = copy(dataset);
      malformed.items[0]!.stat_modifiers = [invalidModifier];
      expect(() => parseBuilderData(malformed)).toThrow(/item stat modifier/i);
    }

    const malformedAbility = copy(dataset);
    malformedAbility.abilities[0]!.suppresses_held_item = "false" as never;
    expect(() => parseBuilderData(malformedAbility)).toThrow(
      /ability details/i,
    );

    const malformedForm = copy(dataset);
    malformedForm.forms[0]!.is_nfe = "false" as never;
    expect(() => parseBuilderData(malformedForm)).toThrow(/Pokémon form/i);
  });

  it("requires paired non-empty Item descriptions or paired legacy nulls", () => {
    const validItem = {
      id: "oranberry",
      name: "Oran Berry",
      short_description: "Restores HP.",
      description: "Restores 10 HP when HP is low.",
      stat_modifiers: [],
    };
    const base = {
      schema_version: "team-builder-data-v6",
      data_version: "version-3",
      regulation: named,
      forms: [],
      pokemon_search_entries: [],
      types: [],
      abilities: [],
      moves: [],
      items: [validItem],
      natures: [],
      mechanics: {
        level: 50,
        sp_minimum: 0,
        sp_maximum: 32,
        sp_total_max: 66,
        hp_formula: "base + sp + 75",
        other_formula: "truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages: { hindering: 90, neutral: 100, increasing: 110 },
      },
      mega_relations: [],
      mega_search_entries: [],
      sprite_url_template:
        "/pokedex/sprites/version-3/__FORM__/__VARIANT__.webp",
    };
    expect(
      parseBuilderData({
        ...base,
        items: [{ ...validItem, short_description: null, description: null }],
      }).items[0]?.description,
    ).toBeNull();
    for (const item of [
      { ...validItem, short_description: null },
      { ...validItem, description: null },
      { ...validItem, short_description: "" },
      { ...validItem, description: "   " },
      { ...validItem, description: 1 },
    ]) {
      expect(() => parseBuilderData({ ...base, items: [item] })).toThrow(
        "Invalid item details",
      );
    }
  });

  it("rejects malformed or dangling Mega search entries", () => {
    const base = {
      schema_version: "team-builder-data-v6",
      data_version: "version-3",
      regulation: named,
      forms: [],
      pokemon_search_entries: [],
      types: [],
      abilities: [],
      moves: [],
      items: [],
      natures: [],
      mechanics: {
        level: 50,
        sp_minimum: 0,
        sp_maximum: 32,
        sp_total_max: 66,
        hp_formula: "base + sp + 75",
        other_formula: "truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages: { hindering: 90, neutral: 100, increasing: 110 },
      },
      mega_relations: [],
      mega_search_entries: [
        {
          id: "mega",
          name: "Mega",
          base_form_id: "missing",
          item_id: "stone",
          is_nfe: false,
          sprite_form: "mega",
          type_ids: [],
          ability_ids: [],
          move_ids: [],
          base_stats: stats,
        },
      ],
      sprite_url_template:
        "/pokedex/sprites/version-3/__FORM__/__VARIANT__.webp",
    };
    expect(() => parseBuilderData(base)).toThrow(/Mega search reference/);
    const malformed: any = copy(base);
    malformed.mega_search_entries[0].base_form_id = null;
    expect(() => parseBuilderData(malformed)).toThrow(/Mega search entry/);
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
