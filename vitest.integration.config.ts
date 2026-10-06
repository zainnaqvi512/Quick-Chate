import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    include: ["api/**/*.integration.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 60000,
  },
});
