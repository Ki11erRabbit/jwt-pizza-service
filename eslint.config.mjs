import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {files: ["**/*.js"], languageOptions: {sourceType: "commonjs"}},
  {languageOptions: { globals: globals.node }},
  {languageOptions: { globals: globals.jest }},
  pluginJs.configs.recommended,
  { ignores: ["config.js"] },
  { ignores: ["*.test.js"] }
];
