/**
 * Auth.js route handler (TRE-63). Exposes the OAuth callback / sign-in /
 * sign-out endpoints. node:sqlite (via the auth bootstrap callbacks) requires
 * the Node runtime.
 */
export const runtime = 'nodejs';

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
