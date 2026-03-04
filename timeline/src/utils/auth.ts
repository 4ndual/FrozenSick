const TOKEN_KEY = 'frozen-sick-gh-token';
const USER_KEY = 'frozen-sick-gh-user';

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export function extractTokenFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#token=')) return null;
  const token = hash.slice('#token='.length);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveUser(user: GitHubUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCachedUser(): GitHubUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GitHubUser;
  } catch {
    return null;
  }
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  const data = await res.json();
  return {
    login: data.login,
    avatar_url: data.avatar_url,
    name: data.name,
  };
}

export function loginUrl(): string {
  return '/api/auth/login';
}
