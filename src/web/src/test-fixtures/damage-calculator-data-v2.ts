import fixture from "../../../data/fixtures/damage-calculator-data-v1.json";

export const damageCalculatorDataV2 = {
  ...fixture,
  schema_version: "damage-calculator-data-v3",
  pokemon_search_entries: fixture.forms
    .filter((form) => form.searchable && !form.is_mega)
    .map((form) => ({
      form_id: form.id,
      name: form.name,
      form_group: null,
    })),
  forms: fixture.forms.map(({ searchable: _searchable, ...form }) => form),
  moves: fixture.moves.map((move) => ({
    ...move,
    description: `${move.name} full description.`,
  })),
};
