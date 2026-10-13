// Plain-language labels so someone new can read the dashboard without knowing the internals.
import type { GateResult, Health, PhaseId, RunRecord, Severity, TaskStatus } from "@/shared/types"

export const HEALTH_LABEL: Record<Health, string> = {
  Green: "On track",
  Yellow: "Needs attention",
  Red: "Off track",
}

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

/** The three steps a person sees, each covering one or more pipeline phases. */
export const STEPS: { title: string; detail: string; phases: PhaseId[] }[] = [
  { title: "Gather", detail: "Reads every project in your Notion tracker and flags what's at risk.", phases: ["ingest", "analyze"] },
  { title: "Draft", detail: "AI writes a short update, then the facts are checked against Notion.", phases: ["compose", "gate"] },
  { title: "Review & share", detail: "You read it and post it to Slack. Nothing is sent without your OK.", phases: ["publish"] },
]

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
