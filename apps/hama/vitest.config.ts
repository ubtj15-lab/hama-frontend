import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@": path.join(root, "app"),
    },
  },
});
