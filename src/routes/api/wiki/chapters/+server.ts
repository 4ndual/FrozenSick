import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  fetchTree,
  fetchChapterJsonPaths,
  getDefaultBranch,
} from '$lib/server/github-content';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');

  const branch = url.searchParams.get('branch') || getDefaultBranch();

  const [markdownTree, chapterJsonTree] = await Promise.all([
    fetchTree(token, branch),
    fetchChapterJsonPaths(token, branch),
  ]);

  const chapterSet = new Set<string>();
  for (const entry of markdownTree) {
    const withoutPrefix = entry.path.replace(/^content\/Chapters\//, '');
    if (withoutPrefix === entry.path) continue;
    const [chapterName] = withoutPrefix.split('/');
    if (chapterName) chapterSet.add(chapterName);
  }

  const chapterJson = chapterJsonTree.map((entry) => {
    const file = entry.path.split('/').pop() || '';
    return {
      id: file.replace(/\.json$/i, ''),
      path: entry.path,
    };
  });

  return json({
    branch,
    chapters: [...chapterSet].sort((a, b) => a.localeCompare(b)),
    chapterJson,
  });
};
