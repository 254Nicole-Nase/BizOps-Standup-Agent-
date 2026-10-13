import Icon from "@/components/Icon"
import { HEALTH_LABEL } from "@/lib/copy"
import type { Metrics } from "@/shared/types"

/** Headline numbers from the latest scoring, with a short explanation of the score. */
export default function AtAGlance({ metrics, projectCount }: { metrics?: Metrics; projectCount: number }) {
  return (
    <section className="card panel">
      <div className="panel-head">
        <h2>At a glance</h2>
        {metrics && <span className={`health-chip health-${metrics.health.toLowerCase()}`}>{HEALTH_LABEL[metrics.health]}</span>}
      </div>

      {metrics ? (
        <>
          <div className="score">
            <div className="score-ring" style={{ ["--value" as string]: metrics.confidence }} data-health={metrics.health}>
              <span>{metrics.confidence}</span>
            </div>
            <div>
              <p className="score-title">On-track score</p>
              <p className="panel-sub">
                Out of 100. Worked out from your tracker (status, blockers and due dates), not by AI.
              </p>
            </div>
          </div>
          <dl className="stats">
            <div>
              <dt>Done</dt>
              <dd>
                {metrics.completedTasks}
                <small> of {metrics.totalTasks}</small>
              </dd>
            </div>
            <div>
              <dt>Urgent</dt>
              <dd className={metrics.highSeverityRisks ? "text-bad" : ""}>{metrics.highSeverityRisks}</dd>
            </div>
            <div>
              <dt>Overdue</dt>
              <dd className={metrics.overdueTasks ? "text-warn" : ""}>{metrics.overdueTasks}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="empty-note">
          <Icon name="info" size={16} />
          {projectCount
            ? `${projectCount} projects in your tracker. Scores appear once a brief is written.`
            : "Scores appear once a brief is written."}
        </p>
      )}
    </section>
  )
}
