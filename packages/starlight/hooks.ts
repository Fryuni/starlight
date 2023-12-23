import type { Route } from './routes.ts';
import type { StarlightRouteData } from './utils/route-data.ts';

type HookResult<T> = T | Promise<T>;

export type AllRoutesHook = (routes: Route[]) => HookResult<Route[]>;

export const defineAllRoutesHook = (hook: AllRoutesHook) => hook;

export type RouteHook = (route: Route) => HookResult<Route | void>;

export const defineRouteHook = (hook: RouteHook) => hook;

export type Sidebar = StarlightRouteData['sidebar'];

export type SidebarHook = (route: Route, sidebar: Sidebar) => HookResult<Sidebar>;

export const defineSidebarHook = (hook: SidebarHook) => hook;

export type RouteDataHook = (routeData: StarlightRouteData) => HookResult<StarlightRouteData>;

export const defineRouteDataHook = (hook: RouteDataHook) => hook;
