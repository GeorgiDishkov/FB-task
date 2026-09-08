import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { agentRules } from '../eslint.rules.js';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.d.ts'] },

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
    // AGENT.md §8 exception. The complexity rule counts every &&, ?., ?? and ternary,
    // which are the idiomatic way to express conditional rendering — a component with
    // three independent optional regions scores 14 with no nesting at all. The metric
    // was designed for imperative branching, and max-depth: 1 plus no-nested-ternary
    // already prevent the problem it was meant to catch. Still enforced at 8 for .ts.
    files: ['**/*.tsx'],
    rules: { complexity: 'off' },
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
