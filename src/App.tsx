import { useCallback, useEffect, useState } from "react"
import AtAGlance from "@/components/AtAGlance"
import BriefView from "@/components/BriefView"
import Checks from "@/components/Checks"
import History from "@/components/History"
import HowItWorks from "@/components/HowItWorks"
import Icon from "@/components/Icon"
import Lamps from "@/components/Lamps"
import RisksView from "@/components/RisksView"
import SettingsDrawer from "@/components/SettingsDrawer"
import StatusHero from "@/components/StatusHero"
import TrackerView from "@/components/TrackerView"
import { api, getAdminToken, setAdminToken, type RunSummary } from "@/lib/api"
import type { LlmProvider, RunRecord, RunSettings, ServerStatus, Task } from "@/shared/types"

type Tab = "brief" | "risks" | "projects" | "activity"

const ONBOARDED_KEY = "bizops-standup-onboarded"

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

const writeFlag = (key: string) => {
  try {
    localStorage.setItem(key, "1")
  } catch {
    // Storage unavailable; the guide will simply show again next visit.
  }
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })

export default function App() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [settings, setSettings] = useState<RunSettings | null>(null)
  const [run, setRun] = useState<RunRecord | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [previewTasks, setPreviewTasks] = useState<Task[]>([])
  const [running, setRunning] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [tab, setTab] = useState<Tab>("brief")
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(getAdminToken())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const refreshRuns = useCallback(() => api.runs().then(setRuns).catch(() => {}), [])

  useEffect(() => {
    api
      .status()
      .then((loaded) => {
        setStatus(loaded)
        setSettings(loaded.defaults)
      })
      .catch((err) => setError(`Can't reach the server: ${err.message}`))
    api
      .runs()
      .then(async (loaded) => {
        setRuns(loaded)
        if (loaded[0]) setRun(await api.run(loaded[0].id))
        else {
          setPreviewTasks((await api.tasks()).tasks)
          if (!readFlag(ONBOARDED_KEY)) setHelpOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  // Keep the last known project list so counts don't drop to zero while a new run starts.
  useEffect(() => {
    if (run?.tasks.length) setPreviewTasks(run.tasks)
  }, [run?.tasks])

  const closeHelp = useCallback(() => {
    setHelpOpen(false)
    writeFlag(ONBOARDED_KEY)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

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
    setTab("brief")
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
        if (event.type === "done" && event.run.status === "failed") setTab("activity")
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
      refreshRuns()
    }
  }

  const handlePublish = async (override: boolean) => {
    if (!run || publishing) return
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
      setTab("brief")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const metrics = run?.metrics
  const tasks = run?.tasks.length ? run.tasks : previewTasks
  const isLatest = !run || run.id === runs[0]?.id || run.status === "running"
  const channel = settings?.slackChannel ?? status?.slack.defaultChannel ?? "Slack"

  const connections = status
    ? [
        { name: "Notion", ok: status.notion.configured },
        { name: "Slack", ok: status.slack.mode !== "none" },
        { name: "AI", ok: status.providers.some((provider) => provider.id !== "none" && provider.configured) },
      ]
    : []

  const tabs: [Tab, string, number | undefined][] = [
    ["brief", "Brief", undefined],
    ["risks", "Risks", metrics?.risks.length],
    ["projects", "Projects", tasks.length],
    ["activity", "Activity", undefined],
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Lamps health={run?.metrics?.health} size="sm" />
          </span>
          <div>
            <p className="brand-name">BizOps Standup Agent</p>
            <p className="brand-sub">
              {status?.notion.configured ? `From “${status.notion.database ?? "Notion"}” to Slack` : "Weekly updates from Notion to Slack"}
            </p>
          </div>
        </div>

        <div className="topbar-right">
          <button className="connections" onClick={() => setSettingsOpen(true)} title="Connections">
            {connections.map((connection) => (
              <span key={connection.name} className="connection">
                <span className={`dot ${connection.ok ? "dot-good" : "dot-off"}`} />
                {connection.name}
              </span>
            ))}
          </button>
          <button className="btn btn-ghost" onClick={() => setHelpOpen(true)}>
            <Icon name="help" size={16} />
            <span className="hide-sm">How it works</span>
          </button>
          <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)} disabled={!settings}>
            <Icon name="settings" size={16} />
            <span className="hide-sm">Settings</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button className="link" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <StatusHero
        key={run?.id ?? "none"}
        run={run}
        isLatest={isLatest}
        running={running}
        publishing={publishing}
        projectCount={tasks.length}
        channel={channel}
        canRun={!running && Boolean(settings)}
        onRun={handleRun}
        onPublish={handlePublish}
        onShowLatest={() => runs[0] && openRun(runs[0].id)}
      />

      <main className="layout">
        <section className="sheet">
          <div className="tabs" role="tablist">
            {tabs.map(([id, label, count]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`tab ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
                {count !== undefined && <span className="tab-count">{count}</span>}
              </button>
            ))}
          </div>

          <div className="tab-body">
            {tab === "brief" &&
              (run?.brief ? (
                <BriefView run={run} />
              ) : running ? (
                <div className="skeleton" aria-label="Writing the brief">
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ) : (
                <div className="empty">
                  <h3>No brief yet</h3>
                  <p>
                    When you write one, a preview shows here exactly as it will look in Slack.
                    {!status?.notion.configured && " Until Notion is connected, it uses demo projects."}
                  </p>
                </div>
              ))}
            {tab === "risks" &&
              (metrics ? (
                <RisksView risks={metrics.risks} />
              ) : (
                <p className="panel-note">Risks show here after the first brief.</p>
              ))}
            {tab === "projects" && <TrackerView tasks={tasks} />}
            {tab === "activity" && (
              <ol className="activity">
                {(run?.logs ?? []).map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className={`activity-item level-${entry.level}`}>
                    <span className="activity-dot" />
                    <span className="activity-msg">{entry.message}</span>
                    <time>{time(entry.at)}</time>
                  </li>
                ))}
                {!run && <p className="panel-note">Each step is listed here as the agent works.</p>}
              </ol>
            )}
          </div>
        </section>

        <aside className="side">
          <Checks run={run} />
          <AtAGlance metrics={metrics} projectCount={tasks.length} threshold={settings?.minConfidence ?? 70} />
          <History runs={runs} activeId={run?.id} threshold={settings?.minConfidence ?? 70} onOpen={openRun} />
        </aside>
      </main>

      {status && settings && (
        <SettingsDrawer
          open={settingsOpen}
          onClose={closeSettings}
          status={status}
          settings={settings}
          onChange={updateSetting}
          onProvider={changeProvider}
          token={token}
          onToken={(value) => {
            setToken(value)
            setAdminToken(value)
          }}
        />
      )}
      <HowItWorks open={helpOpen} onClose={closeHelp} />
    </div>
  )
}
