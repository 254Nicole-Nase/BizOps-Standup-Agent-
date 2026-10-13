import { TASK_STATUS_LABEL } from "@/lib/copy"
import type { Task, TaskStatus } from "@/shared/types"

const ORDER: TaskStatus[] = ["blocked", "at_risk", "in_progress", "not_started", "done"]
const DAY = 86_400_000

const dueDate = (iso: string) => new Date(`${iso}T12:00:00`)

const daysFrom = (iso: string) => {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.round((dueDate(iso).getTime() - today.getTime()) / DAY)
}

/** Split-flap tiles: the status board look, one tile per character group. */
function Flaps({ text, tone }: { text: string; tone?: string }) {
  return (
    <span className={`flaps ${tone ? `flaps-${tone}` : ""}`} aria-label={text}>
      {text.split(" ").map((word, index) => (
        <span key={`${word}-${index}`} className="flap" aria-hidden="true">
          {word}
        </span>
      ))}
    </span>
  )
}

/** The tracker as a departures board: what's due, when, and whether it's on time. */
export default function TrackerView({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return <p className="panel-note">No projects loaded yet.</p>
  const sorted = [...tasks].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
  )

  return (
    <div className="board-wrap">
      <div className="board-head">
        <span>Projects</span>
        <span className="board-clock">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
        </span>
      </div>
      <table className="board">
        <thead>
          <tr>
            <th>Project</th>
            <th>Due</th>
            <th className="hide-narrow">Progress</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const days = task.dueDate ? daysFrom(task.dueDate) : null
            const late = days !== null && days < 0 && task.status !== "done"
            const filled = Math.round(task.progress / 10)
            return (
              <tr key={task.id} className={`row-${task.status}`}>
                <td>
                  {task.url ? (
                    <a className="board-project" href={task.url} target="_blank" rel="noreferrer">
                      {task.project}
                    </a>
                  ) : (
                    <span className="board-project">{task.project}</span>
                  )}
                  <span className="board-owner">{task.owner}</span>
                  {task.latestUpdate && <span className="board-update">{task.latestUpdate}</span>}
                </td>
                <td className="board-due">
                  {task.dueDate ? (
                    <>
                      <Flaps
                        text={dueDate(task.dueDate)
                          .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          .toUpperCase()}
                      />
                      <span className={`board-when ${late ? "is-late" : ""}`}>
                        {task.status === "done"
                          ? "delivered"
                          : days === 0
                            ? "today"
                            : late
                              ? `${-days!}d late`
                              : `in ${days}d`}
                      </span>
                    </>
                  ) : (
                    <span className="board-when">no date</span>
                  )}
                </td>
                <td className="hide-narrow">
                  <span className="cells" role="img" aria-label={`${task.progress}% complete`}>
                    {Array.from({ length: 10 }, (_, index) => (
                      <span key={index} className={index < filled ? "on" : ""} />
                    ))}
                  </span>
                  <span className="cells-pct">{task.progress}%</span>
                </td>
                <td>
                  <Flaps text={TASK_STATUS_LABEL[task.status].toUpperCase()} tone={task.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
