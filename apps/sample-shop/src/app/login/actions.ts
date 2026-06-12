'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, isValidLogin } from '@/lib/auth';

export interface LoginState {
  error: string | null;
}

/**
 * Server Action backing the login form. On valid credentials it sets the session
 * cookie and redirects to /products; otherwise it returns an error for the form
 * to display. Kept deliberately simple — see src/lib/auth.ts.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!isValidLogin(username, password)) {
    return { error: 'Invalid username or password.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, username, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  redirect('/products');
}
