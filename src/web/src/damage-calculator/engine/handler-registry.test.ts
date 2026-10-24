import { describe, expect, it } from "vitest";
import {
  damageCoverageRegistry,
  damageHandlerRegistry,
  requireCoverage,
  requireDamageHandler,
} from "./handler-registry";
import {
  executeEvidence,
  mechanicEvidenceCatalog,
  mechanicHandlerMap,
  type MechanicKey,
} from "./mechanics-handlers";

describe("damage handler registry", () => {
  it("has unique checked evidence for every dispatch family", () => {
    expect(new Set(damageHandlerRegistry.map(({ id }) => id)).size).toBe(
      damageHandlerRegistry.length,
    );
    expect(
      new Set(damageHandlerRegistry.map(({ evidence }) => evidence)).size,
    ).toBe(damageHandlerRegistry.length);
    for (const handler of damageHandlerRegistry) {
      expect(handler.evidence.length).toBeGreaterThan(0);
      expect(requireDamageHandler(handler.id)).toBe(handler);
    }
  });
  it("gives every per-ID classification executable evidence or a neutral reason", () => {
    const evidence = new Set(
      damageHandlerRegistry.map((handler) => handler.evidence),
    );
    expect(damageCoverageRegistry).toHaveLength(459);
    for (const entry of damageCoverageRegistry) {
      expect(requireCoverage(entry.kind, entry.id)).toBe(entry);
      if (entry.classification === "implemented") {
        const evidenceIds =
          "evidenceIds" in entry ? (entry.evidenceIds ?? []) : [];
        expect(evidenceIds.length).toBeGreaterThan(0);
        for (const id of evidenceIds) expect(evidence.has(id)).toBe(true);
      } else {
        expect(
          "neutralReason" in entry ? (entry.neutralReason?.length ?? 0) : 0,
        ).toBeGreaterThan(0);
      }
    }
  });
  it("executes per-ID evidence through the exact runtime dispatch inventory", () => {
    const implemented = damageCoverageRegistry.filter(
      (entry) => entry.classification === "implemented",
    );
    expect(implemented).toHaveLength(205);
    expect(mechanicHandlerMap.size).toBe(205);
    expect(mechanicEvidenceCatalog.size).toBe(205);
    for (const entry of implemented) {
      const key = `${entry.kind}:${entry.id}` as MechanicKey;
      const evidence = mechanicEvidenceCatalog.get(key);
      expect(evidence, key).toBeDefined();
      expect(mechanicHandlerMap.get(key), key).toBe(entry.handler);
      expect(executeEvidence(evidence!), key).toContain(
        `${entry.handler}:${key}`,
      );
    }
  });
});
