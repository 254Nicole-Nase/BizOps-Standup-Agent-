# BizOps Standup Agent

An operations-focused standup assistant that turns weekly project updates into executive-ready Slack summaries.

## Product Concept

The system is designed to:

1. Pull weekly task updates from Notion.
2. Use an LLM to analyze progress and identify blockers.
3. Generate a concise executive summary.
4. Post the summary to Slack with quality gates.
5. Track estimated hours saved vs manual PM reporting.

## What Is Implemented in This App

- Full-stack Node.js Express backend API (`server.ts`).
- Interactive BizOps control center UI wired to the backend API.
- Actual AI integration using the `@google/genai` SDK to generate executive briefs from mock Notion data.
- Agent workflow execution: Ingest -> Analyze -> Compose -> Publish.
- Configurable run settings:
	- cadence
	- Notion database
	- Slack channel
	- model
	- orchestration runtime (CrewAI or LangGraph)
- Quality gates before posting:
	- minimum confidence threshold
	- high-severity blocker limit
- Executive brief tab with Slack payload preview.
- Blocker triage tab with severity, owner, age, and next action.
- Run log tab with timeline output.
- Hours-saved calculator with monthly and annual savings estimation.

## What Is Still Missing to Ship in Production

- Real API integrations and credentials flow for Notion and Slack (currently simulated in `server.ts`).
- Secure secret management and token rotation.
- Retry strategy and dead-letter handling for failed API operations.
- Persistent storage for run history, confidence trends, and blocker analytics.
- Scheduled backend runner and alerting for failed runs.

## Suggested Real Stack

- Node.js/TypeScript backend (Express)
- Gemini API for analysis and summary generation (`@google/genai`)
- Notion API as the source of truth
- Slack API for publishing

## Local Development

1. Add your `GEMINI_API_KEY` to the `.env` file.
2. Install dependencies.
3. Start the Vite app.
4. Use the UI to run weekly standup analyses.

Example commands:

- `npm install`
- `npm run dev`
