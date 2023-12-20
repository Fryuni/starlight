import type { Route } from './routes.ts';

export type RouteHook = (route: Route) => Promise<Route | void> | Route | void;

export const defineRouteHook = (hook: RouteHook) => hook;
