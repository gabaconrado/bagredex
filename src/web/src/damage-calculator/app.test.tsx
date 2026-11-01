import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { damageCalculatorDataV2 as fixture } from "../test-fixtures/damage-calculator-data-v2";
import { DamageCalculator, ratioScaledCurrentHp } from "./app";
import type { Bootstrap, CalculatorData } from "./contracts";

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
const contextualResponse = () => {
  const data = structuredClone(fixture) as CalculatorData;
  const earthquake = data.moves.find(({ id }) => id === "earthquake")!;
  earthquake.contextual_inputs = [
    {
      key: "priorDamage",
      label: "Prior damage taken",
      kind: "integer",
      default: 0,
      minimum: 0,
      maximum: 999,
    },
  ];
  data.moves.push({
    ...earthquake,
    id: "context-strike",
    name: "Context Strike",
    contextual_inputs: [
      {
        key: "allyAttack",
        label: "Ally 1 base Attack",
        kind: "integer",
        default: 1,
        minimum: 1,
        maximum: 999,
      },
    ],
  });
  data.forms
    .find(({ id }) => id === "charizard")!
    .move_ids.push("context-strike");
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
};
const choose = (input: HTMLElement, name: string) => {
  fireEvent.input(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("DamageCalculator", () => {
  it("keeps one move modifier open and restores trigger focus on dismissal", async () => {
    vi.stubGlobal("fetch", vi.fn(contextualResponse));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = (await screen.findAllByLabelText("Pokémon"))[0]!;
    choose(pokemon, "Charizard");
    const moves = screen.getAllByLabelText(/^Move [1-6]$/);
    choose(moves[0]!, "Earthquake");
    choose(moves[1]!, "Context Strike");

    const triggers = [
      screen.getByRole("button", { name: "Earthquake modifiers" }),
      screen.getByRole("button", { name: "Context Strike modifiers" }),
    ];
    expect(triggers[0]!.textContent).toBe("+");
    expect(triggers[1]!.textContent).toBe("+");
    expect(triggers[0]!.getAttribute("aria-controls")).toBe(
      "left-move-0-modifiers",
    );
    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen
        .getByLabelText("Move 3")
        .closest(".damage-move-field")
        ?.classList.contains("has-modifier"),
    ).toBe(false);
    fireEvent.click(triggers[0]!);
    const priorDamage = screen.getByLabelText("Prior damage taken");
    fireEvent.input(priorDamage, { target: { value: "40" } });
    expect((priorDamage as HTMLInputElement).value).toBe("40");

    fireEvent.pointerDown(triggers[1]!);
    fireEvent.click(triggers[1]!);
    expect(screen.queryByLabelText("Prior damage taken")).toBeNull();
    expect(screen.getByLabelText("Ally 1 base Attack")).toBeTruthy();
    expect(triggers[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Context Strike modifiers" }),
    );

    fireEvent.input(screen.getByLabelText("Ally 1 base Attack"), {
      target: { value: "120" },
    });

    fireEvent.pointerDown(triggers[1]!);
    fireEvent.click(triggers[1]!);
    expect(screen.queryByLabelText("Ally 1 base Attack")).toBeNull();
    expect(document.activeElement).toBe(triggers[1]);

    fireEvent.pointerDown(triggers[1]!);
    fireEvent.click(triggers[1]!);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("Ally 1 base Attack")).toBeNull();
    expect(document.activeElement).toBe(triggers[1]);

    fireEvent.click(triggers[0]!);
    expect(
      (screen.getByLabelText("Prior damage taken") as HTMLInputElement).value,
    ).toBe("40");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByLabelText("Prior damage taken")).toBeNull();
    expect(document.activeElement).toBe(triggers[0]);
  });

  it("uses a focus-contained dialog for move modifiers at the phone breakpoint", async () => {
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      media: "(max-width: 720px)",
      onchange: null,
      addEventListener: (_event: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }));
    vi.stubGlobal("fetch", vi.fn(contextualResponse));
    render(<DamageCalculator bootstrap={bootstrap} />);
    choose((await screen.findAllByLabelText("Pokémon"))[0]!, "Charizard");
    const moves = screen.getAllByLabelText(/^Move [1-6]$/);
    choose(moves[0]!, "Earthquake");
    choose(moves[1]!, "Context Strike");
    const triggers = [
      screen.getByRole("button", { name: "Earthquake modifiers" }),
      screen.getByRole("button", { name: "Context Strike modifiers" }),
    ];
    fireEvent.click(triggers[0]!);

    const dialog = await screen.findByRole("dialog", {
      name: "Earthquake modifiers",
    });
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Close modifiers" }),
    );
    const close = within(dialog).getByRole("button", {
      name: "Close modifiers",
    });
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(
      within(dialog).getByLabelText("Prior damage taken"),
    );
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    vi.useFakeTimers();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss modifier dialog" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    expect(document.activeElement).toBe(triggers[0]);

    fireEvent.click(triggers[1]!);
    expect(
      await screen.findByRole("dialog", { name: "Context Strike modifiers" }),
    ).toBeTruthy();
  });

  it("lets the phone backdrop click close before deferred focus restoration", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      media: "(max-width: 720px)",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }));
    vi.stubGlobal("fetch", vi.fn(contextualResponse));
    const rendered = render(<DamageCalculator bootstrap={bootstrap} />);
    choose((await screen.findAllByLabelText("Pokémon"))[0]!, "Charizard");
    choose(screen.getAllByLabelText(/^Move [1-6]$/)[0]!, "Earthquake");
    const trigger = screen.getByRole("button", {
      name: "Earthquake modifiers",
    });
    fireEvent.click(trigger);
    const backdrop = await screen.findByRole("button", {
      name: "Dismiss modifier dialog",
    });
    const defaultFocusTarget = document.createElement("button");
    document.body.append(defaultFocusTarget);
    vi.useFakeTimers();

    const initialFocus = document.activeElement;
    fireEvent.pointerDown(backdrop);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(initialFocus);
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(backdrop);
    defaultFocusTarget.focus();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(defaultFocusTarget);
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(document.activeElement).toBe(trigger);
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(trigger);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Dismiss modifier dialog" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss modifier dialog" }),
    );
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(trigger);
    const reopenedClose = screen.getByRole("button", {
      name: "Close modifiers",
    });
    expect(document.activeElement).toBe(reopenedClose);
    vi.runAllTimers();
    expect(document.activeElement).toBe(reopenedClose);
    expect(vi.getTimerCount()).toBe(0);

    const focus = vi.spyOn(trigger, "focus");
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Dismiss modifier dialog" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss modifier dialog" }),
    );
    expect(vi.getTimerCount()).toBe(1);
    rendered.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(focus).not.toHaveBeenCalled();
    defaultFocusTarget.remove();
  });

  it("shows loading before data resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    render(<DamageCalculator bootstrap={bootstrap} />);
    const loading = screen.getByRole("status");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.textContent).toBe("Loading damage calculator…");
    expect(
      screen.queryByRole("heading", { name: "Damage Calculator" }),
    ).toBeNull();
  });

  it("renders the ready controls without redundant introduction copy", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    await screen.findAllByLabelText("Pokémon");
    expect(screen.queryByText(/Level 50 · VGC doubles/)).toBeNull();
    expect(
      screen.queryByText(/Compare six moves in either direction/),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Damage Calculator" }),
    ).toBeNull();
  });

  it("toggles field-effect cells with mutually exclusive weather and terrain", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    await screen.findAllByLabelText("Pokémon");
    const summary = screen.getByRole("button", { name: /Field Effects/ });
    expect(within(summary).getByText("None active")).toBeTruthy();
    fireEvent.click(summary);

    const weather = within(screen.getByRole("group", { name: "Weather" }));
    const sun = weather.getByRole("button", { name: "Sun" });
    const rain = weather.getByRole("button", { name: "Rain" });
    fireEvent.click(sun);
    expect(sun.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(rain);
    expect(sun.getAttribute("aria-pressed")).toBe("false");
    expect(rain.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(rain);
    expect(rain.getAttribute("aria-pressed")).toBe("false");

    const terrain = within(screen.getByRole("group", { name: "Terrain" }));
    const electric = terrain.getByRole("button", { name: "Electric" });
    fireEvent.click(electric);
    expect(electric.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(electric);

    const left = within(screen.getByRole("group", { name: "Left" }));
    const right = within(screen.getByRole("group", { name: "Right" }));
    fireEvent.click(weather.getByRole("button", { name: "Sun" }));
    fireEvent.click(terrain.getByRole("button", { name: "Grassy" }));
    fireEvent.click(left.getByRole("button", { name: "Aurora Veil" }));
    fireEvent.click(left.getByRole("button", { name: "Friend Guard" }));
    fireEvent.click(right.getByRole("button", { name: "Helping Hand" }));
    expect(
      within(summary).getByText(
        "Field: Sun, Grassy Terrain · Left: Aurora Veil, Friend Guard · Right: Helping Hand",
      ),
    ).toBeTruthy();
    expect(terrain.getByRole("button", { name: "Grassy" })).toBeTruthy();
  });

  it("names panels by side and keeps vitals and stages in stat workflow order", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = await screen.findAllByLabelText("Pokémon");
    fireEvent.input(pokemon[0]!, { target: { value: "Charizard" } });
    fireEvent.keyDown(pokemon[0]!, { key: "Enter" });

    expect(screen.getByRole("article", { name: "Left Pokémon" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Right Pokémon" })).toBeTruthy();
    expect(screen.queryByText("Left Pokémon")).toBeNull();
    expect(screen.queryByText("Right Pokémon")).toBeNull();

    const nature = screen.getByLabelText("Nature");
    const currentHp = screen.getByLabelText(/Current HP/);
    expect(currentHp.getAttribute("aria-describedby")).toBe(
      "left-current-hp-percent",
    );
    expect(currentHp.getAttribute("aria-label")).toBeNull();
    expect(
      document.querySelector("label[for='left-current-hp']")?.textContent,
    ).toBe("Current HP");
    expect(
      document.getElementById("left-current-hp-percent")?.textContent,
    ).toBe("100.0%");
    const status = screen.getByLabelText("Status");
    const statsHeading = screen.getByRole("heading", { name: "Stats" });
    const precedes = (first: Element, second: Element) =>
      Boolean(
        first.compareDocumentPosition(second) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );
    expect(precedes(nature, currentHp)).toBe(true);
    expect(precedes(currentHp, status)).toBe(true);
    expect(precedes(status, statsHeading)).toBe(true);

    const attackSp = screen.getByLabelText("Attack SP");
    const attackStage = screen.getByLabelText("Attack stage");
    expect(attackSp.nextElementSibling?.contains(attackStage)).toBe(true);
    expect((attackStage as HTMLSelectElement).options).toHaveLength(13);
    expect(screen.queryByLabelText("HP stage")).toBeNull();
  });

  it("preserves HP ratios only for HP SP changes", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = (await screen.findAllByLabelText("Pokémon"))[0]!;
    choose(pokemon, "Charizard");
    const currentHp = screen.getByLabelText("Current HP") as HTMLInputElement;
    const hpSp = screen.getByLabelText("HP SP") as HTMLInputElement;
    const attackSp = screen.getByLabelText("Attack SP") as HTMLInputElement;

    fireEvent.input(hpSp, { target: { value: "32" } });
    expect(currentHp.value).toBe(currentHp.max);
    fireEvent.input(currentHp, { target: { value: "77" } });
    fireEvent.input(attackSp, { target: { value: "32" } });
    expect(currentHp.value).toBe("77");
    const oldMax = Number(currentHp.max);
    fireEvent.input(hpSp, { target: { value: "0" } });
    expect(Number(currentHp.value)).toBe(
      Math.floor((77 * Number(currentHp.max)) / oldMax),
    );
    fireEvent.input(currentHp, { target: { value: "0" } });
    fireEvent.input(hpSp, { target: { value: "32" } });
    expect(currentHp.value).toBe("0");
  });

  it("handles ratio floor, bounds, and invalid previous maxima", () => {
    expect(ratioScaledCurrentHp(153, 153, 169)).toBe(169);
    expect(ratioScaledCurrentHp(76, 153, 169)).toBe(83);
    expect(ratioScaledCurrentHp(0, 153, 169)).toBe(0);
    expect(ratioScaledCurrentHp(80, 0, 70)).toBe(70);
    expect(ratioScaledCurrentHp(40, Number.NaN, 70)).toBe(40);
    expect(ratioScaledCurrentHp(Number.NaN, 100, 120)).toBe(0);
  });

  it("shows exact staged stats while damage applies the stage once", async () => {
    const grounded = structuredClone(fixture);
    grounded.forms.find(({ id }) => id === "charizard")!.types = ["fire"];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(grounded),
        } as Response),
      ),
    );
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = await screen.findAllByLabelText("Pokémon");
    choose(pokemon[0]!, "Charizard");
    choose(pokemon[1]!, "Charizard");
    const attackRow = screen
      .getAllByLabelText("Attack SP")[0]!
      .closest(".damage-stat")!;
    const displayed = attackRow.querySelector("output")!;
    const base = Number(displayed.textContent);
    const stage = screen.getAllByLabelText("Attack stage")[0]!;
    const move = screen.getAllByLabelText("Move 1")[0]!;
    choose(move, "Earthquake");
    await waitFor(() =>
      expect((move as HTMLInputElement).value).toBe("Earthquake"),
    );
    await waitFor(() =>
      expect(
        document.querySelector(".damage-result[aria-live='polite']"),
      ).toBeTruthy(),
    );
    const result = document.querySelector<HTMLButtonElement>(
      ".damage-result[aria-live='polite']",
    )!;
    const expectedEarthquakeRolls = (unstagedAttack: number, stage: number) => {
      const stagedAttack =
        stage >= 0
          ? Math.floor((unstagedAttack * (2 + stage)) / 2)
          : Math.floor((unstagedAttack * 2) / (2 - stage));
      const baseDamage = Math.floor(
        Math.floor((22 * 100 * stagedAttack) / 98) / 50 + 2,
      );
      const spreadDamage = Math.floor((baseDamage * 3) / 4);
      return Array.from(
        { length: 16 },
        (_, roll) => Math.floor((spreadDamage * (85 + roll)) / 100) * 2,
      );
    };
    const baseline = result.textContent;
    fireEvent.change(stage, { target: { value: "1" } });
    expect(Number(displayed.textContent)).toBe(Math.floor((base * 3) / 2));
    const once = result.textContent;
    expect(once).not.toBe(baseline);
    const positiveRolls = expectedEarthquakeRolls(base, 1);
    expect(once).toContain(`${positiveRolls[0]}-${positiveRolls.at(-1)}`);
    expect(once).toContain(`(${positiveRolls.join(", ")})`);
    fireEvent.change(stage, { target: { value: "2" } });
    expect(Number(displayed.textContent)).toBe(base * 2);
    expect(result.textContent).not.toBe(once);
    fireEvent.change(stage, { target: { value: "-1" } });
    expect(Number(displayed.textContent)).toBe(Math.floor((base * 2) / 3));
    const negativeRolls = expectedEarthquakeRolls(base, -1);
    expect(result.textContent).toContain(
      `${negativeRolls[0]}-${negativeRolls.at(-1)}`,
    );
    expect(result.textContent).toContain(`(${negativeRolls.join(", ")})`);
    fireEvent.change(stage, { target: { value: "0" } });
    expect(Number(displayed.textContent)).toBe(base);
    expect(result.textContent).toBe(baseline);

    for (const label of ["Defense", "Sp. Atk", "Sp. Def", "Speed"]) {
      const sp = screen.getAllByLabelText(`${label} SP`)[0]!;
      const row = sp.closest(".damage-stat")!;
      const output = row.querySelector("output")!;
      const unstaged = Number(output.textContent);
      fireEvent.change(screen.getAllByLabelText(`${label} stage`)[0]!, {
        target: { value: "1" },
      });
      expect(Number(output.textContent)).toBe(Math.floor((unstaged * 3) / 2));
    }
  });

  it("limits digit shortcuts to eligible document targets and cleans up", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    const rendered = render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = await screen.findAllByLabelText("Pokémon");
    fireEvent.keyDown(document.body, { key: "1" });
    expect(document.activeElement).toBe(pokemon[0]);
    expect(pokemon[0]!.getAttribute("aria-expanded")).toBe("true");
    (pokemon[0] as HTMLInputElement).blur();
    fireEvent.keyDown(document.body, { key: "2", ctrlKey: true });
    expect(document.activeElement).not.toBe(pokemon[1]);
    fireEvent.keyDown(document.body, { key: "2", repeat: true });
    expect(document.activeElement).not.toBe(pokemon[1]);
    const prevented = new KeyboardEvent("keydown", {
      key: "2",
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    document.body.dispatchEvent(prevented);
    expect(document.activeElement).not.toBe(pokemon[1]);
    const button = document.createElement("button");
    document.body.append(button);
    fireEvent.keyDown(button, { key: "2" });
    expect(document.activeElement).not.toBe(pokemon[1]);
    button.remove();
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.append(editable);
    fireEvent.keyDown(editable, { key: "2" });
    expect(document.activeElement).not.toBe(pokemon[1]);
    editable.remove();
    fireEvent.keyDown(document.body, { key: "2" });
    expect(document.activeElement).toBe(pokemon[1]);
    rendered.unmount();
    fireEvent.keyDown(document.body, { key: "1" });
    expect(document.activeElement).toBe(document.body);
  });

  it("keeps the Mega slot stable, locks its ability, and restores the base choice", async () => {
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DamageCalculator bootstrap={bootstrap} />);
    const pokemon = (await screen.findAllByLabelText("Pokémon"))[0]!;
    choose(pokemon, "Charizard");
    const panel = screen.getByRole("article", { name: "Left Pokémon" });
    const visual = panel.querySelector(".damage-pokemon__visual")!;
    expect(visual.children).toHaveLength(2);
    expect(
      visual.firstElementChild?.querySelector("[aria-hidden='true']"),
    ).toBeTruthy();
    const ability = screen.getAllByLabelText("Ability")[0]! as HTMLInputElement;
    choose(ability, "Solar Power");
    const item = screen.getAllByLabelText("Item")[0]!;
    choose(item, "Charizardite X");
    const mega = screen.getByRole("button", {
      name: "Preview Charizard-Mega-X",
    });
    expect(visual.children).toHaveLength(2);
    fireEvent.click(mega);
    expect(ability.disabled).toBe(true);
    expect(ability.value).toBe("Tough Claws");
    fireEvent.click(screen.getByRole("button", { name: "Use base form" }));
    expect(ability.disabled).toBe(false);
    expect(ability.value).toBe("Solar Power");
    expect(visual.children).toHaveLength(2);
  });

  it("fails closed when a Mega relation references a missing ability", async () => {
    const malformed = structuredClone(fixture);
    malformed.mega_item_relations[0]!.locked_ability_id = "missing-ability";
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(malformed),
        } as Response),
      ),
    );
    render(<DamageCalculator bootstrap={bootstrap} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Mega references are invalid/i,
    );
    expect(screen.queryByRole("article", { name: "Left Pokémon" })).toBeNull();
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
