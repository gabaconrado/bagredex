import { render } from "preact";
import { BattleMode } from "./battle-mode/app";
import { parseBattleBootstrap } from "./battle-mode/contracts";
import "../static/web/css/battle-mode.css";

const root = document.querySelector<HTMLElement>("[data-battle-mode-root]");
const script = document.getElementById("battle-mode-bootstrap");
if (root && script) {
  try {
    render(
      <BattleMode
        bootstrap={parseBattleBootstrap(
          JSON.parse(script.textContent ?? "null"),
        )}
      />,
      root,
    );
  } catch (error) {
    root.innerHTML =
      '<section class="battle-state battle-state--error" role="alert"></section>';
    root.querySelector("section")!.textContent =
      error instanceof Error ? error.message : "Battle Mode could not start.";
  }
}
