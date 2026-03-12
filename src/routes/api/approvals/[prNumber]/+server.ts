import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { resolveAuthzContext } from '$lib/server/authz';

const API = 'https://api.github.com';
const CONTENT_PREFIX = 'content/';

interface PullRequestFile {
	filename: string;
	status: 'added' | 'modified' | 'removed' | 'renamed' | string;
	additions: number;
	deletions: number;
	changes: number;
	patch?: string;
	previous_filename?: string;
}

interface DiffLine {
	type: 'add' | 'remove' | 'context';
	text: string;
}

interface DiffHunk {
	header: string;
	lines: DiffLine[];
}

function getOwner(): string {
	return env.PUBLIC_GITHUB_OWNER || '4ndual';
}

function getRepo(): string {
	return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}

function repoUrl(): string {
	return `${API}/repos/${getOwner()}/${getRepo()}`;
}

function ghHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'Content-Type': 'application/json',
	};
}

async function requireAdmin(token: string) {
	const context = await resolveAuthzContext(token);
	if (!context.isAdmin) throw error(403, 'Only admins can review approvals.');
}

function parsePatch(patch: string | undefined): DiffHunk[] {
	if (!patch) return [];
	const lines = patch.split('\n');
	const hunks: DiffHunk[] = [];
	let current: DiffHunk | null = null;

	for (const rawLine of lines) {
		if (rawLine.startsWith('@@')) {
			current = { header: rawLine, lines: [] };
			hunks.push(current);
			continue;
		}
		if (!current) continue;
		if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
			current.lines.push({ type: 'add', text: rawLine.slice(1) });
			continue;
		}
		if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
			current.lines.push({ type: 'remove', text: rawLine.slice(1) });
			continue;
		}
		current.lines.push({
			type: 'context',
			text: rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine,
		});
	}

	return hunks.filter((hunk) => hunk.lines.length > 0);
}

function buildHighlights(hunks: DiffHunk[]): { added: string[]; removed: string[] } {
	const added: string[] = [];
	const removed: string[] = [];
	for (const hunk of hunks) {
		for (const line of hunk.lines) {
			const cleaned = line.text.trim();
			if (!cleaned) continue;
			if (line.type === 'add' && added.length < 3) added.push(cleaned);
			if (line.type === 'remove' && removed.length < 3) removed.push(cleaned);
			if (added.length >= 3 && removed.length >= 3) {
				return { added, removed };
			}
		}
	}
	return { added, removed };
}

function plainFileSummary(file: PullRequestFile): string {
	if (file.status === 'added') return 'New file added';
	if (file.status === 'removed') return 'File removed';
	if (file.status === 'renamed') return 'File renamed and updated';
	return 'File updated';
}

export const GET: RequestHandler = async ({ cookies, params }) => {
	const token = cookies.get('gh_token');
	if (!token) throw error(401, 'Not authenticated');
	await requireAdmin(token);

	const prNumber = Number(params.prNumber);
	if (!Number.isFinite(prNumber) || prNumber <= 0) {
		throw error(400, 'Invalid pull request number.');
	}

	const prRes = await fetch(`${repoUrl()}/pulls/${prNumber}`, { headers: ghHeaders(token) });
	if (!prRes.ok) {
		const err = (await prRes.json().catch(() => ({}))) as { message?: string };
		throw error(502, err.message || 'Failed to load pull request details.');
	}
	const pr = (await prRes.json()) as {
		number: number;
		title: string;
		body?: string;
		html_url: string;
		updated_at: string;
		user: { login: string };
		head: { ref: string };
		base: { ref: string };
		additions: number;
		deletions: number;
		changed_files: number;
	};

	if (!pr.head.ref.startsWith(CONTENT_PREFIX)) {
		throw error(400, 'Only content/* pull requests are supported.');
	}

	const files: PullRequestFile[] = [];
	let page = 1;
	while (true) {
		const filesRes = await fetch(
			`${repoUrl()}/pulls/${prNumber}/files?per_page=100&page=${page}`,
			{ headers: ghHeaders(token) },
		);
		if (!filesRes.ok) {
			const err = (await filesRes.json().catch(() => ({}))) as { message?: string };
			throw error(502, err.message || 'Failed to load changed files.');
		}
		const pageItems = (await filesRes.json()) as PullRequestFile[];
		files.push(...pageItems);
		if (pageItems.length < 100) break;
		page += 1;
	}

	const fileChanges = files.map((file) => {
		const hunks = parsePatch(file.patch);
		const highlights = buildHighlights(hunks);
		return {
			filename: file.filename,
			previousFilename: file.previous_filename || null,
			status: file.status,
			summary: plainFileSummary(file),
			additions: file.additions,
			deletions: file.deletions,
			changes: file.changes,
			highlights,
			hunks,
			hasPatch: hunks.length > 0,
		};
	});

	return json({
		prNumber: pr.number,
		title: pr.title,
		description: pr.body || '',
		author: pr.user.login,
		updatedAt: pr.updated_at,
		headBranch: pr.head.ref,
		baseBranch: pr.base.ref,
		prUrl: pr.html_url,
		summary: {
			filesChanged: pr.changed_files,
			additions: pr.additions,
			deletions: pr.deletions,
		},
		files: fileChanges,
	});
};

