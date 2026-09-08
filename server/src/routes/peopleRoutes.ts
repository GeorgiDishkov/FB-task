import { Router } from 'express';
import type { Request, Response } from 'express';

import { PUBLIC_BASE_URL } from '../config.js';
import { getPeopleSlice, getTotalCount, getTotalPages } from '../store/peopleStore.js';
import type { ApiErrorBody } from '../types.js';

import { peopleQuerySchema } from './schemas.js';

const buildPageUrl = (page: number): string => `${PUBLIC_BASE_URL}/people/?page=${page}`;

/**
 * Returns the Star Wars API's exact wire shape, which is what makes the client's data
 * source a one-line env switch with a single mapper. See plan/BE/README.md.
 *
 * A page past the last one returns 200 with an empty `results` so the client can recover
 * from the body; only malformed input is a 400.
 */
export const getPeopleHandler = (request: Request, response: Response): void => {
  const result = peopleQuerySchema.validate(request.query, {
    convert: true,
    // Ignore stray query params rather than 400-ing on them.
    stripUnknown: true,
  });

  if (result.error) {
    const body: ApiErrorBody = {
      error: { code: 'INVALID_PAGE', message: 'page must be a positive integer.' },
    };

    response.status(400).json(body);
    return;
  }

  // Joi's ValidationResult is a discriminated union: `value` is only typed as
  // PeopleQuery once `error` has been narrowed to undefined. Destructuring both up
  // front would collapse it back to `any`.
  const { page } = result.value;
  const totalPages = getTotalPages();

  response.json({
    count: getTotalCount(),
    next: page < totalPages ? buildPageUrl(page + 1) : null,
    previous: page > 1 ? buildPageUrl(page - 1) : null,
    results: getPeopleSlice(page),
  });
};

export const peopleRouter = Router();

// Both spellings, because the Star Wars API 301-redirects the unslashed form and we
// mirror its behaviour without costing the client a round trip.
peopleRouter.get('/people', getPeopleHandler);
peopleRouter.get('/people/', getPeopleHandler);
