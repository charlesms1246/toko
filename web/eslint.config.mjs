import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Phase 0 recon scripts. They read loosely-typed indexer rows off the
    // markets-sdk (`listLiveBinaryMarkets`, `getPortfolio`, …) whose shapes the
    // SDK narrows only at its own boundary, so `any` at the read edge is the
    // honest annotation rather than a fabricated interface. Node tooling, not
    // app source — the browser rules do not apply.
    files: ["scripts/**/*.mts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
