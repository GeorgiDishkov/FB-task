import type { PeoplePage, Person } from '@/types';

import { DATA_BASE_URL, PAGE_SIZE } from './constants';
import { requestJson } from './http';
import type { SwapiPeoplePageDto, SwapiPersonDto } from './types';

/**
 * The trailing slash is deliberate: the Star Wars API 301-redirects the unslashed form,
 * which costs a round trip on every request. Our own backend accepts both.
 */
const peopleUrl = (page: number): string =>
  `${DATA_BASE_URL}/people/?page=${String(page)}`;

/**
 * The API has no id field and `name` is not guaranteed unique, but `url`
 * (".../people/13/") is — so the trailing path segment becomes the row id. Using the
 * array index instead would break the moment rows are ever sorted.
 *
 * Both data sources return the same `url`, so an id is identical either way.
 */
const idFromUrl = (url: string): string => {
  const segments = url.split('/').filter(Boolean);

  return segments.at(-1) ?? url;
};

/**
 * The one place snake_case appears outside the DTO types. If the API renames a field,
 * this mapper changes and no component does.
 */
const mapPerson = (dto: SwapiPersonDto): Person => ({
  id: idFromUrl(dto.url),
  name: dto.name,
  height: dto.height,
  mass: dto.mass,
  hairColor: dto.hair_color,
  skinColor: dto.skin_color,
});

const mapPeoplePage = (dto: SwapiPeoplePageDto, page: number): PeoplePage => ({
  people: dto.results.map(mapPerson),
  totalCount: dto.count,
  // Derived from count rather than trusting `next`/`previous`, so the pagination
  // controls always agree with the dataset size.
  totalPages: Math.max(1, Math.ceil(dto.count / PAGE_SIZE)),
  page,
});

export const getPeoplePage = async (
  page: number,
  signal?: AbortSignal,
): Promise<PeoplePage> => {
  const dto = await requestJson<SwapiPeoplePageDto>(peopleUrl(page), signal);

  return mapPeoplePage(dto, page);
};
