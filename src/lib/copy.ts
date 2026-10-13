// Plain-language labels so someone new can read the dashboard without knowing the internals.
import type { GateResult, Health, PhaseId, RunRecord, Severity, TaskStatus } from "@/shared/types"

export const HEALTH_LABEL: Record<Health, string> = {
  Green: "On track",
  Yellow: "Needs attention",
  Red: "Off track",
}

/** The red/amber/green word reporting teams already use. */
export const RAG_LABEL: Record<Health, string> = { Green: "Green", Yellow: "Amber", Red: "Red" }

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: "Urgent",
  medium: "Watch",
  low: "Low",
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  at_risk: "At risk",
  blocked: "Blocked",
  not_started: "Not started",
}

export const RUN_STATUS_LABEL: Record<RunRecord["status"], string> = {
  running: "Writing",
  ready: "Ready to share",
  held: "Needs review",
  published: "Shared",
  failed: "Failed",
}

/** What the agent is doing during each phase, phrased for the person watching. */
export const PHASE_PROGRESS: Record<PhaseId, string> = {
  ingest: "Reading your Notion tracker…",
  analyze: "Spotting risks and overdue work…",
  compose: "Writing the brief with AI…",
  gate: "Double-checking the facts…",
  publish: "Posting to Slack…",
}

/** Stops on the route line, one per pipeline phase, named the way a person would say them. */
export const STATIONS: { id: PhaseId; name: string }[] = [
  { id: "ingest", name: "Notion" },
  { id: "analyze", name: "Risk scan" },
  { id: "compose", name: "AI draft" },
  { id: "gate", name: "Checks" },
  { id: "publish", name: "Slack" },
]

/** ISO-8601 week number, the unit status reports are usually filed under. */
export const isoWeek = (date: Date) => {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export const friendlyModel = (model?: string) =>
  model
    ? model
        .replace(/^gemini-/, "Gemini ")
        .replace(/-/g, " ")
        .replace(/\b(flash|pro|lite|latest)\b/g, (word) => word[0].toUpperCase() + word.slice(1))
    : "AI"

/** A check's label and explanation in everyday words. */
export const describeGate = (gate: GateResult, run: RunRecord): { title: string; detail: string } => {
  const metrics = run.metrics
  const urgent = metrics?.highSeverityRisks ?? 0
  switch (gate.id) {
    case "confidence":
      return {
        title: `On-track score is ${run.settings.minConfidence}% or higher`,
        detail: gate.passed
          ? `Scored ${metrics?.confidence ?? "?"}%.`
          : `Scored ${metrics?.confidence ?? "?"}%. Too much is at risk to post without a person looking first.`,
      }
    case "high_risks":
      return {
        title: `No more than ${run.settings.highRiskLimit} urgent risks`,
        detail: gate.passed
          ? `${urgent} urgent risk${urgent === 1 ? "" : "s"} found.`
          : `${urgent} urgent risks found. Leadership should hear about these, so check the wording first.`,
      }
    case "llm_valid":
      return {
        title: "AI draft is complete",
        detail: gate.passed
          ? "The draft has every section the update needs."
          : run.llm?.error
            ? "The AI service was busy or unavailable, so a basic template was used instead. Trying again usually fixes this."
            : "The AI's draft was missing pieces, so a basic template was used instead.",
      }
    case "grounding":
      return {
        title: "Everything matches Notion",
        detail: gate.passed
          ? "Every project mentioned exists in your tracker, and no urgent risk was left out."
          : `${gate.detail} The draft may mention something that isn't in Notion.`,
      }
  }
}
