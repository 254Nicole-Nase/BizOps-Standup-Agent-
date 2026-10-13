import { describeGate } from "@/lib/copy"
import type { RunRecord } from "@/shared/types"

const PLACEHOLDER = ["On-track score is high enough", "Not too many urgent risks", "AI draft is complete", "Everything matches Notion"]

/** The quality gates, explained in everyday words. */
export default function Checks({ run }: { run: RunRecord | null }) {
  const passed = run?.gates.filter((gate) => gate.passed).length ?? 0
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Checks</h2>
        {run?.gates.length ? (
          <span className={`tag ${passed === run.gates.length ? "tag-good" : "tag-warn"}`}>
            {passed} of {run.gates.length} pass
          </span>
        ) : null}
      </div>
      <p className="panel-note">A draft only posts by itself when all four pass.</p>

      <ul className="checks">
        {run?.gates.length
          ? run.gates.map((gate) => {
              const { title, detail } = describeGate(gate, run)
              return (
                <li key={gate.id} className={`check ${gate.passed ? "is-pass" : "is-fail"}`}>
                  <span className="check-mark" aria-label={gate.passed ? "Passed" : "Failed"}>
                    {gate.passed ? "✓" : "!"}
                  </span>
                  <div>
                    <p className="check-title">{title}</p>
                    <p className="check-detail">{detail}</p>
                  </div>
                </li>
              )
            })
          : PLACEHOLDER.map((title) => (
              <li key={title} className="check is-pending">
                <span className="check-mark" />
                <p className="check-title">{title}</p>
              </li>
            ))}
      </ul>
    </section>
  )
}
