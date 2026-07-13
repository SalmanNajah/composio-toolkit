import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steps = [
  { name: "Research Agent", script: "research-agent.js" },
  { name: "Verification Loop", script: "run-verification-loop.js" },
  { name: "HTML Generation", script: "generate-html.js" },
];

console.log("[START] Composio Toolkit Research Pipeline");
console.log("=".repeat(50));

const startTime = Date.now();

for (const step of steps) {
  const stepStart = Date.now();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`[STEP] ${step.name}`);
  console.log("=".repeat(50));

  try {
    execSync(`node ${path.join(__dirname, step.script)}`, {
      stdio: "inherit",
      env: { ...process.env },
    });
    const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    console.log(`[SUCCESS] ${step.name} completed in ${elapsed}s`);
  } catch (err) {
    console.error(`[FAIL] ${step.name} failed: ${err.message}`);
    process.exit(1);
  }
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n${"=".repeat(50)}`);
console.log(`[COMPLETE] Pipeline finished successfully in ${totalElapsed}s`);
console.log("=".repeat(50));
