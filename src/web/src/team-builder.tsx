import { render } from "preact";
import { TeamBuilder } from "./team-builder/app";
import { parseBootstrap } from "./team-builder/contracts";
import "../static/web/css/team-builder.css";

const root = document.querySelector<HTMLElement>("[data-team-builder-root]");
const script = document.getElementById("team-builder-bootstrap");
if (root && script) {
  try {
    root.replaceChildren();
    render(
      <TeamBuilder
        bootstrap={parseBootstrap(JSON.parse(script.textContent ?? "null"))}
      />,
      root,
    );
  } catch (error) {
    root.innerHTML = "";
    const panel = document.createElement("section");
    panel.className = "team-state team-state--error";
    panel.setAttribute("role", "alert");
    panel.textContent =
      error instanceof Error
        ? error.message
        : "The team builder could not start.";
    root.append(panel);
  }
}
