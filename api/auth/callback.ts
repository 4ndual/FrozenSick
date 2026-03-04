declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) out[key] = rest.join('=');
  }
  return out;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  const cookies = parseCookies(req.headers.get('cookie'));
  if (cookies.gh_oauth_state !== state) {
    return new Response('Invalid state — possible CSRF', { status: 403 });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    return new Response(`OAuth error: ${tokenData.error_description}`, { status: 400 });
  }

  const clearCookie = 'gh_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/timeline/#token=${tokenData.access_token}`,
      'Set-Cookie': clearCookie,
    },
  });
}
