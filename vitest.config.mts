import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Node environment, not jsdom: these tests exercise route handlers and
// server-side libs, not React components. See docs/adr/0012-vitest-testing.md.
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // graphql 16 ships CJS (index.js, "main") and ESM (index.mjs, "module").
      // Vite would hand our source the .mjs while Node loads the .js for the
      // externalized graphql-yoga and Pothos, giving two graphql instances
      // ("Cannot use GraphQLScalarType from another module or realm", and
      // GraphQLErrors that Yoga's masking does not recognise). Pin one copy.
      { find: /^graphql$/, replacement: fileURLToPath(new URL("./node_modules/graphql/index.js", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
