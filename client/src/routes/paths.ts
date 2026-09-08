export const ROUTES = {
  login: '/',
  table: '/table',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
