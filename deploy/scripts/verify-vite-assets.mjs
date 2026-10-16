#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const [manifestArgument, outputArgument] = process.argv.slice(2);
if (!manifestArgument || !outputArgument) {
  console.error("Usage: verify-vite-assets.mjs MANIFEST OUTPUT_ROOT");
  process.exit(2);
}

const manifestPath = resolve(manifestArgument);
const outputRoot = resolve(outputArgument);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  console.error(`Unable to read Vite manifest ${manifestPath}: ${error.message}`);
  process.exit(1);
}

const entryName = "src/pokedex.tsx";
const entry = manifest[entryName];
if (!entry || typeof entry !== "object") {
  console.error(`Vite manifest does not contain ${entryName}`);
  process.exit(1);
}

for (const [recordName, record] of Object.entries(manifest)) {
  if (!record || typeof record !== "object") {
    console.error(`Vite manifest record is invalid: ${recordName}`);
    process.exit(1);
  }
  const references = [record.file, ...(record.css ?? []), ...(record.assets ?? [])];
  if (references.some((reference) => typeof reference !== "string")) {
    console.error(`Vite manifest ${recordName} contains a non-string asset reference`);
    process.exit(1);
  }
  for (const reference of references) {
    const assetPath = resolve(outputRoot, reference);
    const pathFromRoot = relative(outputRoot, assetPath);
    if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === "..") {
      console.error(`Vite manifest contains an unsafe asset path: ${reference}`);
      process.exit(1);
    }
    try {
      if (!statSync(assetPath).isFile()) throw new Error("not a regular file");
    } catch (error) {
      console.error(`Vite manifest asset is unavailable: ${reference} (${error.message})`);
      process.exit(1);
    }
  }
  for (const importedName of [...(record.imports ?? []), ...(record.dynamicImports ?? [])]) {
    if (typeof importedName !== "string" || !manifest[importedName]) {
      console.error(`Vite manifest ${recordName} contains an invalid import: ${importedName}`);
      process.exit(1);
    }
  }
}

if (dirname(manifestPath) !== resolve(outputRoot, ".vite")) {
  console.error("Vite manifest is not inside OUTPUT_ROOT/.vite");
  process.exit(1);
}
