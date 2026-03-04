---
name: GitHub as Database
overview: Replace localStorage with git-tracked sharded dot files. Users authenticate via GitHub OAuth, then the Svelte app talks directly to the GitHub API to read/write .data/ files and create commits. Each D&D group member's edits appear as their own GitHub commits.
todos:
  - id: github-oauth-app
    content: Create GitHub OAuth App, set up Vercel env vars (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET), and configure callback URL
    status: pending
  - id: oauth-serverless
    content: "Create two Vercel serverless functions: api/auth/login.ts (redirects to GitHub) and api/auth/callback.ts (exchanges code for token, redirects back to app with token)"
    status: pending
  - id: auth-client
    content: Create timeline/src/utils/auth.ts -- store/read/clear OAuth token, get current GitHub user info, login/logout helpers
    status: pending
  - id: github-client
    content: Create timeline/src/utils/github.ts -- read .data/ tree, load sharded files, save via Git Trees API (batched multi-file commits), delete files
    status: pending
  - id: dotfile-schema
    content: Define .data/ file structure and seed initial files from DEFAULT_CAMPAIGN (meta.json, calendar.json, timelines/*.json, events/*.json)
    status: pending
  - id: update-storage
    content: Update storage.ts to support dual persistence -- localStorage as instant cache, GitHub as source of truth
    status: pending
  - id: update-store
    content: Update campaign.svelte.ts with auth state, dirty tracking, sync status (synced/dirty/saving/error), and saveToGitHub/loadFromGitHub actions
    status: pending
  - id: ui-auth-sync
    content: Add GitHub login button, user avatar, sync status indicator, and explicit Save button to App.svelte
    status: pending
isProject: false
---

# GitHub as Database for Frozen Sick

## Current State

The timeline app persists data via `localStorage` in `[timeline/src/utils/storage.ts](timeline/src/utils/storage.ts)`. The `persist()` function in `[timeline/src/store/campaign.svelte.ts](timeline/src/store/campaign.svelte.ts)` calls `saveCampaign(data)` which writes to `localStorage`. Data is browser-local -- lost on storage clear, inaccessible from other devices or by other group members.

## Architecture

**Option B (sharded dot files)** + **GitHub OAuth** + **direct client-side GitHub API** + **hybrid persistence**.

Each user signs in with GitHub. The browser calls the GitHub API directly using their OAuth token. Commits are attributed to the user who made the change. One minimal Vercel serverless function handles only the OAuth token exchange.

---

## 1. Dot File Structure

Split `CampaignData` into granular files under `.data/`:

```
.data/
  meta.json                    # { campaignId, campaignName, version }
  calendar.json                # CalendarConfig
  timelines/
    main-story.json            # single CampaignTimeline object
    tidus.json
    nixira.json
    zacarias.json
  events/
    ch1-tavern.json            # single CampaignEvent object
    ch2-plateau.json
    ch3-turtle.json
    ch4-battle.json
    ch5-escape.json
    tidus-medallion.json
```

File names use the entity `id` as the filename. Each file contains a single JSON object (pretty-printed for readable diffs).

---

## 2. GitHub OAuth Flow

### Prerequisites

1. Create a **GitHub OAuth App** at github.com/settings/developers
2. Set callback URL to `https://your-vercel-domain.vercel.app/api/auth/callback`
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Vercel environment variables
4. Add repo collaborator access for each D&D group member

### Auth Flow

```mermaid
sequenceDiagram
    participant User as Browser
    participant API as Vercel Function
    participant GH as GitHub

    User->>API: GET /api/auth/login
    API-->>User: 302 Redirect to github.com/login/oauth/authorize
    User->>GH: Authorize app (scope: repo)
    GH-->>User: 302 Redirect to /api/auth/callback?code=XXX
    User->>API: GET /api/auth/callback?code=XXX
    API->>GH: POST /login/oauth/access_token (code + client_secret)
    GH-->>API: access_token
    API-->>User: 302 Redirect to /timeline/#token=ACCESS_TOKEN
    Note over User: Store token in localStorage
```



### Serverless Functions (only 2, only for auth)

- `**api/auth/login.ts**` -- Redirects to GitHub OAuth authorize URL with `client_id` and `scope=repo`
- `**api/auth/callback.ts**` -- Receives `code` from GitHub, exchanges it for `access_token` using `client_secret`, redirects back to the app with the token in the URL fragment (fragment never hits the server)

After auth, **all GitHub API calls happen directly from the browser** using the token. No proxy needed.

---

## 3. Read/Write Flow (Client-Side)

```mermaid
sequenceDiagram
    participant App as Svelte App
    participant GH as GitHub API

    Note over App: Page Load (authenticated)
    App->>GH: GET /repos/{owner}/{repo}/git/trees/main?recursive=1
    GH-->>App: Tree with .data/ file SHAs
    App->>GH: GET /repos/{owner}/{repo}/contents/.data/meta.json
    App->>GH: GET /repos/{owner}/{repo}/contents/.data/calendar.json
    App->>GH: GET /repos/{owner}/{repo}/contents/.data/events/* (parallel)
    App->>GH: GET /repos/{owner}/{repo}/contents/.data/timelines/* (parallel)
    GH-->>App: File contents + SHAs
    Note over App: Assemble CampaignData, cache in localStorage

    Note over App: User edits events, status = "dirty"
    Note over App: User clicks "Save"

    App->>GH: POST /repos/{owner}/{repo}/git/blobs (for each changed file)
    App->>GH: POST /repos/{owner}/{repo}/git/trees (new tree with updated blobs)
    App->>GH: POST /repos/{owner}/{repo}/git/commits (message: "Update 2 events")
    App->>GH: PATCH /repos/{owner}/{repo}/git/refs/heads/main (advance branch)
    GH-->>App: New commit SHA
    Note over App: Status = "synced", update cached SHAs
```



The **Git Trees API** is used for saves so that multiple file changes (e.g., editing 3 events) become a **single atomic commit** rather than 3 separate commits.

---

## 4. Dual Persistence (localStorage + GitHub)

- **localStorage** remains the instant write-through cache (fast, offline-capable)
- **GitHub** is the source of truth (shared, versioned, persistent)
- On page load: try GitHub first, fall back to localStorage if offline/unauthenticated
- On mutation: write to localStorage immediately, mark state as "dirty"
- On explicit "Save": batch dirty changes into one GitHub commit
- Unauthenticated users can still use the app with localStorage only (read-only mode for GitHub data could also work)

---

## 5. Multi-User Considerations

- Each group member authenticates with their own GitHub account
- Commits are attributed to the person who saved (GitHub API uses their token)
- Users must be **collaborators** on the repo (or the repo must be public with appropriate permissions)
- Conflict handling: check the branch HEAD SHA before committing. If someone else pushed while you were editing, show a warning and offer to pull latest first ("Someone else saved changes. Pull latest before saving?")
- The Git Trees API's base_tree parameter naturally handles this -- if the base tree is stale, the commit still works but could overwrite changes (so the HEAD check is important)

---

## 6. Commit Messages

Auto-generated based on what changed:

- "Add event: The Dragon's Lair" (single entity)
- "Update event: Battle of Brasboredon" (single entity)
- "Delete timeline: Nixira's Arc" (single entity)
- "Update 3 events, 1 timeline" (batch)
- "Update calendar configuration" (calendar change)

Commit author = the authenticated GitHub user.

---

## 7. Files to Create/Modify

### New Files

- `**api/auth/login.ts**` -- Vercel serverless: redirect to GitHub OAuth
- `**api/auth/callback.ts**` -- Vercel serverless: exchange code for token
- `**timeline/src/utils/auth.ts**` -- Token storage, user info, login/logout
- `**timeline/src/utils/github.ts**` -- GitHub API client: loadFromGitHub(), saveToGitHub(), uses Git Trees API for atomic multi-file commits
- `**.data/meta.json**` -- Seed file
- `**.data/calendar.json**` -- Seed file
- `**.data/timelines/*.json**` -- Seed files (one per timeline)
- `**.data/events/*.json**` -- Seed files (one per event)

### Modified Files

- `**[timeline/src/utils/storage.ts](timeline/src/utils/storage.ts)**` -- Add GitHub load/save alongside localStorage, add diffing to detect which files changed
- `**[timeline/src/store/campaign.svelte.ts](timeline/src/store/campaign.svelte.ts)**` -- Add auth state (`user`, `token`), sync state (`synced | dirty | saving | error`), dirty tracking (which entities changed), `saveToGitHub()` and `loadFromGitHub()` actions
- `**[timeline/src/App.svelte](timeline/src/App.svelte)**` -- Add login/logout button with GitHub avatar, sync status badge, explicit "Save to GitHub" button, pull-on-load logic
- `**[vercel.json](vercel.json)**` -- May need rewrite rules for `/api/auth/*`
- `**[.gitignore](.gitignore)**` -- Ensure `.data/` is NOT ignored
- `**[timeline/package.json](timeline/package.json)**` -- Add `octokit` dependency (lightweight GitHub API client)

