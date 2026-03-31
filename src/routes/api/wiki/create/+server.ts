import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { invalidateCache } from '$lib/server/github-content';
import {
  resolveEntryPath,
  assertBranchMatchesPath,
  type WikiEntryFormat,
} from '$lib/server/wiki-entry';
import { resolveAuthzContext, assertCanWriteBranch } from '$lib/server/authz';
import { getWorkflowSettings } from '$lib/server/workflow-settings';

const API = 'https://api.github.com';

function getOwner() {
  return env.PUBLIC_GITHUB_OWNER || '4ndual';
}

function getRepo() {
  return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}
function getDefaultBranch() {
  return env.PUBLIC_GITHUB_BRANCH || 'main';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');
  const context = await resolveAuthzContext(token);
  const workflow = await getWorkflowSettings(token);

  const body = await request.json();
  const {
    path: rawPath,
    content,
    branch,
    message,
    format,
  } = body as {
    path: string;
    content: string;
    branch: string;
    message?: string;
    format?: WikiEntryFormat;
  };

  if (!rawPath || typeof content !== 'string' || !branch) {
    throw error(400, 'Missing required fields: path, content, branch');
  }

  const { path, format: resolvedFormat } = resolveEntryPath(rawPath, format);
  assertCanWriteBranch(
    context,
    branch,
    getDefaultBranch(),
    workflow.allowDirectDefaultBranchEdits,
  );
  if (branch !== getDefaultBranch()) {
    assertBranchMatchesPath(branch, path);
  }

  if (resolvedFormat === 'json') {
    try {
      JSON.parse(content);
    } catch {
      throw error(400, 'Invalid JSON content');
    }
  }

  const encodedPath = path
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const existingRes = await fetch(
    `${API}/repos/${getOwner()}/${getRepo()}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (existingRes.ok) {
    return json({ error: 'A file already exists at this path.' }, { status: 409 });
  }
  if (existingRes.status !== 404) {
    const existingErr = await existingRes.json().catch(() => ({}));
    return json(
      { error: (existingErr as { message?: string }).message || 'Failed to validate path' },
      { status: existingRes.status },
    );
  }

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
        message: message || `Create: ${path.split('/').pop()}`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch,
      }),
    },
  );

  if (ghRes.status === 409 || ghRes.status === 422) {
    const ghBody = await ghRes.json().catch(() => ({}));
    return json(
      { error: (ghBody as { message?: string }).message || 'Create conflict' },
      { status: 409 },
    );
  }

  if (!ghRes.ok) {
    const ghBody = await ghRes.json().catch(() => ({}));
    return json(
      { error: (ghBody as { message?: string }).message || 'Create failed' },
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
