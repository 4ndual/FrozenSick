#!/usr/bin/env bun
/**
 * Bug-runner: pull open bug-labeled issues from GitHub and attempt to fix each
 * one with the agent CLI, then open an atomic PR (base branch: github) or post
 * a comment when more context is needed. Never merges PRs.
 *
 * Usage:
 *   bun run scripts/bug-runner.ts [--dry-run] [--issue=N]
 *
 * Env:
 *   GITHUB_TEST_PAT | GITHUB_PAT | GITHUB_AGENT_PAT — GitHub token (repo scope
 *   required: read/write issues, pull requests, push branches).
 *   PUBLIC_GITHUB_OWNER / PUBLIC_GITHUB_REPO / PUBLIC_GITHUB_BRANCH (or VITE_*).
 *   Base branch is PUBLIC_GITHUB_BRANCH (e.g. "github"); PRs target that branch.
 *   Script only creates atomic PRs (one branch, one commit, one PR per issue);
 *   it never merges PRs.
 *   BUG_RUNNER_AUTO_CLOSE=1 or --auto-close — use "Fixes #N" in PR body so
 *     merging the PR auto-closes the issue; default is "Refs #N" so merge does
 *     not close (safe for merge-to-test).
 *
 * Requirements:
 *   - `agent` CLI (Cursor/Codex) on PATH.
 *   - Clean working tree and current branch = base branch (e.g. github) at start.
 *
 * Testing:
 *   1. Dry-run: bun run scripts/bug-runner.ts -- --dry-run
 *      (fetch issues, run agent; no commit, push, PR, or comment).
 *   2. Single issue (no push): --dry-run --issue=14
 *   3. Full run: --issue=14 then merge the PR on GitHub; issue stays open (Refs #N).
 *   4. Next run: issue #14 is skipped (has merged PR).
 * This script never calls the merge endpoint; it only creates PRs.
 */

import { readFileSync } from "fs";
import {
  loadRepoConfig,
  listBugIssues,
  getIssue,
  existingPrStatus,
  createIssueComment,
  createPullRequest,
  prIssueRef,
  type RepoConfig,
  type GhIssue,
} from "./gh-issues";
import { runAgent } from "../Assets/agents/runner";
import {
  WORKSPACE_ROOT,
  BUG_FIX_PROMPT,
  BUG_FIX_TIMEOUT_MS,
  MODELS_BUG_FIX,
} from "../Assets/agents/config";

const NEED_MORE_CONTEXT = "NEED_MORE_CONTEXT";

function parseArgs(): { dryRun: boolean; issueNumber: number | null } {
  const dryRun =
    process.argv.includes("--dry-run") || process.env.BUG_RUNNER_DRY_RUN === "1";
  const issueArg = process.argv.find((a) => a.startsWith("--issue="));
  const issueNumber = issueArg
    ? parseInt(issueArg.slice("--issue=".length), 10)
    : null;
  return { dryRun, issueNumber };
}

function buildPrompt(issue: GhIssue, repoUrl: string): string {
  const template = readFileSync(BUG_FIX_PROMPT, "utf-8");
  const issueUrl = `${repoUrl}/issues/${issue.number}`;
  return template
    .replace(/\{\{ISSUE_NUMBER\}\}/g, String(issue.number))
    .replace(/\{\{ISSUE_TITLE\}\}/g, issue.title)
    .replace(/\{\{ISSUE_BODY\}\}/g, issue.body ?? "")
    .replace(/\{\{ISSUE_URL\}\}/g, issueUrl);
}

function git(cwd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return (async () => {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    return { code, stdout, stderr };
  })();
}

async function getStatusSnapshot(cwd: string): Promise<Set<string>> {
  const { stdout } = await git(cwd, ["status", "--porcelain"]);
  return new Set(stdout.trim().split("\n").filter(Boolean));
}

function getNewChanges(before: Set<string>, after: Set<string>): string[] {
  const newLines: string[] = [];
  for (const line of after) {
    if (!before.has(line)) newLines.push(line);
  }
  return newLines;
}

function extractFilesFromPorcelain(lines: string[]): string[] {
  return lines
    .map((l) => {
      let path = l.slice(3).trim();
      // Git quotes paths containing spaces/special chars
      if (path.startsWith('"') && path.endsWith('"')) {
        path = path.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return path;
    })
    .filter(Boolean);
}

function stdoutContainsNeedMoreContext(stdout: string): boolean {
  return stdout.includes(NEED_MORE_CONTEXT);
}

async function ensureOnBaseBranch(cfg: RepoConfig): Promise<void> {
  const { code, stdout } = await git(WORKSPACE_ROOT, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (code !== 0) throw new Error("git rev-parse failed");
  const branch = stdout.trim();
  if (branch !== cfg.baseBranch) {
    const checkout = await git(WORKSPACE_ROOT, ["checkout", cfg.baseBranch]);
    if (checkout.code !== 0) throw new Error(`git checkout ${cfg.baseBranch} failed: ${checkout.stderr}`);
  }
}

async function createBranchCommitPushAndPr(
  cfg: RepoConfig,
  issue: GhIssue,
  changedFiles: string[],
  dryRun: boolean
): Promise<void> {
  const branchName = `fix/issue-${issue.number}`;
  const commitTitle = `Fix #${issue.number}: ${issue.title.slice(0, 72)}`;

  if (dryRun) {
    console.log(`   [dry-run] Would: branch ${branchName}, commit ${changedFiles.length} file(s), push, create PR`);
    return;
  }

  const branchResult = await git(WORKSPACE_ROOT, ["checkout", "-b", branchName]);
  if (branchResult.code !== 0) {
    throw new Error(`git checkout -b ${branchName} failed: ${branchResult.stderr}`);
  }

  await git(WORKSPACE_ROOT, ["add", ...changedFiles]);

  const commitResult = await git(WORKSPACE_ROOT, ["commit", "-m", commitTitle]);
  if (commitResult.code !== 0) {
    await git(WORKSPACE_ROOT, ["checkout", cfg.baseBranch]);
    await git(WORKSPACE_ROOT, ["branch", "-D", branchName]);
    throw new Error(`git commit failed: ${commitResult.stderr}`);
  }

  const pushResult = await git(WORKSPACE_ROOT, ["push", "-u", "origin", branchName]);
  if (pushResult.code !== 0) {
    await git(WORKSPACE_ROOT, ["checkout", cfg.baseBranch]);
    await git(WORKSPACE_ROOT, ["branch", "-D", branchName]);
    throw new Error(`git push failed: ${pushResult.stderr}`);
  }

  const prBody = `${prIssueRef(issue.number)}\n\n${issue.body ?? ""}`.slice(0, 65536);
  const pr = await createPullRequest(cfg, branchName, commitTitle, prBody);
  console.log(`   [PR] ${pr.html_url}`);

  await git(WORKSPACE_ROOT, ["checkout", cfg.baseBranch]);
  await git(WORKSPACE_ROOT, ["branch", "-D", branchName]);
  // Restore files to pre-agent state so next issue starts clean
  await git(WORKSPACE_ROOT, ["checkout", "--", ...changedFiles]);
  // Remove any new untracked files the agent created
  for (const f of changedFiles) {
    try { await git(WORKSPACE_ROOT, ["clean", "-f", "--", f]); } catch {}
  }
}

async function postNeedMoreContextComment(
  cfg: RepoConfig,
  issue: GhIssue,
  dryRun: boolean,
  agentSummary?: string
): Promise<void> {
  const body = agentSummary
    ? `Automated run could not apply a fix; more context may be needed.\n\n---\n${agentSummary.slice(0, 2000)}`
    : "Automated run could not apply a fix; more context may be needed.";

  if (dryRun) {
    console.log(`   [dry-run] Would post comment on #${issue.number}`);
    return;
  }
  await createIssueComment(cfg, issue.number, body);
  console.log(`   [comment] Posted on #${issue.number}`);
}

async function processIssue(
  cfg: RepoConfig,
  issue: GhIssue,
  dryRun: boolean,
  repoUrl: string
): Promise<void> {
  const prStatus = await existingPrStatus(cfg, issue.number);
  if (prStatus === "merged") {
    console.log(`Issue #${issue.number} already has merged PR, skipping.`);
    return;
  }
  if (prStatus === "open") {
    console.log(`Issue #${issue.number} already has open PR, skipping.`);
    return;
  }

  if (!dryRun) {
    await ensureOnBaseBranch(cfg);
  }

  console.log(`\n--- Issue #${issue.number}: ${issue.title} ---`);

  const beforeStatus = await getStatusSnapshot(WORKSPACE_ROOT);

  const prompt = buildPrompt(issue, repoUrl);
  const result = await runAgent(
    prompt,
    MODELS_BUG_FIX,
    BUG_FIX_TIMEOUT_MS,
  );

  const afterStatus = await getStatusSnapshot(WORKSPACE_ROOT);
  const newChanges = getNewChanges(beforeStatus, afterStatus);
  const changedFiles = extractFilesFromPorcelain(newChanges);

  if (changedFiles.length > 0) {
    console.log(`   [changes] ${changedFiles.length} file(s): ${changedFiles.join(", ")}`);
    await createBranchCommitPushAndPr(cfg, issue, changedFiles, dryRun);
    return;
  }

  const summary = result.stdout?.trim().slice(-1500);
  await postNeedMoreContextComment(cfg, issue, dryRun, summary);
}

async function main(): Promise<void> {
  const { dryRun, issueNumber } = parseArgs();

  if (dryRun) {
    console.log("DRY RUN: no git commit, push, PR, or comment will be performed.");
  }

  const cfg = loadRepoConfig();
  const repoUrl = `https://github.com/${cfg.owner}/${cfg.repo}`;

  let issues: GhIssue[] = await listBugIssues(cfg);
  if (issueNumber !== null) {
    issues = issues.filter((i) => i.number === issueNumber);
    if (issues.length === 0) {
      const single = await getIssue(cfg, issueNumber).catch(() => null);
      if (single && single.state === "open") issues = [single];
      else {
        console.error(`Issue #${issueNumber} not found or not open.`);
        process.exit(1);
      }
    }
  }

  if (issues.length === 0) {
    console.log("No bug issues to process.");
    return;
  }

  console.log(`Processing ${issues.length} issue(s). Base branch: ${cfg.baseBranch}.`);

  for (const issue of issues) {
    try {
      await processIssue(cfg, issue, dryRun, repoUrl);
    } catch (err) {
      console.error(`Error processing #${issue.number}:`, err);
    }
  }
}

main();
