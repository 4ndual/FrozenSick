import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { getDefaultBranch, invalidateCache } from '$lib/server/github-content';

const API = 'https://api.github.com';

function getOwner() {
  return env.PUBLIC_GITHUB_OWNER || '4ndual';
}

function getRepo() {
  return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}

function repoUrl() {
  return `${API}/repos/${getOwner()}/${getRepo()}`;
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');

  const body = await request.json();
  const branch = body.branch as string | undefined;
  if (!branch) throw error(400, 'Missing branch');

  const defaultBranch = getDefaultBranch();
  if (branch === defaultBranch) {
    return json({
      updated: false,
      reason: 'Published branch is already up to date.',
    });
  }

  const mergeRes = await fetch(`${repoUrl()}/merges`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      base: branch,
      head: defaultBranch,
      commit_message: 'Update from published',
    }),
  });

  if (mergeRes.status === 204) {
    await invalidateCache(branch);
    return json({ updated: true, reason: 'Already up to date.' });
  }
  if (mergeRes.status === 409) {
    return json({
      updated: false,
      reason: 'Conflicts detected. Your timeline branch conflicts with published changes.',
    });
  }
  if (!mergeRes.ok) {
    const err = await mergeRes.json().catch(() => ({}));
    throw error(502, (err as { message?: string }).message || 'Failed to update timeline branch');
  }

  await invalidateCache(branch);
  return json({ updated: true });
};
