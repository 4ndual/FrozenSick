// Phase 2: Session Summary Orchestrator
//
// Reads the attributed transcript from Phase 1 and runs 4 agents in parallel:
//   1. Session Narrator       - writes Chapters/Chapter N/Summary.md
//   2. Character Arc Updater  - updates Characters Story.md per PC
//   3. NPC Registry Updater   - updates Characters/NPCs.md
//   4. Plot Tracker Updater   - updates Plot/Tracker.md
//
// Run with:
//   bun run Assets/agents/summarize.ts -- \
//     --input="Assets/agents/output/28 de feb, 17-54/final-attributed.txt" \
//     --chapter=5 --title="The Escape" --session=7

import { mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

import {
  WORKSPACE_ROOT,
  SUMMARY_MODELS,
  SUMMARY_PROMPTS,
  SUMMARY_TIMEOUT_MS,
  CAMPAIGN,
  MAX_RETRIES,
  DEBUG,
} from "./config";
import { runAgentWithRetry, extractTranscriptText } from "./runner";

interface SessionMeta {
  inputFile: string;
  chapter: number;
  title: string;
  session: number;
}

function parseArgs(): SessionMeta {
  const inputArg = process.argv.find((a) => a.startsWith("--input="));
  const chapterArg = process.argv.find((a) => a.startsWith("--chapter="));
  const titleArg = process.argv.find((a) => a.startsWith("--title="));
  const sessionArg = process.argv.find((a) => a.startsWith("--session="));

  if (!inputArg || !chapterArg || !titleArg || !sessionArg) {
    console.error(
      'Usage: bun run summarize.ts -- --input="<attributed.txt>" --chapter=N --title="Chapter Title" --session=N'
    );
    process.exit(1);
  }

  return {
    inputFile: inputArg.split("=").slice(1).join("="),
    chapter: parseInt(chapterArg.split("=")[1], 10),
    title: titleArg.split("=").slice(1).join("="),
    session: parseInt(sessionArg.split("=")[1], 10),
  };
}

function findPreviousChapterSummary(currentChapter: number): string | null {
  if (currentChapter <= 1) return null;

  const chaptersDir = CAMPAIGN.chaptersDir;
  for (let i = currentChapter - 1; i >= 1; i--) {
    const entries = (() => {
      try {
        const fs = require("fs");
        return fs.readdirSync(chaptersDir) as string[];
      } catch {
        return [];
      }
    })();

    const match = entries.find((e: string) =>
      e.startsWith(`Chapter ${i}`)
    );
    if (match) {
      const summaryPath = join(chaptersDir, match, "Summary.md");
      if (existsSync(summaryPath)) return summaryPath;
    }
  }
  return null;
}

function buildNarratorPrompt(
  inputFile: string,
  meta: SessionMeta,
  prevSummaryPath: string | null
): string {
  let prompt = `You are writing a chapter summary for a D&D campaign.

Read your system instructions from: ${SUMMARY_PROMPTS.narrator}
Read the attributed session transcript from: ${inputFile}
`;

  if (prevSummaryPath) {
    prompt += `Read the previous chapter's summary for continuity from: ${prevSummaryPath}\n`;
  }

  prompt += `
Session metadata:
- Chapter number: ${meta.chapter}
- Chapter title: ${meta.title}
- Session number: ${meta.session.toString().padStart(2, "0")}

IMPORTANT: You must output the FULL Summary.md document directly. Start with "# Chapter ${meta.chapter}: ${meta.title} — Session ${meta.session.toString().padStart(2, "0")}" and include every section (Setting the Scene, The Story, Key Revelations, Consequences, Chapter Status, Organizations Present, NPC Tracker). Do NOT describe what you would write — actually write it. Do NOT use code blocks. Output raw markdown only.`;

  return prompt;
}

function buildCharacterArcPrompt(
  inputFile: string,
  characterName: string,
  storyPath: string,
  meta: SessionMeta
): string {
  return `You are updating a character's story arc for a D&D campaign.

Read your system instructions from: ${SUMMARY_PROMPTS.characterArc}
Read the attributed session transcript from: ${inputFile}
Read the character's existing Story.md from: ${storyPath}

Session metadata:
- Character to update: ${characterName}
- Chapter number: ${meta.chapter}
- Chapter title: ${meta.title}

Output ONLY the new chapter section and updated Current Status table — no code blocks, no explanations. Do NOT output the entire Story.md, only the NEW section to append.`;
}

function buildNpcUpdaterPrompt(inputFile: string, meta: SessionMeta): string {
  return `You are updating the NPC registry for a D&D campaign.

Read your system instructions from: ${SUMMARY_PROMPTS.npcUpdater}
Read the attributed session transcript from: ${inputFile}
Read the existing NPC registry from: ${CAMPAIGN.npcs}

Session metadata:
- Chapter number: ${meta.chapter}

Output the COMPLETE updated NPCs.md file with all existing entries preserved and new/updated entries included. Output ONLY the markdown content — no code blocks, no explanations.`;
}

function buildPlotTrackerPrompt(
  inputFile: string,
  meta: SessionMeta
): string {
  return `You are updating the plot tracker for a D&D campaign.

Read your system instructions from: ${SUMMARY_PROMPTS.plotTracker}
Read the attributed session transcript from: ${inputFile}
Read the existing plot tracker from: ${CAMPAIGN.plotTracker}

Session metadata:
- Chapter number: ${meta.chapter}

Output the COMPLETE updated Tracker.md file with all existing entries preserved and updates/additions included. Output ONLY the markdown content — no code blocks, no explanations.`;
}

async function main() {
  const meta = parseArgs();

  const inputPath = meta.inputFile.startsWith("/")
    ? meta.inputFile
    : join(WORKSPACE_ROOT, meta.inputFile);

  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const chapterDir = join(
    CAMPAIGN.chaptersDir,
    `Chapter ${meta.chapter} - ${meta.title}`
  );
  const summaryPath = join(chapterDir, "Summary.md");
  const outputDir = join(
    WORKSPACE_ROOT,
    "Assets",
    "agents",
    "output",
    "summaries",
    `ch${meta.chapter}`
  );

  await mkdir(chapterDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  console.log("================================================================");
  console.log("       FROZEN SICK — SESSION SUMMARIZER (Phase 2)");
  console.log("================================================================");
  console.log(`Input:     ${inputPath}`);
  console.log(`Chapter:   ${meta.chapter} — ${meta.title}`);
  console.log(`Session:   ${meta.session}`);
  console.log(`Output:    ${chapterDir}/Summary.md`);
  console.log(
    `Models:    narrator=${SUMMARY_MODELS.narrator}  chars=${SUMMARY_MODELS.characterArc}  npc=${SUMMARY_MODELS.npcUpdater}  plot=${SUMMARY_MODELS.plotTracker}`
  );
  if (DEBUG) console.log("Debug:     ON");
  console.log("\n================================================================");
  console.log("       RUNNING ALL AGENTS IN PARALLEL");
  console.log("================================================================\n");

  const prevSummary = findPreviousChapterSummary(meta.chapter);
  if (prevSummary) {
    console.log(`[INFO] Previous chapter summary found: ${prevSummary}`);
  }

  const retries = MAX_RETRIES;
  const timeout = SUMMARY_TIMEOUT_MS;

  const askMode = "ask" as const;

  const [narratorResult, tidusResult, nixiraResult, zacaríasResult, npcResult, plotResult] =
    await Promise.all([
      runAgentWithRetry(
        "Narrator",
        buildNarratorPrompt(inputPath, meta, prevSummary),
        extractTranscriptText,
        retries,
        SUMMARY_MODELS.narrator,
        timeout,
        askMode
      ),

      runAgentWithRetry(
        "CharArc-Tidus",
        buildCharacterArcPrompt(inputPath, "Tidus", CAMPAIGN.characters.tidus, meta),
        extractTranscriptText,
        retries,
        SUMMARY_MODELS.characterArc,
        timeout,
        askMode
      ),

      runAgentWithRetry(
        "CharArc-Nixira",
        buildCharacterArcPrompt(inputPath, "Nixira", CAMPAIGN.characters.nixira, meta),
        extractTranscriptText,
        retries,
        SUMMARY_MODELS.characterArc,
        timeout,
        askMode
      ),

      runAgentWithRetry(
        "CharArc-Zacarías",
        buildCharacterArcPrompt(inputPath, "Zacarías", CAMPAIGN.characters.zacarias, meta),
        extractTranscriptText,
        retries,
        SUMMARY_MODELS.characterArc,
        timeout,
        askMode
      ),

      runAgentWithRetry(
        "NPC-Updater",
        buildNpcUpdaterPrompt(inputPath, meta),
        extractTranscriptText,
        retries,
        SUMMARY_MODELS.npcUpdater,
        timeout,
        askMode
      ),

      runAgentWithRetry(
        "Plot-Tracker",
        buildPlotTrackerPrompt(inputPath, meta),
        extractTranscriptText,
        retries,
        SUMMARY_MODELS.plotTracker,
        timeout,
        askMode
      ),
    ]);

  // Write results
  console.log("\n================================================================");
  console.log("       WRITING RESULTS");
  console.log("================================================================\n");

  let successes = 0;
  let failures = 0;

  if (narratorResult) {
    await Bun.write(summaryPath, narratorResult);
    await Bun.write(join(outputDir, "summary.md"), narratorResult);
    console.log(`[OK] Summary:       ${summaryPath}`);
    successes++;
  } else {
    console.log("[FAIL] Summary:     Narrator agent failed");
    failures++;
  }

  if (tidusResult) {
    await Bun.write(join(outputDir, "tidus-arc.md"), tidusResult);
    console.log(`[OK] Tidus arc:     ${outputDir}/tidus-arc.md`);
    successes++;
  } else {
    console.log("[FAIL] Tidus arc:   Agent failed");
    failures++;
  }

  if (nixiraResult) {
    await Bun.write(join(outputDir, "nixira-arc.md"), nixiraResult);
    console.log(`[OK] Nixira arc:    ${outputDir}/nixira-arc.md`);
    successes++;
  } else {
    console.log("[FAIL] Nixira arc:  Agent failed");
    failures++;
  }

  if (zacaríasResult) {
    await Bun.write(join(outputDir, "zacarias-arc.md"), zacaríasResult);
    console.log(`[OK] Zacarías arc:  ${outputDir}/zacarias-arc.md`);
    successes++;
  } else {
    console.log("[FAIL] Zacarías arc: Agent failed");
    failures++;
  }

  if (npcResult) {
    await Bun.write(join(outputDir, "npcs-updated.md"), npcResult);
    console.log(`[OK] NPCs:          ${outputDir}/npcs-updated.md`);
    successes++;
  } else {
    console.log("[FAIL] NPCs:        Agent failed");
    failures++;
  }

  if (plotResult) {
    await Bun.write(join(outputDir, "tracker-updated.md"), plotResult);
    console.log(`[OK] Plot Tracker:  ${outputDir}/tracker-updated.md`);
    successes++;
  } else {
    console.log("[FAIL] Plot Tracker: Agent failed");
    failures++;
  }

  console.log("\n================================================================");
  console.log(
    `       PHASE 2 COMPLETE — ${successes}/6 AGENTS SUCCEEDED${failures > 0 ? `, ${failures} FAILED` : ""}`
  );
  console.log("================================================================");
  console.log(`\nResults written to: ${outputDir}`);

  if (narratorResult) {
    console.log(`Chapter summary written to: ${summaryPath}`);
  }

  console.log(
    "\nNote: Character arcs, NPCs, and Plot Tracker updates are saved"
  );
  console.log(
    "as drafts in the output folder. Review them before applying to"
  );
  console.log("the campaign files.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
