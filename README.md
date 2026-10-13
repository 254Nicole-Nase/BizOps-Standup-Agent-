# BizOps Standup Agent

An AI operations agent that turns a Notion project tracker into a weekly executive brief in Slack. It runs a deterministic risk-scoring step, has an LLM (Google Gemini) write the brief, checks that brief against quality gates, and asks a human to approve when anything looks off.

```
Notion DB ──▶ Ingest ──▶ Score risk ──▶ Compose (LLM) ──▶ Quality gates ──▶ Slack
              Collector    Analyst        Writer             Reviewer         Publisher
                           deterministic  JSON + schema      4 checks         auto or
                           severity       validation +                        human-approved
                                          repair retry
```

## Why it's built this way

- **The LLM writes, the code decides.** Severity and confidence are computed deterministically (`server/analysis.ts`) and passed to the model as ground truth. The model only writes the narrative and actions, so the gates stay stable across runs and providers.
- **Structured output with a repair loop.** The model must return JSON matching a Zod schema. If it doesn't, the validation errors go back to the model for one repair attempt. If that also fails, the run falls back to a template brief and the schema gate fails.
- **Hallucination guard.** The grounding gate rejects any brief that mentions a project missing from the tracker, or that leaves out a high-severity risk.
- **Human in the loop.** A failing gate holds the brief. Posting it then needs an explicit override, and the override is recorded on the run.
- **Live, observable runs.** The server streams each phase and log line to the UI as NDJSON. Run history, timings, and gate results are persisted.

## Features

| | |
|---|---|
| **Notion ingest** | Paginates the database and fuzzy-matches property names (`Owner`/`Assignee`/`DRI`, `Due`/`Deadline`…). Handles status, select, people, number, formula, rollup, and date properties. `NOTION_PROPERTY_MAP` overrides any of these. |
| **Risk scoring** | Blocked or at-risk state, blocker age, overdue dates, due-date pressure against progress, and not-started items near their deadline. Each risk lists the signals that drove its score. |
| **LLM** | Google Gemini, with JSON output and a retry on rate limits and 5xx errors. With no key set, a deterministic template writer is used instead. |
| **Slack** | Block Kit message with a mrkdwn fallback. Posts with a bot token (and returns a permalink) or an incoming webhook. Without either, posts are recorded as dry runs. |
| **Scheduler** | `SCHEDULE_CRON` runs the agent unattended. Scheduled runs auto-post only when every gate passes. |
| **Dashboard** | Slack-style brief preview, risk triage, tracker table, live pipeline, confidence trend across runs, and a time-saved calculator. |

## Quick start

```bash
pnpm install
cp .env.example .env   # every value is optional
pnpm dev               # http://localhost:3000
```

With no keys set it runs end-to-end on demo data. Add keys one at a time:

1. **LLM:** set `GEMINI_API_KEY` (optionally `GEMINI_MODEL`, default `gemini-2.5-flash`).
2. **Notion:** create an internal integration, share your tracker database with it, then set `NOTION_TOKEN` and `NOTION_DATABASE_ID`.
   Recommended columns: `Project` (title), `Owner` (person), `Status` (status), `Progress` (number, 0-1 or 0-100), `Blocker` (text), `Blocked Since` (date), `Due` (date), `Update` (text).
3. **Slack:** create an app with the `chat:write` scope, invite it to the channel, then set `SLACK_BOT_TOKEN` and `SLACK_CHANNEL`. A channel ID is the most reliable value.
4. **Automation:** for example, `SCHEDULE_CRON="45 8 * * 1"` runs every Monday at 08:45.

### Keys injected by a proxy (Claude Code cloud network secrets)

If an outbound proxy adds the `Authorization` header for you, leave the token variables empty and set `PROXY_INJECTED_CREDENTIALS=notion,slack`. Those services then count as configured, and the app never sends or holds the key. When `HTTPS_PROXY` is set, the server sends its API calls through it automatically. (Gemini authenticates with an API-key header rather than a Bearer token, so set `GEMINI_API_KEY` directly.)

## Deploying (Render)

The app is one Node web service: Express serves the API and the built dashboard.

- **Build command:** `npx pnpm@10 install --frozen-lockfile && npx pnpm@10 build`
- **Start command:** `npx pnpm@10 start`
- **Environment:** `GEMINI_API_KEY`, `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `SLACK_BOT_TOKEN`, `SLACK_CHANNEL`, and `ADMIN_TOKEN`.

Always set `ADMIN_TOKEN` on a public host. Every API route except `/api/health` then requires it, and the dashboard asks for it as an access code. Without it, anyone with the link can read your tracker and post to Slack.

Run history is written to `DATA_DIR` (default `data/`). On a host without a persistent disk it resets on each deploy.

## Scoring model

Each open item earns points: blocked +3, at risk +2, open ≥2/3/5 days +1/+2/+3, overdue +3, due ≤7 days while flagged or below 80% +2, due ≤14 days below 50% +2, not started with a deadline inside 14 days +2. A score of 6 or more is **high**, 3 or more is **medium**, and 2 is **low**.

`confidence = 100 − Σ(high 10, medium 5, low 2) + 10 × completion ratio`. Health is Green at 80 or above, Yellow at 65 or above, and Red below that.

## API

| Method | Path | |
|---|---|---|
| `GET` | `/api/status` | Integration status, schedule, default settings |
| `GET` | `/api/tasks` | Current tracker items |
| `POST` | `/api/runs` | Start a run and stream NDJSON events. Body: `{ settings }` |
| `GET` | `/api/runs` · `/api/runs/:id` | Run history and run detail |
| `POST` | `/api/runs/:id/publish` | Publish a run. Held runs need `{ "override": true }` |

When `ADMIN_TOKEN` is set, every route except `/api/health` requires an `x-admin-token` header.

## Development

```bash
pnpm test        # Vitest: scoring, gates, Notion mapping, LLM repair loop, Slack blocks
pnpm typecheck
pnpm build && pnpm start
```

Project layout: `server/` (config, notion, analysis, llm, slack, pipeline, store, scheduler), `server.ts` (Express routes plus Vite middleware), `src/` (React dashboard), `src/shared/types.ts` (types shared by client and server), `tests/`.

Stack: TypeScript, Node/Express 5, React 19, Vite, Tailwind v4, Zod, Vitest, Notion API, Slack Web API, Gemini.
