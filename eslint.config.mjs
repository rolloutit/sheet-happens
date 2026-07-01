import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "src/server/db/generated/**",
      "storybook-static/**",
      "test-results/**",
    ],
  },
  ...nextVitals,
  ...nextTypeScript,
  ...storybook.configs["flat/recommended"],
];

export default eslintConfig;
