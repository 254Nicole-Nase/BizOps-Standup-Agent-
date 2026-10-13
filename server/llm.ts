import { GoogleGenAI } from "@google/genai"
import { z } from "zod"
import type { Brief, LlmProvider, Metrics, Task } from "../src/shared/types"
import { authHeader, config } from "./config"

const severity = z.enum(["high", "medium", "low"])

export const briefSchema = z.object({
  headline: z.string().min(8).max(200),
  summary: z.string().min(20).max(900),
  wins: z.array(z.string().min(3).max(240)).max(5),
  risks: z
    .array(
      z.object({
        project: z.string().min(1),
        issue: z.string().min(3).max(300),
        severity,
        action: z.string().min(3).max(300),
        owner: z.string().min(1),
      }),
    )
    .max(8),
  leadershipAsks: z.array(z.string().min(3).max(240)).max(5),
  nextWeekFocus: z.array(z.string().min(3).max(200)).max(5),
})

const SYSTEM_PROMPT = `You are the BizOps Standup Agent, a chief-of-staff analyst who writes the weekly executive delivery brief.

Rules:
- Use ONLY the tracker data and computed metrics provided. Never invent projects, people, numbers or dates.
- Severity for each risk is pre-computed. Copy it exactly and do not upgrade or downgrade it.
- Every high-severity risk MUST appear in "risks". Order risks high to low.
- "project" in each risk must exactly match a project name from the tracker.
- Actions must be concrete and owner-directed (who does what, by when). No filler like "monitor closely".
- leadershipAsks are decisions or unblocks only an executive can provide. Return an empty list if there are none.
- Tone: crisp, factual, no hype, no emojis. Write for a COO skimming on mobile.
- Respond with a single JSON object and nothing else.

JSON shape:
{
  "headline": string,            // one line, lead with health colour, e.g. "Yellow: 3 launches on track, Customer Portal go-live at risk"
  "summary": string,             // 2-3 sentences on overall delivery health
  "wins": string[],              // up to 3 shipped outcomes with impact
  "risks": [{ "project": string, "issue": string, "severity": "high"|"medium"|"low", "action": string, "owner": string }],
  "leadershipAsks": string[],    // up to 3
  "nextWeekFocus": string[]      // up to 3
}`

export const buildUserPrompt = (tasks: Task[], metrics: Metrics, now = new Date()) => {
  const tracker = tasks.map((task) => ({
    project: task.project,
    owner: task.owner,
    status: task.status,
    progress: task.progress,
    due: task.dueDate ?? null,
    blocker: task.blocker ?? null,
    update: task.latestUpdate ?? null,
  }))
  const risks = metrics.risks.map((risk) => ({
    project: risk.project,
    owner: risk.owner,
    severity: risk.severity,
    signals: risk.signals,
    issue: risk.summary,
    suggestedAction: risk.recommendedAction,
  }))
  const { risks: _omit, ...headline } = metrics

  return `Today: ${now.toISOString().slice(0, 10)}

Computed metrics:
${JSON.stringify(headline, null, 2)}

Scored risks (authoritative severities):
${JSON.stringify(risks, null, 2)}

Tracker items:
${JSON.stringify(tracker, null, 2)}

Write this week's brief as JSON.`
}

/** Pull the first JSON object out of a model reply (tolerates code fences / preamble). */
export const extractJson = (text: string): unknown => {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end <= start) throw new Error("Model reply contained no JSON object")
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

const callCerebras = async (model: string, user: string, jsonMode = true): Promise<string> => {
  const response = await fetch(`${config.cerebras.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      ...authHeader(config.cerebras.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  })

  const json: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = json?.message ?? json?.error?.message ?? response.statusText
    // Some models reject response_format; retry once in plain mode.
    if (jsonMode && response.status === 400 && /response_format|json/i.test(message)) {
      return callCerebras(model, user, false)
    }
    throw Object.assign(new Error(`Cerebras ${response.status}: ${message}`), { status: response.status })
  }
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error("Cerebras returned an empty completion")
  return content
}

/** Backoff before each retry of a transient provider error (rate limit or 5xx). Tests set this to zeros. */
export const retryPolicy = { delaysMs: [1500, 4000] }

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504])

const isTransient = (error: unknown) => TRANSIENT_STATUSES.has(Number((error as { status?: unknown })?.status))

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  for (let retry = 0; ; retry += 1) {
    try {
      return await fn()
    } catch (error) {
      if (retry >= retryPolicy.delaysMs.length || !isTransient(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, retryPolicy.delaysMs[retry]))
    }
  }
}

let gemini: GoogleGenAI | null = null

const callGemini = async (model: string, user: string): Promise<string> => {
  gemini ??= new GoogleGenAI({ apiKey: config.gemini.apiKey })
  const response = await gemini.models.generateContent({
    model,
    contents: user,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  })
  if (!response.text) throw new Error("Gemini returned an empty response")
  return response.text
}

export interface ComposeResult {
  brief: Brief
  latencyMs: number
  attempts: number
}

/**
 * Generate the brief with the selected provider. The reply is schema-validated;
 * on failure the validation errors are fed back for one repair attempt.
 */
export const composeBrief = async (
  provider: Exclude<LlmProvider, "none">,
  model: string,
  tasks: Task[],
  metrics: Metrics,
): Promise<ComposeResult> => {
  const started = Date.now()
  const call = provider === "cerebras" ? callCerebras : callGemini
  let prompt = buildUserPrompt(tasks, metrics)
  let lastError = ""

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await withRetry(() => call(model, prompt))
    try {
      const parsed = briefSchema.safeParse(extractJson(reply))
      if (parsed.success) {
        return { brief: parsed.data, latencyMs: Date.now() - started, attempts: attempt }
      }
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ")
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    prompt = `${buildUserPrompt(tasks, metrics)}

Your previous reply was rejected by the validator: ${lastError}
Return corrected JSON only.`
  }
  throw new Error(`Output failed validation: ${lastError}`)
}
