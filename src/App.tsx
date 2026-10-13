import { useCallback, useEffect, useMemo, useState } from "react"
import BriefView from "@/components/BriefView"
import ConfidenceTrend from "@/components/ConfidenceTrend"
import RisksView from "@/components/RisksView"
import TrackerView from "@/components/TrackerView"
import { api, getAdminToken, setAdminToken, type RunSummary } from "@/lib/api"
import type {
  LlmProvider,
  PhaseId,
  PhaseRecord,
  RunRecord,
  RunSettings,
  ServerStatus,
  Task,
} from "@/shared/types"

type ActiveTab = "brief" | "risks" | "tracker" | "log"

const PHASES: { id: PhaseId; label: string; agent: string; description: string }[] = [
  { id: "ingest", label: "Ingest tracker", agent: "Collector", description: "Query the Notion database (or demo data)." },
  { id: "analyze", label: "Score delivery risk", agent: "Analyst", description: "Deterministic severity and confidence scoring." },
  { id: "compose", label: "Compose brief", agent: "Writer", description: "LLM writes a schema-validated executive brief." },
  { id: "gate", label: "Quality gates", agent: "Reviewer", description: "Confidence, risk, schema, and grounding checks." },
  { id: "publish", label: "Publish to Slack", agent: "Publisher", description: "Block Kit post. Auto or human-approved." },
]

const PROVIDER_LABEL: Record<LlmProvider, string> = {
  cerebras: "Cerebras",
  gemini: "Google Gemini",
  none: "No LLM (template)",
}

const STATUS_LABEL: Record<RunRecord["status"], string> = {
  running: "Running",
  ready: "Ready to post",
  held: "Held for review",
  published: "Published",
  failed: "Failed",
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

const shortDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

export default function App() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [settings, setSettings] = useState<RunSettings | null>(null)
  const [run, setRun] = useState<RunRecord | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [previewTasks, setPreviewTasks] = useState<Task[]>([])
  const [running, setRunning] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>("brief")
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(getAdminToken())

  const [manualHours, setManualHours] = useState(4)
  const [reviewMinutes, setReviewMinutes] = useState(15)
  const [hourlyRate, setHourlyRate] = useState(85)

  const refreshRuns = useCallback(() => api.runs().then(setRuns).catch(() => {}), [])

  useEffect(() => {
    api
      .status()
      .then((loaded) => {
        setStatus(loaded)
        setSettings(loaded.defaults)
      })
      .catch((err) => setError(`Backend unreachable: ${err.message}`))
    api
      .runs()
      .then(async (loaded) => {
        setRuns(loaded)
        if (loaded[0]) setRun(await api.run(loaded[0].id))
        else setPreviewTasks((await api.tasks()).tasks)
      })
      .catch(() => {})
  }, [])

  const updateSetting = <Key extends keyof RunSettings>(key: Key, value: RunSettings[Key]) =>
    setSettings((previous) => (previous ? { ...previous, [key]: value } : previous))

  const changeProvider = (provider: LlmProvider) => {
    const model = status?.providers.find((item) => item.id === provider)?.defaultModel ?? ""
    setSettings((previous) => (previous ? { ...previous, provider, model } : previous))
  }

  const handleRun = async () => {
    if (running || !settings) return
    setRunning(true)
    setError(null)
    setActiveTab("log")
    try {
      await api.startRun(settings, (event) => {
        if (event.type === "run" || event.type === "done") setRun(event.run)
        if (event.type === "error") setError(event.message)
        if (event.type === "phase")
          setRun((current) =>
            current
              ? { ...current, phases: current.phases.map((p) => (p.id === event.phase.id ? event.phase : p)) }
              : current,
          )
        if (event.type === "log")
          setRun((current) => (current ? { ...current, logs: [...current.logs, event.entry] } : current))
        if (event.type === "done") setActiveTab(event.run.status === "failed" ? "log" : "brief")
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
      refreshRuns()
    }
  }

  const handlePublish = async () => {
    if (!run || publishing) return
    const override = run.status === "held"
    if (
      override &&
      !window.confirm("Quality gates failed for this brief. Post it to Slack anyway as a human-approved override?")
    )
      return
    setPublishing(true)
    setError(null)
    try {
      setRun(await api.publish(run.id, override))
      refreshRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPublishing(false)
    }
  }

  const openRun = async (id: string) => {
    try {
      setRun(await api.run(id))
      setActiveTab("brief")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const metrics = run?.metrics
  const tasks = run?.tasks.length ? run.tasks : previewTasks
  const phases: PhaseRecord[] = run?.phases ?? PHASES.map(({ id }) => ({ id, state: "pending" }))

  const roi = useMemo(() => {
    const weekly = Math.max(manualHours - reviewMinutes / 60, 0)
    const monthly = weekly * 4.33
    return {
      weekly,
      monthlyCost: monthly * hourlyRate,
      annualCost: monthly * hourlyRate * 12,
      efficiency: manualHours > 0 ? clamp(Math.round((weekly / manualHours) * 100), 0, 99) : 0,
    }
  }, [manualHours, reviewMinutes, hourlyRate])

  const publishedCount = runs.filter((item) => item.status === "published").length
  const canPublish = run && (run.status === "ready" || run.status === "held") && !running
  const sourceLabel = status?.notion.configured
    ? `Notion · ${status.notion.database ?? "connected"}`
    : "Demo tracker data"

  const integrations = status
    ? [
        {
          name: "Notion",
          detail: status.notion.configured ? (status.notion.database ?? "Database connected") : "Set NOTION_TOKEN + NOTION_DATABASE_ID",
          ok: status.notion.configured,
        },
        {
          name: "Slack",
          detail:
            status.slack.mode === "bot"
              ? "Bot token · chat.postMessage"
              : status.slack.mode === "webhook"
                ? "Incoming webhook"
                : "Dry run · set SLACK_BOT_TOKEN",
          ok: status.slack.mode !== "none",
        },
        ...status.providers
          .filter((provider) => provider.id !== "none")
          .map((provider) => ({
            name: PROVIDER_LABEL[provider.id],
            detail: provider.configured ? provider.defaultModel : `Set ${provider.id.toUpperCase()}_API_KEY`,
            ok: provider.configured,
          })),
        {
          name: "Scheduler",
          detail: status.schedule.enabled
            ? `${status.schedule.cron} (${status.schedule.timezone})${status.schedule.nextRun ? ` · next ${shortDate(status.schedule.nextRun)}` : ""}`
            : "Set SCHEDULE_CRON to automate",
          ok: status.schedule.enabled,
        },
      ]
    : []

  return (
    <div className="app-shell">
      <header className="surface-card topbar">
        <div className="brand-cluster">
          <div className="brand-mark">BO</div>
          <div className="brand-copy">
            <h1>BizOps Standup Agent</h1>
            <p>Notion tracker → risk scoring → LLM brief → quality gates → Slack</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className={`status-pill ${status?.notion.configured ? "success" : "neutral"}`}>{sourceLabel}</span>
          {run && (
            <span
              className={`status-pill ${
                run.status === "running" ? "active" : run.status === "published" ? "success" : run.status === "ready" ? "" : "warn"
              }`}
            >
              Run #{run.number} · {STATUS_LABEL[run.status]}
            </span>
          )}
          <button className="run-button primary" onClick={handleRun} disabled={running || !settings}>
            {running ? "Running…" : "Run agent"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="link-button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="metric-grid">
        <article className="surface-card metric-card highlight">
          <p className="metric-label">Delivery confidence</p>
          <p className="metric-value">{metrics ? `${metrics.confidence}%` : "—"}</p>
          <p className="metric-meta">
            {metrics ? (
              <>
                <span className={`health-dot dot-${metrics.health.toLowerCase()}`} /> {metrics.health} health
              </>
            ) : (
              "Run the agent to score"
            )}
          </p>
        </article>
        <article className="surface-card metric-card">
          <p className="metric-label">Delivered</p>
          <p className="metric-value">{metrics ? `${metrics.completedTasks}/${metrics.totalTasks}` : "—"}</p>
          <p className="metric-meta">{metrics ? `${metrics.averageProgress}% average progress` : `${tasks.length} items in tracker`}</p>
        </article>
        <article className="surface-card metric-card">
          <p className="metric-label">Escalations</p>
          <p className="metric-value">{metrics ? metrics.highSeverityRisks : "—"}</p>
          <p className="metric-meta">
            {metrics ? `${metrics.risks.length} risks · ${metrics.overdueTasks} overdue` : "High-severity risks"}
          </p>
        </article>
        <article className="surface-card metric-card">
          <p className="metric-label">PM time saved</p>
          <p className="metric-value">{roi.weekly.toFixed(1)}h/wk</p>
          <p className="metric-meta">
            ${roi.annualCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr · {publishedCount} brief{publishedCount === 1 ? "" : "s"} published
          </p>
        </article>
      </section>

      <main className="workspace-grid">
        <aside className="left-column">
          <section className="surface-card panel">
            <h2 className="panel-title">Run settings</h2>
            <p className="panel-subtitle">Applied to the next manual run.</p>

            {settings && status ? (
              <div className="form-grid">
                <label className="field">
                  <span>LLM provider</span>
                  <select value={settings.provider} onChange={(e) => changeProvider(e.target.value as LlmProvider)}>
                    {status.providers.map((provider) => (
                      <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                        {PROVIDER_LABEL[provider.id]}
                        {provider.configured ? "" : " (no API key)"}
                      </option>
                    ))}
                  </select>
                </label>

                {settings.provider !== "none" && (
                  <label className="field">
                    <span>Model</span>
                    <input value={settings.model} onChange={(e) => updateSetting("model", e.target.value)} />
                  </label>
                )}

                <label className="field">
                  <span>Slack channel</span>
                  <input value={settings.slackChannel} onChange={(e) => updateSetting("slackChannel", e.target.value)} />
                </label>

                <div className="field">
                  <div className="range-row">
                    <span>Min confidence</span>
                    <span className="range-value">{settings.minConfidence}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={95}
                    value={settings.minConfidence}
                    onChange={(e) => updateSetting("minConfidence", Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <div className="range-row">
                    <span>Max high-severity risks</span>
                    <span className="range-value">{settings.highRiskLimit}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    value={settings.highRiskLimit}
                    onChange={(e) => updateSetting("highRiskLimit", Number(e.target.value))}
                  />
                </div>

                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoPublish}
                    onChange={(e) => updateSetting("autoPublish", e.target.checked)}
                  />
                  <span>Auto-publish when every gate passes</span>
                </label>

                {status.authRequired && (
                  <label className="field">
                    <span>Admin token</span>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => {
                        setToken(e.target.value)
                        setAdminToken(e.target.value)
                      }}
                    />
                  </label>
                )}
              </div>
            ) : (
              <p className="muted">Loading configuration…</p>
            )}
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">Quality gates</h2>
            <p className="panel-subtitle">A brief only auto-posts when every gate passes.</p>
            {run?.gates.length ? (
              <ul className="gate-list">
                {run.gates.map((gate) => (
                  <li key={gate.id} className={`gate-item ${gate.passed ? "pass" : "fail"}`}>
                    <div>
                      <span>{gate.label}</span>
                      <small>{gate.detail}</small>
                    </div>
                    <strong>{gate.passed ? "✓ Pass" : "✕ Fail"}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Gates are evaluated during each run.</p>
            )}
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">Integrations</h2>
            <div className="integration-list">
              {integrations.map((integration) => (
                <div key={integration.name} className="integration-item">
                  <div>
                    <p className="integration-name">{integration.name}</p>
                    <p className="integration-detail">{integration.detail}</p>
                  </div>
                  <span className={`integration-state ${integration.ok ? "connected" : "pending"}`}>
                    {integration.ok ? "live" : "off"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="surface-card center-column">
          <div className="tab-header" role="tablist">
            {(
              [
                ["brief", "Executive brief"],
                ["risks", `Risks${metrics ? ` (${metrics.risks.length})` : ""}`],
                ["tracker", `Tracker (${tasks.length})`],
                ["log", "Run log"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`tab-button ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="tab-panel">
            {activeTab === "brief" &&
              (run?.brief ? (
                <BriefView run={run} />
              ) : (
                <div className="empty-state">
                  <h3>No brief yet</h3>
                  <p>
                    Run the agent to pull the tracker, score delivery risk and draft this week's executive brief.
                    {!status?.notion.configured && " It uses demo data until Notion is connected."}
                  </p>
                  <button className="run-button primary" onClick={handleRun} disabled={running || !settings}>
                    {running ? "Running…" : "Run agent"}
                  </button>
                </div>
              ))}
            {activeTab === "risks" &&
              (metrics ? <RisksView risks={metrics.risks} /> : <p className="muted">Run the agent to score risks.</p>)}
            {activeTab === "tracker" && <TrackerView tasks={tasks} />}
            {activeTab === "log" && (
              <div className="log-list">
                {(run?.logs ?? []).map((entry, index) => (
                  <div key={`${entry.at}-${index}`} className="log-entry">
                    <span className="log-time">{time(entry.at)}</span>
                    <span className={`log-level level-${entry.level}`}>{entry.level}</span>
                    <span className="log-message">{entry.message}</span>
                  </div>
                ))}
                {!run && <p className="muted">Logs stream here while the agent runs.</p>}
              </div>
            )}
          </div>

          <div className="output-actions">
            <button
              className={`run-button ${run?.status === "held" ? "danger" : "primary"}`}
              onClick={handlePublish}
              disabled={!canPublish || publishing}
            >
              {publishing ? "Posting…" : run?.status === "held" ? "Override & post" : "Approve & post to Slack"}
            </button>
            <span className="muted">
              {run?.publish ? (
                <>
                  {run.publish.mode === "dry_run" ? "Dry-run publish" : `Posted to ${run.publish.channel}`} ·{" "}
                  {shortDate(run.publish.at)}
                  {run.publish.approvedOverride && " · human override"}
                  {run.publish.permalink && (
                    <>
                      {" · "}
                      <a href={run.publish.permalink} target="_blank" rel="noreferrer">
                        Open in Slack
                      </a>
                    </>
                  )}
                </>
              ) : run?.status === "held" ? (
                "Gates failed. Review before overriding."
              ) : (
                "Not posted yet"
              )}
            </span>
          </div>
        </section>

        <aside className="right-column">
          <section className="surface-card panel">
            <h2 className="panel-title">Agent pipeline</h2>
            <p className="panel-subtitle">Live state of the current run.</p>
            <div className="pipeline-list">
              {PHASES.map((meta) => {
                const phase = phases.find((item) => item.id === meta.id) ?? { id: meta.id, state: "pending" as const }
                return (
                  <div key={meta.id} className="pipeline-node" data-status={phase.state}>
                    <div className="pipeline-dot" data-status={phase.state} />
                    <div>
                      <p className="pipeline-label">
                        {meta.label}
                        {phase.durationMs !== undefined && phase.state !== "skipped" && (
                          <span className="pipeline-time">{phase.durationMs}ms</span>
                        )}
                      </p>
                      <p className="pipeline-agent">{meta.agent} agent</p>
                      <p className="pipeline-detail">{phase.detail ?? meta.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">Confidence trend</h2>
            <p className="panel-subtitle">Delivery confidence across recent runs.</p>
            <ConfidenceTrend runs={runs} threshold={settings?.minConfidence ?? 70} />
            {runs.length > 0 && (
              <ul className="history-list">
                {runs.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <button
                      className={`history-item ${item.id === run?.id ? "active" : ""}`}
                      onClick={() => openRun(item.id)}
                    >
                      <span>
                        #{item.number} · {shortDate(item.startedAt)}
                        {item.trigger === "schedule" && " · ⏱"}
                      </span>
                      <span className={`history-status ${item.status}`}>{STATUS_LABEL[item.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface-card panel">
            <h2 className="panel-title">Time saved</h2>
            <p className="panel-subtitle">Manual status reporting compared with reviewing the agent's draft.</p>
            <div className="roi-grid">
              <label className="field">
                <span>Manual hrs / week</span>
                <input
                  type="number"
                  min={0.5}
                  max={40}
                  step={0.5}
                  value={manualHours}
                  onChange={(e) => setManualHours(clamp(Number(e.target.value) || 0, 0, 40))}
                />
              </label>
              <label className="field">
                <span>Review mins</span>
                <input
                  type="number"
                  min={0}
                  max={240}
                  step={5}
                  value={reviewMinutes}
                  onChange={(e) => setReviewMinutes(clamp(Number(e.target.value) || 0, 0, 240))}
                />
              </label>
              <label className="field">
                <span>Hourly rate $</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  step={5}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(clamp(Number(e.target.value) || 0, 0, 500))}
                />
              </label>
              <div className="roi-stat">
                <span>Efficiency</span>
                <strong>{roi.efficiency}%</strong>
              </div>
            </div>
            <div className="roi-highlight">
              <div>
                <span>Monthly</span>
                <strong>${roi.monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
              </div>
              <div>
                <span>Annual</span>
                <strong>${roi.annualCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}
