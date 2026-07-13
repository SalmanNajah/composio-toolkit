import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const RAW_FILE = path.join(DATA_DIR, "research-results-raw.json");
const VERDICTS_FILE = path.join(DATA_DIR, "verification-verdicts.json");

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

const VERIFY_SAMPLE = [
  "Salesforce", "Stripe", "Slack", "Shopify", "GitHub",
  "DealCloud", "Sherlock", "Firecrawl", "Snowflake", "Mermaid CLI"
];

function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve);
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => { req.destroy(); resolve(""); });
  });
}

function extractTextFromHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

async function verifyApp(app, docText) {
  const prompt = `You are a technical auditor checking an AI agent's research claims against the platform developer specifications in the context of building AI agent toolkits for Composio.

AGENT CLAIMS:
- Platform: ${app.app_name}
- Auth Primary: ${app.auth_primary}
- Self-Serve: ${app.self_serve}
- API Type: ${app.api_type}
- Buildability: ${app.buildability}

DOCS CONTENT OR CONTEXT:
${docText}

COMPOSIO INTEGRATION RULES & DEFINITIONS:
- "Buildability: Easy" = public, well-documented HTTP API (REST/GraphQL) + standard auth (OAuth2/API Key) + self-serve developer access. An agent can call these web endpoints today.
- "Buildability: Moderate" = API exists but has integration friction (complex/custom auth, rate limits, or partial/paid-only self-serve).
- "Buildability: Hard" = API exists but has major access blockers (partner/sales-gated, undocumented, or niche integration cases).
- "Buildability: Not Feasible" = no public API exists, or the product is a local CLI tool, database engine, or library without a hosted developer web API. (For example, Sherlock is a Python CLI script, and Mermaid CLI is a node CLI package; they have no public hosted web API, so they are NOT Easy to build as standard hosted agent toolkits - they are Not Feasible or Hard).

- "Self-serve: Yes" = developer can register and get API credentials online instantly without manual sales contact or approval.
- "Self-serve: No" = gated by partnership, contact-sales form, or manual admin screening.

Compare the agent claims to the platform documentation and Composio requirements. If the docs content contains a [CRAWLER_FALLBACK] notice, please evaluate the agent's claims using your own deep technical knowledge of the platform's developer API specifications. For each of the four fields (auth_primary, self_serve, api_type, buildability), decide if the claim is CORRECT, PARTIALLY_CORRECT, or INCORRECT. If it is partially correct or incorrect, state what the correct value should be based on real developer doc specs.

Determine the "overall_verdict" using these guidelines:
- "CORRECT": If all agent claims are accurate.
- "PARTIALLY_CORRECT": If there are minor drifts (e.g., missed an alternative API type like GraphQL when REST is present, or omitted secondary auth methods), but the core buildability rating and primary authentication remain correct.
- "INCORRECT": If there is severe drift (e.g., wrong primary auth, incorrect self-serve rating, or wrong buildability rating).

Respond with ONLY valid JSON:
{
  "app_name": "${app.app_name}",
  "verdicts": {
    "auth_primary": { "status": "CORRECT|PARTIALLY_CORRECT|INCORRECT", "correct_value": "OAuth2|API Key|Bearer Token|Basic|None", "reason": "reason" },
    "self_serve": { "status": "CORRECT|PARTIALLY_CORRECT|INCORRECT", "correct_value": "Yes|Partial|No", "reason": "reason" },
    "api_type": { "status": "CORRECT|PARTIALLY_CORRECT|INCORRECT", "correct_value": "REST|GraphQL|REST+GraphQL|SOAP|CLI-only|None", "reason": "reason" },
    "buildability": { "status": "CORRECT|PARTIALLY_CORRECT|INCORRECT", "correct_value": "Easy|Moderate|Hard|Not Feasible", "reason": "reason" }
  },
  "overall_verdict": "CORRECT|PARTIALLY_CORRECT|INCORRECT",
  "audit_notes": "A brief summary of any hits or misses"
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: "application/json" },
    });
    return JSON.parse(result.response.text().trim());
  } catch (err) {
    return {
      app_name: app.app_name,
      error: err.message,
      overall_verdict: "FAILED",
      audit_notes: "Could not run Gemini validation"
    };
  }
}

async function run() {
  const rawResults = JSON.parse(fs.readFileSync(RAW_FILE, "utf-8"));
  const sampleApps = rawResults.filter((r) => VERIFY_SAMPLE.includes(r.app_name));
  const verdicts = [];

  console.log("\n[START] Starting Automated Verification Loop");
  console.log("        Scraping docs and auditing agent claims with Gemini...");
  console.log("");

  for (const app of sampleApps) {
    console.log(`  [AUDIT] Auditing ${app.app_name}...`);
    const html = await fetchUrl(app.docs_url);
    const text = html ? extractTextFromHtml(html) : "";

    const isFailedScrape = !text || text.length < 300 || 
      text.toLowerCase().includes("cloudflare") || 
      text.toLowerCase().includes("enable javascript") || 
      text.toLowerCase().includes("access denied") ||
      text.toLowerCase().includes("page not found");

    let docText = text;
    if (isFailedScrape) {
      docText = `[CRAWLER_FALLBACK] Headless scraping was blocked by the developer portal security (Cloudflare or JS requirement) or returned an error page. Please audit the agent claims below using your own extensive knowledge of the ${app.app_name} developer platform specifications and API guidelines.`;
    }

    const audit = await verifyApp(app, docText);
    console.log(`          Verdict: ${audit.overall_verdict} (${audit.audit_notes})`);
    verdicts.push(audit);
    await new Promise((r) => setTimeout(r, 6000));
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VERDICTS_FILE, JSON.stringify(verdicts, null, 2));
  console.log(`\n[SUCCESS] Saved audit verdicts to: ${VERDICTS_FILE}\n`);
}

run().catch(console.error);
