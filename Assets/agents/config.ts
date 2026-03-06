import { join } from "path";

export const WORKSPACE_ROOT = "/Users/andual/Documents/Frozen Sick";
export const AGENTS_DIR = join(WORKSPACE_ROOT, "Assets", "agents");

// Phase 1 models
export const MODELS = {
  corrector: "gemini-3-flash",
  metaRemoval: "gemini-3-flash",
  attribution: "gemini-3-flash",
} as const;

// Bug-fix agent (GitHub issue → code change)
export const BUG_FIX_TIMEOUT_MS = 300_000; // 5 minutes
export const MODELS_BUG_FIX = "auto" as const;

// Phase 2 models
export const SUMMARY_MODELS = {
  narrator: "sonnet-4.6",
  characterArc: "gemini-3-flash",
  npcUpdater: "gemini-3-flash",
  plotTracker: "gemini-3-flash",
} as const;

export const TIMEOUT_MS = 300_000; // 5 minutes per agent call
export const SUMMARY_TIMEOUT_MS = 600_000; // 10 minutes for summary agents (full transcript, no chunking)
export const MAX_RETRIES = 2;
export const CHUNK_SIZE = 120; // lines per chunk
export const CHUNK_OVERLAP = 10; // lines of overlap between chunks for continuity
export const PARALLEL_CHUNKS = 3; // max chunks processed concurrently

export const DEBUG =
  process.env.DEBUG === "1" || process.argv.includes("--debug");

// Phase 1 prompts
export const PROMPTS = {
  corrector: join(AGENTS_DIR, "corrector-prompt.md"),
  metaRemoval: join(AGENTS_DIR, "meta-removal-prompt.md"),
  attribution: join(AGENTS_DIR, "attribution-prompt.md"),
};

// Bug-fix prompt (script injects issue number, title, body, url)
export const BUG_FIX_PROMPT = join(AGENTS_DIR, "bug-fix-prompt.md");

// Phase 2 prompts
export const SUMMARY_PROMPTS = {
  narrator: join(AGENTS_DIR, "narrator-prompt.md"),
  characterArc: join(AGENTS_DIR, "character-arc-prompt.md"),
  npcUpdater: join(AGENTS_DIR, "npc-updater-prompt.md"),
  plotTracker: join(AGENTS_DIR, "plot-tracker-prompt.md"),
};

// Phase 1 contexts
export const CONTEXTS = {
  corrector: join(AGENTS_DIR, "context-corrector.md"),
  metaRemoval: join(AGENTS_DIR, "context-meta.md"),
  attribution: join(AGENTS_DIR, "context-attribution.md"),
};

// Campaign file paths
export const CAMPAIGN = {
  chaptersDir: join(WORKSPACE_ROOT, "Chapters"),
  characters: {
    tidus: join(WORKSPACE_ROOT, "Characters", "Tidus", "Story.md"),
    nixira: join(WORKSPACE_ROOT, "Characters", "Nixira", "Story.md"),
    zacarias: join(WORKSPACE_ROOT, "Characters", "Zacarias", "Story.md"),
  },
  npcs: join(WORKSPACE_ROOT, "Characters", "NPCs.md"),
  plotTracker: join(WORKSPACE_ROOT, "Plot", "Tracker.md"),
};
