import { json } from '@sveltejs/kit';
import { fetchContent, fetchTree, getDefaultBranch } from '$lib/server/github-content';
import { classifyWikiEntry, slugify, slugifyPath, type WikiEntryKind } from '$lib/wiki-entry';
import type { RequestHandler } from './$types';

type SearchResult = {
  title: string;
  href: string;
  sourcePath: string;
  badge: string;
  kind: WikiEntryKind;
  snippet: string;
  section: string;
  focusText: string;
  anchor: string;
};

type ScoredSearchResult = SearchResult & {
  score: number;
};

const MAX_RESULTS = 12;

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreText(text: string, tokens: string[]): number {
  const normalized = normalizeText(text);
  let score = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) score += 1;
  }
  return score;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSnippet(text: string, tokens: string[]): string {
  const normalized = normalizeText(text);
  const indexes = tokens
    .map((token) => normalized.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  if (indexes.length === 0) {
    return text.slice(0, 180).trim();
  }

  const start = Math.max(0, indexes[0] - 70);
  const end = Math.min(text.length, indexes[0] + 130);
  const snippet = text.slice(start, end).trim();
  return `${start > 0 ? '...' : ''}${snippet}${end < text.length ? '...' : ''}`;
}

function buildFocusTarget(markdown: string, tokens: string[], fallbackTitle: string): { anchor: string; focusText: string } {
  const lines = markdown.split(/\r?\n/);
  let currentHeading = fallbackTitle;
  let bestLine = '';

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
      continue;
    }

    const plain = stripMarkdown(line).trim();
    if (!plain) continue;
    const normalized = normalizeText(plain);
    if (tokens.every((token) => normalized.includes(token))) {
      bestLine = plain;
      break;
    }
    if (!bestLine && tokens.some((token) => normalized.includes(token))) {
      bestLine = plain;
    }
  }

  return {
    anchor: slugify(currentHeading || fallbackTitle || 'section'),
    focusText: bestLine || fallbackTitle,
  };
}

function titleForResult(sourcePath: string): string {
  const rel = sourcePath.replace(/^content\//, '');
  const parts = rel.split('/');
  const meta = classifyWikiEntry(sourcePath);

  if (meta.isSectionLanding && parts.length >= 2) {
    return parts[1];
  }

  return meta.cleanTitle;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const query = url.searchParams.get('q')?.trim() ?? '';
  const branch = url.searchParams.get('branch') || getDefaultBranch();

  if (query.length < 2) {
    return json({ results: [] satisfies SearchResult[] });
  }

  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const token = cookies.get('gh_token') ?? '';
  const tree = await fetchTree(token, branch);

  const matches = await Promise.all(
    tree.map(async (entry) => {
      const meta = classifyWikiEntry(entry.path);
      const title = titleForResult(entry.path);
      const href = '/' + slugifyPath(entry.path.replace(/^content\//, ''));
      const section = entry.path.replace(/^content\//, '').split('/')[0] ?? 'Wiki';

      const titleScore = scoreText(`${title} ${entry.path}`, tokens);
      let contentScore = 0;
      let snippet = '';
      let focusText = title;
      let anchor = slugify(title || 'section');

      if (titleScore === 0 || tokens.length > 1) {
        const file = await fetchContent(token, entry.path, branch);
        const plain = stripMarkdown(file.content);
        contentScore = scoreText(plain, tokens);
        if (contentScore > 0) {
          snippet = buildSnippet(plain, tokens);
        }
        const focusTarget = buildFocusTarget(file.content, tokens, title);
        focusText = focusTarget.focusText;
        anchor = focusTarget.anchor;
      }

      const score = titleScore * 3 + contentScore;
      if (score === 0) return null;

      const result: ScoredSearchResult = {
        title,
        href,
        sourcePath: entry.path,
        badge: meta.badge,
        kind: meta.kind,
        section,
        snippet,
        focusText,
        anchor,
        score,
      };

      return result;
    }),
  );

  const scoredResults = matches.filter((entry): entry is ScoredSearchResult => entry !== null);

  const results = scoredResults
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_RESULTS)
    .map(({ score: _score, ...entry }): SearchResult => entry);

  return json({ results });
};
