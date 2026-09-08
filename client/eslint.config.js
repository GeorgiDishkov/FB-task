import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { agentRules } from '../eslint.rules.js';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  jsxA11y.flatConfigs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...agentRules,

      /* React hooks discipline — plan/FE/00-architecture.md */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    // Vite and Vitest require a default export from their config files.
    files: ['vite.config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    // Tests describe cases in long table-driven blocks; length is not a smell there.
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },

  {
    // This config file itself is plain JS and outside any tsconfig project.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
