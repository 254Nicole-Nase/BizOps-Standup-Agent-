import { useEffect, useMemo, useState } from "react"
import Icon from "@/components/Icon"
import { friendlyModel } from "@/lib/copy"
import type { LlmProvider, RunSettings, ServerStatus } from "@/shared/types"

interface Props {
  open: boolean
  onClose: () => void
  status: ServerStatus
  settings: RunSettings
  onChange: <Key extends keyof RunSettings>(key: Key, value: RunSettings[Key]) => void
  onProvider: (provider: LlmProvider) => void
  token: string
  onToken: (token: string) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function SettingsDrawer({ open, onClose, status, settings, onChange, onProvider, token, onToken }: Props) {
  const [manualHours, setManualHours] = useState(4)
  const [reviewMinutes, setReviewMinutes] = useState(15)
  const [hourlyRate, setHourlyRate] = useState(85)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const saved = useMemo(() => {
    const weekly = Math.max(manualHours - reviewMinutes / 60, 0)
    return { weekly, yearly: weekly * 52 * hourlyRate }
  }, [manualHours, reviewMinutes, hourlyRate])

  const connections = [
    {
      name: "Notion",
      ok: status.notion.configured,
      detail: status.notion.configured
        ? `Reading “${status.notion.database ?? "your tracker"}”`
        : "Not connected, so demo data is used. Add NOTION_TOKEN and NOTION_DATABASE_ID.",
    },
    {
      name: "Slack",
      ok: status.slack.mode !== "none",
      detail:
        status.slack.mode === "bot"
          ? "Posting as the BizOps Standup Agent bot"
          : status.slack.mode === "webhook"
            ? "Posting through an incoming webhook"
            : "Not connected, so posts are only simulated. Add SLACK_BOT_TOKEN.",
    },
    {
      name: "AI writer",
      ok: status.providers.some((provider) => provider.id !== "none" && provider.configured),
      detail: status.providers.some((provider) => provider.id === "gemini" && provider.configured)
        ? "Google Gemini"
        : "Not connected, so a basic template is used. Add GEMINI_API_KEY.",
    },
    {
      name: "Schedule",
      ok: status.schedule.enabled,
      detail: status.schedule.enabled
        ? `Runs on its own (${status.schedule.cron}, ${status.schedule.timezone})`
        : "Manual only. Set SCHEDULE_CRON to run it every week.",
    },
  ]

  return (
    <div className={`drawer-root ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="drawer-head">
          <div>
            <h2>Settings</h2>
            <p className="panel-sub">Changes apply to the next brief you write.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <Icon name="close" />
          </button>
        </header>

        <div className="drawer-body">
          <section className="setting-group">
            <h3>Sharing</h3>
            <label className="field">
              <span>Slack channel</span>
              <input value={settings.slackChannel} onChange={(e) => onChange("slackChannel", e.target.value)} />
              <small>A channel ID (like C0123ABCD) or a name (like #leadership). Invite the bot to it first.</small>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autoPublish}
                onChange={(e) => onChange("autoPublish", e.target.checked)}
              />
              <span className="switch-track" />
              <span>
                <strong>Post automatically</strong>
                <small>Skip the review step when every check passes. Drafts that fail a check always wait for you.</small>
              </span>
            </label>
          </section>

          <section className="setting-group">
            <h3>Checks</h3>
            <div className="field">
              <div className="range-head">
                <span>Lowest on-track score to post</span>
                <strong>{settings.minConfidence}%</strong>
              </div>
              <input
                type="range"
                min={40}
                max={95}
                value={settings.minConfidence}
                onChange={(e) => onChange("minConfidence", Number(e.target.value))}
              />
              <small>Below this, the draft waits for a person to review it.</small>
            </div>
            <div className="field">
              <div className="range-head">
                <span>Most urgent risks allowed</span>
                <strong>{settings.highRiskLimit}</strong>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                value={settings.highRiskLimit}
                onChange={(e) => onChange("highRiskLimit", Number(e.target.value))}
              />
              <small>More urgent risks than this means leadership should see a reviewed draft.</small>
            </div>
          </section>

          <section className="setting-group">
            <h3>AI writer</h3>
            <label className="field">
              <span>Who writes the brief</span>
              <select value={settings.provider} onChange={(e) => onProvider(e.target.value as LlmProvider)}>
                {status.providers.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                    {provider.id === "gemini" ? "Google Gemini" : "Basic template (no AI)"}
                    {provider.configured ? "" : " (not connected)"}
                  </option>
                ))}
              </select>
            </label>
            {settings.provider !== "none" && (
              <label className="field">
                <span>Model</span>
                <input value={settings.model} onChange={(e) => onChange("model", e.target.value)} />
                <small>
                  Using {friendlyModel(settings.model)}. If Google says the model is busy, try another one, such as
                  gemini-2.5-flash-lite.
                </small>
              </label>
            )}
          </section>

          <section className="setting-group">
            <h3>Connections</h3>
            <ul className="connection-list">
              {connections.map((connection) => (
                <li key={connection.name}>
                  <span className={`dot ${connection.ok ? "dot-good" : "dot-off"}`} />
                  <div>
                    <p>{connection.name}</p>
                    <small>{connection.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="setting-group">
            <h3>Time saved estimate</h3>
            <div className="roi-grid">
              <label className="field">
                <span>Hours to write it by hand</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={manualHours}
                  onChange={(e) => setManualHours(clamp(Number(e.target.value) || 0, 0, 40))}
                />
              </label>
              <label className="field">
                <span>Minutes to review a draft</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={reviewMinutes}
                  onChange={(e) => setReviewMinutes(clamp(Number(e.target.value) || 0, 0, 240))}
                />
              </label>
              <label className="field">
                <span>Hourly cost ($)</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(clamp(Number(e.target.value) || 0, 0, 500))}
                />
              </label>
            </div>
            <p className="roi-result">
              About <strong>{saved.weekly.toFixed(1)} hours</strong> saved each week, or{" "}
              <strong>${Math.round(saved.yearly).toLocaleString()}</strong> a year.
            </p>
          </section>

          {status.authRequired && (
            <section className="setting-group">
              <h3>Access</h3>
              <label className="field">
                <span>Admin token</span>
                <input type="password" value={token} onChange={(e) => onToken(e.target.value)} />
                <small>Needed to write or post briefs on this server.</small>
              </label>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}
