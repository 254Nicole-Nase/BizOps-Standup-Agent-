import ConfidenceTrend from "@/components/ConfidenceTrend"
import Lamps from "@/components/Lamps"
import { isoWeek, RUN_STATUS_LABEL } from "@/lib/copy"
import type { RunSummary } from "@/lib/api"

const shortDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/** Past briefs with the on-track score over time. */
export default function History({
  runs,
  activeId,
  threshold,
  onOpen,
}: {
  runs: RunSummary[]
  activeId?: string
  threshold: number
  onOpen: (id: string) => void
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Past briefs</h2>
        {runs.length > 0 && <span className="tag">{runs.length}</span>}
      </div>
      {runs.length === 0 ? (
        <p className="panel-note">Every brief you write is kept here.</p>
      ) : (
        <>
          <ConfidenceTrend runs={runs} threshold={threshold} />
          <ul className="history">
            {runs.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button className={`history-item ${item.id === activeId ? "is-active" : ""}`} onClick={() => onOpen(item.id)}>
                  <Lamps health={item.metrics?.health} size="sm" />
                  <span className="history-main">
                    <span className="history-title">{item.brief?.headline ?? `Brief #${item.number}`}</span>
                    <span className="history-meta">
                      Wk {isoWeek(new Date(item.startedAt))}, {shortDate(item.startedAt)}
                      {item.trigger === "schedule" && ", scheduled"}
                    </span>
                  </span>
                  <span className={`state state-${item.status}`}>{RUN_STATUS_LABEL[item.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
