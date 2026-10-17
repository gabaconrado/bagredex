import { describe, expect, it } from "vitest";
import type { BuilderData, BuilderForm, Nature } from "./contracts";
import {
  moveMember,
  newMember,
  paletteResults,
  realStats,
  validateLocal,
} from "./model";

const base: BuilderForm = {
  id: "charizard",
  name: "Charizard",
  base_species_id: "charizard",
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

  it("calculates level-50 stats with integer nature truncation", () => {
    const timid: Nature = {
      id: "timid",
      name: "Timid",
      increased_stat: "spe",
      decreased_stat: "atk",
    };
    expect(
      realStats(
        base.base_stats,
        { hp: 0, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
        timid,
      ),
    ).toEqual({ hp: 153, atk: 93, def: 98, spa: 161, spd: 105, spe: 167 });
    expect(
      realStats(
        { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 },
        { hp: 0, atk: 32, def: 0, spa: 0, spd: 0, spe: 0 },
        serious,
      ),
    ).toEqual({ hp: 153, atk: 182, def: 131, spa: 150, spd: 105, spe: 120 });
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
