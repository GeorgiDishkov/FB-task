/**
 * The UI's model. camelCase, produced by the mapper in services/swapi.ts — nothing
 * outside services/ ever sees the API's snake_case shape. See plan/FE/08-types.md.
 */
export interface Person {
  /** Derived from the API's `url`; the API has no id field and `name` is not unique. */
  id: string;
  name: string;
  height: string;
  mass: string;
  hairColor: string;
  skinColor: string;
}

export interface PeoplePage {
  people: Person[];
  totalCount: number;
  totalPages: number;
  page: number;
}
