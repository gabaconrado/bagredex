import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import mega from "./assets/pokedex-icons/mega-evolution.svg?raw";
import physical from "./assets/pokedex-icons/physical-move.svg?raw";
import shiny from "./assets/pokedex-icons/shiny.svg?raw";
import special from "./assets/pokedex-icons/special-move.svg?raw";
import status from "./assets/pokedex-icons/status-move.svg?raw";
import { CategoryIcon, MegaIcon, ShinyIcon } from "./icons";

const assets = {
  "mega-evolution.svg": [
    mega,
    "299f931e037e96aedc68ccd40c5038a8258a40c339a1ad49c53a61de193c15ac",
  ],
  "physical-move.svg": [
    physical,
    "4f73e0b23df40523c63d57e34eaf3af958e9c32310a609136375575b99caaae6",
  ],
  "shiny.svg": [
    shiny,
    "bf78e73fbbb38103302779d89792bb80d2ccd3b4beaccf9e557bf7b38b7c5430",
  ],
  "special-move.svg": [
    special,
    "541a9bf1efb9a94ec9a292ea33afcd95ac6c4d7b38ebddbbbd506693048a77a9",
  ],
  "status-move.svg": [
    status,
    "08aecce0937641f0054f7f7f120e7c81a6fa83f2c2b6d6681455acd387aad000",
  ],
} as const;

describe("supplied Pokédex icons", () => {
  it.each(Object.entries(assets))(
    "%s keeps its reviewed bytes and safe standalone SVG content",
    (_filename, [source, fingerprint]) => {
      expect(createHash("sha256").update(source).digest("hex")).toBe(
        fingerprint,
      );
      expect(source).toContain('viewBox="0 0 48 48"');
      expect(source).not.toMatch(/<script\b|<foreignObject\b|\son\w+\s*=/i);
      expect(
        source.replace('xmlns="http://www.w3.org/2000/svg"', ""),
      ).not.toMatch(/(?:https?:|data:)/i);
      expect(source).not.toMatch(/(?:href|xlink:href)\s*=\s*["'](?!#)/i);
      for (const match of source.matchAll(/url\(([^)]+)\)/gi))
        expect(match[1]!.trim().replace(/^['"]|['"]$/g, "")).toMatch(/^#/);
    },
  );

  it("contains only the five reviewed filenames and no Zone.Identifier artifact", () => {
    expect(readdirSync("src/assets/pokedex-icons").sort()).toEqual(
      Object.keys(assets).sort(),
    );
  });

  it("keeps the approved Status geometry with pale blue and white only", () => {
    expect(status).toContain("#B7D9EB");
    expect(status).toContain("#FFFFFF");
    expect(status).not.toMatch(/#000(?:000)?\b|\bblack\b/i);
  });

  it.each([
    ["mega-evolution", MegaIcon()],
    ["shiny", ShinyIcon()],
    ["physical-move", CategoryIcon({ category: "Physical" })],
    ["special-move", CategoryIcon({ category: "Special" })],
    ["status-move", CategoryIcon({ category: "Status" })],
  ])("maps %s to one decorative image", (filename, icon) => {
    const { container } = render(icon);
    const image = container.querySelector("img.icon")!;
    expect(image.getAttribute("src")).toContain(filename);
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("marks only the Shiny image for white presentation", () => {
    const shinyIcon = render(ShinyIcon()).container.querySelector("img.icon")!;
    const megaIcon = render(MegaIcon()).container.querySelector("img.icon")!;
    const specialIcon = render(
      CategoryIcon({ category: "Special" }),
    ).container.querySelector("img.icon")!;
    expect(shinyIcon.classList.contains("icon--shiny")).toBe(true);
    expect(megaIcon.classList.contains("icon--shiny")).toBe(false);
    expect(specialIcon.classList.contains("icon--shiny")).toBe(false);
  });
});
