import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Autocomplete, MemberEditor } from "./app";
import type { BuilderData, Member } from "./contracts";

function ControlledAutocomplete() {
  const [value, setValue] = useState<string | null>("blaze");
  return (
    <>
      <Autocomplete
        inputId="ability"
        label="Ability"
        value={value}
        choices={[
          { id: "blaze", name: "Blaze" },
          { id: "solar-power", name: "Solar Power" },
        ]}
        next="after"
        onChange={setValue}
      />
      <output data-testid="value">{value ?? "empty"}</output>
      <button id="after" type="button">
        After
      </button>
      <button type="button" onClick={() => setValue(null)}>
        Clear externally
      </button>
    </>
  );
}

describe("team builder autocomplete", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("clears the accepted identifier as soon as visible text diverges", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "Blaz" } });
    expect((input as HTMLInputElement).value).toBe("Blaz");
    expect(screen.getByTestId("value").textContent).toBe("empty");
  });

  it("does not restore a stale identifier on blur", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "Not an ability" } });
    fireEvent.blur(input);
    expect(screen.getByTestId("value").textContent).toBe("empty");
  });

  it("accepts with Enter and advances focus", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", { name: "Ability" });
    fireEvent.input(input, { target: { value: "Solar" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("value").textContent).toBe("solar-power");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "After" }),
    );
  });

  it("synchronizes a populated selection to blank when its owner clears it", () => {
    render(<ControlledAutocomplete />);
    const input = screen.getByRole("combobox", {
      name: "Ability",
    }) as HTMLInputElement;
    expect(input.value).toBe("Blaze");
    fireEvent.click(screen.getByRole("button", { name: "Clear externally" }));
    expect(input.value).toBe("");
  });

  it("clears an unaccepted nature identifier", () => {
    let nature: string | null = "serious";
    render(
      <Autocomplete
        inputId="nature"
        label="Nature"
        value={nature}
        choices={[{ id: "serious", name: "Serious" }]}
        onChange={(value) => {
          nature = value;
        }}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Nature" });
    fireEvent.input(input, { target: { value: "Tim" } });
    fireEvent.blur(input);
    expect(nature).toBeNull();
  });

  it("keeps rendering stats and an error when a member nature is null", () => {
    const member: Member = {
      position: 0,
      form_id: "charizard",
      nickname: "",
      ability_id: null,
      item_id: null,
      move_ids: [null, null, null, null],
      nature_id: null,
      sp: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      shiny: false,
      mega_preview: false,
    };
    const data = {
      schema_version: "team-builder-data-v1",
      data_version: "version-3",
      regulation: { id: "m-c", name: "Regulation M-C" },
      forms: [
        {
          id: "charizard",
          name: "Charizard",
          base_species_id: "charizard",
          types: [{ id: "fire", name: "Fire" }],
          ability_ids: [],
          move_ids: [],
          base_stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
          sprites: { normal: "/normal.webp", shiny: "/shiny.webp" },
        },
      ],
      types: [{ id: "fire", name: "Fire" }],
      abilities: [],
      moves: [],
      items: [],
      natures: [],
      mega_relations: [],
      mechanics: {
        level: 50,
        iv: 31,
        sp_min: 0,
        sp_max: 32,
        sp_total_max: 66,
        formula: "champions",
      },
    } satisfies BuilderData;
    render(
      <MemberEditor
        member={member}
        index={0}
        slot={0}
        data={data}
        allMembers={[member]}
        onChange={() => undefined}
        onRemove={() => undefined}
        onMove={() => null}
        serverErrors={{}}
        onAnnounce={() => undefined}
      />,
    );
    expect(screen.getByText("Choose a valid nature.")).toBeTruthy();
    expect(screen.getByText("153")).toBeTruthy();
  });
});
