import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "eslint.config.js",
      "tests/agent-loop.test.ts",
      "tests/agent-runtime.test.ts",
      "tests/context-assembler.test.ts",
      "tests/execution-flow.test.ts",
      "tests/execution-strategy-selector.test.ts",
      "tests/observability-boundaries.test.ts",
      "tests/planning-flow.test.ts",
      "tests/result-normalizer-and-metrics.test.ts",
      "tests/runtime-api-lifecycle.test.ts",
      "tests/runtime-memory-and-retrieval.test.ts",
      "tests/session-transcript-store.test.ts",
      "tests/terminal-session-cli.test.ts",
      "tests/terminal-session-demo.test.ts",
      "tests/trace-recorder.test.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: tseslint.configs.recommendedTypeChecked,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
