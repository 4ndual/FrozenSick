import type { RequestHandler } from './$types';
import { invalidateCache } from '$lib/server/github-content';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const secret = env.GITHUB_WEBHOOK_SECRET;

  if (secret) {
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    const body = await request.text();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = 'sha256=' + Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expected) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(body);
    const ref: string = payload.ref || '';
    const branch = ref.replace('refs/heads/', '');

    if (branch) {
      await invalidateCache(branch);
    }

    return new Response(JSON.stringify({ ok: true, branch }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // No secret configured -- accept all webhooks (dev mode)
  let payload: { ref?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const ref = payload.ref || '';
  const branch = ref.replace('refs/heads/', '');

  if (branch) {
    await invalidateCache(branch);
  }

  return new Response(JSON.stringify({ ok: true, branch }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
