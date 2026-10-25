import { describe, expect, it } from "vitest";
import { parseBattleBootstrap } from "./contracts";

const valid = () => ({
  schema_version: "battle-mode-bootstrap-v1",
  active_version: "release-1",
  regulation: { id: "m-a", name: "Regulation M-A" },
  teams: [
    {
      id: "team-1",
      name: "Rain",
      pinned_version: "release-1",
      regulation: { id: "m-a", name: "Regulation M-A" },
      members: [{ position: 0, sprite_url: "/sprites/pelipper.webp" }],
      updated_at: "2026-10-24T00:00:00Z",
    },
  ],
  dataset_url: "/damage-calculator/data/release-1/m-a/",
  team_url_template: "/teams/__TEAM__/",
  team_builder_url: "/teams/?regulation=m-a",
  base_species_by_form: { pelipper: "pelipper" },
});

describe("Battle Mode bootstrap", () => {
  it("accepts the exact active local contract", () => {
    expect(parseBattleBootstrap(valid()).teams[0]?.id).toBe("team-1");
  });

  it("rejects stale teams and non-local URLs", () => {
    expect(() =>
      parseBattleBootstrap({
        ...valid(),
        teams: [{ ...valid().teams[0], pinned_version: "old" }],
      }),
    ).toThrow(/stale/);
    expect(() =>
      parseBattleBootstrap({ ...valid(), dataset_url: "https://example.test" }),
    ).toThrow(/configuration/);
  });
});
