import { render } from "preact";
import { App } from "./app";
import { parseBootstrap } from "./contracts";
import "../static/web/css/pokedex.css";

const root = document.querySelector<HTMLElement>("[data-pokedex-root]");
const script = document.getElementById("pokedex-bootstrap");
if (root && script) {
  try {
    render(
      <App
        bootstrap={parseBootstrap(JSON.parse(script.textContent ?? "null"))}
      />,
      root,
    );
  } catch (error) {
    root.innerHTML = "";
    const message = document.createElement("p");
    message.className = "state-card state-card--error";
    message.setAttribute("role", "alert");
    message.textContent =
      error instanceof Error ? error.message : "The Pokédex could not start.";
    root.append(message);
  }
}
