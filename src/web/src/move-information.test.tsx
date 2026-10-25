import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { MoveInformationDialog, formatMoveTarget } from "./move-information";

describe("move information", () => {
  it.each([
    ["adjacentFoe", "Adjacent Foe"],
    ["userOrNPC", "User Or NPC"],
    ["normal", "Normal"],
  ])("humanizes %s targets", (target, expected) => {
    expect(formatMoveTarget(target)).toBe(expected);
  });

  it("shows normalized mechanics and restores focus after closing", async () => {
    const invoker = document.createElement("button");
    document.body.append(invoker);
    invoker.focus();
    const onClose = vi.fn();
    render(
      <MoveInformationDialog
        move={{
          name: "Flamethrower",
          description: "The target is scorched by an intense blast of fire.",
          type: { id: "fire", name: "Fire" },
          category: "Special",
          basePower: 90,
          accuracy: 100,
          alwaysHits: false,
          pp: 15,
          priority: 0,
          target: "adjacentFoe",
          flags: ["protect"],
        }}
        invoker={invoker}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Flamethrower" });
    expect(dialog.textContent).toContain("Fire");
    expect(dialog.textContent).toContain("Special");
    expect(dialog.textContent).toContain("Power: 90");
    expect(dialog.textContent).toContain("Accuracy: 100");
    expect(dialog.textContent).toContain("PP: 15");
    expect(dialog.textContent).toContain("Priority: 0");
    expect(dialog.textContent).toContain("Adjacent Foe");
    expect(dialog.textContent).toContain("protect");
    expect(dialog.textContent).toContain(
      "The target is scorched by an intense blast of fire.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });
});
