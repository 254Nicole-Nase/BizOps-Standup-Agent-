import Icon from "@/components/Icon"
import { describeGate } from "@/lib/copy"
import type { RunRecord } from "@/shared/types"

/** The quality gates, explained in everyday words. */
export default function Checks({ run }: { run: RunRecord | null }) {
  return (
    <section className="card panel">
      <div className="panel-head">
        <h2>Checks</h2>
        {run?.gates.length ? (
          <span className={`count-chip ${run.gates.every((gate) => gate.passed) ? "good" : "warn"}`}>
            {run.gates.filter((gate) => gate.passed).length}/{run.gates.length} passed
          </span>
        ) : null}
      </div>
      <p className="panel-sub">Every draft is checked before it can go to Slack automatically.</p>

      {run?.gates.length ? (
        <ul className="check-list">
          {run.gates.map((gate) => {
            const { title, detail } = describeGate(gate, run)
            return (
              <li key={gate.id} className={`check ${gate.passed ? "pass" : "fail"}`}>
                <span className="check-icon">
                  <Icon name={gate.passed ? "check" : "alert"} size={14} />
                </span>
                <div>
                  <p className="check-title">{title}</p>
                  <p className="check-detail">{detail}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className="check-list muted-list">
          {["On-track score is high enough", "Not too many urgent risks", "AI draft is complete", "Everything matches Notion"].map(
            (title) => (
              <li key={title} className="check pending">
                <span className="check-icon" />
                <p className="check-title">{title}</p>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
