import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { getDefaultBranch } from '$lib/server/github-content';
import { resolveAuthzContext } from '$lib/server/authz';

const API = 'https://api.github.com';
const CONTENT_PREFIX = 'content/';

interface PullRequestSummary {
	number: number;
	title: string;
	html_url: string;
	updated_at: string;
	head: { ref: string; label: string };
	user: { login: string };
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
	return context;
}

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('gh_token');
	if (!token) throw error(401, 'Not authenticated');
	await requireAdmin(token);

	const base = getDefaultBranch();
	const listRes = await fetch(
		`${repoUrl()}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100`,
		{ headers: ghHeaders(token) },
	);
	if (!listRes.ok) {
		const err = (await listRes.json().catch(() => ({}))) as { message?: string };
		throw error(502, err.message || 'Failed to load approvals.');
	}
	const pulls = (await listRes.json()) as PullRequestSummary[];
	const approvals = pulls
		.filter((pr) => pr.head.ref.startsWith(CONTENT_PREFIX))
		.map((pr) => ({
			prNumber: pr.number,
			title: pr.title,
			author: pr.user.login,
			updatedAt: pr.updated_at,
			prUrl: pr.html_url,
			headBranch: pr.head.ref,
			headLabel: pr.head.label,
		}));
	return json({ approvals });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const token = cookies.get('gh_token');
	if (!token) throw error(401, 'Not authenticated');
	await requireAdmin(token);

	const body = (await request.json()) as { action?: 'approve' | 'reject'; prNumber?: number };
	const action = body.action;
	const prNumber = Number(body.prNumber);
	if (!action || !['approve', 'reject'].includes(action)) {
		throw error(400, 'action must be "approve" or "reject".');
	}
	if (!Number.isFinite(prNumber) || prNumber <= 0) {
		throw error(400, 'prNumber must be a positive number.');
	}

	const prRes = await fetch(`${repoUrl()}/pulls/${prNumber}`, { headers: ghHeaders(token) });
	if (!prRes.ok) {
		const err = (await prRes.json().catch(() => ({}))) as { message?: string };
		throw error(502, err.message || 'Failed to load pull request.');
	}
	const pr = (await prRes.json()) as { head?: { ref?: string } };
	const headBranch = pr.head?.ref?.trim();
	if (!headBranch || !headBranch.startsWith(CONTENT_PREFIX)) {
		throw error(400, 'Only content/* pull requests can be handled here.');
	}

	let status = 'success';
	let message = '';
	let merged = false;

	if (action === 'approve') {
		const mergeRes = await fetch(`${repoUrl()}/pulls/${prNumber}/merge`, {
			method: 'PUT',
			headers: ghHeaders(token),
			body: JSON.stringify({ merge_method: 'merge' }),
		});
		if (!mergeRes.ok) {
			const err = (await mergeRes.json().catch(() => ({}))) as { message?: string };
			throw error(409, err.message || 'Failed to merge pull request.');
		}
		merged = true;
		message = `Accepted PR #${prNumber}.`;
	} else {
		const closeRes = await fetch(`${repoUrl()}/pulls/${prNumber}`, {
			method: 'PATCH',
			headers: ghHeaders(token),
			body: JSON.stringify({ state: 'closed' }),
		});
		if (!closeRes.ok) {
			const err = (await closeRes.json().catch(() => ({}))) as { message?: string };
			throw error(502, err.message || 'Failed to close pull request.');
		}
		message = `Rejected PR #${prNumber}.`;
	}

	const deleteRes = await fetch(
		`${repoUrl()}/git/refs/heads/${encodeURIComponent(headBranch)}`,
		{ method: 'DELETE', headers: ghHeaders(token) },
	);
	if (!deleteRes.ok && deleteRes.status !== 422) {
		const err = (await deleteRes.json().catch(() => ({}))) as { message?: string };
		throw error(502, err.message || 'Action completed, but failed to delete source branch.');
	}

	return json({
		ok: true,
		status,
		message: `${message} Source branch deleted.`,
		prNumber,
		headBranch,
		branchDeleted: true,
		merged,
	});
};

