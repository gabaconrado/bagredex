import { describe, expect, it } from "vitest";
import { parsePokemonSearchEntries, searchEntryForForm } from "./form-search";

const forms = [
  { id: "castform", is_mega: false },
  { id: "castformrainy", is_mega: false },
  { id: "meowstic", is_mega: false },
  { id: "meowsticf", is_mega: false },
  { id: "mega", is_mega: true },
];

describe("Pokémon search entry contracts", () => {
  it("keeps grouped forms and separate Meowstic identities server-driven", () => {
    const entries = parsePokemonSearchEntries(
      [
        {
          form_id: "castform",
          name: "Castform",
          form_group: {
            label: "Form",
            options: [
              { id: "castform", label: "Castform" },
              { id: "castformrainy", label: "Rainy" },
            ],
          },
        },
        { form_id: "meowstic", name: "Meowstic-Male", form_group: null },
        { form_id: "meowsticf", name: "Meowstic-Female", form_group: null },
      ],
      forms,
    );
    expect(entries.map(({ name }) => name)).toEqual([
      "Castform",
      "Meowstic-Male",
      "Meowstic-Female",
    ]);
    expect(searchEntryForForm(entries, "castformrainy")?.name).toBe("Castform");
  });

  it("rejects dangling, duplicate, omitted-representative, and Mega options", () => {
    const grouped = (options: { id: string; label: string }[]) => [
      {
        form_id: "castform",
        name: "Castform",
        form_group: { label: "Form", options },
      },
    ];
    expect(() =>
      parsePokemonSearchEntries(
        grouped([
          { id: "castform", label: "Castform" },
          { id: "missing", label: "Missing" },
        ]),
        forms,
      ),
    ).toThrow(/reference/);
    expect(() =>
      parsePokemonSearchEntries(
        grouped([
          { id: "castform", label: "Castform" },
          { id: "castform", label: "Again" },
        ]),
        forms,
      ),
    ).toThrow(/option/);
    expect(() =>
      parsePokemonSearchEntries(
        grouped([
          { id: "castformrainy", label: "Rainy" },
          { id: "meowstic", label: "Male" },
        ]),
        forms,
      ),
    ).toThrow(/representative/);
    expect(() =>
      parsePokemonSearchEntries(
        grouped([
          { id: "castform", label: "Castform" },
          { id: "mega", label: "Mega" },
        ]),
        forms,
      ),
    ).toThrow(/reference/);
    expect(() =>
      parsePokemonSearchEntries(
        [
          { form_id: "meowstic", name: "Meowstic-Male", form_group: null },
          {
            form_id: "meowsticf",
            name: "Meowstic-Female",
            form_group: null,
          },
        ],
        forms,
      ),
    ).toThrow(/cover canonical forms/);
  });
});
