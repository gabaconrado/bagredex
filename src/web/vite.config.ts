import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/static/web/dist/",
  plugins: [preact()],
  build: {
    outDir: "static/web/dist",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        pokedex: "src/pokedex.tsx",
        "team-builder": "src/team-builder.tsx",
        "damage-calculator": "src/damage-calculator.tsx",
      },
    },
  },
  test: {
    environment: "happy-dom",
    fileParallelism: false,
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
