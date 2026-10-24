/*
 * Damage formula adapted from VGC Multi Calc, MIT licensed.
 * Source revision: 166578cf88c4219dff7dbaa562b0a4e798b274f3.
 * Bagredex supplies all game data through its normalized Showdown dataset.
 */
import type {
  Ability,
  CalculatorData,
  Form,
  Item,
  Move,
  Nature,
  StatId,
  Stats,
} from "../contracts";
import { requireCoverage, requireDamageHandler } from "./handler-registry";
import {
  dispatchMechanic,
  traceAppliedMechanic,
  type MechanicTrace,
} from "./mechanics-handlers";

export type Combatant = {
  form: Form;
  gender: "M" | "F" | "N";
  nature: Nature;
  ability?: Ability;
  item?: Item;
  sp: Stats;
  stages: Record<"atk" | "def" | "spa" | "spd" | "spe", number>;
  status: string;
  currentHp: number;
  context: Record<string, boolean | number | string>;
};
export type Field = {
  weather: string;
  terrain: string;
  attacker: {
    helpingHand: boolean;
    singleTarget: boolean;
    critical: boolean;
    tailwind: boolean;
  };
  defender: {
    reflect: boolean;
    lightScreen: boolean;
    auroraVeil: boolean;
    friendGuard: boolean;
    tailwind: boolean;
  };
};
export type DamageResult = {
  rolls: number[];
  compact: string;
  description: string;
  reason?: string;
};

export const statIds: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];
export function stats(
  combatant: Pick<Combatant, "form" | "nature" | "sp">,
): Stats {
  const result = {} as Stats;
  for (const id of statIds) {
    const raw =
      id === "hp"
        ? combatant.form.base_stats[id] + combatant.sp[id] + 75
        : combatant.form.base_stats[id] + combatant.sp[id] + 20;
    const nature =
      combatant.nature.increased_stat === id
        ? 110
        : combatant.nature.decreased_stat === id
          ? 90
          : 100;
    result[id] = id === "hp" ? raw : Math.floor((raw * nature) / 100);
  }
  return result;
}
export const applyBattleStage = (value: number, amount: number) =>
  amount >= 0
    ? Math.floor((value * (2 + amount)) / 2)
    : Math.floor((value * 2) / (2 - amount));
export const pokeRound = (value: number) =>
  value % 1 > 0.5 ? Math.ceil(value) : Math.floor(value);
export const overflow16 = (value: number) =>
  value > 65535 ? value % 65536 : value;
export const overflow32 = (value: number) =>
  value > 4294967295 ? value % 4294967296 : value;
export const chainMods = (
  mods: number[],
  lowerBound = 0,
  upperBound = 4294967296,
) => {
  const chained = mods.reduce(
    (value, modifier) =>
      modifier === 4096 ? value : (value * modifier + 2048) >> 12,
    4096,
  );
  return Math.max(lowerBound, Math.min(chained, upperBound));
};
export const applyMod = (value: number, modifier: number) =>
  pokeRound(overflow32(value * modifier) / 4096);
const fractionMod = (numerator: number, denominator: number) =>
  pokeRound((4096 * numerator) / denominator);
const spread = (move: Move) =>
  ["allAdjacent", "allAdjacentFoes"].includes(move.target);
const grounded = (combatant: Combatant) =>
  activeItem(combatant)?.id !== "airballoon" &&
  (activeItem(combatant)?.id === "ironball" ||
    (!combatant.form.types.includes("flying") &&
      combatant.ability?.id !== "levitate"));
const hpRatioOf = (combatant: Combatant) =>
  combatant.currentHp / Math.max(1, stats(combatant).hp);
const activeItem = (combatant: Combatant) =>
  combatant.ability?.id === "klutz" ? undefined : combatant.item;
const highestNonHpStat = (combatant: Combatant, values: Stats) =>
  (["atk", "def", "spa", "spd", "spe"] as const).reduce((best, id) =>
    values[id] > values[best] ? id : best,
  );
export function calculate(
  data: CalculatorData,
  attacker: Combatant,
  defender: Combatant,
  move: Move,
  field: Field,
  mechanicTrace?: MechanicTrace,
): DamageResult {
  requireDamageHandler("core-formula");
  if (attacker.ability) {
    requireCoverage("ability", attacker.ability.id);
    dispatchMechanic("ability", attacker.ability.id, mechanicTrace);
  }
  if (defender.ability) {
    requireCoverage("ability", defender.ability.id);
    dispatchMechanic("ability", defender.ability.id, mechanicTrace);
  }
  if (attacker.item) {
    requireCoverage("item", attacker.item.id);
    dispatchMechanic("item", attacker.item.id, mechanicTrace);
  }
  if (defender.item) {
    requireCoverage("item", defender.item.id);
    dispatchMechanic("item", defender.item.id, mechanicTrace);
  }
  if (requireCoverage("move", move.id, true))
    dispatchMechanic("move", move.id, mechanicTrace);
  for (const key of Object.keys(attacker.context)) {
    for (const owner of [move.id, attacker.ability?.id, attacker.item?.id]) {
      if (owner && requireCoverage("context", `${owner}:${key}`, true))
        dispatchMechanic("context", `${owner}:${key}`, mechanicTrace);
    }
  }
  if (move.category === "Status")
    return noDamage(
      `${move.name} is a status move and deals no direct damage.`,
    );
  const effectiveWeather =
    attacker.ability?.id === "megasol"
      ? "sun"
      : [attacker.ability?.id, defender.ability?.id].some((id) =>
            ["cloudnine", "airlock"].includes(id ?? ""),
          )
        ? ""
        : field.weather;
  const forecastType: Record<string, string> = {
    sun: "fire",
    rain: "water",
    snow: "ice",
  };
  if (attacker.ability?.id === "forecast" && attacker.form.id === "castform") {
    attacker = {
      ...attacker,
      form: {
        ...attacker.form,
        types: [forecastType[effectiveWeather] ?? "normal"],
      },
    };
  }
  if (defender.ability?.id === "forecast" && defender.form.id === "castform") {
    defender = {
      ...defender,
      form: {
        ...defender.form,
        types: [forecastType[effectiveWeather] ?? "normal"],
      },
    };
  }
  const originalMove = move;
  const ateType: Record<string, string> = {
    aerilate: "flying",
    dragonize: "dragon",
    pixilate: "fairy",
    refrigerate: "ice",
  };
  const convertedType = ateType[attacker.ability?.id ?? ""];
  if (move.type_id === "normal" && convertedType) {
    move = { ...move, type_id: convertedType };
  }
  if (attacker.ability?.id === "liquidvoice" && move.flags.includes("sound")) {
    move = { ...move, type_id: "water" };
  }
  if (move.id === "weatherball" && effectiveWeather) {
    traceAppliedMechanic(mechanicTrace, "move", move.id);
    const weatherType: Record<string, string> = {
      sun: "fire",
      rain: "water",
      sand: "rock",
      snow: "ice",
    };
    move = {
      ...move,
      type_id: weatherType[effectiveWeather] ?? move.type_id,
      base_power: move.base_power * 2,
    };
  }
  if (move.id === "terrainpulse" && field.terrain && grounded(attacker)) {
    traceAppliedMechanic(mechanicTrace, "move", move.id);
    const terrainType: Record<string, string> = {
      electric: "electric",
      grassy: "grass",
      psychic: "psychic",
      misty: "fairy",
    };
    move = {
      ...move,
      type_id: terrainType[field.terrain] ?? move.type_id,
      base_power: move.base_power * 2,
    };
  }
  if (move.id === "poltergeist" && !defender.item)
    return noDamage(`${move.name} fails because the target has no item.`);
  if (move.id === "steelroller" && !field.terrain)
    return noDamage(`${move.name} fails because no terrain is active.`);
  if (move.id === "shellsidearm") {
    traceAppliedMechanic(mechanicTrace, "move", move.id);
    const attackerStats = stats(attacker);
    const defenderStats = stats(defender);
    move = {
      ...move,
      category:
        attackerStats.atk / Math.max(1, defenderStats.def) >
        attackerStats.spa / Math.max(1, defenderStats.spd)
          ? "Physical"
          : "Special",
    };
  }
  if (move.id === "aurawheel") {
    traceAppliedMechanic(mechanicTrace, "move", move.id);
    move = {
      ...move,
      type_id: attacker.form.id.includes("hangry") ? "dark" : "electric",
    };
  }
  if (
    attacker.ability?.id === "galewings" &&
    move.type_id === "flying" &&
    attacker.currentHp === stats(attacker).hp
  )
    move = { ...move, priority: Math.max(1, move.priority) };
  if (move.id === "beatup" && move.base_power === 0) {
    traceAppliedMechanic(mechanicTrace, "move", move.id);
    for (const index of [1, 2, 3])
      if (Number(attacker.context[`ally_${index}_base_attack`] ?? 0) > 0)
        traceAppliedMechanic(
          mechanicTrace,
          "context",
          `beatup:ally_${index}_base_attack`,
        );
    const contributors = [
      attacker.form.base_stats.atk,
      ...[1, 2, 3]
        .map((index) =>
          Number(attacker.context[`ally_${index}_base_attack`] ?? 0),
        )
        .filter((value) => value > 0),
    ];
    const rolls = calculateHitSequence(
      data,
      attacker,
      defender,
      move,
      contributors.map((baseAttack) => Math.floor(baseAttack / 10) + 5),
      field,
    );
    return damageResult(attacker, defender, move, rolls, stats(defender).hp);
  }
  if (
    move.id !== "tripleaxel" &&
    move.calculation.multihit !== null &&
    move.calculation.multihit !== undefined
  ) {
    const maximum = Array.isArray(move.calculation.multihit)
      ? Number(move.calculation.multihit[1])
      : Number(move.calculation.multihit);
    const hits = Math.max(
      1,
      Math.min(maximum, Number(attacker.context.hits ?? maximum)),
    );
    traceAppliedMechanic(mechanicTrace, "context", `${move.id}:hits`);
    const rolls = calculateHitSequence(
      data,
      attacker,
      defender,
      move,
      Array(hits).fill(move.base_power),
      field,
    );
    return damageResult(attacker, defender, move, rolls, stats(defender).hp);
  }
  if (
    move.id === "tripleaxel" &&
    move.calculation.multihit !== null &&
    move.calculation.multihit !== undefined
  ) {
    traceAppliedMechanic(mechanicTrace, "move", move.id);
    traceAppliedMechanic(mechanicTrace, "context", `${move.id}:hits`);
    const hits = Math.max(1, Math.min(3, Number(attacker.context.hits ?? 3)));
    const rolls = calculateHitSequence(
      data,
      attacker,
      defender,
      move,
      Array.from({ length: hits }, (_, index) => move.base_power * (index + 1)),
      field,
    );
    return damageResult(attacker, defender, move, rolls, stats(defender).hp);
  }
  if (
    attacker.ability?.id === "parentalbond" &&
    !attacker.context.parental_child &&
    !spread(move)
  ) {
    traceAppliedMechanic(mechanicTrace, "ability", "parentalbond");
    const parent = calculate(
      data,
      { ...attacker, ability: undefined },
      defender,
      move,
      field,
    );
    const rolls = parent.rolls.map((firstDamage, roll) => {
      const reaction =
        defender.ability?.id === "stamina"
          ? 1
          : defender.ability?.id === "weakarmor" && move.category === "Physical"
            ? -1
            : 0;
      const secondaryDefense = [
        move.calculation.secondary,
        ...(Array.isArray(move.calculation.secondaries)
          ? move.calculation.secondaries
          : []),
      ].reduce((sum, effect) => {
        const row = effect as {
          chance?: number | null;
          boosts?: Record<string, number>;
        } | null;
        return (
          sum +
          (row && (row.chance === null || row.chance === 100)
            ? Number(row.boosts?.def ?? 0)
            : 0)
        );
      }, 0);
      const childDefender: Combatant = {
        ...defender,
        currentHp: Math.max(0, defender.currentHp - firstDamage),
        item: defender.item?.calculation.damage_resist
          ? undefined
          : defender.item,
        stages: {
          ...defender.stages,
          def: Math.max(
            -6,
            Math.min(6, defender.stages.def + reaction + secondaryDefense),
          ),
        },
      };
      const child = calculate(
        data,
        {
          ...attacker,
          ability: undefined,
          context: {
            ...attacker.context,
            parental_child: true,
            target_damaged: true,
          },
        },
        childDefender,
        move,
        field,
      );
      const childDamage = child.rolls[roll] ?? 0;
      return (
        firstDamage +
        (move.base_power === 0
          ? childDamage
          : Math.max(1, applyMod(childDamage, 1024)))
      );
    });
    return damageResult(attacker, defender, move, rolls, stats(defender).hp);
  }
  const typeRows = new Map(
    data.type_effectiveness.map((row) => [
      `${row.attacking_type_id}:${row.defending_type_id}`,
      row.multiplier_percent / 100,
    ]),
  );
  let effectiveness = 1;
  for (const type of defender.form.types) {
    const value =
      attacker.ability?.id === "scrappy" &&
      type === "ghost" &&
      ["normal", "fighting"].includes(move.type_id)
        ? 1
        : typeRows.get(`${move.type_id}:${type}`);
    if (value === undefined)
      return noDamage(
        "Calculation unavailable: missing type effectiveness data.",
      );
    effectiveness *= move.id === "freezedry" && type === "water" ? 2 : value;
  }
  if (move.id === "flyingpress") {
    for (const type of defender.form.types) {
      const flying = typeRows.get(`flying:${type}`);
      if (flying === undefined)
        return noDamage(
          "Calculation unavailable: missing type effectiveness data.",
        );
      effectiveness *= flying;
    }
  }
  const breaksAbilities = ["moldbreaker", "teravolt", "turboblaze"].includes(
    attacker.ability?.id ?? "",
  );
  const immunity = breaksAbilities ? null : abilityImmunity(defender, move);
  if (immunity)
    return noDamage(`${defender.form.name} is immune: ${immunity}.`);
  if (effectiveness === 0)
    return noDamage(`${defender.form.name} is immune to ${move.name}.`);
  if (
    !breaksAbilities &&
    defender.ability?.id === "wonderguard" &&
    effectiveness <= 1
  )
    return noDamage(`${defender.form.name} is immune: Wonder Guard.`);
  const attackId = move.category === "Physical" ? "atk" : "spa";
  const defenseId = move.category === "Physical" ? "def" : "spd";
  const attackerStats = stats(attacker);
  const defenderStats = stats(defender);
  const requestedCritical =
    field.attacker.critical ||
    Boolean(move.calculation.always_crit) ||
    (attacker.ability?.id === "merciless" &&
      ["psn", "tox"].includes(defender.status));
  const critical =
    requestedCritical &&
    !["battlearmor", "shellarmor"].includes(defender.ability?.id ?? "");
  const source = move.id === "foulplay" ? defender : attacker;
  const sourceStats = move.id === "foulplay" ? defenderStats : attackerStats;
  const sourceAttackId = move.id === "bodypress" ? "def" : attackId;
  const rawAttackStage =
    source.stages[sourceAttackId] +
    (source === attacker &&
    sourceAttackId === "spa" &&
    ["electroshot", "meteorbeam"].includes(move.id)
      ? 1
      : 0);
  const attackStage =
    defender.ability?.id === "unaware"
      ? 0
      : critical
        ? Math.max(0, rawAttackStage)
        : rawAttackStage;
  const defenseStage = critical
    ? Math.min(0, defender.stages[defenseId])
    : defender.stages[defenseId];
  let attack = applyBattleStage(sourceStats[sourceAttackId], attackStage);
  const overriddenDefense = move.calculation.override_defensive_stat;
  const actualDefenseId =
    overriddenDefense === "def" || overriddenDefense === "spd"
      ? overriddenDefense
      : defenseId;
  let defense = Math.max(
    1,
    applyBattleStage(
      defenderStats[actualDefenseId],
      move.calculation.ignore_defensive || attacker.ability?.id === "unaware"
        ? 0
        : actualDefenseId === defenseId
          ? defenseStage
          : defender.stages[actualDefenseId],
    ),
  );
  if (
    ["hugepower", "purepower"].includes(attacker.ability?.id ?? "") &&
    attackId === "atk"
  )
    attack *= 2;
  if (attacker.ability?.id === "guts" && attackId === "atk" && attacker.status)
    attack = applyMod(attack, 6144);
  if (
    attacker.ability?.id === "solarpower" &&
    attackId === "spa" &&
    effectiveWeather === "sun"
  )
    attack = applyMod(attack, 6144);
  if (attacker.ability?.id === "hustle" && move.category === "Physical")
    attack = applyMod(attack, 6144);
  if (
    (attacker.ability?.id === "slowstart" &&
      attacker.context.ability_active &&
      move.category === "Physical") ||
    (attacker.ability?.id === "defeatist" && hpRatioOf(attacker) <= 0.5)
  )
    attack = applyMod(attack, 2048);
  if (attacker.ability?.id === "gorillatactics" && move.category === "Physical")
    attack = applyMod(attack, 6144);
  const attackMods: number[] = [];
  if (attacker.ability?.id === "stakeout" && attacker.context.ability_active)
    attackMods.push(8192);
  if (
    ["plus", "minus"].includes(attacker.ability?.id ?? "") &&
    attacker.context.ability_active
  )
    attackMods.push(6144);
  if (
    activeItem(attacker)?.id === "lightball" &&
    attacker.form.id.startsWith("pikachu")
  )
    attackMods.push(8192);
  if (
    activeItem(attacker)?.id === "thickclub" &&
    (attacker.form.id.startsWith("cubone") ||
      attacker.form.id.startsWith("marowak")) &&
    attackId === "atk"
  )
    attackMods.push(8192);
  if (
    activeItem(attacker)?.id === "deepseatooth" &&
    attacker.form.id.startsWith("clamperl") &&
    attackId === "spa"
  )
    attackMods.push(8192);
  if (
    (attacker.ability?.id === "hadronengine" &&
      field.terrain === "electric" &&
      attackId === "spa") ||
    (attacker.ability?.id === "orichalcumpulse" &&
      effectiveWeather === "sun" &&
      attackId === "atk")
  )
    attackMods.push(5461);
  if (
    (activeItem(attacker)?.id === "boosterenergy" ||
      (attacker.ability?.id === "quarkdrive" && field.terrain === "electric") ||
      (attacker.ability?.id === "protosynthesis" &&
        effectiveWeather === "sun")) &&
    ["quarkdrive", "protosynthesis"].includes(attacker.ability?.id ?? "") &&
    highestNonHpStat(attacker, attackerStats) === attackId
  )
    attackMods.push(5325);
  if (
    (activeItem(attacker)?.id === "muscleband" &&
      move.category === "Physical") ||
    (activeItem(attacker)?.id === "wiseglasses" && move.category === "Special")
  )
    attackMods.push(4506);
  if (
    attacker.ability?.id === "flashfire" &&
    attacker.context.ability_active &&
    move.type_id === "fire"
  )
    attackMods.push(6144);
  if (defender.ability?.id === "furcoat" && defenseId === "def") defense *= 2;
  if (
    defender.ability?.id === "marvelscale" &&
    defender.status &&
    defenseId === "def"
  )
    defense = applyMod(defense, 6144);
  if (
    defender.ability?.id === "grasspelt" &&
    field.terrain === "grassy" &&
    defenseId === "def"
  )
    defense = applyMod(defense, 6144);
  if (
    effectiveWeather === "sand" &&
    defender.form.types.includes("rock") &&
    defenseId === "spd"
  )
    defense = applyMod(defense, 6144);
  if (
    effectiveWeather === "snow" &&
    defender.form.types.includes("ice") &&
    defenseId === "def"
  )
    defense = applyMod(defense, 6144);
  if (
    (activeItem(defender)?.id === "boosterenergy" ||
      (defender.ability?.id === "quarkdrive" && field.terrain === "electric") ||
      (defender.ability?.id === "protosynthesis" &&
        effectiveWeather === "sun")) &&
    ["quarkdrive", "protosynthesis"].includes(defender.ability?.id ?? "") &&
    highestNonHpStat(defender, defenderStats) === actualDefenseId
  )
    defense = applyMod(defense, 5325);
  let power = move.base_power;
  if (
    field.terrain === "grassy" &&
    grounded(defender) &&
    ["earthquake", "bulldoze"].includes(move.id)
  )
    power = applyMod(power, 2048);
  if (move.id === "knockoff" && defender.item) power = applyMod(power, 6144);
  if (
    (move.id === "expandingforce" &&
      field.terrain === "psychic" &&
      grounded(attacker)) ||
    (move.id === "risingvoltage" &&
      field.terrain === "electric" &&
      grounded(defender)) ||
    (move.id === "mistyexplosion" &&
      field.terrain === "misty" &&
      grounded(attacker)) ||
    (move.id === "venoshock" && ["psn", "tox"].includes(defender.status)) ||
    (move.id === "lashout" && attacker.stages.atk < 0)
  )
    power = applyMod(power, move.id === "mistyexplosion" ? 6144 : 8192);
  if (
    ["solarbeam", "solarblade"].includes(move.id) &&
    effectiveWeather &&
    effectiveWeather !== "sun"
  )
    power = applyMod(power, 2048);
  if (move.id === "spitup") {
    traceAppliedMechanic(mechanicTrace, "context", "spitup:stockpile_count");
    power = 100 * Number(attacker.context.stockpile_count ?? 1);
  }
  const powerMods: number[] = [];
  if (field.attacker.helpingHand) powerMods.push(6144);
  if (
    attacker.ability?.id === "rivalry" &&
    attacker.gender !== "N" &&
    defender.gender !== "N"
  )
    powerMods.push(attacker.gender === defender.gender ? 5120 : 3072);
  if (attacker.ability?.id === "technician" && power <= 60)
    powerMods.push(6144);
  if (originalMove.type_id === "normal" && convertedType) powerMods.push(4915);
  if (attacker.ability?.id === "toughclaws" && move.flags.includes("contact"))
    powerMods.push(5325);
  if (attacker.ability?.id === "megalauncher" && move.flags.includes("pulse"))
    powerMods.push(6144);
  if (attacker.ability?.id === "ironfist" && move.flags.includes("punch"))
    powerMods.push(4915);
  if (attacker.ability?.id === "strongjaw" && move.flags.includes("bite"))
    powerMods.push(6144);
  if (
    attacker.ability?.id === "sheerforce" &&
    (Array.isArray(move.calculation.secondaries)
      ? move.calculation.secondaries.length > 0
      : move.calculation.secondary !== null)
  )
    powerMods.push(5325);
  if (attacker.ability?.id === "waterbubble" && move.type_id === "water")
    powerMods.push(8192);
  if (
    (attacker.ability?.id === "flareboost" &&
      attacker.status === "brn" &&
      move.category === "Special") ||
    (attacker.ability?.id === "toxicboost" &&
      ["psn", "tox"].includes(attacker.status) &&
      move.category === "Physical")
  )
    powerMods.push(6144);
  if (attacker.ability?.id === "steelyspirit" && move.type_id === "steel")
    powerMods.push(6144);
  if (attacker.ability?.id === "sharpness" && move.flags.includes("slicing"))
    powerMods.push(6144);
  if (
    attacker.ability?.id === "sandforce" &&
    effectiveWeather === "sand" &&
    ["rock", "ground", "steel"].includes(move.type_id)
  )
    powerMods.push(5325);
  if (attacker.ability?.id === "punkrock" && move.flags.includes("sound"))
    powerMods.push(5325);
  if (
    attacker.ability?.id === "reckless" &&
    (move.calculation.recoil !== null || move.calculation.crash_damage)
  )
    powerMods.push(4915);
  const typedBoosts: Record<string, string> = {
    steelworker: "steel",
    dragonsmaw: "dragon",
    rockypayload: "rock",
    firemane: "fire",
  };
  if (typedBoosts[attacker.ability?.id ?? ""] === move.type_id)
    powerMods.push(6144);
  if (attacker.ability?.id === "transistor" && move.type_id === "electric")
    powerMods.push(5325);
  if (
    attacker.ability?.id === "analytic" &&
    (attacker.context.target_already_moved || attacker.context.ally_moves_later)
  )
    powerMods.push(5325);
  if (attacker.ability?.id === "supremeoverlord")
    powerMods.push(
      fractionMod(
        10 + Math.min(5, Number(attacker.context.allies_fainted ?? 0)),
        10,
      ),
    );
  const hpRatio = attacker.currentHp / Math.max(1, attackerStats.hp);
  if (["eruption", "waterspout", "dragonenergy"].includes(move.id))
    power = Math.max(
      1,
      Math.floor((power * attacker.currentHp) / attackerStats.hp),
    );
  if (
    { blaze: "fire", torrent: "water", overgrow: "grass", swarm: "bug" }[
      attacker.ability?.id ?? ""
    ] === move.type_id &&
    hpRatio <= 1 / 3
  )
    attackMods.push(6144);
  power = contextualPower(
    power,
    move,
    attacker,
    defender,
    attackerStats,
    defenderStats,
    effectiveWeather,
    field.terrain,
    field.attacker.tailwind,
    field.defender.tailwind,
    mechanicTrace,
  );
  if (power === 0) {
    power = weightBasedPower(move, attacker, defender);
    if (power === 0)
      return fixedDamage(
        attacker,
        defender,
        move,
        defenderStats,
        mechanicTrace,
      );
  }
  const itemBoost = activeItem(attacker)?.calculation.damage_boost as
    | { type_id?: string; numerator?: number; denominator?: number }
    | null
    | undefined;
  if (itemBoost && (!itemBoost.type_id || itemBoost.type_id === move.type_id)) {
    traceAppliedMechanic(mechanicTrace, "item", activeItem(attacker)?.id);
    powerMods.push(itemBoost.numerator ?? 4096);
  }
  if (
    (activeItem(attacker)?.id === "choiceband" && attackId === "atk") ||
    (activeItem(attacker)?.id === "choicespecs" && attackId === "spa")
  )
    attackMods.push(6144);
  power = overflow16(
    Math.max(1, applyMod(power, chainMods(powerMods, 41, 2097152))),
  );
  attack = overflow16(
    Math.max(1, applyMod(attack, chainMods(attackMods, 410, 131072))),
  );
  const hits = Math.max(1, Math.floor(Number(attacker.context.hits ?? 1)));
  const levelFactor = Math.floor((2 * data.mechanics.level) / 5 + 2);
  const attackDamage = overflow32(overflow32(levelFactor * power) * attack);
  const baseWithSpread = Math.floor(
    overflow32(Math.floor(attackDamage / defense) / 50 + 2),
  );
  let preRandom = baseWithSpread;
  if (spread(move) && !field.attacker.singleTarget)
    preRandom = applyMod(preRandom, 3072);
  if (
    (effectiveWeather === "sun" && move.type_id === "fire") ||
    (effectiveWeather === "rain" && move.type_id === "water")
  )
    preRandom = pokeRound((preRandom * 3) / 2);
  if (
    (effectiveWeather === "sun" && move.type_id === "water") ||
    (effectiveWeather === "rain" && move.type_id === "fire")
  )
    preRandom = pokeRound(preRandom / 2);
  if (critical) preRandom = Math.floor((preRandom * 3) / 2);
  const finalMods: number[] = [];
  const breaksScreens = ["brickbreak", "psychicfangs", "ragingbull"].includes(
    move.id,
  );
  if (
    !critical &&
    !breaksScreens &&
    attacker.ability?.id !== "infiltrator" &&
    (field.defender.auroraVeil ||
      (move.category === "Physical" && field.defender.reflect) ||
      (move.category === "Special" && field.defender.lightScreen))
  )
    finalMods.push(2732);
  if (field.defender.friendGuard) finalMods.push(3072);
  if (
    grounded(attacker) &&
    ((field.terrain === "electric" && move.type_id === "electric") ||
      (field.terrain === "grassy" && move.type_id === "grass") ||
      (field.terrain === "psychic" && move.type_id === "psychic"))
  )
    finalMods.push(5325);
  if (
    field.terrain === "misty" &&
    move.type_id === "dragon" &&
    grounded(defender)
  )
    finalMods.push(2048);
  if (attacker.ability?.id === "sniper" && critical) finalMods.push(6144);
  if (attacker.ability?.id === "tintedlens" && effectiveness < 1)
    finalMods.push(8192);
  if (
    !breaksAbilities &&
    ["filter", "solidrock", "prismarmor"].includes(
      defender.ability?.id ?? "",
    ) &&
    effectiveness > 1
  )
    finalMods.push(3072);
  if (
    !breaksAbilities &&
    ["multiscale", "shadowshield"].includes(defender.ability?.id ?? "") &&
    defender.currentHp === defenderStats.hp
  )
    finalMods.push(2048);
  if (
    !breaksAbilities &&
    defender.ability?.id === "thickfat" &&
    ["fire", "ice"].includes(move.type_id)
  )
    finalMods.push(2048);
  if (
    !breaksAbilities &&
    ["fluffy", "auraguard"].includes(defender.ability?.id ?? "")
  ) {
    if (move.type_id === "fire") finalMods.push(8192);
    if (move.flags.includes("contact") && attacker.ability?.id !== "longreach")
      finalMods.push(2048);
  }
  if (
    !breaksAbilities &&
    defender.ability?.id === "waterbubble" &&
    move.type_id === "fire"
  )
    finalMods.push(2048);
  if (
    !breaksAbilities &&
    defender.ability?.id === "dryskin" &&
    move.type_id === "fire"
  )
    finalMods.push(5120);
  if (
    !breaksAbilities &&
    defender.ability?.id === "heatproof" &&
    move.type_id === "fire"
  )
    finalMods.push(2048);
  if (
    !breaksAbilities &&
    defender.ability?.id === "purifyingsalt" &&
    move.type_id === "ghost"
  )
    finalMods.push(2048);
  if (
    (defender.ability?.id === "punkrock" && move.flags.includes("sound")) ||
    (defender.ability?.id === "icescales" && move.category === "Special")
  )
    finalMods.push(2048);
  if (attacker.ability?.id === "neuroforce" && effectiveness > 1)
    finalMods.push(5120);
  if (activeItem(attacker)?.id === "lifeorb") finalMods.push(5324);
  if (activeItem(attacker)?.id === "expertbelt" && effectiveness > 1)
    finalMods.push(4915);
  if (activeItem(attacker)?.id === "metronome")
    finalMods.push(
      fractionMod(
        10 + 2 * Math.min(5, Number(attacker.context.consecutive_uses ?? 0)),
        10,
      ),
    );
  const resist = defender.item?.calculation.damage_resist as
    | { type_id?: string }
    | null
    | undefined;
  if (
    resist?.type_id === move.type_id &&
    effectiveness > 1 &&
    attacker.ability?.id !== "unnerve" &&
    defender.ability?.id !== "klutz"
  ) {
    traceAppliedMechanic(mechanicTrace, "item", defender.item?.id);
    finalMods.push(2048);
    if (defender.ability?.id === "ripen") finalMods.push(2048);
  }
  const finalMod = chainMods(finalMods, 41, 131072);
  const stab =
    attacker.form.types.includes(move.type_id) ||
    ["libero", "protean"].includes(attacker.ability?.id ?? "")
      ? attacker.ability?.id === "adaptability"
        ? 8192
        : 6144
      : 4096;
  const rolls = Array.from({ length: 16 }, (_, index) => {
    let damage = Math.floor(overflow32(preRandom * (85 + index)) / 100);
    damage = pokeRound(overflow32(damage * stab) / 4096);
    damage = Math.floor(overflow32(damage) * effectiveness);
    if (
      attacker.status === "brn" &&
      move.category === "Physical" &&
      attacker.ability?.id !== "guts" &&
      move.id !== "facade"
    )
      damage = Math.floor(damage / 2);
    damage = pokeRound(Math.max(1, overflow32(damage * finalMod) / 4096));
    const oneHit = overflow16(damage);
    return oneHit * hits;
  });
  return damageResult(
    attacker,
    defender,
    move,
    rolls,
    defenderStats.hp,
    attackId,
    defenseId,
  );
}

function calculateHitSequence(
  data: CalculatorData,
  attacker: Combatant,
  defender: Combatant,
  move: Move,
  powers: number[],
  field: Field,
): number[] {
  return Array.from({ length: 16 }, (_, roll) => {
    let state = defender;
    let total = 0;
    for (const basePower of powers) {
      const result = calculate(
        data,
        { ...attacker, context: { ...attacker.context, hits: 1 } },
        state,
        {
          ...move,
          base_power: basePower,
          calculation: { ...move.calculation, multihit: null },
        },
        field,
      );
      const damage = result.rolls[roll] ?? 0;
      total += damage;
      const abilityDefenseChange =
        state.ability?.id === "stamina"
          ? 1
          : state.ability?.id === "weakarmor" && move.category === "Physical"
            ? -1
            : 0;
      const secondaryDefenseChange = [
        move.calculation.secondary,
        ...(Array.isArray(move.calculation.secondaries)
          ? move.calculation.secondaries
          : []),
      ].reduce((sum, effect) => {
        const row = effect as {
          chance?: number | null;
          boosts?: Record<string, number>;
        } | null;
        return (
          sum +
          (row && (row.chance === null || row.chance === 100)
            ? Number(row.boosts?.def ?? 0)
            : 0)
        );
      }, 0);
      const resist = state.item?.calculation.damage_resist as
        | { type_id?: string }
        | null
        | undefined;
      const effectiveness = state.form.types.reduce((value, type) => {
        const row = data.type_effectiveness.find(
          (entry) =>
            entry.attacking_type_id === move.type_id &&
            entry.defending_type_id === type,
        );
        return value * ((row?.multiplier_percent ?? 0) / 100);
      }, 1);
      const consumesResist =
        damage > 0 && resist?.type_id === move.type_id && effectiveness > 1;
      state = {
        ...state,
        currentHp: Math.max(0, state.currentHp - damage),
        item: consumesResist ? undefined : state.item,
        stages: {
          ...state.stages,
          def: Math.max(
            -6,
            Math.min(
              6,
              state.stages.def + abilityDefenseChange + secondaryDefenseChange,
            ),
          ),
        },
      };
    }
    return total;
  });
}

function damageResult(
  attacker: Combatant,
  defender: Combatant,
  move: Move,
  rolls: number[],
  hp: number,
  attackId: "atk" | "spa" = move.category === "Physical" ? "atk" : "spa",
  defenseId: "def" | "spd" = move.category === "Physical" ? "def" : "spd",
): DamageResult {
  const low = rolls[0]!;
  const high = rolls.at(-1)!;
  const lowPercent = (Math.floor((low * 1000) / Math.max(1, hp)) / 10).toFixed(
    1,
  );
  const highPercent = (
    Math.floor((high * 1000) / Math.max(1, hp)) / 10
  ).toFixed(1);
  return {
    rolls,
    compact: `${low} ~ ${high} | ${lowPercent}% ~ ${highPercent}%`,
    description: `${attacker.sp[attackId]} ${attackId === "atk" ? "Atk" : "SpA"} ${attacker.form.name} ${move.name} vs. ${defender.sp.hp} HP / ${defender.sp[defenseId]} ${defenseId === "def" ? "Def" : "SpD"} ${defender.form.name}: ${low}-${high} (${lowPercent} - ${highPercent}%)\n(${rolls.join(", ")})`,
  };
}

function contextualPower(
  power: number,
  move: Move,
  attacker: Combatant,
  defender: Combatant,
  attackerStats: Stats,
  defenderStats: Stats,
  weather: string,
  terrain: string,
  attackerTailwind: boolean,
  defenderTailwind: boolean,
  mechanicTrace?: MechanicTrace,
): number {
  const context = attacker.context;
  if (move.id === "facade" && attacker.status) return power * 2;
  if (
    (["assurance", "hex"].includes(move.id) && context.target_damaged) ||
    (["avalanche", "revenge"].includes(move.id) && context.damaged_by_target) ||
    (["stompingtantrum", "temperflare"].includes(move.id) &&
      context.last_move_failed) ||
    (move.id === "round" && context.ally_used_round) ||
    (move.id === "payback" && context.target_already_moved)
  ) {
    const activeKey = [
      "target_damaged",
      "damaged_by_target",
      "last_move_failed",
      "ally_used_round",
      "target_already_moved",
    ].find((key) => context[key]);
    if (activeKey)
      traceAppliedMechanic(mechanicTrace, "context", `${move.id}:${activeKey}`);
    return power * 2;
  }
  if (move.id === "brine" && defender.currentHp * 2 <= defenderStats.hp)
    return power * 2;
  if (move.id === "acrobatics" && !attacker.item) return power * 2;
  if (move.id === "ragefist") {
    traceAppliedMechanic(mechanicTrace, "context", "ragefist:hits_taken");
    return power + 50 * Number(context.hits_taken ?? 0);
  }
  if (move.id === "lastrespects") {
    traceAppliedMechanic(
      mechanicTrace,
      "context",
      "lastrespects:allies_fainted",
    );
    return power + 50 * Number(context.allies_fainted ?? 0);
  }
  if (["flail", "reversal"].includes(move.id)) {
    const ratio = Math.floor(
      (48 * attacker.currentHp) / Math.max(1, attackerStats.hp),
    );
    return ratio <= 1
      ? 200
      : ratio <= 4
        ? 150
        : ratio <= 9
          ? 100
          : ratio <= 16
            ? 80
            : ratio <= 32
              ? 40
              : 20;
  }
  if (["storedpower", "powertrip"].includes(move.id))
    return (
      power +
      20 *
        Object.values(attacker.stages).reduce(
          (total, amount) => total + Math.max(0, amount),
          0,
        )
    );
  if (move.id === "electroball") {
    const ratio =
      effectiveSpeed(
        attacker,
        attackerStats.spe,
        weather,
        terrain,
        attackerTailwind,
      ) /
      Math.max(
        1,
        effectiveSpeed(
          defender,
          defenderStats.spe,
          weather,
          terrain,
          defenderTailwind,
        ),
      );
    return ratio >= 4
      ? 150
      : ratio >= 3
        ? 120
        : ratio >= 2
          ? 80
          : ratio >= 1
            ? 60
            : 40;
  }
  if (move.id === "gyroball")
    return Math.min(
      150,
      Math.max(
        1,
        Math.floor(
          (25 *
            effectiveSpeed(
              defender,
              defenderStats.spe,
              weather,
              terrain,
              defenderTailwind,
            )) /
            Math.max(
              1,
              effectiveSpeed(
                attacker,
                attackerStats.spe,
                weather,
                terrain,
                attackerTailwind,
              ),
            ),
        ) + 1,
      ),
    );
  return power;
}

function effectiveSpeed(
  combatant: Combatant,
  raw: number,
  weather: string,
  terrain: string,
  tailwind: boolean,
): number {
  let speed = applyBattleStage(raw, combatant.stages.spe);
  if (tailwind) speed = applyMod(speed, 8192);
  if (combatant.ability?.id === "slowstart" && combatant.context.ability_active)
    speed = applyMod(speed, 2048);
  if (combatant.status === "par" && combatant.ability?.id !== "quickfeet")
    speed = applyMod(speed, 2048);
  if (combatant.ability?.id === "quickfeet" && combatant.status)
    speed = applyMod(speed, 6144);
  if (
    (combatant.ability?.id === "chlorophyll" && weather === "sun") ||
    (combatant.ability?.id === "swiftswim" && weather === "rain") ||
    (combatant.ability?.id === "sandrush" && weather === "sand") ||
    (combatant.ability?.id === "slushrush" && weather === "snow") ||
    (combatant.ability?.id === "surgesurfer" && terrain === "electric") ||
    (combatant.ability?.id === "unburden" && combatant.context.ability_active)
  )
    speed = applyMod(speed, 8192);
  const paradoxActive =
    activeItem(combatant)?.id === "boosterenergy" ||
    (combatant.ability?.id === "quarkdrive" && terrain === "electric") ||
    (combatant.ability?.id === "protosynthesis" && weather === "sun");
  if (
    paradoxActive &&
    ["quarkdrive", "protosynthesis"].includes(combatant.ability?.id ?? "") &&
    highestNonHpStat(combatant, stats(combatant)) === "spe"
  )
    speed = applyMod(speed, 6144);
  if (
    activeItem(combatant)?.id === "quickpowder" &&
    combatant.form.id.startsWith("ditto")
  )
    speed = applyMod(speed, 8192);
  if (activeItem(combatant)?.id === "choicescarf")
    speed = applyMod(speed, 6144);
  if (activeItem(combatant)?.id === "ironball") speed = applyMod(speed, 2048);
  if (
    new Set([
      "machobrace",
      "poweranklet",
      "powerband",
      "powerbelt",
      "powerbracer",
      "powerlens",
      "powerweight",
    ]).has(activeItem(combatant)?.id ?? "")
  )
    speed = applyMod(speed, 2048);
  return speed;
}

function weightBasedPower(
  move: Move,
  attacker: Combatant,
  defender: Combatant,
): number {
  const effectiveWeight = (combatant: Combatant) =>
    Math.max(
      1,
      Math.trunc(
        combatant.form.weight_tenths_kg *
          (combatant.ability?.id === "heavymetal"
            ? 2
            : combatant.ability?.id === "lightmetal"
              ? 0.5
              : 1),
      ),
    );
  if (["grassknot", "lowkick"].includes(move.id)) {
    const weight = effectiveWeight(defender);
    return weight >= 2000
      ? 120
      : weight >= 1000
        ? 100
        : weight >= 500
          ? 80
          : weight >= 250
            ? 60
            : weight >= 100
              ? 40
              : 20;
  }
  if (["heatcrash", "heavyslam"].includes(move.id)) {
    const ratio = effectiveWeight(attacker) / effectiveWeight(defender);
    return ratio >= 5
      ? 120
      : ratio >= 4
        ? 100
        : ratio >= 3
          ? 80
          : ratio >= 2
            ? 60
            : 40;
  }
  if (move.id === "hardpress")
    return Math.max(
      1,
      Math.floor((100 * defender.currentHp) / Math.max(1, stats(defender).hp)),
    );
  if (move.id === "fling")
    return Number(activeItem(attacker)?.calculation.fling_base_power ?? 0);
  return 0;
}

function abilityImmunity(defender: Combatant, move: Move): string | null {
  const ability = defender.ability?.id;
  const typeImmunities: Record<string, string[]> = {
    ground: ["levitate", "eartheater", "eelevate"],
    fire: ["flashfire", "wellbakedbody"],
    water: ["waterabsorb", "dryskin", "stormdrain"],
    electric: ["voltabsorb", "lightningrod", "motordrive"],
    grass: ["sapsipper"],
  };
  if (typeImmunities[move.type_id]?.includes(ability ?? ""))
    return defender.ability?.name ?? "ability";
  if (ability === "soundproof" && move.flags.includes("sound"))
    return defender.ability?.name ?? "Soundproof";
  if (ability === "bulletproof" && move.flags.includes("bullet"))
    return defender.ability?.name ?? "Bulletproof";
  if (ability === "windrider" && move.flags.includes("wind"))
    return defender.ability?.name ?? "Wind Rider";
  if (
    move.priority > 0 &&
    ["armortail", "dazzling", "queenlymajesty"].includes(ability ?? "")
  )
    return defender.ability?.name ?? "priority-blocking ability";
  return null;
}

function fixedDamage(
  attacker: Combatant,
  defender: Combatant,
  move: Move,
  defenderStats: Stats,
  mechanicTrace?: MechanicTrace,
): DamageResult {
  let damage: number | null = null;
  if (["seismictoss", "nightshade"].includes(move.id)) damage = 50;
  else if (move.id === "dragonrage") damage = 40;
  else if (move.id === "sonicboom") damage = 20;
  else if (["superfang", "naturesmadness"].includes(move.id))
    damage = Math.max(1, Math.floor(defender.currentHp / 2));
  else if (move.id === "endeavor")
    damage = Math.max(0, defender.currentHp - attacker.currentHp);
  else if (move.id === "finalgambit") damage = attacker.currentHp;
  else if (["counter", "mirrorcoat"].includes(move.id)) {
    traceAppliedMechanic(
      mechanicTrace,
      "context",
      `${move.id}:prior_damage_taken`,
    );
    damage = Number(attacker.context.prior_damage_taken ?? 0) * 2;
  } else if (["comeuppance", "metalburst"].includes(move.id)) {
    traceAppliedMechanic(
      mechanicTrace,
      "context",
      `${move.id}:prior_damage_taken`,
    );
    damage = Math.floor(
      (Number(attacker.context.prior_damage_taken ?? 0) * 3) / 2,
    );
  } else if (
    ["fissure", "guillotine", "horndrill", "sheercold"].includes(move.id)
  )
    damage = defender.currentHp;
  if (damage === null)
    return noDamage(
      `Calculation unavailable: ${move.name}'s variable damage rule is not supported.`,
    );
  const rawDamage = Math.max(0, damage);
  const percent = (
    Math.floor((rawDamage * 1000) / Math.max(1, defenderStats.hp)) / 10
  ).toFixed(1);
  return {
    rolls: Array(16).fill(rawDamage),
    compact: `${rawDamage} ~ ${rawDamage} | ${percent}% ~ ${percent}%`,
    description: `${attacker.form.name} ${move.name} vs. ${defender.form.name}: ${rawDamage} (${percent}%)\n(${Array(16).fill(rawDamage).join(", ")})`,
  };
}

function noDamage(reason: string): DamageResult {
  return { rolls: [], compact: "—", description: reason, reason };
}
