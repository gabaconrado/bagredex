import fixture from "../../../data/fixtures/damage-calculator-data-v1.json";

export const damageCalculatorDataV2 = {
  ...fixture,
  schema_version: "damage-calculator-data-v2",
  moves: fixture.moves.map((move) => ({
    ...move,
    description: `${move.name} full description.`,
  })),
};
