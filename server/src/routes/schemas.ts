import Joi from 'joi';

export interface PeopleQuery {
  page: number;
}

/**
 * `Joi.number()` with Joi's default `convert: true` turns the `"2"` Express hands us into
 * `2`, so no handler parses a string itself. `.default(1)` covers an omitted page.
 * `.integer()` is what rejects `"1.5"`, which a bare `Number()` check would let through.
 *
 * Typed as `<PeopleQuery, true>` so `validate()` returns `PeopleQuery` rather than `any` —
 * untyped, every read would silently opt out of the type system.
 */
export const peopleQuerySchema = Joi.object<PeopleQuery, true>({
  page: Joi.number().integer().min(1).default(1),
});
