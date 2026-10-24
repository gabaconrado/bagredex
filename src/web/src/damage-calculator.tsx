import { render } from "preact";
import { DamageCalculator } from "./damage-calculator/app";
import { parseBootstrap } from "./damage-calculator/contracts";
import "../static/web/css/damage-calculator.css";

const root = document.querySelector<HTMLElement>(
  "[data-damage-calculator-root]",
);
const script = document.getElementById("damage-calculator-bootstrap");
if (root && script) {
  try {
    render(
      <DamageCalculator
        bootstrap={parseBootstrap(JSON.parse(script.textContent ?? "null"))}
      />,
      root,
    );
  } catch (error) {
    root.innerHTML = `<section class="damage-state damage-state--error" role="alert"></section>`;
    root.querySelector("section")!.textContent =
      error instanceof Error
        ? error.message
        : "The damage calculator could not start.";
  }
}
