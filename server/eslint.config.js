import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { agentRules } from '../eslint.rules.js';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'data/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: agentRules,
  },

  {
    // This config file itself is plain JS and outside any tsconfig project.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
