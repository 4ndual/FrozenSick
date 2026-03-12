import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { invalidateCache } from '$lib/server/github-content';
import { resolveEntryPath, assertBranchMatchesPath } from '$lib/server/wiki-entry';

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

  const body = await request.json();
  const { path, content, sha, branch, message } = body as {
    path: string;
    content: string;
    sha: string;
    branch: string;
    message: string;
  };

  if (!path || !sha || !branch) {
    throw error(400, 'Missing required fields: path, sha, branch');
  }
  const resolved = resolveEntryPath(path, 'md');
  assertBranchMatchesPath(branch, resolved.path);

  const encodedPath = resolved.path
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const ghRes = await fetch(
    `${API}/repos/${getOwner()}/${getRepo()}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message || `Edit: ${resolved.path.split('/').pop()}`,
        content: btoa(unescape(encodeURIComponent(content))),
        sha,
        branch,
      }),
    },
  );

  if (ghRes.status === 409) {
    return json(
      { error: 'File was changed on GitHub. Reload and try again.' },
      { status: 409 },
    );
  }

  if (!ghRes.ok) {
    const ghBody = await ghRes.json().catch(() => ({}));
    return json(
      { error: (ghBody as { message?: string }).message || 'Save failed' },
      { status: ghRes.status },
    );
  }

  const data = await ghRes.json();
  await invalidateCache(branch);
  return json({
    sha: data.content?.sha,
    commit: data.commit?.sha,
  });
};
