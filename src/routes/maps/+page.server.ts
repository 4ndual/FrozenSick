import { redirect } from '@sveltejs/kit';
import {
  fetchTree,
  fetchWorldMapPaths,
  buildManifest,
  buildNav,
  listBranches,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';
import { formatPathAsTitle, slugifyForBranch } from '$lib/utils/slugify';
import type { PageServerLoad } from './$types';

const CONTENT_BRANCH_PREFIX = 'content/';

export const load: PageServerLoad = async ({ url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) {
    throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;
  const requestedFile = url.searchParams.get('file');

  try {
    const [tree, allBranches, worldMaps] = await Promise.all([
      fetchTree(token, branch),
      listBranches(token),
      fetchWorldMapPaths(token, branch),
    ]);

    const manifest = buildManifest(tree);
    const nav = buildNav(tree);

    const filteredBranches = allBranches.filter(
      (b) => b === defaultBranch || b.startsWith(CONTENT_BRANCH_PREFIX),
    );

    const branchLabels: Record<string, string> = {};
    branchLabels[defaultBranch] = 'Published';
    for (const b of filteredBranches) {
      if (b.startsWith(CONTENT_BRANCH_PREFIX)) {
        const branchSlug = b.slice(CONTENT_BRANCH_PREFIX.length);
        const matchingSource = Object.values(manifest).find(
          (src) => slugifyForBranch(src) === branchSlug,
        );
        branchLabels[b] = matchingSource
          ? formatPathAsTitle(matchingSource)
          : branchSlug.replace(/-/g, ' ');
      }
    }

    const maps = worldMaps
      .map((entry) => {
        const file = entry.path.split('/').pop() ?? entry.path;
        return {
          file,
          name: file.replace(/\.map$/i, ''),
          path: entry.path,
        };
      })
      .sort((a, b) => a.file.localeCompare(b.file));

    const selectedFile =
      requestedFile && maps.some((m) => m.file === requestedFile)
        ? requestedFile
        : (maps[0]?.file ?? '');

    return {
      branch,
      defaultBranch,
      branches: filteredBranches,
      branchLabels,
      nav,
      maps,
      selectedFile,
    };
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      cookies.delete('gh_token', { path: '/' });
      throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
    }
    throw err;
  }
};
