import type { RouteData } from 'astro';
import type { Route } from './routes.ts';
import type { StarlightRouteData } from './utils/route-data.ts';

export type AllRoutesHook = (routes: Route[]) => Promise<Route[]> | Route[];

export const defineAllRoutesHook = (hook: AllRoutesHook) => hook;

export type RouteHook = (route: Route) => Promise<Route | void> | Route | void;

export const defineRouteHook = (hook: RouteHook) => hook;

export type RouteDataHook = (routeData: StarlightRouteData) => Promise<RouteData> | RouteData;

export const defineRouteDataHook = (hook: RouteDataHook) => hook;
