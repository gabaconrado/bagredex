const STAT_CALLBACKS = [
  ["atk", "onModifyAtk"],
  ["def", "onModifyDef"],
  ["spa", "onModifySpA"],
  ["spd", "onModifySpD"],
  ["spe", "onModifySpe"],
];

const modifierFraction = (source) => {
  const array = source.match(/this\.chainModify\(\[(\d+),\s*(\d+)\]\)/);
  if (array) return [Number(array[1]), Number(array[2])];
  const decimal = source.match(/this\.chainModify\((\d+(?:\.\d+)?)\)/);
  if (!decimal) return null;
  return [Math.trunc(Number(decimal[1]) * 4096), 4096];
};

export const itemStatModifiers = (value) =>
  STAT_CALLBACKS.flatMap(([stat, callback]) => {
    const handler = value[callback];
    if (typeof handler !== "function") return [];
    const source = handler.toString().replace(/\s+/g, " ").trim();
    const fraction = modifierFraction(source);
    if (!fraction) return [];
    const always =
      /^\w+\([^)]*\) \{ (?:if \(pokemon\.volatiles\['dynamax'\]\) return; )?return this\.chainModify\((?:\[[0-9]+,\s*[0-9]+\]|[0-9]+(?:\.[0-9]+)?)\); \}$/.test(
        source,
      );
    const formIsNfe =
      /^\w+\([^)]*\) \{ if \(pokemon\.baseSpecies\.nfe\) \{ return this\.chainModify\((?:\[[0-9]+,\s*[0-9]+\]|[0-9]+(?:\.[0-9]+)?)\); \} \}$/.test(
        source,
      );
    if (!always && !formIsNfe) return [];
    return [
      {
        stat,
        numerator: fraction[0],
        denominator: fraction[1],
        eligibility: formIsNfe ? "form_is_nfe" : "always",
      },
    ];
  });

export const heldItemSuppressingAbilities = (source) => {
  const abilities = new Set(
    [
      ...source.matchAll(
        /return !this\.getItem\(\)\.ignoreKlutz && this\.hasAbility\(['"]([a-z0-9]+)['"]\);/g,
      ),
    ].map((match) => match[1]),
  );
  if (abilities.size !== 1) {
    throw new Error("sim/pokemon.ts: unsupported held-item suppression shape");
  }
  return abilities;
};
