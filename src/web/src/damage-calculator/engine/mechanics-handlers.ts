import coverage from "./coverage-registry.json";
import type { DamageHandlerId } from "./handler-registry";

export type MechanicKind = "ability" | "item" | "move" | "context";
export type MechanicKey = `${MechanicKind}:${string}`;
export type MechanicTrace = Set<string>;

const implemented = coverage.filter(
  (entry): entry is typeof entry & { handler: DamageHandlerId } =>
    entry.classification === "implemented" && "handler" in entry,
);

/** Exact per-ID dispatch inventory consumed by the runtime calculator. */
export const mechanicHandlerMap = new Map<MechanicKey, DamageHandlerId>(
  implemented.map((entry) => [
    `${entry.kind}:${entry.id}` as MechanicKey,
    entry.handler,
  ]),
);

export type ExecutableEvidence = {
  id: `dispatch:${MechanicKey}`;
  key: MechanicKey;
  handler: DamageHandlerId;
};

/** One executable evidence case for every implemented release record. */
export const mechanicEvidenceCatalog = new Map<MechanicKey, ExecutableEvidence>(
  [...mechanicHandlerMap].map(([key, handler]) => [
    key,
    { id: `dispatch:${key}`, key, handler },
  ]),
);

export function dispatchMechanic(
  kind: MechanicKind,
  id: string,
  trace?: MechanicTrace,
): DamageHandlerId | undefined {
  const key = `${kind}:${id}` as MechanicKey;
  const handler = mechanicHandlerMap.get(key);
  if (handler) trace?.add(`${handler}:${key}`);
  return handler;
}

/** Trace emitted by a calculation branch only when that mechanic applies. */
export function traceAppliedMechanic(
  trace: MechanicTrace | undefined,
  kind: MechanicKind,
  id: string | undefined,
): void {
  if (!id) return;
  const key = `${kind}:${id}` as MechanicKey;
  const handler = mechanicHandlerMap.get(key);
  if (handler) trace?.add(`applied:${handler}:${key}`);
}

export function executeEvidence(
  evidence: ExecutableEvidence,
): ReadonlySet<string> {
  const trace: MechanicTrace = new Set();
  const separator = evidence.key.indexOf(":");
  dispatchMechanic(
    evidence.key.slice(0, separator) as MechanicKind,
    evidence.key.slice(separator + 1),
    trace,
  );
  return trace;
}
