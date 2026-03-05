import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

const API = 'https://api.github.com';

function getOwner() {
  return env.PUBLIC_GITHUB_OWNER || '4ndual';
}
function getRepo() {
  return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}

const ALLOWED_PREFIXES = ['content/'];

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

  if (!ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
    throw error(403, `Write denied: path must start with ${ALLOWED_PREFIXES.join(' or ')}`);
  }

  const encodedPath = path
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
        message: message || `Edit: ${path.split('/').pop()}`,
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
  return json({
    sha: data.content?.sha,
    commit: data.commit?.sha,
  });
};
