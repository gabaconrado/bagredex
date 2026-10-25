import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { damageCalculatorDataV2 as fixture } from "../test-fixtures/damage-calculator-data-v2";
import { BattleMode } from "./app";
import type { BattleBootstrap } from "./contracts";

const searchable = (
  fixture.forms as { id: string; searchable: boolean; is_mega: boolean }[]
).filter(({ searchable, is_mega }) => searchable && !is_mega);

const bootstrap: BattleBootstrap = {
  schema_version: "battle-mode-bootstrap-v2",
  active_version: fixture.data_version,
  regulation: fixture.regulation,
  teams: [
    {
      id: "unavailable",
      name: "Needs work",
      pinned_version: fixture.data_version,
      regulation: fixture.regulation,
      members: [],
      updated_at: "2026-10-25T00:00:00Z",
      battle_ready: false,
      battle_unavailable_reason: "Add at least one Pokémon.",
    },
  ],
  dataset_url: "/damage-data/",
  team_url_template: "/teams/__TEAM__/",
  team_builder_url: "/teams/",
  base_species_by_form: Object.fromEntries(
    searchable.map(({ id }) => [id, id]),
  ),
};

const battleForm = fixture.forms.find(
  ({ searchable, is_mega, abilities }) =>
    searchable && !is_mega && abilities.length > 0,
)!;
const battleNature =
  fixture.natures.find(({ id }) => id === "serious") ?? fixture.natures[0]!;
const readyBootstrap: BattleBootstrap = {
  ...bootstrap,
  teams: [
    {
      id: "team-a",
      name: "Alpha",
      pinned_version: fixture.data_version,
      regulation: fixture.regulation,
      members: [{ position: 0, sprite_url: "/sprites/alpha.webp" }],
      updated_at: "2026-10-25T00:00:00Z",
      battle_ready: true,
      battle_unavailable_reason: null,
    },
    {
      id: "team-b",
      name: "Beta",
      pinned_version: fixture.data_version,
      regulation: fixture.regulation,
      members: [{ position: 0, sprite_url: "/sprites/beta.webp" }],
      updated_at: "2026-10-25T00:00:00Z",
      battle_ready: true,
      battle_unavailable_reason: null,
    },
  ],
};

const teamResponse = (id: string, name: string) =>
  new Response(
    JSON.stringify({
      schema_version: "team-api-v1",
      data: {
        id,
        name,
        updated_at: "2026-10-25T00:00:00Z",
        pinned: {
          version: fixture.data_version,
          regulation: fixture.regulation,
        },
        members: [
          {
            position: 0,
            pokemon: battleForm.id,
            nickname: "",
            ability: battleForm.abilities[0]!.id,
            item: null,
            moves: [null, null, null, null],
            nature: battleNature.id,
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
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const datasetResponse = () =>
  Promise.resolve(
    new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Battle Mode empty workspace", () => {
  it("shows the arena, disables mutations, and explains unavailable teams", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(fixture), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    render(<BattleMode bootstrap={bootstrap} />);

    expect(
      await screen.findByRole("region", { name: "Battle Mode" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Battle Mode" })).toBeNull();
    expect(screen.getByRole("region", { name: "Battlefield" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Add opponent Pokémon" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: /Your active slot 1/ })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByText("Start battle")).toBeNull();
    expect(screen.queryByText("Start over")).toBeNull();
    expect(screen.queryByText("Accounted effects")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Your team/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose your team" });
    const unavailable = within(dialog).getByRole("button", {
      name: /Needs work/,
    });
    expect(unavailable.hasAttribute("disabled")).toBe(true);
    expect(unavailable.textContent).toContain("Add at least one Pokémon.");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Choose your team" }),
    ).toBeNull();
  });

  it("does not install an initial team after its pending request is cancelled", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes("/teams/team-a/")
          ? pending.promise
          : datasetResponse(),
      ),
    );
    render(<BattleMode bootstrap={readyBootstrap} />);

    const teamTrigger = await screen.findByRole("button", {
      name: /Your team/,
    });
    fireEvent.click(teamTrigger);
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Choose your team" }),
      ).getByRole("button", { name: /Alpha/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("dialog", { name: "Choose your team" }),
    ).toBeNull();

    await act(async () => pending.resolve(teamResponse("team-a", "Alpha")));
    await waitFor(() =>
      expect(teamTrigger.textContent).toContain("Choose a team"),
    );
    expect(screen.getByText("Choose your team to begin.")).toBeTruthy();
    expect(teamTrigger).toBe(document.activeElement);
  });

  it("retains a progressed battle when a replacement request is cancelled", async () => {
    const replacement = deferred<Response>();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/teams/team-a/"))
          return Promise.resolve(teamResponse("team-a", "Alpha"));
        if (url.includes("/teams/team-b/")) return replacement.promise;
        return datasetResponse();
      }),
    );
    render(<BattleMode bootstrap={readyBootstrap} />);

    const teamTrigger = await screen.findByRole("button", {
      name: /Your team/,
    });
    fireEvent.click(teamTrigger);
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Choose your team" }),
      ).getByRole("button", { name: /Alpha/ }),
    );
    await waitFor(() => expect(teamTrigger.textContent).toContain("Alpha"));
    const rosterMember = screen.getByRole("button", {
      name: new RegExp(battleForm.name),
    });
    fireEvent.click(rosterMember);
    fireEvent.click(
      screen.getByRole("button", { name: "Your active slot 1, empty" }),
    );
    expect(
      screen.getByRole("article", {
        name: new RegExp(`Your active slot 1, ${battleForm.name}`),
      }),
    ).toBeTruthy();

    fireEvent.click(teamTrigger);
    const dialog = screen.getByRole("dialog", { name: "Choose your team" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Beta/ }));
    fireEvent.keyDown(dialog, { key: "Escape" });

    await act(async () => replacement.resolve(teamResponse("team-b", "Beta")));
    await waitFor(() => expect(teamTrigger.textContent).toContain("Alpha"));
    expect(teamTrigger.textContent).not.toContain("Beta");
    expect(
      screen.getByRole("article", {
        name: new RegExp(`Your active slot 1, ${battleForm.name}`),
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(teamTrigger).toBe(document.activeElement);
  });
});
