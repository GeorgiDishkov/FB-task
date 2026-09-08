# FE 01 · Project setup & tooling

## Scaffold

```bash
npm create vite@latest . -- --template react-ts
```

The template already ships React 19. Confirm the majors and add the router:

```bash
npm i react@19 react-dom@19 react-router-dom@7
npm i -D @types/react@19 @types/react-dom@19
```

## Dependencies

**Runtime — three, total:**

| Package | Version | Reason |
|---|---|---|
| `react` / `react-dom` | `19.x` | requested |
| `react-router-dom` | `^7.x` | required by the task; declarative `<Routes>` mode only |

**Dev:**

| Package | Reason |
|---|---|
| `vite`, `@vitejs/plugin-react` | build/dev server |
| `typescript`, `@types/*` | types |
| `sass` (dart-sass) | SCSS compilation — Vite handles `.module.scss` natively once `sass` is present |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | code quality is graded; the hooks plugin catches dependency bugs, `jsx-a11y` catches label/aria mistakes |
| `prettier` | consistent formatting so the diff is about logic |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | the two unit test files in [09-testing-qa.md](09-testing-qa.md) |

> ⚠️ Do **not** install `node-sass`. Use `sass`, and write modern
> `@use` / `@forward` — `@import` is deprecated in Dart Sass and will warn loudly
> (and is slated for removal), which looks sloppy in a reviewed build log.

## `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const resolvePath = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolvePath('./src'),
      '@components': resolvePath('./src/components'),
      '@pages': resolvePath('./src/pages'),
      '@hooks': resolvePath('./src/hooks'),
      '@services': resolvePath('./src/services'),
      '@lib': resolvePath('./src/lib'),
      '@types': resolvePath('./src/types'),
      '@styles': resolvePath('./src/styles'),
      '@assets': resolvePath('./src/assets'),
      '@context': resolvePath('./src/context'),
      '@routes': resolvePath('./src/routes'),
    },
  },
  css: {
    modules: {
      // styles.tableWrapper instead of styles['table-wrapper']
      localsConvention: 'camelCaseOnly',
      // readable, debuggable class names in devtools
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
});
```

Deliberately **no** `additionalData` auto-injection of tokens. Every SCSS module
declares its own `@use 'tokens' as tokens;`. Implicit globals are exactly the
"where did this variable come from" mess we're avoiding.

> **Phase 0 outcome:** rather than relying on Vite's `resolve.alias` reaching the Sass
> importer, `css.preprocessorOptions.scss.loadPaths` points at `src/styles`. Every module
> then writes a bare `@use 'tokens' as tokens;` from any depth — no `@styles/` prefix, no
> relative `../../`, and no dependence on alias handling inside Sass. Verified working in
> `App.module.scss` and `Spinner.module.scss`.

## `tsconfig.json` (the parts that matter)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,   // people[index] is Person | undefined — forces real guards
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,        // `import type` stays explicit
    "isolatedModules": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@pages/*": ["./src/pages/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@services/*": ["./src/services/*"],
      "@lib/*": ["./src/lib/*"],
      "@types/*": ["./src/types/*"],
      "@styles/*": ["./src/styles/*"],
      "@assets/*": ["./src/assets/*"],
      "@context/*": ["./src/context/*"],
      "@routes/*": ["./src/routes/*"]
    }
  },
  "include": ["src"]
}
```

`paths` here and `alias` in `vite.config.ts` must stay in sync — TS resolves types,
Vite resolves the actual bundle. One without the other gives you red squiggles that
build fine, or a clean editor that fails at build.

> ⚠️ `@types/*` as an alias shadows nothing at runtime, but some editors get confused
> because `@types` is also the npm scope for DefinitelyTyped folders. If that bites,
> rename the alias to `@app-types/*` — decided in Phase 0, applied consistently.

## `package.json` scripts

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`build` running `tsc -b` first means a type error fails the build — Vite alone would
happily ship it, since esbuild strips types without checking them.

## Env / constants

No `.env` needed — the SWAPI base URL is public and constant. It still goes in one place:

```ts
// src/services/constants.ts
export const SWAPI_BASE_URL = 'https://swapi.py4e.com/api';
export const REQUEST_TIMEOUT_MS = 10_000;
export const PAGE_SIZE = 10; // fixed by the API, not by us
```

## Phase 0 exit criteria

- [ ] `npm run dev` serves a page styled from `_tokens.scss` via a `.module.scss` file
- [ ] one alias import (`@styles/...` in SCSS **and** `@components/...` in TS) proven to resolve
- [ ] `npm run build` and `npm run lint` both exit 0
- [ ] `npm run test` runs (one trivial passing test) so the harness is known-good
