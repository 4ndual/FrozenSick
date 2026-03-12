import { json, type Cookies } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function clearAuthCookie(cookies: Cookies) {
  cookies.delete('gh_token', { path: '/' });
}

export const POST: RequestHandler = async ({ cookies }) => {
  clearAuthCookie(cookies);
  return json({ ok: true });
};

export const GET: RequestHandler = async ({ cookies }) => {
  clearAuthCookie(cookies);
  return json({ ok: true });
};
