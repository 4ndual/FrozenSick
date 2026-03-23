import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  fetchWorldMapPaths,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token') ?? '';
  if (!token && process.env.NODE_ENV === 'production') {
    throw error(401, 'Not authenticated');
  }

  const branch = url.searchParams.get('branch') || getDefaultBranch();

  try {
    const paths = await fetchWorldMapPaths(token, branch);
    const maps = paths
      .map((entry) => {
        const file = entry.path.split('/').pop() ?? entry.path;
        return {
          file,
          name: file.replace(/\.map$/i, ''),
          path: entry.path,
        };
      })
      .sort((a, b) => a.file.localeCompare(b.file));

    return json({ branch, maps });
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      throw error(401, 'Token expired');
    }
    throw error(500, 'Failed to list map files');
  }
};
