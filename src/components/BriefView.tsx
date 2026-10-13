import { useState } from "react"
import { friendlyModel, HEALTH_LABEL, SEVERITY_LABEL } from "@/lib/copy"
import type { RunRecord } from "@/shared/types"

const HEALTH_DOT = { Green: "dot-good", Yellow: "dot-warn", Red: "dot-bad" }

export default function BriefView({ run }: { run: RunRecord }) {
  const [raw, setRaw] = useState(false)
  const { brief, metrics } = run
  if (!brief || !metrics) return <p className="muted">This run did not produce a brief.</p>

  return (
    <div className="summary-stack">
      <div className="brief-toolbar">
        <span className={`source-chip ${run.briefSource}`}>
          {run.briefSource === "llm"
            ? `Written by ${friendlyModel(run.llm?.model)} in ${((run.llm?.latencyMs ?? 0) / 1000).toFixed(0)}s`
            : run.llm?.error
              ? "Basic template (the AI was unavailable)"
              : "Basic template"}
        </span>
        <button className="link" onClick={() => setRaw((value) => !value)}>
          {raw ? "Show as Slack will look" : "Show plain text"}
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
              <span className="muted">in {run.settings.slackChannel}</span>
            </div>

            <h3 className="slack-headline">
              <span className={`dot ${HEALTH_DOT[metrics.health]}`} aria-label={HEALTH_LABEL[metrics.health]} />
              {brief.headline}
            </h3>
            <p className="slack-text">{brief.summary}</p>

            <div className="slack-fields">
              <div>
                <span>Status</span>
                {HEALTH_LABEL[metrics.health]}, {metrics.confidence}%
              </div>
              <div>
                <span>Done</span>
                {metrics.completedTasks} of {metrics.totalTasks} projects
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
                      {SEVERITY_LABEL[risk.severity]}
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
                <h4>What we need from leadership</h4>
                <ul>
                  {brief.leadershipAsks.map((ask) => (
                    <li key={ask}>{ask}</li>
                  ))}
                </ul>
              </section>
            )}

            {brief.nextWeekFocus.length > 0 && (
              <section className="slack-section">
                <h4>Focus next week</h4>
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
