export const hasStandardStatus = (entry, context = 'data entry') => {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError(`${context}: expected an object`);
  }
  return entry.isNonstandard === undefined || entry.isNonstandard === null ||
    entry.isNonstandard === false;
};

export const isStandardFormatsEntry = (entry, context = 'FormatsData entry') => {
  return hasStandardStatus(entry, context) && entry.tier !== 'Illegal';
};

const toID = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const isMega = species => Boolean(species.forme?.includes('Mega'));
const baseID = species => toID(species.baseSpecies || species.name);
const isOppositeSexForm = (base, candidate) =>
  !isMega(candidate) && ['M', 'F'].includes(base?.gender) &&
  ['M', 'F'].includes(candidate?.gender) && base.gender !== candidate.gender &&
  baseID(candidate) === toID(base.name);

export const selectRelatedFormIDs = (rootIDs, pokedex) => {
  const selected = new Set(rootIDs);
  const pending = [...selected];
  while (pending.length) {
    const id = pending.shift();
    const species = pokedex[id];
    if (!species) throw new Error(`data/pokedex.ts: legal form ${id} is missing`);
    const base = pokedex[baseID(species)];
    for (const relatedID of isMega(species) ? [baseID(species)] : []) {
      if (!selected.has(relatedID)) { selected.add(relatedID); pending.push(relatedID); }
    }
    for (const otherName of base?.otherFormes || species.otherFormes || []) {
      const otherID = toID(otherName);
      const other = pokedex[otherID];
      if (other && (isMega(other) || isOppositeSexForm(base, other)) &&
          !selected.has(otherID)) {
        selected.add(otherID);
        pending.push(otherID);
      }
    }
  }
  return [...selected].sort();
};
