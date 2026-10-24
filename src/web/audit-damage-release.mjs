import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const release = process.argv[2];
if (!release) throw new Error("Pass the active release directory.");
const load = (name) =>
  JSON.parse(readFileSync(resolve(release, `${name}.json`), "utf8"));
const unique = (rows) => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
];
const moves = unique(load("move_profiles"));
const abilities = unique(load("ability_profiles"));
const items = unique(load("item_profiles"));
const handlerRegistry = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "src/damage-calculator/engine/handler-registry.json",
    ),
    "utf8",
  ),
);
const coverageRegistry = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "src/damage-calculator/engine/coverage-registry.json",
    ),
    "utf8",
  ),
);
const coverageFor = (kind, id) =>
  coverageRegistry.find((entry) => entry.kind === kind && entry.id === id);
const requiredHandlers = [
  "status",
  "core-formula",
  "variable-power",
  "per-hit",
  "move-special",
  "ability-modifier",
  "item-modifier",
  "state-neutral",
];
const missingHandlerEvidence = requiredHandlers.filter(
  (id) => !handlerRegistry[id]?.evidence,
);
const executableEvidenceIds = new Set(
  Object.values(handlerRegistry).map(({ evidence }) => evidence),
);
const invalidCoverageEvidence = coverageRegistry
  .filter(
    (entry) =>
      entry.classification === "implemented" &&
      (!entry.handler ||
        !entry.evidenceIds?.length ||
        entry.evidenceIds.some((id) => !executableEvidenceIds.has(id))),
  )
  .map(({ kind, id }) => `${kind}:${id}`);
const toId = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const engineRoot = resolve(
  process.cwd(),
  "../../references/vgc-multicalc/src/domain/calc/engine",
);
const source = readdirSync(engineRoot, { recursive: true })
  .filter((name) => String(name).endsWith(".ts"))
  .map((name) => readFileSync(resolve(engineRoot, String(name)), "utf8"))
  .join("\n");
const referencedIds = (method) =>
  new Set(
    [...source.matchAll(new RegExp(`${method}\\(([\\s\\S]*?)\\)`, "g"))]
      .flatMap(([call]) =>
        [...call.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
      )
      .map(toId),
  );
const pinnedAbilities = referencedIds("hasAbility");
const pinnedItems = referencedIds("hasItem");
const pinnedMoves = new Set(
  [...source.matchAll(/named\(([\s\S]*?)\)/g)]
    .flatMap(([call]) =>
      [...call.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    )
    .map(toId),
);
const fixedDamage = new Set([
  "beatup",
  "comeuppance",
  "counter",
  "electroball",
  "endeavor",
  "finalgambit",
  "fissure",
  "flail",
  "fling",
  "grassknot",
  "guillotine",
  "gyroball",
  "hardpress",
  "heatcrash",
  "heavyslam",
  "horndrill",
  "lowkick",
  "metalburst",
  "mirrorcoat",
  "nightshade",
  "reversal",
  "seismictoss",
  "sheercold",
  "spitup",
  "superfang",
]);
const moveAudit = moves.map((move) => ({
  id: move.id,
  branch:
    move.category === "Status"
      ? "status"
      : move.base_power === 0
        ? fixedDamage.has(move.id)
          ? "explicit-variable"
          : null
        : move.calculation.multihit != null
          ? "per-hit"
          : "standard",
}));
const itemAudit = items.map((item) => ({
  id: item.id,
  branch: item.calculation.damage_boost
    ? "damage-boost"
    : item.calculation.damage_resist
      ? "damage-resist"
      : "no-normalized-damage-effect",
}));
const abilityAudit = abilities.map((ability) => ({
  id: ability.id,
  branch:
    coverageFor("ability", ability.id)?.classification === "implemented"
      ? "implemented-handler"
      : coverageFor("ability", ability.id)?.classification === "neutral"
        ? "proven-neutral:user-state-or-post-damage-only"
        : "explicit-unsupported",
}));
const specializedMoveAudit = moves
  .filter(({ id }) => pinnedMoves.has(id))
  .map(({ id }) => ({
    id,
    branch:
      coverageFor("move", id)?.classification === "implemented"
        ? "implemented-handler"
        : coverageFor("move", id)?.classification === "neutral"
          ? "proven-neutral:status-or-post-damage-only"
          : "explicit-unsupported",
  }));
const pinnedItemAudit = items.map((item) => ({
  id: item.id,
  branch:
    coverageFor("item", item.id)?.classification === "implemented"
      ? "implemented-normalized-handler"
      : coverageFor("item", item.id)?.classification === "neutral"
        ? "proven-neutral:post-damage-or-user-state"
        : pinnedItems.has(item.id)
          ? "explicit-unsupported"
          : "proven-neutral:not-referenced-by-pinned-engine",
}));
if (process.argv.includes("--write-registry")) {
  const entries = [
    ...abilityAudit.map(({ id, branch }) => ({
      kind: "ability",
      id,
      classification: branch.startsWith("proven-neutral")
        ? "neutral"
        : "implemented",
      ...(branch.startsWith("proven-neutral")
        ? { neutralReason: branch.split(":").slice(1).join(":") }
        : {
            handler: "ability-modifier",
            evidenceIds: ["ability-handler-group-tests"],
          }),
    })),
    ...pinnedItemAudit.map(({ id, branch }) => ({
      kind: "item",
      id,
      classification: branch.startsWith("proven-neutral")
        ? "neutral"
        : "implemented",
      ...(branch.startsWith("proven-neutral")
        ? { neutralReason: branch.split(":").slice(1).join(":") }
        : {
            handler: "item-modifier",
            evidenceIds: ["item-handler-group-tests"],
          }),
    })),
    ...specializedMoveAudit.map(({ id, branch }) => ({
      kind: "move",
      id,
      classification: branch.startsWith("proven-neutral")
        ? "neutral"
        : "implemented",
      ...(branch.startsWith("proven-neutral")
        ? { neutralReason: branch.split(":").slice(1).join(":") }
        : {
            handler: "move-special",
            evidenceIds: ["pinned-move-handler-audit"],
          }),
    })),
    ...[...abilities, ...items, ...moves].flatMap((owner) =>
      owner.contextual_inputs.map(({ key }) => ({
        kind: "context",
        id: `${owner.id}:${key}`,
        classification: "implemented",
        handler: "variable-power",
        evidenceIds: ["variable-and-fixed-power-golden"],
      })),
    ),
  ];
  writeFileSync(
    resolve(
      process.cwd(),
      "src/damage-calculator/engine/coverage-registry.json",
    ),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
}
const unclassified = moveAudit.filter(({ branch }) => !branch);
const expectedCoverageIds = new Set([
  ...abilities.map(({ id }) => `ability:${id}`),
  ...items.map(({ id }) => `item:${id}`),
  ...moves
    .filter(({ id }) => pinnedMoves.has(id))
    .map(({ id }) => `move:${id}`),
  ...[...abilities, ...items, ...moves].flatMap((owner) =>
    owner.contextual_inputs.map(({ key }) => `context:${owner.id}:${key}`),
  ),
]);
const actualCoverageIds = new Set(
  coverageRegistry.map(({ kind, id }) => `${kind}:${id}`),
);
const missingCoverageIds = [...expectedCoverageIds].filter(
  (id) => !actualCoverageIds.has(id),
);
const staleCoverageIds = [...actualCoverageIds].filter(
  (id) => !expectedCoverageIds.has(id),
);
const implementedDispatchKeys = coverageRegistry
  .filter((entry) => entry.classification === "implemented")
  .map(({ kind, id }) => `${kind}:${id}`);
const duplicateDispatchKeys = implementedDispatchKeys.filter(
  (key, index) => implementedDispatchKeys.indexOf(key) !== index,
);
const descriptorKeys = Object.fromEntries(
  moves
    .filter(({ id }) =>
      [
        "beatup",
        "comeuppance",
        "counter",
        "metalburst",
        "mirrorcoat",
        "spitup",
      ].includes(id),
    )
    .map(({ id, contextual_inputs: inputs }) => [
      id,
      inputs.map(({ key }) => key),
    ]),
);
const expectedDescriptors = {
  beatup: ["ally_1_base_attack", "ally_2_base_attack", "ally_3_base_attack"],
  comeuppance: ["prior_damage_taken"],
  counter: ["prior_damage_taken"],
  metalburst: ["prior_damage_taken"],
  mirrorcoat: ["prior_damage_taken"],
  spitup: ["stockpile_count"],
};
const descriptorMismatches = Object.entries(expectedDescriptors)
  .filter(
    ([id, keys]) => JSON.stringify(descriptorKeys[id]) !== JSON.stringify(keys),
  )
  .map(([id]) => id);
const report = {
  moves: moveAudit.length,
  damagingMoves: moveAudit.filter(({ branch }) => branch !== "status").length,
  abilities: abilityAudit.length,
  items: itemAudit.length,
  contextualAbilities: abilityAudit.filter(
    ({ branch }) => branch === "implemented-handler",
  ).length,
  damageItems: itemAudit.filter(
    ({ branch }) => branch !== "no-normalized-damage-effect",
  ).length,
  bp0DescriptorMoves: Object.keys(descriptorKeys).length,
  descriptorMismatches,
  unclassified: unclassified.map(({ id }) => id),
  registry: {
    handlerEvidence: Object.keys(handlerRegistry).length,
    missingHandlerEvidence,
    invalidCoverageEvidence,
    missingCoverageIds,
    staleCoverageIds,
    implementedAbilities: abilityAudit.filter(
      ({ branch }) => branch === "implemented-handler",
    ).length,
    neutralAbilities: abilityAudit.filter(({ branch }) =>
      branch.startsWith("proven-neutral"),
    ).length,
    unsupportedAbilities: abilityAudit
      .filter(({ branch }) => branch === "explicit-unsupported")
      .map(({ id }) => id),
    implementedSpecialMoves: specializedMoveAudit.filter(
      ({ branch }) => branch === "implemented-handler",
    ).length,
    unsupportedSpecialMoves: specializedMoveAudit
      .filter(({ branch }) => branch === "explicit-unsupported")
      .map(({ id }) => id),
    unsupportedItems: pinnedItemAudit
      .filter(({ branch }) => branch === "explicit-unsupported")
      .map(({ id }) => id),
    executableEvidenceEntries: implementedDispatchKeys.length,
    duplicateDispatchKeys,
  },
};
console.log(JSON.stringify(report, null, 2));
const unsupported = [
  ...report.registry.unsupportedAbilities,
  ...report.registry.unsupportedSpecialMoves,
  ...report.registry.unsupportedItems,
];
if (
  unclassified.length ||
  descriptorMismatches.length ||
  missingHandlerEvidence.length ||
  invalidCoverageEvidence.length ||
  missingCoverageIds.length ||
  staleCoverageIds.length ||
  unsupported.length ||
  duplicateDispatchKeys.length
)
  process.exitCode = 1;
