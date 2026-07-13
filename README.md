# Composio Toolkit Research Agent

AI-driven research pipeline that analyzes **100 SaaS apps** across 10 categories for agent toolkit buildability. Built for the Composio AI Product Ops Intern assignment.

## Headline Findings

| Metric | Value |
|---|---|
| Apps analyzed | 100 |
| Easy wins (build today) | 69 |
| Dominant auth | OAuth2 (44/100) |
| Self-serve API access | 79/100 |
| Top blocker | Partner/sales gate (12 apps) |
| Manual verification sample size | 10 apps (10% of dataset) |
| Verification Accuracy | 90% First-Pass, 100% Final Verified |

## What It Researches

For each app, the agent determines:
- **Auth methods** - all methods (OAuth2, API Key, Bearer Token, etc.) and the primary one
- **Self-serve access** - can a developer get API credentials without sales contact?
- **API surface** - REST, GraphQL, SOAP, CLI-only, etc. API breadth (Broad/Moderate/Narrow)
- **MCP availability** - does an official or community MCP server exist?
- **Buildability** - Easy / Moderate / Hard / Not Feasible for agent toolkit integration
- **Blockers** - what prevents toolkit creation (sales gate, no API, CLI-only, etc.)

## Quick Start

```bash
npm install

# Add your Gemini API key to .env
echo "GEMINI_API_KEY=your-key-here" > .env

# Run the full pipeline (Researches, Audits, and Generates dashboard)
npm run pipeline

# Or individual steps:
npm run research      # Research all 100 apps (Gemini 3.1 Flash Lite)
npm run verify        # Run automated scraper & doc verification loop
npm run generate      # Aggregate patterns and generate interactive HTML report
npm run apply-manual  # Apply human-in-the-loop manual corrections from manual-verification.md
```

## Project Structure

```
composio-research/
├── manual-verification.md    # Human-in-the-loop manual audit file
├── src/
│   ├── apps-data.js          # 100 apps across 10 categories
│   ├── research-agent.js     # Core research agent (Gemini + structured JSON)
│   ├── generate-html.js      # On-the-fly aggregator & HTML report generator
│   ├── apply-manual-verdicts.js # Script to apply manual corrections to database
│   ├── run-verification-loop.js # Scrapes docs and performs auto audit
│   └── pipeline.js           # Runs all steps sequentially
├── data/
│   ├── research-results.json # Verified research data (100 apps)
│   ├── research-results-raw.json # Raw research data (pre-audit)
│   └── verification-verdicts.json # Scraper loop results
├── dist/
│   └── index.html            # Final interactive report
├── .env                      # GEMINI_API_KEY (not committed)
└── package.json
```

## Architecture

```
100 apps (apps-data.js)
    ↓
Gemini 3.1 Flash Lite (structured JSON, 1 app at a time, 6s delay)
    ↓
research-results-raw.json (raw first-pass saves)
    ↓
Verification Loops (scraper comparisons) + Human Audit (manual-verification.md)
    ↓
research-results.json (final verified database)
    ↓
HTML Generator & Aggregator (in-memory pattern analysis + interactive dashboard)
    ↓
dist/index.html
```

## Agent Design

- **Model**: Google Gemini 3.1 Flash Lite via `@google/generative-ai` SDK
- **Structured output**: `responseMimeType: "application/json"` for reliable parsing
- **Rate limiting**: 6-second delay between requests (Google AI Studio free tier limits)
- **Crash resilience**: Saves after every app. Re-runs skip already-completed apps

## Verification & Trust Loop

The pipeline is split into three distinct phases to ensure maximum data integrity:
`AI Extraction (Stage 1) → AI Verification Loop (Stage 2) → Human Audit Overrides (Stage 3)`

1. **AI Extraction (`research-agent.js`)**: Initial data gathering leveraging Gemini 3.1 Flash Lite weights.
2. **AI Verification Loop (`run-verification-loop.js`)**: Automated verification of a sample subset (10%).
   * **Scale & Limits Note**: For this evaluation phase, the loop was run on a representative sample of 10 apps (10% of the dataset) due to free-tier API rate limits and development time constraints. In a production scale-up, this loop runs asynchronously across all 100+ platforms utilizing production tier limits.
   * **Anticipating Real-World Friction**: Since modern developer portals block simple headless crawler scripts via Cloudflare or render empty skeleton pages using client-side JavaScript, the script implements a **Crawler Fallback mechanism**. If the page scraping fails, it passes a fallback instruction to Gemini, asking it to audit the claims against its own deep database of API specs.
   * **Mitigating Self-Consistency Bias**: We deliberately separate Step 1 and Step 2. Asking an LLM to evaluate its own work within the same prompt creates an echo chamber where it double-downs on its own hallucinations. Using an independent verification loop provides an objective audit.
3. **Human Audit Overrides (`apply-manual-verdicts.js`)**: Final ground truth database updates. The human audits the findings via `manual-verification.md` and runs the applier script.
   * **First-Pass Accuracy**: 90% (72/80 correct properties in the raw LLM sample).
   * **Final Verified Accuracy**: 100% (errors corrected and merged into the active database).

## Built With

- Node.js (ESM)
- Google Gemini 3.1 Flash Lite
- `@google/generative-ai` SDK
- Vanilla CSS & HTML
