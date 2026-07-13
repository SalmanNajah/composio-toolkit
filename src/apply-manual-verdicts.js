import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_FILE = path.join(__dirname, "..", "manual-verification.md");
const JSON_FILE = path.join(__dirname, "..", "data", "research-results.json");

if (!fs.existsSync(MD_FILE)) {
  console.error(`[ERROR] File ${MD_FILE} does not exist.`);
  process.exit(1);
}

const mdContent = fs.readFileSync(MD_FILE, "utf-8");
const appBlocks = mdContent.split(/### \d+\.\s+/).slice(1);
const results = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));

let updatedCount = 0;

for (const block of appBlocks) {
  const lines = block.split("\n");
  const appName = lines[0].trim();

  const getValue = (key) => {
    const line = lines.find(l => l.indexOf(key) !== -1);
    if (!line) return "";
    const parts = line.split(":");
    return parts.slice(1).join(":").replace(/[\*\`]/g, "").trim();
  };

  const verdict = getValue("VERDICT");
  if (verdict === "PENDING" || !verdict) continue;

  const app = results.find(r => r.app_name.toLowerCase() === appName.toLowerCase());
  if (!app) {
    console.log(`[WARN] App not found in database: ${appName}`);
    continue;
  }

  let modified = false;

  if (app.verification_status !== verdict) {
    app.verification_status = verdict;
    modified = true;
  }

  const updateField = (key, jsonField, isArray = false) => {
    const val = getValue(key);
    if (!val) return;
    if (isArray) {
      try {
        const parsed = JSON.parse(val);
        if (JSON.stringify(app[jsonField]) !== JSON.stringify(parsed)) {
          app[jsonField] = parsed;
          modified = true;
        }
      } catch (e) {
        const list = val.split(",").map(x => x.trim()).filter(Boolean);
        if (JSON.stringify(app[jsonField]) !== JSON.stringify(list)) {
          app[jsonField] = list;
          modified = true;
        }
      }
    } else {
      if (app[jsonField] !== val) {
        app[jsonField] = val;
        modified = true;
      }
    }
  };

  updateField("CORRECT_AUTH_PRIMARY", "auth_primary");
  updateField("CORRECT_AUTH_METHODS", "auth_methods", true);
  updateField("CORRECT_SELF_SERVE", "self_serve");
  updateField("CORRECT_SELF_SERVE_DETAIL", "self_serve_detail");
  updateField("CORRECT_API_TYPE", "api_type");
  updateField("CORRECT_API_BREADTH", "api_breadth");
  updateField("CORRECT_API_BREADTH_DETAIL", "api_breadth_detail");
  updateField("CORRECT_HAS_MCP", "has_mcp");
  updateField("CORRECT_MCP_DETAIL", "mcp_detail");
  updateField("CORRECT_BUILDABILITY", "buildability");
  updateField("CORRECT_BLOCKER", "buildability_blocker");

  const notes = getValue("NOTES");
  if (notes && app.human_notes !== notes) {
    app.human_notes = notes;
    modified = true;
  }

  if (modified) {
    console.log(`[VERDICT] Recorded human verdict for ${app.app_name} (${verdict})`);
    updatedCount++;
  }
}

if (updatedCount > 0) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(results, null, 2));
  console.log(`\n[SUCCESS] Applied human-in-the-loop updates to ${updatedCount} platforms.`);
  
  console.log("[INFO] Regenerating HTML report...");
  try {
    execSync(`node ${path.join(__dirname, "generate-html.js")}`, { stdio: "inherit" });
  } catch (err) {
    console.error(`[ERROR] Failed to regenerate HTML: ${err.message}`);
  }
} else {
  console.log("\n[INFO] No new human-in-the-loop updates were applied.");
}
