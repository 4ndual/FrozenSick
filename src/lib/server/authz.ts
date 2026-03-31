import { error } from '@sveltejs/kit';
import { parseContentBranch, slugifyLogin } from '$lib/server/content-branches';
import { resolveAppRole } from '$lib/server/roles';

export interface AuthzContext {
	login: string;
	loginSlug: string;
	isAdmin: boolean;
	role: 'user' | 'editor' | 'admin';
}

function ghHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
	};
}

export async function fetchViewerLogin(token: string): Promise<string> {
	const userRes = await fetch('https://api.github.com/user', {
		headers: ghHeaders(token),
	});
	if (!userRes.ok) {
		throw error(502, 'Failed to resolve authenticated GitHub user');
	}
	const userData = (await userRes.json()) as { login?: string };
	const login = userData.login?.trim();
	if (!login) {
		throw error(502, 'Authenticated GitHub user has no login');
	}
	return login;
}

export async function resolveAuthzContext(token: string): Promise<AuthzContext> {
	const login = await fetchViewerLogin(token);
	const role = resolveAppRole(true, login);
	return {
		login,
		loginSlug: slugifyLogin(login),
		isAdmin: role === 'admin',
		role,
	};
}

function isOwnLegacyTimelineBranch(branch: string, loginSlug: string): boolean {
	return branch === `content/timeline-${loginSlug}`;
}

export function assertCanManageContentBranch(
	context: AuthzContext,
	branch: string,
	message = 'You can only edit your own content branches.',
): void {
	if (!branch.startsWith('content/')) {
		throw error(403, 'Only content branches are allowed for this operation.');
	}
	if (context.isAdmin) return;
	if (isOwnLegacyTimelineBranch(branch, context.loginSlug)) return;
	const parsed = parseContentBranch(branch);
	if (!parsed?.owner || parsed.owner !== context.loginSlug) {
		throw error(403, message);
	}
}

export function assertCanWriteBranch(
	context: AuthzContext,
	branch: string,
	defaultBranch: string,
	allowDirectDefaultBranchEdits: boolean,
): void {
	if (branch === defaultBranch) {
		if (!context.isAdmin || !allowDirectDefaultBranchEdits) {
			throw error(403, 'Direct edits to the published branch are disabled.');
		}
		return;
	}
	assertCanManageContentBranch(context, branch);
}

