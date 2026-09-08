/**
 * The HTTP wire contract between the client and the server.
 *
 * These mirror the Star Wars API response shape exactly (snake_case, every value a
 * string), because our own backend serves the identical shape. That is what makes the
 * data source a one-line env switch with a single client-side mapper.
 * See plan/BE/README.md.
 *
 * The camelCase `Person` / `PeoplePage` UI models are deliberately NOT here — they are
 * the client's internal representation. See plan/FE/08-types.md.
 */

export interface SwapiPersonDto {
  name: string;
  height: string;
  mass: string;
  hair_color: string;
  skin_color: string;
  /** Canonical resource URL, e.g. "https://swapi.py4e.com/api/people/13/". */
  url: string;
}

export interface SwapiPageDto<Item> {
  count: number;
  next: string | null;
  previous: string | null;
  results: Item[];
}

export type SwapiPeoplePageDto = SwapiPageDto<SwapiPersonDto>;
