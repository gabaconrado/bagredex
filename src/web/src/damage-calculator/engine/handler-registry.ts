import registry from "./handler-registry.json";
import coverage from "./coverage-registry.json";

export type DamageHandlerId = keyof typeof registry;
export type HandlerEvidence = {
  id: DamageHandlerId;
  evidence: string;
};

export const damageHandlerRegistry = Object.entries(registry).map(
  ([id, value]) => ({ id: id as DamageHandlerId, evidence: value.evidence }),
) satisfies HandlerEvidence[];

export function requireDamageHandler(id: DamageHandlerId): HandlerEvidence {
  const handler = damageHandlerRegistry.find((entry) => entry.id === id);
  if (!handler) throw new Error(`Unregistered damage handler: ${id}`);
  return handler;
}

export type CoverageEntry = (typeof coverage)[number];
export const damageCoverageRegistry = coverage satisfies CoverageEntry[];

export function requireCoverage(
  kind: CoverageEntry["kind"],
  id: string,
  optional = false,
): CoverageEntry | undefined {
  const entry = damageCoverageRegistry.find(
    (candidate) => candidate.kind === kind && candidate.id === id,
  );
  if (!entry && !optional)
    throw new Error(`Unclassified damage ${kind}: ${id}`);
  if (entry?.classification === "implemented" && "handler" in entry)
    requireDamageHandler(entry.handler as DamageHandlerId);
  return entry;
}
