#!/usr/bin/env node

import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveLearnset} from './learnset-resolution.mjs';

const root = path.resolve(process.argv[2] || '');
if (!root) throw new Error('usage: node extract.mjs SHOWDOWN_ROOT');

const load = async (relative, name) => {
  const module = await import(pathToFileURL(path.join(root, relative)).href);
  if (!(name in module)) throw new Error(`${relative}: missing export ${name}`);
  const unknown = Object.keys(module).filter(value => value !== name);
  if (unknown.length) throw new Error(`${relative}: unexpected exports ${unknown.join(', ')}`);
  return module[name];
};
const toID = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const mergeEntry = (base, delta) => {
  if (!delta) return base ? {...base} : undefined;
  if (delta.inherit) {
    const result = {...base, ...delta};
    delete result.inherit;
    if (base?.learnset && delta.learnset) result.learnset = {...base.learnset, ...delta.learnset};
    return result;
  }
  return {...delta};
};
const mergeTable = (base, delta) => {
  const result = {};
  for (const id of new Set([...Object.keys(base), ...Object.keys(delta)])) {
    result[id] = mergeEntry(base[id], delta[id]);
  }
  return result;
};
const exactFormat = (formats, name, mod) => {
  const found = formats.filter(value => value?.name === name);
  if (found.length !== 1) throw new Error(`config/formats.ts: expected one exact format ${name}`);
  const format = found[0];
  if (format.mod !== mod || format.gameType !== 'doubles') {
    throw new Error(`config/formats.ts: unexpected shape for ${name}`);
  }
  return {name, showdown_format_id: toID(name), mod, ruleset: [...format.ruleset]};
};

const [pokedex, baseMoves, baseAbilities, baseLearnsets, movesText, abilitiesText, formats,
  championsFormats, championsMovesDelta, championsAbilitiesDelta, championsLearnsetsDelta,
  mbFormats, mbMovesDelta, mbLearnsetsDelta] = await Promise.all([
  load('data/pokedex.ts', 'Pokedex'),
  load('data/moves.ts', 'Moves'),
  load('data/abilities.ts', 'Abilities'),
  load('data/learnsets.ts', 'Learnsets'),
  load('data/text/moves.ts', 'MovesText'),
  load('data/text/abilities.ts', 'AbilitiesText'),
  load('config/formats.ts', 'Formats'),
  load('data/mods/champions/formats-data.ts', 'FormatsData'),
  load('data/mods/champions/moves.ts', 'Moves'),
  load('data/mods/champions/abilities.ts', 'Abilities'),
  load('data/mods/champions/learnsets.ts', 'Learnsets'),
  load('data/mods/championsregmb/formats-data.ts', 'FormatsData'),
  load('data/mods/championsregmb/moves.ts', 'Moves'),
  load('data/mods/championsregmb/learnsets.ts', 'Learnsets'),
]);

const championsMoves = mergeTable(baseMoves, championsMovesDelta);
const championsAbilities = mergeTable(baseAbilities, championsAbilitiesDelta);
const championsLearnsets = mergeTable(baseLearnsets, championsLearnsetsDelta);
const mbMoves = mergeTable(championsMoves, mbMovesDelta);
const mbLearnsets = mergeTable(championsLearnsets, mbLearnsetsDelta);
const configurations = [
  {
    id: 'm-c', mod: 'champions', formats: championsFormats, moves: championsMoves,
    abilities: championsAbilities, learnsets: championsLearnsets,
    format: exactFormat(formats, '[Gen 9 Champions] VGC 2026 Reg M-C', 'champions'),
  },
  {
    id: 'm-b', mod: 'championsregmb', formats: mbFormats, moves: mbMoves,
    abilities: championsAbilities, learnsets: mbLearnsets,
    format: exactFormat(formats, '[Gen 9 Champions] VGC 2026 Reg M-B', 'championsregmb'),
  },
];

const legalIDs = config => Object.entries(config.formats)
  .filter(([, value]) => value.tier !== 'Illegal' && value.isNonstandard !== 'Past')
  .map(([id]) => id).sort();
const isMega = species => Boolean(species.forme?.includes('Mega'));
const baseID = species => toID(species.baseSpecies || species.name);
const spriteID = species => species.spriteid ||
  (toID(species.baseSpecies || species.name) + ((species.baseSpecies || species.name) !== species.name ? `-${toID(species.forme)}` : ''));

const selected = new Set();
for (const config of configurations) for (const id of legalIDs(config)) selected.add(id);
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
    if (pokedex[otherID] && isMega(pokedex[otherID]) && !selected.has(otherID)) {
      selected.add(otherID);
      pending.push(otherID);
    }
  }
}

const forms = [...selected].sort().map(id => {
  const species = pokedex[id];
  if (!species || !Number.isInteger(species.num) || species.num <= 0) {
    throw new Error(`data/pokedex.ts: selected form ${id} lacks a positive National Dex number`);
  }
  return {
    id, name: species.name, national_dex_number: species.num,
    base_form_id: baseID(species), form_label: species.forme || '',
    is_mega: isMega(species), sprite_id: spriteID(species),
  };
});

const learnsetSource = (regulationID, formID, moveID) => {
  if (regulationID === 'm-b' && mbLearnsetsDelta[formID]) {
    if (Object.hasOwn(mbLearnsetsDelta[formID].learnset || {}, moveID) || !mbLearnsetsDelta[formID].inherit) {
      return {source_mod: 'championsregmb', source_kind: 'override'};
    }
  }
  if (championsLearnsetsDelta[formID]) {
    if (Object.hasOwn(championsLearnsetsDelta[formID].learnset || {}, moveID) || !championsLearnsetsDelta[formID].inherit) {
      return {source_mod: 'champions', source_kind: regulationID === 'm-b' ? 'inherited' : 'direct'};
    }
  }
  return {source_mod: 'base', source_kind: 'inherited'};
};
const output = {
  source_counts: {
    pokedex: Object.keys(pokedex).length,
    base_moves: Object.keys(baseMoves).length,
    base_abilities: Object.keys(baseAbilities).length,
    base_learnsets: Object.keys(baseLearnsets).length,
    champions_format_entries: Object.keys(championsFormats).length,
    championsregmb_format_entries: Object.keys(mbFormats).length,
  },
  formats: configurations.map(value => ({id: value.id, ...value.format})), forms, regulations: {},
};
for (const config of configurations) {
  const profiles = [];
  const learnsets = [];
  const abilityIDs = new Set();
  const moveIDs = new Set();
  const memberships = legalIDs(config).map(form_id => ({form_id}));
  for (const id of [...selected].sort()) {
    const species = pokedex[id];
    const abilities = Object.entries(species.abilities || {})
      .map(([slot, name]) => ({slot, ability_id: toID(name)}))
      .sort((a, b) => compareText(a.slot, b.slot));
    abilities.forEach(value => abilityIDs.add(value.ability_id));
    profiles.push({
      form_id: id, stats: species.baseStats, bst: Object.values(species.baseStats).reduce((a, b) => a + b, 0),
      types: [...species.types], abilities,
    });
    for (const [moveID, provenance] of resolveLearnset({
      formID: id, table: config.learnsets, moves: config.moves, regulationID: config.id,
      pokedex, sourceFor: learnsetSource,
    })) {
      moveIDs.add(moveID);
      learnsets.push({form_id: id, move_id: moveID, ...provenance});
    }
  }
  const abilities = [...abilityIDs].sort().map(id => {
    const value = config.abilities[id];
    if (!value) throw new Error(`${config.mod}: ability ${id} is missing`);
    const text = abilitiesText[id] || {};
    return {
      id, name: value.name, short_description: text.shortDesc || '',
      description: text.desc || text.shortDesc || '',
    };
  });
  const moves = [...moveIDs].sort().map(id => {
    const value = config.moves[id];
    if (!value) throw new Error(`${config.mod}: move ${id} is missing`);
    const text = movesText[id] || {};
    return {
      id, name: value.name, type: value.type, category: value.category,
      base_power: value.basePower, accuracy: value.accuracy === true ? 'always' : value.accuracy,
      pp: Math.min(value.pp, 20), priority: value.priority || 0, target: value.target,
      short_description: text.shortDesc || '', description: text.desc || text.shortDesc || '',
      flags: Object.keys(value.flags || {}).filter(flag => value.flags[flag]).sort(),
    };
  });
  output.regulations[config.id] = {memberships, profiles, abilities, moves, learnsets};
}

output.mega_relations = forms.filter(value => value.is_mega).map(value => ({
  base_form_id: value.base_form_id, mega_form_id: value.id,
})).sort((a, b) => compareText(a.mega_form_id, b.mega_form_id));
process.stdout.write(`${JSON.stringify(output)}\n`);
