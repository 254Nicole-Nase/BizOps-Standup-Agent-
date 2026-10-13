import type {
  Brief,
  GateResult,
  Health,
  Metrics,
  RiskItem,
  RunSettings,
  Severity,
  Task,
} from "../src/shared/types"

const DAY_MS = 86_400_000
const SEVERITY_WEIGHT: Record<Severity, number> = { high: 10, medium: 5, low: 2 }
const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const daysUntil = (isoDate: string | undefined, now: Date) => {
  if (!isoDate) return null
  const due = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  )
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((due - today) / DAY_MS)
}

const recommendAction = (task: Task, severity: Severity, overdue: boolean) => {
  if (task.status === "blocked" && severity === "high")
    return "Escalate in today's leadership sync and name an exec unblocker within 24h."
  if (task.status === "blocked") return "Owner to confirm the dependency holder and an unblock date by EOD."
  if (overdue) return "Re-baseline the delivery date with the owner and agree on any scope cuts."
  if (task.status === "at_risk" && severity === "high")
    return "Hold a mitigation review this week and decide on scope, staffing, or the date."
  if (task.status === "not_started") return "Confirm kickoff date and staffing so the deadline stays credible."
  return "Monitor in next standup and ask the owner for a recovery plan."
}

/**
 * Deterministic risk scoring. The LLM never decides severity on its own: it
 * gets these scores as ground truth, which keeps the quality gates stable.
 */
export const scoreTask = (task: Task, now = new Date()): RiskItem | null => {
  if (task.status === "done") return null

  const signals: string[] = []
  let score = 0
  const ageDays = task.blockerAgeDays ?? 0
  const dueInDays = daysUntil(task.dueDate, now)
  const overdue = dueInDays !== null && dueInDays < 0
  const flagged = task.status === "blocked" || task.status === "at_risk"

  if (task.status === "blocked") {
    score += 3
    signals.push("Marked blocked")
  } else if (task.status === "at_risk") {
    score += 2
    signals.push("Flagged at risk")
  }

  if (flagged && ageDays >= 2) {
    score += ageDays >= 5 ? 3 : ageDays >= 3 ? 2 : 1
    signals.push(`Open for ${ageDays} days`)
  }

  if (overdue) {
    score += 3
    signals.push(`Overdue by ${Math.abs(dueInDays!)} day${dueInDays === -1 ? "" : "s"}`)
  } else if (dueInDays !== null && dueInDays <= 7 && (flagged || task.progress < 80)) {
    score += 2
    signals.push(`Due in ${dueInDays} days at ${task.progress}%`)
  } else if (dueInDays !== null && dueInDays <= 14 && task.progress < 50) {
    score += 2
    signals.push(`Due in ${dueInDays} days at only ${task.progress}%`)
  }

  if (task.status === "not_started" && dueInDays !== null && dueInDays <= 14) {
    score += 2
    signals.push("Not started with deadline inside two weeks")
  }

  if (score < 2) return null

  const severity: Severity = score >= 6 ? "high" : score >= 3 ? "medium" : "low"
  return {
    taskId: task.id,
    project: task.project,
    owner: task.owner,
    status: task.status,
    summary:
      task.blocker ??
      (overdue ? "Past due date and not complete" : task.latestUpdate ?? "Delivery date at risk"),
    severity,
    ageDays,
    dueInDays,
    overdue,
    signals,
    recommendedAction: recommendAction(task, severity, overdue),
  }
}

export const computeMetrics = (tasks: Task[], now = new Date()): Metrics => {
  const count = (status: Task["status"]) => tasks.filter((task) => task.status === status).length
  const risks = tasks
    .map((task) => scoreTask(task, now))
    .filter((risk): risk is RiskItem => risk !== null)
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.ageDays - a.ageDays,
    )

  const totalTasks = tasks.length
  const completedTasks = count("done")
  const penalty = risks.reduce((sum, risk) => sum + SEVERITY_WEIGHT[risk.severity], 0)
  const completionBonus = totalTasks ? (completedTasks / totalTasks) * 10 : 0
  const confidence = totalTasks ? Math.round(clamp(100 - penalty + completionBonus, 0, 100)) : 0
  const health: Health = confidence >= 80 ? "Green" : confidence >= 65 ? "Yellow" : "Red"

  return {
    totalTasks,
    completedTasks,
    inProgressTasks: count("in_progress"),
    notStartedTasks: count("not_started"),
    atRiskTasks: count("at_risk"),
    blockedTasks: count("blocked"),
    overdueTasks: risks.filter((risk) => risk.overdue).length,
    averageProgress: totalTasks
      ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / totalTasks)
      : 0,
    highSeverityRisks: risks.filter((risk) => risk.severity === "high").length,
    confidence,
    health,
    risks,
  }
}

/** Template brief used when no LLM is configured or the LLM output fails validation. */
export const fallbackBrief = (tasks: Task[], metrics: Metrics): Brief => {
  const wins = tasks
    .filter((task) => task.status === "done")
    .slice(0, 3)
    .map((task) => (task.latestUpdate ? `${task.project}: ${task.latestUpdate}` : `${task.project} shipped`))

  return {
    headline: `${metrics.health}: ${metrics.completedTasks}/${metrics.totalTasks} complete, ${metrics.highSeverityRisks} escalation${metrics.highSeverityRisks === 1 ? "" : "s"} need leadership attention`,
    summary: `Delivery confidence is ${metrics.confidence}% with average progress at ${metrics.averageProgress}%. ${metrics.blockedTasks} blocked, ${metrics.atRiskTasks} at risk, and ${metrics.overdueTasks} overdue.`,
    wins,
    risks: metrics.risks.slice(0, 5).map((risk) => ({
      project: risk.project,
      issue: `${risk.summary} (${risk.signals.join(", ").toLowerCase()})`,
      severity: risk.severity,
      action: risk.recommendedAction,
      owner: risk.owner,
    })),
    leadershipAsks: metrics.risks
      .filter((risk) => risk.severity === "high")
      .map((risk) => `Unblock ${risk.project}: ${risk.summary}`),
    nextWeekFocus: tasks
      .filter((task) => task.status === "in_progress")
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3)
      .map((task) => `Land ${task.project} (${task.progress}%)`),
  }
}

const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

export const evaluateGates = (input: {
  tasks: Task[]
  metrics: Metrics
  brief: Brief
  briefSource: "llm" | "fallback"
  settings: RunSettings
  llmError?: string
}): GateResult[] => {
  const { tasks, metrics, brief, briefSource, settings, llmError } = input
  const known = new Set(tasks.map((task) => normalizeName(task.project)))
  const ungrounded = brief.risks
    .map((risk) => risk.project)
    .filter((project) => !known.has(normalizeName(project)))

  const highRisks = metrics.risks.filter((risk) => risk.severity === "high")
  const missedEscalations = highRisks.filter(
    (risk) => !brief.risks.some((item) => normalizeName(item.project) === normalizeName(risk.project)),
  )

  return [
    {
      id: "confidence",
      label: `Delivery confidence ≥ ${settings.minConfidence}%`,
      passed: metrics.confidence >= settings.minConfidence,
      detail: `Scored ${metrics.confidence}% (${metrics.health}).`,
    },
    {
      id: "high_risks",
      label: `High-severity risks ≤ ${settings.highRiskLimit}`,
      passed: metrics.highSeverityRisks <= settings.highRiskLimit,
      detail: `${metrics.highSeverityRisks} high-severity risk${metrics.highSeverityRisks === 1 ? "" : "s"} detected.`,
    },
    {
      id: "llm_valid",
      label: "Brief passed schema validation",
      passed: briefSource === "llm" || settings.provider === "none",
      detail:
        briefSource === "llm"
          ? "LLM output matched the brief schema."
          : settings.provider === "none"
            ? "Deterministic writer used (no LLM configured)."
            : `Fell back to template brief: ${llmError ?? "invalid output"}.`,
    },
    {
      id: "grounding",
      label: "Brief is grounded in tracker data",
      passed: ungrounded.length === 0 && missedEscalations.length === 0,
      detail:
        ungrounded.length > 0
          ? `Mentions unknown projects: ${ungrounded.join(", ")}.`
          : missedEscalations.length > 0
            ? `Omits high-severity risks: ${missedEscalations.map((risk) => risk.project).join(", ")}.`
            : "Every risk maps to a tracker item and all escalations are covered.",
    },
  ]
}
