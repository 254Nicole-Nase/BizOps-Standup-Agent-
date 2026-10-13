import type { Metrics } from "@/shared/types"

/**
 * The on-track score drawn on its real 0–100 scale, with the Amber (65) and Green (80) bands
 * and the pass line from settings, so "71" reads as "just over the line" at a glance.
 */
export default function AtAGlance({
  metrics,
  projectCount,
  threshold,
}: {
  metrics?: Metrics
  projectCount: number
  threshold: number
}) {
  return (
    <section className="panel">
      <h2 className="panel-title">On-track score</h2>

      {metrics ? (
        <>
          <div className="score-line">
            <span className="score-number" data-health={metrics.health}>
              {metrics.confidence}
            </span>
            <span className="score-of">out of 100</span>
          </div>

          <div className="scale" role="img" aria-label={`Score ${metrics.confidence} of 100. Pass line ${threshold}.`}>
            <div className="scale-bands">
              <span className="band band-red" style={{ width: "65%" }} />
              <span className="band band-amber" style={{ width: "15%" }} />
              <span className="band band-green" style={{ width: "20%" }} />
            </div>
            <span className="scale-pass" style={{ left: `${threshold}%` }}>
              <span>pass {threshold}</span>
            </span>
            <span className="scale-marker" style={{ left: `${metrics.confidence}%` }} />
            <div className="scale-ticks">
              <span>0</span>
              <span style={{ left: "65%" }}>65</span>
              <span style={{ left: "80%" }}>80</span>
              <span style={{ left: "100%" }}>100</span>
            </div>
          </div>

          <p className="panel-note">Worked out from your tracker (status, blockers, due dates), not by AI.</p>

          <dl className="tally">
            <div>
              <dt>Done</dt>
              <dd>
                {metrics.completedTasks}
                <small>/{metrics.totalTasks}</small>
              </dd>
            </div>
            <div>
              <dt>Urgent</dt>
              <dd className={metrics.highSeverityRisks ? "is-bad" : ""}>{metrics.highSeverityRisks}</dd>
            </div>
            <div>
              <dt>Overdue</dt>
              <dd className={metrics.overdueTasks ? "is-warn" : ""}>{metrics.overdueTasks}</dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd className={metrics.blockedTasks ? "is-bad" : ""}>{metrics.blockedTasks}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="panel-note">
          {projectCount ? `${projectCount} projects in your tracker. ` : ""}The score appears once a brief is written.
        </p>
      )}
    </section>
  )
}
