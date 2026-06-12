/**
 * Trivial in-memory auth for the demo target. No DB, no hashing — the only goal
 * is a realistic login *gate* that Playwright can exercise (and that Argus can
 * write tests for). The accepted credentials are fixed and documented on the
 * login page so the flow is fully deterministic.
 */

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demo';

/** Name of the cookie that marks a session as authenticated. */
export const SESSION_COOKIE = 'argus_session';

/** Validate submitted credentials against the fixed demo account. */
export function isValidLogin(username: string, password: string): boolean {
  return username === DEMO_USERNAME && password === DEMO_PASSWORD;
}
