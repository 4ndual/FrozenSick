import { error, redirect } from '@sveltejs/kit';
import {
  fetchTree,
  buildManifest,
  buildNav,
  fetchContent,
  listBranches,
  getDefaultBranch,
  compareBranches,
  GitHubAuthError,
} from '$lib/server/github-content';
import {
  slugifyPath,
  slugifyForBranch,
  formatPathAsTitle,
} from '$lib/utils/slugify';
import type { PageServerLoad } from './$types';

const CONTENT_BRANCH_PREFIX = 'content/';

type SyncStatus = 'viewing' | 'saved' | 'synced' | 'behind';

export const load: PageServerLoad = async ({ params, url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) {
    throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;

  try {
    const [tree, allBranches] = await Promise.all([
      fetchTree(token, branch),
      listBranches(token),
    ]);

    const manifest = buildManifest(tree);
    const nav = buildNav(tree);

    const rawSlug = Array.isArray(params.slug) ? params.slug.join('/') : (params.slug ?? '');
    const slug = '/' + slugifyPath(rawSlug);
    const sourcePath = manifest[slug];

    if (!sourcePath) {
      throw error(404, 'Page not found');
    }

    const file = await fetchContent(token, sourcePath, branch);

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

    const pageContentBranch = CONTENT_BRANCH_PREFIX + slugifyForBranch(sourcePath);
    let initialSyncStatus: SyncStatus = 'viewing';

    if (filteredBranches.includes(pageContentBranch)) {
      try {
        const comparison = await compareBranches(token, pageContentBranch, defaultBranch);
        if (comparison.aheadBy === 0 && comparison.behindBy === 0) {
          initialSyncStatus = 'synced';
        } else if (comparison.aheadBy > 0 && comparison.behindBy > 0) {
          initialSyncStatus = 'behind';
        } else if (comparison.aheadBy > 0) {
          initialSyncStatus = 'saved';
        } else {
          initialSyncStatus = 'behind';
        }
      } catch {
        initialSyncStatus = 'viewing';
      }
    }

    return {
      content: file.content,
      slug,
      sourcePath,
      branch,
      defaultBranch,
      branches: filteredBranches,
      branchLabels,
      initialSyncStatus,
      nav,
    };
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      cookies.delete('gh_token', { path: '/' });
      throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
    }
    throw err;
  }
};
