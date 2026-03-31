import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GITHUB_CLIENT_ID } from '$env/static/private';

export const GET: RequestHandler = ({ url, cookies }) => {
  if (!GITHUB_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'GITHUB_CLIENT_ID not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redirectUri = `${url.protocol}//${url.host}/api/auth/callback`;
  const state = crypto.randomUUID();
  const returnTo = url.searchParams.get('return_to') || '/';

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo');
  authorizeUrl.searchParams.set('state', state);

  // Set cookies
  cookies.set('gh_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 600,
  });

  cookies.set('gh_oauth_return_to', returnTo, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 600,
  });

  throw redirect(302, authorizeUrl.toString());
};
