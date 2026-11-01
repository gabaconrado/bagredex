import { describe, expect, it } from "vitest";
import type { BuilderData, Member } from "./contracts";
import { exportTeamText, importTeamText } from "./team-text";

const data: BuilderData = {
  schema_version: "team-builder-data-v6",
  data_version: "test-version",
  regulation: { id: "m-c", name: "Regulation M-C" },
  forms: [
    {
      id: "mr-mime",
      name: "Mr. Mime",
      base_species_id: "mrmime",
      is_nfe: false,
      types: [],
      ability_ids: ["soundproof"],
      move_ids: ["will-o-wisp", "protect"],
      base_stats: { hp: 40, atk: 45, def: 65, spa: 100, spd: 120, spe: 90 },
      sprites: { normal: "/mime.webp", shiny: "/mime-shiny.webp" },
    },
    {
      id: "charizard",
      name: "Charizard",
      base_species_id: "charizard",
      is_nfe: false,
      types: [],
      ability_ids: ["blaze"],
      move_ids: ["protect"],
      base_stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
      sprites: { normal: "/zard.webp", shiny: "/zard-shiny.webp" },
    },
  ],
  pokemon_search_entries: [
    { form_id: "mr-mime", name: "Mr. Mime", form_group: null },
    { form_id: "charizard", name: "Charizard", form_group: null },
  ],
  types: [],
  abilities: [
    {
      id: "soundproof",
      name: "Soundproof",
      short_description: "",
      description: "",
      suppresses_held_item: false,
    },
    {
      id: "blaze",
      name: "Blaze",
      short_description: "",
      description: "",
      suppresses_held_item: false,
    },
  ],
  moves: [
    {
      id: "will-o-wisp",
      name: "Will-O-Wisp",
      type: { id: "fire", name: "Fire" },
      category: "Status",
      base_power: 0,
      accuracy: 85,
      always_hits: false,
      pp: 15,
      priority: 0,
      target: "normal",
      short_description: "",
      description: "",
      flags: [],
    },
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
      short_description: "",
      description: "",
      flags: [],
    },
  ],
  items: [
    {
      id: "leftovers",
      name: "Leftovers",
      short_description: null,
      description: null,
      stat_modifiers: [],
    },
    {
      id: "charizardite-x",
      name: "Charizardite X",
      short_description: null,
      description: null,
      stat_modifiers: [],
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
      id: "timid",
      name: "Timid",
      increased_stat: "spe",
      decreased_stat: "atk",
    },
  ],
  mega_relations: [
    {
      form_id: "charizard",
      item_id: "charizardite-x",
      target: {
        id: "charizard-mega-x",
        name: "Mega Charizard X",
        base_species_id: "charizard",
        is_nfe: false,
        types: [],
        ability_ids: ["blaze"],
        move_ids: ["protect"],
        base_stats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 },
        sprites: { normal: "/mega.webp", shiny: "/mega-shiny.webp" },
        ability: { id: "blaze", name: "Blaze" },
      },
    },
  ],
  mega_search_entries: [
    {
      id: "charizard-mega-x",
      name: "Mega Charizard X",
      base_species_id: "charizard",
      base_form_id: "charizard",
      item_id: "charizardite-x",
      is_nfe: false,
      types: [],
      ability_ids: ["blaze"],
      move_ids: ["protect"],
      base_stats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 },
      sprites: { normal: "/mega.webp", shiny: "/mega-shiny.webp" },
    },
  ],
  mechanics: {
    level: 50,
    iv: 31,
    sp_min: 0,
    sp_max: 32,
    sp_total_max: 66,
    formula: "test",
  },
};

function successful(text: string): Member[] {
  const result = importTeamText(text, data);
  expect(result.ok, result.ok ? undefined : result.errors.join("\n")).toBe(
    true,
  );
  return result.ok ? result.members : [];
}

describe("team text import", () => {
  it("accepts Showdown headers, ignored gender, Trait, SPs, shiny, and normalized names", () => {
    const members = successful(
      "Mimey (mr mime) (F) @ leftovers\r\nTrait: SOUND PROOF\r\nShiny: Yes\r\nSPs: 32 HP / 2 SpA / 32 Spe\r\nTimid Nature\r\n- will o wisp\r\n- PROTECT",
    );
    expect(members[0]).toMatchObject({
      nickname: "Mimey",
      form_id: "mr-mime",
      item_id: "leftovers",
      ability_id: "soundproof",
      shiny: true,
      nature_id: "timid",
      move_ids: ["will-o-wisp", "protect", null, null],
      sp: { hp: 32, atk: 0, def: 0, spa: 2, spd: 0, spe: 32 },
    });
  });

  it("uses defaults, allows an empty team, and infers Mega preview", () => {
    expect(successful(" ")).toEqual([]);
    expect(successful("Charizard")[0]).toMatchObject({
      nature_id: "serious",
      ability_id: null,
      item_id: null,
      shiny: false,
    });
    expect(successful("Mega Charizard X\n- Protect")[0]).toMatchObject({
      form_id: "charizard",
      item_id: "charizardite-x",
      mega_preview: true,
    });
  });

  it.each(["Level: 50", "EVs: 4 HP", "IVs: 0 Atk", "Tera Type: Fire"])(
    "rejects unsupported detail %s",
    (detail) => {
      const result = importTeamText(`Charizard\n${detail}`, data);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors.join(" ")).toContain("not supported");
    },
  );

  it("rejects malformed, unknown, duplicate, illegal, and oversized teams atomically", () => {
    const cases = [
      "Missingno",
      "Charizard\nAbility: Blaze\nTrait: Blaze",
      "Charizard\nSPs: 32 HP / 32 Atk / 3 Spe",
      "Charizard\n- Will-O-Wisp",
      "Charizard\nMystery: value",
      "Charizard\n- Protect\n- Protect",
      "Charizard\n\nCharizard",
      Array.from({ length: 7 }, () => "Charizard").join("\n\n"),
    ];
    cases.forEach((text) => {
      const result = importTeamText(text, data);
      expect(result.ok, text).toBe(false);
      if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  it.each([
    ["@ Leftovers", "use “Species @ Item”"],
    ["Charizard @ Leftovers @ Leftovers", "use “Species @ Item”"],
    ["=== [gen9] Team name ===", "unknown"],
    ["LongNickname (Charizard)", "10 characters"],
    ["Charizard\nSPs: 1 HP / 2 HP", "HP SP appears more than once"],
    ["Charizard\nSPs: 33 HP", "must be from 0 to 32"],
    ["Charizard\nShiny: Maybe", "Shiny must be Yes or No"],
    ["Charizard\nShiny: Yes\nShiny: No", "Shiny appears more than once"],
    [
      "Charizard\nTimid Nature\nSerious Nature",
      "nature appears more than once",
    ],
    [
      "Charizard\n- Protect\n- Protect\n- Protect\n- Protect\n- Protect",
      "at most 4 moves",
    ],
    [
      "Mr. Mime @ Leftovers\n\nCharizard @ Leftovers",
      "Another Pokémon already holds this item",
    ],
    ["Mega Charizard X @ Leftovers", "requires its matching Mega Stone"],
  ])("rejects %s with a focused diagnostic", (text, diagnostic) => {
    const result = importTeamText(text, data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain(diagnostic);
  });

  it("rejects ambiguous normalized names and overlong input", () => {
    const collision: BuilderData = {
      ...data,
      items: [
        ...data.items,
        {
          id: "left-overs-collision",
          name: "Left overs",
          short_description: null,
          description: null,
          stat_modifiers: [],
        },
      ],
    };
    const ambiguous = importTeamText("Charizard @ LEFT-OVERS", collision);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok)
      expect(ambiguous.errors.join("\n")).toContain(
        "item “LEFT-OVERS” is ambiguous",
      );

    const overlong = importTeamText("x".repeat(32_001), data);
    expect(overlong.ok).toBe(false);
    if (!overlong.ok)
      expect(overlong.errors).toEqual([
        "Team text must be 32,000 characters or fewer.",
      ]);
  });
});

describe("team text export", () => {
  it("exports canonical position order and round-trips representable values", () => {
    const imported = successful(
      "Mimey (Mr. Mime) @ Leftovers\nAbility: Soundproof\nShiny: Yes\nSPs: 32 HP / 2 SpA / 32 Spe\nTimid Nature\n- Will-O-Wisp\n- Protect\n\nCharizard\nSerious Nature",
    );
    imported
      .reverse()
      .forEach((member, index) => (member.position = 1 - index));
    const text = exportTeamText(imported, data);
    expect(text).toContain("Mimey (Mr. Mime) @ Leftovers");
    expect(text).toContain("Shiny: Yes");
    expect(text).toContain("SPs: 32 HP / 2 SpA / 32 Spe");
    const roundTrip = successful(text);
    expect(
      roundTrip.map(({ position: _position, ...member }) => member),
    ).toEqual(
      imported
        .sort((left, right) => left.position - right.position)
        .map(({ position: _position, ...member }) => member),
    );
  });

  it("exports an empty roster as empty text", () => {
    expect(exportTeamText([], data)).toBe("");
  });
});
