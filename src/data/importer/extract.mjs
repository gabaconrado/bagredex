#!/usr/bin/env node

import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {hasStandardStatus, isStandardFormatsEntry, selectRelatedFormIDs} from './legality.mjs';
import {resolveItemDescription} from './item-text.mjs';
import {resolveLearnset} from './learnset-resolution.mjs';

const root = path.resolve(process.argv[2] || '');
const requested = process.argv[3] || 'current';
if (!root) throw new Error('usage: node extract.mjs SHOWDOWN_ROOT');
if (!['current', 'm-a'].includes(requested)) throw new Error(`unsupported extraction ${requested}`);

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

const [pokedex, baseMoves, baseAbilities, baseItems, natures, baseLearnsets, typeChart, movesText, abilitiesText, itemsText, formats,
  championsFormats, championsMovesDelta, championsAbilitiesDelta, championsItemsDelta, championsLearnsetsDelta] = await Promise.all([
  load('data/pokedex.ts', 'Pokedex'),
  load('data/moves.ts', 'Moves'),
  load('data/abilities.ts', 'Abilities'),
  load('data/items.ts', 'Items'),
  load('data/natures.ts', 'Natures'),
  load('data/learnsets.ts', 'Learnsets'),
  load('data/typechart.ts', 'TypeChart'),
  load('data/text/moves.ts', 'MovesText'),
  load('data/text/abilities.ts', 'AbilitiesText'),
  load('data/text/items.ts', 'ItemsText'),
  load('config/formats.ts', 'Formats'),
  load('data/mods/champions/formats-data.ts', 'FormatsData'),
  load('data/mods/champions/moves.ts', 'Moves'),
  load('data/mods/champions/abilities.ts', 'Abilities'),
  load('data/mods/champions/items.ts', 'Items'),
  load('data/mods/champions/learnsets.ts', 'Learnsets'),
]);

const [mbFormats, mbMovesDelta, mbItemsDelta, mbLearnsetsDelta] = requested === 'current'
  ? await Promise.all([
    load('data/mods/championsregmb/formats-data.ts', 'FormatsData'),
    load('data/mods/championsregmb/moves.ts', 'Moves'),
    load('data/mods/championsregmb/items.ts', 'Items'),
    load('data/mods/championsregmb/learnsets.ts', 'Learnsets'),
  ]) : [{}, {}, {}, {}];

const championsMoves = mergeTable(baseMoves, championsMovesDelta);
const championsAbilities = mergeTable(baseAbilities, championsAbilitiesDelta);
const championsItems = mergeTable(baseItems, championsItemsDelta);
const championsLearnsets = mergeTable(baseLearnsets, championsLearnsetsDelta);
const mbMoves = mergeTable(championsMoves, mbMovesDelta);
const mbItems = mergeTable(championsItems, mbItemsDelta);
const mbLearnsets = mergeTable(championsLearnsets, mbLearnsetsDelta);
const configurations = requested === 'm-a' ? [
  {
    id: 'm-a', mod: 'champions', formats: championsFormats, moves: championsMoves,
    abilities: championsAbilities, items: championsItems, learnsets: championsLearnsets,
    format: exactFormat(formats, '[Gen 9 Champions] VGC 2026 Reg M-A', 'champions'),
  },
] : [
  {
    id: 'm-c', mod: 'champions', formats: championsFormats, moves: championsMoves,
    abilities: championsAbilities, items: championsItems, learnsets: championsLearnsets,
    format: exactFormat(formats, '[Gen 9 Champions] VGC 2026 Reg M-C', 'champions'),
  },
  {
    id: 'm-b', mod: 'championsregmb', formats: mbFormats, moves: mbMoves,
    abilities: championsAbilities, items: mbItems, learnsets: mbLearnsets,
    format: exactFormat(formats, '[Gen 9 Champions] VGC 2026 Reg M-B', 'championsregmb'),
  },
];

const legalIDs = config => Object.entries(config.formats)
  .filter(([id, value]) => isStandardFormatsEntry(value, `${config.mod} FormatsData ${id}`))
  .map(([id]) => id).sort();
const isMega = species => Boolean(species.forme?.includes('Mega'));
const baseID = species => toID(species.baseSpecies || species.name);
const spriteID = species => species.spriteid ||
  (toID(species.baseSpecies || species.name) + ((species.baseSpecies || species.name) !== species.name ? `-${toID(species.forme)}` : ''));

const context = (key, label, kind, defaultValue, minimum, maximum, choices) => ({
  key, label, kind, default: defaultValue,
  ...(minimum === undefined ? {} : {minimum}),
  ...(maximum === undefined ? {} : {maximum}),
  ...(choices === undefined ? {} : {choices}),
});
const BOOLEAN_CONTEXT = {
  ability_active: context('ability_active', 'Ability active', 'boolean', false),
  last_move_failed: context('last_move_failed', 'Last move failed', 'boolean', false),
  target_already_moved: context('target_already_moved', 'Target already moved', 'boolean', false),
  target_damaged: context('target_damaged', 'Target already damaged', 'boolean', false),
  damaged_by_target: context('damaged_by_target', 'Damaged by target', 'boolean', false),
  ally_used_round: context('ally_used_round', 'Ally used Round', 'boolean', false),
  ally_moves_later: context('ally_moves_later', 'Ally moves later', 'boolean', false),
};
const MOVE_CONTEXT = new Map([
  ['counter', [context('prior_damage_taken', 'Prior damage taken', 'integer', 0, 0, 65535)]],
  ['mirrorcoat', [context('prior_damage_taken', 'Prior damage taken', 'integer', 0, 0, 65535)]],
  ['comeuppance', [context('prior_damage_taken', 'Prior damage taken', 'integer', 0, 0, 65535)]],
  ['metalburst', [context('prior_damage_taken', 'Prior damage taken', 'integer', 0, 0, 65535)]],
  ['spitup', [context('stockpile_count', 'Stockpile count', 'integer', 1, 1, 3)]],
  ['beatup', [
    context('ally_1_base_attack', 'Ally 1 base Attack (0 if absent or ineligible)', 'integer', 0, 0, 255),
    context('ally_2_base_attack', 'Ally 2 base Attack (0 if absent or ineligible)', 'integer', 0, 0, 255),
    context('ally_3_base_attack', 'Ally 3 base Attack (0 if absent or ineligible)', 'integer', 0, 0, 255),
  ]],
  ['ragefist', [context('hits_taken', 'Hits taken', 'integer', 0, 0, 6)]],
  ['lastrespects', [context('allies_fainted', 'Allies fainted', 'integer', 0, 0, 5)]],
  ['stompingtantrum', [BOOLEAN_CONTEXT.last_move_failed]],
  ['temperflare', [BOOLEAN_CONTEXT.last_move_failed]],
  ['payback', [BOOLEAN_CONTEXT.target_already_moved]],
  ['boltbeak', [BOOLEAN_CONTEXT.target_already_moved]],
  ['fishiousrend', [BOOLEAN_CONTEXT.target_already_moved]],
  ['assurance', [BOOLEAN_CONTEXT.target_damaged]],
  ['round', [BOOLEAN_CONTEXT.ally_used_round]],
  ['avalanche', [BOOLEAN_CONTEXT.damaged_by_target]],
  ['revenge', [BOOLEAN_CONTEXT.damaged_by_target]],
  ['firepledge', [context('ally_pledge', 'Ally pledge', 'choice', '', undefined, undefined, ['', 'firepledge', 'waterpledge', 'grasspledge'])]],
  ['waterpledge', [context('ally_pledge', 'Ally pledge', 'choice', '', undefined, undefined, ['', 'firepledge', 'waterpledge', 'grasspledge'])]],
  ['grasspledge', [context('ally_pledge', 'Ally pledge', 'choice', '', undefined, undefined, ['', 'firepledge', 'waterpledge', 'grasspledge'])]],
]);
const ABILITY_ACTIVE_IDS = new Set([
  'flashfire', 'flowergift', 'hadronengine', 'intimidate', 'minus',
  'orichalcumpulse', 'plus', 'protosynthesis', 'quarkdrive', 'slowstart', 'stakeout',
  'stamina', 'unburden',
]);
const abilityContext = id => {
  const result = ABILITY_ACTIVE_IDS.has(id) ? [BOOLEAN_CONTEXT.ability_active] : [];
  if (id === 'analytic') result.push(BOOLEAN_CONTEXT.target_already_moved, BOOLEAN_CONTEXT.ally_moves_later);
  if (id === 'supremeoverlord') result.push(context('allies_fainted', 'Allies fainted', 'integer', 0, 0, 5));
  if (id === 'protosynthesis' || id === 'quarkdrive') {
    result.push(context('boosted_stat', 'Boosted stat', 'choice', 'auto', undefined, undefined, ['auto', 'atk', 'def', 'spa', 'spd', 'spe']));
  }
  return result;
};
const fraction = value => Array.isArray(value) && value.length === 2 ? [...value] : null;
const boosts = value => value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([, stages]) => Number.isInteger(stages)).sort(([a], [b]) => compareText(a, b)))
  : {};
const effect = value => value && typeof value === 'object' ? {
  chance: Number.isInteger(value.chance) ? value.chance : null,
  boosts: boosts(value.boosts),
  self_boosts: boosts(value.self?.boosts),
  status: value.status || null,
  volatile_status: value.volatileStatus || null,
} : null;
const calculationFacts = value => ({
  multihit: Array.isArray(value.multihit) ? [...value.multihit] : (Number.isInteger(value.multihit) ? value.multihit : null),
  multiaccuracy: Boolean(value.multiaccuracy),
  crit_ratio: Number.isInteger(value.critRatio) ? value.critRatio : 0,
  always_crit: Boolean(value.willCrit),
  drain: fraction(value.drain),
  recoil: fraction(value.recoil),
  crash_damage: Boolean(value.hasCrashDamage),
  mind_blown_recoil: Boolean(value.mindBlownRecoil),
  struggle_recoil: Boolean(value.struggleRecoil),
  ignore_defensive: Boolean(value.ignoreDefensive),
  override_defensive_stat: value.overrideDefensiveStat || null,
  breaks_protect: Boolean(value.breaksProtect),
  self: effect(value.self),
  self_boost: effect(value.selfBoost),
  secondary: effect(value.secondary),
  secondaries: Array.isArray(value.secondaries) ? value.secondaries.map(effect) : [],
});
const itemCalculationFacts = value => ({
  fling_base_power: Number.isInteger(value.fling?.basePower) ? value.fling.basePower : 0,
  natural_gift: value.naturalGift && Number.isInteger(value.naturalGift.basePower)
    ? {base_power: value.naturalGift.basePower, type_id: toID(value.naturalGift.type)} : null,
  plate_type_id: value.onPlate ? toID(value.onPlate) : null,
  drive_type_id: value.onDrive ? toID(value.onDrive) : null,
  memory_type_id: value.onMemory ? toID(value.onMemory) : null,
  mega_stone: Boolean(value.megaStone),
  damage_boost: (() => {
    const source = value.onBasePower?.toString() || '';
    const type = source.match(/move\.type === ['"]([A-Za-z]+)['"]/);
    const modifier = source.match(/chainModify\(\[(\d+),\s*(\d+)\]\)/);
    return type && modifier ? {type_id: toID(type[1]), numerator: Number(modifier[1]), denominator: Number(modifier[2])} : null;
  })(),
  damage_resist: (() => {
    const source = value.onSourceModifyDamage?.toString() || value.onDamagingHit?.toString() || '';
    const type = source.match(/move\.type === ['"]([A-Za-z]+)['"]/);
    return type ? {type_id: toID(type[1])} : null;
  })(),
});

const requestedFormIDs = (process.argv[4] || '').split(',').filter(Boolean);
const selected = new Set(requestedFormIDs.length
  ? requestedFormIDs
  : selectRelatedFormIDs(configurations.flatMap(legalIDs), pokedex));

const forms = [...selected].sort().map(id => {
  const species = pokedex[id];
  if (!species || !Number.isInteger(species.num) || species.num <= 0) {
    throw new Error(`data/pokedex.ts: selected form ${id} lacks a positive National Dex number`);
  }
  const gender = species.gender || 'variable';
  return {
    id, name: species.name, national_dex_number: species.num,
    base_form_id: baseID(species), form_label: species.forme || '',
    is_mega: isMega(species), is_nfe: Boolean(species.nfe),
    gender, gender_options: gender === 'variable' ? ['M', 'F'] : [gender],
    default_gender: gender === 'variable' ? 'M' : gender,
    sprite_id: spriteID(species),
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
    base_item_texts: Object.keys(itemsText).length,
    base_learnsets: Object.keys(baseLearnsets).length,
    champions_format_entries: Object.keys(championsFormats).length,
    championsregmb_format_entries: Object.keys(mbFormats).length,
  },
  formats: configurations.map(value => ({id: value.id, ...value.format})), forms,
  natures: Object.entries(natures).filter(([id, value]) => id === 'serious' || (value.plus && value.minus))
    .map(([id, value]) => ({
      id, name: value.name, increased_stat: value.plus || null, decreased_stat: value.minus || null,
    })).sort((a, b) => compareText(a.id, b.id)),
  regulations: {},
};
for (const config of configurations) {
  const profiles = [];
  const learnsets = [];
  const abilityIDs = new Set();
  const moveIDs = new Set();
  const items = Object.entries(config.items)
    .filter(([id, value]) => hasStandardStatus(value, `${config.mod} item ${id}`))
    .map(([id, value]) => ({
      id, name: value.name, source_status: 'standard',
      ...resolveItemDescription(itemsText[id], `${config.mod} item ${id}`),
      calculation: itemCalculationFacts(value),
      mega_stone: value.megaStone ? Object.entries(value.megaStone).map(([base, mega]) => ({
        base_form_id: toID(base), mega_form_id: toID(mega),
      })).sort((a, b) => compareText(a.base_form_id, b.base_form_id)) : [],
    })).sort((a, b) => compareText(a.id, b.id));
  const memberships = legalIDs(config).map(form_id => ({form_id}));
  for (const id of [...selected].sort()) {
    const species = pokedex[id];
    const abilities = Object.entries(species.abilities || {})
      .map(([slot, name]) => ({slot, ability_id: toID(name)}))
      .sort((a, b) => compareText(a.slot, b.slot));
    abilities.forEach(value => abilityIDs.add(value.ability_id));
    profiles.push({
      form_id: id, stats: species.baseStats, bst: Object.values(species.baseStats).reduce((a, b) => a + b, 0),
      types: [...species.types], abilities, weight_tenths_kg: Math.round(species.weightkg * 10),
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
      description: text.desc || text.shortDesc || '', contextual_inputs: abilityContext(id),
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
      calculation: calculationFacts(value), contextual_inputs: [
        ...(MOVE_CONTEXT.get(id) || []),
        ...(value.multihit ? [context('hits', 'Hits', 'integer', Array.isArray(value.multihit) ? value.multihit[0] + 1 : value.multihit,
          Array.isArray(value.multihit) ? value.multihit[0] : 1,
          Array.isArray(value.multihit) ? value.multihit[1] : value.multihit)] : []),
      ],
    };
  });
  output.regulations[config.id] = {memberships, profiles, abilities, moves, items, learnsets};
}

output.mega_relations = forms.filter(value => value.is_mega).map(value => ({
  base_form_id: value.base_form_id, mega_form_id: value.id,
})).sort((a, b) => compareText(a.mega_form_id, b.mega_form_id));
const selectedTypeNames = new Set(Object.values(output.regulations)
  .flatMap(value => value.profiles.flatMap(profile => profile.types)));
output.type_effectiveness = [...selectedTypeNames].sort().flatMap(defending => {
  const data = typeChart[toID(defending)]?.damageTaken;
  if (!data) throw new Error(`data/typechart.ts: missing defending type ${defending}`);
  return [...selectedTypeNames].sort().map(attacking => {
    const code = data[attacking];
    if (![0, 1, 2, 3].includes(code)) {
      throw new Error(`data/typechart.ts: invalid ${attacking} -> ${defending} code ${code}`);
    }
    return {
      attacking_type_id: toID(attacking), defending_type_id: toID(defending),
      multiplier_percent: [100, 200, 50, 0][code],
    };
  });
});
process.stdout.write(`${JSON.stringify(output)}\n`);
