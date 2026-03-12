import {
  fetchTree,
  fetchWorldMapPaths,
  buildManifest,
  buildNav,
  listBranches,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';
import { fetchPlaceMapLinks } from '$lib/server/place-map-links';
import {
  extractMapFileNameFromRawUrl,
  findPlaceMatch,
} from '$lib/place-map-links';
import { formatPathAsTitle, slugifyForBranch } from '$lib/utils/slugify';
import type { PageServerLoad } from './$types';

const CONTENT_BRANCH_PREFIX = 'content/';

export const load: PageServerLoad = async ({ url, cookies }) => {
  const authToken = cookies.get('gh_token') ?? '';
  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;
  const requestedFile = url.searchParams.get('file');
  const requestedPlace = url.searchParams.get('place');

  const loadData = async (token: string) => {
    const [tree, allBranches, worldMaps, placeMapLinks] = await Promise.all([
      fetchTree(token, branch),
      listBranches(token),
      fetchWorldMapPaths(token, branch),
      fetchPlaceMapLinks(token, branch, defaultBranch),
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

    const matchedPlace = findPlaceMatch(placeMapLinks?.matches ?? [], requestedPlace);
    const mappedFile = extractMapFileNameFromRawUrl(placeMapLinks?.rawMapUrl);
    const mappedFileExists = Boolean(mappedFile && maps.some((m) => m.file === mappedFile));

    const selectedFile =
      requestedFile && maps.some((m) => m.file === requestedFile)
        ? requestedFile
        : matchedPlace && mappedFileExists
          ? (mappedFile as string)
        : (maps[0]?.file ?? '');

    return {
      branch,
      defaultBranch,
      branches: filteredBranches,
      branchLabels,
      nav,
      maps,
      selectedFile,
      placeQuery: requestedPlace ?? '',
      placeMapFile: mappedFileExists ? mappedFile : '',
      placeTarget: matchedPlace
        ? {
            place: matchedPlace.place,
            source: matchedPlace.source ?? '',
            id: matchedPlace.id ?? null,
            x: matchedPlace.x ?? null,
            y: matchedPlace.y ?? null,
          }
        : null,
    };
  };

  try {
    return await loadData(authToken);
  } catch (err) {
    if (err instanceof GitHubAuthError && authToken) {
      cookies.delete('gh_token', { path: '/' });
      return loadData('');
    }
    throw err;
  }
};
