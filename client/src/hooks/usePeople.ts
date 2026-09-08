import { useCallback, useEffect, useReducer, useState } from 'react';

import { toAppError } from '@lib/errors';
import type { AppError } from '@lib/errors';
import { clearPeopleCache, getPeoplePage } from '@services/swapi';
import type { PeoplePage } from '@/types';

/**
 * A discriminated union, not `{ isLoading, data?, error? }`. That shape permits
 * `isLoading: true` with both a value and an error — a state that means nothing — and
 * forces `data?.people` at every use. This makes the impossible states unrepresentable,
 * so inside a 'success' branch `state.data.people` needs no optional chain.
 *
 * `data` is deliberately kept on 'loading' and 'error': that is what allows the table to
 * stay on screen, dimmed, during a page change instead of collapsing to a skeleton, and
 * to remain readable behind an error banner.
 *
 * `cachedAt` rides alongside rather than inside PeoplePage — where the copy came from is
 * a transport concern, not part of the domain model.
 */
export type PeopleState =
  | { status: 'idle'; data: null; cachedAt: null; error: null }
  | { status: 'loading'; data: PeoplePage | null; cachedAt: number | null; error: null }
  | { status: 'success'; data: PeoplePage; cachedAt: number | null; error: null }
  | {
      status: 'error';
      data: PeoplePage | null;
      cachedAt: number | null;
      error: AppError;
    };

type PeopleAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: PeoplePage; cachedAt: number | null }
  | { type: 'FETCH_ERROR'; error: AppError };

const INITIAL_STATE: PeopleState = {
  status: 'idle',
  data: null,
  cachedAt: null,
  error: null,
};

/**
 * useReducer rather than several useState calls: status, data and error must always
 * change together, and separate setters invite a render where status is 'success' but
 * data is still null.
 */
const peopleReducer = (state: PeopleState, action: PeopleAction): PeopleState => {
  switch (action.type) {
    case 'FETCH_START':
      return {
        status: 'loading',
        data: state.data,
        cachedAt: state.cachedAt,
        error: null,
      };
    case 'FETCH_SUCCESS':
      return {
        status: 'success',
        data: action.data,
        cachedAt: action.cachedAt,
        error: null,
      };
    case 'FETCH_ERROR':
      return {
        status: 'error',
        data: state.data,
        cachedAt: state.cachedAt,
        error: action.error,
      };
  }
};

interface UsePeopleResult {
  state: PeopleState;
  retry: () => void;
  /** Discards every cached page and refetches the current one. */
  refresh: () => void;
}

export const usePeople = (page: number): UsePeopleResult => {
  const [state, dispatch] = useReducer(peopleReducer, INITIAL_STATE);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    dispatch({ type: 'FETCH_START' });

    getPeoplePage(page, controller.signal)
      .then((result) => {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_SUCCESS',
            data: result.data,
            cachedAt: result.cachedAt,
          });
        }
      })
      .catch((error: unknown) => {
        const appError = toAppError(error);

        // Never surface our own cancellation: an aborted request is us switching pages,
        // not a failure, and showing it would flash an error on every fast click.
        if (!cancelled && appError.kind !== 'aborted') {
          dispatch({ type: 'FETCH_ERROR', error: appError });
        }
      });

    // Aborting here is what prevents the classic race: click page 2 then 3 quickly and,
    // without it, page 2's late response can land after page 3's and render the wrong
    // data. StrictMode's double-invocation in development makes this mandatory, not
    // merely tidy.
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, reloadKey]);

  // Bumping a key re-runs the effect, so both of these go through exactly the same code
  // path as a normal load — including the abort handling. One path, one set of bugs.
  const retry = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  const refresh = useCallback(() => {
    clearPeopleCache();
    setReloadKey((current) => current + 1);
  }, []);

  return { state, retry, refresh };
};
