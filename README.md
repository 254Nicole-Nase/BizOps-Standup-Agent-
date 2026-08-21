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

- Interactive BizOps control center UI.
- Agent workflow simulation: Ingest -> Analyze -> Compose -> Publish.
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
- "What Is Missing to Ship" section for production-readiness priorities.

## What Is Still Missing to Ship in Production

- Real API integrations and credentials flow for Notion and Slack.
- Secure secret management and token rotation.
- Retry strategy and dead-letter handling for failed API operations.
- Persistent storage for run history, confidence trends, and blocker analytics.
- Scheduled backend runner and alerting for failed runs.

## Suggested Real Stack

- Python backend
- CrewAI or LangGraph orchestration
- Gemini API for analysis and summary generation
- Notion API as the source of truth
- Slack API for publishing

## Local Development

1. Install dependencies.
2. Start the Vite app.
3. Use the UI to simulate weekly standup runs and tune thresholds.

Example commands:

- `npm install`
- `npm run dev`

If you use pnpm:

- `pnpm install`
- `pnpm dev`
