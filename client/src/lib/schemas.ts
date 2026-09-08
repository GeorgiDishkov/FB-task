import Joi from 'joi';

import type { PeoplePage } from '@/types';

const personSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  height: Joi.string().required(),
  mass: Joi.string().required(),
  hairColor: Joi.string().required(),
  skinColor: Joi.string().required(),
});

export const peoplePageSchema = Joi.object<PeoplePage, true>({
  people: Joi.array().items(personSchema).required(),
  totalCount: Joi.number().integer().min(0).required(),
  totalPages: Joi.number().integer().min(0).required(),
  page: Joi.number().integer().min(1).required(),
});

/**
 * `convert: false`, unlike everywhere else in the app.
 *
 * A cache read is verification, not parsing: the question is whether the stored value is
 * *already* the right shape, not whether Joi can coerce it into one. With Joi's default
 * `convert: true`, a hand-edited `totalCount: "87"` would validate and then flow into
 * the UI as a string.
 *
 * Wrapped as a type predicate so `readCache` returns `PeoplePage` with no cast.
 */
export const isPeoplePage = (value: unknown): value is PeoplePage =>
  peoplePageSchema.validate(value, { convert: false }).error === undefined;
