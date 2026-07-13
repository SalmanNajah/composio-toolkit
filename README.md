# Composio Toolkit Research Agent

An AI-driven research pipeline that evaluates SaaS apps for AI agent toolkit buildability. Built for the Composio AI Product Ops assignment.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add Gemini API Key to .env
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Run the full pipeline (Extracts, Audits, and Generates HTML Report)
npm run pipeline

# Or run individual steps:
npm run research      # Phase 1: AI Spec Extraction (Gemini 3.1 Flash Lite)
npm run verify        # Phase 2: Automated Scraper & Doc Verification Loop
npm run apply-manual  # Phase 3: Apply Human Overrides from manual-verification.md
npm run generate      # Rebuild the interactive dashboard (dist/index.html)
```

## How It Works

To address the case study criteria, the pipeline operates under four core components:
1. **The Agent**: A modular Node.js agent (`src/research-agent.js`) that uses Gemini to evaluate 100 SaaS apps, extracting their integration capabilities, auth methods, and buildability constraints.
2. **The Verification**: An automated audit loop (`src/run-verification-loop.js`) that crawls developer documentation, cross-referencing and grading the agent's findings to spot accuracy drifts.
3. **Human-in-the-Loop**: The QA stage where a human reviewer audits edge-cases and saves final overrides via `npm run apply-manual`.
4. **The Proof**: The runnable pipeline trigger (`npm run pipeline`) that coordinates the agent, verify loop, and manual overrides to generate the interactive dashboard (`dist/index.html`).

## Project Structure

```text
composio-research/
├── manual-verification.md    # Human-in-the-loop audit file
├── src/
│   ├── apps-data.js          # List of 100 target apps
│   ├── research-agent.js     # Stage 1: Extraction Agent
│   ├── run-verification-loop.js # Stage 2: Doc crawler & verifier
│   ├── apply-manual-verdicts.js # Stage 3: Human override applier
│   ├── generate-html.js      # Aggregator and dashboard compiler
│   └── pipeline.js           # Sequence orchestrator
├── data/
│   ├── research-results.json # Final verified database (100 apps)
│   ├── research-results-raw.json # Raw extraction results
│   └── verification-verdicts.json # Automated scraper verdicts
├── dist/
│   └── index.html            # Final interactive report dashboard
└── package.json
```
