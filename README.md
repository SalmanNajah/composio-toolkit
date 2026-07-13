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

The research pipeline operates in three modular stages to ensure data integrity:
1. **Extraction (AI)**: `src/research-agent.js` extracts API specifications using Gemini.
2. **Audit (Verification)**: `src/run-verification-loop.js` crawls developer documentation to flag potential drifts.
3. **Ground Truth (Human)**: The reviewer reviews findings in `manual-verification.md` and applies final database overrides via `npm run apply-manual`.

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
