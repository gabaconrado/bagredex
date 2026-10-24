import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const root = resolve(
  process.cwd(),
  "../../references/vgc-multicalc/src/domain",
);
const directory = mkdtempSync(join(tmpdir(), "bagredex-damage-parity-"));
const output = join(directory, "generator.mjs");
await build({
  entryPoints: [
    resolve(process.cwd(), "scripts/generate-damage-parity-reference.ts"),
  ],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  alias: { "@calc": join(root, "calc"), "@data": join(root, "data") },
  logLevel: "warning",
});
await import(pathToFileURL(output).href);
const artifact = resolve(
  process.cwd(),
  "src/damage-calculator/engine/reference-parity.json",
);
writeFileSync(
  artifact,
  await format(readFileSync(artifact, "utf8"), { parser: "json" }),
);
