import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../data/fixtures/damage-calculator-data-v1.json";
import { DamageCalculator } from "./app";
import type { Bootstrap } from "./contracts";

const bootstrap: Bootstrap = {
  schema_version: "damage-calculator-bootstrap-v1",
  active_version: fixture.data_version,
  regulation: fixture.regulation,
  dataset_url: "/damage-calculator/data/",
};
const response = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(fixture),
  } as Response);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DamageCalculator", () => {
  it("shows loading before data resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    render(<DamageCalculator bootstrap={bootstrap} />);
    expect(screen.getByText("Loading calculation data…")).toBeTruthy();
  });

  it("renders unavailable and stale dataset errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)),
    );
    const rendered = render(<DamageCalculator bootstrap={bootstrap} />);
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    rendered.unmount();
    vi.stubGlobal("fetch", vi.fn(response));
    render(
      <DamageCalculator
        bootstrap={{ ...bootstrap, active_version: "stale" }}
      />,
    );
    expect(await screen.findByText(/does not match/)).toBeTruthy();
  });

  it("keeps six slots independent and applies legal defaults", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = await screen.findAllByLabelText("Pokémon");
    fireEvent.input(pokemon[0]!, { target: { value: "Charizard" } });
    fireEvent.keyDown(pokemon[0]!, { key: "Enter" });
    expect(screen.getAllByLabelText(/^Move [1-6]$/)).toHaveLength(6);
    const moves = screen.getAllByLabelText(/^Move [1-6]$/);
    fireEvent.input(moves[0]!, { target: { value: "Earthquake" } });
    fireEvent.keyDown(moves[0]!, { key: "Enter" });
    expect((moves[1] as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Gender") as HTMLSelectElement).value).toBe(
      "M",
    );
  });

  it("commits canonical Mega Stone IDs and exposes the matching preview", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = (await screen.findAllByLabelText("Pokémon"))[0]!;
    fireEvent.input(pokemon, { target: { value: "Charizard" } });
    fireEvent.keyDown(pokemon, { key: "Enter" });
    const item = screen.getAllByLabelText("Item")[0]!;
    fireEvent.input(item, { target: { value: "Charizardite X" } });
    const option = document.querySelector<HTMLElement>(
      `#${item.getAttribute("aria-controls")} [role="option"]`,
    )!;
    expect(option.textContent).toBe("Charizardite X");
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    expect((item as HTMLInputElement).value).toBe("Charizardite X");
    expect(
      screen.getByRole("button", { name: "Preview Charizard-Mega-X" }),
    ).toBeTruthy();
  });

  it("announces results and toggles disclosure without losing state", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = await screen.findAllByLabelText("Pokémon");
    for (const input of pokemon) {
      fireEvent.input(input, { target: { value: "Charizard" } });
      fireEvent.keyDown(input, { key: "Enter" });
    }
    const move = screen.getAllByLabelText("Move 1")[0]!;
    fireEvent.input(move, { target: { value: "Earthquake" } });
    fireEvent.keyDown(move, { key: "Enter" });
    await waitFor(() =>
      expect(
        document.querySelector(".damage-result[aria-live='polite']"),
      ).toBeTruthy(),
    );
    const result = document.querySelector<HTMLButtonElement>(".damage-result")!;
    fireEvent.click(result);
    expect(result.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(result, { key: "Escape" });
    expect(result.getAttribute("aria-expanded")).toBe("false");
  });
});
