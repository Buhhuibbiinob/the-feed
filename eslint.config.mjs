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
    rules: {
      // Nearly every image on this site is user-uploaded and served from
      // Supabase storage - avatars, banners, covers, stickers. next/image
      // re-encodes what it optimizes, which drops the animation from GIF
      // avatars, and the sizes are set by whatever the member cropped
      // rather than known ahead of time. Plain <img> is the deliberate
      // choice here, so the warning was only ever hiding real ones.
      "@next/next/no-img-element": "off",
      // A server action's signature is fixed by the form that calls it,
      // so an unused leading argument is required, not dead. The
      // underscore marks that it is deliberate.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
