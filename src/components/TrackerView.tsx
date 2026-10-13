import type { Task, TaskStatus } from "@/shared/types"

const STATUS_LABEL: Record<TaskStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  at_risk: "At risk",
  blocked: "Blocked",
  not_started: "Not started",
}

const ORDER: TaskStatus[] = ["blocked", "at_risk", "in_progress", "not_started", "done"]

export default function TrackerView({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return <p className="muted">No tracker items loaded yet.</p>
  const sorted = [...tasks].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))

  return (
    <div className="table-wrap">
      <table className="tracker-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => (
            <tr key={task.id}>
              <td>
                {task.url ? (
                  <a href={task.url} target="_blank" rel="noreferrer">
                    {task.project}
                  </a>
                ) : (
                  task.project
                )}
                {task.latestUpdate && <div className="cell-sub">{task.latestUpdate}</div>}
              </td>
              <td>{task.owner}</td>
              <td>
                <span className={`status-tag ${task.status}`}>{STATUS_LABEL[task.status]}</span>
              </td>
              <td>
                <div className="progress-cell">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                  </div>
                  <span>{task.progress}%</span>
                </div>
              </td>
              <td className="mono">{task.dueDate ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
