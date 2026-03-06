import nkzw from "@nkzw/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [nkzw],
  rules: {
    "@nkzw/no-instanceof": "off",
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
    curly: "off",
    "no-console": "off",
    "perfectionist/sort-interfaces": "off",
    "perfectionist/sort-object-types": "off",
    "perfectionist/sort-objects": "off",
    "unicorn/catch-error-name": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/numeric-separators-style": "off",
    "unicorn/prefer-at": "off",
    "unicorn/prefer-node-protocol": "off",
    "unicorn/prefer-number-properties": "off",
    "unicorn/prefer-string-replace-all": "off",
    "unicorn/prefer-top-level-await": "off",
    "unicorn/text-encoding-identifier-case": "off",
  },
});
