import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/static/web/dist/",
  plugins: [preact()],
  build: {
    outDir: "static/web/dist",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: "src/pokedex.tsx" },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
