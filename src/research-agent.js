import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { APPS } from "./apps-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "data");
const RESULTS_FILE = path.join(OUTPUT_DIR, "research-results.json");

function loadEnv() {
  try {
    const envPath = path.join(__dirname, "..", ".env");
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {}
}
loadEnv();

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const BATCH_SIZE = 1;
const DELAY_BETWEEN_BATCHES_MS = 6000;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RESEARCH_PROMPT = `You are a technical researcher evaluating SaaS apps for AI agent toolkit buildability at Composio (composio.dev), a platform that turns apps into tools AI agents can call.

For the given app, determine these fields based on your knowledge of the app, its developer docs, and API surface. Be specific and evidence-based.

Respond with ONLY valid JSON (no markdown fences, no backticks, no explanation):
{
  "app_name": "string",
  "category": "string (the category provided)",
  "one_liner": "string (what the app does in one concise line, max 15 words)",
  "auth_methods": ["array of: OAuth2, API Key, Basic, Bearer Token, OAuth1, Custom, None"],
  "auth_primary": "string (the primary/recommended auth method for API access)",
  "self_serve": "Yes | Partial | No",
  "self_serve_detail": "string explaining: free tier available? free trial for API? paid-only API? admin approval needed? partner/sales gate?",
  "api_type": "REST | GraphQL | Both | SOAP | WebSocket | CLI-only | None",
  "api_breadth": "Broad | Moderate | Narrow | Minimal | None",
  "api_breadth_detail": "string: roughly how many endpoint groups exist, what operations are possible",
  "has_mcp": "Yes | Community | No | Unknown",
  "mcp_detail": "string: if MCP server exists, who maintains it and where to find it",
  "buildability": "Easy | Moderate | Hard | Not Feasible",
  "buildability_blocker": "string: the main blocker if not Easy, or 'None' if Easy",
  "docs_url": "string: the primary developer/API docs URL — must be a real URL you are confident exists",
  "notes": "string: important caveats, recent changes, or observations"
}

DEFINITIONS:
- "Self-serve: Yes" = developer can sign up, create an app/project, and get API credentials for free or on a free trial. No sales call, no admin approval.
- "Self-serve: Partial" = free tier exists but API access requires a paid plan, OR free API with significant restrictions that limit toolkit usefulness.
- "Self-serve: No" = needs partnership agreement, contact-sales, enterprise plan, or admin approval to get API access.
- "Buildability: Easy" = public documented API + standard auth (OAuth2/API Key) + self-serve access. An agent can meaningfully call these APIs today.
- "Buildability: Moderate" = API exists but has friction (complex auth, limited endpoints, rate limits, or partial self-serve).
- "Buildability: Hard" = API exists but major blockers (partner-gated, undocumented, very complex auth, or niche use case).
- "Buildability: Not Feasible" = no public API, or product is a CLI tool/library not suitable for API-based agent toolkits.
- For "has_mcp", check if there is a known Model Context Protocol server (official or community-built) for this app.`;

async function researchApp(app) {
  const userPrompt = `Research this app for AI agent toolkit buildability:
App: ${app.name}
Category: ${app.category}
Website/Docs hint: ${app.url}

Return ONLY the JSON object.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: RESEARCH_PROMPT + "\n\n" + userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const content = result.response.text().trim();
      const parsed = JSON.parse(content);
      return { ...parsed, id: app.id, research_method: MODEL_NAME, timestamp: new Date().toISOString() };
    } catch (err) {
      const is429 = err.message.includes("429") || err.message.includes("quota");
      if (is429 && attempt < MAX_RETRIES) {
        const retryMatch = err.message.match(/retry(?:Delay)?[": ]*(\d+)/i);
        const waitSec = retryMatch ? parseInt(retryMatch[1]) + 5 : 45;
        console.error(`  [RATE_LIMIT] Rate limited for ${app.name}, waiting ${waitSec}s (attempt ${attempt}/${MAX_RETRIES})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      console.error(`  ✗ Failed for ${app.name} (attempt ${attempt}): ${err.message.slice(0, 120)}`);
      return {
        id: app.id,
        app_name: app.name,
        category: app.category,
        one_liner: "Research failed — needs manual check",
        auth_methods: ["Unknown"],
        auth_primary: "Unknown",
        self_serve: "Unknown",
        self_serve_detail: "Research failed",
        api_type: "Unknown",
        api_breadth: "Unknown",
        api_breadth_detail: "Research failed",
        has_mcp: "Unknown",
        mcp_detail: "",
        buildability: "Unknown",
        buildability_blocker: "Research failed",
        docs_url: app.url,
        notes: `Error: ${err.message.slice(0, 200)}`,
        research_method: "failed",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

function loadExistingResults() {
  try {
    const data = fs.readFileSync(RESULTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function runResearch() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existing = loadExistingResults();
  const completedIds = new Set(existing.filter((r) => r.research_method !== "failed").map((r) => r.id));
  const remaining = APPS.filter((app) => !completedIds.has(app.id));

  console.log(`\n[START] Composio Toolkit Research Agent`);
  console.log(`   Model: ${MODEL_NAME}`);
  console.log(`   Total apps: ${APPS.length}`);
  console.log(`   Already researched: ${completedIds.size}`);
  console.log(`   Remaining: ${remaining.length}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Delay between batches: ${DELAY_BETWEEN_BATCHES_MS}ms\n`);

  if (remaining.length === 0) {
    console.log("[INFO] All apps already researched.");
    return existing;
  }

  const results = [...existing.filter((r) => r.research_method !== "failed")];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

    console.log(`\n[BATCH] Batch ${batchNum}/${totalBatches}: ${batch.map((a) => a.name).join(", ")}`);

    const batchResults = await Promise.all(batch.map((app) => researchApp(app)));

    for (const result of batchResults) {
      if (result.research_method === "failed") {
        failCount++;
        console.log(`  ✗ ${result.app_name} → FAILED`);
      } else {
        successCount++;
        console.log(`  ✓ ${result.app_name} → auth:${result.auth_primary} | self-serve:${result.self_serve} | build:${result.buildability}`);
      }
      results.push(result);
    }

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`  [SAVE] Saved (${results.length} total)`);

    if (i + BATCH_SIZE < remaining.length) {
      console.log(`  [WAIT] Waiting ${DELAY_BETWEEN_BATCHES_MS}ms...`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`[COMPLETE] Research finished.`);
  console.log(`   Succeeded: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Saved to: ${RESULTS_FILE}`);
  return results;
}

runResearch().catch(console.error);
