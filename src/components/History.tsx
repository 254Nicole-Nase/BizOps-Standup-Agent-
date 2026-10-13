import ConfidenceTrend from "@/components/ConfidenceTrend"
import { RUN_STATUS_LABEL } from "@/lib/copy"
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
    <section className="card panel">
      <div className="panel-head">
        <h2>Past briefs</h2>
        {runs.length > 0 && <span className="count-chip">{runs.length}</span>}
      </div>
      {runs.length === 0 ? (
        <p className="empty-note">Your briefs will be listed here.</p>
      ) : (
        <>
          <ConfidenceTrend runs={runs} threshold={threshold} />
          <ul className="history-list">
            {runs.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button className={`history-item ${item.id === activeId ? "active" : ""}`} onClick={() => onOpen(item.id)}>
                  <span className="history-main">
                    <span className="history-title">{item.brief?.headline ?? `Brief #${item.number}`}</span>
                    <span className="history-date">
                      #{item.number} · {shortDate(item.startedAt)}
                      {item.trigger === "schedule" && " · scheduled"}
                    </span>
                  </span>
                  <span className={`status-chip status-${item.status}`}>{RUN_STATUS_LABEL[item.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
