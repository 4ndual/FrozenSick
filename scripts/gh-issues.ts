/**
 * GitHub Issues API helper for the bug-runner script.
 * Uses PAT from env (GITHUB_TEST_PAT or GITHUB_PAT). No SvelteKit.
 */

const API = "https://api.github.com";

function getOwner(): string {
  return process.env.PUBLIC_GITHUB_OWNER || process.env.VITE_GITHUB_OWNER || "4ndual";
}

function getRepo(): string {
  return process.env.PUBLIC_GITHUB_REPO || process.env.VITE_GITHUB_REPO || "FrozenSick";
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (res.status === 401) {
    throw new Error("GitHub token expired or invalid");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status}: ${url} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: { name: string }[];
  html_url: string;
}

export interface RepoConfig {
  owner: string;
  repo: string;
  baseBranch: string;
  token: string;
}

export function loadRepoConfig(): RepoConfig {
  const token =
    process.env.GITHUB_TEST_PAT ||
    process.env.GITHUB_PAT ||
    process.env.GITHUB_AGENT_PAT;
  if (!token) {
    throw new Error(
      "Missing GitHub token. Set GITHUB_TEST_PAT, GITHUB_PAT, or GITHUB_AGENT_PAT (repo scope required)."
    );
  }
  const owner = getOwner();
  const repo = getRepo();
  const baseBranch =
    process.env.PUBLIC_GITHUB_BRANCH ||
    process.env.VITE_GITHUB_BRANCH ||
    "github";
  return { owner, repo, baseBranch, token };
}

function repoUrl(cfg: RepoConfig): string {
  return `${API}/repos/${cfg.owner}/${cfg.repo}`;
}

/**
 * List open issues with label "bug".
 */
export async function listBugIssues(cfg: RepoConfig): Promise<GhIssue[]> {
  const url = `${repoUrl(cfg)}/issues?state=open&labels=bug`;
  const list = await fetchJson<GhIssue[]>(url, cfg.token);
  return list;
}

/**
 * Get a single issue by number.
 */
export async function getIssue(
  cfg: RepoConfig,
  issueNumber: number
): Promise<GhIssue> {
  const url = `${repoUrl(cfg)}/issues/${issueNumber}`;
  return fetchJson<GhIssue>(url, cfg.token);
}

/**
 * Check if this issue already has a merged or open PR from branch fix/issue-{number}.
 * Returns "merged" | "open" | null.
 */
export async function existingPrStatus(
  cfg: RepoConfig,
  issueNumber: number
): Promise<"merged" | "open" | null> {
  const head = `${cfg.owner}:fix/issue-${issueNumber}`;
  // Check closed (merged) PRs
  const closedUrl = `${repoUrl(cfg)}/pulls?head=${encodeURIComponent(head)}&state=closed`;
  const closedPrs = await fetchJson<{ number: number; merged_at: string | null }[]>(
    closedUrl,
    cfg.token
  );
  for (const pr of closedPrs) {
    if (pr.merged_at) return "merged";
  }
  // Check open PRs
  const openUrl = `${repoUrl(cfg)}/pulls?head=${encodeURIComponent(head)}&state=open`;
  const openPrs = await fetchJson<{ number: number }[]>(openUrl, cfg.token);
  if (openPrs.length > 0) return "open";
  return null;
}

/**
 * Post a comment on an issue.
 */
export async function createIssueComment(
  cfg: RepoConfig,
  issueNumber: number,
  body: string
): Promise<void> {
  const url = `${repoUrl(cfg)}/issues/${issueNumber}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...ghHeaders(cfg.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to post comment: ${res.status} ${text.slice(0, 200)}`);
  }
}

/**
 * Create a pull request. Base branch is cfg.baseBranch (e.g. "github").
 * Does NOT merge. Use issueRef "Refs #14" by default so merging the PR does not auto-close the issue.
 */
export async function createPullRequest(
  cfg: RepoConfig,
  head: string,
  title: string,
  body: string
): Promise<{ html_url: string; number: number }> {
  const url = `${repoUrl(cfg)}/pulls`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...ghHeaders(cfg.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      head,
      base: cfg.baseBranch,
      body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create PR: ${res.status} ${text.slice(0, 300)}`);
  }
  const pr = (await res.json()) as { html_url: string; number: number };
  return pr;
}

/**
 * Build the issue reference line for the PR body. Default "Refs #N" so merging does not auto-close.
 * Set BUG_RUNNER_AUTO_CLOSE=1 to use "Fixes #N" for auto-close on merge.
 */
export function prIssueRef(issueNumber: number): string {
  const autoClose =
    process.env.BUG_RUNNER_AUTO_CLOSE === "1" ||
    process.argv.includes("--auto-close");
  return autoClose ? `Fixes #${issueNumber}` : `Refs #${issueNumber}`;
}
