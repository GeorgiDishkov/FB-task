/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Our own API — auth always goes here, regardless of the data source. */
  readonly VITE_SERVER_BASE_URL?: string;
  /** Where people data comes from. Defaults to SWAPI; see plan/tech-stack.md. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
