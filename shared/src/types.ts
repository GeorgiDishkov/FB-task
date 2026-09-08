export interface SwapiPersonDto {
  name: string;
  height: string;
  mass: string;
  hair_color: string;
  skin_color: string;
  url: string;
}

export interface SwapiPageDto<Item> {
  count: number;
  next: string | null;
  previous: string | null;
  results: Item[];
}

export type SwapiPeoplePageDto = SwapiPageDto<SwapiPersonDto>;
