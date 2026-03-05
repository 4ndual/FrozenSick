import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    throw error(400, 'Missing code or state');
  }

  const storedState = cookies.get('gh_oauth_state');
  if (storedState !== state) {
    throw error(403, 'Invalid state — possible CSRF');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    throw error(400, `OAuth error: ${tokenData.error_description}`);
  }

  const returnTo = cookies.get('gh_oauth_return_to') || '';
  const redirectPath = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/timeline/';
  const location = redirectPath + '#token=' + encodeURIComponent(tokenData.access_token);

  // Clear cookies
  cookies.delete('gh_oauth_state', { path: '/' });
  cookies.delete('gh_oauth_return_to', { path: '/' });

  throw redirect(302, location);
};
