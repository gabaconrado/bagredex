const toID = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const baseID = species => toID(species.baseSpecies || species.name);
const isMega = species => Boolean(species.forme?.includes('Mega'));

export const resolveLearnset = ({formID, table, moves, regulationID, pokedex, sourceFor}) => {
  const seen = new Set();
  const collected = new Map();
  const visit = (id, method) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const species = pokedex[id];
    const entry = table[id];
    for (const moveID of Object.keys(entry?.learnset || {}).sort()) {
      const move = moves[moveID];
      if (move && move.isNonstandard !== 'Past' && move.isNonstandard !== 'CAP' && !collected.has(moveID)) {
        collected.set(moveID, {
          form_resolution: method, source_form_id: id,
          ...sourceFor(regulationID, id, moveID),
        });
      }
    }
    if (entry?.learnset) return;
    if (species && baseID(species) !== id) {
      visit(toID(species.changesFrom) || baseID(species), isMega(species) ? 'base-to-mega' : 'changed-form');
      return;
    }
    if (species?.prevo && table[toID(species.prevo)]?.learnset) {
      visit(toID(species.prevo), 'pre-evolution');
    }
  };
  visit(formID, 'direct');
  return [...collected].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
};
