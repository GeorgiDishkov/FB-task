export const ROUTES = {
  login: '/',
  register: '/register',
  table: '/table',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
