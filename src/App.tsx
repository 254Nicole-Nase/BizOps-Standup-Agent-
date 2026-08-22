import {
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react"

type RunState = "idle" | "running" | "ready" | "posted"
type ActiveTab = "brief" | "blockers" | "log"
type LogLevel = "info" | "success" | "warn"
type TaskStatus = "done" | "in_progress" | "blocked" | "at_risk"
type Severity = "high" | "medium" | "low"
type IntegrationStatus = "connected" | "pending"
type GapStatus = "missing" | "next" | "advanced"

interface TaskUpdate {
  project: string
  owner: string
  status: TaskStatus
  progress: number
  blocker?: string
  blockerAgeDays?: number
}

interface BlockerItem {
  project: string
  owner: string
  summary: string
  severity: Severity
  ageDays: number
  recommendedAction: string
}

interface PipelinePhase {
  id: string
  label: string
  agent: string
  description: string
  doneMessage: string
}

interface Integration {
  name: string
  detail: string
  status: IntegrationStatus
}

interface ShipGap {
  title: string
  impact: string
  status: GapStatus
}

interface LogEntry {
  time: string
  level: LogLevel
  message: string
}

interface WorkflowSettings {
  cadence: string
  notionDatabase: string
  slackChannel: string
  model: string
  orchestration: "CrewAI" | "LangGraph"
  minConfidence: number
  highBlockerLimit: number
}

const PIPELINE_PHASES: PipelinePhase[] = [
  {
    id: "ingest",
    label: "Ingest Notion Tasks",
    agent: "Collector Agent",
    description: "Pull task updates, owners, due dates, and status tags.",
    doneMessage: "54 updates fetched across 7 projects.",
  },
  {
    id: "analyze",
    label: "Analyze Delivery Risk",
    agent: "Analyst Agent",
    description: "Detect blocker clusters and score delivery confidence.",
    doneMessage: "4 blockers and 6 at-risk tasks detected.",
  },
  {
    id: "compose",
    label: "Compose Executive Brief",
    agent: "Writer Agent",
    description:
      "Generate concise leadership summary with recommended actions.",
    doneMessage: "Slack-ready brief generated with risk callouts.",
  },
  {
    id: "publish",
    label: "Publish to Slack",
    agent: "Publisher Agent",
    description: "Post approved summary to the executive update channel.",
    doneMessage: "Awaiting one-click human approval.",
  },
]

const TASK_UPDATES: TaskUpdate[] = [
  {
    project: "Platform Rebrand",
    owner: "Maya Chen",
    status: "blocked",
    progress: 78,
    blocker: "Stakeholder sign-off pending",
    blockerAgeDays: 3,
  },
  {
    project: "API v3 Launch",
    owner: "James Park",
    status: "blocked",
    progress: 64,
    blocker: "Load test environment not allocated",
    blockerAgeDays: 2,
  },
  {
    project: "Customer Portal",
    owner: "Sara Liu",
    status: "at_risk",
    progress: 86,
    blocker: "Legal review pending",
    blockerAgeDays: 5,
  },
  {
    project: "Partner Onboarding",
    owner: "Ari Patel",
    status: "in_progress",
    progress: 72,
  },
  {
    project: "Billing Automation",
    owner: "Noah Kim",
    status: "in_progress",
    progress: 58,
  },
  {
    project: "Security Audit",
    owner: "Dina Rahman",
    status: "done",
    progress: 100,
  },
  {
    project: "Support AI Copilot",
    owner: "Ethan Hall",
    status: "done",
    progress: 100,
  },
  {
    project: "Data Warehouse Cleanup",
    owner: "Lena Ortiz",
    status: "at_risk",
    progress: 49,
  },
  {
    project: "Retention Campaign",
    owner: "Ivy Gomez",
    status: "done",
    progress: 100,
  },
  {
    project: "Compliance Vault",
    owner: "Marco Silva",
    status: "in_progress",
    progress: 68,
  },
]

const INTEGRATIONS: Integration[] = [
  { name: "Notion API", detail: "Workspace: BizOps Q3", status: "connected" },
  {
    name: "Gemini API",
    detail: "Model: gemini-3.7-flash",
    status: "connected",
  },
  {
    name: "Slack API",
    detail: "Channel: #executive-updates",
    status: "connected",
  },
  {
    name: "CrewAI or LangGraph",
    detail: "Runtime orchestration",
    status: "pending",
  },
]

const SHIP_GAPS: ShipGap[] = [
  {
    title: "Secure secrets and OAuth tokens",
    impact: "Required for real Notion and Slack production access.",
    status: "missing",
  },
  {
    title: "Retry queue and dead-letter handling",
    impact: "Prevents dropped summaries when APIs fail or rate-limit.",
    status: "next",
  },
  {
    title: "Historical trend store for leadership analytics",
    impact: "Enables monthly blocker trend reports and forecasting.",
    status: "advanced",
  },
]

const STACK_BADGES = [
  "Python",
  "CrewAI",
  "LangGraph",
  "Gemini API",
  "Slack API",
  "Notion API",
]

const CADENCE_OPTIONS = [
  "Weekly - Monday 09:00 UTC",
  "Weekly - Friday 16:00 UTC",
  "Biweekly - Monday 09:00 UTC",
]

const levelClass: Record<LogLevel, string> = {
  info: "level-info",
  success: "level-success",
  warn: "level-warn",
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs)
  })

const clock = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

const weekLabel = () => {
  const monday = new Date()
  const dayOffset = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - dayOffset)

  return monday.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

const blockerSeverityFromAge = (ageDays: number): Severity => {
  if (ageDays >= 3) return "high"
  if (ageDays === 2) return "medium"
  return "low"
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("brief")
  const [runState, setRunState] = useState<RunState>("idle")
  const [currentPhase, setCurrentPhase] = useState(-1)
  const [runCounter, setRunCounter] = useState(24)
  const [lastPostedAt, setLastPostedAt] = useState<string | null>(null)

  const [settings, setSettings] = useState<WorkflowSettings>({
    cadence: CADENCE_OPTIONS[0],
    notionDatabase: "Q3 Task Tracker",
    slackChannel: "#executive-updates",
    model: "gemini-3.7-flash",
    orchestration: "CrewAI",
    minConfidence: 75,
    highBlockerLimit: 1,
  })

  const [manualHours, setManualHours] = useState(7)
  const [reviewMinutes, setReviewMinutes] = useState(25)
  const [hourlyRate, setHourlyRate] = useState(75)
  const [runsPerMonth, setRunsPerMonth] = useState(4)

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      time: "09:01:03",
      level: "info",
      message: "BizOps mock workspace loaded.",
    },
    {
      time: "09:01:04",
      level: "success",
      message: "Ready for weekly run simulation.",
    },
  ])

  const insights = useMemo(() => {
    const totalTasks = TASK_UPDATES.length
    const completedTasks = TASK_UPDATES.filter(
      (task) => task.status === "done",
    ).length
    const inProgressTasks = TASK_UPDATES.filter(
      (task) => task.status === "in_progress",
    ).length
    const atRiskTasks = TASK_UPDATES.filter(
      (task) => task.status === "at_risk",
    ).length

    const blockers: BlockerItem[] = TASK_UPDATES.filter(
      (task) => task.status === "blocked",
    ).map((task) => {
      const ageDays = task.blockerAgeDays ?? 1
      return {
        project: task.project,
        owner: task.owner,
        summary: task.blocker ?? "Dependency issue",
        severity: blockerSeverityFromAge(ageDays),
        ageDays,
        recommendedAction:
          ageDays >= 3
            ? "Escalate in leadership sync today"
            : "Assign owner and unblock within 24h",
      }
    })

    const highSeverityBlockers = blockers.filter(
      (blocker) => blocker.severity === "high",
    ).length

    const confidence = clamp(
      Math.round(
        92 - blockers.length * 9 - atRiskTasks * 4 + completedTasks * 1.2,
      ),
      52,
      96,
    )

    const health =
      confidence >= 84 ? "Green" : confidence >= 72 ? "Yellow" : "Red"

    const wins = TASK_UPDATES.filter((task) => task.status === "done")
      .slice(0, 3)
      .map((task) => task.project)

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      atRiskTasks,
      blockers,
      highSeverityBlockers,
      confidence,
      health,
      wins,
    }
  }, [])

  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null)

  const confidenceBlocked = insights.confidence < settings.minConfidence
  const blockerBlocked =
    insights.highSeverityBlockers > settings.highBlockerLimit
  const canAutoPost = !confidenceBlocked && !blockerBlocked

  const weeklyHoursSaved = Math.max(manualHours - reviewMinutes / 60, 0)
  const monthlyHoursSaved = weeklyHoursSaved * runsPerMonth
  const monthlySavings = monthlyHoursSaved * hourlyRate
  const annualSavings = monthlySavings * 12
  const efficiencyGain =
    manualHours > 0
      ? clamp(Math.round((weeklyHoursSaved / manualHours) * 100), 0, 99)
      : 0

  const summaryLines = useMemo(() => {
    const leadBlocker = insights.blockers[0]

    return [
      `Week of ${weekLabel()} - Executive Standup Summary`,
      `Overall health: ${insights.health} (${insights.confidence}% confidence).`,
      `${insights.completedTasks}/${insights.totalTasks} tasks complete with ${insights.atRiskTasks} tasks at risk.`,
      leadBlocker
        ? `Primary unblock: ${leadBlocker.project} - ${leadBlocker.summary}.`
        : "No active blockers this week.",
      `Top wins: ${insights.wins.join(", ")}.`,
      canAutoPost
        ? `Quality gate passed. Ready to post to ${settings.slackChannel}.`
        : "Quality gate requires human review before publishing.",
    ]
  }, [canAutoPost, insights, settings.slackChannel])

  const slackPreview = useMemo(
    () =>
      generatedPreview ||
      [
        "*BizOps Weekly Executive Brief*",
        `*Week of ${weekLabel()}*`,
        "",
        `*Health:* ${insights.health} (${insights.confidence}% confidence)`,
        `*Delivery:* ${insights.completedTasks}/${insights.totalTasks} complete, ${insights.inProgressTasks} in progress`,
        `*Risk:* ${insights.blockers.length} blockers, ${insights.atRiskTasks} at-risk tasks`,
        "",
        "*Actions for leadership:*",
        ...insights.blockers
          .slice(0, 2)
          .map(
            (blocker) =>
              `- ${blocker.project}: ${blocker.summary} (${blocker.owner})`,
          ),
      ].join("\n"),
    [insights, generatedPreview],
  )

  const appendLog = (level: LogLevel, message: string) => {
    setLogs((previous) =>
      [...previous, { time: clock(), level, message }].slice(-32),
    )
  }

  const updateSetting = <Key extends keyof WorkflowSettings,>(
    key: Key,
    value: WorkflowSettings[Key],
  ) => {
    setSettings((previous) => ({ ...previous, [key]: value }))
  }

  const updateNumber =
    (
      setter: Dispatch<SetStateAction<number>>,
      minimum: number,
      maximum: number,
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number(event.target.value)
      if (!Number.isFinite(parsed)) return
      setter(clamp(parsed, minimum, maximum))
    }

  const handleRunWorkflow = async () => {
    if (runState === "running") return

    const nextRun = runCounter + 1
    setRunCounter(nextRun)
    setRunState("running")
    setCurrentPhase(0)
    setActiveTab("log")
    setGeneratedPreview(null)
    setLogs([
      {
        time: clock(),
        level: "info",
        message: `Run #${nextRun} started using ${settings.orchestration}.`,
      },
    ])

    for (let index = 0; index < PIPELINE_PHASES.length; index += 1) {
      const phase = PIPELINE_PHASES[index]
      setCurrentPhase(index)
      appendLog("info", `${phase.label}: ${phase.description}`)
      await sleep(650 + index * 220)
      appendLog("success", phase.doneMessage)
    }

    try {
      const response = await fetch("/api/workflow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, insights }),
      })
      const result = await response.json()
      if (result.success && result.data.slackPreview) {
        setGeneratedPreview(result.data.slackPreview)
        appendLog(
          "success",
          "AI generated a new executive brief based on the insights.",
        )
      }
    } catch (e) {
      appendLog("warn", "Failed to reach AI backend, using local mock summary.")
    }

    if (canAutoPost) {
      appendLog(
        "success",
        `Quality gate passed. Summary is ready for ${settings.slackChannel}.`,
      )
    } else {
      appendLog(
        "warn",
        "Quality gate blocked auto-post. Review blockers or adjust thresholds.",
      )
    }

    setCurrentPhase(PIPELINE_PHASES.length - 1)
    setRunState("ready")
    setActiveTab("brief")
  }

  const handlePostToSlack = async () => {
    if (runState === "running") return

    if (runState === "idle") {
      appendLog("warn", "Run the workflow before posting to Slack.")
      setActiveTab("log")
      return
    }

    if (!canAutoPost) {
      appendLog(
        "warn",
        "Cannot auto-post. Quality gate failed and needs human review.",
      )
      setActiveTab("blockers")
      return
    }

    appendLog("info", `Publishing summary to ${settings.slackChannel}...`)

    try {
      const response = await fetch("/api/workflow/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slackChannel: settings.slackChannel,
          payload: slackPreview,
        }),
      })
      const result = await response.json()
      if (result.success) {
        appendLog(
          "success",
          `Executive brief posted to ${settings.slackChannel}.`,
        )
        setRunState("posted")
        setLastPostedAt(
          new Date().toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        )
      } else {
        appendLog("warn", "Failed to post to Slack API.")
      }
    } catch (error) {
      appendLog("warn", "Network error when attempting to post to Slack API.")
    }

    setActiveTab("log")
  }

  const phaseStatus = (index: number): "pending" | "active" | "done" => {
    if (runState === "idle") return "pending"
    if (runState === "running") {
      if (index < currentPhase) return "done"
      if (index === currentPhase) return "active"
      return "pending"
    }
    if (runState === "posted") {
      return "done"
    }
    return "done"
  }

  const runStatusLabel =
    runState === "running"
      ? "Workflow running"
      : runState === "posted"
        ? "Summary posted"
        : runState === "ready"
          ? "Run complete"
          : "Ready to run"

  return (
    <div className="app-shell">
      <header className="surface-card topbar">
        <div className="brand-cluster">
          <div className="brand-mark">BO</div>
          <div className="brand-copy">
            <h1>BizOps Standup Agent</h1>
            <p>Notion -&gt; LLM analysis -&gt; Slack executive brief</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span
            className={`status-pill ${
              runState === "running"
                ? "active"
                : runState === "posted"
                  ? "success"
                  : ""
            }`}
          >
            {runStatusLabel}
          </span>
          <span className="status-pill neutral">
            Run #{runCounter} - {settings.cadence}
          </span>
          <button
            className="run-button secondary"
            onClick={handlePostToSlack}
            disabled={runState === "running"}
          >
            Post Summary
          </button>
          <button
            className="run-button primary"
            onClick={handleRunWorkflow}
            disabled={runState === "running"}
          >
            {runState === "running" ? "Running..." : "Run Workflow"}
          </button>
        </div>
      </header>

      <section className="metric-grid">
        <article className="surface-card metric-card highlight">
          <p className="metric-label">Hours Saved per Week</p>
          <p className="metric-value">{weeklyHoursSaved.toFixed(1)}h</p>
          <p className="metric-meta">{efficiencyGain}% less manual PM effort</p>
        </article>
        <article className="surface-card metric-card">
          <p className="metric-label">Delivery Confidence</p>
          <p className="metric-value">{insights.confidence}%</p>
          <p className="metric-meta">Health: {insights.health}</p>
        </article>
        <article className="surface-card metric-card">
          <p className="metric-label">Escalation Blockers</p>
          <p className="metric-value">{insights.highSeverityBlockers}</p>
          <p className="metric-meta">
            Threshold: {settings.highBlockerLimit} high-severity blockers
          </p>
        </article>
        <article className="surface-card metric-card">
          <p className="metric-label">Estimated Monthly Savings</p>
          <p className="metric-value">
            $
            {monthlySavings.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="metric-meta">
            $
            {annualSavings.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            annualized
          </p>
        </article>
      </section>

      <main className="workspace-grid">
        <aside className="left-column">
          <section className="surface-card panel">
            <h2 className="panel-title">Workflow Configuration</h2>
            <p className="panel-subtitle">
              Tune automation settings before each standup run.
            </p>

            <div className="form-grid">
              <label className="field">
                <span>Cadence</span>
                <select
                  value={settings.cadence}
                  onChange={(event) =>
                    updateSetting("cadence", event.target.value)
                  }
                >
                  {CADENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Notion Database</span>
                <input
                  value={settings.notionDatabase}
                  onChange={(event) =>
                    updateSetting("notionDatabase", event.target.value)
                  }
                />
              </label>

              <label className="field">
                <span>Slack Channel</span>
                <input
                  value={settings.slackChannel}
                  onChange={(event) =>
                    updateSetting("slackChannel", event.target.value)
                  }
                />
              </label>

              <label className="field">
                <span>LLM Model</span>
                <input
                  value={settings.model}
                  onChange={(event) =>
                    updateSetting("model", event.target.value)
                  }
                />
              </label>

              <label className="field">
                <span>Orchestration Runtime</span>
                <select
                  value={settings.orchestration}
                  onChange={(event) =>
                    updateSetting(
                      "orchestration",
                      event.target.value as "CrewAI" | "LangGraph",
                    )
                  }
                >
                  <option value="CrewAI">CrewAI</option>
                  <option value="LangGraph">LangGraph</option>
                </select>
              </label>

              <div className="field">
                <div className="range-row">
                  <span>Minimum confidence</span>
                  <span className="range-value">{settings.minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min={55}
                  max={95}
                  step={1}
                  value={settings.minConfidence}
                  onChange={(event) =>
                    updateSetting("minConfidence", Number(event.target.value))
                  }
                />
              </div>

              <div className="field">
                <div className="range-row">
                  <span>High blocker limit</span>
                  <span className="range-value">
                    {settings.highBlockerLimit}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={settings.highBlockerLimit}
                  onChange={(event) =>
                    updateSetting(
                      "highBlockerLimit",
                      Number(event.target.value),
                    )
                  }
                />
              </div>
            </div>

            <ul className="gate-list">
              <li
                className={`gate-item ${confidenceBlocked ? "fail" : "pass"}`}
              >
                <span>Confidence gate &gt;= {settings.minConfidence}%</span>
                <strong>{confidenceBlocked ? "Fail" : "Pass"}</strong>
              </li>
              <li className={`gate-item ${blockerBlocked ? "fail" : "pass"}`}>
                <span>High blockers &lt;= {settings.highBlockerLimit}</span>
                <strong>{blockerBlocked ? "Fail" : "Pass"}</strong>
              </li>
            </ul>
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">What Is Missing to Ship</h2>
            <p className="panel-subtitle">
              Focus these upgrades for production readiness.
            </p>

            <ul className="ship-list">
              {SHIP_GAPS.map((item) => (
                <li key={item.title} className="ship-item">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.impact}</p>
                  </div>
                  <span className={`ship-status ${item.status}`}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="surface-card center-column">
          <div className="tab-header">
            {(["brief", "blockers", "log"] as const).map((tab) => {
              const label =
                tab === "brief"
                  ? "Executive Brief"
                  : tab === "blockers"
                    ? `Blockers (${insights.blockers.length})`
                    : "Run Log"

              return (
                <button
                  key={tab}
                  className={`tab-button ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="tab-panel">
            {activeTab === "brief" && (
              <div className="summary-stack">
                <div
                  className={`summary-callout ${canAutoPost ? "pass" : "warn"}`}
                >
                  {canAutoPost
                    ? "Auto-post is eligible. Executive brief can publish after review."
                    : "Manual review required. At least one quality gate has failed."}
                </div>

                {summaryLines.map((line) => (
                  <p key={line} className="summary-line">
                    {line}
                  </p>
                ))}

                <div className="summary-label">Slack payload preview</div>
                <pre className="slack-preview">{slackPreview}</pre>
              </div>
            )}

            {activeTab === "blockers" && (
              <div className="blocker-grid">
                {insights.blockers.length === 0 && (
                  <p className="muted">No blockers detected in this cycle.</p>
                )}

                {insights.blockers.map((blocker) => (
                  <article
                    key={`${blocker.project}-${blocker.owner}`}
                    className="blocker-row"
                  >
                    <div className="blocker-head">
                      <h3>{blocker.project}</h3>
                      <span className={`severity-pill ${blocker.severity}`}>
                        {blocker.severity}
                      </span>
                    </div>
                    <p>{blocker.summary}</p>
                    <div className="blocker-meta">
                      <span>Owner: {blocker.owner}</span>
                      <span>Age: {blocker.ageDays}d</span>
                    </div>
                    <div className="blocker-action">
                      Next action: {blocker.recommendedAction}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {activeTab === "log" && (
              <div className="log-list">
                {logs.map((entry, index) => (
                  <div key={`${entry.time}-${index}`} className="log-entry">
                    <span className="log-time">{entry.time}</span>
                    <span className={`log-level ${levelClass[entry.level]}`}>
                      {entry.level}
                    </span>
                    <span className="log-message">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="output-actions">
            <button
              className="run-button primary"
              onClick={handlePostToSlack}
              disabled={runState === "running"}
            >
              Post to Slack
            </button>
            <button
              className="run-button secondary"
              onClick={() => setActiveTab("brief")}
            >
              Review Brief
            </button>
            <span className="muted">
              Last posted: {lastPostedAt ?? "Not posted yet"}
            </span>
          </div>
        </section>

        <aside className="right-column">
          <section className="surface-card panel">
            <h2 className="panel-title">Agent Pipeline</h2>
            <p className="panel-subtitle">
              Run state across the Notion-to-Slack workflow.
            </p>

            <div className="pipeline-list">
              {PIPELINE_PHASES.map((phase, index) => {
                const status = phaseStatus(index)

                return (
                  <div
                    key={phase.id}
                    className="pipeline-node"
                    data-status={status}
                  >
                    <div className="pipeline-dot" data-status={status} />
                    <div>
                      <p className="pipeline-label">{phase.label}</p>
                      <p className="pipeline-agent">{phase.agent}</p>
                      <p className="pipeline-detail">
                        {status === "done" && runState !== "idle"
                          ? phase.doneMessage
                          : phase.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">Hours Saved Calculator</h2>
            <p className="panel-subtitle">
              Adjust assumptions to estimate PM time and cost savings.
            </p>

            <div className="roi-grid">
              <label className="field">
                <span>Manual hours per standup</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={manualHours}
                  onChange={updateNumber(setManualHours, 1, 24)}
                />
              </label>

              <label className="field">
                <span>Review minutes with agent</span>
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  value={reviewMinutes}
                  onChange={updateNumber(setReviewMinutes, 5, 120)}
                />
              </label>

              <label className="field">
                <span>PM hourly rate (USD)</span>
                <input
                  type="number"
                  min={30}
                  max={300}
                  step={5}
                  value={hourlyRate}
                  onChange={updateNumber(setHourlyRate, 30, 300)}
                />
              </label>

              <label className="field">
                <span>Runs per month</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={runsPerMonth}
                  onChange={updateNumber(setRunsPerMonth, 1, 12)}
                />
              </label>
            </div>

            <div className="roi-highlight">
              <div>
                <span>Weekly hours saved</span>
                <strong>{weeklyHoursSaved.toFixed(1)}h</strong>
              </div>
              <div>
                <span>Monthly savings</span>
                <strong>
                  $
                  {monthlySavings.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </strong>
              </div>
            </div>
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">Integrations and Stack</h2>
            <div className="integration-list">
              {INTEGRATIONS.map((integration) => (
                <div key={integration.name} className="integration-item">
                  <div>
                    <p className="integration-name">{integration.name}</p>
                    <p className="integration-detail">{integration.detail}</p>
                  </div>
                  <span className={`integration-state ${integration.status}`}>
                    {integration.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="badge-row">
              {STACK_BADGES.map((badge) => (
                <span key={badge} className="tech-badge">
                  {badge}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}
