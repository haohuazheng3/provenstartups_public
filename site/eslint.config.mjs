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
    // 自托管的 Clerk 浏览器包是第三方压缩产物(scripts/vendor-clerk.mjs 拷进来的),不是我们的源码
    "public/clerk-bundle/**",
  ]),
]);

export default eslintConfig;
