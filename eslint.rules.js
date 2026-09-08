/**
 * The mechanically-enforceable half of AGENT.md, shared by every workspace's ESLint
 * config so the rules exist in exactly one place. Rule groups are labelled with the
 * AGENT.md section they come from, so the two stay traceable.
 */
export const agentRules = {
  /* AGENT.md §1 — whole words, never single characters */
  'id-length': [
    'error',
    {
      min: 3,
      exceptions: ['id', '_'],
      properties: 'never',
    },
  ],

  /* AGENT.md §3 — no nested loops or conditions */
  'max-depth': ['error', 1],
  'max-nested-callbacks': ['error', 2],
  'no-nested-ternary': 'error',
  'no-lonely-if': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  complexity: ['warn', 8],

  /* AGENT.md §2 — don't over-engineer functions */
  'max-params': ['warn', 4],
  'max-lines-per-function': [
    'warn',
    { max: 60, skipBlankLines: true, skipComments: true },
  ],

  /* AGENT.md §6 — named exports only, no any, explicit type imports */
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ExportDefaultDeclaration',
      message: 'Named exports only (AGENT.md §6).',
    },
  ],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',

  // tsconfig's noUnusedParameters already exempts a leading underscore; this teaches the
  // lint rule the same convention. Needed for signatures whose arity is fixed by a
  // framework — Express identifies error middleware by its four parameters.
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
};
