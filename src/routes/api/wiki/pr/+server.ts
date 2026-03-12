import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { assertCanManageContentBranch, resolveAuthzContext } from '$lib/server/authz';

const API = 'https://api.github.com';

function getOwner() {
  return env.PUBLIC_GITHUB_OWNER || '4ndual';
}
function getRepo() {
  return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');
  const context = await resolveAuthzContext(token);

  const body = await request.json();
  const { title, head, base, prBody } = body as {
    title: string;
    head: string;
    base: string;
    prBody: string;
  };

  if (!title || !head || !base) {
    throw error(400, 'Missing required fields: title, head, base');
  }
  if (!head.startsWith('content/')) {
    throw error(403, 'Only content branches can be opened for review.');
  }
  assertCanManageContentBranch(context, head);

  const ghRes = await fetch(
    `${API}/repos/${getOwner()}/${getRepo()}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, head, base, body: prBody }),
    },
  );

  if (ghRes.status === 422) {
    const ghBody = await ghRes.json().catch(() => ({ errors: [] }));
    const errors = (ghBody as { errors?: { message?: string }[] }).errors ?? [];
    if (errors.some((e) => e.message?.includes('pull request already exists'))) {
      return json({ alreadyExists: true });
    }
    return json(
      { error: (ghBody as { message?: string }).message || 'Could not create pull request' },
      { status: 422 },
    );
  }

  if (!ghRes.ok) {
    const ghBody = await ghRes.json().catch(() => ({}));
    return json(
      { error: (ghBody as { message?: string }).message || 'Failed to create pull request' },
      { status: ghRes.status },
    );
  }

  const pr = await ghRes.json();
  return json({ url: pr.html_url });
};
