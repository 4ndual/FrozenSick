export type WikiEntryKind = 'canon' | 'notes' | 'transcript' | 'reference';

export interface WikiEntryMeta {
  kind: WikiEntryKind;
  badge: string;
  description: string;
  cleanTitle: string;
  isSectionLanding: boolean;
}

export interface WikiBreadcrumb {
  label: string;
  href?: string;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(md|txt)$/i, '');
}

export function classifyWikiEntry(sourcePath: string): WikiEntryMeta {
  const fileName = sourcePath.split('/').pop() ?? sourcePath;
  const bare = stripExtension(fileName);
  const lower = bare.toLowerCase();

  if (lower === 'summary' || lower === 'index') {
    return {
      kind: 'canon',
      badge: 'Canon',
      description: 'Canonical story summary',
      cleanTitle: 'Canon Summary',
      isSectionLanding: true,
    };
  }

  if (/dm planning/i.test(bare) || /\(notas\)/i.test(bare)) {
    return {
      kind: 'notes',
      badge: 'DM Notes',
      description: 'DM notes and table-facing prep material',
      cleanTitle: bare.replace(/\s*\(notas\)\s*/i, '').trim() || 'DM Notes',
      isSectionLanding: false,
    };
  }

  if (/\.txt$/i.test(fileName)) {
    return {
      kind: 'transcript',
      badge: 'Transcript',
      description: 'Raw transcript or session text',
      cleanTitle: bare,
      isSectionLanding: false,
    };
  }

  return {
    kind: 'reference',
    badge: 'Reference',
    description: 'Reference or supporting page',
    cleanTitle: bare,
    isSectionLanding: false,
  };
}

export function formatNavTitle(sourcePath: string, fallbackTitle: string): string {
  const meta = classifyWikiEntry(sourcePath);
  if (meta.isSectionLanding) return fallbackTitle;
  if (meta.kind === 'notes') return `${meta.cleanTitle} - DM Notes`;
  if (meta.kind === 'transcript') return `${meta.cleanTitle} - Transcript`;
  return fallbackTitle;
}

export function buildBreadcrumbs(sourcePath: string): WikiBreadcrumb[] {
  const rel = sourcePath.replace(/^content\//, '');
  const parts = rel.split('/');
  const crumbs: WikiBreadcrumb[] = [{ label: 'Home', href: '/' }];

  if (parts.length === 0) return crumbs;

  const [section, group, fileName] = parts;

  if (section) {
    crumbs.push({
      label: section,
    });
  }

  if (group) {
    crumbs.push({
      label: group,
      href: `/${slugifyPath(`${section}/${group}`)}`,
    });
  }

  if (fileName) {
    const meta = classifyWikiEntry(sourcePath);
    if (!meta.isSectionLanding) {
      crumbs.push({
        label: meta.cleanTitle,
        href: `/${slugifyPath(rel)}`,
      });
    }
  }

  return crumbs;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugifyPath(relPath: string): string {
  return relPath
    .replace(/\.(md|txt)$/i, '')
    .split('/')
    .map(slugify)
    .join('/');
}
