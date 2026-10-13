import { useState } from "react"
import type { RunRecord } from "@/shared/types"

const HEALTH_DOT = { Green: "dot-green", Yellow: "dot-yellow", Red: "dot-red" }
const SEVERITY_ICON = { high: "▲", medium: "◆", low: "•" }

export default function BriefView({ run }: { run: RunRecord }) {
  const [raw, setRaw] = useState(false)
  const { brief, metrics } = run
  if (!brief || !metrics) return <p className="muted">This run did not produce a brief.</p>

  return (
    <div className="summary-stack">
      <div className="brief-toolbar">
        <span className={`source-chip ${run.briefSource}`}>
          {run.briefSource === "llm"
            ? `Written by ${run.llm?.provider} · ${run.llm?.model} · ${((run.llm?.latencyMs ?? 0) / 1000).toFixed(1)}s`
            : run.llm?.error
              ? "Template fallback (LLM failed)"
              : "Deterministic template"}
        </span>
        <button className="link-button" onClick={() => setRaw((value) => !value)}>
          {raw ? "Show preview" : "Show Slack mrkdwn"}
        </button>
      </div>

      {raw ? (
        <pre className="slack-preview">{run.slackText}</pre>
      ) : (
        <article className="slack-message">
          <div className="slack-avatar">BO</div>
          <div className="slack-body">
            <div className="slack-meta">
              <strong>BizOps Standup Agent</strong>
              <span className="slack-app-tag">APP</span>
              <span className="muted">{run.settings.slackChannel}</span>
            </div>

            <h3 className="slack-headline">
              <span className={`health-dot ${HEALTH_DOT[metrics.health]}`} aria-label={metrics.health} />
              {brief.headline}
            </h3>
            <p className="slack-text">{brief.summary}</p>

            <div className="slack-fields">
              <div>
                <span>Health</span>
                {metrics.health} · {metrics.confidence}%
              </div>
              <div>
                <span>Delivered</span>
                {metrics.completedTasks}/{metrics.totalTasks} items
              </div>
              <div>
                <span>Blocked / at risk</span>
                {metrics.blockedTasks} / {metrics.atRiskTasks}
              </div>
              <div>
                <span>Overdue</span>
                {metrics.overdueTasks}
              </div>
            </div>

            {brief.wins.length > 0 && (
              <section className="slack-section">
                <h4>Wins</h4>
                <ul>
                  {brief.wins.map((win) => (
                    <li key={win}>{win}</li>
                  ))}
                </ul>
              </section>
            )}

            {brief.risks.length > 0 && (
              <section className="slack-section">
                <h4>Risks &amp; actions</h4>
                {brief.risks.map((risk) => (
                  <div key={`${risk.project}-${risk.issue}`} className="slack-risk">
                    <span className={`severity-pill ${risk.severity}`}>
                      {SEVERITY_ICON[risk.severity]} {risk.severity}
                    </span>
                    <div>
                      <p>
                        <strong>{risk.project}</strong>: {risk.issue}
                      </p>
                      <p className="slack-action">
                        ↳ {risk.action} <em>({risk.owner})</em>
                      </p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {brief.leadershipAsks.length > 0 && (
              <section className="slack-section">
                <h4>Asks for leadership</h4>
                <ul>
                  {brief.leadershipAsks.map((ask) => (
                    <li key={ask}>{ask}</li>
                  ))}
                </ul>
              </section>
            )}

            {brief.nextWeekFocus.length > 0 && (
              <section className="slack-section">
                <h4>Next week</h4>
                <ul>
                  {brief.nextWeekFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>
      )}
    </div>
  )
}
