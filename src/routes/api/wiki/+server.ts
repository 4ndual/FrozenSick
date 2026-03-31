import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchContent, getDefaultBranch, GitHubAuthError } from '$lib/server/github-content';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token') ?? '';
  if (!token && process.env.NODE_ENV === 'production') {
    throw error(401, 'Not authenticated');
  }

  const pathParam = url.searchParams.get('path');
  if (!pathParam) {
    throw error(400, 'Missing path');
  }

  const branch = url.searchParams.get('branch') || getDefaultBranch();

  try {
    const file = await fetchContent(token, decodeURIComponent(pathParam), branch);
    return json({ content: file.content, sha: file.sha });
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      throw error(401, 'Token expired');
    }
    throw error(500, 'Failed to read file');
  }
};
