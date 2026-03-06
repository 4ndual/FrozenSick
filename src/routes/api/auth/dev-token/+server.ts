import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

/**
 * DEV ONLY: Set a GitHub token cookie without going through OAuth.
 * Usage: GET /api/auth/dev-token?token=github_pat_...
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  if (!dev) {
    return new Response('Not available in production', { status: 404 });
  }

  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token param', { status: 400 });
  }

  cookies.set('gh_token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 24,
  });

  throw redirect(302, '/');
};
