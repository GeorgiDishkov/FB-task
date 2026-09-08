/**
 * The wire contract, re-exported from the workspace package so the client and server
 * cannot drift on the response shape. See plan/BE/README.md.
 */
export type { SwapiPageDto, SwapiPeoplePageDto, SwapiPersonDto } from '@fib/shared';

/** Every error response uses this envelope, so the client has one shape to parse. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
