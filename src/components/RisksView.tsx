import type { RiskItem } from "@/shared/types"

export default function RisksView({ risks }: { risks: RiskItem[] }) {
  if (risks.length === 0) return <p className="muted">No risks detected in this cycle.</p>

  return (
    <div className="blocker-grid">
      {risks.map((risk) => (
        <article key={risk.taskId} className="blocker-row">
          <div className="blocker-head">
            <h3>{risk.project}</h3>
            <span className={`severity-pill ${risk.severity}`}>{risk.severity}</span>
          </div>
          <p>{risk.summary}</p>
          <div className="signal-row">
            {risk.signals.map((signal) => (
              <span key={signal} className="signal-chip">
                {signal}
              </span>
            ))}
          </div>
          <div className="blocker-meta">
            <span>Owner: {risk.owner}</span>
            <span>
              {risk.dueInDays === null
                ? "No due date"
                : risk.overdue
                  ? `${Math.abs(risk.dueInDays)}d overdue`
                  : `Due in ${risk.dueInDays}d`}
            </span>
          </div>
          <div className="blocker-action">Next action: {risk.recommendedAction}</div>
        </article>
      ))}
    </div>
  )
}
