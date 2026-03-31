import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('gh_oauth_state');
  const returnTo = cookies.get('gh_oauth_return_to') || '/';

  // Clear the cookies
  cookies.delete('gh_oauth_state', { path: '/' });
  cookies.delete('gh_oauth_return_to', { path: '/' });

  if (!code || !state || state !== storedState) {
    return new Response(JSON.stringify({ error: 'Invalid OAuth state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return new Response(JSON.stringify({ error: tokenData.error_description || 'OAuth failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  cookies.set('gh_token', tokenData.access_token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: 60 * 60 * 24 * 30,
  });

  const redirectUrl = new URL(returnTo, url);
  redirectUrl.hash = `token=${encodeURIComponent(tokenData.access_token)}`;

  throw redirect(302, redirectUrl.toString());
};
