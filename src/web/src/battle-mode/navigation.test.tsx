import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../data/fixtures/damage-calculator-data-v1.json";
import { BattleMode } from "./app";
import type { BattleBootstrap } from "./contracts";

const data = fixture;
const searchable = (
  fixture.forms as { id: string; searchable: boolean; is_mega: boolean }[]
)
  .filter(({ searchable, is_mega }) => searchable && !is_mega)
  .map(({ id }) => [id, id]);
const bootstrap: BattleBootstrap = {
  schema_version: "battle-mode-bootstrap-v1",
  active_version: fixture.data_version,
  regulation: fixture.regulation,
  teams: [
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Navigation test",
      pinned_version: fixture.data_version,
      regulation: fixture.regulation,
      members: [],
      updated_at: "2026-10-25T00:00:00Z",
    },
  ],
  dataset_url: "/damage-data/",
  team_url_template: "/teams/__TEAM__/",
  team_builder_url: "/teams/",
  base_species_by_form: Object.fromEntries(searchable),
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelector("[data-test-external]")?.remove();
  document.querySelector("[data-test-regulation]")?.remove();
});

describe("Battle Mode departure protection", () => {
  it("intercepts link and regulation navigation immediately after Start battle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL | Request) => {
        if (String(url) === bootstrap.dataset_url)
          return Promise.resolve(
            new Response(JSON.stringify(data), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        return new Promise<Response>(() => undefined);
      }),
    );
    const external = document.createElement("a");
    external.href = "/pokedex/";
    external.textContent = "Pokédex";
    external.dataset.testExternal = "";
    document.body.append(external);
    const regulationForm = document.createElement("form");
    regulationForm.dataset.regulationSelector = "";
    regulationForm.dataset.testRegulation = "";
    const regulation = document.createElement("select");
    const otherRegulation = bootstrap.regulation.id === "m-b" ? "m-a" : "m-b";
    for (const value of [bootstrap.regulation.id, otherRegulation]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      regulation.append(option);
    }
    regulation.value = bootstrap.regulation.id;
    regulationForm.append(regulation);
    document.body.append(regulationForm);
    render(<BattleMode bootstrap={bootstrap} />);
    fireEvent.click(
      await screen.findByRole("radio", { name: /Navigation test/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start battle" }));
    external.focus();
    expect(document.activeElement).toBe(external);
    fireEvent.click(external);
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep battling" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(external);
    expect(
      screen
        .getByRole("button", { name: "Loading team…" })
        .hasAttribute("disabled"),
    ).toBe(true);

    const navigation = new CustomEvent("bagredex:navigate", {
      cancelable: true,
      detail: { url: `/?regulation=${otherRegulation}` },
    });
    regulation.value = otherRegulation;
    regulation.focus();
    expect(document.dispatchEvent(navigation)).toBe(false);
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep battling" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(regulation.value).toBe(bootstrap.regulation.id);
    expect(document.activeElement).toBe(regulation);
  });
});
