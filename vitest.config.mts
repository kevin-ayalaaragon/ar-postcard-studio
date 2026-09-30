import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Node environment, not jsdom: these tests exercise route handlers and
// server-side libs, not React components. See docs/adr/0012-vitest-testing.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
