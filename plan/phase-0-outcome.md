# Phase 0 · Outcome and deviations

Status: **complete and verified.** `npm run build`, `npm run lint`, `npm test` and
`npm ci` all exit 0; the dev server renders with tokens, SCSS modules and aliases
resolving.

The current `npm create vite@latest` template ships a newer toolchain than
[tech-stack.md](tech-stack.md) named. Everything below is what is actually installed —
this file is the source of truth for versions; the stack doc remains the source of truth
for *choices*.

## Versions installed (vs. planned)

| Package | Planned | Installed | Note |
|---|---|---|---|
| `react` / `react-dom` | 19.x | **19.2.8** | as planned |
| `vite` | 7 | **8.2.2** | template default; Node 22.14 clears its floor |
| `typescript` | 5.x | **~6.0.2** | template default; `typescript-eslint` peers `<6.1.0`, so supported |
| `react-router-dom` | ^7.x | **7.9.6** | as planned |
| `joi` | ^17 | **17.13.3** | as planned |
| `@tanstack/react-table` | ^8 | **8.21.3** | as planned |
| `sass` | latest | **1.94.1** | Dart Sass |
| `vitest` | latest | **5.0.0** | peers Vite ^8 ✓ |
| `eslint` | 9 | **9.39.5** | deliberately pinned to 9 — see below |
| `typescript-eslint` | ^8 | **8.69.0** | supports ESLint 10 and TS 6 |
| `eslint-plugin-react-hooks` | latest | **7.1.1** | |
| `eslint-plugin-jsx-a11y` | latest | **6.10.2** | the reason ESLint stays on 9 |

## Decisions taken during Phase 0

### 1. ESLint 9, not 10 — `jsx-a11y` caps the version

ESLint 10.9.1 is current, and `typescript-eslint` and `react-hooks` both support it. But
`eslint-plugin-jsx-a11y`'s newest release (6.10.2) declares
`peerDependencies: { eslint: '^3 || … || ^9' }` — no ESLint 10.

Options were: force the peer with an override (ESLint 10 removed context APIs that older
plugins may still call, so rules could crash at lint time), drop a11y linting entirely,
or stay on ESLint 9. **Chose ESLint 9.** Automated accessibility rules are worth more on
an assessment graded partly on code quality than a clean `npm install` log, and the
tradeoff is a dev-dependency support notice, not a vulnerability.

`npm install` therefore prints `npm warn deprecated eslint@9.39.5`. Deliberate; revisit
when jsx-a11y widens its peer range.

### 2. ESLint replaces the template's oxlint

`create-vite` now scaffolds **oxlint** instead of ESLint. Removed it (`.oxlintrc.json`
deleted, dep dropped) because [AGENT.md §7](../AGENT.md) is written in ESLint rule
vocabulary — including `no-restricted-syntax` with an AST selector and
`@typescript-eslint/consistent-type-imports`. Guessing at oxlint's coverage of each would
risk silently unenforced rules.

**All AGENT.md rules verified firing** with a deliberate-violation probe:
`no-restricted-syntax` (default export), `id-length`, `no-explicit-any`, `max-depth`,
`no-nested-ternary`, `react-hooks/rules-of-hooks`. Type-aware linting is on
(`recommendedTypeChecked` + `projectService`).

### 3. `shared/` is types-only, with zero dependencies

[tech-stack.md](tech-stack.md) planned `shared/` to hold both the wire types and the Joi
schemas. In practice the two schemas have **no shared consumer**: `loginSchema` is
client-only (there is no login endpoint) and `peopleQuerySchema` is server-only.

So `shared/` carries only `SwapiPersonDto` / `SwapiPageDto` — the actual contract — and
declares no dependencies. This removes the "shared now carries runtime code, so it needs
a build" problem the stack doc flagged: types erase completely, so both workspaces just
compile the source through the workspace symlink. `loginSchema` lives in
`client/src/lib/validation.ts`, `peopleQuerySchema` in `server/src/`.

Verified: `client/src/services/types.ts` re-exports from `@fib/shared` and `tsc -b` resolves it.

### 4. SCSS: `loadPaths`, not an alias

`css.preprocessorOptions.scss.loadPaths = ['src/styles']`, so every module writes a bare
`@use 'tokens' as tokens;` at any depth. No `@styles/` prefix inside Sass, no `../../`,
and no dependence on Vite's alias reaching the Sass importer. The `@styles` **TS/JS**
alias still exists for importing stylesheets from TypeScript.

### 5. Dropped the `@types/*` alias

The stack doc flagged that `@types` collides conceptually with the DefinitelyTyped scope.
Rather than renaming it to `@app-types`, the alias is **gone**: shared types are reached
via the existing `@/*` alias as `@/types`. One less alias, no shadowing question.

### 6. No `baseUrl` in tsconfig

TS 6 raises `TS5083: Option 'baseUrl' is deprecated`. Removed it instead of silencing with
`ignoreDeprecations` — `paths` resolve relative to the tsconfig file, which is what we want.

### 7. Server scripts deferred to Phase 1

`server/package.json` declares its dependencies now (so the workspace installs once) but
has **no scripts** — `tsc -b` on an empty `src/` fails, and `--if-present` skips it
cleanly. Phase 1 adds the scripts alongside the code.

Consequence: root `npm run dev` currently runs the client only. `dev:all` (the
`concurrently` version) is wired and waits on Phase 1.

## One real risk found

**A cold `npm install` with no lockfile fails on this npm version.** npm 10.9.2's arborist
throws `TypeError: Cannot read properties of null (reading 'edgesOut')` in `#loadPeerSet`
while walking Vitest's large optional-peer set (`@vitest/browser-*`, `@edge-runtime/vm`,
`@vitest/coverage-*`).

- `npm ci` from the committed lockfile: **works** (verified — it does not build an ideal
  tree from registry metadata).
- `npm install` with the lockfile present: **works**.
- `npm install` after deleting the lockfile: **fails**.

Mitigation: **commit `package-lock.json`** (already in place; not git-ignored) and have
the repo README tell contributors to run `npm ci`. Worth stating explicitly because
"fresh clone actually starts" is a pre-submission check in
[FE/10-delivery.md](FE/10-delivery.md).

## Files created

```
package.json                 workspaces root: shared, client, server
package-lock.json            committed — see the risk above
.gitignore  .editorconfig  .prettierrc  .prettierignore
shared/  package.json + src/{types,index}.ts        wire contract, no deps
server/  package.json                               deps only; code in Phase 1
client/
  package.json  vite.config.ts  eslint.config.js
  tsconfig.json / tsconfig.app.json / tsconfig.node.json
  index.html                                        title + description + color-scheme
  src/
    main.tsx  App.tsx  App.module.scss
    components/ui/Spinner/{Spinner.tsx,Spinner.module.scss,types.ts,index.ts,Spinner.test.tsx}
    services/types.ts                               re-exports @fib/shared
    styles/{_tokens,_breakpoints,_mixins,global}.scss
    test/setup.ts
.claude/launch.json                                 dev-server config for the preview pane
```

`Spinner` is a real planned component built to the AGENT.md §4 folder contract rather than
throwaway scaffolding, and its two tests prove the jsdom + Testing Library harness works.
`App.tsx` is an explicit placeholder, replaced in Phase 2.

## Verified

- [x] `npm run build` — `tsc -b` clean, Vite bundle 191 kB / 60 kB gzipped
- [x] `npm run lint` — 0 errors, 0 warnings at `--max-warnings 0`
- [x] `npm test` — 2 passing
- [x] `npm ci` — clean install from lockfile
- [x] `npx prettier --check .` — clean
- [x] Aliases resolve: `@components/ui/Spinner` in TSX, `@fib/shared` via `@services/types`
- [x] SCSS `@use 'tokens'` / `'mixins'` / `'breakpoints'` all resolve via `loadPaths`
- [x] Class names are traceable: `App-module__card___HPkww`
- [x] Tokens applied at runtime: `body` background `rgb(11, 15, 26)` = `--c-bg`
- [x] `respond-to('sm')` fires: card padding 32px ≥480px, 24px below
- [x] `visually-hidden` works: status label measures 1px wide, still in the a11y tree
- [x] No console errors; no horizontal overflow at 375px
- [x] Every AGENT.md §7 rule confirmed firing on a violation probe

## Not done in Phase 0

- `git init` and the first commit — not requested; the repo is still un-versioned.
- `.env` files for `VITE_API_BASE_URL`. Added in Phase 4 with the service layer; the
  default stays **SWAPI** per your call.
