// Pure helpers for what the user assistant is allowed to know about the session.
// Only routes and failed-request metadata are kept: never bodies, headers or tokens.

export interface AssistantErrorInfo {
  status: number;
  method: string;
  url: string;
  at: string;
}

export interface AssistantContextSnapshot {
  route: string;
  recentRoutes: string[];
  lastError: AssistantErrorInfo | null;
}

export const MAX_RECENT_ROUTES = 10;

/** Appends keeping only the last `max` items, without mutating the input. */
export function pushBounded<T>(items: readonly T[], item: T, max: number): T[] {
  const next = [...items, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Query strings and fragments can carry identifiers or tokens: they never enter the context. */
export function stripQuery(url: string): string {
  return url.split(/[?#]/)[0];
}
