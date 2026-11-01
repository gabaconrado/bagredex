import { describe, expect, it } from "vitest";
import type {
  AbilityDetail,
  BuilderData,
  BuilderForm,
  ItemDetail,
  Nature,
} from "./contracts";
import {
  baseStatTotal,
  clampSpEdit,
  memberFromPaletteChoice,
  moveMember,
  newMember,
  paletteResults,
  realStats,
  sortPaletteForms,
  validateLocal,
} from "./model";

const base: BuilderForm = {
  id: "charizard",
  name: "Charizard",
  base_species_id: "charizard",
  is_nfe: false,
  types: [
    { id: "fire", name: "Fire" },
    { id: "flying", name: "Flying" },
  ],
  ability_ids: ["blaze"],
  move_ids: ["heatwave", "protect"],
  base_stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
  sprites: { normal: "/normal.webp", shiny: "/shiny.webp" },
};
const serious: Nature = {
  id: "serious",
  name: "Serious",
  increased_stat: null,
  decreased_stat: null,
};
const activeAbility: AbilityDetail = {
  id: "blaze",
  name: "Blaze",
  short_description: "",
  description: "",
  suppresses_held_item: false,
};
const itemWith = (
  stat_modifiers: ItemDetail["stat_modifiers"],
): ItemDetail => ({
  id: "normalized-item",
  name: "Normalized item",
  short_description: null,
  description: null,
  stat_modifiers,
});
const data = {
  forms: [base],
  abilities: [{ id: "blaze", name: "Blaze" }],
  moves: [
    { id: "heatwave", name: "Heat Wave" },
    { id: "protect", name: "Protect" },
  ],
  items: [{ id: "charizarditex", name: "Charizardite X" }],
  natures: [serious],
  mechanics: { sp_total_max: 66 },
} as BuilderData;

describe("team builder model", () => {
  it("calculates picker BST from all six typed base stats", () => {
    expect(baseStatTotal(base.base_stats)).toBe(534);
    expect(
      baseStatTotal({ hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 }),
    ).toBe(21);
  });
  it("sorts picker stats in three-state order with stable name and ID ties", () => {
    const lower = {
      ...base,
      id: "abomasnow-b",
      name: "Abomasnow",
      base_stats: { ...base.base_stats, hp: 60 },
    };
    const tied = { ...lower, id: "abomasnow-a" };
    expect(
      sortPaletteForms([base, lower, tied], null).map((form) => form.id),
    ).toEqual(["abomasnow-a", "abomasnow-b", "charizard"]);
    expect(
      sortPaletteForms([base, lower, tied], {
        key: "hp",
        direction: "descending",
      }).map((form) => form.id),
    ).toEqual(["charizard", "abomasnow-a", "abomasnow-b"]);
    expect(
      sortPaletteForms([base, lower, tied], {
        key: "hp",
        direction: "ascending",
      }).map((form) => form.id),
    ).toEqual(["abomasnow-a", "abomasnow-b", "charizard"]);
  });
  it("requires edited nicknames to fit the ten-character aggregate limit", () => {
    const member = newMember("charizard", "serious", 0);
    member.nickname = "ElevenChars";
    expect(validateLocal(member, data, [member], 0).nickname).toBe(
      "Use 10 characters or fewer.",
    );
  });
  it("rejects a stale canonical item identifier", () => {
    const member = newMember("charizard", "serious", 0);
    member.item_id = "missing-item";
    expect(validateLocal(member, data, [member], 0).item_id).toBe(
      "Choose an available item.",
    );
  });
  it("combines palette filters with AND and excludes used species", () => {
    expect(
      paletteResults(
        [base],
        "char",
        [
          { id: "fire", name: "Fire", kind: "type" },
          { id: "blaze", name: "Blaze", kind: "ability" },
          { id: "protect", name: "Protect", kind: "move" },
        ],
        new Set(),
      ),
    ).toEqual([base]);
    expect(paletteResults([base], "", [], new Set(["charizard"]))).toEqual([]);
  });

  it("clamps every SP request against per-stat and remaining total limits", () => {
    const mechanics = { sp_min: 0, sp_max: 32, sp_total_max: 66 };
    const sp = { hp: 32, atk: 30, def: 4, spa: 0, spd: 0, spe: 0 };
    expect(clampSpEdit(sp, "hp", 99, mechanics)).toBe(32);
    expect(clampSpEdit(sp, "def", 20, mechanics)).toBe(4);
    expect(clampSpEdit(sp, "atk", 1.9, mechanics)).toBe(1);
    expect(clampSpEdit(sp, "atk", Number.NaN, mechanics)).toBe(0);
    expect(clampSpEdit(sp, "hp", -4, mechanics)).toBe(0);
  });

  it("turns a Mega palette choice into only base form, stone, and preview", () => {
    const choice = {
      ...base,
      kind: "mega" as const,
      id: "charizardmegax",
      name: "Charizard-Mega-X",
      base_form_id: "charizard",
      item_id: "charizarditex",
    };
    const member = memberFromPaletteChoice(choice, "serious", 2);
    expect(member).toMatchObject({
      position: 2,
      form_id: "charizard",
      item_id: "charizarditex",
      mega_preview: true,
    });
    expect(member.form_id).not.toBe(choice.id);
  });

  it("calculates level-50 stats with integer nature truncation", () => {
    const timid: Nature = {
      id: "timid",
      name: "Timid",
      increased_stat: "spe",
      decreased_stat: "atk",
    };
    expect(
      realStats(
        base,
        { hp: 0, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
        timid,
      ),
    ).toEqual({ hp: 153, atk: 93, def: 98, spa: 161, spd: 105, spe: 167 });
    expect(
      realStats(
        {
          ...base,
          base_stats: {
            hp: 78,
            atk: 130,
            def: 111,
            spa: 130,
            spd: 85,
            spe: 100,
          },
        },
        { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 },
        serious,
      ),
    ).toEqual({ hp: 153, atk: 182, def: 131, spa: 150, spd: 105, spe: 120 });
  });

  it("chains eligible normalized item modifiers after nature rounding", () => {
    const effective = realStats(
      { ...base, is_nfe: true },
      { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      serious,
      itemWith([
        {
          stat: "atk",
          numerator: 6144,
          denominator: 4096,
          eligibility: "always",
        },
        {
          stat: "spa",
          numerator: 6144,
          denominator: 4096,
          eligibility: "always",
        },
        {
          stat: "spd",
          numerator: 6144,
          denominator: 4096,
          eligibility: "always",
        },
        {
          stat: "spe",
          numerator: 6144,
          denominator: 4096,
          eligibility: "always",
        },
        {
          stat: "def",
          numerator: 6144,
          denominator: 4096,
          eligibility: "form_is_nfe",
        },
        {
          stat: "spd",
          numerator: 6144,
          denominator: 4096,
          eligibility: "form_is_nfe",
        },
      ]),
      activeAbility,
    );
    expect(effective).toEqual({
      hp: 153,
      atk: 156,
      def: 147,
      spa: 193,
      spd: 235,
      spe: 180,
    });
  });

  it("fails conditional modifiers closed and honors held-item suppression", () => {
    const item = itemWith([
      {
        stat: "def",
        numerator: 6144,
        denominator: 4096,
        eligibility: "form_is_nfe",
      },
      {
        stat: "spe",
        numerator: 2048,
        denominator: 4096,
        eligibility: "always",
      },
    ]);
    const sp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    expect(realStats(base, sp, serious, item, activeAbility)).toMatchObject({
      def: 98,
      spe: 60,
    });
    expect(
      realStats(base, sp, serious, item, {
        ...activeAbility,
        suppresses_held_item: true,
      }),
    ).toEqual(realStats(base, sp, serious));
  });

  it("keeps incomplete members valid and reports duplicates and SP overflow", () => {
    const member = newMember("charizard", "serious", 0);
    expect(validateLocal(member, data, [member], 0)).toEqual({});
    member.move_ids = ["protect", "protect", null, null];
    member.sp.hp = 32;
    member.sp.atk = 32;
    member.sp.def = 3;
    expect(validateLocal(member, data, [member], 0)).toMatchObject({
      "move_ids.1": "Choose each move once.",
      sp: "Use no more than 66 SP total.",
    });
  });

  it("moves through fixed empty slots and swaps occupied adjacent slots", () => {
    const first = newMember("charizard", "serious", 1);
    const second = newMember("other", "serious", 3);
    expect(
      moveMember([first, second], 0, -1)?.members.map((item) => item.position),
    ).toEqual([0, 3]);
    const swapped = moveMember([first, { ...second, position: 2 }], 0, 1);
    expect(
      swapped?.members.find((item) => item.form_id === "charizard")?.position,
    ).toBe(2);
    expect(
      swapped?.members.find((item) => item.form_id === "other")?.position,
    ).toBe(1);
  });
});
