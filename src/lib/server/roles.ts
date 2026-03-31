import { env } from '$env/dynamic/private';

export type AppRole = 'user' | 'editor' | 'admin';

const ADMIN_ALLOWLIST_ENV_KEYS = ['ADMIN_GITHUB_USERS', 'GITHUB_ADMIN_USERS'] as const;

function parseCsv(value: string | undefined): Set<string> {
	if (!value) return new Set();
	return new Set(
		value
			.split(',')
			.map((entry) => entry.trim().toLowerCase())
			.filter((entry) => entry.length > 0),
	);
}

function getAdminAllowlist(): Set<string> {
	for (const key of ADMIN_ALLOWLIST_ENV_KEYS) {
		const raw = env[key];
		if (raw && raw.trim().length > 0) {
			return parseCsv(raw);
		}
	}
	return new Set();
}

export function isAdminLogin(login: string | null | undefined): boolean {
	if (!login) return false;
	const normalized = login.trim().toLowerCase();
	if (!normalized) return false;
	return getAdminAllowlist().has(normalized);
}

export function resolveAppRole(authenticated: boolean, login: string | null | undefined): AppRole {
	if (!authenticated) return 'user';
	if (isAdminLogin(login)) return 'admin';
	return 'editor';
}

