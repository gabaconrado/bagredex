import { isStandardFormatsEntry } from "./legality.mjs";

const toID = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const isMega = (species) => Boolean(species?.forme?.includes("Mega"));
const baseID = (species) => toID(species?.baseSpecies || species?.name);

const fixedSex = (species, context) => {
  if (!species || typeof species !== "object" || Array.isArray(species)) {
    throw new TypeError(`${context}: expected a Pokédex object`);
  }
  return ["M", "F"].includes(species.gender) ? species.gender : null;
};

export const resolveRegulationMemberships = (
  formats,
  pokedex,
  context = "FormatsData",
) => {
  if (!formats || typeof formats !== "object" || Array.isArray(formats)) {
    throw new TypeError(`${context}: expected an object`);
  }
  if (!pokedex || typeof pokedex !== "object" || Array.isArray(pokedex)) {
    throw new TypeError("data/pokedex.ts: expected an object");
  }

  const directIDs = Object.entries(formats)
    .filter(([id, value]) => isStandardFormatsEntry(value, `${context} ${id}`))
    .map(([id]) => id)
    .sort();
  const direct = new Set(directIDs);
  const derived = new Set();
  const result = directIDs.map((formID) => ({
    form_id: formID,
    resolution: "direct",
    source_form_id: formID,
  }));

  for (const sourceID of directIDs) {
    const source = pokedex[sourceID];
    if (!source)
      throw new Error(`data/pokedex.ts: legal form ${sourceID} is missing`);
    const sourceSex = fixedSex(source, `data/pokedex.ts ${sourceID}`);
    if (!sourceSex || isMega(source)) continue;
    const base = pokedex[baseID(source)];
    if (!base) {
      throw new Error(
        `data/pokedex.ts: legal form ${sourceID} has a missing base species`,
      );
    }

    for (const relatedName of base.otherFormes || source.otherFormes || []) {
      const relatedID = toID(relatedName);
      if (direct.has(relatedID)) continue;
      const related = pokedex[relatedID];
      if (!related) {
        throw new Error(
          `data/pokedex.ts: ${sourceID} related form ${relatedID} is missing`,
        );
      }
      const relatedSex = fixedSex(related, `data/pokedex.ts ${relatedID}`);
      if (!relatedSex || relatedSex === sourceSex || isMega(related)) continue;
      if (baseID(related) !== baseID(source)) continue;

      if (Object.hasOwn(formats, relatedID)) {
        const targetIsLegal = isStandardFormatsEntry(
          formats[relatedID],
          `${context} ${relatedID}`,
        );
        if (!targetIsLegal) continue;
        throw new Error(
          `${context} ${relatedID}: standard related form was not directly selected`,
        );
      }
      if (derived.has(relatedID)) {
        throw new Error(
          `${context}: duplicate related fixed-sex form ${relatedID}`,
        );
      }
      derived.add(relatedID);
      result.push({
        form_id: relatedID,
        resolution: "related-fixed-sex",
        source_form_id: sourceID,
      });
    }
  }

  return result.sort((left, right) =>
    left.form_id < right.form_id ? -1 : left.form_id > right.form_id ? 1 : 0,
  );
};
