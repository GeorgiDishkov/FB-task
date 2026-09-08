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

export interface LoginBody {
  username: string;
  password: string;
}

export const FIELD_MIN_LENGTH = 4;
export const FIELD_MAX_LENGTH = 30;

/**
 * Mirrors the client's field rules, because a client-side-only check is a UX affordance
 * rather than validation. Note the asymmetry: .trim() on username, none on password —
 * trailing spaces in a username are a typo, in a password they are legitimate
 * characters. See plan/FE/03-login-form.md.
 */
export const loginSchema = Joi.object<LoginBody, true>({
  username: Joi.string().trim().min(FIELD_MIN_LENGTH).max(FIELD_MAX_LENGTH).required(),
  password: Joi.string().min(FIELD_MIN_LENGTH).max(FIELD_MAX_LENGTH).required(),
});
